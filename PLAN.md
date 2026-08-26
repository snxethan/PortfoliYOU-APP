# Portfoli-YOU — product & architecture plan

**Status (2026-08-26):** the product is a **web app**. `portfoli-you-app` gets
rebuilt web-first; the Electron tree is archived to a branch rather than ported
incrementally.

The existing repo is a **working prototype and the reference for the target
shape** — the data model, widget contract and theme system are proven and carry
forward. The implementation gets rebuilt around them.

Supersedes `WEB-PORT-PLAN.md`, which assumed an in-place Electron port.

---

## 1. What the prototype proved

Nine widget types, a lazy widget registry, five theme presets, a working static
compiler and a Deploy page that already exports a zip. That is a real product
skeleton, and most of it is framework-agnostic already.

| From the prototype | Verdict |
| --- | --- |
| `Project` / `Page` / `Widget` types (`ProjectsProvider.tsx`) | **Carry forward.** Already a serialisable document with `schemaVersion`, `portfolioMeta`, `themes`, `pages`, `widgets`. This is the IR — see §3. |
| `WidgetDefinition` contract (`widgets/types.ts`) | **Carry forward, reshaped.** `zodSchema`, `version`, `migrate`, `defaultProps`, `grid` all stay. `render` + `getStaticCss` get replaced by `emit` (§3). |
| Widget registry — lazy loader, `category`/`tags`/`keywords` | **Carry forward as-is.** The palette UX depends on it and it works. |
| Theme model (`themes/types.ts`) — `ThemeColors`, `ThemeTypography`, preset vs custom | **Carry forward.** Ten colour roles and a type scale is the right granularity. |
| The nine widget defs (Text, Image, Video, Carousel, Link, NavLink, Project, GitHubRepos, Contact) | **Rewrite against `emit`,** keep the prop schemas. |
| `staticCompiler.ts` (1096 lines, `node:fs` + `jsdom`) | **Rewrite** as the `static` target emitter (§3). The HTML/CSS/JS it produces is the correct output; the Node coupling is not. |
| `staticCompilerCore.ts` | Empty stub — delete. |
| `app/main/*`, `app/preload/*`, `FrameBar`, `previewServer`, `electron-updater` | **Archive.** No web equivalent and no longer needed. |
| Firebase auth / Firestore / Storage (`lib/firebase.ts`, `AuthProvider`, `AssetsProvider`) | **Carry forward.** Already the browser SDK; runs unchanged. |
| `originWidgetId` on `Widget` | **Carry forward.** Already the hook for "save as custom widget" (§5). |

> Nothing above says "port". It says: keep the shapes that were right, rebuild
> the code that was shaped by Electron.

---

## 2. The product — five stages

### Stage 1 — Create a project

The user names a project and sets what the whole site inherits:

- Name, description, **site type** (portfolio · résumé · sandbox · landing page)
- Author, site title, tagline
- Icon / logo, **favicon pack** (generated from one upload: 16/32/180/192/512 +
  `site.webmanifest`)
- Social share image, Open Graph and Twitter card metadata
- **Security & policy metadata** — contact address, policy URL, `robots`
  directives, optional `.well-known/security.txt`
- Theme / colour palette — a preset, then editable
- **Target framework** (§3) — changeable later via conversion (§4)

Site type is not cosmetic: it picks the starter page set, the default widget
palette ordering, and which metadata fields are required.

### Stage 2 — Organise pages

A dashboard listing the project's pages. Add, rename, reorder, duplicate,
delete. Each page carries its own route, title, per-page metadata, background
and enabled breakpoints — all already on the prototype's `Page` type.

### Stage 3 — Compose with widgets

A blank canvas with the widget palette docked beside it. Drag a widget on,
then move, resize and snap it. Selecting a widget opens its settings.

### Stage 4 — Edit a widget, at three depths

This is the part that makes Portfoli-YOU different from every other builder,
and it needs to be one panel with three tabs rather than three features:

1. **Settings** — the generated form. Driven by the widget's `zodSchema`, so
   every widget gets a properties UI for free. Text, font, size, colour,
   spacing, borders, shadows — anything the style model exposes.
2. **JSON** — the widget's serialised definition. Copy it, paste it into
   another project, save it to a personal library as a custom widget, or share
   the snippet. `originWidgetId` already tracks provenance for clones.
3. **Code** — the emitted source for the project's chosen target: HTML + CSS,
   or `.tsx`, or a Go template. Read-only by default; **Eject** makes it an
   editable override (§5).

