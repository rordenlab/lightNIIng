import { expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { generateFigures, renderFigure } from "./figures.ts"

test("TSV metadata and starred rows become an attributed accent figure", () => {
  const svg = renderFigure(`# type: horizontal
# title: Example benchmark
# subtitle: Placeholder values
# source: https://example.org/benchmark
# unit: ms
Tool\tRuntime
Reference\t20
Candidate*\t8`)

  expect(svg).toContain("<title id=\"title\">Example benchmark</title>")
  expect(svg).not.toContain('href="https://example.org/benchmark"')
  expect(svg).not.toContain("SOURCE ↗")
  expect(svg).not.toContain("* highlighted in")
  expect(svg).not.toContain('class="legend"')
  expect(svg).toContain('height="560" viewBox="0 0 1200 560"')
  expect(svg).toContain('<g transform="translate(0 -30)">')
  expect(svg).toContain('class="label accent">Candidate</text>')
  expect(svg).toContain("var(--accent, #bf5700)")
  expect(svg).toContain("var(--fg-base, #f0f1ed)")
  expect(svg).toContain("var(--fg-muted, #9a9f9b)")
  expect(svg).toContain(
    "color-mix(in srgb, var(--accent, #bf5700) 20%, var(--bg-base, #0a0c0c))",
  )
  expect(svg).toContain(">8ms</text>")
  expect(svg).not.toContain("Candidate*")
})

test("renderer rejects unknown chart styles", () => {
  expect(() => renderFigure("# type: pie\nLabel\tValue\nA\t1")).toThrow("Unknown figure type")
})

test("unchanged TSV figures are not rewritten", async () => {
  const root = await mkdtemp(join(tmpdir(), "lightniing-figures-"))
  const project = join(root, "project")
  try {
    await mkdir(project)
    await Bun.write(join(project, "benchmark.tsv"), "Label\tValue\nReference\t20\nCandidate*\t8\n")
    await generateFigures(root, ["project"])
    const before = await stat(join(project, "benchmark.svg"))
    await generateFigures(root, ["project"])
    const after = await stat(join(project, "benchmark.svg"))
    expect(after.mtimeMs).toBe(before.mtimeMs)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
