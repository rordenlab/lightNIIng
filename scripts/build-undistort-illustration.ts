import { readFile } from "node:fs/promises"
import { join } from "node:path"

type Point = { x: number; y: number }

const root = join(import.meta.dir, "..")
const source = join(root, "png2svg", "45.svg")
const outlineSource = join(root, "png2svg", "45c.svg")
const output = join(root, "spatial_unwarping", "undistort.svg")
const input = await readFile(source, "utf8")
const outlineInput = await readFile(outlineSource, "utf8")

const n = (value: number) => Number(value.toFixed(2))

// Smooth phase-encoding deformation: the anterior lobe is expanded laterally,
// its center is displaced posteriorly, and the peripheral frontal surface is
// pulled anteriorly. Lower-amplitude terms gently bow the rest of the lattice.
function warp({ x, y }: Point): Point {
  const lateral = x - 197
  const anterior = Math.exp(-(((y - 108) / 88) ** 2))
  const posterior = Math.exp(-(((y - 388) / 82) ** 2))
  return {
    x: n(
      x +
        Math.tanh(lateral / 52) * 19 * anterior +
        Math.sin((y - 45) / 72) * Math.sin(lateral / 135) * 5,
    ),
    y: n(
      y +
        Math.cos(lateral / 58) * 19 * anterior +
        Math.sin(lateral / 64) * Math.exp(-(((y - 245) / 185) ** 2)) * 7 +
        Math.cos(lateral / 68) * posterior * 5,
    ),
  }
}

function transformPath(data: string) {
  const tokens = data.match(/[MLC]|-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?/gi) ?? []
  const output: string[] = []
  let cursor = 0
  while (cursor < tokens.length) {
    const command = tokens[cursor++]
    output.push(command)
    const points = command === "C" ? 3 : command === "M" || command === "L" ? 1 : 0
    if (!points) throw new Error(`Unsupported path command: ${command}`)
    for (let i = 0; i < points; i++) {
      const transformed = warp({ x: Number(tokens[cursor++]), y: Number(tokens[cursor++]) })
      output.push(String(transformed.x), String(transformed.y))
    }
  }
  return output.join(" ")
}

const sourcePaths = input.match(/<path\b[^>]*\/>/g) ?? []
if (!sourcePaths.length) throw new Error("No paths found in png2svg/45.svg")

const normalized = sourcePaths
  .map((path) =>
    path
      .replace(/stroke="#010101"/g, 'stroke="currentColor"')
      .replace(/stroke-width="3.25"/g, 'stroke-width="var(--slice-stroke, 3.25)"'),
  )
  .join("\n")

const distorted = sourcePaths
  .map((path) => {
    const data = path.match(/\bd="([^"]+)"/)?.[1]
    if (!data) return ""
    return path
      .replace(data, transformPath(data))
      .replace(/stroke="#010101"/g, 'stroke="currentColor"')
      .replace(/stroke-width="3.25"/g, 'stroke-width="var(--slice-stroke, 3.25)"')
  })
  .join("\n")

const outlinePath = outlineInput.match(/<path\b[^>]*\/>/)?.[0]
if (!outlinePath) throw new Error("No outer contour found in png2svg/45c.svg")
const outline = outlinePath
  .replace(/stroke="#010101"/g, 'stroke="currentColor"')
  .replace(/stroke-width="3.25"/g, 'stroke-width="var(--slice-stroke, 3.25)"')

const latticePath = (vertical: boolean, fixed: number) => {
  const samples: Point[] = []
  const count = 40
  for (let i = 0; i <= count; i++) {
    const variable = vertical ? 38 + (390 / count) * i : 45 + (304 / count) * i
    samples.push(warp(vertical ? { x: fixed, y: variable } : { x: variable, y: fixed }))
  }
  return `M ${samples.map((point) => `${point.x} ${point.y}`).join(" L ")}`
}

