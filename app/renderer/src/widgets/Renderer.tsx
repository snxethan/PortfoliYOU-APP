import React, { useEffect, useState } from 'react';

import { WidgetsRegistry } from './registry';
import type { WidgetDefinition, WidgetInstance } from './types';
import { WidgetContext } from './sdk';

export default function WidgetRenderer({ instance, editing = false, interactive = true, onChangeProps, currentPageId }: { instance: WidgetInstance<unknown>; editing?: boolean; interactive?: boolean; onChangeProps?: (partial: Record<string, unknown>) => void; currentPageId?: string }) {
  const [def, setDef] = useState<WidgetDefinition<unknown> | undefined>(() => WidgetsRegistry.get(instance.type));

  useEffect(() => {
    let cancelled = false;
    if (!def) {
      WidgetsRegistry.ensure(instance.type).then((d) => {
        if (!cancelled) setDef(d);
      }).catch(() => {
        if (!cancelled) setDef(undefined);
      });
    }
    return () => { cancelled = true; };
  }, [instance.type, def]);

  if (!def) {
    return (
      <div className="text-xs text-[color:var(--fg-muted)] border border-dashed border-[color:var(--border)] rounded p-2">
        Loading {instance.type}…
      </div>
    );
  }
  const updateProps = (partial: Record<string, unknown>) => {
    try { onChangeProps?.(partial); } catch { /* noop */ }
  };
  return (
    <WidgetContext.Provider value={{ id: instance.id, editing, interactive, updateProps, currentPageId }}>
      {def.render(instance.props)}
    </WidgetContext.Provider>
  );
}
