# Project: MDX Local Editor

A local-first MDX/Markdown editor built with Next.js. No backend — all file I/O goes through the browser's File System Access API.

## Stack

| Layer | Technology |
|---|---|
| Package manager | **Bun** (always use `bun` — never npm/yarn/pnpm) |
| Framework | Next.js 16, App Router |
| UI | React 19, Tailwind CSS v4 |
| Editor | @mdxeditor/editor |
| Persistence | File System Access API + idb-keyval (IndexedDB) |
| Language | TypeScript |
| Dev port | 3100 (`bun dev`) |

## Key files

- `app/components/EditorPage.tsx` — main shell: sidebar, file/folder picker, CSS loader, theme toggle
- `app/components/MdxEditor.tsx` — wraps `@mdxeditor/editor` with full plugin set and dark/light theming

<!-- BEGIN:nextjs-agent-rules -->
## Next.js — read before writing code

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
