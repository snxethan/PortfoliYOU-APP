export default function ModifyPage() {
return (
<div className="p-6 space-y-6">
<section className="surface p-5">
<h2 className="text-lg font-semibold mb-2">Editor shell</h2>
<p className="text-sm text-[color:var(--fg-muted)]">Drag-and-drop area placeholder. Content panel placeholder.</p>
<div className="mt-4 grid grid-cols-12 gap-3">
<div className="col-span-9 h-64 rounded bg-[color:var(--bg)] border border-[color:var(--border)] flex items-center justify-center text-[color:var(--fg-muted)]">
Canvas
</div>
<div className="col-span-3 h-64 rounded bg-[color:var(--bg)] border border-[color:var(--border)] p-3">
<div className="text-sm font-medium mb-2">Content</div>
<div className="text-xs text-[color:var(--fg-muted)]">Fields appear here.</div>
</div>
</div>
</section>
</div>
);
}