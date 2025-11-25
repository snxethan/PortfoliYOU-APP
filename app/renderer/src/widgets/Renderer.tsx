import React, { useEffect, useMemo, useState } from 'react';

import { WidgetsRegistry } from './registry';
import type { WidgetDefinition, WidgetInstance } from './types';
import { WidgetContext, validateProps } from './sdk';
import type { Theme } from '../themes/types';
import { getWidgetThemeSnapshot, type WidgetThemeSnapshot } from './theme';

type PreparedWidgetProps = {
  props: unknown;
  schemaVersion: number;
  upgraded: boolean;
};

function prepareWidgetProps(def: WidgetDefinition<unknown>, rawProps: unknown, rawVersion?: number): PreparedWidgetProps {
  const targetVersion = typeof def.version === 'number' ? def.version : 1;
  const fromVersion = typeof rawVersion === 'number' ? rawVersion : 1;
  let working: unknown = rawProps ?? {};
  let upgraded = false;
  if (fromVersion !== targetVersion) {
    if (typeof def.migrate === 'function') {
      try {
        working = def.migrate({ props: working, fromVersion, toVersion: targetVersion });
      } catch (err) {
        console.warn(`[widgets] migrate(${def.type}) failed:`, err);
      }
    }
    upgraded = true;
  }

  let normalized: unknown;
  if (def.schema) {
    const result = validateProps<Record<string, unknown>>(def.schema, working, def.defaultProps as Record<string, unknown>);
    normalized = result.value;
  } else if (working && typeof working === 'object') {
    normalized = { ...(def.defaultProps as object), ...(working as object) };
  } else {
    normalized = def.defaultProps;
  }

  return { props: normalized, schemaVersion: targetVersion, upgraded };
}

export default function WidgetRenderer({ instance, editing = false, interactive = true, onChangeProps, onUpgradeInstance, currentPageId, theme, themeSnapshot }: { instance: WidgetInstance<unknown>; editing?: boolean; interactive?: boolean; onChangeProps?: (partial: Record<string, unknown>) => void; onUpgradeInstance?: (next: { props: unknown; schemaVersion: number }) => void; currentPageId?: string; theme?: Theme | null; themeSnapshot?: WidgetThemeSnapshot | null }) {
  const [def, setDef] = useState<WidgetDefinition<unknown> | undefined>(() => WidgetsRegistry.get(instance.type));
  const resolvedTheme = useMemo(() => {
    if (themeSnapshot) return themeSnapshot;
    return getWidgetThemeSnapshot(theme);
  }, [themeSnapshot, theme]);

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

  const prepared = useMemo(() => {
    if (!def) {
      return { props: instance.props, schemaVersion: instance.schemaVersion ?? 1, upgraded: false } as PreparedWidgetProps;
    }
    return prepareWidgetProps(def, instance.props, instance.schemaVersion);
  }, [def, instance.props, instance.schemaVersion]);

  useEffect(() => {
    if (!def || !prepared.upgraded || !onUpgradeInstance) return;
    onUpgradeInstance({ props: prepared.props, schemaVersion: prepared.schemaVersion });
  }, [def, prepared.schemaVersion, prepared.upgraded, prepared.props, onUpgradeInstance]);

  const updateProps = (partial: Record<string, unknown>) => {
    try { onChangeProps?.(partial); } catch { /* noop */ }
  };
  let content: React.ReactNode;
  if (def) {
    const WidgetComponent = def.render as React.ComponentType<Record<string, unknown>>;
    content = React.createElement(WidgetComponent, prepared.props as Record<string, unknown>);
  } else {
    content = (
      <div className="text-xs text-[color:var(--fg-muted)] border border-dashed border-[color:var(--border)] rounded p-2">
        Loading {instance.type}…
      </div>
    );
  }

  return (
    <WidgetContext.Provider value={{ id: instance.id, editing, interactive, updateProps, currentPageId, theme: resolvedTheme }}>
      {content}
    </WidgetContext.Provider>
  );
}
