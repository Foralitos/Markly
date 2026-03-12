import type { PlasmoCSConfig } from "plasmo"

import { COLOR_MAP, type Highlight, type HighlightColor } from "~/lib/types"
import {
  deleteHighlight,
  getHighlights,
  saveHighlight,
  storageKey
} from "~/lib/storage"

export const config: PlasmoCSConfig = {
  matches: ["https://*/*", "http://*/*"],
  run_at: "document_idle"
}

// ─── Shadow-DOM toolbar ──────────────────────────────────────────────────────

const host = document.createElement("div")
host.id = "markly-host"
Object.assign(host.style, {
  position: "fixed",
  zIndex: "2147483647",
  pointerEvents: "none",
  top: "0",
  left: "0"
})
document.body.appendChild(host)
const shadow = host.attachShadow({ mode: "closed" })

const toolbar = document.createElement("div")
Object.assign(toolbar.style, {
  position: "fixed",
  display: "none",
  gap: "6px",
  padding: "6px 8px",
  background: "#1e1e1e",
  borderRadius: "8px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
  pointerEvents: "auto",
  alignItems: "center"
})
shadow.appendChild(toolbar)

const colors: HighlightColor[] = ["yellow", "green", "blue", "pink"]
for (const color of colors) {
  const btn = document.createElement("button")
  Object.assign(btn.style, {
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    background: COLOR_MAP[color],
    border: "2px solid transparent",
    cursor: "pointer",
    padding: "0",
    flexShrink: "0"
  })
  btn.title = color
  btn.addEventListener("mouseenter", () => {
    btn.style.border = "2px solid white"
  })
  btn.addEventListener("mouseleave", () => {
    btn.style.border = "2px solid transparent"
  })
  btn.addEventListener("mousedown", (e) => {
    e.preventDefault()
    e.stopPropagation()
    applyHighlight(color)
    hideToolbar()
  })
  toolbar.appendChild(btn)
}

function showToolbar(x: number, y: number) {
  toolbar.style.display = "flex"
  // Position above cursor; clamp to viewport
  const tw = 120
  const th = 36
  const left = Math.min(Math.max(x - tw / 2, 8), window.innerWidth - tw - 8)
  const top = Math.max(y - th - 12, 8)
  toolbar.style.left = left + "px"
  toolbar.style.top = top + "px"
}

function hideToolbar() {
  toolbar.style.display = "none"
}

// ─── Selection events ─────────────────────────────────────────────────────────

document.addEventListener("mouseup", (e) => {
  setTimeout(() => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || sel.toString().trim() === "") {
      return
    }
    showToolbar(e.clientX, e.clientY)
  }, 0)
})

document.addEventListener("mousedown", (e) => {
  // Hide unless clicking inside toolbar
  if (!toolbar.contains(e.target as Node)) {
    hideToolbar()
  }
})

// ─── Apply highlight ──────────────────────────────────────────────────────────

function getTextNodesInRange(range: Range): Text[] {
  const root = range.commonAncestorContainer
  const walker = document.createTreeWalker(
    root.nodeType === Node.TEXT_NODE ? (root.parentNode as Node) : root,
    NodeFilter.SHOW_TEXT
  )
  const nodes: Text[] = []
  let node: Node | null
  while ((node = walker.nextNode())) {
    if (range.intersectsNode(node)) nodes.push(node as Text)
  }
  return nodes
}

function getOccurrenceIndex(sel: Selection): number {
  const range = sel.getRangeAt(0)
  const selectedText = sel.toString()
  const preRange = document.createRange()
  preRange.setStart(document.body, 0)
  preRange.setEnd(range.startContainer, range.startOffset)
  const precedingText = preRange.toString()

  let count = 0
  let pos = 0
  while (true) {
    const idx = precedingText.indexOf(selectedText, pos)
    if (idx === -1) break
    count++
    pos = idx + 1
  }
  return count
}

async function applyHighlight(color: HighlightColor) {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed) return
  const selectedText = sel.toString()
  if (!selectedText.trim()) return

  const occurrenceIndex = getOccurrenceIndex(sel)
  const range = sel.getRangeAt(0)
  const id = crypto.randomUUID()

  wrapRangeWithSpans(range, id, color)
  sel.removeAllRanges()

  const h: Highlight = {
    id,
    url: location.href,
    text: selectedText,
    color,
    occurrenceIndex,
    createdAt: Date.now()
  }
  await saveHighlight(h)
}

function wrapRangeWithSpans(range: Range, id: string, color: HighlightColor) {
  const textNodes = getTextNodesInRange(range)
  for (const textNode of textNodes) {
    // Skip nodes already wrapped in a markly span
    if ((textNode.parentElement as HTMLElement)?.dataset?.marklyId) continue

    // Compute the intersection of this text node with the range
    const nodeStart = 0
    const nodeEnd = textNode.length

    const startOffset =
      range.startContainer === textNode
        ? range.startOffset
        : nodeStart
    const endOffset =
      range.endContainer === textNode ? range.endOffset : nodeEnd

    if (startOffset >= endOffset) continue

    const nodeRange = document.createRange()
    nodeRange.setStart(textNode, startOffset)
    nodeRange.setEnd(textNode, endOffset)

    const span = document.createElement("span")
    span.dataset.marklyId = id
    Object.assign(span.style, {
      backgroundColor: COLOR_MAP[color],
      borderRadius: "2px",
      color: "#1a1a1a"
    })
    try {
      nodeRange.surroundContents(span)
    } catch {
      // DOM mutation race or partial element overlap — skip this node
    }
  }
}

