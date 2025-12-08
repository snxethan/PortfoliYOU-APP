import React, { useEffect, useMemo, useState } from "react";
import { Pin, PinOff, Lock, Unlock, ChevronsUp, ChevronsDown, ChevronUp, ChevronDown, ChevronRight, X, Trash2 } from "lucide-react";
import { z } from "zod";

import { useAssets } from "../../../providers/AssetsProvider";
import { useNotifications } from "../../../providers/NotificationsProvider";
import { useProjects } from "../../../providers/ProjectsProvider";
import { WidgetsRegistry } from "../../../widgets/registry";
import type { CarouselItem } from "../../../widgets/defs/Carousel";
import { ALLOWED_HTTP_SCHEME_LABEL } from "../../../../../shared/widgets/linkUrl";
import type { GridItem } from "../canvas/DraggableItem";
import { useScrollLock } from "../../../hooks/useScrollLock";
import { SchemaAssetField, SchemaNumberField, SchemaUrlField, type AssetKind } from "../../../widgets/settings/SchemaFields";
import { ContactWidgetSettings } from "../../../widgets/settings/ContactWidgetSettings";
import { ImageWidgetSettings } from "../../../widgets/settings/ImageWidgetSettings";
import { TextWidgetSettings } from "../../../widgets/settings/TextWidgetSettings";
import { LinkWidgetSettings } from "../../../widgets/settings/LinkWidgetSettings";
import { NavLinkWidgetSettings } from "../../../widgets/settings/NavLinkWidgetSettings";
import { VideoWidgetSettings } from "../../../widgets/settings/VideoWidgetSettings";
import { CarouselWidgetSettings, type CarouselEditorItem } from "../../../widgets/settings/CarouselWidgetSettings";
import { ProjectWidgetSettings } from "../../../widgets/settings/ProjectWidgetSettings";
import { GitHubReposWidgetSettings } from "../../../widgets/settings/GitHubReposWidgetSettings";
import {
    CAROUSEL_WIDGET_FIELD_KEYS,
    IMAGE_WIDGET_FIELD_KEYS,
    LINK_WIDGET_FIELD_KEYS,
    NAV_LINK_WIDGET_FIELD_KEYS,
    PROJECT_WIDGET_FIELD_KEYS,
    CONTACT_WIDGET_FIELD_KEYS,
    GITHUB_WIDGET_FIELD_KEYS,
    TEXT_WIDGET_FIELD_KEYS,
    VIDEO_WIDGET_FIELD_KEYS,
    deriveNumberBounds,
} from "../../../widgets/settings/shared";

const ENTER_SUBMIT_BLOCKED_TYPES = new Set(['checkbox', 'radio', 'range', 'color', 'date', 'datetime-local', 'month', 'week', 'time', 'file']);

const APPEARANCE_FIELDS_BY_WIDGET: Record<string, ReadonlySet<string>> = {
    image: new Set(['fit', 'radius', 'scale', 'shape', 'borderWidth', 'borderColor', 'borderStyle']),
    text: new Set(['variant', 'align', 'font', 'color', 'fontSize', 'weight', 'italic']),
    link: new Set(['variant', 'font', 'fontSize', 'weight', 'italic']),
    'nav-link': new Set(['style', 'align', 'color', 'textColor', 'underline', 'font', 'fontSize']),
    project: new Set(['headingLevel', 'font', 'fontSize']),
    contact: new Set(['font', 'fontSize']),
    carousel: new Set(['backgroundColor', 'shape', 'radius', 'borderWidth', 'borderColor', 'borderStyle']),
    'github-repos': new Set(['layout', 'containerBackgroundColor', 'cardBackgroundColor', 'cardBorderColor', 'cardTextColor', 'cardMutedColor']),
};

const URL_FIELD_HINTS = ['url', 'link', 'href', 'website'];
const TEXTAREA_FIELD_HINTS = ['description', 'content', 'body', 'text', 'bio', 'summary'];
const IMAGE_FIELD_HINTS = ['image', 'img', 'photo', 'poster', 'thumb', 'thumbnail', 'cover', 'logo', 'avatar'];
const VIDEO_FIELD_HINTS = ['video', 'clip', 'movie', 'reel', 'media'];
const GENERIC_ASSET_HINTS = ['asset', 'src', 'source', 'file'];

function hasAppearanceKeyword(key: string) {
    const normalized = key.toLowerCase();
    if (normalized.includes('color') || normalized.includes('background')) return true;
    if (normalized.includes('border') || normalized.includes('radius')) return true;
    if (normalized.includes('shape')) return true;
    if (normalized.includes('font')) return true;
    if (normalized === 'align' || normalized === 'layout' || normalized === 'weight' || normalized === 'italic') return true;
    if (normalized === 'style' || normalized === 'variant' || normalized === 'underline') return true;
    if (normalized === 'headinglevel' || normalized === 'fit') return true;
    return false;
}

function isAppearanceField(defType: string | null, key: string) {
    if (!key) return false;
    const overrides = defType ? APPEARANCE_FIELDS_BY_WIDGET[defType] : undefined;
    if (overrides?.has(key)) return true;
    return hasAppearanceKeyword(key);
}

function hasUrlValidation(field: z.ZodTypeAny) {
    const def: any = (field as unknown as { _def?: unknown })._def;
    const checks: Array<{ kind?: string }> = def?.checks ?? [];
    return checks.some(check => check.kind === 'url');
}

function isLikelyUrlField(key: string, field: z.ZodTypeAny) {
    const lower = key.toLowerCase();
    if (!(field instanceof z.ZodString)) return false;
    if (hasUrlValidation(field)) return true;
    return URL_FIELD_HINTS.some(hint => lower.includes(hint));
}

