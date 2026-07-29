/**
 * Dev server: builds the site into an isolated temporary tree, serves it on the
 * first available port from http://localhost:5173, and live-reloads the browser
 * whenever a Markdown file or an asset changes. (Editing `site.config.ts` needs a restart — build.ts
 * caches the import.) Run `bun run dev`. An explicit PORT remains strict.
 */

import { existsSync, readdirSync, rmSync, statSync, watch } from "node:fs"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import config from "../site.config.ts"
import { buildIsolated } from "./build.ts"
import { notFoundResponse, resolveFile } from "./static.ts"

const ROOT = fileURLToPath(new URL("..", import.meta.url))
// Each process gets an isolated generated tree. This preserves fallback ports
// without letting concurrent dev servers destructively rebuild the same dist/.
const SERVE_ROOT = await mkdtemp(join(tmpdir(), "lightniing-site-dev-"))
const removeServeRoot = () => rmSync(SERVE_ROOT, { recursive: true, force: true })
process.once("exit", removeServeRoot)
const cleanupAndExit = (code: number) => {
  removeServeRoot()
  process.exit(code)
}
for (const [signal, code] of [["SIGHUP", 129], ["SIGINT", 130], ["SIGTERM", 143]] as const) {
  process.once(signal, () => cleanupAndExit(code))
}
const DEFAULT_PORT = 5173
const MAX_FALLBACK_ATTEMPTS = 20
const hasExplicitPort = process.env.PORT !== undefined && process.env.PORT !== ""
const preferredPort = hasExplicitPort ? Number(process.env.PORT) : DEFAULT_PORT

if (!Number.isInteger(preferredPort) || preferredPort < 0 || preferredPort > 65_535) {
  throw new Error(`Invalid PORT: ${process.env.PORT}`)
}

const RELOAD_SNIPPET = `
<script>
(function(){
  var es = new EventSource("/__livereload");
  es.onmessage = function(){ location.reload(); };
  es.onerror = function(){ /* server restarting; browser retries automatically */ };
})();
</script>`

const clients = new Set<ReadableStreamDefaultController>()
const encoder = new TextEncoder()

function notifyReload() {
  for (const c of clients) {
    try {
      c.enqueue(encoder.encode("data: reload\n\n"))
    } catch {
      clients.delete(c)
    }
  }
}

await buildIsolated(SERVE_ROOT)

function startServer(port: number) {
  return Bun.serve({
    hostname: "localhost",
    port,
    // The live-reload stream is a long-lived, mostly-silent response; without
    // this Bun closes it after 10s (a noisy warning + needless reconnects).
    idleTimeout: 0,
    async fetch(req) {
      const url = new URL(req.url)

      // Live-reload event stream.
      if (url.pathname === "/__livereload") {
        let self: ReadableStreamDefaultController
        const stream = new ReadableStream({
          start(controller) {
            self = controller
            clients.add(controller)
          },
          cancel() {
            clients.delete(self)
          },
        })
        return new Response(stream, {
          headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-cache",
            connection: "keep-alive",
          },
        })
      }

      const r = await resolveFile(SERVE_ROOT, url.pathname)
      if (!r) return notFoundResponse(SERVE_ROOT)

      // Inject the live-reload client into HTML responses; stream everything else.
      if (r.type.startsWith("text/html")) {
        const html = (await r.file.text()).replace("</body>", `${RELOAD_SNIPPET}\n</body>`)
        return new Response(html, {
          headers: { "content-type": r.type, "cache-control": "no-store" },
        })
      }
      return new Response(r.file, {
        headers: { "content-type": r.type, "cache-control": "no-store" },
      })
    },
  })
}

const server = (() => {
  let port = preferredPort
  while (true) {
    try {
      return startServer(port)
    } catch (err) {
      // PORT is an explicit contract for automation, so only the default port
      // gets the friendly Vite-style fallback behavior.
      if (
        hasExplicitPort ||
        (err as { code?: string }).code !== "EADDRINUSE" ||
        port === preferredPort + MAX_FALLBACK_ATTEMPTS
      ) {
        throw err
      }
      console.warn(`  ⚠  Port ${port} is busy; trying ${port + 1}`)
      port++
    }
  }
})()

const localUrl = `http://localhost:${server.port}`
console.log(`\n  ➜  lightNIIng dev server`)
console.log(`  ➜  ${localUrl}\n`)

// Open the site in the default browser (skip with NO_OPEN=1).
if (!process.env.NO_OPEN) {
  const opener =
    process.platform === "darwin"
      ? ["open", localUrl]
      : process.platform === "win32"
        ? ["cmd", "/c", "start", "", localUrl]
        : ["xdg-open", localUrl]
  try {
    Bun.spawn(opener, { stdout: "ignore", stderr: "ignore" })
  } catch {
    /* no browser opener available — the URL is printed above */
  }
}

// Watch ONLY source locations — never the repo root. `site.config.ts` is deliberately NOT watched:
// build.ts imports it once, so a running process keeps the cached module and
// config edits wouldn't take effect anyway — they need a dev restart.
const watchTargets = [
  join(ROOT, "assets"),
  ...config.projects.map((t) => join(ROOT, t.slug)),
]

// A content signature of every watched source file (path + mtime + size).
// macOS fs.watch fires on *access-time* changes too, and the build reads
// these files (Bun.file/cp) on every run — so a naive rebuild-on-event loops
// forever. mtime + size don't change when a file is merely read, so we only
// rebuild when this signature actually changes.
function sourceSignature(): string {
  const parts: string[] = []
  const walk = (p: string) => {
    let st: ReturnType<typeof statSync>
    try {
      st = statSync(p)
    } catch {
      return
    }
    if (st.isDirectory()) {
      let entries: string[]
      try {
        entries = readdirSync(p)
      } catch {
        return
      }
      for (const entry of entries) {
        if (entry.startsWith(".")) continue
        walk(join(p, entry))
      }
    } else {
      // SVGs with a same-name TSV sibling are derived build products. Watching
      // their mtimes makes figure generation trigger another rebuild of itself.
      if (p.endsWith(".svg") && existsSync(p.replace(/\.svg$/i, ".tsv"))) return
      parts.push(`${p}:${st.mtimeMs}:${st.size}`)
    }
  }
  for (const t of watchTargets) walk(t)
  return parts.sort().join("|")
}

let lastSignature = sourceSignature()
let timer: ReturnType<typeof setTimeout> | null = null
let building = false
let buildQueued = false

async function runRebuild(): Promise<void> {
  if (building) {
    buildQueued = true
    return
  }

  building = true
  try {
    do {
      buildQueued = false
      const sig = sourceSignature()
      if (sig === lastSignature) continue // spurious event (e.g. read-only access)
      lastSignature = sig
      try {
        await buildIsolated(SERVE_ROOT)
        console.log("  ↻  rebuilt")
        notifyReload()
      } catch (err) {
        console.error("  ✗  build failed:", err instanceof Error ? err.message : err)
      }

      // A source edit may arrive while this process is replacing its generated
      // tree. Queue one follow-up build instead of racing two destructive writes.
      if (sourceSignature() !== lastSignature) buildQueued = true
    } while (buildQueued)
  } finally {
    building = false
  }
}

const rebuild = () => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    void runRebuild().catch((err) => {
      console.error("  ✗  rebuild failed:", err instanceof Error ? err.message : err)
    })
  }, 80)
}

for (const target of watchTargets) {
  try {
    watch(target, { recursive: true }, rebuild)
  } catch {
    /* target may not exist yet; skip it */
  }
}
