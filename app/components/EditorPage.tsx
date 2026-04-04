"use client";

import dynamic from "next/dynamic";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { get, set } from "idb-keyval";
import { useToast } from "./ToastProvider";

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

type ProfileSource = "file" | "folder" | "default" | "built-in";
type Theme = "light" | "dark";
type Notice = { title: string; message: string } | null;
type SaveTooltip = "save" | "saveAs" | null;

// ─── Built-in default CSS ─────────────────────────────────────────────────────

const BUILT_IN_LIGHT = `
.mdx-content {
  color: #374151;
  line-height: 1.75;
  font-size: 0.875rem;
}
.mdx-content > * + * { margin-top: 1rem; }
.mdx-content h1, .mdx-content h2, .mdx-content h3, .mdx-content h4 {
  color: #111827;
  font-weight: 600;
  line-height: 1.3;
}
.mdx-content h1 { font-size: 1.5rem; margin-top: 0.25rem; }
.mdx-content h2 { font-size: 1.25rem; margin-top: 2rem; }
.mdx-content h3 { font-size: 1.1rem; margin-top: 1.5rem; }
.mdx-content p, .mdx-content li { line-height: 1.75; }
.mdx-content ul { list-style: disc; padding-left: 1.25rem; }
.mdx-content ol { list-style: decimal; padding-left: 1.25rem; }
.mdx-content blockquote {
  border-left: 2px solid #e5e7eb;
  padding-left: 0.9rem;
  color: #6b7280;
}
.mdx-content code {
  background: #f3f4f6;
  color: #1f2937;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  font-size: 0.86em;
  padding: 0.1rem 0.35rem;
}
.mdx-content pre {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  overflow-x: auto;
  padding: 1rem;
}
.mdx-content pre code { background: transparent; border: 0; padding: 0; display: block; line-height: 1.6; }
.mdx-content a { color: #1d4ed8; text-decoration: underline; text-underline-offset: 2px; }
.mdx-content a:hover { color: #1e40af; }
.mdx-content hr { border: 0; border-top: 1px solid #e5e7eb; margin: 1.5rem 0; }
.mdx-content table { border-collapse: collapse; width: 100%; margin-top: 1.25rem; }
.mdx-content th, .mdx-content td { border: 1px solid #e5e7eb; padding: 0.55rem 0.65rem; text-align: left; }
.mdx-content th { color: #111827; font-weight: 600; }
`;

