import { readFile } from "node:fs/promises"
import { join } from "node:path"

const root = join(import.meta.dir, "..")
const source = join(root, "png2svg", "45.svg")
const output = join(root, "spatial_processing", "moco.svg")

const input = await readFile(source, "utf8")
const paths =
  input
    .match(/<path\b[^>]*\/>/g)
    ?.map((path) =>
      path
        .replace(/stroke="#010101"/g, 'stroke="currentColor"')
        .replace(/stroke-width="3.25"/g, 'stroke-width="var(--slice-stroke, 3.25)"'),
    )
    .join("\n") ?? ""

if (!paths) throw new Error("No paths found in png2svg/45.svg")

const colors = ["layer-1", "layer-2", "layer-3", "layer-4", "layer-5"]
const offsets = [
  { x: -9, y: 8, angle: -2.4 },
  { x: 8, y: -5, angle: 1.8 },
  { x: -4, y: -8, angle: -1.1 },
  { x: 10, y: 6, angle: 2.7 },
  { x: 0, y: 0, angle: 0 },
]

const image = { x: 128, y: 157, width: 394, height: 466 }
const leftCenter = { x: image.x + image.width / 2, y: image.y + image.height / 2 }
const rightImage = { ...image, x: 678 }

const misaligned = offsets
  .map(
    ({ x, y, angle }, index) =>
      `<use href="#axial-slice" x="${image.x}" y="${image.y}" width="${image.width}" height="${image.height}" class="volume ${colors[index]}" style="--slice-stroke:3.5" transform="translate(${x} ${y}) rotate(${angle} ${leftCenter.x} ${leftCenter.y})"/>`,
  )
  .join("\n")

// Wide-to-narrow strokes reveal every coincident volume as a nested contour.
// The final foreground line marks the shared anatomical centerline.
const alignedWidths = [15, 12, 9, 6, 3]
const aligned = alignedWidths
  .map(
    (width, index) =>
      `<use href="#axial-slice" x="${rightImage.x}" y="${rightImage.y}" width="${rightImage.width}" height="${rightImage.height}" class="volume ${colors[index]}" style="--slice-stroke:${width}"/>`,
  )
  .join("\n")

