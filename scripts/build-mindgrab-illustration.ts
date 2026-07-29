import { readFile } from "node:fs/promises"
import { join } from "node:path"

const root = join(import.meta.dir, "..")
const assetDirectory = join(root, "brain_extraction", "mindgrab-assets")
const output = join(root, "brain_extraction", "mindgrab-pulse.svg")

const dataUri = async (name: string) =>
  `data:image/png;base64,${(await readFile(join(assetDirectory, name))).toString("base64")}`

const base = await dataUri("T1-base.png")
const active = await dataUri("T1-active.png")

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="640" viewBox="0 0 1200 640" role="img" aria-labelledby="title desc">
  <title id="title">MindGrab brain extraction</title>
  <desc id="desc">A grayscale axial head image remains visible while the extracted brain slowly pulses in the selected accent color.</desc>
  <defs>
    <filter id="grayscale" color-interpolation-filters="sRGB">
      <feColorMatrix type="saturate" values="0"/>
    </filter>
    <mask id="brain-alpha" maskUnits="userSpaceOnUse" x="403" y="128" width="394" height="466" style="mask-type:alpha">
      <image href="${active}" x="403" y="128" width="394" height="466"/>
    </mask>
  </defs>
  <style>
    text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill: var(--fg-base, #f0f1ed); }
    .title { font-size: 34px; font-weight: 650; letter-spacing: -.8px; }
    .subtitle { font-size: 17px; fill: var(--fg-muted, #a4aaa6); }
    .label { font: 650 12px ui-monospace, SFMono-Regular, monospace; letter-spacing: .08em; }
    .detail { font-size: 15px; fill: var(--fg-muted, #a4aaa6); }
    .accent { fill: var(--accent, #bf5700); }
    .rule { stroke: color-mix(in srgb, var(--fg-muted, #a4aaa6) 35%, transparent); stroke-width: 1; }
    .base-image { filter: url(#grayscale); opacity: .92; }
    .active-image { filter: url(#grayscale); }
    .active-layer { animation: brain-pulse 8s ease-in-out infinite; }
    .accent-wash { fill: var(--accent, #bf5700); mix-blend-mode: color; }
    .active-rule { stroke: var(--accent, #bf5700); stroke-width: 1.5; }
    @keyframes brain-pulse {
      0%, 100% { opacity: 0; }
      45%, 55% { opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce) {
      .active-layer { animation: none; opacity: .72; }
    }
  </style>

  <rect width="1200" height="640" rx="18" fill="color-mix(in srgb, var(--accent, #bf5700) 20%, var(--bg-base, #0a0c0c))"/>
  <text x="76" y="62" class="title">Brain extraction</text>
  <text x="77" y="91" class="subtitle">The retained brain pulses over the complete anatomical image</text>

  <g aria-label="Axial head image and extracted brain">
    <image href="${base}" x="403" y="128" width="394" height="466" class="base-image"/>
    <g class="active-layer">
      <image href="${active}" x="403" y="128" width="394" height="466" class="active-image"/>
      <rect x="403" y="128" width="394" height="466" class="accent-wash" mask="url(#brain-alpha)"/>
    </g>
  </g>

  <g transform="translate(840 252)">
    <line x1="-43" y1="0" x2="0" y2="0" class="rule"/>
    <text x="20" y="-5" class="label">BASE</text>
    <text x="20" y="20" class="detail">Anatomy and nonbrain tissue</text>
  </g>
  <g transform="translate(840 397)" class="active-layer">
    <line x1="-43" y1="0" x2="0" y2="0" class="active-rule"/>
    <text x="20" y="-5" class="label accent">ACTIVE</text>
    <text x="20" y="20" class="detail">Retained brain estimate</text>
  </g>

  <text x="77" y="588" class="label accent">MINDGRAB / SEGMENTATION</text>
  <line x1="77" y1="608" x2="1123" y2="608" class="rule"/>
</svg>
`

await Bun.write(output, svg)
console.log(`Built ${output}`)
