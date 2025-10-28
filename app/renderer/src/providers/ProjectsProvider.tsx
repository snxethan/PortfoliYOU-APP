import React, { createContext, useContext, useEffect, useMemo, useState } from "react";


export type Project = { id: string; name: string; updatedAt: string };


type ProjectsCtx = {
projects: Project[];
hasAny: boolean;
addProject: (name?: string) => Project;
importProject: (file?: File) => Promise<Project>;
};


const Ctx = createContext<ProjectsCtx | null>(null);


function readStore(): Project[] {
try { return JSON.parse(localStorage.getItem("py.projects") || "[]"); } catch { return []; }
}
function writeStore(list: Project[]) { localStorage.setItem("py.projects", JSON.stringify(list)); }


export function ProjectsProvider({ children }: { children: React.ReactNode }) {
const [projects, setProjects] = useState<Project[]>([]);
useEffect(() => { setProjects(readStore()); }, []);


const api = useMemo<ProjectsCtx>(() => ({
projects,
hasAny: projects.length > 0,
addProject: (name = "Untitled Portfolio") => {
const p: Project = { id: crypto.randomUUID(), name, updatedAt: new Date().toISOString() };
const next = [p, ...projects];
setProjects(next); writeStore(next);
localStorage.setItem("py.hasAnyProject", "1");
return p;
},
importProject: async (_file) => {
// placeholder import; just creates a new entry for now
const p: Project = { id: crypto.randomUUID(), name: "Imported Portfolio", updatedAt: new Date().toISOString() };
const next = [p, ...projects];
setProjects(next); writeStore(next);
localStorage.setItem("py.hasAnyProject", "1");
return p;
},
}), [projects]);


return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}


export function useProjects() {
const v = useContext(Ctx); if (!v) throw new Error("useProjects outside provider"); return v;
}