function inferAssetKind(defType: string | null, key: string): AssetKind | null {
    const lower = key.toLowerCase();
    const matches = (hint: string) => lower === hint || lower.endsWith(hint) || lower.includes(`${hint}url`) || lower.includes(`${hint}src`);
    if (IMAGE_FIELD_HINTS.some(matches)) return 'image';
    if (VIDEO_FIELD_HINTS.some(matches)) return 'video';
    if (GENERIC_ASSET_HINTS.some(matches)) return 'media';
    if (lower === 'poster' || lower.endsWith('poster')) return 'image';
    if (lower === 'thumbnail' || lower.endsWith('thumbnail')) return 'image';
    if (lower === 'src') {
        if (defType === 'image' || defType === 'project' || defType === 'carousel') return 'image';
        if (defType === 'video') return 'video';
    }
    return null;
}

function makeCarouselId(seed?: number) {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    const base = Math.random().toString(36).slice(2, 9);
    return seed !== undefined ? `slide-${seed}-${base}` : base;
}

function normalizeCarouselEditorItems(raw: unknown): CarouselEditorItem[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((entry, idx) => {
        const data = (entry || {}) as CarouselItem;
        const mediaType: 'image' | 'video' = data.mediaType === 'video' ? 'video' : 'image';
        const source = typeof data.src === 'string' && data.src
            ? data.src
            : (typeof data.assetId === 'string' ? data.assetId : '');
        return {
            id: data.id || makeCarouselId(idx),
            mediaType,
            source: source || '',
            alt: typeof data.alt === 'string' ? data.alt : '',
            caption: typeof data.caption === 'string' ? data.caption : '',
            poster: typeof data.poster === 'string' ? data.poster : '',
        } satisfies CarouselEditorItem;
    });
}

function createBlankCarouselItem(): CarouselEditorItem {
    return {
        id: makeCarouselId(),
        mediaType: 'image',
        source: '',
        alt: '',
        caption: '',
        poster: '',
    };
}

function serializeCarouselEditorItems(items: CarouselEditorItem[]): CarouselItem[] {
    return items
        .map((item) => ({
            id: item.id,
            mediaType: item.mediaType,
            src: item.source.trim(),
            alt: item.alt.trim() || undefined,
            caption: item.caption.trim() || undefined,
            poster: item.poster?.trim() || undefined,
        }))
        .filter((item) => !!item.src);
}

function shouldUseTextareaField(defType: string | null, key: string) {
    const lower = key.toLowerCase();
    if (lower.includes('color')) return false;
    for (const hint of TEXTAREA_FIELD_HINTS) {
        const re = new RegExp(`(^|[^a-z0-9])${hint}($|[^a-z0-9])`);
        if (re.test(lower)) return true;
    }
    if (defType === 'text' && lower === 'text') return true;
    return false;
}

function inferStringInputType(field: z.ZodTypeAny): 'text' | 'email' | 'url' {
    if (!(field instanceof z.ZodString)) return 'text';
    const def: any = (field as unknown as { _def?: unknown })._def;
    const checks: Array<{ kind?: string }> = def?.checks ?? [];
    if (checks.some(check => check.kind === 'email')) return 'email';
    if (checks.some(check => check.kind === 'url')) return 'url';
    return 'text';
}

type ModifyWidgetModalProps = {
    item: GridItem;
    onClose: () => void;
    onDelete?: () => void;
    onRename: (title: string) => void;
    onBringToFront: () => void;
    onSendToBack: () => void;
    onBringForward: () => void;
    onSendBackward: () => void;
    onTogglePin: () => void;
    onToggleLock: () => void;
    onApplyProps: (props: Record<string, unknown>) => void;
};

