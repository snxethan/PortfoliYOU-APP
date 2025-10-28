export default function DeployPage() {
return (
<div className="p-6 space-y-6">
<section className="surface p-5">
<h2 className="text-lg font-semibold mb-2">Deploy</h2>
<p className="text-sm text-[color:var(--fg-muted)]">Pick a method. Configure once. Reuse later.</p>
<div className="mt-4 grid md:grid-cols-3 gap-3">
<button className="surface p-4 text-left hover:bg-[color:var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)]">
<div className="text-sm font-semibold">Local serve + LAN</div>
<div className="text-xs text-[color:var(--fg-muted)]">One-click local server</div>
</button>
<button className="surface p-4 text-left hover:bg-[color:var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)]">
<div className="text-sm font-semibold">Quick share tunnel</div>
<div className="text-xs text-[color:var(--fg-muted)]">Temporary public URL</div>
</button>
<button className="surface p-4 text-left hover:bg-[color:var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)]">
<div className="text-sm font-semibold">GitHub Pages</div>
<div className="text-xs text-[color:var(--fg-muted)]">Push to gh-pages</div>
</button>
</div>
</section>
</div>
);
}