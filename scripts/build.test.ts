import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import config from "../site.config.ts"
import {
  ABOUT_RADAR_VARIANTS,
  TEAM_HERO_VARIANTS,
  aboutPage,
  build,
  buildIsolated,
  findMissingCssAssets,
  findMissingTutorialImages,
  findUnpromotedDistAssets,
  teamsPage,
} from "./build.ts"
import { layout } from "./render.ts"

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const DIST = join(ROOT, "dist")
const ASSET_MANIFEST = join(ROOT, ".asset-manifest.json")

// These guard the drift-prone generated metadata: a wrong canonical, a broken
// Teams link, or a repo-URL source-of-truth split would fail here rather than
// only surfacing live.

test("layout emits a correct per-page canonical + social card", () => {
  const html = layout({ title: "T", description: "D", base: "../", path: "teams/", main: "" })
  expect(html).toContain(`<link rel="canonical" href="${config.siteUrl}/teams/" />`)
  expect(html).toContain(`<meta property="og:url" content="${config.siteUrl}/teams/" />`)
  expect(html).toContain(`<meta property="og:image" content="${config.siteUrl}/assets/splash.png" />`)
  expect(html).toContain(`<meta name="twitter:card" content="summary_large_image" />`)
})

test("home canonical is the bare origin with no double slash", () => {
  const html = layout({ title: "T", description: "D", base: "", path: "", main: "" })
  expect(html).toContain(`<link rel="canonical" href="${config.siteUrl}/" />`)
  expect(html).toContain("localStorage.getItem('lightniing:theme')||'light'")
  expect(html).toContain(`localStorage.getItem('lightniing:accent')||'${config.defaultAccent}'`)
  expect(html).toContain(`data-lightbox-src="assets/overview.svg"`)
  expect(html).toContain("See Overview")
  expect(html).not.toContain("View NiiVue")
  expect(html).not.toContain(`href="index.html#tools">Source</a>`)
})

test("About presents lightNIIng's mission and commitments", () => {
  const html = aboutPage()
  expect(html).toContain("containerized environments like NeuroDesk")
  expect(html).toContain("Cross-Vendor GPU Acceleration")
  expect(html).toContain("Frictionless Community Collaboration")
  expect(html).toContain("Simplify, then add lightness")
  expect(html).toContain("- Colin Chapman")
  expect(html).toContain("About lightNIIng")
  expect(html).not.toContain('data-team-grid')
})

test("Teams presents the peer teams and their supplied profiles", () => {
  const html = teamsPage()
  expect(html).toContain("Independent teams")
  expect(html).toContain("shared purpose")
  expect(html).not.toContain('section--tools about-teams')
  expect(html).toContain("Independent teams")
  expect(html).toContain("collaboration of equal peers")
  expect(html).toContain('data-team-grid')
  expect(html).toContain(`data-team-hero-variants="${TEAM_HERO_VARIANTS.join(" ")}"`)
  expect(html).toContain("data-team-hero-toggle")
  expect(html).toContain("brainchop")
  expect(html).toContain("fideus labs")
  expect(html).toContain("Neurodesk")
  expect(html).toContain("NiiVue")
  expect(html).toContain("../assets/teams/neurodesk/logo-dark.png")
  expect(html).toContain("../assets/teams/fideus/logo.png")
  expect(html).not.toContain('type="image/svg+xml"')
  expect(html).toContain('data-lightbox-src="../assets/teams/brainchop/peak.jpg"')
  expect(html).toContain('data-lightbox-src="../assets/teams/neurodesk/peak.png"')
  expect(html).toContain("../assets/teams/brainchop/logo-transparent.png")
  expect(html).not.toContain('about-link__label">Funding')
})

test("About page embeds valid JSON-LD provenance", () => {
  const m = aboutPage().match(/<script type="application\/ld\+json">(.*?)<\/script>/s)
  expect(m).not.toBeNull()
  const data = JSON.parse(m![1])
  expect(data["@type"]).toBe("SoftwareApplication")
  expect(data.url).toBe(`${config.siteUrl}/`)
  expect(data.codeRepository).toBe(config.appUrl)
})

