import type { WidgetDefinition } from './types';
import type { WidgetsRegistryAPI, WidgetLoader, WidgetMeta } from './types';

const _defs = new Map<string, WidgetDefinition<unknown>>();
const _loaders = new Map<string, WidgetLoader>();
const _meta = new Map<string, WidgetMeta>();

async function _load(type: string): Promise<WidgetDefinition<unknown>> {
  const existing = _defs.get(type);
  if (existing) return existing;
  const loader = _loaders.get(type);
  if (!loader) throw new Error(`No widget loader for type: ${type}`);
  const mod = await loader();
  const def: WidgetDefinition<unknown> = ("default" in mod ? (mod as { default: WidgetDefinition<unknown> }).default : (mod as WidgetDefinition<unknown>));
  _defs.set(type, def);
  return def;
}

export const WidgetsRegistry: WidgetsRegistryAPI = {
  register: (meta: WidgetMeta, loader: WidgetLoader) => {
    _meta.set(meta.type, meta);
    _loaders.set(meta.type, loader);
  },
  get: (type) => _defs.get(type),
  ensure: (type) => _load(type),
  list: () => Array.from(_meta.values()),
};
