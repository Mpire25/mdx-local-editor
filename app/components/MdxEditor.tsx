"use client";

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
  const themeClass = theme === "dark" ? "dark" : "light";
  const contentClassName = [
    "mdx-content max-w-none p-4 min-h-[60vh] focus:outline-none",
    usingCustomCss ? "" : "bg-transparent",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={`${themeClass} mdx-editor-shell`}>
      {theme === "dark" && (
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
        `}</style>
      )}
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
              </DiffSourceToggleWrapper>
            ),
          }),
        ]}
        contentEditableClassName={contentClassName}
      />
    </div>
  );
}
