# Widget SDK

This folder provides a small SDK to define and develop widgets for the editor.

## Runtime contracts

- `WidgetDefinition<P>`: type, label, defaultProps, optional `grid` (w,h), optional `schema`, and a pure `render(props)`.
- `WidgetInstance<P>`: id, type, props. Use `WidgetRenderer` to render lazily via the registry.

## Registry

- Register widgets with lazy loading in `widgets/loader.ts`:

```ts
WidgetsRegistry.register(
  { type: 'text', label: 'Text Block', grid: { w: 4, h: 3 } },
  () => import('./defs/Text').then(m => m.default)
);
```

- The palette lists `WidgetsRegistry.list()` metadata and does not load components until rendering.

## SDK utilities

- `validateProps(schema, props, defaults?)` → merges defaults, validates types, and returns `{ ok, errors, value }`.
- `useWidgetConfig(def, incoming?)` → React hook to manage a widget's props with optional schema validation. Returns `{ config, set, patch, reset, errors }`.

### Prop schema

```ts
const schema: PropSchema = {
  text: { type: 'string', required: true, default: 'Edit me' },
  align: { type: 'string', default: 'left', validate: v => ['left','center','right'].includes(String(v)) || 'align must be left|center|right' },
};
```

## Templates

See `widgets/templates/` for example `TextWidget` and `ImageWidget` templates including a basic Config Panel that uses `useWidgetConfig`.

- `templates/TextWidget.tsx`
- `templates/ImageWidget.tsx`

These are examples and not automatically registered; copy and adapt when creating new widgets.
