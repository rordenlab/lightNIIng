// This site ships no service worker. On a localhost dev port a stale one left
// by a *different* app previously served there hijacks navigations/fetches and
// eventually throws "Failed to fetch" from its own sw.js, freezing the page.
// Clear it — but ONLY on localhost: on a shared origin like github.io a
// root-scoped worker belonging to another project would also match here, and
// unregistering it would break that app. Production never has a stale SW of
// ours (we register none), so this simply doesn't run there.
if (
  "serviceWorker" in navigator &&
  (location.hostname === "localhost" || location.hostname === "127.0.0.1")
) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => Promise.allSettled(regs.map((r) => r.unregister())))
    .catch(() => {})
}

// Theme + accent controls. The <head> inline snippet has already applied the
// stored preferences before first paint (no flash); this file only wires up
// the interactive toggle + swatches and keeps them in sync.
;(() => {
  const root = document.documentElement
  const KEY_THEME = "lightniing:theme" // 'light' | 'dark' | null(default light)
  const KEY_ACCENT = "lightniing:accent"

  const storedTheme = () => {
    try {
      return localStorage.getItem(KEY_THEME)
    } catch {
      return null
    }
  }
  const isDark = () => {
    const t = storedTheme()
    return t ? t === "dark" : false
  }

  // Theme toggle
  const toggle = document.querySelector("[data-theme-toggle]")
  if (toggle) {
    const sync = () => {
      toggle.setAttribute("aria-label", isDark() ? "Switch to light" : "Switch to dark")
      toggle.setAttribute("aria-pressed", String(isDark()))
    }
    toggle.addEventListener("click", () => {
      const next = isDark() ? "light" : "dark"
      root.setAttribute("data-theme", next)
      try {
        localStorage.setItem(KEY_THEME, next)
      } catch {}
      sync()
    })
    sync()
  }

  // Accent swatches
  const swatches = document.querySelectorAll("[data-accent]")
  const currentAccent = () =>
    root.getAttribute("data-accent") || "orange"
  const syncSwatches = () => {
    swatches.forEach((s) =>
      s.setAttribute(
        "aria-pressed",
        String(s.getAttribute("data-accent") === currentAccent()),
      ),
    )
  }
  swatches.forEach((s) => {
    s.addEventListener("click", () => {
      const accent = s.getAttribute("data-accent")
      root.setAttribute("data-accent", accent)
      try {
        localStorage.setItem(KEY_ACCENT, accent)
      } catch {}
      syncSwatches()
    })
  })
  syncSwatches()
})()

// Project heroes use the scanner archive as quiet documentary imagery. Pick one
// photograph per page load; click to advance, or hold a fine pointer over the
// image to preview it in the shared lightbox.
;(() => {
  const galleries = document.querySelectorAll("[data-scanner-gallery]")
  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)")
  galleries.forEach((gallery) => {
    const image = gallery.querySelector("img")
    let sources = []
    try {
      sources = JSON.parse(gallery.getAttribute("data-scanner-images") || "[]")
    } catch {}
    if (!image || !sources.length) return

    let index = Math.floor(Math.random() * sources.length)
    let request = 0
    let hoverTimer = null
    const nextIndex = () => (index === sources.length - 1 ? 0 : index + 1)
    const cancelPreview = () => {
      clearTimeout(hoverTimer)
      hoverTimer = null
    }
    const schedulePreview = () => {
      if (!canHover.matches || !image.currentSrc) return
      cancelPreview()
      hoverTimer = setTimeout(() => {
        hoverTimer = null
        gallery.dispatchEvent(
          new CustomEvent("scannerpreview", {
            bubbles: true,
            detail: {
              src: image.currentSrc || image.src,
              alt: image.alt || "MRI scanner facility",
            },
          }),
        )
      }, 900)
    }
    const preloadNext = () => {
      const next = new Image()
      next.src = sources[nextIndex()]
    }
    const markReady = () => {
      gallery.classList.add("is-ready")
      gallery.classList.remove("is-loading")
      preloadNext()
    }

    image.addEventListener("load", markReady)
    image.src = sources[index]
    if (image.complete) markReady()

    gallery.addEventListener("click", () => {
      cancelPreview()
      const upcomingIndex = nextIndex()
      const nextRequest = ++request
      const candidate = new Image()
      gallery.classList.add("is-loading")
      candidate.onload = async () => {
        // Older mobile Safari can fire `load` before the decoded bitmap is
        // ready to composite. Keep the current photo visible until decoding
        // finishes, then perform one atomic source swap.
        if (candidate.decode) {
          try {
            await candidate.decode()
          } catch {}
        }
        if (nextRequest !== request) return
        index = upcomingIndex
        image.src = candidate.src
      }
      candidate.onerror = () => {
        if (nextRequest === request) gallery.classList.remove("is-loading")
      }
      candidate.src = sources[upcomingIndex]
    })
    gallery.addEventListener("pointerenter", schedulePreview)
    gallery.addEventListener("pointerleave", cancelPreview)
    gallery.addEventListener("pointerdown", cancelPreview)
  })
})()

