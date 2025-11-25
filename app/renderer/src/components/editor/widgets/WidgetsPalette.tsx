import { useDraggable } from '@dnd-kit/core';
import type { LucideIcon } from 'lucide-react';
import { Boxes, Search, ChevronDown, ChevronRight, Image as ImageIcon, Mail, Type as TypeIcon, Compass, GalleryHorizontalEnd, Layers, Frame, LayoutGrid, AppWindow, Play, Link2, Github } from 'lucide-react';
import React, { memo, useEffect, useMemo, useState } from 'react';

import { WidgetsRegistry } from '../../../widgets/registry';
// Ensure built-in widgets are registered (side-effect import)
import '../../../widgets/loader';
// Assets are now rendered by the sidebar container beneath this palette

const PREVIEW_ICON_SIZE = 26;
const PREVIEW_SHELL_CLASS = 'w-full h-full bg-white rounded-md border border-[color:var(--border)] flex flex-col items-center justify-center text-[color:var(--fg-muted)]';

type PreviewConfig = {
  icon?: LucideIcon;
  label?: string;
  accentClass?: string;
  render?: () => React.ReactNode;
};

const fallbackPreview: Required<Pick<PreviewConfig, 'icon'>> = {
  icon: TypeIcon,
};

const previewConfigs: Record<string, PreviewConfig> = {
  image: { icon: ImageIcon, label: 'Image' },
  text: { icon: TypeIcon, label: 'Text' },
  video: { icon: Play, label: 'Video' },
  link: { icon: Link2, label: 'Link' },
  contact: { icon: Mail, label: 'Contact' },
  'nav-link': { icon: Compass, label: 'Page Navigation' },
  project: { icon: LayoutGrid, label: 'Project' },
  carousel: { icon: GalleryHorizontalEnd, label: 'Carousel' },
  'portfolio-island': { icon: Layers, label: 'Island' },
  embed: { icon: Frame, label: 'Embed' },
  'preview-popup': { icon: AppWindow, label: 'Popup' },
  'github-repos': { icon: Github, label: 'GitHub Repos' },
};

function renderPreview(type: string) {
  const config = previewConfigs[type] ?? {};
  if (config.render) return config.render();
  const Icon = config.icon ?? fallbackPreview.icon;
  return (
    <div className={PREVIEW_SHELL_CLASS}>
      <Icon size={PREVIEW_ICON_SIZE} className={config.accentClass ?? 'text-[color:var(--fg-muted)]'} />
      {config.label && <span className="mt-1 text-[10px] font-semibold tracking-wide text-[color:var(--fg-muted)]">{config.label}</span>}
    </div>
  );
}

function DraggablePaletteTile({ type, label, w, h, schemaVersion, description }: { type: string; label: string; w: number; h: number; schemaVersion?: number; description?: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `palette:${type}`, data: { src: 'palette', type, w, h, label, schemaVersion } });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`aspect-square rounded-md bg-[color:var(--muted)]/30 border border-[color:var(--border)] cursor-grab flex flex-col items-stretch justify-between text-center transition hover-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)] ${isDragging ? 'opacity-60' : ''}`}
      title={description ? `${description} · ${w}x${h}` : `Drag to canvas · ${w}x${h}`}
      role="button"
      aria-label={`Add ${label} widget`}
      tabIndex={0}
      data-testid={`palette-tile-${type}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('py:addWidget', { detail: { type, label, w, h, schemaVersion } }));
        }
      }}
    >
      {/* Visual preview area */}
      <div className="grow p-1 flex items-center justify-center overflow-hidden">
        {renderPreview(type)}
      </div>
      {/* Footer label */}
      <div className="px-2 py-1 text-[10px] leading-tight border-t border-[color:var(--border)] bg-[color:var(--muted)]/20">
        <div className="line-clamp-1" title={label}>{label}</div>
        <div className="text-[color:var(--fg-muted)]">{w}×{h}</div>
      </div>
    </div>
  );
}

function WidgetsPalette() {
  const metas = useMemo(() => WidgetsRegistry.list(), []);
  const [query, setQuery] = useState('');
  const [openMap, setOpenMap] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem('py_palette_open');
      return raw ? JSON.parse(raw) as Record<string, boolean> : {};
    } catch { return {}; }
  });

  useEffect(() => {
    try { localStorage.setItem('py_palette_open', JSON.stringify(openMap)); } catch { /* ignore */ }
  }, [openMap]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = metas.filter(m => {
      if (!q) return true;
      const tokens = [
        m.label,
        m.type,
        m.category ?? '',
        ...(m.tags ?? []),
        ...(m.keywords ?? []),
      ].join(' ').toLowerCase();
      return tokens.includes(q);
    });
    const map = new Map<string, typeof items>();
    for (const m of items) {
      const key = m.category || 'Other';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [metas, query]);

  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-medium mb-2">
      </div>
      <div className="mb-2">
        <div className="relative">
          <input
            className="input w-full pl-7"
            placeholder="Search widgets…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-[color:var(--fg-muted)]" />
        </div>
      </div>
      <div className="space-y-2 text-xs text-[color:var(--fg)]">
        {grouped.map(([cat, list]) => {
          const isOpen = openMap[cat] ?? true;
          return (
            <div key={cat} className="border border-[color:var(--border)] rounded-md overflow-hidden">
              <button
                className="w-full flex items-center justify-between gap-2 px-2 py-1.5 bg-[color:var(--muted)]/40 text-[10px] tracking-wide uppercase"
                onClick={() => setOpenMap(prev => ({ ...prev, [cat]: !(prev[cat] ?? true) }))}
                title={isOpen ? 'Collapse' : 'Expand'}
              >
                <span className="inline-flex items-center gap-2">
                  {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  {cat}
                </span>
                <span className="text-[color:var(--fg-muted)]">{list.length}</span>
              </button>
              {isOpen && (
                <div className="p-2">
                  <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
                    {list.map(def => (
                      <DraggablePaletteTile
                        key={def.type}
                        type={def.type}
                        label={def.label}
                        w={def.grid?.w ?? 4}
                        h={def.grid?.h ?? 4}
                        schemaVersion={def.version}
                        description={def.description}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {grouped.length === 0 && (
          <div className="text-[color:var(--fg-muted)]">No widgets match your search.</div>
        )}
        {/* Assets are displayed by the sidebar outside this palette */}
      </div>
    </div>
  );
}

export default memo(WidgetsPalette);
