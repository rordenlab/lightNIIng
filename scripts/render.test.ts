import { expect, test } from "bun:test"
import { mdToPanels } from "./render.ts"

test("prose and callouts keep document order", () => {
  const { panelsHtml } = mdToPanels(`# T
## Notes

para-A

> [!NOTE]
> note-X

para-B
`)
  const a = panelsHtml.indexOf("para-A")
  const n = panelsHtml.indexOf("note-X")
  const b = panelsHtml.indexOf("para-B")
  expect(a).toBeGreaterThanOrEqual(0)
  expect(a).toBeLessThan(n) // callout stays between the two paragraphs
  expect(n).toBeLessThan(b)
})

test("figure alt/caption are not double-escaped", () => {
  const { panelsHtml } = mdToPanels(`# T
## Sec

![the sidecar's field](x.png)
`)
  expect(panelsHtml).toContain(`alt="the sidecar&#39;s field"`)
  expect(panelsHtml).not.toContain("&amp;#39;")
})

test("figures get intrinsic width/height from the dimension resolver", () => {
  const { panelsHtml } = mdToPanels(
    `# T
## Sec

![shot](s.png)
`,
    () => ({ w: 800, h: 600 }),
  )
  expect(panelsHtml).toContain('width="800" height="600"')
  expect(panelsHtml).toContain('class="shot content-shot"')
  expect(panelsHtml).toContain('style="--content-image-width:960px"')
  expect(panelsHtml).toContain('class="content-shot__media"')
})

test("resolved SVG figures are inlined so theme tokens can cascade into charts", () => {
  const { panelsHtml } = mdToPanels(
    `# T
## Sec

![chart](chart.svg)
`,
    () => ({
      w: 1200,
      h: 680,
      svg: '<svg viewBox="0 0 1200 680" aria-labelledby="title desc"><title id="title">T</title><desc id="desc">D</desc><rect fill="var(--accent, #bf5700)"/></svg>',
    }),
  )
  expect(panelsHtml).toContain('class="chart-svg"')
  expect(panelsHtml).toContain('aria-label="chart"')
  expect(panelsHtml).toContain('fill="var(--accent, #bf5700)"')
  expect(panelsHtml).not.toContain('id="title"')
  expect(panelsHtml).not.toContain('aria-labelledby')
  expect(panelsHtml).not.toContain("<img")
})

test("a numbered step pulls its first figure into the media column", () => {
  const { panelsHtml } = mdToPanels(`# T
## 1. Do it

body-text

![shot](s.png)
`)
  expect(panelsHtml).toContain('class="step"')
  expect(panelsHtml).toContain('class="step__media"')
  expect(panelsHtml).toContain("body-text")
})

test("image references include lead and panel figures", () => {
  const { imageRefs } = mdToPanels(`# T

![lead](lead.png)

## 1. Do it

![step](step.png)
`)
  expect(imageRefs).toEqual(["lead.png", "step.png"])
})

test("the Web Apps Markdown list renders as the app directory", () => {
  const { panelsHtml } = mdToPanels(`# Web Apps
## Explore the apps

- [brain2print](https://brain2print.org/): Make printable brain meshes.
  _ITK-Wasm | niimath | NiiVue_
`)
  expect(panelsHtml).toContain('<ul class="webapp-directory">')
  expect(panelsHtml).toContain('<strong>brain2print</strong>')
  expect(panelsHtml).toContain('<small>ITK-Wasm | niimath | NiiVue</small>')
  expect(panelsHtml).not.toContain("<em>ITK-Wasm")
})

test("the core building-block list renders as compact linked chips", () => {
  const { panelsHtml } = mdToPanels(`# Web Apps
## Core building blocks

- [NiiVue](https://github.com/niivue/niivue) visualization of voxels and meshes.
`)
  expect(panelsHtml).toContain('<ul class="webapp-core">')
  expect(panelsHtml).toContain('<strong>NiiVue</strong>')
  expect(panelsHtml).toContain('<span>visualization of voxels and meshes.</span>')
})
