import { resolve } from "node:path"

type Point = { x: number; y: number }
type Edge = { start: Point; end: Point; used: boolean }

const input = resolve(process.argv[2] ?? "ax.png")
const output = resolve(process.argv[3] ?? input.replace(/\.[^.]+$/, ".svg"))
const epsilon = Number(process.argv[4] ?? 4.5)

const raster = Bun.spawnSync([
  "magick",
  input,
  "-alpha",
  "off",
  "-colorspace",
  "gray",
  "-threshold",
  "50%",
  "-morphology",
  "Close",
  "Diamond:1",
  "pgm:-",
])
if (raster.exitCode !== 0) {
  throw new Error(new TextDecoder().decode(raster.stderr))
}

function parsePgm(bytes: Uint8Array) {
  let cursor = 0
  const token = () => {
    while (cursor < bytes.length) {
      if (bytes[cursor] === 35) {
        while (cursor < bytes.length && bytes[cursor++] !== 10) {}
      } else if (bytes[cursor] <= 32) cursor++
      else break
    }
    const start = cursor
    while (cursor < bytes.length && bytes[cursor] > 32) cursor++
    return new TextDecoder().decode(bytes.subarray(start, cursor))
  }
  if (token() !== "P5") throw new Error("Expected an 8-bit binary PGM image")
  const width = Number(token())
  const height = Number(token())
  const max = Number(token())
  while (bytes[cursor] <= 32) cursor++
  if (max !== 255) throw new Error(`Unsupported PGM maximum: ${max}`)
  return { width, height, pixels: bytes.subarray(cursor, cursor + width * height) }
}

const { width, height, pixels } = parsePgm(raster.stdout)
const white = (x: number, y: number) =>
  x >= 0 && y >= 0 && x < width && y < height && pixels[y * width + x] > 127
const key = (point: Point) => `${point.x},${point.y}`
const edges: Edge[] = []
const starts = new Map<string, number[]>()
const add = (start: Point, end: Point) => {
  const id = edges.push({ start, end, used: false }) - 1
  const ids = starts.get(key(start)) ?? []
  ids.push(id)
  starts.set(key(start), ids)
}

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    if (!white(x, y)) continue
    if (!white(x, y - 1)) add({ x, y }, { x: x + 1, y })
    if (!white(x + 1, y)) add({ x: x + 1, y }, { x: x + 1, y: y + 1 })
    if (!white(x, y + 1)) add({ x: x + 1, y: y + 1 }, { x, y: y + 1 })
    if (!white(x - 1, y)) add({ x, y: y + 1 }, { x, y })
  }
}

const contours: Point[][] = []
for (const first of edges) {
  if (first.used) continue
  const contour: Point[] = []
  let edge = first
  while (!edge.used) {
    edge.used = true
    contour.push(edge.start)
    const candidates = starts.get(key(edge.end)) ?? []
    const next = candidates.find((id) => !edges[id].used)
    if (next === undefined) break
    edge = edges[next]
  }
  if (contour.length >= 8) contours.push(contour)
}

const distanceToSegment = (point: Point, start: Point, end: Point) => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y)
  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)),
  )
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy))
}

function rdp(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) return points
  let farthest = 0
  let distance = 0
  for (let i = 1; i < points.length - 1; i++) {
    const next = distanceToSegment(points[i], points[0], points[points.length - 1])
    if (next > distance) {
      distance = next
      farthest = i
    }
  }
  if (distance <= tolerance) return [points[0], points[points.length - 1]]
  return [
    ...rdp(points.slice(0, farthest + 1), tolerance).slice(0, -1),
    ...rdp(points.slice(farthest), tolerance),
  ]
}

function simplifyClosed(points: Point[]) {
  let split = 1
  let farthest = 0
  for (let i = 1; i < points.length; i++) {
    const distance = Math.hypot(points[i].x - points[0].x, points[i].y - points[0].y)
    if (distance > farthest) {
      farthest = distance
      split = i
    }
  }
  const first = rdp(points.slice(0, split + 1), epsilon)
  const second = rdp([...points.slice(split), points[0]], epsilon)
  return [...first.slice(0, -1), ...second.slice(0, -1)]
}

const number = (value: number) => Number(value.toFixed(2))
const midpoint = (a: Point, b: Point) => ({
  x: number((a.x + b.x) / 2),
  y: number((a.y + b.y) / 2),
})
const path = contours
  .map(simplifyClosed)
  .filter((points) => points.length >= 3)
  .map((points) => {
    const start = midpoint(points[points.length - 1], points[0])
    const commands = [`M${start.x} ${start.y}`]
    for (let i = 0; i < points.length; i++) {
      const point = points[i]
      const end = midpoint(point, points[(i + 1) % points.length])
      commands.push(`Q${point.x} ${point.y} ${end.x} ${end.y}`)
    }
    return `${commands.join(" ")}Z`
  })
  .join(" ")

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Smoothed axial line tracing">
<rect width="${width}" height="${height}" fill="#000"/>
<path d="${path}" fill="#fff" fill-rule="evenodd"/>
</svg>
`

await Bun.write(output, svg)
console.log(`Traced ${contours.length} contours to ${output}`)