// ─── Restore highlights on load ───────────────────────────────────────────────

interface TextNodeEntry {
  node: Text
  start: number // start offset in the flat body text
  end: number
}

function buildTextNodeMap(): TextNodeEntry[] {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const entries: TextNodeEntry[] = []
  let offset = 0
  let node: Node | null
  while ((node = walker.nextNode())) {
    const t = node as Text
    const len = t.length
    entries.push({ node: t, start: offset, end: offset + len })
    offset += len
  }
  return entries
}

function restoreOne(h: Highlight) {
  const entries = buildTextNodeMap()
  const flatText = entries.map((e) => e.node.textContent ?? "").join("")

  // Find occurrenceIndex-th match
  let count = 0
  let searchFrom = 0
  let matchStart = -1
  while (true) {
    const idx = flatText.indexOf(h.text, searchFrom)
    if (idx === -1) return // text no longer present
    if (count === h.occurrenceIndex) {
      matchStart = idx
      break
    }
    count++
    searchFrom = idx + 1
  }
  const matchEnd = matchStart + h.text.length

  // Map flat offsets back to text nodes
  for (const entry of entries) {
    if (entry.end <= matchStart || entry.start >= matchEnd) continue
    // Skip already-wrapped nodes
    if ((entry.node.parentElement as HTMLElement)?.dataset?.marklyId) continue

    const localStart = Math.max(matchStart - entry.start, 0)
    const localEnd = Math.min(matchEnd - entry.start, entry.node.length)
    if (localStart >= localEnd) continue

    const nodeRange = document.createRange()
    nodeRange.setStart(entry.node, localStart)
    nodeRange.setEnd(entry.node, localEnd)

    const span = document.createElement("span")
    span.dataset.marklyId = h.id
    Object.assign(span.style, {
      backgroundColor: COLOR_MAP[h.color],
      borderRadius: "2px",
      color: "#1a1a1a"
    })
    try {
      nodeRange.surroundContents(span)
    } catch {
      // skip nodes where surroundContents fails (e.g. partial element overlap)
    }
  }
}

function tryRestore(highlights: Highlight[]): Set<string> {
  const restored = new Set<string>()
  for (const h of highlights) {
    const before = document.querySelectorAll(`[data-markly-id="${h.id}"]`).length
    restoreOne(h)
    const after = document.querySelectorAll(`[data-markly-id="${h.id}"]`).length
    if (after > before) restored.add(h.id)
  }
  return restored
}

async function restoreWithRetry() {
  const highlights = await getHighlights(location.href)
  if (highlights.length === 0) return
  const sorted = [...highlights].sort((a, b) => a.createdAt - b.createdAt)

  // Initial attempt
  const restored = tryRestore(sorted)
  if (restored.size === sorted.length) return

  // Some highlights not yet in the DOM — watch for mutations
  let pending = sorted.filter((h) => !restored.has(h.id))

  const cleanup = () => {
    observer.disconnect()
    window.removeEventListener("scroll", onScroll)
  }

  const observer = new MutationObserver(() => {
    const nowRestored = tryRestore(pending)
    pending = pending.filter((h) => !nowRestored.has(h.id))
    if (pending.length === 0) cleanup()
  })
  observer.observe(document.body, { childList: true, subtree: true })

  // Scroll listener: for intersection-observer-based lazy loading (e.g. LinkedIn)
  let scrollTimer: ReturnType<typeof setTimeout> | null = null
  const onScroll = () => {
    if (pending.length === 0) {
      cleanup()
      return
    }
    if (scrollTimer) clearTimeout(scrollTimer)
    scrollTimer = setTimeout(() => {
      if (pending.length === 0) return
      const nowRestored = tryRestore(pending)
      pending = pending.filter((h) => !nowRestored.has(h.id))
      if (pending.length === 0) cleanup()
    }, 500)
  }
  window.addEventListener("scroll", onScroll, { passive: true })

  // Fallback: periodic retries for lazy-loaded content that may not trigger childList mutations
  for (const delay of [1000, 2000, 5000]) {
    setTimeout(() => {
      if (pending.length === 0) return
      const nowRestored = tryRestore(pending)
      pending = pending.filter((h) => !nowRestored.has(h.id))
      if (pending.length === 0) cleanup()
    }, delay)
  }

  // Hard cleanup at 30s — user may scroll slowly through the page
  setTimeout(cleanup, 30_000)
}

restoreWithRetry()

// ─── Live sync: remove spans when popup deletes a highlight ──────────────────

function removeSpansForId(id: string) {
  const spans = document.querySelectorAll<HTMLSpanElement>(
    `span[data-markly-id="${id}"]`
  )
  for (const span of spans) {
    const parent = span.parentNode
    if (!parent) continue
    while (span.firstChild) {
      parent.insertBefore(span.firstChild, span)
    }
    parent.removeChild(span)
    if (parent.nodeType === Node.ELEMENT_NODE) {
      ;(parent as Element).normalize()
    }
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return
  const key = storageKey(location.href)
  if (!(key in changes)) return
  const oldIds = new Set<string>(
    (changes[key].oldValue as Highlight[] | undefined)?.map((h) => h.id) ?? []
  )
  const newIds = new Set<string>(
    (changes[key].newValue as Highlight[] | undefined)?.map((h) => h.id) ?? []
  )
  oldIds.forEach((id) => {
    if (!newIds.has(id)) removeSpansForId(id)
  })
})
