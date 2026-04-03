"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { get, set } from "idb-keyval";

const MdxEditor = dynamic(() => import("./MdxEditor"), { ssr: false });

// ─── Types ───────────────────────────────────────────────────────────────────

type StoredEntry = {
  id: string;
  kind: "file" | "directory";
  handle: FileSystemHandle;
  name: string;
};

type SelectedFile = {
  fileHandle: FileSystemFileHandle;
  entryId: string;
  name: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

// FileSystemHandle.requestPermission is not in TypeScript's built-in lib
type FSHandleWithPermission = FileSystemHandle & {
  requestPermission(opts: { mode: "read" | "readwrite" }): Promise<PermissionState>;
};

const STORAGE_KEY = "mdx-editor-workspace";

async function listMdxFiles(dir: FileSystemDirectoryHandle): Promise<string[]> {
  const names: string[] = [];
  const iterable = dir as unknown as AsyncIterable<[string, FileSystemHandle]>;
  for await (const [name, handle] of iterable) {
    if (handle.kind === "file" && name.endsWith(".mdx")) names.push(name);
  }
  return names.sort();
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function EditorPage() {
  const [entries, setEntries] = useState<StoredEntry[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [folderFiles, setFolderFiles] = useState<Record<string, string[]>>({});
  const [selected, setSelected] = useState<SelectedFile | null>(null);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const pendingContent = useRef("");
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load persisted entries from IndexedDB on mount
  useEffect(() => {
    get<StoredEntry[]>(STORAGE_KEY).then((stored) => {
      if (stored?.length) setEntries(stored);
    });
  }, []);

  // Close add menu on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function persist(next: StoredEntry[]) {
    setEntries(next);
    await set(STORAGE_KEY, next);
  }

  // ─── Adding entries ───────────────────────────────────────────────────────

  async function addFolder() {
    setShowAddMenu(false);
    if (!("showDirectoryPicker" in window)) {
      alert("Your browser doesn't support folder picking. Use Chrome or Edge.");
      return;
    }
    try {
      const dir = await (window as typeof window & { showDirectoryPicker: (o?: object) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker({ mode: "readwrite" });
      const entry: StoredEntry = { id: crypto.randomUUID(), kind: "directory", handle: dir, name: dir.name };
      const files = await listMdxFiles(dir);
      setFolderFiles((prev) => ({ ...prev, [entry.id]: files }));
      setExpanded((prev) => new Set([...prev, entry.id]));
      await persist([...entries, entry]);
    } catch {
      // user cancelled
    }
  }

  async function addFile() {
    setShowAddMenu(false);
    if (!("showOpenFilePicker" in window)) {
      alert("Your browser doesn't support file picking. Use Chrome or Edge.");
      return;
    }
    try {
      const [handle] = await (window as typeof window & { showOpenFilePicker: (o?: object) => Promise<FileSystemFileHandle[]> }).showOpenFilePicker({
        types: [{ description: "MDX Files", accept: { "text/markdown": [".mdx"] } }],
      });
      const entry: StoredEntry = { id: crypto.randomUUID(), kind: "file", handle, name: handle.name };
      await persist([...entries, entry]);
    } catch {
      // user cancelled
    }
  }

  function removeEntry(id: string) {
    persist(entries.filter((e) => e.id !== id));
    if (selected?.entryId === id) {
      setSelected(null);
      setContent("");
    }
    setFolderFiles((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
    setExpanded((prev) => {
      const s = new Set(prev);
      s.delete(id);
      return s;
    });
  }

  // ─── Folder expand ────────────────────────────────────────────────────────

  async function toggleFolder(entry: StoredEntry) {
    const id = entry.id;
    const dir = entry.handle as FileSystemDirectoryHandle;

    if (expanded.has(id)) {
      setExpanded((prev) => { const s = new Set(prev); s.delete(id); return s; });
      return;
    }

    const perm = await (dir as unknown as FSHandleWithPermission).requestPermission({ mode: "readwrite" });
    if (perm !== "granted") return;

    if (!folderFiles[id]) {
      const files = await listMdxFiles(dir);
      setFolderFiles((prev) => ({ ...prev, [id]: files }));
    }
    setExpanded((prev) => new Set([...prev, id]));
  }

  // ─── Opening files ────────────────────────────────────────────────────────

  async function openFileHandle(fileHandle: FileSystemFileHandle, entryId: string) {
    const perm = await (fileHandle as unknown as FSHandleWithPermission).requestPermission({ mode: "readwrite" });
    if (perm !== "granted") return;
    const file = await fileHandle.getFile();
    const text = await file.text();
    setContent(text);
    pendingContent.current = text;
    setSaved(false);
    setSelected({ fileHandle, entryId, name: fileHandle.name });
  }

  async function openFolderFile(filename: string, entryId: string) {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry || entry.kind !== "directory") return;
    const dir = entry.handle as FileSystemDirectoryHandle;
    const fileHandle = await dir.getFileHandle(filename);
    await openFileHandle(fileHandle, entryId);
  }

  // ─── Saving ───────────────────────────────────────────────────────────────

  function handleChange(value: string) {
    pendingContent.current = value;
    setSaved(false);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => autoSave(value), 1500);
  }

  async function autoSave(value: string) {
    if (!selected) return;
    setSaving(true);
    try {
      const writable = await selected.fileHandle.createWritable();
      await writable.write(value);
      await writable.close();
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-white text-gray-900">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r border-gray-200 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Files
          </span>
          <div className="relative" ref={addMenuRef}>
            <button
              onClick={() => setShowAddMenu((v) => !v)}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500 hover:text-gray-800 text-lg leading-none"
              title="Add folder or file"
            >
              +
            </button>
            {showAddMenu && (
              <div className="absolute right-0 top-7 z-10 bg-white border border-gray-200 rounded shadow-lg text-sm min-w-[140px] py-1">
                <button
                  onClick={addFolder}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50"
                >
                  Open Folder
                </button>
                <button
                  onClick={addFile}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50"
                >
                  Open File
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {entries.length === 0 ? (
            <p className="text-xs text-gray-400 px-4 py-6 text-center leading-relaxed">
              Press <span className="font-medium text-gray-500">+</span> to open a folder or file
            </p>
          ) : (
            <ul>
              {entries.map((entry) => (
                <li key={entry.id} className="group">
                  <div className="flex items-center pr-1 hover:bg-gray-50">
                    {entry.kind === "directory" ? (
                      <button
                        onClick={() => toggleFolder(entry)}
                        className="flex-1 flex items-center gap-2 px-3 py-2 text-sm text-left truncate"
                      >
                        <span className="text-gray-400 text-[10px] w-2 shrink-0">
                          {expanded.has(entry.id) ? "▼" : "▶"}
                        </span>
                        <span className="truncate font-medium">{entry.name}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => openFileHandle(entry.handle as FileSystemFileHandle, entry.id)}
                        className={`flex-1 px-3 py-2 text-sm text-left truncate ${selected?.entryId === entry.id ? "font-medium" : ""}`}
                      >
                        {entry.name}
                      </button>
                    )}
                    <button
                      onClick={() => removeEntry(entry.id)}
                      className="opacity-0 group-hover:opacity-100 shrink-0 px-1.5 py-1 text-gray-300 hover:text-red-400 text-xs"
                      title="Remove from sidebar"
                    >
                      ✕
                    </button>
                  </div>

                  {entry.kind === "directory" && expanded.has(entry.id) && (
                    <ul>
                      {(folderFiles[entry.id] ?? []).map((filename) => (
                        <li key={filename}>
                          <button
                            onClick={() => openFolderFile(filename, entry.id)}
                            className={`w-full text-left pl-8 pr-3 py-1.5 text-sm truncate hover:bg-gray-50 ${
                              selected?.name === filename && selected?.entryId === entry.id
                                ? "bg-gray-100 font-medium"
                                : ""
                            }`}
                          >
                            {filename.replace(".mdx", "")}
                          </button>
                        </li>
                      ))}
                      {(folderFiles[entry.id] ?? []).length === 0 && (
                        <li className="pl-8 pr-3 py-1.5 text-xs text-gray-400">
                          No .mdx files
                        </li>
                      )}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* Editor */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {selected ? (
          <>
            <div className="flex items-center justify-between px-6 py-2 border-b border-gray-200 text-xs text-gray-400">
              <span>{selected.name}</span>
              <span>{saving ? "Saving…" : saved ? "Saved" : ""}</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              <MdxEditor
                key={selected.entryId + selected.name}
                markdown={content}
                onChange={handleChange}
              />
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
