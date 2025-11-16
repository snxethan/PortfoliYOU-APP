import { useDraggable } from '@dnd-kit/core';
import { Boxes, Search, ChevronDown, ChevronRight, Image as ImageIcon, Mail, Type as TypeIcon, Link2 } from 'lucide-react';
import React, { memo, useEffect, useMemo, useState } from 'react';

import { WidgetsRegistry } from '../../../widgets/registry';
// Ensure built-in widgets are registered (side-effect import)
import '../../../widgets/loader';
// Assets are now rendered by the sidebar container beneath this palette

function DraggablePaletteTile({ type, label, w, h }: { type: string; label: string; w: number; h: number }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `palette:${type}`, data: { src: 'palette', type, w, h, label } });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`aspect-square rounded-md bg-[color:var(--muted)]/30 border border-[color:var(--border)] cursor-grab flex flex-col items-stretch justify-between text-center ${isDragging ? 'opacity-60' : ''}`}
      title={`Drag to canvas · ${w}x${h}`}
      role="button"
      aria-label={`Add ${label} widget`}
      tabIndex={0}
      data-testid={`palette-tile-${type}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('py:addWidget', { detail: { type, label, w, h } }));
        }
      }}
    >
      {/* Visual preview area */}
      <div className="grow p-1 flex items-center justify-center overflow-hidden">
        {type === 'image' ? (
          <div className="w-full h-full rounded-md border border-dashed border-[color:var(--border)] bg-white flex items-center justify-center">
            <ImageIcon size={28} className="text-[color:var(--fg-muted)]" />
          </div>
        ) : type === 'text' ? (
          <div className="w-full h-full bg-white rounded-md border border-[color:var(--border)] flex items-center justify-center">
            <span className="font-semibold text-[11px] tracking-wide text-black">Text</span>
          </div>
        ) : type === 'contact' ? (
          <div className="w-full h-full bg-white rounded-md border border-[color:var(--border)] p-1 text-[8px] text-left">
            <div className="mb-1 flex items-center gap-1 text-[color:var(--fg-muted)]"><Mail size={10} /> Email</div>
            <div className="h-2.5 bg-[color:var(--muted)]/50 rounded mb-1" />
            <div className="h-6 bg-[color:var(--muted)]/50 rounded mb-1" />
            <div className="h-3 bg-[color:var(--muted)]/50 rounded w-10 ml-auto" />
          </div>
        ) : type === 'project' ? (
          <div className="w-full h-full bg-white rounded-md border border-[color:var(--border)] p-1 text-left">
            <div className="h-6 bg-[color:var(--muted)]/50 rounded mb-1" />
            <div className="h-2 bg-[color:var(--muted)]/50 rounded w-3/4 mb-0.5" />
            <div className="h-2 bg-[color:var(--muted)]/40 rounded w-1/2" />
          </div>
        ) : type === 'nav-link' ? (
          <div className="w-full h-full bg-white rounded-md border border-[color:var(--border)] flex items-center justify-center">
            <div className="flex items-center gap-1">
              <Link2 size={14} className="text-[color:var(--accent)]" />
              <span className="text-[11px] font-semibold text-[color:var(--accent)] underline">Link</span>
            </div>
          </div>
        ) : (
          <div className="w-full h-full bg-white rounded-md border border-[color:var(--border)] flex items-center justify-center">
            <TypeIcon size={16} className="text-[color:var(--fg-muted)]" />
          </div>
        )}
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
  const metas = WidgetsRegistry.list();
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
      return m.label.toLowerCase().includes(q) || m.type.toLowerCase().includes(q) || (m.category?.toLowerCase().includes(q) ?? false);
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
        <Boxes size={16} /> Widgets
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
                  <div className="grid grid-cols-2 gap-2">
                    {list.map(def => (
                      <DraggablePaletteTile
                        key={def.type}
                        type={def.type}
                        label={def.label}
                        w={def.grid?.w ?? 4}
                        h={def.grid?.h ?? 4}
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
