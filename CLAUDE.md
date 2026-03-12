# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server with hot reload (loads unpacked in Chrome)
npm run build     # Production build → build/chrome-mv3-prod/
npm run package   # Package into build/chrome-mv3-prod.zip for store submission
```

No test or lint commands are configured. Prettier is used for formatting — run `npx prettier --write .` to format files.

## Architecture

**Markly** is a Chrome Manifest V3 extension built with [Plasmo](https://docs.plasmo.com). The goal is to let users highlight and save text on any webpage, with marks persisting across revisits.

### Plasmo conventions

- `popup.tsx` → renders as the extension popup (`chrome-extension://.../popup.html`)
- `content.ts` / `content.tsx` → content scripts injected into pages (not yet created)
- `background.ts` → service worker (not yet created)
- `options.tsx` → options page (not yet created)
- Plasmo auto-generates the manifest from `package.json#manifest` — do not edit `.plasmo/` files
- Path alias `~` maps to the project root (e.g. `import Foo from "~/components/Foo"`)

### Extension permissions

Host permissions are set to `https://*/*` in `package.json#manifest`. Add any additional Chrome API permissions there (e.g. `"permissions": ["storage", "contextMenus"]`).

### Code style

- No semicolons, double quotes, no trailing commas (see `.prettierrc.mjs`)
- Imports are auto-sorted: builtins → third-party → `@plasmo/*` → `@plasmohq/*` → `~*` → relative

### Current state

The codebase is a fresh Plasmo scaffold. `popup.tsx` contains only boilerplate. The core highlight/save/persist feature is not yet implemented and will require:
1. A content script to intercept text selections
2. Chrome Storage API for persisting marks per URL
3. Updated popup UI for viewing/managing saved marks