test("build emits the full generated-site contract (CNAME/robots/sitemap/404)", async () => {
  await build()
  const read = (p: string) => Bun.file(join(DIST, p)).text()

  // CNAME host derives from the single siteUrl source of truth
  expect((await read("CNAME")).trim()).toBe(new URL(config.siteUrl).host)

  expect(await read("robots.txt")).toContain(`Sitemap: ${config.siteUrl}/sitemap.xml`)

  const sitemap = await read("sitemap.xml")
  for (const path of ["", "about/", "teams/", ...config.projects.map((t) => `${t.slug}/`)]) {
    expect(sitemap).toContain(`<loc>${config.siteUrl}/${path}</loc>`)
  }

  const teams = await read("teams/index.html")
  expect(teams).toContain('href="../teams/" aria-current="page">Teams</a>')
  expect(teams).toContain(`<link rel="canonical" href="${config.siteUrl}/teams/" />`)
  const about = await read("about/index.html")
  expect(about).toContain('href="../about/" aria-current="page">About</a>')
  expect(about).toContain(`<link rel="canonical" href="${config.siteUrl}/about/" />`)

  const notFound = await read("404.html")
  expect(notFound).toContain('href="/"') // apex-root home link
  expect(notFound).toContain('name="robots" content="noindex"')

  expect(await Bun.file(join(DIST, ".asset-manifest.json")).exists()).toBe(false)
  const assetManifest = JSON.parse(await Bun.file(ASSET_MANIFEST).text()) as {
    version: number
    files: Record<string, string>
  }
  expect(assetManifest.version).toBe(1)
  expect(assetManifest.files["site.css"]).toMatch(/^[a-f0-9]{64}$/)

  const home = await read("index.html")
  expect(home).toContain("data-about-radar-variant")
  expect(home).toContain("data-radar-cycle-on-click")
  expect(home).toContain(JSON.stringify(ABOUT_RADAR_VARIANTS))
  expect(home).toContain(`data-radar-variants="${ABOUT_RADAR_VARIANTS.join(" ")}"`)
  const radarTag = home.match(/<div class="about__radar hero__about-radar"[^>]*>/)?.[0]
  expect(radarTag).toContain("data-radar-toggle")
  expect(radarTag).toContain('aria-hidden="true"')
  expect(radarTag).not.toMatch(/\s(?:role|tabindex)=/)
  for (const [index, tutorial] of config.projects.entries()) {
    expect(home).toContain(
      `<a href="${tutorial.slug}/index.html"><b>0${index + 1}</b> ${tutorial.title}</a>`,
    )
    const project = await read(`${tutorial.slug}/index.html`)
    expect(project).toContain("data-scanner-gallery")
    expect(project).toContain("../assets/scanners/BHC_3T-MRI-1_digital.jpg")
    expect(project).toContain("Click to show another photograph; hover to enlarge")
  }
  expect(await Bun.file(join(DIST, "assets", "scanners", "BHC_7T-MRI-5_digital.jpg")).exists()).toBe(
    true,
  )
})

