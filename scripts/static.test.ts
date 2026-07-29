import { expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { resolveFile } from "./static.ts"

test("resolveFile serves within dist and blocks escapes", async () => {
  const dist = await mkdtemp(join(tmpdir(), "lightniing-static-"))
  try {
    await writeFile(join(dist, "index.html"), "<!doctype html>ok")
    await mkdir(join(dist, "assets"))
    await writeFile(join(dist, "assets", "a.css"), "body{}")

    // directory → index.html, with the right content type
    expect((await resolveFile(dist, "/"))?.type).toContain("text/html")
    expect((await resolveFile(dist, "/assets/a.css"))?.type).toContain("text/css")

    // misses and escapes return null
    expect(await resolveFile(dist, "/nope.txt")).toBeNull()
    expect(await resolveFile(dist, "/../../etc/passwd")).toBeNull()
    expect(await resolveFile(dist, "/..%2f..%2fpackage.json")).toBeNull()
    expect(await resolveFile(dist, "/%ZZ")).toBeNull() // malformed percent-encoding
  } finally {
    await rm(dist, { recursive: true, force: true })
  }
})
