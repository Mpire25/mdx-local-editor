"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const MdxEditor = dynamic(() => import("./MdxEditor"), { ssr: false });

export default function EditorPage({ files: initialFiles }: { files: string[] }) {
  const [files, setFiles] = useState(initialFiles);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const pendingContent = useRef<string>("");
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!selected) return;
    fetch(`/api/files/${selected}`)
      .then((r) => r.text())
      .then((text) => {
        setContent(text);
        pendingContent.current = text;
      });
  }, [selected]);

  useEffect(() => {
    if (renamingFile) renameInputRef.current?.focus();
  }, [renamingFile]);

  function handleChange(value: string) {
    pendingContent.current = value;
    setSaved(false);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => autoSave(value), 1500);
  }

  async function autoSave(value: string) {
    if (!selected) return;
    setSaving(true);
    await fetch(`/api/files/${selected}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: value }),
    });
    setSaving(false);
    setSaved(true);
  }

  function startRename(file: string, e: React.MouseEvent) {
    e.stopPropagation();
    setRenamingFile(file);
    setRenameValue(file.replace(".mdx", ""));
  }

  async function commitRename() {
    if (!renamingFile || !renameValue.trim()) {
      setRenamingFile(null);
      return;
    }
    const newName = renameValue.trim().endsWith(".mdx")
      ? renameValue.trim()
      : renameValue.trim() + ".mdx";
    if (newName === renamingFile) {
      setRenamingFile(null);
      return;
    }
    const res = await fetch(`/api/files/${renamingFile}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newName }),
    });
    if (res.ok) {
      const { name } = await res.json();
      setFiles((prev) => prev.map((f) => (f === renamingFile ? name : f)).sort());
      if (selected === renamingFile) setSelected(name);
    }
    setRenamingFile(null);
  }

  return (
    <div className="flex h-screen bg-white text-gray-900">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-gray-200 flex flex-col">
        <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-200">
          Projects
        </div>
        <ul className="flex-1 overflow-y-auto">
          {files.map((file) => (
            <li key={file} className="group relative">
              {renamingFile === file ? (
                <input
                  ref={renameInputRef}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") setRenamingFile(null);
                  }}
                  className="w-full px-4 py-2 text-sm bg-blue-50 border-b border-blue-300 outline-none"
                />
              ) : (
                <button
                  onClick={() => setSelected(file)}
                  className={`w-full text-left px-4 py-2 text-sm truncate pr-8 hover:bg-gray-100 transition-colors ${
                    selected === file ? "bg-gray-100 font-medium" : ""
                  }`}
                >
                  {file.replace(".mdx", "")}
                </button>
              )}
              {renamingFile !== file && (
                <button
                  onClick={(e) => startRename(file, e)}
                  title="Rename"
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700 text-xs px-1"
                >
                  ✎
                </button>
              )}
            </li>
          ))}
        </ul>
      </aside>

      {/* Editor area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {selected ? (
          <>
            <div className="flex items-center justify-between px-6 py-2 border-b border-gray-200 text-xs text-gray-400">
              <span>{selected}</span>
              <span>{saving ? "Saving…" : saved ? "Saved" : ""}</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {content !== "" && (
                <MdxEditor markdown={content} onChange={handleChange} />
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Select a file to edit
          </div>
        )}
      </main>
    </div>
  );
}