const verticals = [61, 129, 197, 265, 333]
const horizontals = [58, 142, 226, 310, 394]
const lattice = [
  ...verticals.map((x) => latticePath(true, x)),
  ...horizontals.map((y) => latticePath(false, y)),
]
  .map((data) => `<path d="${data}"/>`)
  .join("\n")

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720" role="img" aria-labelledby="title desc">
  <title id="title">Nonlinear spatial unwarping</title>
  <desc id="desc">A deformed coordinate lattice and accent-colored axial EPI image are corrected to an undistorted anatomical reference.</desc>
  <defs>
    <symbol id="axial-slice" viewBox="0 0 394 466">${normalized}</symbol>
    <symbol id="distorted-slice" viewBox="0 0 394 466">${distorted}</symbol>
    <symbol id="reference-outline" viewBox="0 0 394 466">${outline}</symbol>
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
    .lattice { fill: none; stroke: var(--accent, #bf5700); stroke-width: 1.25; opacity: .32; }
    .distorted { color: var(--accent, #bf5700); opacity: .96; }
    .reference { color: var(--fg-base, #f0f1ed); opacity: .48; stroke-dasharray: 1 8; }
    .corrected { color: var(--fg-base, #f0f1ed); opacity: .96; }
    .crosshair { fill: none; stroke: var(--fg-muted, #a4aaa6); stroke-width: 1; stroke-dasharray: 3 7; opacity: .25; }
    .correction-arrow { fill: none; stroke: var(--accent, #bf5700); stroke-width: 2.5; stroke-linecap: round; marker-end: url(#arrowhead); }
    .correction-label { font: 650 12px ui-monospace, SFMono-Regular, monospace; fill: var(--accent, #bf5700); letter-spacing: .04em; }
    .shared-center { fill: var(--accent, #bf5700); }
  </style>

  <rect width="1200" height="720" rx="18" fill="color-mix(in srgb, var(--accent, #bf5700) 20%, var(--bg-base, #0a0c0c))"/>
  <text x="76" y="62" class="title">Spatial unwarping</text>
  <text x="77" y="91" class="subtitle">A nonlinear deformation field restores EPI geometry to anatomical space</text>
  <rect x="76" y="123" width="499" height="499" rx="12" class="frame"/>
  <rect x="625" y="123" width="499" height="499" rx="12" class="frame"/>

  <text x="98" y="157" class="panel-index">01</text>
  <text x="131" y="157" class="panel-title">Distorted EPI geometry</text>
  <text x="131" y="181" class="panel-note">The lattice and anatomy share one deformation field</text>
  <line x1="98" y1="199" x2="553" y2="199" class="panel-rule"/>
  <text x="647" y="157" class="panel-index">02</text>
  <text x="680" y="157" class="panel-title">After nonlinear correction</text>
  <text x="680" y="181" class="panel-note">Corrected anatomy returns to reference space</text>
  <line x1="647" y1="199" x2="1102" y2="199" class="panel-rule"/>

  <g aria-label="Distorted anatomy and coordinate lattice">
    <g transform="translate(128 175)" class="lattice">${lattice}</g>
    <use href="#reference-outline" x="128" y="175" width="394" height="466" class="reference" style="--slice-stroke:3"/>
    <use href="#distorted-slice" x="128" y="175" width="394" height="466" class="distorted" style="--slice-stroke:3.5"/>
  </g>
  <g aria-label="Corrected anatomy">
    <line x1="875" y1="211" x2="875" y2="600" class="crosshair"/>
    <line x1="656" y1="408" x2="1094" y2="408" class="crosshair"/>
    <use href="#axial-slice" x="678" y="175" width="394" height="466" class="corrected" style="--slice-stroke:3.5"/>
    <circle cx="875" cy="408" r="4" class="shared-center"/>
  </g>
  <path d="M 575 373 H 615" class="correction-arrow"/>
  <text x="595" y="351" text-anchor="middle" class="correction-label">UNWARP</text>

  <g transform="translate(335 662)">
    <line x1="0" y1="0" x2="34" y2="0" class="lattice" opacity="1"/>
    <text x="45" y="4" class="panel-note">deformation lattice</text>
    <line x1="192" y1="0" x2="226" y2="0" stroke="var(--fg-base, #f0f1ed)" stroke-width="2" stroke-dasharray="1 7" opacity=".5"/>
    <text x="237" y="4" class="panel-note">undeformed outline</text>
  </g>
</svg>
`

await Bun.write(output, svg)
console.log(`Built ${output}`)
