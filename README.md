# MDX Local Editor

A local-first MDX editor that runs in the browser. Open individual `.mdx` (or `.md`) files or entire folders from your filesystem, edit them with a rich-text toolbar, and save changes back to disk — no server, no upload, no account.

I needed to edit .mdx files for my personal website mpire.dev so I made this so I could edit them in a decent looking, lightweight environment.

## Features

- Open files or folders via the File System Access API (no upload required)
- Rich-text MDX editing powered by [@mdxeditor/editor](https://mdxeditor.dev/)
- Light and dark themes with full toolbar and dialog theming
- Custom CSS support — load a stylesheet from your disk or folder, or use the built-in defaults
- Configurable max content width, persisted per file/folder
- Diff / source view toggle
- Supports headings, lists, blockquotes, code blocks (with syntax highlighting via CodeMirror), frontmatter, links, images, tables, and JSX components

## Stack

- **Runtime / package manager:** Bun
- **Framework:** Next.js 16 (App Router)
- **UI:** React 19, Tailwind CSS v4
- **Editor:** @mdxeditor/editor
- **Persistence:** File System Access API + idb-keyval (IndexedDB)
- **Language:** TypeScript

## Getting Started

```bash
bun install
bun dev
```

Open [http://localhost:3100](http://localhost:3100) in your browser.