// Decorative radars are directly controllable: click one, or focus it and
// press Enter/Space, to freeze and resume its sweep in place.
;(() => {
  const radars = document.querySelectorAll("[data-radar-toggle]")
  if (!radars.length) return

  const setupRadar = (radar) => {
    const cycleOnClick = radar.hasAttribute("data-radar-cycle-on-click")
    const sync = (paused) => {
    if (cycleOnClick) {
      radar.classList.remove("radar-paused")
      radar.removeAttribute("aria-pressed")
      radar.setAttribute("title", "Click to show the next image")
      return
    }
    radar.classList.toggle("radar-paused", paused)
    radar.setAttribute("aria-pressed", String(paused))
    radar.setAttribute("title", `${paused ? "Click to resume" : "Click to pause"} · Double-click to change image`)
    }
    const toggle = () => sync(!radar.classList.contains("radar-paused"))
    const variants = (radar.getAttribute("data-radar-variants") || radar.getAttribute("data-hero-variants") || "")
    .split(/\s+/)
    .filter(Boolean)
    const variantAttribute = radar.getAttribute("data-radar-attribute") || "data-hero-variant"
    const assetBase = radar.getAttribute("data-radar-asset-base") || "assets/"
    const assetPrefix = radar.getAttribute("data-radar-asset-prefix") || ""
  const PRELOAD_TIMEOUT = 5000
  const POINTER_CLICK_DELAY = 250
  let switchingVariant = false
  let clickTimer = null
  let controls = null
  let visibilityObserver = null

  const cancelPendingClick = () => {
    if (clickTimer === null) return
    clearTimeout(clickTimer)
    clickTimer = null
  }

  const cycleVariant = async () => {
    if (switchingVariant || variants.length < 2) return
    switchingVariant = true
    const root = document.documentElement
    const current = root.getAttribute(variantAttribute)
    const next = variants[(variants.indexOf(current) + 1) % variants.length]
    const preload = (name) =>
      new Promise((resolve) => {
        const image = new Image()
        let settled = false
        let timeout
        const finish = (loaded) => {
          if (settled) return
          settled = true
          clearTimeout(timeout)
          image.onload = image.onerror = null
          if (!loaded) image.removeAttribute("src")
          resolve(loaded)
        }
        timeout = setTimeout(() => finish(false), PRELOAD_TIMEOUT)
        image.onload = () => finish(true)
        image.onerror = () => finish(false)
        try {
          image.src = new URL(`${assetBase}${assetPrefix}${next}-${name}.png`, document.baseURI).href
        } catch {
          finish(false)
        }
      })
    try {
      const loaded = await Promise.all([preload("base"), preload("active")])
      if (loaded.every(Boolean)) root.setAttribute(variantAttribute, next)
    } finally {
      switchingVariant = false
    }
  }

  const enableControls = () => {
    if (controls) return
    controls = new AbortController()
    const { signal } = controls

    radar.removeAttribute("aria-hidden")
    radar.setAttribute("role", "button")
    radar.setAttribute("tabindex", "0")
    radar.setAttribute(
      "aria-label",
      cycleOnClick ? "Show the next radar image" : "Pause radar animation",
    )
    if (cycleOnClick) radar.removeAttribute("aria-description")
    else radar.setAttribute("aria-description", "Double-click or press Shift+Enter to change the image")
    sync(radar.classList.contains("radar-paused"))

    radar.addEventListener(
      "click",
      (event) => {
        if (cycleOnClick) {
          cancelPendingClick()
          if (event.detail === 0) {
            cycleVariant()
            return
          }
          if (event.detail > 1) return
          clickTimer = setTimeout(() => {
            clickTimer = null
            cycleVariant()
          }, POINTER_CLICK_DELAY)
          return
        }
        // Pointer clicks wait briefly so a second click can become a variant
        // change without disturbing the animation's running/paused phase.
        if (event.detail === 0) {
          toggle()
          return
        }
        cancelPendingClick()
        if (event.detail > 1) return
        clickTimer = setTimeout(() => {
          clickTimer = null
          toggle()
        }, POINTER_CLICK_DELAY)
      },
      { signal },
    )
    radar.addEventListener(
      "dblclick",
      (event) => {
        event.preventDefault()
        cancelPendingClick()
        if (!cycleOnClick) cycleVariant()
      },
      { signal },
    )
    radar.addEventListener(
      "keydown",
      (event) => {
        if (event.repeat) return
        if (cycleOnClick && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault()
          cancelPendingClick()
          cycleVariant()
          return
        }
        if (event.key === "Enter" && event.shiftKey) {
          event.preventDefault()
          cancelPendingClick()
          cycleVariant()
          return
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          cancelPendingClick()
          toggle()
        }
      },
      { signal },
    )

    if ("IntersectionObserver" in window) {
      visibilityObserver = new IntersectionObserver(([entry]) => {
        radar.classList.toggle("radar-offscreen", !entry.isIntersecting)
      })
      visibilityObserver.observe(radar)
    }
  }

  const disableControls = () => {
    cancelPendingClick()
    controls?.abort()
    controls = null
    visibilityObserver?.disconnect()
    visibilityObserver = null
    radar.classList.remove("radar-offscreen")
    const interactiveAttributes = [
      "role",
      "tabindex",
      "aria-pressed",
      "aria-label",
      "aria-description",
      "title",
    ]
    for (const attribute of interactiveAttributes) {
      radar.removeAttribute(attribute)
    }
    radar.setAttribute("aria-hidden", "true")
  }

  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)")
  const syncMotionPreference = () => {
    if (motionPreference.matches) disableControls()
    else enableControls()
  }
  motionPreference.addEventListener("change", syncMotionPreference)
  syncMotionPreference()
  }

  radars.forEach(setupRadar)
})()

