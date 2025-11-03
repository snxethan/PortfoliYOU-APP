import React from 'react';

import { WidgetsRegistry } from '../../../widgets/registry';
import type { WidgetInstance } from '../../../widgets/types';

export default function WidgetRenderer({ instance }: { instance: WidgetInstance<unknown> }) {
  const def = WidgetsRegistry.get(instance.type);
  if (!def) {
    return (
      <div className="text-xs text-red-500 border border-red-300 bg-red-50/20 rounded p-2">
        Unknown widget type: {instance.type}
      </div>
    );
  }
  return <>{def.render(instance.props)}</>;
}
