import { resolve } from "node:path"

type Point = { x: number; y: number }

const input = resolve(process.argv[2] ?? "axN.svg")
const output = resolve(process.argv[3] ?? input.replace(/\.svg$/i, "-smoothed.svg"))
const strokeWidth = Number(process.argv[4] ?? 3.25)
const tolerance = Number(process.argv[5] ?? 1.35)
const maximumPaths = Number(process.argv[6] ?? Number.POSITIVE_INFINITY)
const tracingScale = Number(process.argv[7] ?? 4)

const raster = Bun.spawnSync([
  "magick",
  "-background",
  "white",
  input,
  "-alpha",
  "remove",
  "-resize",
  `${tracingScale * 100}%`,
  "-colorspace",
  "gray",
  "-threshold",
  "50%",
  "-negate",
  "-morphology",
  "Thinning",
  "Skeleton",
  "-depth",
  "8",
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
  // The binary payload may legitimately begin with zero-valued pixels.
  if (bytes[cursor] === 13 && bytes[cursor + 1] === 10) cursor += 2
  else if (bytes[cursor] <= 32) cursor++
  if (max !== 255) throw new Error(`Unsupported PGM maximum: ${max}`)
  return { width, height, pixels: bytes.subarray(cursor, cursor + width * height) }
}

const { width, height, pixels } = parsePgm(raster.stdout)
const foreground = (x: number, y: number) =>
  x >= 0 && y >= 0 && x < width && y < height && pixels[y * width + x] > 127
const id = (x: number, y: number) => y * width + x
const point = (node: number): Point => ({
  x: (node % width) / tracingScale,
  y: Math.floor(node / width) / tracingScale,
})
const graph = new Map<number, number[]>()

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    if (!foreground(x, y)) continue
    const neighbors: number[] = []
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if ((dx === 0 && dy === 0) || !foreground(x + dx, y + dy)) continue
        // Do not add a diagonal shortcut beside an existing orthogonal connection.
        if (dx !== 0 && dy !== 0 && (foreground(x + dx, y) || foreground(x, y + dy))) continue
        neighbors.push(id(x + dx, y + dy))
      }
    }
    graph.set(id(x, y), neighbors)
  }
}

const edgeKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`)
const used = new Set<string>()
const lines: Point[][] = []

function walk(start: number, next: number) {
  const nodes = [start]
  let previous = start
  let current = next
  used.add(edgeKey(previous, current))
  while (true) {
    nodes.push(current)
    const candidates = (graph.get(current) ?? []).filter(
      (candidate) => candidate !== previous && !used.has(edgeKey(current, candidate)),
    )
    if (candidates.length === 0) break
    const before = point(previous)
    const here = point(current)
    // At a junction, keep the path that changes direction least. Any unused
    // branches are picked up as separate paths in the following pass.
    candidates.sort((a, b) => {
      const pa = point(a)
      const pb = point(b)
      const score = (p: Point) =>
        ((here.x - before.x) * (p.x - here.x) + (here.y - before.y) * (p.y - here.y)) /
        Math.max(1, Math.hypot(p.x - here.x, p.y - here.y))
      return score(pb) - score(pa)
    })
    previous = current
    current = candidates[0]
    used.add(edgeKey(previous, current))
  }
  return nodes.map(point)
}

for (const [node, neighbors] of graph) {
  if (neighbors.length !== 1) continue
  for (const neighbor of neighbors) {
    if (!used.has(edgeKey(node, neighbor))) lines.push(walk(node, neighbor))
  }
}
for (const [node, neighbors] of graph) {
  for (const neighbor of neighbors) {
    if (!used.has(edgeKey(node, neighbor))) lines.push(walk(node, neighbor))
  }
}

const distanceToSegment = (p: Point, a: Point, b: Point) => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

function rdp(points: Point[]): Point[] {
  if (points.length <= 2) return points
  let split = 0
  let farthest = 0
  for (let i = 1; i < points.length - 1; i++) {
    const distance = distanceToSegment(points[i], points[0], points[points.length - 1])
    if (distance > farthest) {
      farthest = distance
      split = i
    }
  }
  if (farthest <= tolerance) return [points[0], points[points.length - 1]]
  return [...rdp(points.slice(0, split + 1)).slice(0, -1), ...rdp(points.slice(split))]
}

const n = (value: number) => Number(value.toFixed(2))
const paths = lines
  .filter((line) => line.length >= 4)
  .map(rdp)
  .filter((line) => line.length >= 2)
  .slice(0, maximumPaths)
  .map((line) => {
    if (line.length === 2) return `M ${line[0].x} ${line[0].y} L ${line[1].x} ${line[1].y}`
    const commands = [`M ${line[0].x} ${line[0].y}`]
    for (let i = 0; i < line.length - 1; i++) {
      const p0 = line[Math.max(0, i - 1)]
      const p1 = line[i]
      const p2 = line[i + 1]
      const p3 = line[Math.min(line.length - 1, i + 2)]
      commands.push(
        `C ${n(p1.x + (p2.x - p0.x) / 6)} ${n(p1.y + (p2.y - p0.y) / 6)} ` +
          `${n(p2.x - (p3.x - p1.x) / 6)} ${n(p2.y - (p3.y - p1.y) / 6)} ${p2.x} ${p2.y}`,
      )
    }
    return commands.join(" ")
  })
  .map(
    (d) =>
      `  <path d="${d}" fill="none" stroke="#010101" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`,
  )
  .join("\n")

const outputWidth = width / tracingScale
const outputHeight = height / tracingScale
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${outputWidth}" height="${outputHeight}" viewBox="0 0 ${outputWidth} ${outputHeight}" role="img" aria-label="Smoothed axial line drawing">
  <rect width="${outputWidth}" height="${outputHeight}" fill="#fff"/>
${paths}
</svg>
`

await Bun.write(output, svg)
console.log(`Smoothed ${lines.length} centerlines to ${output}`)
