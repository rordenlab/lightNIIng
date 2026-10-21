# lightNIIng — agent notes

Static Markdown-driven site for lightniing.org. Bun + TypeScript, deps: `marked` only.

## Layout

- `site.config.ts` — site metadata, `projects` (sections: slug/title/summary/tags, in nav order), `tools` (proven-tools index).
- `<slug>/README.md` — one section page. `#` = title, text before first `##` = lead, each `##` = a panel. Local images/TSVs sit beside it; every file in the folder is copied to `dist/<slug>/`.
- `teams/<slug>/about.md` — team profile; source logos kept here too.
- `assets/` — css, js, images; `assets/teams/<slug>/` holds the served `logo.png` + `peak.{jpg,png}`.
- `scripts/build.ts` — builder (also home, about, teams, 404 pages; `TEAMS` list). `render.ts` Markdown→panels, `figures.ts` TSV→SVG, `dev.ts`, `preview.ts`, `static.ts`.
- `scripts/build-*-illustration.ts` — generate conceptual SVGs (e.g. `denoising/meica.svg`). Run manually; commit the output.
- `scripts/trace-*.ts`, `smooth-line-svg.ts`, `connect-svg-lines.ts` — one-off bitmap→SVG outline helpers (pass input paths as args).
- `examples/` — figure TSV schema samples. `todo/` — gitignored scratch.

## Commands

```bash
bun run dev        # temp build tree + live reload, :5173 (restart after editing site.config.ts)
bun run build      # dist/
bun run typecheck  # pre-commit hook runs this
bun test           # scripts/*.test.ts
```

CI (`.github/workflows/deploy.yml`): push to `main` → typecheck, test, build, deploy `dist/` to GitHub Pages (CNAME emitted by build).

## dist/

Build output, gitignored, never committed — CI builds it. `.asset-manifest.json` (also ignored) records hashes of `dist/assets`; the build refuses to overwrite files hand-edited in `dist/assets`. Edit `assets/` instead.

## How to

- **Section**: create `<slug>/README.md`, add an entry to `projects` in `site.config.ts`. Build fails on missing local images.
- **Tool**: add to `tools` in `site.config.ts`.
- **Team**: `teams/<slug>/about.md`, `assets/teams/<slug>/logo.png` + `peak.*`, entry in `TEAMS` in `scripts/build.ts` (logo pixel size).
- **Figure**: `<slug>/name.tsv`, reference with `<!-- figure-tsv: name.tsv -->`. Build regenerates `name.svg` beside it; commit both. Header comments `# type` (horizontal|vertical|line), `# title`, `# subtitle`, `# source`, `# unit`; then tab-separated header row and data rows. Trailing `*` on a label = accent highlight (use for lightNIIng tools).

## Content rules

- State each tool's license individually. Do not claim all tools are BSD/MIT (e.g. svht_denoise is MPL-2.0, meica is LGPL-2.1).
- Every benchmark chart needs a `# source` that lets readers reproduce it, or the text must say the inputs are unpublished.
- Subtitles say what is measured and which direction is better.
- Keep copy terse.

## Audit notes

Audit 2026-10-20 (response to external review: `audit_response.md`).

Done: per-tool license wording on About; ME-ICA chart uses the published cropped dataset; TSV rows must be complete; preview binds localhost; dev watches `teams/` and `examples/`; dead HERO_VARIANTS removed; shared `variantScript`/`tagChips`/`gridLines` helpers; `figures.ts` uses `escapeHtml`; unused `releasesUrl` removed.

Owner decisions (2026-10-21):
- `defaultAccent: "orange"` is intentional.
- High-res source images stay next to their downsampled versions (e.g. `teams/*/peak.*`, `brain_extraction/mindgrab-assets/`). Don't delete or move them.
- Removed: `mindgrab-asset/`; `build-{moco,overview,stc,undistort}-illustration.ts` (hard-wired to missing `png2svg/`; their SVGs are committed); dead `.hero__visual` home-hero CSS/JS (replaced by `about__radar`); its 12 images moved to gitignored `todo/unused/`.

Open:
- Tracing helpers take inputs as CLI args; their default paths (`png2svg/`, `ax.png`) don't exist. They duplicate PGM/RDP code.
- Optional simplifications: `buildIsolated` realpath guard, asset-manifest guard, `REPO` alias, `backArrow()`, duplicated hero-toggle button.
