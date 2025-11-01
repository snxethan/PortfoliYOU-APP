import React, { useEffect, useState } from 'react';

import { WidgetsRegistry } from './registry';
import type { WidgetDefinition, WidgetInstance } from './types';

export default function WidgetRenderer({ instance }: { instance: WidgetInstance<unknown> }) {
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
  return <>{def.render(instance.props)}</>;
}
