import { useDraggable } from '@dnd-kit/core';
import { Boxes } from 'lucide-react';

import { WidgetsRegistry } from '../../../widgets/registry';
// Ensure built-in widgets are registered (side-effect import)
import '../../../widgets/loader';

function DraggablePaletteItem({ type, label, w, h }: { type: string; label: string; w: number; h: number }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `palette:${type}`, data: { src: 'palette', type, w, h, label } });
  return (
    <li
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`rounded px-2 py-1 bg-[color:var(--muted)]/50 border border-[color:var(--border)] cursor-grab ${isDragging ? 'opacity-60' : ''}`}
      title={`Drag to canvas · ${w}x${h}`}
    >
      {label}
    </li>
  );
}

export default function WidgetsPalette() {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-medium mb-2">
        <Boxes size={16} /> Widgets
      </div>
      <ul className="space-y-1 text-xs text-[color:var(--fg)]">
        {WidgetsRegistry.list().map(def => (
          <DraggablePaletteItem
            key={def.type}
            type={def.type}
            label={def.label}
            w={def.grid?.w ?? 4}
            h={def.grid?.h ?? 4}
          />
        ))}
      </ul>
    </div>
  );
}
