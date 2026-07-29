import { readFile } from "node:fs/promises"
import { basename, dirname, join } from "node:path"

type Point = { x: number; y: number }
type Segment =
  | { type: "L"; from: Point; to: Point }
  | { type: "C"; from: Point; c1: Point; c2: Point; to: Point }
type Chain = { segments: Segment[] }

const input = process.argv[2] ?? join(import.meta.dir, "..", "png2svg", "45x.svg")
const directory = dirname(input)
const stem = basename(input, ".svg").replace(/x$/i, "")
const source = await readFile(input, "utf8")

const point = (x: number, y: number): Point => ({ x, y })
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
const start = (chain: Chain) => chain.segments[0].from
const end = (chain: Chain) => chain.segments[chain.segments.length - 1].to

function parsePath(data: string): Chain {
  const tokens = data.match(/[MLC]|-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?/gi) ?? []
  const segments: Segment[] = []
  let cursor = 0
  let current = point(0, 0)
  while (cursor < tokens.length) {
    const command = tokens[cursor++]
    if (command === "M") {
      current = point(Number(tokens[cursor++]), Number(tokens[cursor++]))
    } else if (command === "L") {
      const to = point(Number(tokens[cursor++]), Number(tokens[cursor++]))
      segments.push({ type: "L", from: current, to })
      current = to
    } else if (command === "C") {
      const c1 = point(Number(tokens[cursor++]), Number(tokens[cursor++]))
      const c2 = point(Number(tokens[cursor++]), Number(tokens[cursor++]))
      const to = point(Number(tokens[cursor++]), Number(tokens[cursor++]))
      segments.push({ type: "C", from: current, c1, c2, to })
      current = to
    } else {
      throw new Error(`Unsupported path command: ${command}`)
    }
  }
  return { segments }
}

function reverse(chain: Chain): Chain {
  return {
    segments: [...chain.segments].reverse().map((segment) =>
      segment.type === "L"
        ? { type: "L", from: segment.to, to: segment.from }
        : {
            type: "C",
            from: segment.to,
            c1: segment.c2,
            c2: segment.c1,
            to: segment.from,
          },
    ),
  }
}

function length(chain: Chain) {
  return chain.segments.reduce((total, segment) => {
    if (segment.type === "L") return total + distance(segment.from, segment.to)
    return (
      total +
      distance(segment.from, segment.c1) +
      distance(segment.c1, segment.c2) +
      distance(segment.c2, segment.to)
    )
  }, 0)
}

const original = [...source.matchAll(/\bd="([^"]+)"/g)]
  .map((match) => parsePath(match[1]))
  .filter((chain) => chain.segments.length)

type Match = {
  index: number
  distance: number
  side: "start" | "end"
  reverseCandidate: boolean
}

function connect(tolerance: number, minimumLength: number, inputs = original) {
  const remaining = [...inputs].sort((a, b) => length(b) - length(a))
  const joined: Chain[] = []
  while (remaining.length) {
    let chain = remaining.shift()!
    while (true) {
      let nearest: Match | null = null
      for (let index = 0; index < remaining.length; index++) {
        const candidate = remaining[index]
        const options: Omit<Match, "index">[] = [
          { distance: distance(end(chain), start(candidate)), side: "end", reverseCandidate: false },
          { distance: distance(end(chain), end(candidate)), side: "end", reverseCandidate: true },
          { distance: distance(start(chain), end(candidate)), side: "start", reverseCandidate: false },
          { distance: distance(start(chain), start(candidate)), side: "start", reverseCandidate: true },
        ]
        for (const option of options) {
          if (option.distance <= tolerance && (!nearest || option.distance < nearest.distance))
            nearest = { index, ...option }
        }
      }
      if (!nearest) break
      let candidate = remaining.splice(nearest.index, 1)[0]
      if (nearest.reverseCandidate) candidate = reverse(candidate)
      if (nearest.side === "end") {
        const gap = distance(end(chain), start(candidate))
        if (gap > 0.05)
          chain.segments.push({ type: "L", from: end(chain), to: start(candidate) })
        chain.segments.push(...candidate.segments)
      } else {
        const gap = distance(end(candidate), start(chain))
        if (gap > 0.05)
          candidate.segments.push({ type: "L", from: end(candidate), to: start(chain) })
        chain = { segments: [...candidate.segments, ...chain.segments] }
      }
    }
    if (distance(start(chain), end(chain)) <= tolerance) {
      chain.segments.push({ type: "L", from: end(chain), to: start(chain) })
    }
    if (length(chain) >= minimumLength) joined.push(chain)
  }
  return joined.sort((a, b) => length(b) - length(a))
}

const number = (value: number) => Number(value.toFixed(2))
function pathData(chain: Chain) {
  const first = start(chain)
  const commands = [`M ${number(first.x)} ${number(first.y)}`]
  for (const segment of chain.segments) {
    if (segment.type === "L") {
      commands.push(`L ${number(segment.to.x)} ${number(segment.to.y)}`)
    } else {
      commands.push(
        `C ${number(segment.c1.x)} ${number(segment.c1.y)} ${number(segment.c2.x)} ${number(segment.c2.y)} ${number(segment.to.x)} ${number(segment.to.y)}`,
      )
    }
  }
  return commands.join(" ")
}

function document(chains: Chain[], label: string) {
  const paths = chains.map((chain) => `  <path d="${pathData(chain)}"/>`).join("\n")
  return `<svg xmlns="http://www.w3.org/2000/svg" width="394" height="466" viewBox="0 0 394 466" role="img" aria-label="${label}">
  <rect width="394" height="466" fill="#fff"/>
  <g fill="none" stroke="#010101" stroke-width="3.25" stroke-linecap="round" stroke-linejoin="round">
${paths}
  </g>
</svg>
`
}

const conservative = connect(1.9, 4)
const aggressive = connect(4.25, 14)

const outputs = [
  {
    path: join(directory, `${stem}a.svg`),
    content: document(conservative, "Conservatively connected axial line drawing"),
    count: conservative.length,
  },
  {
    path: join(directory, `${stem}b.svg`),
    content: document(aggressive, "Aggressively connected and cleaned axial line drawing"),
    count: aggressive.length,
  },
]

for (const output of outputs) {
  await Bun.write(output.path, output.content)
  console.log(`${basename(output.path)}: ${output.count} paths`)
}
