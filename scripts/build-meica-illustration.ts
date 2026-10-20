// Generates denoising/meica.svg (TE dependence of BOLD vs non-BOLD components).
import { join } from "node:path"
const tes = [15.2, 35.32, 55.42]
const panels = [
  { x: 76, index: "01", title: "BOLD component", note: "Signal change grows with echo time: high κ, accepted",
    pct: (te: number) => te / 35.32, cls: "bold", tag: "ΔS/S = −TE · ΔR2*" },
  { x: 625, index: "02", title: "Non-BOLD component", note: "Signal change is flat across echoes: high ρ, rejected",
    pct: (_: number) => 1, cls: "nonbold", tag: "ΔS/S = ΔS0 / S0" },
]
const plot = { dx: 92, w: 360, y0: 540, h: 270 }
const body = panels.map((p) => {
  const ox = p.x + plot.dx
  const X = (te: number) => ox + (te / 60) * plot.w
  const Y = (pct: number) => plot.y0 - (pct / 2) * plot.h
  const ticks = [0, 20, 40, 60].map((t) => `<text x="${X(t)}" y="${plot.y0 + 26}" text-anchor="middle" class="tick">${t}</text>`).join("")
  const yticks = [0, 1, 2].map((v) => `<line x1="${ox}" y1="${Y(v)}" x2="${X(60)}" y2="${Y(v)}" class="grid"/><text x="${ox - 12}" y="${Y(v) + 5}" text-anchor="end" class="tick">${v}%</text>`).join("")
  const pts = tes.map((te) => `<circle cx="${X(te).toFixed(1)}" cy="${Y(p.pct(te)).toFixed(1)}" r="8" class="${p.cls}-dot"/>`).join("")
  return `
  <rect x="${p.x}" y="123" width="499" height="499" rx="12" class="frame"/>
  <text x="${p.x + 22}" y="157" class="panel-index">${p.index}</text>
  <text x="${p.x + 55}" y="157" class="panel-title">${p.title}</text>
  <text x="${p.x + 55}" y="181" class="panel-note">${p.note}</text>
  <line x1="${p.x + 22}" y1="199" x2="${p.x + 477}" y2="199" class="panel-rule"/>
  ${yticks}${ticks}
  <line x1="${ox}" y1="${plot.y0}" x2="${X(60)}" y2="${plot.y0}" class="axis"/>
  <line x1="${X(0)}" y1="${Y(p.pct(0))}" x2="${X(60)}" y2="${Y(p.pct(60))}" class="${p.cls}-fit"/>
  ${pts}
  <text x="${X(30)}" y="${plot.y0 + 56}" text-anchor="middle" class="axis-label">echo time (ms)</text>
  <text x="${ox + 8}" y="${Y(2) - 18}" class="formula">${p.tag}</text>`
}).join("")
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="660" viewBox="0 0 1200 660" role="img" aria-labelledby="title desc">
  <title id="title">Multi-echo component classification</title>
  <desc id="desc">Across three echoes, a BOLD component's percent signal change grows in proportion to echo time, while a non-BOLD component's is constant.</desc>
  <style>
    text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill: var(--fg-base, #f0f1ed); }
    .title { font-size: 34px; font-weight: 650; letter-spacing: -.8px; }
    .subtitle { font-size: 17px; fill: var(--fg-muted, #a4aaa6); }
    .panel-title { font-size: 22px; font-weight: 650; }
    .panel-index { font: 650 14px ui-monospace, SFMono-Regular, monospace; fill: var(--accent, #bf5700); }
    .panel-note, .axis-label { font-size: 14px; fill: var(--fg-muted, #a4aaa6); }
    .tick { font: 600 13px ui-monospace, SFMono-Regular, monospace; fill: var(--fg-muted, #a4aaa6); }
    .formula { font: 650 14px ui-monospace, SFMono-Regular, monospace; fill: var(--fg-base, #f0f1ed); }
    .panel-rule, .grid { stroke: color-mix(in srgb, var(--fg-muted, #a4aaa6) 28%, transparent); }
    .axis { stroke: var(--fg-muted, #a4aaa6); stroke-width: 1.5; }
    .frame { fill: color-mix(in srgb, var(--accent, #bf5700) 4%, transparent); stroke: color-mix(in srgb, var(--fg-muted, #a4aaa6) 20%, transparent); }
    .bold-fit { stroke: var(--accent, #bf5700); stroke-width: 4; stroke-linecap: round; }
    .bold-dot { fill: var(--accent, #bf5700); stroke: var(--bg-base, #0a0c0c); stroke-width: 3; }
    .nonbold-fit { stroke: var(--fg-muted, #a4aaa6); stroke-width: 3; stroke-dasharray: 2 8; stroke-linecap: round; }
    .nonbold-dot { fill: var(--fg-muted, #a4aaa6); stroke: var(--bg-base, #0a0c0c); stroke-width: 3; }
  </style>
  <text x="76" y="62" class="title">Multi-echo ICA</text>
  <text x="77" y="91" class="subtitle">Echo-time dependence separates BOLD signal from artifact (echoes at 15, 35 and 55 ms)</text>${body}
</svg>
`
await Bun.write(join(import.meta.dir, "..", "denoising", "meica.svg"), svg)
