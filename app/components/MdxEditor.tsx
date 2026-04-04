"use client";

import { useRef } from "react";
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
} from "@mdxeditor/editor";

interface Props {
  markdown: string;
  onChange: (value: string) => void;
  css?: string;
  usingCustomCss?: boolean;
  theme?: "light" | "dark";
}

export default function MdxEditor({
  markdown,
  onChange,
  css,
  usingCustomCss = false,
  theme = "light",
}: Props) {
  const shellRef = useRef<HTMLDivElement>(null);

  const themeClass = theme === "dark" ? "dark" : "light";
  const contentClassName = [
    "mdx-content max-w-none p-4 min-h-[60vh] focus:outline-none",
    "mdx-content--bounded",
    usingCustomCss ? "" : "bg-transparent",
  ]
    .filter(Boolean)
    .join(" ");

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
          imagePlugin(),
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
                  <span>Max width</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/\D+/g, "");
                      if (digitsOnly !== e.target.value) e.target.value = digitsOnly;

                      if (!digitsOnly) {
                        shellRef.current?.style.removeProperty("--mdx-rich-max-width");
                        return;
                      }

                      const parsed = Number.parseInt(digitsOnly, 10);
                      if (!Number.isFinite(parsed)) return;
                      const clamped = Math.max(300, parsed);
                      shellRef.current?.style.setProperty("--mdx-rich-max-width", `${clamped}px`);
                    }}
                    onBlur={(e) => {
                      if (!e.target.value) return;
                      const parsed = Number.parseInt(e.target.value, 10);
                      if (!Number.isFinite(parsed)) return;
                      if (parsed < 300) e.target.value = "300";
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
