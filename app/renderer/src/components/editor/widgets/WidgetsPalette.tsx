import { useDraggable } from '@dnd-kit/core';
import { Boxes, Search, ChevronDown, ChevronRight } from 'lucide-react';
import React, { memo, useEffect, useMemo, useState } from 'react';

import { WidgetsRegistry } from '../../../widgets/registry';
// Ensure built-in widgets are registered (side-effect import)
import '../../../widgets/loader';

function DraggablePaletteTile({ type, label, w, h }: { type: string; label: string; w: number; h: number }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `palette:${type}`, data: { src: 'palette', type, w, h, label } });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`aspect-square rounded-md bg-[color:var(--muted)]/50 border border-[color:var(--border)] cursor-grab flex items-center justify-center text-center px-2 text-[11px] ${isDragging ? 'opacity-60' : ''}`}
      title={`Drag to canvas · ${w}x${h}`}
    >
      <span className="line-clamp-2 leading-tight">{label}</span>
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
      </div>
    </div>
  );
}

export default memo(WidgetsPalette);
