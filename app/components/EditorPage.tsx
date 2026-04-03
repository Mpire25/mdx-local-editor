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
  dirHandle?: FileSystemDirectoryHandle;
  entryId: string;
  name: string;
};

type ProfileSource = "file" | "folder" | "default";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type FSHandleWithPermission = FileSystemHandle & {
  requestPermission(opts: { mode: "read" | "readwrite" }): Promise<PermissionState>;
};

const STORAGE_KEY = "mdx-editor-workspace";
const CSS_PROFILES_KEY = "mdx-editor-css-profiles";
const DEFAULT_CSS_KEY = "mdx-editor-default-css";

async function listMdxFiles(dir: FileSystemDirectoryHandle): Promise<string[]> {
  const names: string[] = [];
  const iterable = dir as unknown as AsyncIterable<[string, FileSystemHandle]>;
  for await (const [name, handle] of iterable) {
    if (handle.kind === "file" && name.endsWith(".mdx")) names.push(name);
  }
  return names.sort();
}

// Profile key derivation:
// - standalone file entry  → entryId
// - file inside a folder   → "entryId:filename"  (file-level)
//                            "entryId"            (folder-level, checked as fallback)
function resolveProfile(
  selected: SelectedFile | null,
  entries: StoredEntry[],
  profiles: Record<string, string>,
  defaultCss: string,
): { css: string; source: ProfileSource } {
  if (!selected) return { css: defaultCss, source: "default" };

  const entry = entries.find((e) => e.id === selected.entryId);
  const inFolder = entry?.kind === "directory";
  const fileKey = inFolder ? `${selected.entryId}:${selected.name}` : selected.entryId;

  if (profiles[fileKey]) return { css: profiles[fileKey], source: "file" };
  if (inFolder && profiles[selected.entryId]) return { css: profiles[selected.entryId], source: "folder" };
  return { css: defaultCss, source: "default" };
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

  // CSS profiles
  const [cssProfiles, setCssProfiles] = useState<Record<string, string>>({});
  const [defaultCss, setDefaultCss] = useState("");

  // CSS editor modal: null = closed, "default" = global default, otherwise a profile key
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [editingValue, setEditingValue] = useState("");

  // Rename
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const renameInputRef = useRef<HTMLInputElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const pendingContent = useRef("");
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Init ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      get<StoredEntry[]>(STORAGE_KEY),
      get<Record<string, string>>(CSS_PROFILES_KEY),
      get<string>(DEFAULT_CSS_KEY),
    ]).then(([storedEntries, storedProfiles, storedDefault]) => {
      if (storedEntries?.length) setEntries(storedEntries);
      if (storedProfiles) setCssProfiles(storedProfiles);
      if (typeof storedDefault === "string") setDefaultCss(storedDefault);
    });
  }, []);

  useEffect(() => {
    if (renamingKey) renameInputRef.current?.focus();
  }, [renamingKey]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ─── Persistence ──────────────────────────────────────────────────────────

  async function persistEntries(next: StoredEntry[]) {
    setEntries(next);
    await set(STORAGE_KEY, next);
  }

  async function persistProfiles(next: Record<string, string>) {
    setCssProfiles(next);
    await set(CSS_PROFILES_KEY, next);
  }

  async function persistDefaultCss(css: string) {
    setDefaultCss(css);
    await set(DEFAULT_CSS_KEY, css);
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
      await persistEntries([...entries, entry]);
    } catch { /* cancelled */ }
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
      await persistEntries([...entries, entry]);
    } catch { /* cancelled */ }
  }

  function removeEntry(id: string) {
    persistEntries(entries.filter((e) => e.id !== id));
    if (selected?.entryId === id) { setSelected(null); setContent(""); }
    setFolderFiles((prev) => { const n = { ...prev }; delete n[id]; return n; });
    setExpanded((prev) => { const s = new Set(prev); s.delete(id); return s; });
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
      setFolderFiles((prev) => ({ ...prev, [id]: [] }));
      const files = await listMdxFiles(dir);
      setFolderFiles((prev) => ({ ...prev, [id]: files }));
    }
    setExpanded((prev) => new Set([...prev, id]));
  }

  // ─── Opening files ────────────────────────────────────────────────────────

  async function openFileHandle(
    fileHandle: FileSystemFileHandle,
    entryId: string,
    dirHandle?: FileSystemDirectoryHandle,
  ) {
    const perm = await (fileHandle as unknown as FSHandleWithPermission).requestPermission({ mode: "readwrite" });
    if (perm !== "granted") return;
    const file = await fileHandle.getFile();
    const text = await file.text();
    setContent(text);
    pendingContent.current = text;
    setSaved(false);
    setSelected({ fileHandle, dirHandle, entryId, name: fileHandle.name });
  }

  async function openFolderFile(filename: string, entryId: string) {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry || entry.kind !== "directory") return;
    const dir = entry.handle as FileSystemDirectoryHandle;
    const fileHandle = await dir.getFileHandle(filename);
    await openFileHandle(fileHandle, entryId, dir);
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

  // ─── Renaming ─────────────────────────────────────────────────────────────

  function startRename(key: string, currentName: string, e: React.MouseEvent) {
    e.stopPropagation();
    setRenamingKey(key);
    setRenameValue(currentName.replace(/\.mdx$/, ""));
  }

  async function commitRename() {
    if (!renamingKey || !renameValue.trim()) { setRenamingKey(null); return; }
    const newName = renameValue.trim().endsWith(".mdx") ? renameValue.trim() : renameValue.trim() + ".mdx";

    if (renamingKey.includes(":")) {
      const [entryId, oldName] = renamingKey.split(":");
      if (newName === oldName) { setRenamingKey(null); return; }

      const entry = entries.find((e) => e.id === entryId);
      if (!entry || entry.kind !== "directory") { setRenamingKey(null); return; }
      const dir = entry.handle as FileSystemDirectoryHandle;

      const oldHandle = await dir.getFileHandle(oldName);
      const file = await oldHandle.getFile();
      const fileContent = await file.text();
      const newHandle = await dir.getFileHandle(newName, { create: true });
      const writable = await newHandle.createWritable();
      await writable.write(fileContent);
      await writable.close();
      await dir.removeEntry(oldName);

      setFolderFiles((prev) => ({
        ...prev,
        [entryId]: (prev[entryId] ?? []).map((f) => (f === oldName ? newName : f)).sort(),
      }));

      if (selected?.entryId === entryId && selected.name === oldName) {
        setSelected({ fileHandle: newHandle, dirHandle: dir, entryId, name: newName });
      }
    }

    setRenamingKey(null);
  }

  // ─── CSS profiles ─────────────────────────────────────────────────────────

  function openEditor(key: string, label: string) {
    setEditingKey(key);
    setEditingLabel(label);
    setEditingValue(key === "default" ? defaultCss : (cssProfiles[key] ?? ""));
  }

  async function saveProfile() {
    if (editingKey === null) return;
    if (editingKey === "default") {
      await persistDefaultCss(editingValue);
    } else {
      const next = { ...cssProfiles };
      if (editingValue.trim()) next[editingKey] = editingValue;
      else delete next[editingKey];
      await persistProfiles(next);
    }
    setEditingKey(null);
  }

  async function clearProfile() {
    if (editingKey === null) return;
    if (editingKey === "default") {
      await persistDefaultCss("");
    } else {
      const next = { ...cssProfiles };
      delete next[editingKey];
      await persistProfiles(next);
    }
    setEditingKey(null);
  }

  // ─── Derived ──────────────────────────────────────────────────────────────

  const { css: resolvedCss, source: profileSource } = resolveProfile(selected, entries, cssProfiles, defaultCss);

  const sourceLabel: Record<ProfileSource, string> = {
    file: "file css",
    folder: "folder css",
    default: "default css",
  };

  const sourceBadgeClass: Record<ProfileSource, string> = {
    file: "bg-indigo-100 text-indigo-500",
    folder: "bg-violet-100 text-violet-500",
    default: "bg-gray-100 text-gray-400",
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-white text-gray-900">

      {/* ── CSS Profile Editor Modal ────────────────────────────────────── */}
      {editingKey !== null && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-8">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {editingKey === "default" ? "Default CSS Profile" : "CSS Profile"}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{editingLabel}</p>
              </div>
              <button onClick={() => setEditingKey(null)} className="text-gray-400 hover:text-gray-700 text-lg leading-none px-1">✕</button>
            </div>
            <p className="px-5 py-2 text-xs text-gray-400 bg-gray-50 border-b border-gray-100 shrink-0">
              Target the editor content with <code className="font-mono bg-gray-100 px-1 rounded">.mdx-content</code> — e.g. <code className="font-mono bg-gray-100 px-1 rounded">.mdx-content h1 {"{ color: red; }"}</code>
            </p>
            <textarea
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              placeholder={`.mdx-content {\n  font-family: system-ui;\n  color: #111;\n}\n\n.mdx-content h1 { font-size: 2rem; font-weight: 700; }\n.mdx-content p { line-height: 1.7; }`}
              className="flex-1 font-mono text-xs p-4 resize-none outline-none min-h-72 bg-gray-50 text-gray-900 placeholder-gray-400"
              spellCheck={false}
            />
            <div className="flex items-center gap-2 px-5 py-3 border-t border-gray-200 shrink-0">
              <button onClick={saveProfile} className="px-4 py-1.5 bg-gray-900 text-white text-sm rounded hover:bg-gray-700">
                Save
              </button>
              {editingKey !== "default" && (
                <button
                  onClick={() => setEditingValue(defaultCss)}
                  className="px-4 py-1.5 border border-gray-200 text-sm rounded hover:bg-gray-50"
                >
                  Copy from default
                </button>
              )}
              <button onClick={clearProfile} className="px-4 py-1.5 border border-gray-200 text-sm rounded hover:bg-gray-50 text-red-500 ml-auto">
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside className="w-60 shrink-0 border-r border-gray-200 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Files</span>
          <div className="flex items-center gap-1">
            {/* Default CSS button */}
            <button
              onClick={() => openEditor("default", "Global default")}
              className={`w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-sm ${defaultCss ? "text-indigo-400" : "text-gray-400 hover:text-gray-700"}`}
              title="Edit default CSS profile"
            >
              ⚙
            </button>
            {/* Add folder/file */}
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
                  <button onClick={addFolder} className="w-full text-left px-4 py-2 hover:bg-gray-50">Open Folder</button>
                  <button onClick={addFile} className="w-full text-left px-4 py-2 hover:bg-gray-50">Open File</button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {entries.length === 0 ? (
            <p className="text-xs text-gray-400 px-4 py-6 text-center leading-relaxed">
              Press <span className="font-medium text-gray-500">+</span> to open a folder or file
            </p>
          ) : (
            <ul>
              {entries.map((entry) => {
                const hasProfile = !!cssProfiles[entry.id];
                return (
                  <li key={entry.id} className="group">
                    <div className="flex items-center pr-1 hover:bg-gray-50">
                      {entry.kind === "directory" ? (
                        <button
                          onClick={() => toggleFolder(entry)}
                          className="flex-1 flex items-center gap-2 px-3 py-2 text-sm text-left truncate min-w-0"
                        >
                          <span className="text-gray-400 text-[10px] w-2 shrink-0">{expanded.has(entry.id) ? "▼" : "▶"}</span>
                          <span className="truncate font-medium">{entry.name}</span>
                          {hasProfile && <span className="shrink-0 text-[10px] px-1 py-0.5 rounded bg-indigo-100 text-indigo-500 font-mono leading-none">css</span>}
                        </button>
                      ) : (
                        <button
                          onClick={() => openFileHandle(entry.handle as FileSystemFileHandle, entry.id)}
                          className={`flex-1 flex items-center gap-2 px-3 py-2 text-sm text-left truncate min-w-0 ${selected?.entryId === entry.id ? "font-medium" : ""}`}
                        >
                          <span className="truncate">{entry.name}</span>
                          {hasProfile && <span className="shrink-0 text-[10px] px-1 py-0.5 rounded bg-indigo-100 text-indigo-500 font-mono leading-none">css</span>}
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditor(entry.id, entry.name); }}
                        title="Edit CSS profile"
                        className={`opacity-0 group-hover:opacity-100 shrink-0 px-1 py-1 text-xs ${hasProfile ? "text-indigo-400 hover:text-indigo-600" : "text-gray-300 hover:text-indigo-400"}`}
                      >
                        ◈
                      </button>
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
                        {(folderFiles[entry.id] ?? []).map((filename) => {
                          const renameKey = `${entry.id}:${filename}`;
                          const fileProfileKey = `${entry.id}:${filename}`;
                          const isRenaming = renamingKey === renameKey;
                          const isSelected = selected?.name === filename && selected?.entryId === entry.id;
                          const fileHasProfile = !!cssProfiles[fileProfileKey];

                          return (
                            <li key={filename} className="group/file relative">
                              {isRenaming ? (
                                <input
                                  ref={renameInputRef}
                                  value={renameValue}
                                  onChange={(e) => setRenameValue(e.target.value)}
                                  onBlur={commitRename}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") commitRename();
                                    if (e.key === "Escape") setRenamingKey(null);
                                  }}
                                  className="w-full pl-8 pr-3 py-1.5 text-sm bg-blue-50 border-b border-blue-300 outline-none"
                                />
                              ) : (
                                <>
                                  <button
                                    onClick={() => openFolderFile(filename, entry.id)}
                                    className={`w-full text-left pl-8 pr-14 py-1.5 text-sm truncate hover:bg-gray-50 ${isSelected ? "bg-gray-100 font-medium" : ""}`}
                                  >
                                    {filename.replace(".mdx", "")}
                                    {fileHasProfile && <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded bg-indigo-100 text-indigo-500 font-mono leading-none">css</span>}
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); openEditor(fileProfileKey, `${entry.name} / ${filename}`); }}
                                    title="Edit file CSS profile"
                                    className={`absolute right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover/file:opacity-100 text-xs px-1 ${fileHasProfile ? "text-indigo-400 hover:text-indigo-600" : "text-gray-300 hover:text-indigo-400"}`}
                                  >
                                    ◈
                                  </button>
                                  <button
                                    onClick={(e) => startRename(renameKey, filename, e)}
                                    title="Rename"
                                    className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/file:opacity-100 text-gray-400 hover:text-gray-700 text-xs px-1"
                                  >
                                    ✎
                                  </button>
                                </>
                              )}
                            </li>
                          );
                        })}
                        {(folderFiles[entry.id] ?? []).length === 0 && (
                          <li className="pl-8 pr-3 py-1.5 text-xs text-gray-400">No .mdx files</li>
                        )}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* ── Editor ─────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {selected ? (
          <>
            <div className="flex items-center justify-between px-6 py-2 border-b border-gray-200 text-xs text-gray-400">
              <span>{selected.name}</span>
              <div className="flex items-center gap-3">
                {resolvedCss && (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${sourceBadgeClass[profileSource]}`}>
                    {sourceLabel[profileSource]}
                  </span>
                )}
                <span>{saving ? "Saving…" : saved ? "Saved" : ""}</span>
              </div>
            </div>
            <div
              className="flex-1 overflow-y-auto"
              style={resolvedCss ? { background: "var(--background, white)" } : undefined}
            >
              <MdxEditor
                key={selected.entryId + selected.name}
                markdown={content}
                onChange={handleChange}
                css={resolvedCss || undefined}
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
