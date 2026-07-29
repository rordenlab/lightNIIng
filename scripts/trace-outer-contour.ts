import { resolve } from "node:path"
import { existsSync } from "node:fs"

type Point = { x: number; y: number }

const input = resolve(process.argv[2] ?? "png2svg/45x.svg")
const output = resolve(process.argv[3] ?? "png2svg/45c.svg")
const scale = 4
const bitmapFallback = input.replace(/x\.svg$/i, ".png")
const rasterSource = existsSync(bitmapFallback) ? bitmapFallback : input

const raster = Bun.spawnSync([
  "magick", "-background", "white", rasterSource, "-alpha", "remove",
  "-resize", `${scale * 100}%`, "-colorspace", "gray", "-threshold", "50%",
  "-depth", "8", "pgm:-",
])
if (raster.exitCode !== 0) throw new Error(new TextDecoder().decode(raster.stderr))

function parsePgm(bytes: Uint8Array) {
  let cursor = 0
  const token = () => {
    while (cursor < bytes.length && bytes[cursor] <= 32) cursor++
    const start = cursor
    while (cursor < bytes.length && bytes[cursor] > 32) cursor++
    return new TextDecoder().decode(bytes.subarray(start, cursor))
  }
  if (token() !== "P5") throw new Error("Expected binary PGM")
  const width = Number(token())
  const height = Number(token())
  const max = Number(token())
  if (bytes[cursor] <= 32) cursor++
  if (max !== 255) throw new Error(`Unsupported PGM maximum: ${max}`)
  return { width, height, pixels: bytes.subarray(cursor, cursor + width * height) }
}

const { width, height, pixels } = parsePgm(raster.stdout)
const center = { x: 197 * scale, y: 230 * scale }
const bins = 360
let radii = new Array<number>(bins).fill(0)
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    if (pixels[y * width + x] >= 128) continue
    const dx = x - center.x
    const dy = y - center.y
    const angle = (Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2)
    const bin = Math.floor((angle / (Math.PI * 2)) * bins) % bins
    radii[bin] = Math.max(radii[bin], Math.hypot(dx, dy))
  }
}
for (let i = 0; i < bins; i++) {
  if (radii[i]) continue
  for (let offset = 1; offset < bins; offset++) {
    const before = radii[(i - offset + bins) % bins]
    const after = radii[(i + offset) % bins]
    if (before || after) {
      radii[i] = before || after
      break
    }
  }
}
for (let pass = 0; pass < 3; pass++) {
  radii = radii.map((_, index) => {
    let sum = 0
    for (let offset = -4; offset <= 4; offset++)
      sum += radii[(index + offset + bins) % bins]
    return sum / 9
  })
}
const points: Point[] = []
for (let index = 0; index < bins; index += 4) {
  const angle = (index / bins) * Math.PI * 2
  points.push({
    x: (center.x + Math.cos(angle) * radii[index]) / scale,
    y: (center.y + Math.sin(angle) * radii[index]) / scale,
  })
}
const n = (value: number) => Number(value.toFixed(2))
const midpoint = (a: Point, b: Point) => ({ x: n((a.x + b.x) / 2), y: n((a.y + b.y) / 2) })
const first = midpoint(points.at(-1)!, points[0])
const commands = [`M ${first.x} ${first.y}`]
for (let i = 0; i < points.length; i++) {
  const end = midpoint(points[i], points[(i + 1) % points.length])
  commands.push(`Q ${n(points[i].x)} ${n(points[i].y)} ${end.x} ${end.y}`)
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="394" height="466" viewBox="0 0 394 466" role="img" aria-label="Single smoothed outer contour of an axial brain slice">
  <rect width="394" height="466" fill="#fff"/>
  <path d="${commands.join(" ")} Z" fill="none" stroke="#010101" stroke-width="3.25" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`
await Bun.write(output, svg)
console.log(`Traced ${points.length} control points to ${output}`)
