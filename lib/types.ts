export interface Highlight {
  id: string
  url: string
  text: string
  color: HighlightColor
  occurrenceIndex: number
  createdAt: number
}

export type HighlightColor = "yellow" | "green" | "blue" | "pink"

export const COLOR_MAP: Record<HighlightColor, string> = {
  yellow: "#FFE066",
  green: "#AEED8F",
  blue: "#93C5FD",
  pink: "#F9A8D4"
}
