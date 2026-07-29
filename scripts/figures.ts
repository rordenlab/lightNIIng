import { readdir, readFile } from "node:fs/promises"
import { basename, dirname, extname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = fileURLToPath(new URL("..", import.meta.url))
// The fallback keeps generated files attractive when viewed directly (for
// example on GitHub); when the SVG is inlined into the site it inherits the
// currently selected theme accent.
const ACCENT = "var(--accent, #bf5700)"
const INK = "var(--fg-base, #f0f1ed)"
const MUTED = "var(--fg-muted, #9a9f9b)"
const GRID = "var(--border-strong, #303533)"
const BACKGROUND =
  "color-mix(in srgb, var(--accent, #bf5700) 20%, var(--bg-base, #0a0c0c))"

type ChartType = "horizontal" | "vertical" | "line"
type Figure = {
  type: ChartType
  title: string
  subtitle: string
  source: string
  unit: string
  headers: string[]
  rows: { label: string; highlighted: boolean; values: number[] }[]
}

const xml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")

function parseFigure(input: string): Figure {
  const lines = input.split(/\r?\n/).filter((line) => line.trim())
  const meta = new Map<string, string>()
  while (lines[0]?.startsWith("#")) {
    const match = lines.shift()!.match(/^#\s*([\w-]+)\s*:\s*(.*)$/)
    if (match) meta.set(match[1].toLowerCase(), match[2].trim())
  }
  const headers = lines.shift()?.split("\t").map((cell) => cell.trim()) ?? []
  if (headers.length < 2) throw new Error("Figure TSV requires a label column and at least one value column")
  const type = (meta.get("type") ?? "horizontal") as ChartType
  if (!["horizontal", "vertical", "line"].includes(type)) throw new Error(`Unknown figure type: ${type}`)
  const rows = lines.map((line) => {
    const cells = line.split("\t")
    const rawLabel = cells.shift()?.trim() ?? ""
    const highlighted = rawLabel.endsWith("*")
    const label = rawLabel.replace(/\*$/, "").trim()
    const values = cells.map((value) => Number(value))
    if (values.some((value) => !Number.isFinite(value))) throw new Error(`Non-numeric value in row: ${line}`)
    return { label, highlighted, values }
  })
  return {
    type,
    title: meta.get("title") ?? "Figure",
    subtitle: meta.get("subtitle") ?? "",
    source: meta.get("source") ?? "",
    unit: meta.get("unit") ?? "",
    headers: headers.slice(1).map((header) => header.replace(/\*$/, "")),
    rows,
  }
}

const text = (x: number, y: number, value: string, attrs = "") =>
  `<text x="${x}" y="${y}" ${attrs}>${xml(value)}</text>`

function horizontalChart(figure: Figure): string {
  const left = 290
  const top = 205
  const width = 790
  const rowGap = Math.min(74, 340 / Math.max(figure.rows.length, 1))
  const barHeight = Math.min(28, rowGap / Math.max(figure.headers.length, 1) - 4)
  const max = Math.max(...figure.rows.flatMap((row) => row.values), 1)
  const parts: string[] = []
  figure.rows.forEach((row, rowIndex) => {
    const center = top + rowIndex * rowGap
    parts.push(text(left - 22, center + 6, row.label, `text-anchor="end" class="label${row.highlighted ? " accent" : ""}"`))
    row.values.forEach((value, seriesIndex) => {
      const y = center - ((figure.headers.length - 1) * (barHeight + 4)) / 2 + seriesIndex * (barHeight + 4)
      const barWidth = (value / max) * width
      const color = row.highlighted ? ACCENT : seriesIndex === 0 ? "#69716d" : "#a8afab"
      parts.push(`<rect x="${left}" y="${y - barHeight / 2}" width="${barWidth}" height="${barHeight}" rx="3" fill="${color}"/>`)
      parts.push(text(left + barWidth + 10, y + 5, `${value}${figure.unit}`, `class="value${row.highlighted ? " accent" : ""}"`))
    })
  })
  return parts.join("")
}

function verticalChart(figure: Figure): string {
  const left = 115
  const top = 190
  const width = 970
  const height = 330
  const max = Math.max(...figure.rows.flatMap((row) => row.values), 1)
  const groupWidth = width / Math.max(figure.rows.length, 1)
  const barWidth = Math.min(54, (groupWidth - 22) / Math.max(figure.headers.length, 1))
  const parts: string[] = []
  for (let tick = 0; tick <= 4; tick++) {
    const y = top + height - (tick / 4) * height
    parts.push(`<line x1="${left}" y1="${y}" x2="${left + width}" y2="${y}" stroke="${GRID}" stroke-width="1"/>`)
  }
  figure.rows.forEach((row, rowIndex) => {
    const center = left + groupWidth * (rowIndex + 0.5)
    row.values.forEach((value, seriesIndex) => {
      const h = (value / max) * height
      const x = center - (figure.headers.length * barWidth) / 2 + seriesIndex * barWidth
      const color = row.highlighted ? ACCENT : seriesIndex === 0 ? "#69716d" : "#a8afab"
      parts.push(`<rect x="${x + 3}" y="${top + height - h}" width="${barWidth - 6}" height="${h}" rx="3" fill="${color}"/>`)
    })
    parts.push(text(center, top + height + 34, row.label, `text-anchor="middle" class="label${row.highlighted ? " accent" : ""}"`))
  })
  return parts.join("")
}

function lineChart(figure: Figure): string {
  const left = 115
  const top = 190
  const width = 970
  const height = 330
  const max = Math.max(...figure.rows.flatMap((row) => row.values), 1)
  const parts: string[] = []
  for (let tick = 0; tick <= 4; tick++) {
    const y = top + height - (tick / 4) * height
    parts.push(`<line x1="${left}" y1="${y}" x2="${left + width}" y2="${y}" stroke="${GRID}" stroke-width="1"/>`)
  }
  figure.headers.forEach((header, seriesIndex) => {
    const points = figure.rows.map((row, rowIndex) => {
      const x = left + (rowIndex / Math.max(figure.rows.length - 1, 1)) * width
      const y = top + height - (row.values[seriesIndex] / max) * height
      return { x, y, highlighted: row.highlighted }
    })
    const color = seriesIndex === figure.headers.length - 1 ? ACCENT : "#8d9691"
    parts.push(`<path d="M ${points.map((point) => `${point.x} ${point.y}`).join(" L ")}" fill="none" stroke="${color}" stroke-width="${seriesIndex === figure.headers.length - 1 ? 5 : 3}" stroke-linecap="round" stroke-linejoin="round"/>`)
    points.forEach((point) => parts.push(`<circle cx="${point.x}" cy="${point.y}" r="${point.highlighted ? 8 : 5}" fill="${point.highlighted ? ACCENT : color}" stroke="${BACKGROUND}" stroke-width="3"/>`))
  })
  figure.rows.forEach((row, rowIndex) => {
    const x = left + (rowIndex / Math.max(figure.rows.length - 1, 1)) * width
    parts.push(text(x, top + height + 34, row.label, `text-anchor="middle" class="label${row.highlighted ? " accent" : ""}"`))
  })
  return parts.join("")
}

export function renderFigure(input: string): string {
  const figure = parseFigure(input)
  const chart =
    figure.type === "horizontal"
      ? horizontalChart(figure)
      : figure.type === "vertical"
        ? verticalChart(figure)
        : lineChart(figure)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="560" viewBox="0 0 1200 560" role="img" aria-labelledby="title desc">
<title id="title">${xml(figure.title)}</title><desc id="desc">${xml(figure.subtitle)}</desc>
<rect width="1200" height="560" rx="18" fill="${BACKGROUND}"/>
<style>text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;fill:${INK}}.title{font-size:34px;font-weight:650;letter-spacing:-.8px}.subtitle{fill:${MUTED};font-size:17px}.label{font-size:17px;font-weight:600}.value{font:600 14px ui-monospace,SFMono-Regular,monospace}.accent{fill:${ACCENT}}</style>
${text(104, 70, figure.title, 'class="title"')}${text(105, 100, figure.subtitle, 'class="subtitle"')}<g transform="translate(0 -30)">${chart}</g>
</svg>\n`
}

export async function generateFigures(root = ROOT, directories?: string[]): Promise<string[]> {
  const generated: string[] = []
  const names =
    directories ??
    (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => entry.name)
  for (const name of names) {
    const directory = join(root, name)
    for (const file of await readdir(directory)) {
      if (extname(file) !== ".tsv") continue
      const inputPath = join(directory, file)
      const outputPath = join(directory, `${basename(file, ".tsv")}.svg`)
      const next = renderFigure(await readFile(inputPath, "utf8"))
      let current: string | null = null
      try {
        current = await readFile(outputPath, "utf8")
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
      }
      if (current !== next) await Bun.write(outputPath, next)
      generated.push(outputPath)
    }
  }
  return generated
}

if (import.meta.main) {
  const generated = await generateFigures()
  console.log(`✓ Generated ${generated.length} figures`)
}
