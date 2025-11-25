# portfoli-you

Portfoli-you is a local-first desktop application that empowers anyone—regardless of coding experience—to design and deploy their own portfolio website. With a drag-and-drop editor, modular templates, and optional cloud sync, Portfoli-you makes it easy to showcase skills, projects, and experience in a professional online presence.

you can find my deployed website, hosting the future installer at https://portfoliyou.snxethan.dev & https://github.com/snxethan/PortfoliYOU-WEBSITE

## End-to-End Smoke Tests

Playwright tests cover the editor workflow (Add → Move → Rename → Undo → Redo → Persist).

Run tests (renderer only):

```powershell
npm install
npx playwright install --with-deps
npm run test:e2e
```

Test file: `tests/editor-smoke.spec.ts`

During tests the Electron process is not started; the renderer runs via Vite (`npm run dev:renderer`).
