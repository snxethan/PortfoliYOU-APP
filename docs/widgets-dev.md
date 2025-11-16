# Widget Developer Guide

This guide explains how to add new widgets to the Editor using the widgets registry and SDK. It also covers naming conventions, property schemas, and recommended patterns.

## Concepts

- `WidgetDefinition<P>`: The canonical definition of a widget (type, label, default props, optional grid footprint, optional zod schema, and a pure `render`).
- `WidgetsRegistry`: Global registry for lazy-loading widget definitions and exposing palette metadata.
- `WidgetRenderer`: Renders a `WidgetInstance` by loading its definition via the registry.
- `ModifyWidgetModal`: The editor's built-in settings panel. If your definition includes `zodSchema`, a friendly form is auto-generated.

## Quick Start: Add a new widget

1) Create a definition file under `app/renderer/src/widgets/defs/`.

Example: `defs/Badge.tsx`

```tsx
import React from 'react';
import { z } from 'zod';
import type { WidgetDefinition } from '../types';

// Props for this widget
type BadgeProps = {
  text: string;
  color?: string; // CSS color
  variant?: 'solid' | 'outline';
};

const def: WidgetDefinition<BadgeProps> = {
  type: 'badge',                      // unique, lowercase key
  label: 'Badge',                     // human label shown in palette
  defaultProps: { text: 'New', color: '#111827', variant: 'solid' },
  grid: { w: 2, h: 2 },               // default size when dropped
  zodSchema: z.object({               // enable auto settings UI in editor
    text: z.string().min(1, 'Text is required'),
    color: z.string().optional(),
    variant: z.enum(['solid', 'outline']).optional(),
  }),
  render: (props) => (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 8px',
        borderRadius: 6,
        color: props.variant === 'solid' ? '#fff' : props.color || '#111827',
        background: props.variant === 'solid' ? (props.color || '#111827') : 'transparent',
        border: `2px solid ${props.color || '#111827'}`,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {props.text}
    </span>
  ),
};

export default def;
```

2) Register it in the registry loader so it appears in the palette.

Edit `app/renderer/src/widgets/loader.ts`:

```ts
import { WidgetsRegistry } from './registry';

WidgetsRegistry.register(
  { type: 'badge', label: 'Badge', grid: { w: 2, h: 2 }, category: 'Content' },
  () => import('./defs/Badge').then(m => m.default)
);
```

3) Run the app and open the Editor. Your widget should be listed in the Widgets palette under the chosen category. Drag it onto the canvas or press Enter on its tile to insert it.

```powershell
npm run dev
```

## Naming Conventions

- `type`: lowercase, short, unique; use letters/numbers and optional dashes only (e.g., `text`, `image`, `project-card`).
- `file`: `defs/<PascalCase>.tsx` (e.g., `defs/Badge.tsx`). Keep one widget per file.
- `label`: Title case, succinct. Rendered in palette tiles and UI (e.g., `"Text Block"`).
- `category`: Optional. Groups widgets in the palette (e.g., `Content`, `Media`, `Contact`).

## Props & Validation

- Prefer `zodSchema` on your definition to get an automatic, validated settings form in the Modify modal.
- `defaultProps` should be serializable and safe to store.
- Asset references: images and other binary resources should use `src: 'asset://<hash>'`. The editor and exporter handle persistence and import/export flows for `asset://` sources.

## Render Function Rules

- Keep `render` pure and synchronous (no side effects). It should return React nodes based only on `props`.
- Do not reference global app state, providers, or DOM APIs inside the render. Any interactive behavior should be self-contained or captured by props.
- Avoid creating large closures or re-computations; compute inexpensive styles/strings inline.

## Grid Footprint

- Use `grid: { w, h }` to define a sensible default size (in grid columns/rows).
- The editor enforces a square grid, where row size equals column size. Widgets can be resized by users later.

## Palette Metadata

- `WidgetsRegistry.register(meta, loader)` stores lightweight metadata for the palette, and a lazy loader for the full definition.
- Metadata shape:
  - `type`, `label`, optional `grid`, optional `category`.

## Using SDK Helpers (Optional)

The current editor uses `zodSchema` for the Modify modal. If you need lightweight validation utilities for your own templates or custom UIs, the SDK also exposes:

- `validateProps(schema, props, defaults?)` and `useWidgetConfig(def, incoming?)` in `widgets/sdk.ts`.

These are optional and not required when using the editor’s built-in Modify modal.

## Testing Tips

- The palette tiles expose test IDs like `data-testid="palette-tile-<type>"`.
- The canvas and widget elements expose `data-testid="grid-canvas"` and `data-widget-id` respectively. Use these in E2E tests.

## Example Types

See existing widgets in `defs/` for patterns:
- `Text.tsx` – simple text with zod schema.
- `Image.tsx` – demonstrates `asset://` handling with the Assets panel and Modify modal.
- `Project.tsx`, `Contact.tsx` – richer examples.

## Common Pitfalls

- Forgetting to register your widget in `loader.ts` means it won’t appear in the palette.
- Mismatched `type` string between meta and definition causes load failures.
- Non-serializable props (functions, DOM nodes) break persistence and export/import.
- Heavy/async side effects in `render` can degrade editor responsiveness.
