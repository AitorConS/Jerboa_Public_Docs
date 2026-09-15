# jerboa — public docs

Public documentation site for [jerboa](https://github.com/AitorConS/jerboa),
a unikernel engine for building, running, and orchestrating VM-based application images.

Built with [Astro](https://astro.build). Deployed to `https://docs.jerboa.dev`.
The landing site lives in the private `Jerboa_Docs` repo (`https://jerboa.dev`).

## Getting started

```bash
pnpm install
pnpm run dev
```

Open http://localhost:4321/.

## Documentation synchronization

`../jerboa/docs/*.md` (engine repo) is the source of truth. Edit those files,
then run `pnpm run docs:sync` here. The script adapts Jekyll frontmatter, links
and style annotations for Astro, and reads CLI/kernel versions from `VERSION.md`
and `kernel/VERSION`.

| Command           | Action                                              |
| ----------------- | --------------------------------------------------- |
| `pnpm run dev`    | Start the dev server at `localhost:4321`            |
| `pnpm run build`  | Build the production site to `./dist/`              |
| `pnpm run preview`| Preview the production build locally                |
| `pnpm run docs:sync` | Regenerate documentation from the Jerboa checkout |
| `pnpm run docs:check` | Fail if generated documentation differs         |

`dev` and `build` synchronize once before starting when the sibling checkout is
available. For another checkout location, set `JERBOA_SOURCE=/path/to/jerboa`.
Commit `src/pages/*.md` and `src/data/docs.json` together. Do not edit
these generated files directly. (`/` redirects to `/getting-started/`; the
engine's `index.md` is skipped by the sync.)

A standalone checkout builds using the committed snapshot when `../jerboa`
is absent.

## Structure

```
src/
  layouts/Base.astro       — html shell, fonts, global CSS
  layouts/Docs.astro       — documentation navigation, contents and typography
  components/
    Nav.astro              — header linking back to jerboa.dev
    Footer.astro           — site footer
    CodeBlock.astro        — terminal-style copyable code block
  pages/
    index.astro            — redirect to /getting-started/
    *.md                   — generated documentation pages
  data/docs.json          — generated navigation and source versions
  styles/global.css        — design tokens + shared classes
```
