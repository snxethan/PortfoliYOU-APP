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
  {
    type: 'badge',
    label: 'Badge',
    grid: { w: 2, h: 2 },
    category: 'Content',
    tags: ['content', 'badge'],
    keywords: ['label', 'chip'],
  },
  () => import('./defs/Badge').then(m => m.default)
);
```

3) Run the app and open the Editor. Your widget should be listed in the Widgets palette under the chosen category. Drag it onto the canvas or press Enter on its tile to insert it.

```powershell
npm run dev
```

## Add a widget in 30 minutes

| Minute mark | What to focus on |
| --- | --- |
| 0‑5 | Align on the user story, pick a short `type`, Title‑Case `label`, default grid footprint, and an initial prop shape. Decide whether you need a `zodSchema` (recommended whenever you want to expose fields in the Modify panel).
| 5‑15 | Scaffold the definition under `widgets/defs/` based on the boilerplate below. Keep the render function pure, add `version: 1`, and wire up `defaultProps`. If you expect future prop changes, stub a `migrate` function that currently returns `payload.props` unchanged so bumps are easy later.
| 15‑20 | Register the widget in `widgets/loader.ts` with palette metadata (category, tags, keywords, and matching version). Run `npm run dev` (or restart if already running) so the new palette entry hot‑loads.
| 20‑25 | Open the Editor, drag the widget, and tweak props via the Modify modal. Use the pinned toolbar to rename and confirm undo/redo integrates cleanly. If the widget surfaces assets, drop them onto the canvas to verify `asset://` handling.
| 25‑30 | Add or update automated coverage: extend `tests/widgets-history.spec.ts` if new behavior needs assertions, capture before/after screenshots, and run `npx playwright test --grep "Widget add"` to ensure add → edit → undo → redo still passes. Finish by updating docs or release notes with any new props the Modify modal exposes.

The key is to keep every step incremental: definition → registration → manual validation → automated coverage. If any stage runs long, capture TODOs before moving on.

## Boilerplate template

Drop this into `app/renderer/src/widgets/defs/MyWidget.tsx` and tweak the TODO sections. It sets up versioned props, optional migration, and a zod schema so the Modify modal auto‑generates a form.

```tsx
import React from 'react';
import { z } from 'zod';
import type { WidgetDefinition } from '../types';

type MyWidgetProps = {
  title: string;
  emphasis?: 'primary' | 'muted';
};

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  emphasis: z.enum(['primary', 'muted']).default('primary'),
});

const MyWidget: WidgetDefinition<MyWidgetProps> = {
  type: 'my-widget',
  label: 'My Widget',
  version: 1,
  grid: { w: 4, h: 3 },
  defaultProps: { title: 'Hello there', emphasis: 'primary' },
  zodSchema: schema,
  // Optional: remove when you truly need migrations
  migrate: ({ props }) => props as MyWidgetProps,
  render: (props) => (
    <div style={{ padding: 16, borderRadius: 12, background: props.emphasis === 'primary' ? 'var(--accent)' : 'var(--muted)', color: props.emphasis === 'primary' ? '#000' : 'var(--fg)' }}>
      <strong>{props.title}</strong>
    </div>
  ),
};

export default MyWidget;
```

Register the widget by appending to `widgets/loader.ts`:

```ts
WidgetsRegistry.register(
  {
    type: 'my-widget',
    label: 'My Widget',
    version: 1,
    grid: { w: 4, h: 3 },
    category: 'Content',
    tags: ['content', 'custom'],
    keywords: ['cta', 'promo'],
  },
  () => import('./defs/MyWidget').then(m => m.default)
);
```

When you eventually change `MyWidgetProps`, bump `version`, update `migrate`, and keep the palette metadata in sync. Run `npx playwright test tests/widgets-history.spec.ts --grep "My Widget"` (or add a new describe block) so future edits stay covered.

## Launch checklist

- [ ] Definition file created under `widgets/defs/` with `version`, `defaultProps`, and optional `migrate`.
- [ ] Palette metadata added to `widgets/loader.ts` with matching `type`, `label`, `grid`, `category/tags/keywords`, and `version`.
- [ ] Widget renders without errors in the Editor canvas _and_ preview modes (inline + popup). Use the toolbar and preview toggle to sanity‑check.
- [ ] Modify modal fields validate correctly (zod schema, defaults, error messages) and the undo/redo buttons work after editing props.
- [ ] `asset://` references (if any) resolve through the Assets panel and survive page reload.
- [ ] `tests/widgets-history.spec.ts` updated if the widget adds new patterns, plus any bespoke Playwright/Vitest coverage needed.
- [ ] Documentation (this guide, release notes, or SMOKE_TEST checklist) updated to mention the new widget and any caveats.
- [ ] Screenshots or recordings captured for QA/demo, especially if the widget introduces new interactions.

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
  - `type`, `label`, optional `grid`, optional `category`, optional `tags`, optional `keywords`, **`version`** (number).
- Palette search matches all provided metadata, so include short, human-readable tags and keywords.

## Versioning & Migrations

- Every `WidgetDefinition` now requires a numeric `version`. Start at `1` and bump when you change the stored props shape.
- The palette metadata should use the same version so new drag sources tag instances correctly.
- Optional `migrate({ props, fromVersion, toVersion })` can be provided on the definition to upgrade legacy props. Return the latest props shape; the renderer will persist the result along with the new version.
- When no `migrate` hook is supplied, older widgets keep their props but still get stamped with the new version once rendered.

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