const legend = colors
  .map(
    (color, index) =>
      `<g transform="translate(${448 + index * 62} 662)"><circle r="5" class="${color}"/><text x="11" y="4" class="volume-label">V${index + 1}</text></g>`,
  )
  .join("")

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720" role="img" aria-labelledby="title desc">
  <title id="title">Motion correction</title>
  <desc id="desc">Five subtly translated and rotated axial images are realigned to a shared anatomical frame. Nested contour bands reveal all five coincident corrected volumes.</desc>
  <defs>
    <symbol id="axial-slice" viewBox="0 0 394 466">${paths}</symbol>
    <filter id="soft-glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
      <path d="M 0 0 L 8 4 L 0 8 Z" fill="var(--accent, #bf5700)"/>
    </marker>
  </defs>
  <style>
    :root { color: var(--fg-base, #f0f1ed); }
    text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill: var(--fg-base, #f0f1ed); }
    .title { font-size: 34px; font-weight: 650; letter-spacing: -.8px; }
    .subtitle { font-size: 17px; fill: var(--fg-muted, #a4aaa6); }
    .panel-title { font-size: 22px; font-weight: 650; }
    .panel-index { font: 650 14px ui-monospace, SFMono-Regular, monospace; fill: var(--accent, #bf5700); }
    .panel-note { font-size: 14px; fill: var(--fg-muted, #a4aaa6); }
    .panel-rule { stroke: color-mix(in srgb, var(--fg-muted, #a4aaa6) 28%, transparent); }
    .frame { fill: color-mix(in srgb, var(--accent, #bf5700) 4%, transparent); stroke: color-mix(in srgb, var(--fg-muted, #a4aaa6) 20%, transparent); }
    .volume { fill: none; opacity: .86; }
    .layer-1 { color: color-mix(in srgb, var(--accent, #bf5700) 88%, var(--fg-base, #f0f1ed)); fill: color-mix(in srgb, var(--accent, #bf5700) 88%, var(--fg-base, #f0f1ed)); }
    .layer-2 { color: color-mix(in srgb, var(--accent, #bf5700) 68%, var(--fg-base, #f0f1ed)); fill: color-mix(in srgb, var(--accent, #bf5700) 68%, var(--fg-base, #f0f1ed)); }
    .layer-3 { color: color-mix(in srgb, var(--accent, #bf5700) 48%, var(--fg-base, #f0f1ed)); fill: color-mix(in srgb, var(--accent, #bf5700) 48%, var(--fg-base, #f0f1ed)); }
    .layer-4 { color: color-mix(in srgb, var(--accent, #bf5700) 27%, var(--fg-base, #f0f1ed)); fill: color-mix(in srgb, var(--accent, #bf5700) 27%, var(--fg-base, #f0f1ed)); }
    .layer-5 { color: var(--fg-base, #f0f1ed); fill: var(--fg-base, #f0f1ed); opacity: .96; }
    .crosshair { fill: none; stroke: var(--fg-muted, #a4aaa6); stroke-width: 1; stroke-dasharray: 3 7; opacity: .28; }
    .target { fill: none; stroke: var(--accent, #bf5700); stroke-width: 1.5; opacity: .72; }
    .motion-vector { fill: none; stroke: var(--accent, #bf5700); stroke-width: 1.5; stroke-linecap: round; marker-end: url(#arrowhead); opacity: .76; }
    .registration-arrow { fill: none; stroke: var(--accent, #bf5700); stroke-width: 2.5; stroke-linecap: round; marker-end: url(#arrowhead); }
    .registration-label { font: 650 12px ui-monospace, SFMono-Regular, monospace; fill: var(--accent, #bf5700); letter-spacing: .04em; }
    .volume-label { font: 600 11px ui-monospace, SFMono-Regular, monospace; fill: var(--fg-muted, #a4aaa6); }
    .shared-center { fill: var(--accent, #bf5700); filter: url(#soft-glow); }
  </style>

  <rect width="1200" height="720" rx="18" fill="color-mix(in srgb, var(--accent, #bf5700) 20%, var(--bg-base, #0a0c0c))"/>
  <text x="76" y="62" class="title">Motion correction</text>
  <text x="77" y="91" class="subtitle">Rigid-body realignment places every volume in a common anatomical frame</text>

  <rect x="76" y="123" width="499" height="499" rx="12" class="frame"/>
  <rect x="625" y="123" width="499" height="499" rx="12" class="frame"/>

  <text x="98" y="157" class="panel-index">01</text>
  <text x="131" y="157" class="panel-title">Before realignment</text>
  <text x="131" y="181" class="panel-note">Head motion shifts each acquired volume</text>
  <line x1="98" y1="199" x2="553" y2="199" class="panel-rule"/>

  <text x="647" y="157" class="panel-index">02</text>
  <text x="680" y="157" class="panel-title">After rigid-body correction</text>
  <text x="680" y="181" class="panel-note">All volumes share one anatomical frame</text>
  <line x1="647" y1="199" x2="1102" y2="199" class="panel-rule"/>

  <g aria-label="Misaligned volumes">
    <line x1="${leftCenter.x}" y1="211" x2="${leftCenter.x}" y2="600" class="crosshair"/>
    <line x1="107" y1="${leftCenter.y}" x2="545" y2="${leftCenter.y}" class="crosshair"/>
    ${misaligned}
    <circle cx="${leftCenter.x}" cy="${leftCenter.y}" r="13" class="target"/>
    <circle cx="${leftCenter.x}" cy="${leftCenter.y}" r="3" class="target"/>
    <path d="M 237 305 Q 220 287 229 267" class="motion-vector"/>
    <path d="M 424 458 Q 448 470 458 449" class="motion-vector"/>
  </g>

  <g aria-label="Aligned volumes">
    <line x1="${leftCenter.x + 550}" y1="211" x2="${leftCenter.x + 550}" y2="600" class="crosshair"/>
    <line x1="656" y1="${leftCenter.y}" x2="1094" y2="${leftCenter.y}" class="crosshair"/>
    ${aligned}
    <circle cx="${leftCenter.x + 550}" cy="${leftCenter.y}" r="4" class="shared-center"/>
  </g>

  <path d="M 575 373 H 615" class="registration-arrow"/>
  <text x="595" y="351" text-anchor="middle" class="registration-label">REALIGN</text>

  <text x="429" y="667" text-anchor="end" class="panel-note">successive volumes</text>
  ${legend}
</svg>
`

await Bun.write(output, svg)
console.log(`Built ${output}`)
