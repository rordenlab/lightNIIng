import { readFile } from "node:fs/promises"
import { join } from "node:path"

const root = join(import.meta.dir, "..")
const sourceDirectory = join(root, "png2svg")
const output = join(root, "temporal_processing", "stc.svg")
const slices = [15, 25, 35, 45, 55, 65, 75]

const symbols = await Promise.all(
  slices.map(async (slice) => {
    const svg = await readFile(join(sourceDirectory, `${slice}.svg`), "utf8")
    const paths = svg
      .match(/<path\b[^>]*\/>/g)
      ?.map((path) => path.replace(/stroke="#010101"/g, 'stroke="currentColor"'))
      .join("\n") ?? ""
    if (!paths) throw new Error(`No paths found in ${slice}.svg`)
    return `<symbol id="slice-${slice}" viewBox="0 0 394 466">${paths}</symbol>`
  }),
)

const left = 178
const right = 1080
const middle = (left + right) / 2
const topPanel = { top: 156, bottom: 376 }
const bottomPanel = { top: 536, bottom: 780 }
const xAt = (index: number) => 278 + index * 116
const yAt = (panel: typeof topPanel, index: number) =>
  panel.bottom - 16 - (index / (slices.length - 1)) * (panel.bottom - panel.top - 32)

const axes = (panel: typeof topPanel, midpoint = false) => `
  <line x1="${left}" y1="${panel.bottom}" x2="${right}" y2="${panel.bottom}" class="axis"/>
  <path d="M ${right - 10} ${panel.bottom - 6} L ${right} ${panel.bottom} L ${right - 10} ${panel.bottom + 6}" class="axis"/>
  <line x1="${left}" y1="${panel.bottom}" x2="${left}" y2="${panel.top}" class="axis"/>
  <path d="M ${left - 6} ${panel.top + 10} L ${left} ${panel.top} L ${left + 6} ${panel.top + 10}" class="axis"/>
  <text x="${right}" y="${panel.bottom + 32}" text-anchor="end" class="axis-label">time</text>
  <text x="${left - 27}" y="${panel.top + 3}" text-anchor="end" class="axis-label">superior</text>
  <text x="${left - 27}" y="${panel.bottom + 5}" text-anchor="end" class="axis-label">inferior</text>
  ${midpoint ? `<line x1="${middle}" y1="${panel.top - 4}" x2="${middle}" y2="${panel.bottom}" class="reference"/>
  <text x="${middle}" y="${panel.bottom + 32}" text-anchor="middle" class="accent-label">middle timepoint</text>` : ""}
`

const topSlices = slices
  .map((slice, index) => {
    const x = xAt(index)
    const y = yAt(topPanel, index)
    return `
    <circle cx="${x}" cy="${y}" r="7" class="sample"/>
    <use href="#slice-${slice}" x="${x - 34}" y="${y - 40}" width="68" height="80" class="slice"/>
    <text x="${x + 40}" y="${y + 5}" class="slice-label">${slice}</text>`
  })
  .join("")

const originalTimes = slices
  .map((_, index) => {
    const x = xAt(index)
    const y = yAt(bottomPanel, index)
    const direction = x < middle ? 1 : -1
    const arrowEnd = middle - direction * 43
    return `
    <circle cx="${x}" cy="${y}" r="5" class="original-sample"/>
    <line x1="${x + direction * 8}" y1="${y}" x2="${arrowEnd}" y2="${y}" class="interpolation"/>
    <path d="M ${arrowEnd - direction * 8} ${y - 5} L ${arrowEnd} ${y} L ${arrowEnd - direction * 8} ${y + 5}" class="interpolation"/>`
  })
  .join("")