const BUILT_IN_DARK = `
.mdx-content {
  background: #050505;
  color: #a0a0a0;
  line-height: 1.75;
  font-size: 0.875rem;
}
.mdx-content > * + * { margin-top: 1rem; }
.mdx-content h1, .mdx-content h2, .mdx-content h3, .mdx-content h4 {
  color: #ffffff;
  font-weight: 600;
  line-height: 1.3;
}
.mdx-content h1 { font-size: 1.3rem; margin-top: 0.25rem; }
.mdx-content h2 { font-size: 1.1rem; margin-top: 2rem; }
.mdx-content h3 { font-size: 1rem; margin-top: 1.6rem; }
.mdx-content p, .mdx-content li { line-height: 1.75; }
.mdx-content ul { list-style: disc; padding-left: 1.25rem; }
.mdx-content ol { list-style: decimal; padding-left: 1.25rem; }
.mdx-content blockquote {
  border-left: 2px solid color-mix(in srgb, #ffffff 18%, transparent);
  padding-left: 0.9rem;
  color: color-mix(in srgb, #a0a0a0 86%, #ffffff);
}
.mdx-content code {
  background: color-mix(in srgb, #ffffff 10%, transparent);
  color: color-mix(in srgb, #ffffff 88%, #a0a0a0);
  border: 1px solid color-mix(in srgb, #ffffff 14%, transparent);
  border-radius: 6px;
  font-size: 0.86em;
  padding: 0.1rem 0.35rem;
}
.mdx-content pre {
  background: color-mix(in srgb, #050505 84%, #0a0a0a);
  border: 1px solid color-mix(in srgb, #ffffff 12%, transparent);
  border-radius: 0.75rem;
  overflow-x: auto;
  padding: 1rem;
}
.mdx-content pre code { background: transparent; border: 0; padding: 0; display: block; line-height: 1.6; }
.mdx-content a { color: #ffffff; text-decoration: underline; text-underline-offset: 2px; }
.mdx-content a:hover { color: #a0a0a0; }
.mdx-content hr { border: 0; border-top: 1px solid color-mix(in srgb, #ffffff 14%, transparent); margin: 1.5rem 0; }
.mdx-content table { border-collapse: collapse; width: 100%; margin-top: 1.25rem; }
.mdx-content th, .mdx-content td {
  border: 1px solid color-mix(in srgb, #ffffff 16%, transparent);
  padding: 0.55rem 0.65rem; text-align: left;
}
.mdx-content th { color: #ffffff; font-weight: 600; }
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

type FSHandleWithPermission = FileSystemHandle & {
  requestPermission(opts: { mode: "read" | "readwrite" }): Promise<PermissionState>;
};

const STORAGE_KEY = "mdx-editor-workspace";
const CSS_PROFILES_KEY = "mdx-editor-css-profiles";
const DEFAULT_CSS_KEY = "mdx-editor-default-css";
const THEME_KEY = "mdx-editor-theme";
const AUTOSAVE_KEY = "mdx-editor-autosave";

function getMarkdownExtension(filename: string): ".md" | ".mdx" | null {
  const lowered = filename.toLowerCase();
  if (lowered.endsWith(".mdx")) return ".mdx";
  if (lowered.endsWith(".md")) return ".md";
  return null;
}

function isMarkdownFilename(filename: string): boolean {
  return getMarkdownExtension(filename) !== null;
}

function stripMarkdownExtension(filename: string): string {
  const ext = getMarkdownExtension(filename);
  return ext ? filename.slice(0, -ext.length) : filename;
}

function isNotFoundError(error: unknown): error is DOMException {
  return error instanceof DOMException && error.name === "NotFoundError";
}

async function listMarkdownFiles(dir: FileSystemDirectoryHandle): Promise<string[]> {
  const names: string[] = [];
  const iterable = dir as unknown as AsyncIterable<[string, FileSystemHandle]>;
  for await (const [name, handle] of iterable) {
    if (handle.kind === "file" && isMarkdownFilename(name)) names.push(name);
  }
  return names.sort();
}

function resolveProfile(
  selected: SelectedFile | null,
  entries: StoredEntry[],
  profiles: Record<string, string>,
  defaultCss: string,
  theme: Theme,
): { css: string; source: ProfileSource } {
  if (!selected) return { css: defaultCss || (theme === "dark" ? BUILT_IN_DARK : BUILT_IN_LIGHT), source: defaultCss ? "default" : "built-in" };

  const entry = entries.find((e) => e.id === selected.entryId);
  const inFolder = entry?.kind === "directory";
  const fileKey = inFolder ? `${selected.entryId}:${selected.name}` : selected.entryId;

  if (profiles[fileKey]) return { css: profiles[fileKey], source: "file" };
  if (inFolder && profiles[selected.entryId]) return { css: profiles[selected.entryId], source: "folder" };
  if (defaultCss) return { css: defaultCss, source: "default" };
  return { css: theme === "dark" ? BUILT_IN_DARK : BUILT_IN_LIGHT, source: "built-in" };
}

function getSelectedFileStorageKey(selected: SelectedFile | null, entries: StoredEntry[]) {
  if (!selected) return undefined;

  const entry = entries.find((e) => e.id === selected.entryId);
  const inFolder = entry?.kind === "directory";
  return inFolder ? `${selected.entryId}:${selected.name}` : selected.entryId;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function EditorPage() {
  const toast = useToast();
  const [entries, setEntries] = useState<StoredEntry[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [folderFiles, setFolderFiles] = useState<Record<string, string[]>>({});
  const [selected, setSelected] = useState<SelectedFile | null>(null);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const [autosave, setAutosave] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [saveTooltip, setSaveTooltip] = useState<SaveTooltip>(null);

  // CSS profiles
  const [cssProfiles, setCssProfiles] = useState<Record<string, string>>({});
  const [defaultCss, setDefaultCss] = useState("");

  // CSS editor modal
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [editingValue, setEditingValue] = useState("");
  const [cssOpenedFromSettings, setCssOpenedFromSettings] = useState(false);

  // Rename
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const renameInputRef = useRef<HTMLInputElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const saveTooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingContent = useRef("");
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedIndicatorTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Init ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
    }

    const savedAutosave = localStorage.getItem(AUTOSAVE_KEY);
    if (savedAutosave === "false") setAutosave(false);

    Promise.all([
      get<StoredEntry[]>(STORAGE_KEY),
      get<Record<string, string>>(CSS_PROFILES_KEY),
      get<string>(DEFAULT_CSS_KEY),
    ]).then(([storedEntries, storedProfiles, storedDefault]) => {
      if (storedEntries?.length) setEntries(storedEntries);
      if (storedProfiles) setCssProfiles(storedProfiles);
      if (typeof storedDefault === "string") setDefaultCss(storedDefault);
    }).catch((error) => {
      console.error("Failed to restore workspace from storage:", error);
    });
  }, []);

  // Apply dark class to <html> whenever theme changes
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(AUTOSAVE_KEY, String(autosave));
    if (!autosave && saveTimeout.current) {
      clearTimeout(saveTimeout.current);
      saveTimeout.current = null;
    }
  }, [autosave]);

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

  useEffect(() => {
    return () => {
      if (saveTooltipTimeoutRef.current) clearTimeout(saveTooltipTimeoutRef.current);
      if (savedIndicatorTimeout.current) clearTimeout(savedIndicatorTimeout.current);
    };
  }, []);

  // ─── Persistence ────────────────────────────────────────────────────────

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

  // ─── Adding entries ─────────────────────────────────────────────────────

  async function addFolder() {
    setShowAddMenu(false);
    if (!("showDirectoryPicker" in window)) {
      setNotice({
        title: "Folder Picker Not Supported",
        message: "Your browser does not support folder picking. Use Chrome or Edge.",
      });
      return;
    }
    try {
      const dir = await (window as typeof window & { showDirectoryPicker: (o?: object) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker({ mode: "readwrite" });
      const entry: StoredEntry = { id: crypto.randomUUID(), kind: "directory", handle: dir, name: dir.name };
      const files = await listMarkdownFiles(dir);
      setFolderFiles((prev) => ({ ...prev, [entry.id]: files }));
      setExpanded((prev) => new Set([...prev, entry.id]));
      await persistEntries([...entries, entry]);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) throw error;
    }
  }

  async function addFile() {
    setShowAddMenu(false);
    if (!("showOpenFilePicker" in window)) {
      setNotice({
        title: "File Picker Not Supported",
        message: "Your browser does not support file picking. Use Chrome or Edge.",
      });
      return;
    }
    try {
      const [handle] = await (window as typeof window & { showOpenFilePicker: (o?: object) => Promise<FileSystemFileHandle[]> }).showOpenFilePicker({
        types: [
          {
            description: "Markdown Files",
            accept: {
              "text/markdown": [".md", ".mdx"],
              "text/plain": [".md", ".mdx"],
            },
          },
        ],
      });
      const entry: StoredEntry = { id: crypto.randomUUID(), kind: "file", handle, name: handle.name };
      await persistEntries([...entries, entry]);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) throw error;
    }
  }

  function removeEntry(id: string) {
    persistEntries(entries.filter((e) => e.id !== id));
    if (selected?.entryId === id) { setSelected(null); setContent(""); }
    setFolderFiles((prev) => { const n = { ...prev }; delete n[id]; return n; });
    setExpanded((prev) => { const s = new Set(prev); s.delete(id); return s; });
  }

  function removeMissingFolderFile(entryId: string, filename: string) {
    setFolderFiles((prev) => ({
      ...prev,
      [entryId]: (prev[entryId] ?? []).filter((file) => file !== filename),
    }));
    if (selected?.entryId === entryId && selected.name === filename) {
      setSelected(null);
      setContent("");
      pendingContent.current = "";
      setSaved(false);
    }
  }

  // ─── Folder expand ──────────────────────────────────────────────────────

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
      try {
        const files = await listMarkdownFiles(dir);
        setFolderFiles((prev) => ({ ...prev, [id]: files }));
      } catch (error) {
        if (isNotFoundError(error)) {
          removeEntry(id);
          setNotice({
            title: "Folder Unavailable",
            message: `"${entry.name}" is no longer available and was removed from the sidebar.`,
          });
          return;
        }
        throw error;
      }
    }
    setExpanded((prev) => new Set([...prev, id]));
  }

  // ─── Opening files ──────────────────────────────────────────────────────

  async function openFileHandle(
    fileHandle: FileSystemFileHandle,
    entryId: string,
    dirHandle?: FileSystemDirectoryHandle,
  ) {
    try {
      const perm = await (fileHandle as unknown as FSHandleWithPermission).requestPermission({ mode: "readwrite" });
      if (perm !== "granted") return;
      const file = await fileHandle.getFile();
      const text = await file.text();
      setContent(text);
      pendingContent.current = text;
      setSaved(false);
      setSelected({ fileHandle, dirHandle, entryId, name: fileHandle.name });
    } catch (error) {
      if (isNotFoundError(error)) {
        if (dirHandle) {
          removeMissingFolderFile(entryId, fileHandle.name);
        } else {
          removeEntry(entryId);
        }
        setNotice({
          title: "File Missing",
          message: `"${fileHandle.name}" could not be found and was removed from the sidebar.`,
        });
        return;
      }
      throw error;
    }
  }

  async function openFolderFile(filename: string, entryId: string) {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry || entry.kind !== "directory") return;
    const dir = entry.handle as FileSystemDirectoryHandle;
    try {
      const fileHandle = await dir.getFileHandle(filename);
      await openFileHandle(fileHandle, entryId, dir);
    } catch (error) {
      if (isNotFoundError(error)) {
        removeMissingFolderFile(entryId, filename);
        setNotice({
          title: "File Removed",
          message: `"${filename}" no longer exists and was removed from the list.`,
        });
        return;
      }
      throw error;
    }
  }

  // ─── Saving ─────────────────────────────────────────────────────────────

  function handleChange(value: string) {
    pendingContent.current = value;
    if (savedIndicatorTimeout.current) clearTimeout(savedIndicatorTimeout.current);
    setSaved(false);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    if (autosave) {
      saveTimeout.current = setTimeout(() => autoSave(value), 1500);
    }
  }

  function showSavedIndicator() {
    setSaved(true);
    if (savedIndicatorTimeout.current) clearTimeout(savedIndicatorTimeout.current);
    savedIndicatorTimeout.current = setTimeout(() => setSaved(false), 1500);
  }

  async function autoSave(value: string, showSuccessToast = false) {
    if (!selected) return;
    setSaving(true);
    try {
      const writable = await selected.fileHandle.createWritable();
      await writable.write(value);
      await writable.close();
      showSavedIndicator();
      if (showSuccessToast) {
        toast.success("Saved", selected.name);
      }
    } catch (error) {
      if (isNotFoundError(error)) {
        if (selected.dirHandle) {
          removeMissingFolderFile(selected.entryId, selected.name);
        } else {
          removeEntry(selected.entryId);
        }
        setNotice({
          title: "Save Failed",
          message: `"${selected.name}" no longer exists. It was removed from the sidebar.`,
        });
        return;
      }
      throw error;
    } finally {
      setSaving(false);
    }
  }

  async function manualSave() {
    if (!selected || saving) return;
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
      saveTimeout.current = null;
    }
    await autoSave(pendingContent.current, true);
  }

  async function saveAs() {
    if (!selected || saving) return;
    if (!("showSaveFilePicker" in window)) {
      setNotice({
        title: "Save As Not Supported",
        message: "Your browser does not support Save As. Use Chrome or Edge.",
      });
      return;
    }

    try {
      const newHandle = await (window as typeof window & {
        showSaveFilePicker: (o?: object) => Promise<FileSystemFileHandle>;
      }).showSaveFilePicker({
        suggestedName: selected.name,
        types: [
          {
            description: "Markdown Files",
            accept: {
              "text/markdown": [".md", ".mdx"],
              "text/plain": [".md", ".mdx"],
            },
          },
        ],
      });

      const perm = await (newHandle as unknown as FSHandleWithPermission).requestPermission({ mode: "readwrite" });
      if (perm !== "granted") return;

      const writable = await newHandle.createWritable();
      await writable.write(pendingContent.current);
      await writable.close();

      let existingEntry: StoredEntry | null = null;
      for (const entry of entries) {
        if (entry.kind !== "file") continue;
        if (await entry.handle.isSameEntry(newHandle)) {
          existingEntry = entry;
          break;
        }
      }

      if (existingEntry) {
        const nextEntries = entries.map((entry) => (
          entry.id === existingEntry?.id
            ? { ...entry, handle: newHandle, name: newHandle.name }
            : entry
        ));
        await persistEntries(nextEntries);
        setSelected({ fileHandle: newHandle, entryId: existingEntry.id, name: newHandle.name });
      } else {
        const nextEntry: StoredEntry = {
          id: crypto.randomUUID(),
          kind: "file",
          handle: newHandle,
          name: newHandle.name,
        };
        const nextEntries = [...entries, nextEntry];
        await persistEntries(nextEntries);
        setSelected({ fileHandle: newHandle, entryId: nextEntry.id, name: newHandle.name });
      }

      showSavedIndicator();
      toast.success("Saved as new file", newHandle.name);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Save As failed:", error);
      setNotice({
        title: "Save As Failed",
        message: "Could not save a new file. Please try again.",
      });
      toast.error("Save As failed", "Could not save a new file. Please try again.");
    }
  }

  function showSaveTooltipWithDelay(nextTooltip: Exclude<SaveTooltip, null>) {
    if (saveTooltipTimeoutRef.current) clearTimeout(saveTooltipTimeoutRef.current);
    saveTooltipTimeoutRef.current = setTimeout(() => {
      setSaveTooltip(nextTooltip);
    }, 550);
  }

  function hideSaveTooltip() {
    if (saveTooltipTimeoutRef.current) clearTimeout(saveTooltipTimeoutRef.current);
    setSaveTooltip(null);
  }

  const onSaveHotkey = useEffectEvent((e: KeyboardEvent) => {
    if (!selected) return;
    if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "s") return;
    e.preventDefault();
    if (e.shiftKey) {
      void saveAs();
    } else {
      void manualSave();
    }
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      onSaveHotkey(e);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // ─── Renaming ───────────────────────────────────────────────────────────

  function startRename(key: string, currentName: string, e: React.MouseEvent) {
    e.stopPropagation();
    setRenamingKey(key);
    setRenameValue(stripMarkdownExtension(currentName));
  }

  async function commitRename() {
    if (!renamingKey || !renameValue.trim()) { setRenamingKey(null); return; }
    try {
      if (renamingKey.includes(":")) {
        const [entryId, oldName] = renamingKey.split(":");
        const explicitExtension = getMarkdownExtension(renameValue.trim());
        const existingExtension = getMarkdownExtension(oldName);
        const nextExtension = explicitExtension ?? existingExtension ?? ".mdx";
        const baseName = explicitExtension ? stripMarkdownExtension(renameValue.trim()) : renameValue.trim();
        const newName = `${baseName}${nextExtension}`;
        if (newName === oldName) { setRenamingKey(null); return; }

        const entry = entries.find((e) => e.id === entryId);
        if (!entry || entry.kind !== "directory") { setRenamingKey(null); return; }
        const dir = entry.handle as FileSystemDirectoryHandle;

        try {
          await dir.getFileHandle(newName);
          setNotice({
            title: "Rename Blocked",
            message: `A file named "${newName}" already exists. Choose a different name.`,
          });
          toast.error("Rename blocked", `A file named "${newName}" already exists.`);
          return;
        } catch (error) {
          if (!isNotFoundError(error)) throw error;
        }

        const oldHandle = await dir.getFileHandle(oldName);
        const isCurrentFile = selected?.entryId === entryId && selected.name === oldName;
        const fileContent = isCurrentFile
          ? pendingContent.current
          : await (await oldHandle.getFile()).text();
        const newHandle = await dir.getFileHandle(newName, { create: true });
        const writable = await newHandle.createWritable();
        await writable.write(fileContent);
        await writable.close();
        await dir.removeEntry(oldName);

        setFolderFiles((prev) => ({
          ...prev,
          [entryId]: (prev[entryId] ?? []).map((f) => (f === oldName ? newName : f)).sort(),
        }));

        const oldProfileKey = `${entryId}:${oldName}`;
        const newProfileKey = `${entryId}:${newName}`;
        if (cssProfiles[oldProfileKey] !== undefined) {
          const nextProfiles = { ...cssProfiles };
          nextProfiles[newProfileKey] = nextProfiles[oldProfileKey];
          delete nextProfiles[oldProfileKey];
          await persistProfiles(nextProfiles);
        }

        if (selected?.entryId === entryId && selected.name === oldName) {
          setSelected({ fileHandle: newHandle, dirHandle: dir, entryId, name: newName });
        }

        toast.success("File renamed", `${oldName} -> ${newName}`);
      }
    } catch (error) {
      console.error("Rename failed:", error);
      toast.error("Rename failed", "Could not rename this file. Please try again.");
    } finally {
      setRenamingKey(null);
    }
  }

  // ─── CSS profiles ────────────────────────────────────────────────────────

  function openEditor(key: string, label: string) {
    setEditingKey(key);
    setEditingLabel(label);
    setEditingValue(key === "default" ? defaultCss : (cssProfiles[key] ?? ""));
  }

  function closeCssEditor() {
    setEditingKey(null);
    if (cssOpenedFromSettings) {
      setCssOpenedFromSettings(false);
      setShowSettings(true);
    }
  }

  async function saveProfile() {
    if (editingKey === null) return;
    try {
      if (editingKey === "default") {
        await persistDefaultCss(editingValue);
        toast.success("Default CSS profile saved");
      } else {
        const next = { ...cssProfiles };
        if (editingValue.trim()) next[editingKey] = editingValue;
        else delete next[editingKey];
        await persistProfiles(next);
        toast.success("CSS profile saved");
      }
      closeCssEditor();
    } catch (error) {
      console.error("CSS save failed:", error);
      toast.error("CSS save failed", "Could not save this CSS profile.");
    }
  }

  async function clearProfile() {
    if (editingKey === null) return;
    try {
      if (editingKey === "default") {
        await persistDefaultCss("");
      } else {
        const next = { ...cssProfiles };
        delete next[editingKey];
        await persistProfiles(next);
      }
      closeCssEditor();
      toast.info("CSS profile cleared");
    } catch (error) {
      console.error("CSS clear failed:", error);
      toast.error("CSS clear failed", "Could not clear this CSS profile.");
    }
  }

  // ─── Derived ────────────────────────────────────────────────────────────

  const { css: resolvedCss, source: profileSource } = resolveProfile(selected, entries, cssProfiles, defaultCss, theme);
  const isCustomCss = profileSource !== "built-in";
  const selectedEntry = selected ? entries.find((entry) => entry.id === selected.entryId) : null;
  const selectedDisplayName = selected
    ? selectedEntry?.kind === "directory"
      ? `${selectedEntry.name} / ${selected.name}`
      : selected.name
    : "";
  const selectedFileStorageKey = getSelectedFileStorageKey(selected, entries);

  const sourceBadge: Record<ProfileSource, { label: string; className: string }> = {
    file:      { label: "file css",    className: "bg-gray-100 text-gray-600 dark:bg-[#121212] dark:text-[#d0d0d0]" },
    folder:    { label: "folder css",  className: "bg-gray-100 text-gray-600 dark:bg-[#121212] dark:text-[#d0d0d0]" },
    default:   { label: "default css", className: "bg-gray-100 text-gray-400 dark:bg-[#121212] dark:text-[#9a9a9a]" },
    "built-in":{ label: theme === "dark" ? "built-in dark" : "built-in light", className: "bg-gray-100 text-gray-400 dark:bg-[#121212] dark:text-[#9a9a9a]" },
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-white dark:bg-black text-gray-900 dark:text-gray-100">
      {notice && (
        <div
          className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-[1px] flex items-center justify-center p-6"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setNotice(null);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-gray-200/90 dark:border-[#2a2a2a] bg-white dark:bg-[#060606] shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-[#1f1f1f]">
              <p className="text-sm font-semibold tracking-tight text-gray-900 dark:text-[#f5f5f5]">{notice.title}</p>
            </div>
            <div className="px-5 py-4 text-sm leading-relaxed text-gray-600 dark:text-[#b8b8b8]">
              {notice.message}
            </div>
            <div className="px-5 py-4 border-t border-gray-100 dark:border-[#1f1f1f] flex justify-end">
              <button
                onClick={() => setNotice(null)}
                className="px-3 py-1.5 text-sm rounded-md border border-gray-200 dark:border-[#2f2f2f] bg-white dark:bg-[#111111] hover:bg-gray-50 dark:hover:bg-[#1a1a1a] text-gray-700 dark:text-[#e5e5e5]"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Settings Modal ───────────────────────────────────────────────── */}
      {showSettings && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-8"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowSettings(false);
          }}
        >
          <div className="bg-white dark:bg-black rounded-lg shadow-xl w-full max-w-sm flex flex-col overflow-hidden border border-gray-200 dark:border-[#2a2a2a]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-[#2a2a2a] shrink-0">
              <p className="text-sm font-medium">Settings</p>
              <button onClick={() => setShowSettings(false)} aria-label="Close settings" className="text-gray-400 hover:text-gray-700 dark:hover:text-[#f1f1f1] text-lg leading-none px-1">✕</button>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-[#1f1f1f]">
              {/* Theme */}
              <div className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-[#f1f1f1]">Appearance</p>
                  <p className="text-xs text-gray-400 dark:text-[#9a9a9a] mt-0.5">Light or dark mode</p>
                </div>
                <button
                  onClick={() => setTheme((t) => t === "light" ? "dark" : "light")}
                  className="flex items-center gap-2 px-3 py-1.5 rounded border border-gray-200 dark:border-[#2f2f2f] bg-white dark:bg-[#111111] hover:bg-gray-50 dark:hover:bg-[#1a1a1a] text-sm text-gray-700 dark:text-[#e5e5e5]"
                >
                  <span>{theme === "light" ? "☽" : "☀"}</span>
                  <span>{theme === "light" ? "Dark" : "Light"}</span>
                </button>
              </div>
              {/* Default CSS */}
              <div className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-[#f1f1f1]">Default CSS</p>
                  <p className="text-xs text-gray-400 dark:text-[#9a9a9a] mt-0.5">Global fallback style</p>
                </div>
                <button
                  onClick={() => {
                    setCssOpenedFromSettings(true);
                    setShowSettings(false);
                    openEditor("default", "Global default");
                  }}
                  className={`px-3 py-1.5 rounded border text-sm ${defaultCss ? "border-gray-200 dark:border-[#2f2f2f] bg-white dark:bg-[#111111] hover:bg-gray-50 dark:hover:bg-[#1a1a1a] text-gray-700 dark:text-[#e5e5e5]" : "border-gray-200 dark:border-[#2f2f2f] bg-white dark:bg-[#111111] hover:bg-gray-50 dark:hover:bg-[#1a1a1a] text-gray-400 dark:text-[#9a9a9a]"}`}
                >
                  {defaultCss ? "Edit" : "Set up"}
                </button>
              </div>
              {/* Autosave */}
              <div className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-[#f1f1f1]">Autosave</p>
                  <p className="text-xs text-gray-400 dark:text-[#9a9a9a] mt-0.5">Save 1.5s after typing stops</p>
                </div>
                <button
                  onClick={() => setAutosave((v) => !v)}
                  role="switch"
                  aria-checked={autosave}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${autosave ? "bg-gray-900 dark:bg-[#f1f1f1]" : "bg-gray-200 dark:bg-[#333333]"}`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white dark:bg-black shadow transform transition-transform ${autosave ? "translate-x-4" : "translate-x-0"}`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CSS Profile Editor Modal ──────────────────────────────────────── */}
      {editingKey !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-8"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeCssEditor();
          }}
        >
          <div className="bg-white dark:bg-black rounded-lg shadow-xl w-full max-w-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-[#2a2a2a]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-[#2a2a2a] shrink-0">
              <div>
                <p className="text-sm font-medium">
                  {editingKey === "default" ? "Default CSS Profile" : "CSS Profile"}
                </p>
                <p className="text-xs text-gray-400 dark:text-[#9a9a9a] mt-0.5">{editingLabel}</p>
              </div>
              <button onClick={closeCssEditor} aria-label="Close CSS editor" className="text-gray-400 hover:text-gray-700 dark:hover:text-[#f1f1f1] text-lg leading-none px-1">✕</button>
            </div>
            <p className="px-5 py-2 text-xs text-gray-400 dark:text-[#9a9a9a] bg-gray-50 dark:bg-[#0f0f0f] border-b border-gray-100 dark:border-[#2a2a2a] shrink-0">
              Target the editor content with <code className="font-mono bg-gray-100 dark:bg-[#1a1a1a] px-1 rounded">.mdx-content</code> — e.g. <code className="font-mono bg-gray-100 dark:bg-[#1a1a1a] px-1 rounded">.mdx-content h1 {"{ color: red; }"}</code>
            </p>
            <textarea
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              placeholder={`.mdx-content {\n  font-family: system-ui;\n  color: #111;\n}\n\n.mdx-content h1 { font-size: 2rem; font-weight: 700; }\n.mdx-content p { line-height: 1.7; }`}
              className="flex-1 font-mono text-xs p-4 resize-none outline-none min-h-72 bg-gray-50 dark:bg-[#101010] text-gray-900 dark:text-[#f1f1f1] placeholder-gray-400 dark:placeholder-[#787878]"
              spellCheck={false}
            />
            <div className="flex items-center gap-2 px-5 py-3 border-t border-gray-200 dark:border-[#2a2a2a] shrink-0">
              <button onClick={saveProfile} className="px-4 py-1.5 bg-gray-900 dark:bg-[#f1f1f1] text-white dark:text-black text-sm rounded hover:bg-gray-700 dark:hover:bg-[#d6d6d6]">
                Save
              </button>
              {editingKey !== "default" && (
                <button
                  onClick={() => setEditingValue(defaultCss || (theme === "dark" ? BUILT_IN_DARK : BUILT_IN_LIGHT))}
                  className="px-4 py-1.5 border border-gray-200 dark:border-[#2a2a2a] text-sm rounded hover:bg-gray-50 dark:hover:bg-[#161616]"
                >
                  Copy from default
                </button>
              )}
              <button onClick={clearProfile} className="px-4 py-1.5 border border-gray-200 dark:border-[#2a2a2a] text-sm rounded hover:bg-gray-50 dark:hover:bg-[#161616] text-red-500 ml-auto">
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      {sidebarOpen && (
      <aside className="w-60 shrink-0 border-r border-gray-200 dark:border-[#242424] flex flex-col bg-white dark:bg-black">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#242424]">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-[#a2a2a2]">Files</span>
          <div className="flex items-center gap-1">
            {/* Settings */}
            <button
              onClick={() => setShowSettings(true)}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-[#171717] text-gray-400 dark:text-[#8d8d8d] hover:text-gray-700 dark:hover:text-[#e8e8e8] text-sm"
              title="Settings"
              aria-label="Open settings"
            >
              ⚙
            </button>
            {/* Add folder/file */}
            <div className="relative" ref={addMenuRef}>
              <button
                onClick={() => setShowAddMenu((v) => !v)}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-[#171717] text-gray-500 dark:text-[#a2a2a2] hover:text-gray-800 dark:hover:text-[#f1f1f1] text-lg leading-none"
                title="Add folder or file"
                aria-label="Add folder or file"
                aria-expanded={showAddMenu}
              >
                +
              </button>
              {showAddMenu && (
                <div className="absolute right-0 top-7 z-10 bg-white dark:bg-black border border-gray-200 dark:border-[#2a2a2a] rounded shadow-lg text-sm min-w-[140px] py-1">
                  <button onClick={addFolder} className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-[#171717]">Open Folder</button>
                  <button onClick={addFile} className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-[#171717]">Open File</button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="sidebar-scroll-area flex-1 overflow-y-auto overflow-x-auto">
          {entries.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-[#737373] px-4 py-6 text-center leading-relaxed">
              Press <span className="font-medium text-gray-500 dark:text-[#9a9a9a]">+</span> to open a folder or file
            </p>
          ) : (
            <ul>
              {entries.map((entry) => {
                const hasProfile = !!cssProfiles[entry.id];
                return (
                  <li key={entry.id} className="group">
                    <div className="flex items-center pr-1 hover:bg-gray-50 dark:hover:bg-[#121212]">
                      {entry.kind === "directory" ? (
                        <button
                          onClick={() => toggleFolder(entry)}
                          className="flex-1 flex items-center gap-2 px-3 py-2 text-sm text-left truncate min-w-0"
                        >
                          <span className="text-gray-400 dark:text-[#737373] text-[10px] w-2 shrink-0">{expanded.has(entry.id) ? "▼" : "▶"}</span>
                          <span className="truncate font-medium">{entry.name}</span>
                          {hasProfile && <span className="shrink-0 text-[10px] px-1 py-0.5 rounded bg-gray-100 dark:bg-[#1a1a1a] text-gray-600 dark:text-[#cecece] font-mono leading-none">css</span>}
                        </button>
                      ) : (
                        <button
                          onClick={() => openFileHandle(entry.handle as FileSystemFileHandle, entry.id)}
                          className={`flex-1 flex items-center gap-2 px-3 py-2 text-sm text-left truncate min-w-0 ${selected?.entryId === entry.id ? "font-medium" : ""}`}
                        >
                          <span className="truncate">{entry.name}</span>
                          {hasProfile && <span className="shrink-0 text-[10px] px-1 py-0.5 rounded bg-gray-100 dark:bg-[#1a1a1a] text-gray-600 dark:text-[#cecece] font-mono leading-none">css</span>}
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditor(entry.id, entry.name); }}
                        title="Edit CSS profile"
                        aria-label={`Edit CSS profile for ${entry.name}`}
                        className={`opacity-0 group-hover:opacity-100 shrink-0 px-1 py-1 text-xs ${hasProfile ? "text-gray-500 dark:text-[#8d8d8d] hover:text-gray-700 dark:hover:text-[#f1f1f1]" : "text-gray-300 dark:text-[#555555] hover:text-gray-500 dark:hover:text-[#bcbcbc]"}`}
                      >
                        ◈
                      </button>
                      <button
                        onClick={() => removeEntry(entry.id)}
                        className="opacity-0 group-hover:opacity-100 shrink-0 px-1.5 py-1 text-gray-300 dark:text-[#555555] hover:text-red-400 text-xs"
                        title="Remove from sidebar"
                        aria-label={`Remove ${entry.name} from sidebar`}
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
                                  className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-100 dark:bg-[#101010] border-b border-gray-300 dark:border-[#2a2a2a] outline-none"
                                />
                              ) : (
                                <>
                                  <button
                                    onClick={() => openFolderFile(filename, entry.id)}
                                    className={`w-full text-left pl-8 pr-14 py-1.5 text-sm truncate hover:bg-gray-50 dark:hover:bg-[#121212] ${isSelected ? "bg-gray-100 dark:bg-[#1a1a1a] font-medium" : ""}`}
                                  >
                                    {stripMarkdownExtension(filename)}
                                    {fileHasProfile && <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded bg-gray-100 dark:bg-[#1a1a1a] text-gray-600 dark:text-[#cecece] font-mono leading-none">css</span>}
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); openEditor(fileProfileKey, `${entry.name} / ${filename}`); }}
                                    title="Edit file CSS profile"
                                    aria-label={`Edit CSS profile for ${filename}`}
                                    className={`absolute right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover/file:opacity-100 text-xs px-1 ${fileHasProfile ? "text-gray-500 dark:text-[#8d8d8d] hover:text-gray-700 dark:hover:text-[#f1f1f1]" : "text-gray-300 dark:text-[#555555] hover:text-gray-500 dark:hover:text-[#bcbcbc]"}`}
                                  >
                                    ◈
                                  </button>
                                  <button
                                    onClick={(e) => startRename(renameKey, filename, e)}
                                    title="Rename"
                                    aria-label={`Rename ${filename}`}
                                    className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/file:opacity-100 text-gray-400 dark:text-[#737373] hover:text-gray-700 dark:hover:text-[#d8d8d8] text-xs px-1"
                                  >
                                    ✎
                                  </button>
                                </>
                              )}
                            </li>
                          );
                        })}
                        {(folderFiles[entry.id] ?? []).length === 0 && (
                          <li className="pl-8 pr-3 py-1.5 text-xs text-gray-400 dark:text-[#737373]">No .md/.mdx files</li>
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
      )}

      {/* ── Editor ────────────────────────────────────────────────────────── */}
      <main className="relative flex-1 flex flex-col overflow-hidden">
        {!sidebarOpen && !selected && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute left-3 top-2 z-10 w-6 h-6 flex items-center justify-center rounded border border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-black text-gray-500 dark:text-[#a2a2a2] hover:text-gray-800 dark:hover:text-[#f1f1f1] hover:bg-gray-50 dark:hover:bg-[#171717]"
            title="Open sidebar"
            aria-label="Open sidebar"
          >
            ▶
          </button>
        )}
        {selected ? (
          <>
            <div className="flex items-center justify-between px-6 py-2 border-b border-gray-200 dark:border-[#242424] text-xs text-gray-400 dark:text-[#9a9a9a] bg-white dark:bg-black">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setSidebarOpen((v) => !v)}
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-[#171717] text-gray-500 dark:text-[#a2a2a2] hover:text-gray-800 dark:hover:text-[#f1f1f1] text-sm shrink-0"
                  title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
                  aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
                >
                  {sidebarOpen ? "◀" : "▶"}
                </button>
                <span className="truncate">{selectedDisplayName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="min-w-12 text-right">{saving ? "Saving…" : saved ? "Saved" : ""}</span>
                <div className="relative">
                  <button
                    onClick={() => void manualSave()}
                    onMouseEnter={() => showSaveTooltipWithDelay("save")}
                    onMouseLeave={hideSaveTooltip}
                    onFocus={() => showSaveTooltipWithDelay("save")}
                    onBlur={hideSaveTooltip}
                    disabled={saving}
                    className="px-2 py-1 rounded border border-gray-200 dark:border-[#2a2a2a] text-gray-600 dark:text-[#c8c8c8] hover:text-gray-900 dark:hover:text-[#f1f1f1] hover:bg-gray-50 dark:hover:bg-[#171717] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save
                  </button>
                  {saveTooltip === "save" && (
                    <span className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.5 rounded text-[10px] font-mono bg-gray-900 text-white dark:bg-[#e8e8e8] dark:text-black shadow-lg z-20">
                      Ctrl/Cmd+S
                    </span>
                  )}
                </div>
                <div className="relative">
                  <button
                    onClick={() => void saveAs()}
                    onMouseEnter={() => showSaveTooltipWithDelay("saveAs")}
                    onMouseLeave={hideSaveTooltip}
                    onFocus={() => showSaveTooltipWithDelay("saveAs")}
                    onBlur={hideSaveTooltip}
                    disabled={saving}
                    className="px-2 py-1 rounded border border-gray-200 dark:border-[#2a2a2a] text-gray-600 dark:text-[#c8c8c8] hover:text-gray-900 dark:hover:text-[#f1f1f1] hover:bg-gray-50 dark:hover:bg-[#171717] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save As
                  </button>
                  {saveTooltip === "saveAs" && (
                    <span className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.5 rounded text-[10px] font-mono bg-gray-900 text-white dark:bg-[#e8e8e8] dark:text-black shadow-lg z-20">
                      Ctrl/Cmd+Shift+S
                    </span>
                  )}
                </div>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${sourceBadge[profileSource].className}`}>
                  {sourceBadge[profileSource].label}
                </span>
              </div>
            </div>
            <div
              className="editor-scroll-area flex-1 overflow-y-auto p-3 sm:p-4"
              style={isCustomCss ? { background: "var(--background, white)" } : undefined}
            >
              <MdxEditor
                key={selected.entryId + selected.name}
                markdown={content}
                onChange={handleChange}
                css={resolvedCss}
                usingCustomCss={isCustomCss}
                theme={theme}
                widthStorageKey={selectedFileStorageKey}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-[#737373] text-sm">
            Select a file to edit
          </div>
        )}
      </main>
    </div>
  );
}
