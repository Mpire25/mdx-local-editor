"use client";

import { useEffect, useRef, useState } from "react";
import "@mdxeditor/editor/style.css";
import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  codeBlockPlugin,
  codeMirrorPlugin,
  frontmatterPlugin,
  linkPlugin,
  linkDialogPlugin,
  imagePlugin,
  tablePlugin,
  diffSourcePlugin,
  jsxPlugin,
  toolbarPlugin,
  GenericJsxEditor,
  UndoRedo,
  Separator,
  BoldItalicUnderlineToggles,
  CodeToggle,
  HighlightToggle,
  StrikeThroughSupSubToggles,
  ListsToggle,
  BlockTypeSelect,
  CreateLink,
  InsertImage,
  InsertTable,
  InsertCodeBlock,
  InsertThematicBreak,
  DiffSourceToggleWrapper,
  imageDialogState$,
  cancelLinkEdit$,
  linkDialogState$,
} from "@mdxeditor/editor";
import { useCellValues, usePublisher } from "@mdxeditor/gurx";

/** Closes the link popover whenever the image dialog opens. */
function LinkImageCoordinator() {
  const [imageState, linkState] = useCellValues(imageDialogState$, linkDialogState$);
  const cancelLinkEdit = usePublisher(cancelLinkEdit$);
  useEffect(() => {
    if (imageState.type !== "inactive" && linkState.type === "edit") cancelLinkEdit();
  }, [imageState.type]);
  return null;
}

interface Props {
  markdown: string;
  onChange: (value: string) => void;
  css?: string;
  usingCustomCss?: boolean;
  theme?: "light" | "dark";
  widthStorageKey?: string;
  imagePreviewHandler?: (src: string) => Promise<string>;
}

const MIN_EDITOR_WIDTH = 300;
const MIN_ZOOM = 60;
const MAX_ZOOM = 200;
const ZOOM_STEP = 10;
const WIDTH_STORAGE_PREFIX = "mdx-editor-max-width";
const ZOOM_STORAGE_PREFIX = "mdx-editor-zoom";

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function getStoredMaxWidth(widthStorageKey?: string) {
  if (!widthStorageKey || typeof window === "undefined") return "";
  return localStorage.getItem(`${WIDTH_STORAGE_PREFIX}:${widthStorageKey}`) ?? "";
}

function getStoredZoom(widthStorageKey?: string) {
  if (!widthStorageKey || typeof window === "undefined") return 100;
  const value = Number.parseInt(localStorage.getItem(`${ZOOM_STORAGE_PREFIX}:${widthStorageKey}`) ?? "", 10);
  return Number.isFinite(value) ? clampZoom(value) : 100;
}

