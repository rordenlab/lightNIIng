import { readFile } from "node:fs/promises"
import { join } from "node:path"

type Point = { x: number; y: number }

const root = join(import.meta.dir, "..")
const output = join(root, "assets", "overview.svg")
const source = await readFile(join(root, "png2svg", "45.svg"), "utf8")
const outlineSource = await readFile(join(root, "png2svg", "45c.svg"), "utf8")
const dataUri = async (name: string) =>
  `data:image/png;base64,${(await readFile(join(root, "brain_extraction", "mindgrab-assets", name))).toString("base64")}`
const t1Base = await dataUri("T1-base.png")
const t1Active = await dataUri("T1-active.png")
const n = (value: number) => Number(value.toFixed(2))

function warp({ x, y }: Point): Point {
  const lateral = x - 197
  const anterior = Math.exp(-(((y - 108) / 88) ** 2))
  return {
    x: n(x + Math.tanh(lateral / 52) * 19 * anterior + Math.sin((y - 45) / 72) * Math.sin(lateral / 135) * 5),
    y: n(y + Math.cos(lateral / 58) * 19 * anterior + Math.sin(lateral / 64) * Math.exp(-(((y - 245) / 185) ** 2)) * 7),
  }
}

function transformPath(data: string) {
  const tokens = data.match(/[MLC]|-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?/gi) ?? []
  const result: string[] = []
  let cursor = 0
  while (cursor < tokens.length) {
    const command = tokens[cursor++]
    result.push(command)
    const count = command === "C" ? 3 : 1
    for (let index = 0; index < count; index++) {
      const next = warp({ x: Number(tokens[cursor++]), y: Number(tokens[cursor++]) })
      result.push(String(next.x), String(next.y))
    }
  }
  return result.join(" ")
}

const sourcePaths = source.match(/<path\b[^>]*\/>/g) ?? []
const normalize = (path: string) =>
  path
    .replace(/stroke="#010101"/g, 'stroke="currentColor"')
    .replace(/stroke-width="3.25"/g, 'stroke-width="var(--slice-stroke, 3.25)"')
const paths = sourcePaths.map(normalize).join("\n")
const warped = sourcePaths
  .map((path) => {
    const data = path.match(/\bd="([^"]+)"/)?.[1]
    return data ? normalize(path.replace(data, transformPath(data))) : ""
  })
  .join("\n")
const outline = normalize(outlineSource.match(/<path\b[^>]*\/>/)?.[0] ?? "")

