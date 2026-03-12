import { useEffect, useState } from "react"

import { COLOR_MAP, type Highlight } from "~/lib/types"
import { deleteHighlight, getHighlights } from "~/lib/storage"

function IndexPopup() {
  const [url, setUrl] = useState<string | null>(null)
  const [highlights, setHighlights] = useState<Highlight[]>([])

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tabUrl = tabs[0]?.url
      if (!tabUrl) return
      setUrl(tabUrl)
      const hs = await getHighlights(tabUrl)
      setHighlights(hs.sort((a, b) => b.createdAt - a.createdAt))
    })
  }, [])

  async function handleDelete(id: string) {
    if (!url) return
    await deleteHighlight(url, id)
    setHighlights((prev) => prev.filter((h) => h.id !== id))
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.logo}>Markly</span>
        <span style={styles.count}>
          {highlights.length} mark{highlights.length !== 1 ? "s" : ""}
        </span>
      </div>

      {highlights.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyText}>No highlights on this page.</p>
          <p style={styles.emptyHint}>Select text to get started.</p>
        </div>
      ) : (
        <ul style={styles.list}>
          {highlights.map((h) => (
            <li key={h.id} style={styles.item}>
              <span
                style={{
                  ...styles.dot,
                  background: COLOR_MAP[h.color]
                }}
              />
              <span style={styles.text}>
                {h.text.length > 100 ? h.text.slice(0, 100) + "…" : h.text}
              </span>
              <button
                style={styles.deleteBtn}
                title="Remove highlight"
                onClick={() => handleDelete(h.id)}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: 320,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: 13,
    color: "#1a1a1a",
    background: "#fff"
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    borderBottom: "1px solid #eee"
  },
  logo: {
    fontWeight: 700,
    fontSize: 15,
    letterSpacing: "-0.3px"
  },
  count: {
    fontSize: 12,
    color: "#888"
  },
  empty: {
    padding: "32px 16px",
    textAlign: "center"
  },
  emptyText: {
    margin: "0 0 4px",
    fontWeight: 500,
    color: "#555"
  },
  emptyHint: {
    margin: 0,
    color: "#aaa",
    fontSize: 12
  },
  list: {
    listStyle: "none",
    margin: 0,
    padding: "4px 0",
    maxHeight: 400,
    overflowY: "auto"
  },
  item: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "8px 16px",
    borderBottom: "1px solid #f5f5f5"
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    flexShrink: 0,
    marginTop: 2
  },
  text: {
    flex: 1,
    lineHeight: 1.4,
    wordBreak: "break-word",
    color: "#333"
  },
  deleteBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#bbb",
    fontSize: 18,
    lineHeight: 1,
    padding: "0 0 0 4px",
    flexShrink: 0,
    fontWeight: 300
  }
}

export default IndexPopup
