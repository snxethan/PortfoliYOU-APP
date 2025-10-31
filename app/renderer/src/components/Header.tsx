import { Link, useNavigate } from "react-router-dom";
import { Cloud, UploadCloud, Wrench } from "lucide-react";

import { useProjects } from "../providers/ProjectsProvider";


export default function Header() {
	const { selectedProject, selectedProjectId, saving, lastSavedAt } = useProjects();
	const savedText = lastSavedAt ? new Date(lastSavedAt).toLocaleTimeString() : null;
	const navigate = useNavigate();

	return (
		<div className="sticky top-0 z-20 px-4 pt-4">
			<header className="header-island">
				<div className="flex items-center justify-between gap-3">
					<div className="flex items-center gap-3 min-w-0">
						{selectedProject ? (
							<Link to="/modify" className="island-title" title={selectedProject._filePath || ''}>
								<span className="opacity-80 mr-1">Managing</span>
								<span className="font-semibold truncate">{selectedProject.name}</span>
							</Link>
						) : (
							<button
								type="button"
								onClick={() => window.dispatchEvent(new CustomEvent('py:highlight-request'))}
								className="island-title text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
								title="Pick or create a portfolio to manage"
							>
								No portfolio selected
							</button>
						)}
					</div>

					<div className="hidden md:flex items-center gap-2 text-xs sm:text-sm text-[color:var(--fg-muted)]">
						{saving ? (
							<span className="inline-flex items-center gap-2">
								<span className="w-3 h-3 border-2 border-[color:var(--border)] border-t-[color:var(--primary)] rounded-full animate-spin"></span>
								Saving…
							</span>
						) : savedText ? (
							<span>Saved {savedText}</span>
						) : (
							<span className="badge-live">● Live preview ready</span>
						)}
					</div>
				</div>

				<div className="mt-3 flex items-center gap-2">
					<button
						className="btn btn-ghost hover-accent"
						disabled={!selectedProjectId}
						onClick={() => selectedProjectId && navigate('/modify')}
						title="Modify selected portfolio"
					>
						<Wrench size={16} className="mr-1"/> Modify
					</button>
					<button
						className="btn btn-ghost hover-accent"
						disabled={!selectedProjectId}
						onClick={() => selectedProjectId && navigate('/deploy')}
						title="Deploy selected portfolio"
					>
						<UploadCloud size={16} className="mr-1"/> Deploy
					</button>
					<button
						className="btn btn-ghost hover-accent"
						disabled={!selectedProjectId}
						onClick={() => {
							if (!selectedProjectId) return;
							window.dispatchEvent(new CustomEvent('py:openCloudSettings', { detail: { projectId: selectedProjectId } }));
						}}
						title="Manage Cloud settings"
					>
						<Cloud size={16} className="mr-1"/> Cloud
					</button>
				</div>
			</header>
		</div>
	);
}