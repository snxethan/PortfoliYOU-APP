import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import CloudSettingsModal from "../components/modals/CloudSettingsModal";

import { useProjects } from "./ProjectsProvider";

type CloudOpenTarget =
    | { projectId: string; cloudId?: string }
    | { cloudId: string; projectId?: string };

type CloudSettingsCtx = {
    openCloud: (target?: Partial<CloudOpenTarget>) => void;
    close: () => void;
};

const Ctx = createContext<CloudSettingsCtx | null>(null);

export function CloudSettingsProvider({ children }: { children: React.ReactNode }) {
    const {
        projects,
        selectedProjectId,
        selectProject,
        saving,
        lastSavedAt,
        getCloudObjectInfo,
        getCloudObjectInfoByCloudId,
        syncProject,
        unsyncProject,
        saveProject,
        importProjectFromCloud,
        importProjectFromCloudLocalOnly,
        renameCloudProject,
        deleteCloudProjectByCloudId,
    } = useProjects();

    const [open, setOpen] = useState(false);
    const [targetProjectId, setTargetProjectId] = useState<string | null>(null);
    const [targetCloudId, setTargetCloudId] = useState<string | null>(null);

    const close = useCallback(() => setOpen(false), []);

    const openCloud = useCallback((target?: Partial<CloudOpenTarget>) => {
        // Prefer explicit ids, fallback to selected or first project
        const pid = (target?.projectId
            ?? (selectedProjectId || projects[0]?.id)
        ) || null;
        const cid = target?.cloudId || null;
        if (cid && !pid) {
            setTargetProjectId(null);
            setTargetCloudId(cid);
            setOpen(true);
            return;
        }
        if (pid) {
            setTargetProjectId(pid);
            // If cloudId not provided, try to infer from local project
            const local = projects.find(p => p.id === pid);
            setTargetCloudId(local?._cloudId || null);
            setOpen(true);
        }
    }, [projects, selectedProjectId]);

    // Global event bridge for legacy triggers
    useEffect(() => {
        const onOpen = (e: Event) => {
            const ce = e as CustomEvent<{ projectId?: string; cloudId?: string }>;
            openCloud({ projectId: ce.detail?.projectId, cloudId: ce.detail?.cloudId });
        };
        window.addEventListener('py:openCloudSettings', onOpen as EventListener);
        return () => window.removeEventListener('py:openCloudSettings', onOpen as EventListener);
    }, [openCloud]);

    const ctx = useMemo<CloudSettingsCtx>(() => ({ openCloud, close }), [openCloud, close]);

    // Build modal props based on target
    const modal = useMemo(() => {
        if (!open) return null;
        if (targetProjectId && !targetCloudId) {
            // Local-only (not yet linked) – show linked mode but with limited actions
            const proj = projects.find(p => p.id === targetProjectId);
            if (!proj) return null;
            return (
                <CloudSettingsModal
                    open={open}
                    onClose={close}
                    mode="linked"
                    titleName={proj.name}
                    statusText={proj._synced ? 'Linked to cloud' : 'Not linked'}
                    saving={saving}
                    lastSavedAt={lastSavedAt}
                    actions={{
                        refreshInfo: async () => await getCloudObjectInfo(proj.id),
                        sync: async () => { await syncProject(proj.id); setTimeout(() => close(), 250); },
                        unlinkKeepCloud: undefined,
                        saveToDisk: async () => { await saveProject(proj.id); },
                        importLocalCopy: undefined,
                    }}
                />
            );
        }
        if (targetProjectId && targetCloudId) {
            const proj = projects.find(p => p.id === targetProjectId);
            const cloudId = targetCloudId;
            if (!proj) return null;
            return (
                <CloudSettingsModal
                    open={open}
                    onClose={close}
                    mode="linked"
                    titleName={proj.name}
                    statusText={proj._synced ? 'Linked to cloud' : 'Not linked'}
                    saving={saving}
                    lastSavedAt={lastSavedAt}
                    actions={{
                        refreshInfo: async () => await getCloudObjectInfo(proj.id),
                        sync: async () => { await syncProject(proj.id); setTimeout(() => close(), 250); },
                        unlinkKeepCloud: async () => { await unsyncProject(proj.id); },
                        saveToDisk: async () => { await saveProject(proj.id); },
                        importLocalCopy: async () => {
                            const p = await importProjectFromCloudLocalOnly(cloudId);
                            if (p?.id) { selectProject(p.id); close(); }
                        },
                        renameCloud: async (next: string) => await renameCloudProject(cloudId, next),
                        deleteCloud: async () => await deleteCloudProjectByCloudId(cloudId),
                    }}
                />
            );
        }
        if (!targetProjectId && targetCloudId) {
            const cid = targetCloudId;
            return (
                <CloudSettingsModal
                    open={open}
                    onClose={close}
                    mode="cloud"
                    titleName={'Cloud project'}
                    statusText={'Not linked'}
                    actions={{
                        refreshInfo: async () => await getCloudObjectInfoByCloudId(cid),
                        importAndLink: async () => {
                            const p = await importProjectFromCloud(cid);
                            if (p?.id) { selectProject(p.id); close(); }
                        },
                        importLocalOnly: async () => {
                            const p = await importProjectFromCloudLocalOnly(cid);
                            if (p?.id) { selectProject(p.id); close(); }
                        },
                        renameCloud: async (next: string) => await renameCloudProject(cid, next),
                        deleteCloud: async () => await deleteCloudProjectByCloudId(cid),
                    }}
                />
            );
        }
        return null;
    }, [open, targetProjectId, targetCloudId, projects, close, saving, lastSavedAt, getCloudObjectInfo, syncProject, unsyncProject, saveProject, importProjectFromCloudLocalOnly, renameCloudProject, deleteCloudProjectByCloudId, getCloudObjectInfoByCloudId, importProjectFromCloud, selectProject]);

    return (
        <Ctx.Provider value={ctx}>
            {children}
            {modal}
        </Ctx.Provider>
    );
}

export function useCloudSettings() {
    const v = useContext(Ctx); if (!v) throw new Error("useCloudSettings outside provider"); return v;
}
