/**
 * Preview server: serves an already-built `dist/` with no watching or reload.
 * `bun run preview` builds first, then runs this — a faithful preview of what
 * GitHub Pages will serve.
 */

import { fileURLToPath } from "node:url"
import { notFoundResponse, resolveFile } from "./static.ts"

const DIST = fileURLToPath(new URL("../dist", import.meta.url))
const PORT = Number(process.env.PORT ?? 4173)

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const r = await resolveFile(DIST, new URL(req.url).pathname)
    if (!r) return notFoundResponse(DIST)
    return new Response(r.file, { headers: { "content-type": r.type } })
  },
})

console.log(`\n  ➜  Preview: http://localhost:${server.port}\n`)