test("asset guard protects dist-only changes until they are promoted", async () => {
  const root = await mkdtemp(join(tmpdir(), "lightniing-asset-guard-"))
  const source = join(root, "assets")
  const generated = join(root, "dist", "assets")
  const manifest = join(root, ".asset-manifest.json")

  try {
    await mkdir(source, { recursive: true })
    await mkdir(generated, { recursive: true })
    await Bun.write(join(source, "image.png"), "source-v1")
    await Bun.write(join(generated, "image.png"), "source-v1")
    expect(await findUnpromotedDistAssets(source, generated, manifest)).toEqual([])

    // A missing manifest means this may be stale generated output from another
    // checkout, so even a mismatch is safe on the first build.
    await Bun.write(join(generated, "image.png"), "improved-in-dist")
    expect(await findUnpromotedDistAssets(source, generated, manifest)).toEqual([])
    await Bun.write(join(generated, "stale-orphan.png"), "older-checkout")
    expect(await findUnpromotedDistAssets(source, generated, manifest)).toEqual([])
    await rm(join(generated, "stale-orphan.png"))

    const sourceHash = createHash("sha256").update("source-v1").digest("hex")
    await Bun.write(
      manifest,
      JSON.stringify({ version: 1, files: { "image.png": sourceHash } }),
    )
    expect(await findUnpromotedDistAssets(source, generated, manifest)).toEqual(["image.png"])

    await Bun.write(join(source, "image.png"), "improved-in-dist")
    expect(await findUnpromotedDistAssets(source, generated, manifest)).toEqual([])

    await Bun.write(join(generated, "dist-only.png"), "not-promoted")
    expect(await findUnpromotedDistAssets(source, generated, manifest)).toEqual(["dist-only.png"])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("isolated builds replace only their requested output tree", async () => {
  const output = await mkdtemp(join(tmpdir(), "lightniing-site-dev-"))
  const manifestFile = Bun.file(ASSET_MANIFEST)
  const manifestBefore = (await manifestFile.exists()) ? await manifestFile.text() : null
  try {
    await Bun.write(join(output, "stale.txt"), "remove me")
    await buildIsolated(output)
    expect(await Bun.file(join(output, "index.html")).exists()).toBe(true)
    expect(await Bun.file(join(output, "assets", "site.css")).exists()).toBe(true)
    expect(await Bun.file(join(output, "stale.txt")).exists()).toBe(false)
    const manifestAfter = (await manifestFile.exists()) ? await manifestFile.text() : null
    expect(manifestAfter).toBe(manifestBefore)
  } finally {
    await rm(output, { recursive: true, force: true })
  }
})

test("isolated builds recover an owned output tree that disappeared", async () => {
  const output = await mkdtemp(join(tmpdir(), "lightniing-site-dev-"))
  try {
    await rm(output, { recursive: true })
    await buildIsolated(output)
    expect(await Bun.file(join(output, "index.html")).exists()).toBe(true)
    expect(await Bun.file(join(output, "assets", "site.css")).exists()).toBe(true)
  } finally {
    await rm(output, { recursive: true, force: true })
  }
})

test("isolated builds reject output outside the temporary directory", async () => {
  const outside = await mkdtemp(join(ROOT, ".lightniing-build-guard-"))
  try {
    await Bun.write(join(outside, "keep.txt"), "keep me")
    await expect(buildIsolated(outside)).rejects.toThrow(
      "Isolated build output must be an owned dev temporary directory",
    )
    expect(await Bun.file(join(outside, "keep.txt")).text()).toBe("keep me")
  } finally {
    await rm(outside, { recursive: true, force: true })
  }
})

test("isolated builds reject unrelated temporary directories", async () => {
  const unrelated = await mkdtemp(join(tmpdir(), "lightniing-unrelated-"))
  try {
    await Bun.write(join(unrelated, "keep.txt"), "keep me")
    await expect(buildIsolated(unrelated)).rejects.toThrow(
      "Isolated build output must be an owned dev temporary directory",
    )
    expect(await Bun.file(join(unrelated, "keep.txt")).text()).toBe("keep me")
  } finally {
    await rm(unrelated, { recursive: true, force: true })
  }
})

test("isolated builds reject temporary symlinks that escape to the repository", async () => {
  const target = await mkdtemp(join(ROOT, ".lightniing-build-target-"))
  const escape = await mkdtemp(join(tmpdir(), "lightniing-site-dev-"))
  try {
    await Bun.write(join(target, "keep.txt"), "keep me")
    await rm(escape, { recursive: true })
    await symlink(target, escape, "dir")
    await expect(buildIsolated(escape)).rejects.toThrow(
      "Isolated build output must be an owned dev temporary directory",
    )
    expect(await Bun.file(join(target, "keep.txt")).text()).toBe("keep me")
  } finally {
    await rm(escape, { recursive: true, force: true })
    await rm(target, { recursive: true, force: true })
  }
})

test("CSS asset guard reports missing local url references", async () => {
  const root = await mkdtemp(join(tmpdir(), "lightniing-css-assets-"))
  try {
    await Bun.write(join(root, "site.css"), '.a { background: url("present.png") }\n.b { mask: url(missing.png) }')
    await Bun.write(join(root, "present.png"), "present")
    expect(await findMissingCssAssets(join(root, "site.css"), root)).toEqual(["missing.png"])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("tutorial image guard reports missing local references and permits remote images", async () => {
  const root = await mkdtemp(join(tmpdir(), "lightniing-tutorial-assets-"))
  const tutorial = join(root, "example")
  try {
    await mkdir(tutorial, { recursive: true })
    await Bun.write(
      join(tutorial, "README.md"),
      "# Example\n\n![Present](present.png)\n\n![Missing](missing.png)\n\n![Remote](https://example.com/remote.png)\n",
    )
    await Bun.write(join(tutorial, "present.png"), "present")
    expect(await findMissingTutorialImages([{ slug: "example" }], root)).toEqual([
      "example/missing.png",
    ])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("landing hero uses every configured radar asset pair", async () => {
  const css = await Bun.file(join(ROOT, "assets", "site.css")).text()
  const pngInfo = async (path: string) => {
    const bytes = Buffer.from(await Bun.file(path).arrayBuffer())
    expect(bytes.length).toBeGreaterThanOrEqual(26)
    expect(bytes.readUInt32BE(0)).toBe(0x89504e47)
    return {
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
      colorType: bytes[25],
    }
  }

  for (const id of ABOUT_RADAR_VARIANTS) {
    const baseName = `rq-${id}-base.png`
    const activeName = `rq-${id}-active.png`
    const basePath = join(ROOT, "assets", baseName)
    const activePath = join(ROOT, "assets", activeName)
    expect(css).toContain(`url("${baseName}")`)
    expect(css).toContain(`url("${activeName}")`)
    expect(await Bun.file(basePath).exists()).toBe(true)
    expect(await Bun.file(activePath).exists()).toBe(true)

    const base = await pngInfo(basePath)
    const active = await pngInfo(activePath)
    expect({ width: active.width, height: active.height }).toEqual({
      width: base.width,
      height: base.height,
    })
    expect([2, 4, 6]).toContain(active.colorType) // RGB mask, grayscale+alpha, or RGBA
  }
})

test("About randomizes and cycles accent-tinted scientific image outlines", async () => {
  const html = aboutPage()
  const css = await Bun.file(join(ROOT, "assets", "site.css")).text()
  expect(html).toContain(`data-team-hero-variants="${TEAM_HERO_VARIANTS.join(" ")}"`)
  expect(html).toContain("data-team-hero-toggle")
  expect(css).toContain('mask: var(--team-hero-mask) center / contain no-repeat')
  for (const variant of TEAM_HERO_VARIANTS) {
    const asset = Bun.file(
      join(ROOT, "assets", "teams", `hero-${variant}${variant === "walnut" ? "-outline" : "-axial-outline"}.png`),
    )
    expect(await asset.exists()).toBe(true)
    // Grayscale + alpha: mask intensity lives in alpha, so accent color only
    // appears along the extracted image contours instead of as a solid block.
    const bytes = Buffer.from(await asset.arrayBuffer())
    expect([0, 3, 4, 6]).toContain(bytes[25])
  }
})