export default function ModifyWidgetModal({
    item,
    onClose,
    onDelete,
    onRename,
    onBringToFront,
    onSendToBack,
    onBringForward,
    onSendBackward,
    onTogglePin,
    onToggleLock,
    onApplyProps,
}: ModifyWidgetModalProps) {
    useScrollLock(true);
    const { selectedProject } = useProjects();
    const { add: notify } = useNotifications();
    const widgetName = item.title || item.type || 'Widget';
    const [title, setTitle] = useState(item.title);
    const [propsText, setPropsText] = useState<string>(() => {
        try { return JSON.stringify(item.props ?? {}, null, 2); } catch { return "{}"; }
    });
    const [propsError, setPropsError] = useState<string | null>(null);
    const [zodSchema, setZodSchema] = useState<z.ZodObject<z.ZodRawShape> | null>(null);
    const [formValues, setFormValues] = useState<Record<string, unknown>>({});
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [widgetDefaults, setWidgetDefaults] = useState<Record<string, unknown> | null>(null);
    const [defType, setDefType] = useState<string | null>(null);
    const [carouselItems, setCarouselItems] = useState<CarouselEditorItem[]>([]);
    const [carouselError, setCarouselError] = useState<string | null>(null);
    const assets = useAssets();
    const imageAssetOptions = useMemo(() => assets.list.filter(asset => {
        if (asset.type?.startsWith('image/')) return true;
        const hasDimensions = typeof asset.width === 'number' && asset.width > 0 && typeof asset.height === 'number' && asset.height > 0;
        return hasDimensions;
    }), [assets.list]);
    const videoAssetOptions = useMemo(() => assets.list.filter(asset => asset.type?.startsWith('video/')), [assets.list]);
    const resolvedDefType = defType || item.type || null;
    const isCarousel = resolvedDefType === 'carousel';
    const isVideo = resolvedDefType === 'video';
    const navStyle = (defType === 'nav-link')
        ? String((formValues['style'] as string) ?? ((item.props as unknown as Record<string, unknown>)?.style as string) ?? 'link')
        : undefined;
    const [compOpen, setCompOpen] = useState<boolean>(() => {
        try { return localStorage.getItem('py_comp_props_open') === '1'; } catch { return false; }
    });
    const [widgetOpen, setWidgetOpen] = useState<boolean>(() => {
        try { return localStorage.getItem('py_widget_props_open') === '1'; } catch { return false; }
    });
    function toggleCompOpen() {
        setCompOpen(prev => { const n = !prev; try { localStorage.setItem('py_comp_props_open', n ? '1' : '0'); } catch { /* noop */ } return n; });
    }
    function toggleWidgetOpen() {
        setWidgetOpen(prev => { const n = !prev; try { localStorage.setItem('py_widget_props_open', n ? '1' : '0'); } catch { /* noop */ } return n; });
    }
    function persistedToggle(key: string, setter: React.Dispatch<React.SetStateAction<boolean>>) {
        setter(prev => {
            const next = !prev;
            try { localStorage.setItem(key, next ? '1' : '0'); } catch { /* noop */ }
            return next;
        });
    }
    const [protectionOpen, setProtectionOpen] = useState<boolean>(() => {
        try { return localStorage.getItem('py_widget_protection_open') !== '0'; } catch { return true; }
    });
    const [layerOpen, setLayerOpen] = useState<boolean>(() => {
        try { return localStorage.getItem('py_widget_layers_open') !== '0'; } catch { return true; }
    });

    // Keyboard helpers
    function handleEnterSubmitComp(e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !locked) {
            e.preventDefault();
            applyForm();
        }
    }

    function handleEnterSubmitAnywhere(e: React.KeyboardEvent<HTMLElement>) {
        if (locked || e.defaultPrevented) return;
        if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey) return;
        const target = e.target as HTMLElement | null;
        if (!target) return;
        if (target instanceof HTMLTextAreaElement) return;
        if (target instanceof HTMLInputElement) {
            const type = target.type?.toLowerCase();
            if (type && ENTER_SUBMIT_BLOCKED_TYPES.has(type)) return;
        }
        e.preventDefault();
        applyForm();
    }

    function handleCtrlEnterApplyJson(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !locked) {
            e.preventDefault();
            applyProps();
        }
    }

    function updateCarouselItem(id: string, patch: Partial<CarouselEditorItem>) {
        setCarouselError(null);
        setCarouselItems(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item));
    }

    function moveCarouselItem(id: string, direction: -1 | 1) {
        setCarouselError(null);
        setCarouselItems(prev => {
            const idx = prev.findIndex(item => item.id === id);
            if (idx === -1) return prev;
            const target = idx + direction;
            if (target < 0 || target >= prev.length) return prev;
            const next = [...prev];
            const [entry] = next.splice(idx, 1);
            next.splice(target, 0, entry);
            return next;
        });
    }

    function removeCarouselItem(id: string) {
        setCarouselError(null);
        setCarouselItems(prev => {
            if (prev.length <= 1) {
                return prev.map((item, idx) => idx === 0 ? { ...item, source: '', alt: '', caption: '', poster: '' } : item);
            }
            return prev.filter(item => item.id !== id);
        });
    }

    function addCarouselItem() {
        setCarouselError(null);
        setCarouselItems(prev => [...prev, createBlankCarouselItem()]);
    }

    useEffect(() => {
        setTitle(item.title);
        try { setPropsText(JSON.stringify(item.props ?? {}, null, 2)); } catch { setPropsText("{}"); }
        setPropsError(null);
        if (item.type === 'carousel') {
            const rawItems = (item.props as { items?: CarouselItem[] })?.items;
            const normalized = normalizeCarouselEditorItems(rawItems);
            setCarouselItems(normalized.length > 0 ? normalized : [createBlankCarouselItem()]);
            setCarouselError(null);
        } else {
            setCarouselItems([]);
            setCarouselError(null);
        }
        // Load widget definition to check for zod schema
        let mounted = true;
        if (!item.type) { setZodSchema(null); return () => { }; }
        WidgetsRegistry.ensure(item.type as string)
            .then((def) => {
                if (!mounted) return;
                try { setDefType((def as unknown as { type?: string }).type || item.type || null); } catch { setDefType(item.type || null); }
                const defaults = (def as unknown as { defaultProps?: Record<string, unknown> }).defaultProps;
                setWidgetDefaults(defaults ? { ...defaults } : null);
                const schema = (def as unknown as { zodSchema?: z.ZodObject<z.ZodRawShape> }).zodSchema;
                setZodSchema(schema ?? null);
                const currentProps = (item.props as Record<string, unknown>) ?? {};
                if (schema) {
                    // Initialize form values from current props with defaults for missing keys
                    const shape = schema.shape;
                    const defaultsObj = (defaults && typeof defaults === 'object') ? defaults : undefined;
                    const initial: Record<string, unknown> = {};
                    for (const key of Object.keys(shape)) {
                        if (currentProps[key] !== undefined) {
                            initial[key] = currentProps[key];
                        } else if (defaultsObj && defaultsObj[key] !== undefined) {
                            initial[key] = defaultsObj[key];
                        } else {
                            initial[key] = undefined;
                        }
                    }
                    const merged = {
                        ...(defaultsObj ?? {}),
                        ...initial,
                        ...currentProps,
                    };
                    setFormValues(merged);
                    // Validate once to populate errors
                    const res = schema.safeParse(merged);
                    if (!res.success) {
                        const errs: Record<string, string> = {};
                        for (const issue of res.error.issues) {
                            if (issue.path && issue.path.length > 0) {
                                errs[String(issue.path[0])] = issue.message;
                            }
                        }
                        setFormErrors(errs);
                    } else {
                        setFormErrors({});
                    }
                } else {
                    const withDefaults = defaults && typeof defaults === 'object'
                        ? { ...defaults, ...currentProps }
                        : currentProps;
                    setFormValues(withDefaults);
                    setFormErrors({});
                }
            })
            .finally(() => { });
        return () => { mounted = false; };
    }, [item]);

    const locked = !!item.locked;
    const pinned = !!item.pinned;
    const linkRawUrl = defType === 'link' ? (typeof formValues.url === 'string' ? formValues.url : '') : '';
    const linkFieldError = defType === 'link' ? (formErrors.url || null) : null;

    function validateField(key: string, value: unknown) {
        if (!zodSchema) {
            setFormErrors(prev => ({ ...prev, [key]: '' }));
            return;
        }
        const shape = zodSchema.shape as Record<string, z.ZodTypeAny>;
        const field = shape?.[key];
        if (!field) {
            setFormErrors(prev => ({ ...prev, [key]: '' }));
            return;
        }
        const single = z.object({ [key]: field });
        const res = single.safeParse({ [key]: value });
        setFormErrors(prev => ({ ...prev, [key]: res.success ? '' : (res.error.issues[0]?.message || 'Invalid value') }));
    }

    function setFieldValue(key: string, value: unknown) {
        const next = { ...formValues, [key]: value };
        setFormValues(next);
        validateField(key, value);
    }

    const isTextWidget = resolvedDefType === 'text';
    const isLinkWidget = resolvedDefType === 'link';
    const isImageWidget = resolvedDefType === 'image';
    const isNavLinkWidget = resolvedDefType === 'nav-link';
    const isProjectWidget = resolvedDefType === 'project';
    const isContactWidget = resolvedDefType === 'contact';
    const isGitHubWidget = resolvedDefType === 'github-repos';
    const videoSchemaFields = new Map<string, z.ZodTypeAny>();
    const carouselSchemaFields = new Map<string, z.ZodTypeAny>();
    const imageSchemaFields = new Map<string, z.ZodTypeAny>();
    const textSchemaFields = new Map<string, z.ZodTypeAny>();
    const linkSchemaFields = new Map<string, z.ZodTypeAny>();
    const navLinkSchemaFields = new Map<string, z.ZodTypeAny>();
    const projectSchemaFields = new Map<string, z.ZodTypeAny>();
    const contactSchemaFields = new Map<string, z.ZodTypeAny>();
    const githubSchemaFields = new Map<string, z.ZodTypeAny>();
    const schemaFieldBuckets = {
        default: [] as Array<[string, z.ZodTypeAny]>,
        appearance: [] as Array<[string, z.ZodTypeAny]>,
    };
    if (zodSchema) {
        for (const [key, schema] of Object.entries(zodSchema.shape)) {
            if (isImageWidget && IMAGE_WIDGET_FIELD_KEYS.has(key)) {
                imageSchemaFields.set(key, schema as z.ZodTypeAny);
                continue;
            }
            if (isTextWidget && TEXT_WIDGET_FIELD_KEYS.has(key)) {
                textSchemaFields.set(key, schema as z.ZodTypeAny);
                continue;
            }
            if (isLinkWidget && LINK_WIDGET_FIELD_KEYS.has(key)) {
                linkSchemaFields.set(key, schema as z.ZodTypeAny);
                continue;
            }
            if (isNavLinkWidget && NAV_LINK_WIDGET_FIELD_KEYS.has(key)) {
                navLinkSchemaFields.set(key, schema as z.ZodTypeAny);
                continue;
            }
            if (isVideo && VIDEO_WIDGET_FIELD_KEYS.has(key)) {
                videoSchemaFields.set(key, schema as z.ZodTypeAny);
                continue;
            }
            if (isCarousel && CAROUSEL_WIDGET_FIELD_KEYS.has(key)) {
                carouselSchemaFields.set(key, schema as z.ZodTypeAny);
                continue;
            }
            if (isProjectWidget && PROJECT_WIDGET_FIELD_KEYS.has(key)) {
                projectSchemaFields.set(key, schema as z.ZodTypeAny);
                continue;
            }
            if (isContactWidget && CONTACT_WIDGET_FIELD_KEYS.has(key)) {
                contactSchemaFields.set(key, schema as z.ZodTypeAny);
                continue;
            }
            if (isGitHubWidget && GITHUB_WIDGET_FIELD_KEYS.has(key)) {
                githubSchemaFields.set(key, schema as z.ZodTypeAny);
                continue;
            }
            const bucket = isAppearanceField(defType, key) ? schemaFieldBuckets.appearance : schemaFieldBuckets.default;
            bucket.push([key, schema as z.ZodTypeAny]);
        }
    }

    const navPages = useMemo(() => {
        const project = selectedProject;
        if (!project) return [] as Array<{ id: string; title: string }>;
        const order = project.pageOrder || [];
        return order.map((id) => ({ id, title: project.pages?.[id]?.title || id }));
    }, [selectedProject]);

    const renderSchemaField = (key: string, schema: z.ZodTypeAny): React.ReactElement | null => {
        if (!zodSchema) return null;
        const field = schema as z.ZodTypeAny;
        const isOptional = field instanceof z.ZodOptional;
        let baseField: z.ZodTypeAny = isOptional ? (field._def as any).innerType as z.ZodTypeAny : field;
        if (baseField instanceof z.ZodDefault) {
            baseField = (baseField._def as any).innerType as z.ZodTypeAny;
        }
        if (baseField instanceof z.ZodNullable) {
            baseField = (baseField._def as any).innerType as z.ZodTypeAny;
        }
        const rawValue = formValues[key];
        const stringValue = typeof rawValue === 'string' ? rawValue : '';
        const error = formErrors[key];
        const hideForNavLink = (
            (defType === 'nav-link' && key === 'textColor' && navStyle === 'link') ||
            (defType === 'nav-link' && key === 'underline' && navStyle === 'button')
        );
        if (hideForNavLink) return null;
        let label = key.charAt(0).toUpperCase() + key.slice(1);
        let helperText: string | null = null;
        if (defType === 'nav-link') {
            if (key === 'color') label = navStyle === 'button' ? 'Background color' : 'Text color';
            if (key === 'textColor') label = 'Text color';
        }
        if (defType === 'link') {
            if (key === 'url') {
                helperText = `Supports ${ALLOWED_HTTP_SCHEME_LABEL} links. Missing protocol defaults to https://.`;
            } else if (key === 'iconLeft') {
                label = 'Prefix icon/text';
                helperText = 'Optional emoji or short text shown before the link label.';
            } else if (key === 'iconRight') {
                label = 'Suffix icon/text';
                helperText = 'Optional emoji or short text shown after the link label.';
            }
        } else if (defType === 'project') {
            if (key === 'link') {
                label = 'Project link';
                helperText = 'Optional external URL opened when the card is clicked.';
            } else if (key === 'image') {
                label = 'Image URL or asset://';
                helperText = 'Paste a hosted image URL or asset:// identifier to show a cover.';
            }
        }
        const disabled = locked;
        const isTargetPage = (defType === 'nav-link') && key === 'targetPageId' && (baseField instanceof z.ZodString);
        const anyZ: any = z;
        const isEnum = baseField instanceof anyZ.ZodEnum;
        const isNativeEnum = baseField instanceof anyZ.ZodNativeEnum;
        const assetKind = (baseField instanceof z.ZodString) ? inferAssetKind(defType, key) : null;
        const isUrlField = (baseField instanceof z.ZodString) && !assetKind && isLikelyUrlField(key, baseField);
        const isColorField = key.toLowerCase().includes('color');
        const isNavButtonColorField = defType === 'nav-link' && navStyle === 'button' && (key === 'color' || key === 'textColor');
        const stringInputType = inferStringInputType(baseField);
        const numberMeta = baseField instanceof z.ZodNumber ? deriveNumberBounds(baseField) : undefined;
        const assetPlaceholder = assetKind === 'image'
            ? 'asset://hash or https://example.com/image.jpg'
            : assetKind === 'video'
                ? 'asset://hash or https://example.com/video.mp4'
                : 'asset://hash or https://example.com/resource';
        return (
            <div key={key}>
                <label className="block text-[color:var(--fg-muted)] mb-1">{label}{!isOptional ? ' *' : ''}</label>
                {isTargetPage ? (
                    <select
                        className="input w-full"
                        value={String(stringValue || '')}
                        onChange={(e) => setFieldValue(key, e.target.value)}
                        disabled={disabled}
                    >
                        <option value="" disabled>Select page…</option>
                        {(() => {
                            const p = selectedProject;
                            const order = p?.pageOrder || [];
                            const pages = order.map(id => ({ id, title: p?.pages?.[id]?.title || id }));
                            return pages.map(pg => (
                                <option key={pg.id} value={pg.id}>{pg.title}</option>
                            ));
                        })()}
                    </select>
                ) : ((defType === 'text' && key === 'text' && (baseField instanceof z.ZodString)) || shouldUseTextareaField(defType, key)) ? (
                    <div>
                        <textarea
                            className="input w-full min-h-[6rem]"
                            value={stringValue}
                            onChange={(e) => setFieldValue(key, e.target.value)}
                            disabled={disabled}
                        />
                        <div className="mt-1 text-[10px] text-[color:var(--fg-muted)]">{stringValue.length} characters</div>
                    </div>
                ) : assetKind && baseField instanceof z.ZodString ? (
                    <SchemaAssetField
                        value={stringValue}
                        placeholder={assetPlaceholder}
                        disabled={disabled}
                        assets={assets}
                        assetKind={assetKind}
                        onChange={(next) => setFieldValue(key, next && next.length ? next : undefined)}
                        onKeyDown={handleEnterSubmitComp}
                    />
                ) : isUrlField ? (
                    <SchemaUrlField
                        value={stringValue}
                        disabled={disabled}
                        onChange={(next) => setFieldValue(key, next && next.length ? next : undefined)}
                        onKeyDown={handleEnterSubmitComp}
                    />
                ) : baseField instanceof z.ZodBoolean ? (
                    <div className="flex items-center gap-2">
                        <input type="checkbox" className="checkbox" checked={!!formValues[key]} onChange={(e) => setFieldValue(key, e.target.checked)} disabled={disabled} />
                        <span className="text-xs">{label}</span>
                    </div>
                ) : baseField instanceof z.ZodNumber ? (
                    <SchemaNumberField
                        value={typeof rawValue === 'number' ? rawValue : undefined}
                        min={numberMeta?.min}
                        max={numberMeta?.max}
                        step={numberMeta?.step}
                        disabled={disabled}
                        onChange={(next) => setFieldValue(key, next)}
                        onKeyDown={handleEnterSubmitComp}
                    />
                ) : (isEnum || isNativeEnum) ? (
                    <select
                        className="input w-full"
                        value={String(stringValue || '')}
                        onChange={(e) => setFieldValue(key, e.target.value)}
                        disabled={disabled}
                    >
                        <option value="" disabled>Select…</option>
                        {(() => {
                            // derive options for enum types
                            const def: any = (baseField as any)._def;
                            let opts: string[] = [];
                            if (isEnum && Array.isArray(def?.values)) opts = def.values as string[];
                            else if (isNativeEnum && def?.values) opts = Object.values(def.values).filter((v: unknown) => typeof v === 'string') as string[];
                            return opts.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                            ));
                        })()}
                    </select>
                ) : isColorField || isNavButtonColorField ? (
                    <div className="flex items-center gap-2">
                        <input
                            className="rounded border border-[color:var(--border)] bg-[color:var(--muted)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface)]"
                            type="color"
                            value={stringValue || '#2563eb'}
                            onChange={(e) => setFieldValue(key, e.target.value)}
                            disabled={disabled}
                            style={{ width: 36, height: 24, padding: 0, minWidth: 36 }}
                            aria-label={`${label} color`}
                        />
                        <input
                            className="input flex-1 font-mono text-xs"
                            value={stringValue || ''}
                            onChange={(e) => setFieldValue(key, e.target.value)}
                            onKeyDown={handleEnterSubmitComp}
                            placeholder={"#ffffff or named color"}
                            disabled={disabled}
                        />
                        {defType === 'nav-link' && key === 'textColor' && (
                            <button
                                type="button"
                                className="px-2 py-1 rounded border border-[color:var(--border)] text-[10px] font-semibold"
                                onClick={() => {
                                    const bg = typeof formValues.color === 'string' ? formValues.color : '';
                                    if (bg) setFieldValue('textColor', bg);
                                }}
                                disabled={disabled}
                                title="Use background color"
                            >
                                Use background
                            </button>
                        )}
                    </div>
                ) : (
                    <input
                        className="input w-full"
                        type={stringInputType}
                        value={stringValue}
                        onChange={(e) => setFieldValue(key, e.target.value)}
                        onKeyDown={handleEnterSubmitComp}
                        disabled={disabled}
                    />
                )}
                {!!helperText && <div className="mt-1 text-[10px] text-[color:var(--fg-muted)]">{helperText}</div>}
                {!!error && <div className="mt-1 text-xs text-red-500">{error}</div>}
            </div>
        );
    };

    const defaultFieldNodes = schemaFieldBuckets.default.map(([key, schema]) => renderSchemaField(key, schema)).filter((node): node is React.ReactElement => Boolean(node));
    const appearanceFieldNodes = schemaFieldBuckets.appearance.map(([key, schema]) => renderSchemaField(key, schema)).filter((node): node is React.ReactElement => Boolean(node));
    const imageWidgetSettingsNode = isImageWidget ? (
        <ImageWidgetSettings
            values={formValues}
            errors={formErrors}
            locked={locked}
            setFieldValue={setFieldValue}
            schemaFields={imageSchemaFields}
            onCommitKeyDown={handleEnterSubmitComp}
            widgetDefaults={widgetDefaults}
        />
    ) : null;
    const textWidgetSettingsNode = isTextWidget ? (
        <TextWidgetSettings
            values={formValues}
            errors={formErrors}
            locked={locked}
            setFieldValue={setFieldValue}
            schemaFields={textSchemaFields}
            onCommitKeyDown={handleEnterSubmitComp}
            widgetDefaults={widgetDefaults}
        />
    ) : null;
    const linkWidgetSettingsNode = isLinkWidget ? (
        <LinkWidgetSettings
            values={formValues}
            errors={formErrors}
            locked={locked}
            setFieldValue={setFieldValue}
            schemaFields={linkSchemaFields}
            onCommitKeyDown={handleEnterSubmitComp}
            widgetDefaults={widgetDefaults}
            rawUrl={linkRawUrl}
            fieldError={linkFieldError}
        />
    ) : null;
    const navWidgetSettingsNode = isNavLinkWidget ? (
        <NavLinkWidgetSettings
            values={formValues}
            errors={formErrors}
            locked={locked}
            setFieldValue={setFieldValue}
            schemaFields={navLinkSchemaFields}
            onCommitKeyDown={handleEnterSubmitComp}
            widgetDefaults={widgetDefaults}
            pages={navPages}
        />
    ) : null;
    const projectWidgetSettingsNode = isProjectWidget ? (
        <ProjectWidgetSettings
            values={formValues}
            errors={formErrors}
            locked={locked}
            setFieldValue={setFieldValue}
            schemaFields={projectSchemaFields}
            onCommitKeyDown={handleEnterSubmitComp}
            widgetDefaults={widgetDefaults}
        />
    ) : null;
    const videoWidgetSettingsNode = isVideo ? (
        <VideoWidgetSettings
            values={formValues}
            errors={formErrors}
            locked={locked}
            setFieldValue={setFieldValue}
            schemaFields={videoSchemaFields}
            onCommitKeyDown={handleEnterSubmitComp}
            widgetDefaults={widgetDefaults}
        />
    ) : null;
    const carouselWidgetSettingsNode = isCarousel ? (
        <CarouselWidgetSettings
            values={formValues}
            errors={formErrors}
            locked={locked}
            setFieldValue={setFieldValue}
            schemaFields={carouselSchemaFields}
            onCommitKeyDown={handleEnterSubmitComp}
            widgetDefaults={widgetDefaults}
            items={carouselItems}
            assets={assets}
            imageAssets={imageAssetOptions}
            videoAssets={videoAssetOptions}
            onAddSlide={addCarouselItem}
            onRemoveSlide={removeCarouselItem}
            onMoveSlide={moveCarouselItem}
            onUpdateSlide={updateCarouselItem}
            carouselError={carouselError}
        />
    ) : null;
    const contactWidgetSettingsNode = isContactWidget ? (
        <ContactWidgetSettings
            values={formValues}
            errors={formErrors}
            locked={locked}
            setFieldValue={setFieldValue}
            schemaFields={contactSchemaFields}
            onCommitKeyDown={handleEnterSubmitComp}
            widgetDefaults={widgetDefaults}
        />
    ) : null;
    const githubWidgetSettingsNode = isGitHubWidget ? (
        <GitHubReposWidgetSettings
            values={formValues}
            errors={formErrors}
            locked={locked}
            setFieldValue={setFieldValue}
            schemaFields={githubSchemaFields}
            onCommitKeyDown={handleEnterSubmitComp}
            widgetDefaults={widgetDefaults}
        />
    ) : null;

    function applyProps() {
        if (locked) return;
        try {
            const parsed = JSON.parse(propsText);
            setPropsError(null);
            setCarouselError(null);
            try {
                onApplyProps(parsed);
                notify({ type: 'success', message: `${widgetName} JSON settings applied successfully`, title: selectedProject?.name || 'Editor', persistent: false });
                onClose();
            } catch (err) {
                console.error('applyProps: onApplyProps threw', err);
                setPropsError('Failed to apply settings');
                try { notify({ type: 'error', message: 'Failed to apply JSON settings', title: selectedProject?.name || 'Editor', persistent: false }); } catch { /* noop */ }
            }
        } catch (err) {
            console.error('applyProps: invalid JSON', err);
            setPropsError("Invalid JSON");
            try { notify({ type: 'error', message: 'Invalid JSON settings', title: selectedProject?.name || 'Editor', persistent: false }); } catch { /* noop */ }
        }
    }

    function applyForm() {
        if (locked || !zodSchema) return;
        const parsed = zodSchema.safeParse(formValues);
        if (!parsed.success) {
            const errs: Record<string, string> = {};
            for (const issue of parsed.error.issues) {
                if (issue.path && issue.path.length > 0) {
                    errs[String(issue.path[0])] = issue.message;
                }
            }
            setFormErrors(errs);
            try { notify({ type: 'error', message: 'Fix form errors before applying', title: selectedProject?.name || 'Editor', persistent: false }); } catch { /* noop */ }
            console.warn('applyForm: validation failed', parsed.error);
            return;
        }
        setFormErrors({});
        let payload: Record<string, unknown> = parsed.data;
        if (isCarousel) {
            const serialized = serializeCarouselEditorItems(carouselItems);
            if (serialized.length === 0) {
                setCarouselError('Add at least one slide with a source.');
                return;
            }
            setCarouselError(null);
            payload = { ...payload, items: serialized };
        }
        try {
            onApplyProps(payload);
            notify({ type: 'success', message: `${widgetName} settings applied successfully`, title: selectedProject?.name || 'Editor', persistent: false });
            onClose();
        } catch (err) {
            console.error('applyForm: onApplyProps threw', err);
            setFormErrors({ _global: 'Failed to apply settings' });
            try { notify({ type: 'error', message: 'Failed to apply settings', title: selectedProject?.name || 'Editor', persistent: false }); } catch { /* noop */ }
        }
    }

    const pinDisabled = locked;

    const handlePrimaryApply = () => {
        if (zodSchema) {
            applyForm();
            return;
        }
        applyProps();
    };

    return (
        <div
            className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            data-testid="modify-widget-modal"
            onClick={onClose}
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
            tabIndex={-1}
        >
            <div
                className="surface w-full max-w-4xl border border-[color:var(--border)] rounded-2xl max-h-[85vh] overflow-hidden flex flex-col"
                style={{ animation: 'py-pop 0.25s ease-out' }}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={handleEnterSubmitAnywhere}
            >
                <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--border)]">
                    <div>
                        <h2 className="text-lg font-semibold">Modify Widget</h2>
                        <p className="text-xs text-[color:var(--fg-muted)]">Edit properties, layout and behavior for the selected widget</p>
                    </div>
                    <button className="btn btn-ghost btn-xs" onClick={onClose} aria-label="Close">
                        <X size={14} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-5 text-sm scrollable scrollable-container">
                    {/* Component Properties */}
                    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/90 overflow-hidden">
                        <button className="w-full flex items-center justify-between gap-2 px-4 py-2 text-left" onClick={toggleCompOpen} title={compOpen ? 'Collapse' : 'Expand'} aria-expanded={compOpen}>
                            <div className="flex items-center gap-2">
                                {compOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                <p className="text-sm uppercase tracking-wide text-[color:var(--fg-muted)]">Component Properties</p>
                            </div>
                            <div className="text-[color:var(--fg-muted)]" />
                        </button>
                        {compOpen && (
                            <div className="p-4 space-y-4">
                                {carouselWidgetSettingsNode}
                                {imageWidgetSettingsNode}
                                {textWidgetSettingsNode}
                                {linkWidgetSettingsNode}
                                {navWidgetSettingsNode}
                                {projectWidgetSettingsNode}
                                {contactWidgetSettingsNode}
                                {githubWidgetSettingsNode}
                                {videoWidgetSettingsNode}

                                {/* Zod-backed properties */}
                                {zodSchema && (!!defaultFieldNodes.length || !!appearanceFieldNodes.length || defType === 'link') && (
                                    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/90 p-4">
                                        <div className="text-[color:var(--fg-muted)] mb-2 font-medium">Component Properties</div>
                                        {!!defaultFieldNodes.length && (
                                            <div className="space-y-2">
                                                {defaultFieldNodes}
                                            </div>
                                        )}
                                        {!!appearanceFieldNodes.length && (
                                            <div className={`${defaultFieldNodes.length ? 'pt-3 mt-3 border-t border-[color:var(--border)]' : ''} space-y-2`}>
                                                <div className="text-[color:var(--fg-muted)] font-medium">Appearance</div>
                                                {appearanceFieldNodes}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Widget Properties */}
                    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/90 overflow-hidden">
                        <button className="w-full flex items-center justify-between gap-2 px-4 py-2 text-left" onClick={toggleWidgetOpen} title={widgetOpen ? 'Collapse' : 'Expand'} aria-expanded={widgetOpen}>
                            <div className="flex items-center gap-2">
                                {widgetOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                <p className="text-sm uppercase tracking-wide text-[color:var(--fg-muted)]">Widget Properties</p>
                            </div>
                            <div className="text-[color:var(--fg-muted)]" />
                        </button>
                        {widgetOpen && (
                            <div className="p-4 bg-[color:var(--surface)]/95 space-y-5">
                                {/* Name */}
                                <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 space-y-2">
                                    <label className="block text-[color:var(--fg-muted)] text-xs uppercase tracking-wide">Name</label>
                                    <input
                                        className="input w-full"
                                        value={title}
                                        disabled={locked}
                                        onChange={(e) => setTitle(e.target.value)}
                                        onBlur={() => {
                                            const v = title.trim();
                                            if (!locked && v && v !== item.title) {
                                                onRename(v);
                                                notify({ type: 'update', message: `${widgetName} renamed to "${v}"`, title: selectedProject?.name || 'Editor', persistent: false });
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                                                e.preventDefault();
                                                const v = title.trim();
                                                if (!locked && v && v !== item.title) {
                                                    onRename(v);
                                                    notify({ type: 'update', message: `${widgetName} renamed to "${v}"`, title: selectedProject?.name || 'Editor', persistent: false });
                                                }
                                            }
                                        }}
                                        data-testid="widget-name-input"
                                    />
                                </div>

                                {/* Protection */}
                                <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/95">
                                    <button className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-[color:var(--fg)]" onClick={() => persistedToggle('py_widget_protection_open', setProtectionOpen)}>
                                        <span className="flex items-center gap-2">
                                            {protectionOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            Protection
                                        </span>
                                        <span className="text-[11px] text-[color:var(--fg-muted)]">{protectionOpen ? 'Hide' : 'Show'}</span>
                                    </button>
                                    {protectionOpen && (
                                        <div className="p-4 border-t border-[color:var(--border)] space-y-3">
                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold transition-colors duration-150 ${pinned ? 'bg-[color:var(--accent)]/20 border-[color:var(--accent)] text-[color:var(--accent)] shadow-sm' : 'border-[color:var(--border)] text-[color:var(--fg-muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]'} ${pinDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    onClick={() => { if (!pinDisabled) onTogglePin(); }}
                                                    title={pinned ? 'Unpin (allow move)' : 'Pin (prevent move)'}
                                                    disabled={pinDisabled}
                                                >
                                                    {pinned ? <Pin size={16} /> : <PinOff size={16} />}
                                                    <span>{pinned ? 'Pinned' : 'Pin'}</span>
                                                </button>
                                                <button
                                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold transition-colors duration-150 ${locked ? 'bg-[color:var(--accent)]/20 border-[color:var(--accent)] text-[color:var(--accent)] shadow-sm' : 'border-[color:var(--border)] text-[color:var(--fg-muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]'}`}
                                                    onClick={onToggleLock}
                                                    title={locked ? 'Unlock (allow modify)' : 'Lock (prevent modify)'}
                                                >
                                                    {locked ? <Lock size={16} /> : <Unlock size={16} />}
                                                    <span>{locked ? 'Locked' : 'Lock'}</span>
                                                </button>
                                            </div>
                                            <p className="text-[11px] text-[color:var(--fg-muted)]">Pinning keeps the widget anchored while locking prevents accidental edits.</p>
                                        </div>
                                    )}
                                </div>

                                {/* Layer order */}
                                <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/95">
                                    <button className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-[color:var(--fg)]" onClick={() => persistedToggle('py_widget_layers_open', setLayerOpen)}>
                                        <span className="flex items-center gap-2">
                                            {layerOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            Layer order
                                        </span>
                                        <span className="text-[11px] text-[color:var(--fg-muted)]">{layerOpen ? 'Hide' : 'Show'}</span>
                                    </button>
                                    {layerOpen && (
                                        <div className="p-4 border-t border-[color:var(--border)]">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <button className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-[color:var(--border)] text-sm font-semibold transition-colors duration-150 hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] disabled:opacity-50" onClick={onBringToFront} disabled={locked} title="Bring to front">
                                                    <span className="flex items-center gap-2"><ChevronsUp size={16} /> Bring to front</span>
                                                </button>
                                                <button className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-[color:var(--border)] text-sm font-semibold transition-colors duration-150 hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] disabled:opacity-50" onClick={onSendToBack} disabled={locked} title="Send to back">
                                                    <span className="flex items-center gap-2"><ChevronsDown size={16} /> Send to back</span>
                                                </button>
                                                <button className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-[color:var(--border)] text-sm font-semibold transition-colors duration-150 hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] disabled:opacity-50" onClick={onBringForward} disabled={locked} title="Move up one layer">
                                                    <span className="flex items-center gap-2"><ChevronUp size={16} /> Move up</span>
                                                </button>
                                                <button className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-[color:var(--border)] text-sm font-semibold transition-colors duration-150 hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] disabled:opacity-50" onClick={onSendBackward} disabled={locked} title="Move down one layer">
                                                    <span className="flex items-center gap-2"><ChevronDown size={16} /> Move down</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Widget info */}
                                <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 space-y-1">
                                    <div className="text-[color:var(--fg-muted)] text-xs uppercase tracking-wide">Type</div>
                                    <div className="font-mono text-xs px-3 py-2 rounded-lg bg-[color:var(--muted)]/30 border border-[color:var(--border)]">
                                        {item.type ?? 'unknown'}
                                    </div>
                                </div>

                                {/* JSON settings */}
                                <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 space-y-2">
                                    <label className="block text-[color:var(--fg-muted)] text-xs uppercase tracking-wide">Advanced: Raw JSON settings</label>
                                    <textarea
                                        className="input w-full font-mono min-h-[10rem]"
                                        value={propsText}
                                        disabled={locked}
                                        onChange={(e) => setPropsText(e.target.value)}
                                        onKeyDown={handleCtrlEnterApplyJson}
                                    />
                                    {propsError && <div className="mt-1 text-xs text-red-500">{propsError}</div>}
                                    <div className="text-[10px] text-[color:var(--fg-muted)]">Use this area for bulk edits or to paste props from another widget.</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-[color:var(--border)] bg-[color:var(--surface)]/80">
                    <div>
                        {onDelete && !locked && (
                            <button
                                className="btn btn-error btn-xs inline-flex items-center gap-2"
                                title="Delete widget"
                                aria-label="Delete widget"
                                onClick={() => {
                                    if (confirm('Delete this widget? This cannot be undone.')) {
                                        onDelete();
                                        notify({ type: 'warning', message: `${widgetName} deleted from the editor`, title: selectedProject?.name || 'Editor', persistent: false });
                                    }
                                }}
                            >
                                <Trash2 size={14} />
                                <span>Delete widget</span>
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {zodSchema && (
                            <button className="btn btn-outline btn-xs" onClick={() => { applyProps(); }} disabled={locked} title="Apply raw JSON settings">
                                Apply JSON
                            </button>
                        )}
                        <button className="btn btn-outline btn-xs" onClick={handlePrimaryApply} disabled={locked}>
                            Save changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

