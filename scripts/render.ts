/**
 * Rendering helpers: the shared HTML shell (top bar, theme controls, footer)
 * and the Markdown → step-panels transform.
 *
 * Authoring convention (stays 100% GitHub-native Markdown):
 *   # Page title
 *   Intro paragraph(s) before the first `##` become the page lead.
 *   ## Requirements          → a plain prose panel
 *   ## 1. Do the thing       → a numbered STEP panel; a screenshot in the
 *   ...text...                 body floats into an alternating media column
 *   ![caption](shot.png)       with the translucent accent glow.
 *   > [!NOTE] ...            → a styled callout (GitHub alert syntax)
 */

import { marked, type Token, type Tokens } from "marked"
import config from "../site.config.ts"

// ------- small utils --------------------------------------------------------

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

type TokenList = Token[] & { links?: Record<string, { href: string; title?: string }> }

function renderTokens(tokens: Token[], links: TokenList["links"]): string {
  const list = tokens as TokenList
  list.links = links ?? {}
  return marked.parser(list)
}

/** A paragraph token that is nothing but image(s) (a "figure" line). */
function paragraphImages(tok: Token): Tokens.Image[] | null {
  if (tok.type !== "paragraph") return null
  const kids = (tok as Tokens.Paragraph).tokens ?? []
  const isImage = (k: Token): k is Tokens.Image => k.type === "image"
  const isBlank = (k: Token) => k.type === "text" && !k.raw.trim()
  if (kids.length === 0 || !kids.every((k) => isImage(k) || isBlank(k))) return null
  return kids.filter(isImage)
}

const ALERT_ICON: Record<string, string> = {
  NOTE: "ℹ",
  TIP: "✦",
  IMPORTANT: "★",
  WARNING: "▲",
  CAUTION: "▲",
}

/** Convert a GitHub `> [!NOTE]` alert blockquote into a callout, else null. */
function alertCallout(tok: Token): string | null {
  if (tok.type !== "blockquote") return null
  const raw = (tok as Tokens.Blockquote).raw
  const m = raw.match(/\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i)
  if (!m) return null
  // strip the leading `>` and the [!TYPE] marker, render the rest as prose
  const inner = raw
    .replace(/^\s*>\s?/gm, "")
    .replace(/\[!\w+\]\s*/i, "")
    .trim()
  const body = marked.parse(inner, { async: false }) as string
  return `<aside class="callout"><span class="callout__icon" aria-hidden="true">${ALERT_ICON[m[1].toUpperCase()]}</span><div>${body}</div></aside>`
}

// ------- Markdown → panels --------------------------------------------------

export type ParsedDoc = {
  title: string
  leadHtml: string
  panelsHtml: string
  /** Raw (un-escaped) hrefs of every image in the doc — for missing-file checks. */
  imageRefs: string[]
}

/**
 * Resolves an image href to its intrinsic pixel size, so the build can emit
 * `width`/`height` and the browser reserves the right box (no layout shift).
 * Injected by the caller — keeps this module free of filesystem access.
 */
export type DimResolver = (href: string) => { w: number; h: number; svg?: string } | null

export function mdToPanels(md: string, dims?: DimResolver): ParsedDoc {
  const tokens = marked.lexer(md) as TokenList
  const links = tokens.links

  // Collect every image href from the token pass (raw, before HTML-escaping) so
  // the caller can check files by their real names — covers lead and panels alike.
  const imageRefs: string[] = []
  marked.walkTokens(tokens, (t) => {
    if (t.type === "image") imageRefs.push((t as Tokens.Image).href)
  })

  let title = ""
  const leadTokens: Token[] = []
  type Section = { heading: Tokens.Heading; body: Token[] }
  const sections: Section[] = []
  let cur: Section | null = null

  for (const tok of tokens) {
    if (tok.type === "heading" && (tok as Tokens.Heading).depth === 1 && !title) {
      title = (tok as Tokens.Heading).text
      continue
    }
    if (tok.type === "heading" && (tok as Tokens.Heading).depth === 2) {
      cur = { heading: tok as Tokens.Heading, body: [] }
      sections.push(cur)
      continue
    }
    if (cur) cur.body.push(tok)
    else if (tok.type !== "space") leadTokens.push(tok)
  }

  const leadHtml = leadTokens.length ? renderTokens(leadTokens, links) : ""

  const panels = sections.map((sec, i) => renderSection(sec, links, i, dims))
  return { title, leadHtml, panelsHtml: panels.join("\n"), imageRefs }
}

