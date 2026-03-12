import type { Highlight } from "./types"

export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw)
    u.hash = ""
    u.search = ""
    let href = u.toString()
    if (href.endsWith("/") && u.pathname === "/") {
      // keep root slash
    } else if (href.endsWith("/")) {
      href = href.slice(0, -1)
    }
    return href
  } catch {
    return raw
  }
}

export function storageKey(url: string): string {
  return "markly:" + normalizeUrl(url)
}

export async function getHighlights(url: string): Promise<Highlight[]> {
  const key = storageKey(url)
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      resolve((result[key] as Highlight[]) ?? [])
    })
  })
}

export async function saveHighlight(h: Highlight): Promise<void> {
  const key = storageKey(h.url)
  const existing = await getHighlights(h.url)
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: [...existing, h] }, resolve)
  })
}

export async function deleteHighlight(url: string, id: string): Promise<void> {
  const key = storageKey(url)
  const existing = await getHighlights(url)
  const updated = existing.filter((h) => h.id !== id)
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: updated }, resolve)
  })
}
