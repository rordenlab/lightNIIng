# lightNIIng

**NeuroImaging Infrastructure at the speed of light.**

This repository builds a static, Markdown-driven project site. Each project has
its own folder and `README.md`; `site.config.ts` controls navigation, summaries,
and the proven-tools index.

Figures are authored as TSV files and inserted from Markdown:

```md
<!-- figure-tsv: benchmark.tsv -->
```

Each TSV accepts `# type`, `# title`, `# subtitle`, `# source`, and `# unit`
metadata comments. Add `*` to a row label to render that item in the lightNIIng
accent. Supported chart types are `horizontal`, `vertical`, and `line`. Generated
SVGs are illustrative until their TSV values are replaced with measured data.

Standalone schema examples live in `examples/figure-line.tsv`,
`examples/figure-horizontal.tsv`, and `examples/figure-vertical.tsv`.

```bash
bun install
bun run dev
```

The visual system is intentionally related to the BIDSvue demos site.