function figureHtml(img: Tokens.Image, dims?: DimResolver): string {
  // marked already HTML-escapes image alt text (quotes included); href is not,
  // so only href needs escaping here — escaping the text again double-encodes.
  const d = dims?.(img.href)
  const size = d ? ` width="${d.w}" height="${d.h}"` : ""
  const isChart = /\.svg(?:$|[?#])/i.test(img.href)
  const figureClass = isChart ? "shot chart-shot" : "shot content-shot"
  const figureStyle =
    !isChart && d ? ` style="--content-image-width:${Math.min(d.w * 2, 960)}px"` : ""
  const media = d?.svg
    ? d.svg
        // External SVGs had isolated ID scopes. Once inline, remove the
        // repeated generated IDs and use the Markdown alt as the accessible
        // name so pages containing several charts remain valid.
        .replace(' aria-labelledby="title desc"', "")
        .replace(' id="title"', "")
        .replace(' id="desc"', "")
        .replace("<svg ", `<svg class="chart-svg" aria-label="${img.text || ""}" `)
    : `<span class="content-shot__media"><img src="${escapeHtml(img.href)}"${size} alt="${img.text || ""}" loading="lazy" decoding="async" /></span>`
  return `
      <figure class="${figureClass}"${figureStyle}>
        ${media}
        ${img.text ? `<figcaption>${img.text}</figcaption>` : ""}
      </figure>`
}
function headingHtml(value: string): string {
  if (/^what lightniing changes$/i.test(value.trim()))
    return 'what light<span class="brand-inline__accent">nii</span>ng changes'
  return escapeHtml(value)
}


function renderSection(
  sec: { heading: Tokens.Heading; body: Token[] },
  links: TokenList["links"],
  index: number,
  dims?: DimResolver,
): string {
  const stepMatch = sec.heading.text.match(/^(\d+)[.)]\s+(.*)$/)

  // Render the body in document order — prose and callouts stay interleaved
  // where the author put them. For a numbered step, the FIRST figure is pulled
  // out to the two-column media slot; any later figures stay inline.
  const parts: string[] = []
  let proseRun: Token[] = []
  const flush = () => {
    if (proseRun.length) {
      parts.push(renderTokens(proseRun, links))
      proseRun = []
    }
  }
  let mediaImg: Tokens.Image | null = null

  for (const tok of sec.body) {
    const imgs = paragraphImages(tok)
    if (imgs?.length) {
      let rest = imgs
      if (stepMatch && !mediaImg) {
        mediaImg = imgs[0]
        rest = imgs.slice(1)
      }
      if (rest.length) {
        flush()
        for (const img of rest) parts.push(figureHtml(img, dims))
      }
      continue
    }
    const callout = alertCallout(tok)
    if (callout) {
      flush()
      parts.push(callout)
      continue
    }
    proseRun.push(tok)
  }
  flush()
  const body = parts.join("\n")

  // Numbered step with a screenshot → two-column alternating layout.
  if (stepMatch && mediaImg) {
    const [, num, rest] = stepMatch
    return `
    <section class="step" id="step-${num}">
      <div class="step__body prose">
        <span class="step__num" aria-hidden="true">${num}</span>
        <h2>${escapeHtml(rest)}</h2>
        ${body}
      </div>
      <div class="step__media">${figureHtml(mediaImg, dims)}</div>
    </section>`
  }

  // Numbered step without a screenshot → full-width numbered prose.
  if (stepMatch) {
    const [, num, rest] = stepMatch
    return `
    <section class="panel step-plain" id="step-${num}">
      <div class="prose">
        <span class="step__num" aria-hidden="true">${num}</span>
        <h2>${escapeHtml(rest)}</h2>
        ${body}
      </div>
    </section>`
  }

  // Non-numbered heading (Requirements, etc.) → prose panel.
  return `
    <section class="panel" id="section-${index}">
      <div class="prose">
        <h2>${headingHtml(sec.heading.text)}</h2>
        ${body}
      </div>
    </section>`
}

// ------- HTML shell ---------------------------------------------------------

const SUN = `<svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`
const MOON = `<svg class="moon" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>`
export const ARROW = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`
const MAXIMIZE = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>`

const ACCENTS = ["orange", "sage", "garnet", "periwinkle", "violet", "indigo"]

// The floating nav ribbon (top-left): brand + three links. On the home page an
// accent "drawer" slides out of the ribbon's right edge to open the processing
// overview in the lightbox.
function topbar(base: string): string {
  const sep = '<span class="topbar__sep" aria-hidden="true">|</span>'
  const home = base === ""
  const peek = home
    ? `\n    <button class="topbar__peek" type="button" data-lightbox-src="${base}assets/overview.svg" data-lightbox-alt="Overview of the lightNIIng functional imaging workflow">${MAXIMIZE}<span>See Overview</span></button>`
    : ""
  return `
  <div class="topbar">
    <header class="topbar__panel">
      <a class="brand brand--lightniing" href="${base}index.html">light<span>nii</span>ng</a>
      ${sep}
      <a class="topnav-link" href="${base}index.html#projects">Projects</a>
      ${sep}
      <a class="topnav-link" href="${base}about/">About</a>
      ${sep}
      <a class="topnav-link" href="${base}index.html#tools">Source</a>
    </header>${peek}
  </div>`
}

// The floating controls tab (bottom-right): accent swatches + theme toggle.
function footer(): string {
  const swatches = ACCENTS.map(
    (a) =>
      `<button class="swatch swatch--${a}" data-accent="${a}" title="${a[0].toUpperCase() + a.slice(1)} accent" aria-label="${a} accent"></button>`,
  ).join("")
  return `
  <footer class="site-footer">
    <div class="controls">
      <div class="swatches" role="group" aria-label="Accent color">${swatches}</div>
      <button class="icon-btn" data-theme-toggle type="button" aria-label="Toggle dark mode">${SUN}${MOON}</button>
    </div>
  </footer>`
}

export const HEAD_THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('lightniing:theme')||'dark';document.documentElement.setAttribute('data-theme',t);var a=localStorage.getItem('lightniing:accent')||'${config.defaultAccent}';document.documentElement.setAttribute('data-accent',a);}catch(e){document.documentElement.setAttribute('data-theme','dark');document.documentElement.setAttribute('data-accent','${config.defaultAccent}');}})();`

export type LayoutOpts = {
  title: string
  description: string
  /** Relative prefix to site root: "" at root, "../" one level deep. */
  base: string
  /** Canonical path from the site root, no leading slash ("" home, "about/", "<slug>/"). */
  path: string
  main: string
  /** Optional extra markup injected into <head> (e.g. JSON-LD). */
  headExtra?: string
}

export function layout(o: LayoutOpts): string {
  const pageClass = o.path === "" ? "page-home" : o.path === "about/" ? "page-about" : "page-tutorial"
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(o.title)}</title>
<meta name="description" content="${escapeHtml(o.description)}" />
<meta name="color-scheme" content="light dark" />
<link rel="canonical" href="${config.siteUrl}/${o.path}" />
<meta property="og:title" content="${escapeHtml(o.title)}" />
<meta property="og:description" content="${escapeHtml(o.description)}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${config.siteUrl}/${o.path}" />
<meta property="og:image" content="${config.siteUrl}/assets/splash.png" />
<!-- dimensions track assets/splash.png (2194×1438); update if the splash is re-exported -->
<meta property="og:image:width" content="2194" />
<meta property="og:image:height" content="1438" />
<meta property="og:image:alt" content="The ${escapeHtml(config.title)} app" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="${config.siteUrl}/assets/splash.png" />
<link rel="icon" type="image/png" href="${o.base}assets/favicon.png" />
<link rel="stylesheet" href="${o.base}assets/site.css" />
<script>${HEAD_THEME_SCRIPT}</script>
${o.headExtra ?? ""}</head>
<body class="${pageClass}">
${topbar(o.base)}
<main>
${o.main}
</main>
${footer()}
<script src="${o.base}assets/theme.js" defer></script>
</body>
</html>`
}