const tile = (index: number, title: string, subtitle: string, x: number, y: number, body: string) => `
  <g transform="translate(${x} ${y})">
    <rect width="410" height="330" rx="12" class="tile"/>
    <text x="22" y="32" class="index">${String(index).padStart(2, "0")}</text>
    <text x="55" y="32" class="tile-title">${title}</text>
    <text x="55" y="55" class="tile-note">${subtitle}</text>
    <line x1="22" y1="73" x2="388" y2="73" class="rule"/>
    ${body}
  </g>`

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="860" viewBox="0 0 1400 860" role="img" aria-labelledby="title desc">
  <title id="title">Functional imaging processing overview</title>
  <desc id="desc">Six stages from functional image input through brain extraction, temporal and spatial correction, and anatomical coregistration.</desc>
  <defs>
    <symbol id="slice" viewBox="0 0 394 466">${paths}</symbol>
    <symbol id="warped-slice" viewBox="0 0 394 466">${warped}</symbol>
    <symbol id="outline" viewBox="0 0 394 466">${outline}</symbol>
    <mask id="brain-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="394" height="466" style="mask-type:alpha">
      <image href="${t1Active}" width="394" height="466"/>
    </mask>
    <filter id="gray"><feColorMatrix type="saturate" values="0"/></filter>
    <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill="var(--accent, #bf5700)"/></marker>
  </defs>
  <style>
    text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;fill:var(--fg-base,#f0f1ed)}
    .title{font-size:34px;font-weight:650;letter-spacing:-.8px}.subtitle{font-size:17px;fill:var(--fg-muted,#a4aaa6)}
    .tile{fill:color-mix(in srgb,var(--accent,#bf5700) 4%,transparent);stroke:color-mix(in srgb,var(--fg-muted,#a4aaa6) 22%,transparent)}
    .index{font:650 13px ui-monospace,SFMono-Regular,monospace;fill:var(--accent,#bf5700)}
    .tile-title{font-size:18px;font-weight:650}.tile-note{font-size:12px;fill:var(--fg-muted,#a4aaa6)}
    .rule{stroke:color-mix(in srgb,var(--fg-muted,#a4aaa6) 26%,transparent)}
    .fg{color:var(--fg-base,#f0f1ed)}.muted{color:var(--fg-muted,#a4aaa6);opacity:.58}.accent{color:var(--accent,#bf5700)}
    .accent-fill{fill:var(--accent,#bf5700)}.hairline{fill:none;stroke:var(--accent,#bf5700);stroke-width:1.4;opacity:.48}
    .dotted{stroke-dasharray:1 8;opacity:.42}.arrow{fill:none;stroke:var(--accent,#bf5700);stroke-width:2;marker-end:url(#arrow)}
  </style>
  <rect width="1400" height="860" rx="18" fill="color-mix(in srgb,var(--accent,#bf5700) 20%,var(--bg-base,#0a0c0c))"/>
  <text x="55" y="58" class="title">Functional imaging overview</text>
  <text x="56" y="87" class="subtitle">From acquired volume to anatomically aligned data</text>

  ${tile(1, "Input Functional Image", "A newly acquired EPI volume", 55, 115, `
    <use href="#slice" x="105" y="82" width="200" height="236" class="fg" style="--slice-stroke:3.6"/>
    <line x1="92" y1="200" x2="318" y2="200" class="hairline"/>
    <circle cx="205" cy="200" r="4" class="accent-fill"/>`)}

  ${tile(2, "Brain Extraction", "Retain brain; remove nonbrain tissue", 495, 115, `
    <g transform="translate(105 82) scale(.5)">
      <image href="${t1Base}" width="394" height="466" filter="url(#gray)" opacity=".78"/>
      <image href="${t1Active}" width="394" height="466" filter="url(#gray)" opacity=".88"/>
      <rect width="394" height="466" class="accent-fill" mask="url(#brain-mask)" style="mix-blend-mode:color"/>
    </g>`)}

  ${tile(3, "Slice Timing Correction", "Interpolate slices to a shared time", 935, 115, `
    <path d="M76 266 L334 118" class="arrow" opacity=".45"/>
    ${[0, 1, 2, 3, 4].map((i) => `<use href="#slice" x="${62 + i * 62}" y="${218 - i * 33}" width="72" height="85" class="${i === 2 ? "accent" : "fg"}" style="--slice-stroke:5"/>`).join("")}
    <line x1="205" y1="93" x2="205" y2="303" stroke="var(--accent,#bf5700)" stroke-dasharray="4 6" opacity=".7"/>`)}

  ${tile(4, "Head Motion Estimation", "Estimate rigid translation and rotation", 55, 475, `
    <g opacity=".72">${[
      [-7, 5, -2.2, "accent"], [7, -4, 1.8, "muted"], [-2, -6, -.8, "fg"],
    ].map(([dx,dy,a,c]) => `<use href="#slice" x="${105 + Number(dx)}" y="${82 + Number(dy)}" width="200" height="236" class="${c}" style="--slice-stroke:3.8" transform="rotate(${a} 205 200)"/>`).join("")}</g>
    <circle cx="205" cy="200" r="10" fill="none" stroke="var(--accent,#bf5700)" opacity=".8"/>`)}

  ${tile(5, "Image Undistortion", "Correct nonlinear EPI deformation", 495, 475, `
    ${[92,150,208,266,324].map((x) => `<path d="M${x} 92 Q${x + 12} 160 ${x} 218 T${x} 306" class="hairline"/>`).join("")}
    ${[112,170,228,286].map((y) => `<path d="M78 ${y} Q205 ${y - 18} 332 ${y}" class="hairline"/>`).join("")}
    <use href="#outline" x="105" y="82" width="200" height="236" class="fg dotted" style="--slice-stroke:4"/>
    <use href="#warped-slice" x="105" y="82" width="200" height="236" class="accent" style="--slice-stroke:4"/>`)}

  ${tile(6, "Linear Coregistration to Anatomical Scan", "Affine alignment to anatomical space", 935, 475, `
    <use href="#outline" x="105" y="82" width="200" height="236" class="fg dotted" style="--slice-stroke:4"/>
    <use href="#slice" x="113" y="76" width="200" height="236" class="accent" style="--slice-stroke:3.8" transform="rotate(2 213 194)"/>
    <path d="M82 290 H322" class="arrow"/>
    <circle cx="205" cy="200" r="4" class="accent-fill"/>`)}
</svg>
`

await Bun.write(output, svg.replace(/[ \t]+$/gm, ""))
console.log(`Built ${output}`)