function applyMaxWidth(shell: HTMLDivElement | null, value: string) {
  if (!shell) return;

  if (!value) {
    shell.style.removeProperty("--mdx-rich-max-width");
    return;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return;
  shell.style.setProperty("--mdx-rich-max-width", `${Math.max(MIN_EDITOR_WIDTH, parsed)}px`);
}

function applyZoom(shell: HTMLDivElement | null, zoom: number) {
  if (!shell) return;
  shell.style.setProperty("--mdx-editor-zoom", String(clampZoom(zoom) / 100));
}

export default function MdxEditor({
  markdown,
  onChange,
  css,
  usingCustomCss = false,
  theme = "light",
  widthStorageKey,
  imagePreviewHandler,
}: Props) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [maxWidthInput, setMaxWidthInput] = useState(() => getStoredMaxWidth(widthStorageKey));
  const [zoom, setZoom] = useState(() => getStoredZoom(widthStorageKey));

  const themeClass = theme === "dark" ? "dark" : "light";
  const contentClassName = [
    "mdx-content max-w-none p-4 min-h-[60vh] focus:outline-none",
    "mdx-content--bounded",
    usingCustomCss ? "" : "bg-transparent",
  ]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    applyMaxWidth(shellRef.current, maxWidthInput);
  }, [maxWidthInput]);

  useEffect(() => {
    applyZoom(shellRef.current, zoom);
  }, [zoom]);

  useEffect(() => {
    if (!imagePreviewHandler || !shellRef.current) return;

    let isCancelled = false;
    const shell = shellRef.current;

    const resolveImageElement = async (img: HTMLImageElement) => {
      const currentSrc = img.getAttribute("src");
      if (!currentSrc) return;

      const originalSrc = img.dataset.mdxOriginalSrc ?? currentSrc;
      if (!img.dataset.mdxOriginalSrc) {
        img.dataset.mdxOriginalSrc = originalSrc;
      }

      try {
        const resolvedSrc = await imagePreviewHandler(originalSrc);
        if (isCancelled || !resolvedSrc || resolvedSrc === currentSrc) return;
        img.setAttribute("src", resolvedSrc);
      } catch (error) {
        console.error(`Failed to resolve image "${originalSrc}" in preview:`, error);
      }
    };

    const resolveAllImages = (root: ParentNode) => {
      root.querySelectorAll("img[src]").forEach((img) => {
        void resolveImageElement(img as HTMLImageElement);
      });
    };

    resolveAllImages(shell);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes") {
          const target = mutation.target;
          if (target instanceof HTMLImageElement) {
            if (target.dataset.mdxOriginalSrc && target.getAttribute("src") === target.dataset.mdxOriginalSrc) {
              delete target.dataset.mdxOriginalSrc;
            }
            void resolveImageElement(target);
          }
          continue;
        }

        for (const addedNode of mutation.addedNodes) {
          if (!(addedNode instanceof Element)) continue;
          if (addedNode instanceof HTMLImageElement) {
            void resolveImageElement(addedNode);
          } else {
            resolveAllImages(addedNode);
          }
        }
      }
    });

    observer.observe(shell, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["src"],
    });

    return () => {
      isCancelled = true;
      observer.disconnect();
    };
  }, [imagePreviewHandler, markdown]);

  function updateMaxWidth(nextValue: string) {
    setMaxWidthInput(nextValue);
    applyMaxWidth(shellRef.current, nextValue);

    if (!widthStorageKey) return;

    const storageId = `${WIDTH_STORAGE_PREFIX}:${widthStorageKey}`;
    if (!nextValue) {
      localStorage.removeItem(storageId);
      return;
    }

    localStorage.setItem(storageId, nextValue);
  }

  function updateZoom(nextValue: number) {
    const clamped = clampZoom(nextValue);
    setZoom(clamped);
    applyZoom(shellRef.current, clamped);

    if (!widthStorageKey) return;
    localStorage.setItem(`${ZOOM_STORAGE_PREFIX}:${widthStorageKey}`, String(clamped));
  }

  return (
    <div ref={shellRef} className={`${themeClass} mdx-editor-shell`}>
      <style>{`
        .mdxeditor.dark {
          --blue-1: #050505;
          --blue-2: #0b0b0b;
          --blue-3: #101010;
          --blue-4: #171717;
          --blue-5: #1f1f1f;
          --blue-6: #2a2a2a;
          --blue-7: #333333;
          --blue-8: #454545;
          --blue-9: #737373;
          --blue-10: #858585;
          --blue-11: #d4d4d4;
          --blue-12: #f8f8f8;

          --basePageBg: #000000;
          --baseBase: #050505;
          --baseBgSubtle: #0b0b0b;
          --baseBg: #101010;
          --baseBgHover: #171717;
          --baseBgActive: #1f1f1f;
          --baseLine: #2a2a2a;
          --baseBorder: #333333;
          --baseBorderHover: #3d3d3d;
          --baseSolid: #666666;
          --baseSolidHover: #747474;
          --baseText: #b5b5b5;
          --baseTextContrast: #f2f2f2;

          --accentBase: #0f0f0f;
          --accentBgSubtle: #151515;
          --accentBg: #1a1a1a;
          --accentBgHover: #202020;
          --accentBgActive: #262626;
          --accentLine: #303030;
          --accentBorder: #3a3a3a;
          --accentBorderHover: #454545;
          --accentSolid: #737373;
          --accentSolidHover: #858585;
          --accentText: #d4d4d4;
          --accentTextContrast: #f8f8f8;
        }

        /* Dialog/popover content is portaled, so it needs explicit theme tokens. */
        html:not(.dark) [class*="_dialogContent_"],
        html:not(.dark) [class*="_largeDialogContent_"],
        html:not(.dark) [class*="_linkDialogPopoverContent_"],
        html:not(.dark) [class*="_tableColumnEditorPopoverContent_"],
        html:not(.dark) [class*="_popoverContent_"] {
          --basePageBg: #ffffff;
          --baseBase: #fcfcfd;
          --baseBgSubtle: #f9f9fb;
          --baseBg: #f0f0f3;
          --baseBgHover: #e8e8ec;
          --baseBgActive: #e0e1e6;
          --baseLine: #d9d9e0;
          --baseBorder: #cdced6;
          --baseBorderHover: #b9bbc6;
          --baseSolid: #8b8d98;
          --baseSolidHover: #80838d;
          --baseText: #60646c;
          --baseTextContrast: #1c2024;

          --accentBase: #fbfdff;
          --accentBgSubtle: #f4faff;
          --accentBg: #e6f4fe;
          --accentBgHover: #d5efff;
          --accentBgActive: #c2e5ff;
          --accentLine: #acd8fc;
          --accentBorder: #8ec8f6;
          --accentBorderHover: #5eb1ef;
          --accentSolid: #0090ff;
          --accentSolidHover: #0588f0;
          --accentText: #0d74ce;
          --accentTextContrast: #113264;
          color: #1c2024;
        }

        .dark [class*="_dialogContent_"],
        .dark [class*="_largeDialogContent_"],
        .dark [class*="_linkDialogPopoverContent_"],
        .dark [class*="_tableColumnEditorPopoverContent_"],
        .dark [class*="_popoverContent_"] {
          --basePageBg: #000000;
          --baseBase: #050505;
          --baseBgSubtle: #0b0b0b;
          --baseBg: #101010;
          --baseBgHover: #171717;
          --baseBgActive: #1f1f1f;
          --baseLine: #2a2a2a;
          --baseBorder: #333333;
          --baseBorderHover: #3d3d3d;
          --baseSolid: #666666;
          --baseSolidHover: #747474;
          --baseText: #b5b5b5;
          --baseTextContrast: #f2f2f2;

          --accentBase: #0f0f0f;
          --accentBgSubtle: #151515;
          --accentBg: #1a1a1a;
          --accentBgHover: #202020;
          --accentBgActive: #262626;
          --accentLine: #303030;
          --accentBorder: #3a3a3a;
          --accentBorderHover: #454545;
          --accentSolid: #737373;
          --accentSolidHover: #858585;
          --accentText: #d4d4d4;
          --accentTextContrast: #f8f8f8;
          color: #f2f2f2;
        }

        /* Radix select menus are portaled outside .mdxeditor, so they need explicit dark tokens. */
        .dark [class*="_toolbarNodeKindSelectContainer_"],
        .dark [class*="_toolbarButtonDropdownContainer_"],
        .dark [class*="_toolbarCodeBlockLanguageSelectContent_"],
        .dark [class*="_selectContainer_"] {
          background-color: #050505;
          color: #b5b5b5;
          border: 1px solid #2a2a2a;
        }

        .dark [class*="_toolbarNodeKindSelectItem_"],
        .dark [class*="_selectItem_"] {
          color: #b5b5b5;
          background-color: transparent;
        }

        .dark [class*="_toolbarNodeKindSelectItem_"][data-highlighted],
        .dark [class*="_selectItem_"][data-highlighted] {
          color: #f2f2f2;
          background-color: #171717;
        }

        .dark [class*="_toolbarNodeKindSelectItem_"][data-state='checked'],
        .dark [class*="_selectItem_"][data-state='checked'] {
          color: #f2f2f2;
          background-color: #1f1f1f;
        }

        /* Ensure the inner CodeMirror surface also follows dark mode. */
        .mdxeditor.dark .cm-editor,
        .mdxeditor.dark .cm-scroller,
        .mdxeditor.dark .cm-content {
          background-color: #0b0b0b;
          color: #f1f1f1;
        }

        .mdxeditor.dark .cm-gutters {
          background-color: #0b0b0b;
          color: #8f8f8f;
          border-right: 1px solid #2a2a2a;
        }

        .mdxeditor.dark .cm-activeLine,
        .mdxeditor.dark .cm-activeLineGutter {
          background-color: #151515;
        }

        .mdxeditor.dark .cm-selectionBackground,
        .mdxeditor.dark .cm-focused .cm-selectionBackground,
        .mdxeditor.dark .cm-line::selection,
        .mdxeditor.dark .cm-line > span::selection {
          background-color: #2b3544;
        }

        .mdxeditor.dark .cm-cursor {
          border-left-color: #f1f1f1;
        }

        /* ── Dialog / popover visual polish ─────────────────────────────── */

        /* Remove weak drop-shadow on all dialogs/popovers */
        [class*="_dialogContent_"],
        [class*="_largeDialogContent_"],
        [class*="_linkDialogPopoverContent_"],
        [class*="_popoverContent_"] {
          filter: none !important;
        }

        /* === Image dialog (_dialogContent_) === */

        [class*="_dialogContent_"] {
          flex-direction: column !important;
          align-items: stretch !important;
          padding: 0 !important;
          overflow: hidden !important;
          min-width: 420px !important;
        }

        html:not(.dark) [class*="_dialogContent_"] {
          background-color: #ffffff !important;
          border: 1px solid #e5e7eb !important;
          border-radius: 0.5rem !important;
          box-shadow: 0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08) !important;
        }

        .dark [class*="_dialogContent_"] {
          background-color: #000000 !important;
          border: 1px solid #2a2a2a !important;
          border-radius: 0.5rem !important;
          box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.4) !important;
        }

        /* Title (Dialog.Title renders as plain <h2>, no data attribute) */
        [class*="_dialogContent_"] h2 {
          font-size: 0.875rem !important;
          font-weight: 500 !important;
          padding: 1rem 1.25rem !important;
          margin: 0 !important;
        }

        html:not(.dark) [class*="_dialogContent_"] h2 {
          border-bottom: 1px solid #e5e7eb !important;
          color: #111827 !important;
        }

        .dark [class*="_dialogContent_"] h2 {
          border-bottom: 1px solid #2a2a2a !important;
          color: #f1f1f1 !important;
        }

        /* Form body */
        [class*="_dialogContent_"] form[class*="_multiFieldForm_"] {
          padding: 1.25rem !important;
          gap: 0.875rem !important;
        }

        /* Footer: last div in form = buttons row */
        html:not(.dark) [class*="_dialogContent_"] form > div:last-child {
          border-top: 1px solid #e5e7eb !important;
          padding: 0.75rem 1.25rem !important;
          margin: 0 -1.25rem -1.25rem !important;
          background-color: #f9fafb !important;
        }

        .dark [class*="_dialogContent_"] form > div:last-child {
          border-top: 1px solid #2a2a2a !important;
          padding: 0.75rem 1.25rem !important;
          margin: 0 -1.25rem -1.25rem !important;
          background-color: #0f0f0f !important;
        }

        /* Labels */
        html:not(.dark) [class*="_dialogContent_"] label {
          color: #374151 !important;
          font-weight: 500 !important;
        }

        .dark [class*="_dialogContent_"] label {
          color: #9a9a9a !important;
          font-weight: 500 !important;
        }

        /* Text inputs */
        html:not(.dark) [class*="_dialogContent_"] [class*="_textInput_"] {
          background-color: #f9fafb !important;
          border: 1px solid #e5e7eb !important;
          border-radius: 0.375rem !important;
          color: #111827 !important;
        }

        .dark [class*="_dialogContent_"] [class*="_textInput_"] {
          background-color: #111111 !important;
          border: 1px solid #2f2f2f !important;
          border-radius: 0.375rem !important;
          color: #f1f1f1 !important;
        }

        /* === Overlay === */
        [class*="_dialogOverlay_"] {
          background-color: #000000 !important;
          opacity: 0.4 !important;
        }

        /* === Buttons (primary = Save, secondary = Cancel) === */

        html:not(.dark) [class*="_primaryButton_"] {
          background-color: #111827 !important;
          border: 1px solid #111827 !important;
          color: #ffffff !important;
          border-radius: 0.375rem !important;
          font-size: 0.875rem !important;
          padding: 0.375rem 1rem !important;
          cursor: pointer !important;
        }
        html:not(.dark) [class*="_primaryButton_"]:hover {
          background-color: #374151 !important;
          border-color: #374151 !important;
        }

        .dark [class*="_primaryButton_"] {
          background-color: #f1f1f1 !important;
          border: 1px solid #f1f1f1 !important;
          color: #000000 !important;
          border-radius: 0.375rem !important;
          font-size: 0.875rem !important;
          padding: 0.375rem 1rem !important;
          cursor: pointer !important;
        }
        .dark [class*="_primaryButton_"]:hover {
          background-color: #d6d6d6 !important;
          border-color: #d6d6d6 !important;
        }

        html:not(.dark) [class*="_secondaryButton_"] {
          background-color: #ffffff !important;
          border: 1px solid #e5e7eb !important;
          color: #374151 !important;
          border-radius: 0.375rem !important;
          font-size: 0.875rem !important;
          padding: 0.375rem 1rem !important;
          cursor: pointer !important;
        }
        html:not(.dark) [class*="_secondaryButton_"]:hover {
          background-color: #f9fafb !important;
        }

        .dark [class*="_secondaryButton_"] {
          background-color: transparent !important;
          border: 1px solid #2a2a2a !important;
          color: #e5e5e5 !important;
          border-radius: 0.375rem !important;
          font-size: 0.875rem !important;
          padding: 0.375rem 1rem !important;
          cursor: pointer !important;
        }
        .dark [class*="_secondaryButton_"]:hover {
          background-color: #161616 !important;
        }

        /* === Link dialog popover (contextual — appears near cursor/link) === */

        html:not(.dark) [class*="_linkDialogPopoverContent_"] {
          background-color: #ffffff !important;
          border: 1px solid #e5e7eb !important;
          border-radius: 0.5rem !important;
          box-shadow: 0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06) !important;
          padding: 0 !important;
          gap: 0 !important;
          flex-direction: column !important;
          align-items: stretch !important;
          overflow: hidden !important;
        }

        .dark [class*="_linkDialogPopoverContent_"] {
          background-color: #000000 !important;
          border: 1px solid #2a2a2a !important;
          border-radius: 0.5rem !important;
          box-shadow: 0 8px 30px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3) !important;
          padding: 0 !important;
          gap: 0 !important;
          flex-direction: column !important;
          align-items: stretch !important;
          overflow: hidden !important;
        }

        /* "Create link" title */
        [class*="_linkDialogPopoverContent_"]:has([class*="_linkDialogEditForm_"])::before {
          content: "Create link";
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          padding: 1rem 1.25rem;
        }

        html:not(.dark) [class*="_linkDialogPopoverContent_"]:has([class*="_linkDialogEditForm_"])::before {
          border-bottom: 1px solid #e5e7eb;
          color: #111827;
        }

        .dark [class*="_linkDialogPopoverContent_"]:has([class*="_linkDialogEditForm_"])::before {
          border-bottom: 1px solid #2a2a2a;
          color: #f1f1f1;
        }

        /* Edit form body */
        [class*="_linkDialogEditForm_"] {
          padding: 1.25rem !important;
          gap: 0.875rem !important;
        }

        /* Footer: buttons row */
        html:not(.dark) [class*="_linkDialogEditForm_"] > div:last-child {
          border-top: 1px solid #e5e7eb !important;
          padding: 0.75rem 1.25rem !important;
          margin: 0 -1.25rem -1.25rem !important;
          background-color: #f9fafb !important;
        }

        .dark [class*="_linkDialogEditForm_"] > div:last-child {
          border-top: 1px solid #2a2a2a !important;
          padding: 0.75rem 1.25rem !important;
          margin: 0 -1.25rem -1.25rem !important;
          background-color: #0f0f0f !important;
        }

        html:not(.dark) [class*="_linkDialogEditForm_"] label {
          color: #374151 !important;
          font-weight: 500 !important;
        }
        .dark [class*="_linkDialogEditForm_"] label {
          color: #9a9a9a !important;
          font-weight: 500 !important;
        }

        /* Link dialog input wrapper */
        html:not(.dark) [class*="_linkDialogInputWrapper_"] {
          background-color: #f9fafb !important;
          border: 1px solid #e5e7eb !important;
          border-radius: 0.375rem !important;
        }
        .dark [class*="_linkDialogInputWrapper_"] {
          background-color: #111111 !important;
          border: 1px solid #2f2f2f !important;
          border-radius: 0.375rem !important;
        }

        /* Link text inputs */
        html:not(.dark) [class*="_linkDialogEditForm_"] [class*="_textInput_"] {
          background-color: #f9fafb !important;
          border: 1px solid #e5e7eb !important;
          border-radius: 0.375rem !important;
          color: #111827 !important;
        }
        .dark [class*="_linkDialogEditForm_"] [class*="_textInput_"] {
          background-color: #111111 !important;
          border: 1px solid #2f2f2f !important;
          border-radius: 0.375rem !important;
          color: #f1f1f1 !important;
        }

        /* Link dialog input text color */
        html:not(.dark) [class*="_linkDialogInput_"] {
          color: #111827 !important;
        }
        .dark [class*="_linkDialogInput_"] {
          color: #f1f1f1 !important;
        }
      `}</style>
      {css && <style>{css}</style>}
      <MDXEditor
        className={themeClass}
        markdown={markdown}
        onChange={onChange}
        plugins={[
          headingsPlugin(),
          listsPlugin(),
          quotePlugin(),
          thematicBreakPlugin(),
          markdownShortcutPlugin(),
          codeBlockPlugin({ defaultCodeBlockLanguage: "ts" }),
          codeMirrorPlugin({
            codeBlockLanguages: {
              ts: "TypeScript",
              tsx: "TSX",
              js: "JavaScript",
              jsx: "JSX",
              css: "CSS",
              bash: "Bash",
              json: "JSON",
              "": "Plain",
            },
          }),
          frontmatterPlugin(),
          linkPlugin(),
          linkDialogPlugin(),
          imagePlugin({ imagePreviewHandler: imagePreviewHandler ?? null }),
          tablePlugin(),
          diffSourcePlugin({ viewMode: "rich-text" }),
          jsxPlugin({
            jsxComponentDescriptors: [
              {
                name: "Note",
                kind: "flow",
                hasChildren: true,
                props: [{ name: "title", type: "string" }],
                Editor: GenericJsxEditor,
              },
            ],
          }),
          toolbarPlugin({
            toolbarContents: () => (
              <DiffSourceToggleWrapper>
                <LinkImageCoordinator />
                <UndoRedo />
                <Separator />
                <BoldItalicUnderlineToggles />
                <CodeToggle />
                <HighlightToggle />
                <Separator />
                <StrikeThroughSupSubToggles />
                <Separator />
                <ListsToggle />
                <Separator />
                <BlockTypeSelect />
                <Separator />
                <CreateLink />
                <InsertImage />
                <Separator />
                <InsertTable />
                <InsertThematicBreak />
                <InsertCodeBlock />
                <Separator />
                <label className="ml-1 mr-[5px] inline-flex items-center gap-1 text-[11px] text-gray-600 dark:text-[#a8a8a8]">
                  <span>Zoom</span>
                  <button
                    type="button"
                    onClick={() => updateZoom(zoom - ZOOM_STEP)}
                    disabled={zoom <= MIN_ZOOM}
                    className="h-6 w-6 rounded border border-gray-300 dark:border-[#3a3a3a] bg-white dark:bg-[#0f0f0f] text-xs text-gray-900 dark:text-[#f1f1f1] disabled:opacity-50"
                    aria-label="Zoom out"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onClick={() => updateZoom(100)}
                    className="h-6 min-w-12 rounded border border-gray-300 dark:border-[#3a3a3a] bg-white dark:bg-[#0f0f0f] px-2 text-xs text-gray-900 dark:text-[#f1f1f1]"
                    aria-label="Reset zoom to 100 percent"
                  >
                    {zoom}%
                  </button>
                  <button
                    type="button"
                    onClick={() => updateZoom(zoom + ZOOM_STEP)}
                    disabled={zoom >= MAX_ZOOM}
                    className="h-6 w-6 rounded border border-gray-300 dark:border-[#3a3a3a] bg-white dark:bg-[#0f0f0f] text-xs text-gray-900 dark:text-[#f1f1f1] disabled:opacity-50"
                    aria-label="Zoom in"
                  >
                    +
                  </button>
                </label>
                <Separator />
                <label className="ml-1 mr-[5px] inline-flex items-center gap-1 text-[11px] text-gray-600 dark:text-[#a8a8a8]">
                  <span>Max width</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={maxWidthInput}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/\D+/g, "");
                      updateMaxWidth(digitsOnly);
                    }}
                    onBlur={(e) => {
                      if (!e.target.value) return;
                      const parsed = Number.parseInt(e.target.value, 10);
                      if (!Number.isFinite(parsed)) return;
                      if (parsed < MIN_EDITOR_WIDTH) updateMaxWidth(String(MIN_EDITOR_WIDTH));
                    }}
                    placeholder="px"
                    aria-label="Max content width in pixels"
                    className="w-20 rounded border border-gray-300 dark:border-[#3a3a3a] bg-white dark:bg-[#0f0f0f] px-2 py-1 text-xs text-gray-900 dark:text-[#f1f1f1]"
                  />
                  <span className="text-[10px]">px</span>
                </label>
              </DiffSourceToggleWrapper>
            ),
          }),
        ]}
        contentEditableClassName={contentClassName}
      />
    </div>
  );
}