// Screenshot lightbox: click a `.shot` to open the image large over a blurred
// backdrop; click anywhere (or press Escape) to close. One overlay is reused
// for every image on the page. Leading `;` so this IIFE isn't parsed as a
// call on the previous one.
;(() => {
  const shots = document.querySelectorAll(".shot")
  // Elements that open an arbitrary image in the lightbox (e.g. the home-page
  // splash trigger), so the feature isn't limited to `.shot` figures.
  const triggers = document.querySelectorAll("[data-lightbox-src]")
  const scannerGalleries = document.querySelectorAll("[data-scanner-gallery]")
  if (!shots.length && !triggers.length && !scannerGalleries.length) return

  const box = document.createElement("div")
  box.className = "lightbox"
  box.setAttribute("role", "dialog")
  box.setAttribute("aria-modal", "true")
  box.setAttribute("aria-label", "Enlarged image")
  box.innerHTML = '<figure class="lightbox__frame"><img alt="" /></figure>'
  document.body.appendChild(box)
  const frame = box.querySelector(".lightbox__frame")
  const big = box.querySelector("img")
  let vectorUrl = null
  let vectorSize = null
  let closeTimer = null
  let previousFocus = null

  const releaseVector = () => {
    if (vectorUrl) URL.revokeObjectURL(vectorUrl)
    vectorUrl = null
    vectorSize = null
    big.onload = null
    frame.classList.remove("lightbox__frame--vector")
    frame.classList.remove("lightbox__frame--scanner")
    big.style.removeProperty("width")
    big.style.removeProperty("height")
    big.style.removeProperty("max-width")
    big.style.removeProperty("max-height")
  }
  const fitVector = () => {
    if (!vectorSize) return
    const maxWidth = Math.max(1, Math.min(window.innerWidth * 0.96, 1680) - 24)
    const maxHeight = Math.max(1, window.innerHeight * 0.92 - 24)
    const scale = Math.min(maxWidth / vectorSize.width, maxHeight / vectorSize.height)
    big.style.width = `${vectorSize.width * scale}px`
    big.style.height = `${vectorSize.height * scale}px`
    big.style.maxWidth = "none"
    big.style.maxHeight = "none"
  }
  const show = (src, alt) => {
    clearTimeout(closeTimer)
    big.src = src
    big.alt = alt || ""
    box.classList.add("open")
    document.body.style.overflow = "hidden" // freeze page scroll while open
    previousFocus = document.activeElement
    box.setAttribute("tabindex", "-1")
    box.focus({ preventScroll: true })
  }
  const openImage = (src, alt, scanner = false) => {
    releaseVector()
    frame.classList.toggle("lightbox__frame--scanner", scanner)
    big.onload = () => {
      vectorSize = {
        width: big.naturalWidth || 1,
        height: big.naturalHeight || 1,
      }
      fitVector()
    }
    show(src, alt)
    if (big.complete && big.naturalWidth) big.onload()
  }
  const openSvg = (svg, alt) => {
    releaseVector()
    const clone = svg.cloneNode(true)
    const rootStyles = getComputedStyle(document.documentElement)
    ;[
      "--accent",
      "--accent-soft",
      "--accent-glow",
      "--bg-base",
      "--fg-base",
      "--fg-muted",
      "--border-strong",
    ].forEach((property) => {
      const value = rootStyles.getPropertyValue(property).trim()
      if (value) clone.style.setProperty(property, value)
    })
    const viewBox = (clone.getAttribute("viewBox") || "").trim().split(/\s+/).map(Number)
    const width = viewBox.length === 4 && viewBox.every(Number.isFinite)
      ? viewBox[2]
      : Number(clone.getAttribute("width")) || 1200
    const height = viewBox.length === 4 && viewBox.every(Number.isFinite)
      ? viewBox[3]
      : Number(clone.getAttribute("height")) || 720
    vectorSize = { width, height }
    vectorUrl = URL.createObjectURL(
      new Blob([new XMLSerializer().serializeToString(clone)], {
        type: "image/svg+xml;charset=utf-8",
      }),
    )
    frame.classList.add("lightbox__frame--vector")
    fitVector()
    show(vectorUrl, alt)
  }
  const close = () => {
    box.classList.remove("open")
    document.body.style.overflow = ""
    if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true })
    closeTimer = setTimeout(() => {
      if (!box.classList.contains("open")) releaseVector()
    }, 220)
  }

  shots.forEach((fig) => {
    const img = fig.querySelector("img")
    const svg = fig.querySelector("svg")
    if (!img && !svg) return
    const caption = fig.querySelector("figcaption")?.textContent?.trim()
    const alt =
      img?.alt ||
      svg?.getAttribute("aria-label") ||
      caption ||
      "figure"
    fig.setAttribute("role", "button")
    fig.setAttribute("tabindex", "0")
    fig.setAttribute("aria-label", `Enlarge: ${alt}`)
    const trigger = () =>
      svg ? openSvg(svg, alt) : openImage(img.currentSrc || img.src, alt)
    fig.addEventListener("click", trigger)
    fig.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        trigger()
      }
    })
  })

  triggers.forEach((el) => {
    el.addEventListener("click", async (e) => {
      e.preventDefault() // e.g. the brand link would otherwise navigate home
      const src = el.getAttribute("data-lightbox-src")
      const alt = el.getAttribute("data-lightbox-alt")
      if (/\.svg(?:$|[?#])/i.test(src || "")) {
        try {
          el.setAttribute("aria-busy", "true")
          const response = await fetch(src)
          if (!response.ok) throw new Error(`Unable to load ${src}`)
          const document = new DOMParser().parseFromString(await response.text(), "image/svg+xml")
          const svg = document.documentElement
          if (svg.localName !== "svg") throw new Error("Invalid SVG")
          openSvg(svg, alt)
          return
        } catch {
          // The fallback still works for file:// previews where fetch is
          // blocked; HTTP builds use openSvg so live theme tokens are applied.
        } finally {
          el.removeAttribute("aria-busy")
        }
      }
      openImage(src, alt)
    })
  })

  document.addEventListener("scannerpreview", (event) => {
    const detail = event.detail
    if (!detail?.src) return
    openImage(detail.src, detail.alt, true)
  })

  box.addEventListener("click", close)
  window.addEventListener("resize", fitVector)
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && box.classList.contains("open")) close()
  })
})()
