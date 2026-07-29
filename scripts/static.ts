/**
 * Shared static-file serving for the dev and preview servers: one MIME table
 * and one path resolver, so the two servers can't drift apart.
 *
 * `resolveFile` also keeps requests inside `dist/` — `..` segments (or a raw
 * client sending encoded ones) would otherwise let `join` escape the output
 * directory and serve arbitrary local files.
 */

import { extname, join, resolve, sep } from "node:path"
import type { BunFile } from "bun"

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".json": "application/json",
}

export type Resolved = { file: BunFile; type: string }

/**
 * Map a request pathname to a file inside `dist`, applying the directory-index
 * fallback (`/foo/` → `/foo/index.html`, extension-less → `.../index.html`).
 * Returns null for anything that doesn't exist or escapes `dist`.
 */
export async function resolveFile(dist: string, pathname: string): Promise<Resolved | null> {
  let rel: string
  try {
    rel = decodeURIComponent(pathname)
  } catch {
    return null // malformed percent-encoding
  }
  if (rel.endsWith("/")) rel += "index.html"

  const root = resolve(dist)
  const full = resolve(join(dist, rel))
  if (full !== root && !full.startsWith(root + sep)) return null // escaped dist/

  let file = Bun.file(full)
  if (!(await file.exists()) && !extname(rel)) file = Bun.file(join(full, "index.html"))
  if (!(await file.exists())) return null

  return { file, type: MIME[extname(file.name ?? rel)] ?? "application/octet-stream" }
}

/** The `404.html` response, mirroring how GitHub Pages serves missing paths. */
export async function notFoundResponse(dist: string): Promise<Response> {
  const nf = await resolveFile(dist, "/404.html")
  if (nf) return new Response(nf.file, { status: 404, headers: { "content-type": nf.type } })
  return new Response("Not found", { status: 404 })
}
