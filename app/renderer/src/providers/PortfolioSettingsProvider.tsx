import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import PortfolioSettingsModal from "../components/modals/PortfolioSettingsModal";
import { useProjects } from "./ProjectsProvider";
import type { PortfolioMeta } from "./ProjectsProvider";

type SectionKey = "portfolio" | "cloud" | "theme";

type OpenOptions = {
    projectId?: string;
    cloudId?: string;
    section?: SectionKey;
    initialMetadata?: Partial<PortfolioMeta>;
};

interface PortfolioSettingsCtx {
    openSettings: (options?: OpenOptions) => void;
    openCreate: (initial?: Partial<PortfolioMeta>) => void;
    close: () => void;
}

const Ctx = createContext<PortfolioSettingsCtx | null>(null);

export function PortfolioSettingsProvider({ children }: { children: React.ReactNode }) {
    const { selectedProjectId, projects } = useProjects();
    const [state, setState] = useState<{ open: boolean; mode: "create" | "project" | "cloud"; projectId?: string; cloudId?: string; section: SectionKey; initial?: Partial<PortfolioMeta>; }>({
        open: false,
        mode: "project",
        section: "portfolio",
    });

    const openSettings = useCallback((options?: OpenOptions) => {
        const resolvedProjectId = options?.projectId ?? selectedProjectId ?? projects[0]?.id;
        if (resolvedProjectId) {
            setState({
                open: true,
                mode: "project",
                projectId: resolvedProjectId,
                cloudId: options?.cloudId,
                section: options?.section ?? "portfolio",
                initial: options?.initialMetadata,
            });
            return;
        }
        if (options?.cloudId) {
            setState({
                open: true,
                mode: "cloud",
                cloudId: options.cloudId,
                section: options?.section ?? "cloud",
            });
            return;
        }
        setState(prev => ({ ...prev, open: true, mode: "create", section: "portfolio" }));
    }, [projects, selectedProjectId]);

    const openCreate = useCallback((initial?: Partial<PortfolioMeta>) => {
        setState({ open: true, mode: "create", section: "portfolio", initial });
    }, []);

    const close = useCallback(() => setState(prev => ({ ...prev, open: false })), []);

    useEffect(() => {
        const handler = (event: Event) => {
            const e = event as CustomEvent<{ projectId?: string; cloudId?: string } | undefined>;
            if (!e.detail) return;
            if (e.detail.projectId) {
                openSettings({ projectId: e.detail.projectId, section: "cloud" });
                return;
            }
            if (e.detail.cloudId) {
                openSettings({ cloudId: e.detail.cloudId, section: "cloud" });
            }
        };
        window.addEventListener("py:openCloudSettings", handler as EventListener);
        return () => window.removeEventListener("py:openCloudSettings", handler as EventListener);
    }, [openSettings]);

    const ctxValue = useMemo<PortfolioSettingsCtx>(() => ({ openSettings, openCreate, close }), [openSettings, openCreate, close]);

    return (
        <Ctx.Provider value={ctxValue}>
            {children}
            {state.open && (
                <PortfolioSettingsModal
                    open={state.open}
                    mode={state.mode}
                    projectId={state.projectId}
                    cloudId={state.cloudId}
                    initialMetadata={state.initial}
                    defaultSection={state.section}
                    onClose={close}
                />
            )}
        </Ctx.Provider>
    );
}

export function usePortfolioSettings() {
    const ctx = useContext(Ctx);
    if (!ctx) throw new Error("usePortfolioSettings outside provider");
    return ctx;
}