const correctedSlices = slices
  .map((slice, index) => {
    const y = yAt(bottomPanel, index)
    return `
    <circle cx="${middle}" cy="${y}" r="7" class="sample"/>
    <use href="#slice-${slice}" x="${middle - 25}" y="${y - 29.5}" width="50" height="59" class="slice"/>
    <text x="${middle + 35}" y="${y + 5}" class="slice-label">${slice}</text>`
  })
  .join("")

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="880" viewBox="0 0 1200 880" role="img" aria-labelledby="title desc">
  <title id="title">Slice timing correction</title>
  <desc id="desc">Sequential acquisition samples axial slices from inferior to superior at different times. Slice timing correction interpolates every slice to the middle acquisition time.</desc>
  <defs>
    ${symbols.join("\n")}
  </defs>
  <style>
    :root {
      color: var(--fg-base, #f0f1ed);
    }
    text {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      fill: var(--fg-base, #f0f1ed);
    }
    .title { font-size: 34px; font-weight: 650; letter-spacing: -.8px; }
    .subtitle { font-size: 17px; fill: var(--fg-muted, #a4aaa6); }
    .panel-title { font-size: 22px; font-weight: 650; }
    .panel-index { font: 650 14px ui-monospace, SFMono-Regular, monospace; fill: var(--accent, #bf5700); }
    .axis { fill: none; stroke: var(--fg-muted, #a4aaa6); stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
    .axis-label { font-size: 14px; fill: var(--fg-muted, #a4aaa6); }
    .slice { color: var(--fg-base, #f0f1ed); }
    .slice-label { font: 600 12px ui-monospace, SFMono-Regular, monospace; fill: var(--fg-muted, #a4aaa6); }
    .sequence { fill: none; stroke: var(--accent, #bf5700); stroke-width: 2.5; stroke-linecap: round; stroke-dasharray: 2 9; }
    .sample { fill: var(--accent, #bf5700); stroke: var(--bg-base, #0a0c0c); stroke-width: 3; }
    .reference { stroke: var(--accent, #bf5700); stroke-width: 2; stroke-dasharray: 5 7; opacity: .8; }
    .accent-label { font-size: 14px; font-weight: 650; fill: var(--accent, #bf5700); }
    .original-sample { fill: var(--fg-muted, #a4aaa6); opacity: .42; }
    .interpolation { fill: none; stroke: var(--accent, #bf5700); stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; opacity: .48; stroke-dasharray: 4 6; }
    .divider { stroke: color-mix(in srgb, var(--fg-muted, #a4aaa6) 28%, transparent); }
  </style>
  <rect width="1200" height="880" rx="18" fill="color-mix(in srgb, var(--accent, #bf5700) 20%, var(--bg-base, #0a0c0c))"/>

  <text x="76" y="62" class="title">Slice timing correction</text>
  <text x="77" y="91" class="subtitle">Aligning sequentially acquired slices to a common temporal reference</text>

  <text x="77" y="135" class="panel-index">01</text>
  <text x="110" y="135" class="panel-title">Sequential acquisition</text>
  ${axes(topPanel)}
  <path d="M ${xAt(0)} ${yAt(topPanel, 0)} L ${xAt(6)} ${yAt(topPanel, 6)}" class="sequence"/>
  ${topSlices}
  <text x="${xAt(0)}" y="${topPanel.bottom + 32}" text-anchor="middle" class="axis-label">start</text>
  <text x="${xAt(6)}" y="${topPanel.bottom + 32}" text-anchor="middle" class="axis-label">end of TR</text>

  <line x1="76" y1="455" x2="1124" y2="455" class="divider"/>

  <text x="77" y="515" class="panel-index">02</text>
  <text x="110" y="515" class="panel-title">After temporal interpolation</text>
  ${axes(bottomPanel, true)}
  ${originalTimes}
  ${correctedSlices}
  <text x="77" y="850" class="subtitle">Faint markers show the original acquisition times; arrows show interpolation to the shared reference time.</text>
</svg>
`

await Bun.write(output, svg.replace(/[ \t]+$/gm, ""))
console.log(`Built ${output}`)
