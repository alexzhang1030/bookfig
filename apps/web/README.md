# bookfig web playground

Nuxt 4 editor for the `bookfig` library. Mermaid on the left, live blueprint-style preview on the right. Export SVG in the browser; PNG goes through the Node `/api/png` route so KaTeX fonts and CJK fonts match CLI output.

```bash
pnpm install
pnpm --filter web dev
```

The dev server listens on `http://127.0.0.1:43173`.
