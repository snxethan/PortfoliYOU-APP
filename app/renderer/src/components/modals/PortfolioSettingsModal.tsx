import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Copy, Download, Image as ImageIcon, Loader2, Palette, RefreshCcw, SlidersHorizontal, Trash2, UploadCloud, X } from "lucide-react";

import type { PortfolioMeta } from "../../providers/ProjectsProvider";
import { useProjects } from "../../providers/ProjectsProvider";
import { useAuth } from "../../providers/AuthProvider";
import { useAssets } from "../../providers/AssetsProvider";
import { useNotifications } from "../../providers/NotificationsProvider";
import { THEME_PRESETS } from "../../themes/presets";
import type { Theme } from "../../themes/types";
import { getPreviewState } from "../../lib/previewInterop";
import { useScrollLock } from "../../hooks/useScrollLock";

const INVALID_FILENAME = /[\\/:*?"<>|]/g;

type SectionKey = "portfolio" | "cloud" | "theme" | "build" | "preview" | "saving";

type Draft = {
    siteTitle: string;
    tagline: string;
    description: string;
    author: string;
    websiteUrl: string;
    iconEmoji: string;
    iconImageUrl: string;
    socialImageUrl: string;
};

type ColorKey = keyof Theme['colors'];

type ColorFieldProps = {
    label: string;
    value: string;
    onChange: (value: string) => void;
};

type Props = {
    open: boolean;
    mode: "create" | "project" | "cloud";
    projectId?: string;
    cloudId?: string;
    initialMetadata?: Partial<PortfolioMeta>;
    defaultSection?: SectionKey;
    onClose: () => void;
};

const buildDraft = (meta?: Partial<PortfolioMeta> | null, fallbackName = ""): Draft => ({
    siteTitle: meta?.siteTitle || fallbackName,
    tagline: meta?.tagline || "",
    description: meta?.description || "",
    author: meta?.author || "",
    websiteUrl: meta?.websiteUrl || "",
    iconEmoji: meta?.iconEmoji || "",
    iconImageUrl: meta?.iconImageUrl || "",
    socialImageUrl: meta?.socialImageUrl || "",
});

const toMetadataPayload = (draft: Draft): Partial<PortfolioMeta> => {
    const emoji = draft.iconEmoji.trim();
    const iconUrl = draft.iconImageUrl.trim();
    return {
        siteTitle: draft.siteTitle.trim(),
        tagline: draft.tagline.trim() || undefined,
        description: draft.description.trim() || undefined,
        author: draft.author.trim() || undefined,
        websiteUrl: draft.websiteUrl.trim() || undefined,
        iconEmoji: iconUrl ? undefined : (emoji || undefined),
        iconImageUrl: iconUrl || undefined,
        socialImageUrl: draft.socialImageUrl.trim() || undefined,
    };
};

const validateDraft = (draft: Draft) => {
    const errors: Record<string, string> = {};
    const title = draft.siteTitle.trim();
    if (!title) errors.siteTitle = "Portfolio name is required";
    if (title && (title.length < 2 || title.length > 80)) errors.siteTitle = "Name must be 2-80 characters";
    if (title && INVALID_FILENAME.test(title)) errors.siteTitle = "Remove special characters such as / : * ? \" < > |";
    const urlCheck = (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return false;
        try {
            const next = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
            const u = new URL(next);
            return u.protocol === "http:" || u.protocol === "https:";
        } catch {
            return false;
        }
    };
    if (draft.websiteUrl && !urlCheck(draft.websiteUrl)) errors.websiteUrl = "Enter a valid URL (include http/https)";
    if (draft.socialImageUrl && !urlCheck(draft.socialImageUrl)) errors.socialImageUrl = "Enter a valid URL";
    return errors;
};

const formatBytes = (value: number) => {
    if (!value || value <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    const scaled = value / Math.pow(1024, exponent);
    const decimals = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
    return `${scaled.toFixed(decimals)} ${units[exponent]}`;
};

export default function PortfolioSettingsModal({ open, mode, projectId, cloudId, initialMetadata, defaultSection = "portfolio", onClose }: Props) {
    useScrollLock(open);

    const { user } = useAuth();
    const {
        projects,
        createProjectWithSave,
        updateProjectMetadata,
        selectProject,
        exportProject,
        getCloudObjectInfo,
        getCloudObjectInfoByCloudId,
        renameCloudProject,
        deleteCloudProjectByCloudId,
        setActiveTheme,
        duplicateTheme,
        deleteTheme,
        updateTheme,
        createThemeFromPreset,
        autosaveEnabled,
        setAutosaveEnabled,
        saveProject,
        syncProject,
        deleteProject,
        cloudMaxProjects,
        cloudProjectsCount,
        cloudMaxStorageMB,
        cloudBytesUsed
    } = useProjects();
    const { addFiles, getUrl } = useAssets();
    const { add: notify } = useNotifications();
    const iconUploadRef = useRef<HTMLInputElement | null>(null);
    const [iconPreviewUrl, setIconPreviewUrl] = useState<string | null>(null);
    const [iconUploadError, setIconUploadError] = useState<string | null>(null);

    const project = useMemo(() => {
        if (mode === "project" && projectId) return projects.find(p => p.id === projectId) || null;
        if (mode !== "create" && cloudId) return projects.find(p => p._cloudId === cloudId) || null;
        return null;
    }, [projects, projectId, cloudId, mode]);
    const activeTheme = project ? project.themes?.[project.activeThemeId] ?? null : null;
    const themeEntries = useMemo(() => project ? Object.values(project.themes || {}) : [], [project?.themes]);
    const canDeleteTheme = themeEntries.length > 1;
    const [themeNameDraft, setThemeNameDraft] = useState<string>(activeTheme?.name || "");
    useEffect(() => { setThemeNameDraft(activeTheme?.name || ""); }, [activeTheme?.themeId]);

    const isCreateMode = mode === "create";
    const [draft, setDraft] = useState<Draft>(() => buildDraft(initialMetadata as PortfolioMeta | undefined, initialMetadata?.siteTitle || project?.name || "New Portfolio"));
    useEffect(() => {
        setDraft(buildDraft(project?.portfolioMeta || initialMetadata || null, project?.name || initialMetadata?.siteTitle || "New Portfolio"));
    }, [projectId, project?.portfolioMeta, initialMetadata, mode, project?.name]);
    const iconSource = draft.iconImageUrl;
    useEffect(() => {
        let disposed = false;
        const loadPreview = async () => {
            const src = iconSource?.trim();
            if (!src) {
                if (!disposed) setIconPreviewUrl(null);
                return;
            }
            if (src.startsWith("asset://")) {
                const hash = src.slice("asset://".length);
                try {
                    const url = await getUrl(hash);
                    if (!disposed) setIconPreviewUrl(url);
                } catch {
                    if (!disposed) setIconPreviewUrl(null);
                }
                return;
            }
            if (!disposed) setIconPreviewUrl(src);
        };
        void loadPreview();
        return () => {
            disposed = true;
        };
    }, [iconSource, getUrl]);

    const handleIconEmojiChange = (value: string) => {
        setIconUploadError(null);
        setDraft(prev => ({
            ...prev,
            iconEmoji: value,
            iconImageUrl: value ? "" : prev.iconImageUrl,
        }));
    };

    const handleIconUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setIconUploadError(null);
        try {
            const uploaded = await addFiles(files);
            const first = uploaded?.[0];
            if (first) {
                setDraft(prev => ({ ...prev, iconEmoji: "", iconImageUrl: `asset://${first.hash}` }));
            } else {
                setIconUploadError("Upload failed. Please try again.");
            }
        } catch {
            setIconUploadError("Upload failed. Please try again.");
        } finally {
            if (iconUploadRef.current) iconUploadRef.current.value = "";
        }
    };

    const removeIconImage = () => {
        setDraft(prev => ({ ...prev, iconImageUrl: "" }));
        setIconUploadError(null);
    };

    const handleThemeColorChange = useCallback((key: ColorKey, value: string) => {
        if (!project || !activeTheme) return;
        updateTheme(project.id, activeTheme.themeId, { colors: { [key]: value } as Partial<Theme['colors']> });
    }, [project, activeTheme, updateTheme]);

    const handleFontChange = useCallback((field: 'heading' | 'body', value: string) => {
        if (!project || !activeTheme) return;
        updateTheme(project.id, activeTheme.themeId, { typography: { [field]: value } });
    }, [project, activeTheme, updateTheme]);

    const handleScaleChange = useCallback((value: number) => {
        if (!project || !activeTheme) return;
        updateTheme(project.id, activeTheme.themeId, { typography: { scale: value } });
    }, [project, activeTheme, updateTheme]);

    const commitThemeName = useCallback(() => {
        if (!project || !activeTheme) return;
        const trimmed = (themeNameDraft || "").trim();
        if (!trimmed) { setThemeNameDraft(activeTheme.name); return; }
        if (trimmed === activeTheme.name) return;
        updateTheme(project.id, activeTheme.themeId, { name: trimmed });
    }, [project, activeTheme, themeNameDraft, updateTheme]);

    const handleDuplicateTheme = useCallback(() => {
        if (!project || !activeTheme) return;
        duplicateTheme(project.id, activeTheme.themeId, { activate: true });
    }, [project, activeTheme, duplicateTheme]);

    const handleDeleteTheme = useCallback(() => {
        if (!project || !activeTheme || !canDeleteTheme) return;
        deleteTheme(project.id, activeTheme.themeId);
    }, [project, activeTheme, canDeleteTheme, deleteTheme]);

    const handleCreateThemeFromPreset = useCallback((presetId: string) => {
        if (!project) return;
        createThemeFromPreset(project.id, presetId, { activate: true });
    }, [project, createThemeFromPreset]);

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [savingDraft, setSavingDraft] = useState(false);
    // Build settings local state (moved to top-level to preserve hook order)
    const [includeAssetsState, setIncludeAssetsState] = useState<boolean>(() => {
        const current = (project?.portfolioMeta as any)?.buildSettings || {};
        return !!current.includeAssets;
    });
    const [basePathState, setBasePathState] = useState<string>(() => {
        const current = (project?.portfolioMeta as any)?.buildSettings || {};
        return current.basePath || "";
    });
    // Preview settings local state
    const [previewPortState, setPreviewPortState] = useState<number>(() => {
        const current = (project?.portfolioMeta as any)?.buildSettings || {};
        const p = (current.preview && current.preview.port) || (current.previewPort) || 0;
        return Number(p) || 0;
    });
    const [previewHostState, setPreviewHostState] = useState<string>(() => {
        const current = (project?.portfolioMeta as any)?.buildSettings || {};
        return (current.preview && current.preview.host) || (current.previewHost) || 'localhost';
    });
    const [previewOpenOnStartState, setPreviewOpenOnStartState] = useState<boolean>(() => {
        const current = (project?.portfolioMeta as any)?.buildSettings || {};
        return !!(current.preview && current.preview.openOnStart);
    });
    const [syncingBuild, setSyncingBuild] = useState(false);
    const [cloudSyncing, setCloudSyncing] = useState(false);
    const [cloudToggleTouched, setCloudToggleTouched] = useState(false);
    const [createCloudEnabled, setCreateCloudEnabled] = useState<boolean>(() => Boolean(user && isCreateMode));
    const [deletingProject, setDeletingProject] = useState(false);
    React.useEffect(() => {
        const current = (project?.portfolioMeta as any)?.buildSettings || {};
        setIncludeAssetsState(!!current.includeAssets);
        setBasePathState(current.basePath || "");
        // hydrate preview settings when project changes
        setPreviewPortState(Number((current.preview && current.preview.port) || (current.previewPort) || 0) || 0);
        setPreviewHostState((current.preview && current.preview.host) || (current.previewHost) || 'localhost');
        setPreviewOpenOnStartState(!!(current.preview && current.preview.openOnStart));
    }, [project?.id, project?.portfolioMeta]);
    useEffect(() => {
        if (!isCreateMode) {
            setCloudToggleTouched(false);
            setCreateCloudEnabled(false);
            return;
        }
        if (!user) {
            setCloudToggleTouched(false);
            setCreateCloudEnabled(false);
            return;
        }
        if (!cloudToggleTouched) {
            setCreateCloudEnabled(true);
        }
    }, [isCreateMode, user, cloudToggleTouched]);

    const handleCreateCloudToggle = (next: boolean) => {
        setCloudToggleTouched(true);
        setCreateCloudEnabled(next);
    };

    const initialExpanded = useMemo<Record<SectionKey, boolean>>(() => ({
        portfolio: defaultSection === "portfolio",
        cloud: defaultSection === "cloud",
        theme: defaultSection === "theme",
        build: defaultSection === "build",
        preview: defaultSection === "preview",
        saving: defaultSection === "saving",
    }), [defaultSection]);
    const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>(initialExpanded);
    useEffect(() => setExpanded(initialExpanded), [initialExpanded]);

    const toggleSection = (key: SectionKey) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

    const [cloudInfo, setCloudInfo] = useState<{ storagePath: string; sizeBytes: number; updatedAt: string } | null>(null);
    const [cloudLoading, setCloudLoading] = useState(false);
    const [cloudBusy, setCloudBusy] = useState(false);
    const targetCloudId = project?._cloudId || cloudId || null;
    const previewProjectId = project?._cloudId || project?.id || null;
    const showCreateCloudToggle = isCreateMode && !!user;
    const showCloudSection = isCreateMode || (!!user && !isCreateMode);
    const storageLimitBytes = Math.max(cloudMaxStorageMB || 0, 0) * 1024 * 1024;
    const normalizedProjectCap = cloudMaxProjects && cloudMaxProjects > 0 ? cloudMaxProjects : 0;
    const reachedProjectLimit = normalizedProjectCap > 0 ? cloudProjectsCount >= normalizedProjectCap : false;
    const reachedStorageLimit = storageLimitBytes > 0 ? cloudBytesUsed >= storageLimitBytes : false;
    const activeIsCloudProject = Boolean(project && (project.storage ?? "local") === "cloud");
    const showBuildSyncCta = Boolean(!isCreateMode && project && !activeIsCloudProject);
    const syncDisabledReason = !user
        ? "Sign in to sync this portfolio."
        : reachedProjectLimit
            ? "Cloud project limit reached. Delete older cloud portfolios or upgrade."
            : reachedStorageLimit
                ? "Cloud storage is full. Clear space before syncing."
                : null;
    const storageUsageLabel = storageLimitBytes > 0
        ? `${formatBytes(cloudBytesUsed)} / ${cloudMaxStorageMB} MB`
        : `${formatBytes(cloudBytesUsed)} used`;
    const storageUsagePercent = storageLimitBytes > 0 && cloudBytesUsed > 0
        ? Math.min(100, Math.round((cloudBytesUsed / storageLimitBytes) * 100))
        : 0;

    const loadCloudInfo = useCallback(async () => {
        if (!targetCloudId) { setCloudInfo(null); return; }
        setCloudLoading(true);
        try {
            if (project && project.id) {
                const info = await getCloudObjectInfo(project.id);
                setCloudInfo(info);
            } else {
                const info = await getCloudObjectInfoByCloudId(targetCloudId);
                setCloudInfo(info);
            }
        } catch {
            setCloudInfo(null);
        } finally {
            setCloudLoading(false);
        }
    }, [getCloudObjectInfo, getCloudObjectInfoByCloudId, project, targetCloudId]);

    useEffect(() => {
        if (!expanded.cloud) return;
        loadCloudInfo();
    }, [expanded.cloud, loadCloudInfo]);

    if (!open) return null;

    const submitLabel = mode === "create" ? "Create & Save" : "Save changes";

    const handleSave = async () => {
        setFormError(null);
        const validation = validateDraft(draft);
        setErrors(validation);
        if (Object.keys(validation).length > 0) return;
        setSavingDraft(true);
        try {
            const metadata = toMetadataPayload(draft);
            // Merge preview/build settings into the metadata so they save together when user clicks Save
            const existingMeta = project?.portfolioMeta || {};
            const existingBuild = (existingMeta as any).buildSettings || {};
            const mergedBuild = {
                ...(existingBuild || {}),
                includeAssets: includeAssetsState,
                basePath: basePathState || undefined,
                preview: {
                    ...(existingBuild.preview || {}),
                    port: previewPortState || undefined,
                    host: previewHostState || undefined,
                    openOnStart: previewOpenOnStartState || undefined,
                }
            };

            const mergedMetadata = {
                ...metadata,
                buildSettings: mergedBuild
            } as Partial<PortfolioMeta>;

            if (mode === "create") {
                const created = await createProjectWithSave({
                    name: mergedMetadata.siteTitle || draft.siteTitle,
                    metadata: mergedMetadata,
                    createCloud: Boolean(user && createCloudEnabled),
                });
                if (created?.id) selectProject(created.id);
                notify({ type: "success", title: "Portfolio created", message: `Saved ${mergedMetadata.siteTitle || draft.siteTitle}.`, persistent: false });
                onClose();
                return;
            }
            if (project) {
                await updateProjectMetadata(project.id, { name: mergedMetadata.siteTitle, metadata: mergedMetadata });
                notify({ type: "success", title: "Portfolio updated", message: "Portfolio settings saved.", persistent: false });
                // If a local preview is currently running, request a reload so the new preview settings are applied immediately
                try {
                    const running = !!getPreviewState(previewProjectId)?.running;
                    if (running) window.dispatchEvent(new CustomEvent('py:preview-reload-request', { detail: { projectId: previewProjectId } }));
                } catch { /* ignore */ }
                onClose();
            }
        } catch {
            setFormError("Something went wrong while saving portfolio settings.");
        } finally {
            setSavingDraft(false);
        }
    };

    const renderSection = (key: SectionKey, title: string, status?: string, children?: React.ReactNode) => (
        <div className="border border-[color:var(--border)] rounded-md">
            <button type="button" className="w-full flex items-center justify-between px-3 py-2 text-left" onClick={() => toggleSection(key)}>
                <div className="flex items-center gap-2">
                    {expanded[key] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <span className="font-semibold text-sm uppercase tracking-wide">{title}</span>
                </div>
                {status && <span className="text-[10px] uppercase tracking-wide text-[color:var(--fg-muted)]">{status}</span>}
            </button>
            {expanded[key] && (
                <div className="border-t border-[color:var(--border)] bg-[color:var(--muted)]/20 p-4 space-y-3">
                    {children}
                </div>
            )}
        </div>
    );

    const cloudStatus = !user
        ? "Sign in"
        : isCreateMode
            ? (createCloudEnabled ? "Cloud" : "Local file")
            : (!project && mode === "cloud" ? "Cloud only" : (project?._cloudId ? "Linked" : "Not linked"));

    const handleCloudAction = async (action: () => Promise<unknown>) => {
        setCloudBusy(true);
        try {
            await action();
            await loadCloudInfo();
        } finally {
            setCloudBusy(false);
        }
    };

    const renderPortfolioFields = () => (
        <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wide">
                Portfolio name
                <input
                    className={`input mt-1 w-full ${errors.siteTitle ? 'input-error' : ''}`}
                    value={draft.siteTitle}
                    onChange={(e) => setDraft(prev => ({ ...prev, siteTitle: e.target.value }))}
                    placeholder="My awesome portfolio"
                    data-testid="portfolio-name-input"
                />
                {errors.siteTitle && <span className="text-xs text-red-500 mt-1 block">{errors.siteTitle}</span>}
            </label>
            <label className="block text-xs uppercase tracking-wide">
                Tagline (optional)
                <input className="input mt-1 w-full" value={draft.tagline} onChange={e => setDraft(prev => ({ ...prev, tagline: e.target.value }))} placeholder="Product designer · storyteller" />
            </label>
            <label className="block text-xs uppercase tracking-wide">
                Description (optional)
                <textarea className="input mt-1 w-full min-h-[90px]" value={draft.description} onChange={e => setDraft(prev => ({ ...prev, description: e.target.value }))} placeholder="Short summary for SEO & previews" />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-xs uppercase tracking-wide">
                    Author
                    <input className="input mt-1 w-full" value={draft.author} onChange={e => setDraft(prev => ({ ...prev, author: e.target.value }))} placeholder="Your name" />
                </label>
                <label className="block text-xs uppercase tracking-wide">
                    Website URL
                    <input className={`input mt-1 w-full ${errors.websiteUrl ? 'input-error' : ''}`} value={draft.websiteUrl} onChange={e => setDraft(prev => ({ ...prev, websiteUrl: e.target.value }))} placeholder="https://example.com" />
                    {errors.websiteUrl && <span className="text-xs text-red-500 mt-1 block">{errors.websiteUrl}</span>}
                </label>
            </div>
            <label className="block text-xs uppercase tracking-wide">
                Icon / emoji
                <div className="mt-1 flex flex-col gap-2">
                    <div className="flex flex-col sm:flex-row sm:items-stretch gap-2">
                        <input
                            className="input w-full"
                            value={draft.iconEmoji}
                            maxLength={12}
                            onChange={e => handleIconEmojiChange(e.target.value)}
                            placeholder="Type an emoji like ✨"
                        />
                        <div className="flex items-center">
                            <input
                                ref={iconUploadRef}
                                type="file"
                                accept="image/*"
                                className="sr-only"
                                onChange={e => { void handleIconUpload(e.target.files); }}
                            />
                            <button type="button" className="btn btn-ghost btn-sm whitespace-nowrap" onClick={() => iconUploadRef.current?.click()}>
                                <ImageIcon size={14} className="mr-1" /> Upload image
                            </button>
                        </div>
                    </div>
                    <p className="text-[11px] text-[color:var(--fg-muted)]">Use a single emoji or upload a square PNG/SVG. Uploads are stored in your Assets library.</p>
                </div>
            </label>
            {draft.iconImageUrl && (
                <div className="rounded border border-dashed border-[color:var(--border)] bg-[color:var(--surface)]/40 p-2 flex items-center gap-3">
                    {iconPreviewUrl ? (
                        <img src={iconPreviewUrl} alt="Icon preview" className="w-10 h-10 rounded object-cover border border-[color:var(--border)]" />
                    ) : (
                        <div className="w-10 h-10 rounded border border-dashed border-[color:var(--border)] flex items-center justify-center text-[10px] text-[color:var(--fg-muted)]">
                            Preview
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono truncate">{draft.iconImageUrl}</p>
                        <p className="text-[10px] text-[color:var(--fg-muted)]">Stored locally in Assets</p>
                    </div>
                    <button type="button" className="btn btn-ghost btn-xs" onClick={removeIconImage}><X size={12} className="mr-1" />Remove</button>
                </div>
            )}
            {iconUploadError && <p className="text-xs text-red-500">{iconUploadError}</p>}
            <label className="block text-xs uppercase tracking-wide">
                Social preview image URL
                <input className={`input mt-1 w-full ${errors.socialImageUrl ? 'input-error' : ''}`} value={draft.socialImageUrl} onChange={e => setDraft(prev => ({ ...prev, socialImageUrl: e.target.value }))} placeholder="https://.../preview.png" />
                {errors.socialImageUrl && <span className="text-xs text-red-500 mt-1 block">{errors.socialImageUrl}</span>}
            </label>
        </div>
    );

    const toggleIncludeAssets = async () => {
        const next = !includeAssetsState;
        setIncludeAssetsState(next);
        if (!project) return;
        try {
            await updateProjectMetadata(project.id, { metadata: ({ ...(project.portfolioMeta || {}), buildSettings: { ...(project.portfolioMeta as any)?.buildSettings, includeAssets: next, basePath: basePathState || undefined } } as any) });
        } catch { /* ignore */ }
    };

    const setBase = async (v: string) => {
        setBasePathState(v);
        if (!project) return;
        try {
            await updateProjectMetadata(project.id, { metadata: ({ ...(project.portfolioMeta || {}), buildSettings: { ...(project.portfolioMeta as any)?.buildSettings, includeAssets: includeAssetsState, basePath: v || undefined } } as any) });
        } catch { /* ignore */ }
    };

    const handleSyncFromBuildSection = async () => {
        if (!project) return;
        setSyncingBuild(true);
        try {
            await syncProject(project.id);
        } finally {
            setSyncingBuild(false);
        }
    };

    const handleCloudSync = useCallback(async () => {
        if (!project) return;
        setCloudSyncing(true);
        try {
            await syncProject(project.id);
        } finally {
            setCloudSyncing(false);
        }
    }, [project, syncProject]);

    const handleDeletePortfolio = useCallback(async () => {
        if (!project) return;
        const confirmed = window.confirm(`Delete "${project.name || "this portfolio"}"? This removes it from the app and closes the settings panel.`);
        if (!confirmed) return;
        setDeletingProject(true);
        try {
            await deleteProject(project.id);
            onClose();
        } finally {
            setDeletingProject(false);
        }
    }, [project, deleteProject, onClose]);

    const renderBuildBody = () => (
        <div className="space-y-4">
            <div className="space-y-3">
                <label className="flex items-center space-x-2">
                    <input type="checkbox" checked={includeAssetsState} onChange={() => void toggleIncludeAssets()} />
                    <span className="text-[color:var(--fg-muted)]">Include uploaded assets in builds</span>
                </label>
                <label className="block text-xs uppercase tracking-wide">
                    Base path (optional)
                    <input className="input mt-1 w-full" value={basePathState} onChange={e => void setBase(e.target.value)} placeholder="/base/path" />
                    <div className="text-xs text-[color:var(--fg-muted)] mt-1">Optional base path for the generated site.</div>
                </label>
            </div>
            {showBuildSyncCta && (
                <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/60 p-4 space-y-3">
                    <div className="flex flex-wrap items-start gap-3">
                        <div className="flex-1 min-w-[220px]">
                            <p className="text-sm font-semibold">Sync builds to Projects</p>
                            <p className="text-xs text-[color:var(--fg-muted)]">Upload this local portfolio so the Deploy tab and other devices can build it.</p>
                        </div>
                        <button
                            className="btn btn-primary btn-sm"
                            disabled={Boolean(syncDisabledReason) || syncingBuild}
                            onClick={handleSyncFromBuildSection}
                        >
                            {syncingBuild ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                            <span className="ml-2">{syncingBuild ? "Syncing…" : "Sync to Projects"}</span>
                        </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[color:var(--fg-muted)]">
                        <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]/70 p-3">
                            <p className="uppercase tracking-wide text-[10px]">Cloud projects</p>
                            <p className="text-sm font-semibold text-white">
                                {normalizedProjectCap ? `${Math.min(cloudProjectsCount, normalizedProjectCap)} / ${normalizedProjectCap}` : cloudProjectsCount}
                            </p>
                        </div>
                        <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]/70 p-3">
                            <p className="uppercase tracking-wide text-[10px]">Storage usage</p>
                            <p className="text-sm font-semibold text-white">{storageUsageLabel}</p>
                            {storageLimitBytes > 0 && (
                                <div className="mt-2 h-2 rounded-full bg-[color:var(--border)]/60 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-[color:var(--accent)]"
                                        style={{ width: `${storageUsagePercent}%` }}
                                    ></div>
                                </div>
                            )}
                        </div>
                    </div>
                    {syncDisabledReason && (
                        <p className="text-xs text-red-300">{syncDisabledReason}</p>
                    )}
                </div>
            )}
            {!showBuildSyncCta && !isCreateMode && activeIsCloudProject && (
                <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]/60 p-3 text-xs text-[color:var(--fg-muted)]">
                    This portfolio already syncs to your Projects workspace. Builds deploy from the cloud automatically.
                </div>
            )}
        </div>
    );

    const renderSavingBody = () => (
        <div className="space-y-3">
            <label className="flex items-center space-x-2">
                <input type="checkbox" checked={!!autosaveEnabled} onChange={() => setAutosaveEnabled(!autosaveEnabled)} />
                <span className="text-[color:var(--fg-muted)]">Enable autosave</span>
            </label>
            <div>
                <p className="text-xs uppercase tracking-wide text-[color:var(--fg-muted)]">Project file</p>
                <div className="mt-1 rounded border border-dashed border-[color:var(--border)] p-2 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono break-all">{project?._filePath || '(not saved to disk)'}</p>
                        <p className="text-xs text-[color:var(--fg-muted)]">Location of the saved .portfoliyou file</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="btn btn-ghost btn-sm" disabled={!project?._filePath} onClick={async () => { if (project?._filePath && (window as any).api?.showItemInFolder) await (window as any).api.showItemInFolder({ filePath: project._filePath }); }}>Open</button>
                        <button className="btn btn-ghost btn-sm" onClick={async () => { if (project?.id) await saveProject(project.id, { saveAs: true }); }}>Save As…</button>
                        {/* Duplicate action removed; use "Save As…" to save a copy */}
                    </div>
                </div>
            </div>
        </div>
    );

    // Note: preview settings are saved when the user clicks the main Save button below.

    const renderPreviewBody = () => (
        <div className="space-y-3">
            <label className="block text-xs uppercase tracking-wide">
                Localhost host
                <input className="input mt-1 w-full" value={previewHostState} onChange={e => { setPreviewHostState(e.target.value); }} placeholder="localhost" />
                <div className="text-xs text-[color:var(--fg-muted)] mt-1">Hostname for the preview server (usually localhost).</div>
            </label>
            <label className="block text-xs uppercase tracking-wide">
                Port
                <input type="number" className="input mt-1 w-full" value={previewPortState || ''} onChange={e => { const v = Number((e.target as HTMLInputElement).value); setPreviewPortState(Number.isFinite(v) ? v : 0); }} placeholder="3000" />
                <div className="text-xs text-[color:var(--fg-muted)] mt-1">Port to run the local preview server on. Leave blank or 0 to auto-select.</div>
            </label>
            <label className="flex items-center space-x-2">
                <input type="checkbox" checked={previewOpenOnStartState} onChange={() => setPreviewOpenOnStartState(prev => !prev)} />
                <span className="text-[color:var(--fg-muted)]">Open browser when preview starts</span>
            </label>
            <div className="flex items-center gap-2">
                {/* Save button removed — preview settings are saved via main Save action. Reset moved to header as an icon. */}
            </div>
        </div>
    );

    const renderCloudBody = () => {
        if (isCreateMode) {
            if (!user) {
                return (
                    <p className="text-sm text-[color:var(--fg-muted)]">Sign in to create cloud portfolios. We will save this one as a local file for now.</p>
                );
            }
            return (
                <div className="space-y-3">
                    <div className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface)]/60 p-3 flex items-start justify-between gap-3">
                        <div>
                            <p className="font-semibold text-sm">Create as cloud portfolio</p>
                            <p className="text-xs text-[color:var(--fg-muted)]">Cloud portfolios sync to your account. Turn this off to download a .portfoliyou file instead.</p>
                        </div>
                        <button
                            type="button"
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${createCloudEnabled ? 'bg-[color:var(--accent)]' : 'bg-[color:var(--border)]/80'}`}
                            onClick={() => handleCreateCloudToggle(!createCloudEnabled)}
                            aria-pressed={createCloudEnabled}
                            aria-label="Toggle cloud creation"
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${createCloudEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
                        </button>
                    </div>
                    <p className="text-[11px] text-[color:var(--fg-muted)]">Cloud creation uses your team quota and requires an internet connection.</p>
                </div>
            );
        }
        if (!user) {
            return <p className="text-sm text-[color:var(--fg-muted)]">Sign in to manage cloud settings.</p>;
        }
        if (!project && targetCloudId) {
            return (
                <div className="space-y-3">
                    <p className="text-sm text-[color:var(--fg-muted)]">This cloud portfolio isn't open locally, but you can still rename or delete it.</p>
                    <div className="flex gap-2">
                        <button className="btn btn-ghost btn-sm" disabled={cloudBusy} onClick={async () => {
                            const next = prompt("Rename cloud portfolio", "New cloud name");
                            if (!next?.trim()) return;
                            await handleCloudAction(async () => { await renameCloudProject(targetCloudId, next.trim()); });
                        }}><SlidersHorizontal size={14} className="mr-1" /> Rename cloud</button>
                        <button className="btn btn-ghost btn-sm text-red-500 border border-red-500/40" disabled={cloudBusy} onClick={async () => {
                            if (!confirm("Delete this cloud portfolio? This cannot be undone.")) return;
                            await handleCloudAction(async () => { await deleteCloudProjectByCloudId(targetCloudId); });
                        }}><Trash2 size={14} className="mr-1" /> Delete cloud</button>
                    </div>
                    <CloudDetails info={cloudInfo} loading={cloudLoading} onRefresh={loadCloudInfo} />
                </div>
            );
        }
        if (!project) {
            return <p className="text-sm text-[color:var(--fg-muted)]">Select a portfolio to manage its cloud settings.</p>;
        }
        const isCloudProject = (project.storage ?? 'local') === 'cloud';
        if (!isCloudProject) {
            return (
                <div className="space-y-3">
                    <p className="text-sm text-[color:var(--fg-muted)]">This portfolio currently lives on your device.</p>
                    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/60 p-4 space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <p className="text-sm font-semibold">Sync to cloud</p>
                                <p className="text-xs text-[color:var(--fg-muted)]">Upload this local copy to your Projects workspace so you can deploy and edit from other devices.</p>
                            </div>
                            <button
                                className="btn btn-accent btn-sm flex items-center gap-2"
                                disabled={cloudSyncing}
                                onClick={handleCloudSync}
                            >
                                {cloudSyncing ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                                <span>{cloudSyncing ? "Syncing…" : "Sync to cloud"}</span>
                            </button>
                        </div>
                        <p className="text-xs text-[color:var(--fg-muted)]">After syncing, you can optionally delete the original local file. Keeping it will leave both the new cloud copy and this local project in your list.</p>
                    </div>
                    <p className="text-xs text-[color:var(--fg-muted)]">Need to copy assets or rename before syncing? Save changes, then run the sync again.</p>
                </div>
            );
        }
        const cloudId = project._cloudId || project.id;
        return (
            <div className="space-y-3">
                <p className="text-sm text-[color:var(--fg-muted)]">Cloud portfolios save automatically. Export a .portfoliyou file if you need an offline backup.</p>
                <div className="flex flex-wrap gap-2">
                    <button className="btn btn-primary btn-sm" disabled={cloudBusy} onClick={() => handleCloudAction(async () => { await exportProject(project.id); })}><Download size={14} className="mr-1" /> Save as local file</button>
                    <button className="btn btn-ghost btn-sm" disabled={cloudBusy} onClick={async () => {
                        const next = prompt("Rename cloud portfolio", project.name);
                        if (!next?.trim() || !cloudId) return;
                        await handleCloudAction(async () => { await renameCloudProject(cloudId, next.trim()); });
                    }}><SlidersHorizontal size={14} className="mr-1" /> Rename cloud</button>
                    <button className="btn btn-ghost btn-sm text-red-500 border border-red-500/40" disabled={cloudBusy} onClick={async () => {
                        if (!cloudId) return;
                        if (!confirm("Delete this cloud portfolio? This cannot be undone.")) return;
                        await handleCloudAction(async () => { await deleteCloudProjectByCloudId(cloudId); });
                    }}><Trash2 size={14} className="mr-1" /> Delete cloud</button>
                </div>
                <p className="text-xs text-[color:var(--fg-muted)]">Exports include all pages, widgets, and uploaded assets for safekeeping.</p>
                <CloudDetails info={cloudInfo} loading={cloudLoading} onRefresh={loadCloudInfo} />
            </div>
        );
    };

    const renderThemeBody = () => {
        if (!project || !activeTheme) {
            return (
                <p className="text-sm text-[color:var(--fg-muted)]">
                    {mode === "create"
                        ? "Create a portfolio first to customize its theme."
                        : "Select a portfolio to adjust its theme."}
                </p>
            );
        }

        return (
            <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <label className="flex-1 text-xs uppercase tracking-wide">
                        Theme name
                        <input
                            className="input mt-1"
                            value={themeNameDraft}
                            onChange={e => setThemeNameDraft(e.target.value)}
                            onBlur={commitThemeName}
                            onKeyDown={e => {
                                if (e.key === "Enter") { e.preventDefault(); commitThemeName(); }
                                if (e.key === "Escape") { e.preventDefault(); setThemeNameDraft(activeTheme.name); }
                            }}
                        />
                        <span className="text-[10px] text-[color:var(--fg-muted)]">Press Enter to save.</span>
                    </label>
                    <div className="flex items-center gap-2">
                        <button className="btn btn-outline btn-xs" onClick={handleDuplicateTheme}>
                            <Copy size={12} className="mr-1" /> Duplicate
                        </button>
                        <button className="btn btn-outline btn-xs" disabled={!canDeleteTheme} onClick={handleDeleteTheme}>
                            <Trash2 size={12} className="mr-1" /> Delete
                        </button>
                    </div>
                </div>

                <div className="space-y-2">
                    <p className="text-[11px] uppercase tracking-wide text-[color:var(--fg-muted)]">Saved themes</p>
                    <div className="flex flex-wrap gap-2">
                        {themeEntries.map(theme => (
                            <button
                                key={theme.themeId}
                                className={`px-3 py-2 rounded-md border text-sm flex items-center gap-2 ${theme.themeId === activeTheme.themeId ? 'border-[color:var(--accent)] bg-[color:var(--muted)]/40' : 'border-[color:var(--border)] bg-[color:var(--surface)]'}`}
                                onClick={() => setActiveTheme(project.id, theme.themeId)}
                            >
                                <span className="inline-flex h-3 w-3 rounded-full" style={{ background: theme.colors.primary }} />
                                {theme.name}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <ColorField label="Background" value={activeTheme.colors.background} onChange={(v: string) => handleThemeColorChange('background', v)} />
                                <ColorField label="Surface" value={activeTheme.colors.surface} onChange={(v: string) => handleThemeColorChange('surface', v)} />
                                <ColorField label="Primary" value={activeTheme.colors.primary} onChange={(v: string) => handleThemeColorChange('primary', v)} />
                                <ColorField label="Secondary" value={activeTheme.colors.secondary} onChange={(v: string) => handleThemeColorChange('secondary', v)} />
                                <ColorField label="Accent" value={activeTheme.colors.accent} onChange={(v: string) => handleThemeColorChange('accent', v)} />
                                <ColorField label="Text" value={activeTheme.colors.text} onChange={(v: string) => handleThemeColorChange('text', v)} />
                                <ColorField label="Muted" value={activeTheme.colors.muted} onChange={(v: string) => handleThemeColorChange('muted', v)} />
                                <ColorField label="Widget bg" value={activeTheme.colors.widgetBackground} onChange={(v: string) => handleThemeColorChange('widgetBackground', v)} />
                                <ColorField label="Widget text" value={activeTheme.colors.widgetText} onChange={(v: string) => handleThemeColorChange('widgetText', v)} />
                                <ColorField label="Border" value={activeTheme.colors.border} onChange={(v: string) => handleThemeColorChange('border', v)} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <label className="flex flex-col gap-1 text-xs uppercase tracking-wide">
                                    Heading font
                                    <input className="input" value={activeTheme.typography.heading} onChange={e => handleFontChange('heading', e.target.value)} />
                                </label>
                                <label className="flex flex-col gap-1 text-xs uppercase tracking-wide">
                                    Body font
                                    <input className="input" value={activeTheme.typography.body} onChange={e => handleFontChange('body', e.target.value)} />
                                </label>
                                <label className="flex flex-col gap-1 text-xs uppercase tracking-wide">
                                    Scale
                                    <input type="range" min={0.8} max={1.4} step={0.02} value={activeTheme.typography.scale} onChange={e => handleScaleChange(Number(e.target.value))} />
                                    <span className="text-[10px] text-[color:var(--fg-muted)]">{activeTheme.typography.scale.toFixed(2)}×</span>
                                </label>
                            </div>
                        </div>
                        <div className="border border-[color:var(--border)] rounded-lg p-4 bg-[color:var(--surface)]">
                            <p className="text-xs uppercase tracking-wide text-[color:var(--fg-muted)] mb-2">Preview</p>
                            <div
                                className="rounded-xl p-4 space-y-3 shadow-inner"
                                style={{
                                    background: activeTheme.colors.background,
                                    color: activeTheme.colors.text,
                                    fontFamily: activeTheme.typography.body,
                                }}
                            >
                                <div>
                                    <p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: activeTheme.colors.muted }}>Portfolio</p>
                                    <h4 className="text-xl font-semibold" style={{ fontFamily: activeTheme.typography.heading }}>
                                        {activeTheme.name}
                                    </h4>
                                </div>
                                <p style={{ color: activeTheme.colors.widgetText }}>
                                    Widgets inherit these colors automatically. Adjust the palette to instantly restyle your canvas.
                                </p>
                                <div className="flex gap-2">
                                    <button className="flex-1 py-2 rounded-md text-sm font-semibold" style={{ background: activeTheme.colors.primary, color: '#020617' }}>
                                        Primary CTA
                                    </button>
                                    <button
                                        className="flex-1 py-2 rounded-md text-sm font-semibold border"
                                        style={{
                                            background: 'transparent',
                                            color: activeTheme.colors.accent,
                                            borderColor: activeTheme.colors.accent,
                                        }}
                                    >
                                        Accent
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Palette size={16} />
                        <p className="font-semibold tracking-wide text-sm">Preset themes</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {THEME_PRESETS.map(preset => (
                            <button
                                key={preset.id}
                                className="border border-[color:var(--border)] rounded-lg p-3 text-left hover:border-[color:var(--accent)] transition-colors"
                                onClick={() => handleCreateThemeFromPreset(preset.id)}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="inline-flex h-3 w-3 rounded-full" style={{ background: preset.colors.primary }} />
                                    <span className="font-semibold text-sm">{preset.name}</span>
                                </div>
                                <p className="text-[11px] text-[color:var(--fg-muted)]">{preset.description}</p>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/60 backdrop-blur" onClick={onClose}>
            <div className="surface w-full max-w-2xl border border-[color:var(--border)] rounded-md shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--border)]">
                    <div>
                        <h2 className="text-lg font-semibold">Portfolio settings</h2>
                        <p className="text-xs text-[color:var(--fg-muted)]">Configure site metadata{showCloudSection ? ' and cloud sync' : ''}.</p>
                    </div>
                    <button className="btn btn-ghost btn-xs" onClick={onClose} aria-label="Close"><X size={14} /></button>
                </div>
                <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                    {renderSection("portfolio", "Portfolio", mode === "create" ? "Draft" : "Details", renderPortfolioFields())}
                    {showCloudSection && renderSection("cloud", "Cloud", cloudStatus, renderCloudBody())}
                    {!isCreateMode && renderSection("theme", "Theme", activeTheme ? activeTheme.name : "Unavailable", renderThemeBody())}
                    {!isCreateMode && renderSection("preview", "Preview", undefined, renderPreviewBody())}
                    {renderSection("build", "Build", undefined, renderBuildBody())}
                    {!isCreateMode && renderSection("saving", "Saving", undefined, renderSavingBody())}
                    {formError && <div className="text-sm text-red-500">{formError}</div>}
                </div>
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-[color:var(--border)]">
                    <div>
                        {!isCreateMode && project ? (
                            <button
                                className="btn btn-ghost btn-xxs text-red-400 border border-red-500/40 hover:bg-red-500/10"
                                onClick={handleDeletePortfolio}
                                disabled={deletingProject}
                            >
                                {deletingProject ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                <span>{deletingProject ? 'Deleting…' : 'Delete portfolio'}</span>
                            </button>
                        ) : (
                            <div aria-hidden="true"></div>
                        )}
                    </div>
                    <button
                        className="btn btn-outline btn-xs"
                        onClick={handleSave}
                        disabled={savingDraft}
                        data-testid={mode === "create" ? 'confirm-create-btn' : undefined}
                    >
                        {savingDraft ? 'Saving…' : submitLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

type CloudDetailsProps = {
    info: { storagePath: string; sizeBytes: number; updatedAt: string } | null;
    loading: boolean;
    onRefresh: () => void;
};

function ColorField({ label, value, onChange }: ColorFieldProps) {
    return (
        <label className="flex flex-col gap-1 text-xs tracking-wide uppercase">
            <span>{label}</span>
            <div className="flex items-center gap-2">
                <input
                    type="color"
                    className="w-10 h-10 rounded border border-[color:var(--border)] bg-[color:var(--surface)]"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    aria-label={`${label} color`}
                />
                <input
                    className="input flex-1"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    spellCheck={false}
                />
            </div>
        </label>
    );
}

function CloudDetails({ info, loading, onRefresh }: CloudDetailsProps) {
    return (
        <div className="border border-dashed border-[color:var(--border)] rounded-md p-3 text-xs">
            <div className="flex items-center justify-between mb-2">
                <span className="font-semibold uppercase tracking-wide">Cloud details</span>
                <button className="btn btn-ghost btn-xs" onClick={onRefresh} disabled={loading}><RefreshCcw size={12} /></button>
            </div>
            {loading ? (
                <p className="text-[color:var(--fg-muted)]">Loading…</p>
            ) : info ? (
                <ul className="space-y-1">
                    <li><strong>Path:</strong> <span className="font-mono break-all">{info.storagePath}</span></li>
                    <li><strong>Size:</strong> {(info.sizeBytes / (1024 * 1024)).toFixed(2)} MB</li>
                    <li><strong>Updated:</strong> {new Date(info.updatedAt).toLocaleString()}</li>
                </ul>
            ) : (
                <p className="text-[color:var(--fg-muted)]">No cloud data yet.</p>
            )}
        </div>
    );
}