### Stage 5 — Deploy

Package and ship (§6). Free local export always; hosted targets behind an
account.

---

## 3. Framework targets — the one architectural decision that matters

**Widgets must not emit framework code directly.**

The naive design gives every widget a `renderReact`, `renderHtml`, `renderGo`.
That is `widgets × targets` implementations — nine widgets across four targets
is thirty-six things to write and keep in sync, and every new widget taxes
every target forever.

Instead: **a widget emits a normalised node tree; each target renders that tree
once.** Nine widgets **plus** four targets — thirteen things, and the two axes
stop multiplying.

```ts
/** What every widget emits. Framework-free by construction. */
type WidgetNode = {
  tag: string;                       // 'div' | 'img' | 'a' | 'section' | …
  attrs?: Record<string, string | number | boolean>;
  style?: StyleObject;               // resolved against the active theme
  children?: (WidgetNode | string)[];
  /** Declared behaviour, never a raw function — targets compile these. */
  behaviour?: Behaviour[];           // e.g. {kind:'carousel', interval:5000}
  /** Data the widget needs at build or run time. */
  data?: { source: 'static' | 'fetch'; url?: string; value?: unknown };
};

interface WidgetDefinition<P> {
  type: string;
  version: number;
  label: string;
  defaultProps: P;
  grid?: { w: number; h: number };
  zodSchema: z.ZodObject<z.ZodRawShape>;
  migrate?: WidgetMigrateFn<P>;
  /** The only rendering method. Replaces render() + getStaticCss(). */
  emit(props: P, ctx: EmitContext): WidgetNode;
}
```

`behaviour` is the load-bearing part. A carousel cannot ship a JS closure,
because that closure is meaningless in a Go template — so it declares
*what it does* and each target compiles that declaration into its own idiom:
an event listener in the static target, a `useState` hook in React, a
progressive-enhancement script in Go.

The editor canvas is then just another consumer of `WidgetNode` — it renders
the tree to React DOM, which means **what you see while editing is the same
tree that gets emitted**, and preview drift becomes structurally impossible.

### Targets

| Target | Output | Phase |
| --- | --- | --- |
| `static` | HTML + CSS + a small vanilla JS bundle. No dependencies, hostable anywhere. | 1 — the default |
| `react-ts` | Vite + React + TypeScript project, typed props, CSS modules | 2 |
| `next` | Next.js App Router, SSG, `next/image`, generated metadata | 3 |
| `go` | `html/template` + `net/http`, single binary | 4 |
| `astro`, `svelte`, … | Community targets against the same interface | later |

A target is one module implementing:

```ts
interface Target {
  id: string;
  label: string;
  /** Turn the whole project document into a file tree. */
  emitProject(project: Project, ctx: EmitContext): Promise<FileTree>;
  /** Render a single widget node — the per-widget hook. */
  emitNode(node: WidgetNode, ctx: EmitContext): string;
  /** Compile a declared behaviour into target-native code. */
  emitBehaviour(behaviour: Behaviour, ctx: EmitContext): TargetCode;
  /** Files every project of this target needs (package.json, go.mod, …). */
  scaffold(project: Project): FileTree;
}
```

---

## 4. Changing a project's framework

Because targets read the same document, conversion is **re-emission, not
translation** — and that is what makes it safe.

Flow: user picks a new target → dialog explains what carries and what does not →
"Hang on…" progress → the project is **copied** to a new project at the new
target, original untouched → diff summary of anything dropped.

| Content | Converts |
| --- | --- |
| Pages, layout, widget props, theme, assets, metadata | **Losslessly.** Same document, different emitter. |
| Widget behaviours | **Losslessly**, if declared via `behaviour`. |
| **Ejected widget code** (§5) | **Does not convert.** Hand-written `.tsx` is not Go. |
| Target-specific scaffold edits (`next.config`, `go.mod`) | **Does not convert.** |

So the warning is specific and honest, not a generic scare: *"Four widgets have
ejected code that can't be converted to Go. They'll be restored to their
default appearance in the new copy — your current project is untouched."*
List them by name and page, and let the user cancel.

**Never convert in place.** Always copy. The undo story is "open the old
project", which needs no undo stack.

---

## 5. Code editing and ejection

Three levels, escalating and clearly signposted:

1. **Props** — the settings form. Fully convertible, fully migratable.
2. **Style overrides** — arbitrary CSS scoped to the widget instance. Stored as
   data on the widget, so it converts; the emitter just carries it through.
