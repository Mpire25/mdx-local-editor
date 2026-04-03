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
}

export default function MdxEditor({ markdown, onChange }: Props) {
  return (
    <MDXEditor
      key={markdown.slice(0, 40)}
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
      contentEditableClassName="prose max-w-none p-4 min-h-[60vh] focus:outline-none"
    />
  );
}
