import { Link } from "react-router-dom";


export default function Header() {
return (
<header className="sticky top-0 z-10 border-b border-[color:var(--border)] bg-[color:var(--surface)]/90 backdrop-blur">
<div className="max-w-6xl mx-auto px-4 h-12 flex items-center justify-between">
<Link to="/" className="font-semibold">Portfoli-you</Link>
<div className="hidden md:flex items-center gap-3 text-sm text-[color:var(--fg-muted)]">
<span className="badge-live">● Live preview ready</span>
</div>
</div>
</header>
);
}