3. **Eject** — the user takes the emitted source and edits it. The widget stops
   being generated and becomes a file in the project.

Ejection rules, which need to be enforced by the model, not by discipline:

- Ejecting is **per widget instance**, never global.
- An ejected widget is marked `ejected: true` with its source stored alongside.
  The editor shows it with a distinct badge, since its canvas preview can no
  longer be trusted to match output.
- Ejected widgets **do not receive schema migrations**. Say so at eject time.
- **Un-eject** must exist: discard the custom source and fall back to the
  generated widget. Without it, ejection is a one-way door people won't walk
  through.
- Eject is target-scoped, which is exactly why §4 flags it.

For code editing itself, use CodeMirror 6 rather than Monaco — a fraction of
the bundle, and this is editing a file, not running an IDE.

---

## 6. Data model deltas

Additions to the prototype's `Project`:

```ts
type Project = {
  // … existing fields …
  siteType: 'portfolio' | 'resume' | 'sandbox' | 'landing';
  target: { id: TargetId; version: number };
  portfolioMeta: PortfolioMeta & {
    faviconPackId?: string;      // generated set, not a single file
    themeColor?: string;
    security?: {
      contactEmail?: string;
      policyUrl?: string;
      publishSecurityTxt: boolean;
    };
    robots?: { index: boolean; follow: boolean };
  };
  /** Per-user saved widgets, referenced by instances. */
  customWidgets?: Record<string, CustomWidgetDefinition>;
};

type Widget = {
  // … existing fields …
  styleOverrides?: StyleObject;
  ejected?: { targetId: TargetId; files: Record<string, string>; ejectedAt: string };
};
```

`Page` needs `route`, `meta` and `hidden`. Everything else on `Page` already
fits.

Bump `schemaVersion` and write the migration in the same commit as the shape
change — the prototype already has `migrate` hooks, so use them.

---

## 7. Deploy

| Method | Cost | Phase |
| --- | --- | --- |
| **Download** — zip of the emitted project | Free, no account | 1 |
| **GitHub Pages** — push the build to a repo the user connects | Free, needs OAuth | 2 |
| **Vercel / Netlify** — deploy hook | Free, user's own account | 2 |
| **`project.author.portfoliyou.dev`** — hosted subdomain | Free tier: one site | 3 |
| **Custom domain** — user's own DNS | Free | 3 |

Non-`static` targets need a build step before hosting. Run it in the target's
own platform (Vercel/Netlify/Pages build) rather than building React or Go in
the browser — the download path stays source-only for those targets.

---

## 8. Build order

1. **Document model + schema.** `Project`/`Page`/`Widget` with the §6 deltas,
   zod-validated, migrations wired. Everything else depends on this.
2. **`WidgetNode` IR + the `static` target.** Prove it end to end with the Text
   widget before touching the other eight.
3. **Editor canvas rendering `WidgetNode`.** Same tree in preview and output.
4. **Port the nine widgets to `emit`.** Mechanical once step 2 is settled.
5. **Settings panel from `zodSchema`.** One generated form, all widgets.
6. **Stage 1 project-creation flow** — metadata, favicon pack, theme, site type.
7. **Download deploy.** First complete loop: create → build → ship.
8. **Accounts + cloud sync.** Firebase carries over.
9. **JSON tab + custom widget library.**
10. **`react-ts` target.** The first real test of whether the IR holds — expect
    to revise `Behaviour` here, and budget for it.
11. **Code tab + eject + un-eject.**
12. **Conversion flow.**
13. **Hosted deploy** — Pages, Vercel, subdomains.
14. **Further targets** — `next`, `go`.

Steps 1–7 are the MVP: one framework, no accounts, download to ship. Resist
starting a second target before that loop is genuinely closed — the IR is only
proven by the second target, but it is only *worth* proving once the first
target ships something real.

---

## 9. Open questions

- **Does `Behaviour` actually generalise?** It is the plan's biggest assumption.
  The carousel and contact-form widgets are the stress tests; prototype those
  two against both `static` and `react-ts` early (step 10) before committing
  the remaining targets.
- **Go as a target.** Go has no component model, so widget composition becomes
  nested `html/template` definitions. Worth confirming there is real demand
  before building it — it is the most expensive target and the least like the
  others.
- **Asset limits on the free tier.** `limits.maxAssetsMB` exists in the model
  but no number has been chosen. Storage is the one cost that scales per user.
- **Custom widget sharing.** A public library needs moderation. Personal
  libraries first; community sharing only when there is someone to run it.
