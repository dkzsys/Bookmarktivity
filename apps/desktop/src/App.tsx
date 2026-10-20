import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  arrangeTree, bookmarkCountsByFolder, folderBranchIds, folderPath, fuzzyWordMatch, parseQuery, type Field, type Folder, type Item, type MatchSpan,
  type ProfileData, type ScopeMode, type SearchOptions, type SearchResult, type Sort
} from "@bookmarktivity/core";
import { inTauri, native, type EdgeProfile, type Preferences } from "./native";
import { benchmarkSample, sampleData, sampleProfiles } from "./sample";
import brandMark from "./assets/bookmarktivity-mark.svg";

const defaultPrefs: Preferences = { enabledProfileIds: [], edgeUserDataDir: null, theme: "light" };
const defaultOptions: SearchOptions = {
  query: "", refine: "", fields: ["name", "url", "folder"], regex: false,
  scopeId: null, scopeMode: "descendants", sort: "relevance"
};
const mac = /Mac|iPhone|iPad/.test(navigator.platform);
type ShortcutAction = "find" | "refine" | "results" | "copy" | "settings" | "expandAll" | "collapseAll";
const defaultBindings: Record<ShortcutAction, string> = {
  find: mac ? "Meta+F" : "Ctrl+F",
  refine: "Alt+F",
  results: mac ? "Meta+G" : "Alt+R",
  copy: mac ? "Meta+C" : "Ctrl+C",
  settings: mac ? "Meta+," : "Ctrl+,",
  expandAll: mac ? "Meta+E" : "Ctrl+E",
  collapseAll: mac ? "Meta+Shift+E" : "Ctrl+Shift+E"
};
const shortcutNames: Record<ShortcutAction, string> = {
  find: "Global search", refine: "Search within results", results: "Navigate to results", copy: "Copy selected URL", settings: "Profiles & settings",
  expandAll: "Expand all in selected folder", collapseAll: "Collapse all in selected folder"
};
const labelFor = (binding: string) => binding.replace("Meta", "⌘").replace("Alt", mac ? "⌥" : "Alt").replace("Shift", "⇧").replaceAll("+", " ");
const sidebarLimits = { left: { min: 170, max: 420, initial: 238 }, right: { min: 210, max: 500, initial: 302 } } as const;
type SidebarSide = keyof typeof sidebarLimits;
type FolderSurface = "nav" | "results";
type FolderMenu = { surface: FolderSurface; id: string; x: number; y: number };
function storedSidebarWidth(side: SidebarSide): number {
  try {
    const saved = Number(window.localStorage.getItem(`bookmarktivity-${side}-sidebar-width`));
    const { min, max, initial } = sidebarLimits[side];
    return Number.isFinite(saved) && saved >= min && saved <= max ? saved : initial;
  } catch { return sidebarLimits[side].initial; }
}
function chordFor(event: KeyboardEvent | React.KeyboardEvent): string | null {
  if (["Meta", "Control", "Alt", "Shift"].includes(event.key)) return null;
  const modifiers = [event.metaKey && "Meta", event.ctrlKey && "Ctrl", event.altKey && "Alt", event.shiftKey && "Shift"].filter(Boolean);
  // Option/Alt can turn letters into symbols (for example Option+R becomes ® on macOS).
  const key = /^Key[A-Z]$/.test(event.code) ? event.code.slice(3)
    : /^Digit[0-9]$/.test(event.code) ? event.code.slice(5)
    : event.code === "Comma" ? ","
    : event.key.length === 1 ? event.key.toUpperCase() : event.key;
  return [...modifiers, key].join("+");
}
function normalizeShortcut(input: string): string | null {
  const parts = input.trim().split(/\s*\+\s*/);
  if (parts.length < 2 || parts.some(part => !part)) return null;
  const aliases: Record<string, string> = {
    cmd: "Meta", command: "Meta", meta: "Meta", "⌘": "Meta",
    ctrl: "Ctrl", control: "Ctrl", option: "Alt", opt: "Alt", alt: "Alt", "⌥": "Alt",
    shift: "Shift", "⇧": "Shift"
  };
  const modifiers = parts.slice(0, -1).map(part => aliases[part.toLowerCase()]);
  if (modifiers.some(part => !part) || new Set(modifiers).size !== modifiers.length || !modifiers.some(part => part !== "Shift")) return null;
  const rawKey = parts.at(-1)!;
  const namedKeys: Record<string, string> = { enter: "Enter", tab: "Tab", space: " ", escape: "Escape", backspace: "Backspace", delete: "Delete", arrowup: "ArrowUp", arrowdown: "ArrowDown", arrowleft: "ArrowLeft", arrowright: "ArrowRight" };
  const key = rawKey.length === 1 ? rawKey.toUpperCase() : namedKeys[rawKey.toLowerCase()] || (/^f(?:[1-9]|1[0-2])$/i.test(rawKey) ? rawKey.toUpperCase() : null);
  if (!key) return null;
  return [...["Meta", "Ctrl", "Alt", "Shift"].filter(part => modifiers.includes(part)), key].join("+");
}
type SearchEnvelope = { id: number; result: SearchResult };

function useSearch(items: Item[], options: SearchOptions): SearchResult {
  const [result, setResult] = useState<SearchResult>({ items: [], matchedFolderIds: [], error: null });
  const worker = useRef<Worker | null>(null);
  const serial = useRef(0);
  const timer = useRef<number | null>(null);
  const previousWasRegex = useRef(false);
  const createWorker = useCallback(() => {
    const instance = new Worker(new URL("./search.worker.ts", import.meta.url), { type: "module" });
    instance.onmessage = (event: MessageEvent<SearchEnvelope>) => {
      if (event.data.id !== serial.current) return;
      if (timer.current) window.clearTimeout(timer.current);
      setResult(event.data.result);
    };
    instance.onerror = () => {
      if (timer.current) window.clearTimeout(timer.current);
      setResult({ items: [], matchedFolderIds: [], error: "Search could not complete." });
    };
    instance.postMessage({ type: "data", items });
    return instance;
  }, [items]);
  useEffect(() => {
    worker.current?.terminate();
    worker.current = createWorker();
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      worker.current?.terminate();
      worker.current = null;
    };
  }, [createWorker]);
  useEffect(() => {
    const id = ++serial.current;
    if (previousWasRegex.current) {
      worker.current?.terminate();
      worker.current = createWorker();
    }
    previousWasRegex.current = options.regex && Boolean(options.query.trim());
    if (timer.current) window.clearTimeout(timer.current);
    worker.current?.postMessage({ type: "search", id, options });
    timer.current = window.setTimeout(() => {
      if (id !== serial.current) return;
      worker.current?.terminate();
      worker.current = createWorker();
      setResult({ items: [], matchedFolderIds: [], error: "Search took too long. Try a narrower expression." });
    }, options.regex ? 350 : 3000);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [createWorker, options]);
  return result;
}

function Highlight({ value, queries, spans }: { value: string; queries: string[]; spans?: MatchSpan[] }) {
  if (spans?.length) {
    const parts: React.ReactNode[] = [];
    let cursor = 0;
    for (const [start, end] of [...spans].sort((a, b) => a[0] - b[0] || b[1] - a[1])) {
      if (end <= cursor || start >= value.length) continue;
      if (start > cursor) parts.push(<Highlight key={`text-${cursor}`} value={value.slice(cursor, start)} queries={queries} />);
      const from = Math.max(start, cursor);
      parts.push(<mark key={`mark-${from}`}>{value.slice(from, end)}</mark>);
      cursor = end;
    }
    if (cursor < value.length) parts.push(<Highlight key={`text-${cursor}`} value={value.slice(cursor)} queries={queries} />);
    return <>{parts}</>;
  }
  let terms: { value: string; quoted?: boolean }[] = [];
  for (const query of queries) {
    try { terms.push(...parseQuery(query).flat()); } catch { /* error is shown in search */ }
  }
  terms = terms.filter(term => term.value).sort((a, b) => b.value.length - a.value.length);
  if (!terms.length) return <>{value}</>;
  const pattern = new RegExp("(" + terms.map(term => term.value.replace(/[.*+?^$()|[\]{}\\]/g, "\\$&")).join("|") + ")", "ig");
  return <>{value.split(pattern).flatMap((part, index) => {
    if (terms.some(term => term.value.toLowerCase() === part.toLowerCase())) return [<mark key={index}>{part}</mark>];
    return part.split(/([\p{L}\p{N}]+)/gu).map((word, wordIndex) =>
      terms.some(term => !term.quoted && fuzzyWordMatch(word, term.value)) ? <mark key={`${index}-${wordIndex}`}>{word}</mark> : word
    );
  })}</>;
}

function Chevron() {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m7 4 6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default function App() {
  const [profiles, setProfiles] = useState<EdgeProfile[]>([]);
  const [prefs, setPrefs] = useState<Preferences>(defaultPrefs);
  const [data, setData] = useState<Record<string, ProfileData>>({});
  const [options, setOptions] = useState<SearchOptions>(defaultOptions);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsedNav, setCollapsedNav] = useState<Set<string>>(new Set());
  const [collapsedResults, setCollapsedResults] = useState<Set<string>>(new Set());
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [showBookmarkCounts, setShowBookmarkCounts] = useState(() => {
    try { return window.localStorage.getItem("bookmarktivity-show-bookmark-counts") !== "false"; }
    catch { return true; }
  });
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(() => storedSidebarWidth("left"));
  const [rightSidebarWidth, setRightSidebarWidth] = useState(() => storedSidebarWidth("right"));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"profiles" | "shortcuts">("profiles");
  const [syntaxOpen, setSyntaxOpen] = useState(false);
  const [refreshOpen, setRefreshOpen] = useState(false);
  const [folderMenu, setFolderMenu] = useState<FolderMenu | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Choose an Edge profile in Settings to begin.");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState("");
  const [directoryDraft, setDirectoryDraft] = useState("");
  const [capturingShortcut, setCapturingShortcut] = useState<ShortcutAction | null>(null);
  const [shortcutDraft, setShortcutDraft] = useState("");
  const shortcutCaptureRef = useRef<HTMLButtonElement>(null);
  const queryRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const resizing = useRef<{ side: SidebarSide; startX: number; startWidth: number } | null>(null);
  const refineRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const folderMenuRef = useRef<HTMLDivElement>(null);
  const navInitialized = useRef(false);
  const [resultScroll, setResultScroll] = useState(0);
  const [resultHeight, setResultHeight] = useState(560);
  const escapeAt = useRef(0);
  const toastTimer = useRef<number | null>(null);
  const loaded = useRef(false);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2600);
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem("bookmarktivity-left-sidebar-width", String(leftSidebarWidth)); } catch { /* layout still works without storage */ }
  }, [leftSidebarWidth]);
  useEffect(() => {
    try { window.localStorage.setItem("bookmarktivity-right-sidebar-width", String(rightSidebarWidth)); } catch { /* layout still works without storage */ }
  }, [rightSidebarWidth]);
  useEffect(() => {
    try { window.localStorage.setItem("bookmarktivity-show-bookmark-counts", String(showBookmarkCounts)); } catch { /* the toggle still works without storage */ }
  }, [showBookmarkCounts]);
  useEffect(() => {
    document.documentElement.dataset.theme = prefs.theme === "dark" ? "dark" : "light";
  }, [prefs.theme]);

  const resizeSidebar = (side: SidebarSide, width: number) => {
    const { min, max } = sidebarLimits[side];
    const available = side === "left"
      ? (frameRef.current?.clientWidth || window.innerWidth) - (rightSidebarOpen ? rightSidebarWidth : 0) - 320
      : (contentRef.current?.clientWidth || window.innerWidth) - 320;
    const next = Math.max(min, Math.min(max, Math.max(min, available), width));
    (side === "left" ? setLeftSidebarWidth : setRightSidebarWidth)(next);
  };
  const startSidebarResize = (side: SidebarSide, event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizing.current = { side, startX: event.clientX, startWidth: side === "left" ? leftSidebarWidth : rightSidebarWidth };
  };
  const moveSidebarResize = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = resizing.current;
    if (!drag) return;
    resizeSidebar(drag.side, drag.startWidth + (event.clientX - drag.startX) * (drag.side === "left" ? 1 : -1));
  };
  const stopSidebarResize = () => { resizing.current = null; };
  const sidebarResizeKey = (side: SidebarSide, event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    resizeSidebar(side, (side === "left" ? leftSidebarWidth : rightSidebarWidth) + direction * (side === "left" ? 20 : -20));
  };

  const enabled = useMemo(() => profiles.filter(p => prefs.enabledProfileIds.includes(p.id)), [profiles, prefs]);
  const bindings = useMemo(() => ({ ...defaultBindings, ...prefs.shortcuts }) as Record<ShortcutAction, string>, [prefs.shortcuts]);
  const allItems = useMemo(() => enabled.flatMap(profile => {
    const profileData = data[profile.id];
    return profileData ? [...profileData.folders, ...profileData.bookmarks] : [];
  }), [enabled, data]);
  const folderMap = useMemo(() => new Map(allItems.filter((item): item is Folder => item.kind === "folder").map(item => [item.id, item])), [allItems]);
  const bookmarkCounts = useMemo(() => bookmarkCountsByFolder(allItems), [allItems]);
  const folderChildren = useMemo(() => {
    const children = new Map<string, Folder[]>();
    for (const item of allItems) {
      if (item.kind !== "folder") continue;
      const parent = item.parentId || "";
      if (!children.has(parent)) children.set(parent, []);
      children.get(parent)!.push(item);
    }
    return children;
  }, [allItems]);
  const profileMap = useMemo(() => new Map(profiles.map(profile => [profile.id, profile])), [profiles]);
  const result = useSearch(allItems, options);
  useLayoutEffect(() => {
    setCollapsedResults(new Set(result.items.filter(item => item.kind === "folder").map(item => item.id)));
  }, [result.items]);
  const tree = useMemo(() => arrangeTree(result.items, collapsedResults), [result.items, collapsedResults]);
  const visible = tree.visible;
  const virtual = visible.length > 250;
  const rowHeight = 76;
  const firstVisible = virtual ? Math.max(0, Math.floor(Math.max(0, resultScroll - 20) / rowHeight) - 4) : 0;
  const lastVisible = virtual ? Math.min(visible.length, firstVisible + Math.ceil(resultHeight / rowHeight) + 10) : visible.length;
  const rendered = visible.slice(firstVisible, lastVisible);
  const selected = visible.find(item => item.id === selectedId) || visible[0] || null;
  const selectedPath = selected ? folderPath(selected.kind === "folder" ? selected.id : selected.parentId, folderMap) : [];
  const scopedFolder = options.scopeId ? folderMap.get(options.scopeId) : null;
  const hasDates = allItems.some(item => item.dateAdded != null);
  const hasModified = allItems.some(item => item.dateModified != null);

  const readTargets = useCallback(async (targets: EdgeProfile[], label: string) => {
    if (!targets.length) { setStatus("No enabled profiles to re-read."); return; }
    setBusy(true);
    const outcomes = await Promise.allSettled(targets.map(profile => native.readProfile(profile.id)));
    const updates: Record<string, ProfileData> = {};
    const failures: Record<string, string> = {};
    outcomes.forEach((outcome, index) => {
      const profile = targets[index];
      if (outcome.status === "fulfilled") updates[profile.id] = outcome.value;
      else failures[profile.id] = String(outcome.reason);
    });
    setData(previous => ({ ...previous, ...updates }));
    setErrors(previous => {
      const next = { ...previous };
      targets.forEach(profile => delete next[profile.id]);
      return { ...next, ...failures };
    });
    const successCount = Object.keys(updates).length;
    const failedCount = Object.keys(failures).length;
    setStatus(`${label}: ${successCount} refreshed${failedCount ? `, ${failedCount} failed. Previous data for failed profiles remains visible.` : "."}`);
    setBusy(false);
  }, []);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    if (!inTauri) {
      setProfiles(sampleProfiles);
      let previewTheme: "light" | "dark" = "light";
      try { if (window.localStorage.getItem("bookmarktivity-theme") === "dark") previewTheme = "dark"; } catch { /* use light theme */ }
      setPrefs({ enabledProfileIds: ["sample-personal", "sample-work"], edgeUserDataDir: null, theme: previewTheme });
      const benchmark = import.meta.env.DEV && new URLSearchParams(location.search).has("benchmark");
      setData(benchmark ? benchmarkSample() : sampleData);
      setStatus(benchmark
        ? "Synthetic performance collection · 8,000 items."
        : "Browser preview with synthetic bookmarks. Open the Tauri desktop app to connect Edge profiles.");
      return;
    }
    void (async () => {
      try {
        const saved = await native.loadPreferences();
        setPrefs(saved);
        setDirectoryDraft(saved.edgeUserDataDir || "");
        const discovered = await native.discoverProfiles(saved.edgeUserDataDir);
        setProfiles(discovered);
        await readTargets(discovered.filter(p => saved.enabledProfileIds.includes(p.id)), "Startup");
        if (!saved.enabledProfileIds.length) setSettingsOpen(true);
      } catch (error) {
        setStatus(String(error));
        setSettingsOpen(true);
      }
    })();
  }, [readTargets]);

  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
    if (!selected && selectedId) setSelectedId(null);
  }, [selected, selectedId]);

  useEffect(() => {
    if (inTauri && !navInitialized.current && allItems.length) {
      navInitialized.current = true;
      setCollapsedNav(new Set(allItems.filter(item => item.kind === "folder").map(item => item.id)));
    }
  }, [allItems]);

  useEffect(() => {
    const element = resultsRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setResultHeight(element.clientHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (resultsRef.current) resultsRef.current.scrollTop = 0;
    setResultScroll(0);
  }, [options.query, options.refine, options.scopeId, options.scopeMode, options.sort, options.fields, options.regex, allItems]);

  const updateOptions = (patch: Partial<SearchOptions>) => {
    setOptions(previous => ({ ...previous, ...patch }));
  };

  const refresh = async (targets: EdgeProfile[], label: string) => {
    setRefreshOpen(false);
    await readTargets(targets, label);
  };

  const toggleProfile = async (id: string, checked: boolean) => {
    const next: Preferences = {
      ...prefs,
      enabledProfileIds: checked ? [...new Set([...prefs.enabledProfileIds, id])] : prefs.enabledProfileIds.filter(value => value !== id)
    };
    if (!inTauri) {
      setPrefs(next);
      if (options.scopeId && folderMap.get(options.scopeId)?.source.profileId === id && !checked) updateOptions({ scopeId: null });
      return;
    }
    try {
      await native.savePreferences(next);
      setPrefs(next);
      if (checked) {
        const profile = profiles.find(p => p.id === id);
        if (profile) await readTargets([profile], profile.name);
      } else {
        setData(previous => { const copy = { ...previous }; delete copy[id]; return copy; });
        if (options.scopeId && folderMap.get(options.scopeId)?.source.profileId === id) updateOptions({ scopeId: null });
        setStatus("Profile removed from this workspace.");
      }
    } catch (error) { notify(String(error)); }
  };

  const findProfiles = async () => {
    const directory = directoryDraft.trim() || null;
    try {
      const found = await native.discoverProfiles(directory);
      const sameDirectory = directory === prefs.edgeUserDataDir;
      const next: Preferences = {
        enabledProfileIds: sameDirectory ? prefs.enabledProfileIds.filter(id => found.some(profile => profile.id === id)) : [],
        edgeUserDataDir: directory,
        shortcuts: prefs.shortcuts,
        theme: prefs.theme
      };
      await native.savePreferences(next);
      setPrefs(next);
      setProfiles(found);
      if (!sameDirectory) {
        setData({});
        updateOptions({ scopeId: null });
      }
      setStatus(`Found ${found.length} Edge ${found.length === 1 ? "profile" : "profiles"}. Choose which to include.`);
    } catch (error) { setStatus(String(error)); }
  };

  const saveShortcuts = async (shortcuts: Record<string, string>): Promise<boolean> => {
    const next = { ...prefs, shortcuts };
    try {
      if (inTauri) await native.savePreferences(next);
      setPrefs(next);
      return true;
    } catch (error) { notify(String(error)); return false; }
  };
  const saveTheme = async (theme: "light" | "dark") => {
    const next = { ...prefs, theme };
    try {
      if (inTauri) await native.savePreferences(next);
      else window.localStorage.setItem("bookmarktivity-theme", theme);
      setPrefs(next);
    } catch (error) { notify(String(error)); }
  };
  const applyShortcut = async (action: ShortcutAction, input: string) => {
    const chord = normalizeShortcut(input);
    if (!chord) { notify("Enter a shortcut such as Cmd+G or Ctrl+G."); return; }
    const conflict = (Object.keys(bindings) as ShortcutAction[]).find(key => key !== action && bindings[key] === chord);
    if (conflict) { notify(`That shortcut is already used for ${shortcutNames[conflict]}.`); return; }
    if (await saveShortcuts({ ...prefs.shortcuts, [action]: chord })) {
      setCapturingShortcut(null);
      setShortcutDraft("");
      notify(`${shortcutNames[action]} shortcut updated`);
    }
  };
  const captureShortcut = async (action: ShortcutAction, event: KeyboardEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") { setCapturingShortcut(null); setShortcutDraft(""); return; }
    const chord = chordFor(event);
    if (!chord) return;
    if (!event.metaKey && !event.ctrlKey && !event.altKey) { notify("Use Command, Control, or Alt with a key."); return; }
    await applyShortcut(action, chord);
  };
  useEffect(() => {
    if (!capturingShortcut) return;
    const focus = requestAnimationFrame(() => shortcutCaptureRef.current?.focus());
    const record = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).closest(".shortcut-editor")) return;
      void captureShortcut(capturingShortcut, event);
    };
    document.addEventListener("keydown", record, true);
    return () => {
      cancelAnimationFrame(focus);
      document.removeEventListener("keydown", record, true);
    };
  }, [capturingShortcut, prefs.shortcuts]);

  const focusResult = (id: string) => {
    const index = visible.findIndex(item => item.id === id);
    if (virtual && index >= 0 && resultsRef.current) {
      const element = resultsRef.current;
      const targetTop = 20 + index * rowHeight;
      if (targetTop < element.scrollTop || targetTop + rowHeight > element.scrollTop + element.clientHeight) {
        element.scrollTop = Math.max(0, targetTop - element.clientHeight / 3);
        setResultScroll(element.scrollTop);
      }
    }
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-result-id="${CSS.escape(id)}"]`)?.focus();
    }));
  };
  const focusFolder = (id: string) => requestAnimationFrame(() => {
    document.querySelector<HTMLElement>(`[data-folder-id="${CSS.escape(id)}"]`)?.focus();
  });
  const setResultCollapsed = (id: string, collapsed: boolean) => {
    setCollapsedResults(previous => {
      const next = new Set(previous);
      if (collapsed) next.add(id);
      else {
        next.delete(id);
        for (const descendant of folderBranchIds(tree.children, id).slice(1)) next.add(descendant);
      }
      return next;
    });
  };
  const setNavCollapsed = (id: string, collapsed: boolean) => {
    setCollapsedNav(previous => {
      const next = new Set(previous);
      if (collapsed) next.add(id);
      else {
        next.delete(id);
        for (const descendant of folderBranchIds(folderChildren, id).slice(1)) next.add(descendant);
      }
      return next;
    });
  };
  const changeFolderBranch = (surface: FolderSurface, id: string, collapsed: boolean) => {
    const branch = folderBranchIds(surface === "nav" ? folderChildren : tree.children, id);
    const update = (previous: Set<string>) => {
      const next = new Set(previous);
      for (const folderId of branch) collapsed ? next.add(folderId) : next.delete(folderId);
      return next;
    };
    (surface === "nav" ? setCollapsedNav : setCollapsedResults)(update);
    if (surface === "results") setSelectedId(id);
    setFolderMenu(null);
    surface === "nav" ? focusFolder(id) : focusResult(id);
  };
  const openFolderMenu = (surface: FolderSurface, id: string, event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    if (surface === "results") setSelectedId(id);
    setFolderMenu({ surface, id, x: Math.max(8, Math.min(event.clientX, window.innerWidth - 205)), y: Math.max(8, Math.min(event.clientY, window.innerHeight - 100)) });
  };
  useEffect(() => {
    if (!folderMenu) return;
    requestAnimationFrame(() => folderMenuRef.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus());
    const dismiss = (event: PointerEvent) => {
      if (!folderMenuRef.current?.contains(event.target as Node)) setFolderMenu(null);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [folderMenu]);
  const openItem = async (item: Item | null) => {
    if (!item) return;
    if (item.kind === "folder") {
      if (tree.children.get(item.id)?.length && collapsedResults.has(item.id)) setResultCollapsed(item.id, false);
      else updateOptions({ scopeId: item.id });
      return;
    }
    if (!inTauri) { notify("Sample bookmark · Open it from the desktop app with a real profile."); return; }
    try { await native.openBookmark(item.url); }
    catch (error) { notify(String(error)); }
  };
  const copyItem = async (item: Item | null) => {
    if (!item || item.kind !== "bookmark") return;
    try { await navigator.clipboard.writeText(item.url); notify("URL copied"); }
    catch { notify("Clipboard unavailable"); }
  };
  const reset = () => {
    setOptions(defaultOptions);
    setCollapsedResults(new Set(result.items.filter(item => item.kind === "folder").map(item => item.id)));
    setSelectedId(null);
    queryRef.current?.focus();
    notify("Search and filters reset");
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (capturingShortcut) {
        if (event.key === "Escape") { event.preventDefault(); setCapturingShortcut(null); setShortcutDraft(""); }
        return;
      }
      const chord = chordFor(event);
      if (chord === bindings.find) {
        event.preventDefault(); setSettingsOpen(false); setOptions(previous => ({ ...previous, scopeId: null, refine: "" }));
        queryRef.current?.focus(); queryRef.current?.select(); return;
      }
      if (chord === bindings.refine) {
        event.preventDefault(); setSettingsOpen(false); refineRef.current?.focus(); refineRef.current?.select(); return;
      }
      if (chord === bindings.results) {
        event.preventDefault(); setSettingsOpen(false);
        if (selected) focusResult(selected.id); else resultsRef.current?.focus();
        return;
      }
      if (chord === bindings.settings) {
        event.preventDefault(); setSettingsOpen(true); return;
      }
      if (!settingsOpen && (chord === bindings.expandAll || chord === bindings.collapseAll)) {
        const target = event.target as HTMLElement;
        const navId = target.closest<HTMLElement>("[data-folder-id]")?.dataset.folderId;
        const resultId = target.closest<HTMLElement>("[data-result-id]")?.dataset.resultId;
        const branch = folderMenu || (navId ? { surface: "nav" as const, id: navId }
          : resultId && folderMap.has(resultId) ? { surface: "results" as const, id: resultId }
          : selected?.kind === "folder" ? { surface: "results" as const, id: selected.id } : null);
        if (branch) {
          event.preventDefault();
          changeFolderBranch(branch.surface, branch.id, chord === bindings.collapseAll);
          return;
        }
      }
      if (event.key === "Escape") {
        event.preventDefault();
        if (folderMenu) { setFolderMenu(null); return; }
        if (settingsOpen) { setSettingsOpen(false); return; }
        if (refreshOpen || syntaxOpen) { setRefreshOpen(false); setSyntaxOpen(false); return; }
        if (performance.now() - escapeAt.current < 700) { escapeAt.current = 0; reset(); }
        else { escapeAt.current = performance.now(); notify("Press Escape again to reset"); }
        return;
      }
      if (settingsOpen) return;
      const target = event.target as HTMLElement;
      const resultRow = target.closest<HTMLElement>("[data-result-id]");
      const navRow = target.closest<HTMLElement>("[data-folder-id]");
      if (resultRow) {
        const id = resultRow.dataset.resultId!;
        const index = visible.findIndex(item => item.id === id);
        const item = visible[index];
        if (!item) return;
        if (chord === bindings.copy && item.kind === "bookmark") { event.preventDefault(); void copyItem(item); return; }
        if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
          event.preventDefault();
          const next = event.key === "Home" ? 0 : event.key === "End" ? visible.length - 1 : Math.max(0, Math.min(visible.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)));
          setSelectedId(visible[next].id); focusResult(visible[next].id); return;
        }
        if (event.key === "ArrowRight" && item.kind === "folder") {
          event.preventDefault();
          if (collapsedResults.has(id)) setResultCollapsed(id, false);
          else { const child = tree.children.get(id)?.[0]; if (child) { setSelectedId(child.id); focusResult(child.id); } }
        }
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          if (item.kind === "folder" && !collapsedResults.has(id)) setResultCollapsed(id, true);
          else { const parent = tree.parents.get(id); if (parent) { setSelectedId(parent); focusResult(parent); } }
        }
        if (event.key === "Enter") { event.preventDefault(); setSelectedId(id); void openItem(item); }
      } else if (navRow) {
        const id = navRow.dataset.folderId!;
        const rows = [...document.querySelectorAll<HTMLElement>("[data-folder-id]")];
        const index = rows.indexOf(navRow);
        const children = folderChildren.get(id) || [];
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault(); rows[Math.max(0, Math.min(rows.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))]?.focus();
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          if (children.length && collapsedNav.has(id)) { setNavCollapsed(id, false); focusFolder(id); }
          else if (children.length) focusFolder(children[0].id);
        }
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          if (children.length && !collapsedNav.has(id)) { setNavCollapsed(id, true); focusFolder(id); }
          else { const parent = folderMap.get(id)?.parentId; if (parent) focusFolder(parent); }
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const navigationGroups = useMemo(() => {
    const renderFolder = (folder: Folder, level: number): React.ReactNode => {
      const children = folderChildren.get(folder.id) || [];
      const open = !collapsedNav.has(folder.id);
      return <div key={folder.id}>
        <button type="button" className={`tree-row ${options.scopeId === folder.id ? "active" : ""}`}
          role="treeitem" aria-level={level} aria-expanded={children.length ? open : undefined}
          data-folder-id={folder.id} style={{ paddingLeft: 17 + (level - 1) * 15 }}
          onContextMenu={event => openFolderMenu("nav", folder.id, event)}
          onClick={event => {
            if ((event.target as HTMLElement).closest("[data-branch]") && children.length) {
              setNavCollapsed(folder.id, open);
            } else {
              setOptions(previous => ({ ...previous, scopeId: folder.id }));
            }
          }}>
          <span className={`branch ${open ? "open" : ""} ${children.length ? "" : "leaf"}`} data-branch aria-hidden="true"><Chevron /></span>
          <span className="folder-label">{folder.name}</span>
          {showBookmarkCounts && <span className="bookmark-count" title="Bookmarks including subfolders" aria-label={`${bookmarkCounts.get(folder.id) || 0} bookmarks including subfolders`}>{bookmarkCounts.get(folder.id) || 0}</span>}
        </button>
        {open && children.map(child => renderFolder(child, level + 1))}
      </div>;
    };
    return enabled.map(profile => <div className="profile-group" key={profile.id}>
      <div className="profile-label"><span className="edge-icon">e</span> Edge · {profile.name}</div>
      {(folderChildren.get("") || []).filter(folder => folder.source.profileId === profile.id).map(folder => renderFolder(folder, 1))}
    </div>);
  }, [enabled, folderChildren, collapsedNav, options.scopeId, showBookmarkCounts, bookmarkCounts]);

  return <div className="frame" ref={frameRef} style={{ gridTemplateColumns: `${leftSidebarOpen ? leftSidebarWidth : 0}px minmax(0, 1fr)` }}>
    {leftSidebarOpen && <aside className="sidebar" id="folder-sidebar" aria-label="Folder scope">
      <div className="side-brand"><img className="brand-mark" src={brandMark} alt="" /> Bookmarktivity</div>
      <div className="side-kicker">Workspace</div>
      <button className={`scope-row ${!options.scopeId ? "active" : ""}`} onClick={() => updateOptions({ scopeId: null })}><span className="nav-icon">◫</span> All bookmarks <span className="count">{enabled.length}</span></button>
      <div className="side-line" />
      <button className="section-head section-toggle" aria-expanded={foldersOpen} onClick={() => setFoldersOpen(!foldersOpen)}><span>Your Folders</span><span className={`disclosure ${foldersOpen ? "open" : ""}`}><Chevron /></span></button>
      {foldersOpen && <>
        <div className="folder-actions">
          <button onClick={() => setCollapsedNav(new Set(allItems.filter(item => item.kind === "folder").map(item => item.id)))}>Collapse all</button>
          <button onClick={() => setCollapsedNav(new Set())}>Expand all</button>
        </div>
        <div role="tree" aria-label="Folders">
          {navigationGroups}
          {!enabled.length && <p className="sidebar-empty">No profiles enabled.</p>}
        </div>
      </>}
      <div className="scope-card"><label htmlFor="scope-mode">Search selected folder</label>
        <select id="scope-mode" value={options.scopeMode} onChange={event => updateOptions({ scopeMode: event.target.value as ScopeMode })}>
          <option value="descendants">Including descendants</option><option value="direct">Direct contents only</option>
        </select>
      </div>
    </aside>}
    {leftSidebarOpen && <div className="resize-handle left-resize" role="separator" aria-label="Resize folders sidebar" aria-orientation="vertical" aria-valuemin={sidebarLimits.left.min} aria-valuemax={sidebarLimits.left.max} aria-valuenow={leftSidebarWidth} tabIndex={0} style={{ left: leftSidebarWidth - 4 }} onPointerDown={event => startSidebarResize("left", event)} onPointerMove={moveSidebarResize} onPointerUp={stopSidebarResize} onPointerCancel={stopSidebarResize} onKeyDown={event => sidebarResizeKey("left", event)} />}
    <div className="workspace">
      <div className="titlebar"><div className="breadcrumb"><span>Workspace</span><span>›</span><strong>{scopedFolder ? `${profileMap.get(scopedFolder.source.profileId)?.name} / ${folderPath(scopedFolder.id, folderMap).map(f => f.name).join(" / ")}` : "All bookmarks"}</strong></div>
        <div className="top-actions"><button className="btn sidebar-toggle" aria-controls={leftSidebarOpen ? "folder-sidebar" : undefined} aria-expanded={leftSidebarOpen} onClick={() => setLeftSidebarOpen(open => !open)}>{leftSidebarOpen ? "Hide folders" : "Show folders"}</button><button className="btn sidebar-toggle" aria-controls={rightSidebarOpen ? "details-sidebar" : undefined} aria-expanded={rightSidebarOpen} onClick={() => setRightSidebarOpen(open => !open)}>{rightSidebarOpen ? "Hide details" : "Show details"}</button><button className="btn sidebar-toggle" aria-pressed={showBookmarkCounts} onClick={() => setShowBookmarkCounts(show => !show)}>{showBookmarkCounts ? "Hide counts" : "Show counts"}</button><button className="btn" onClick={() => setSettingsOpen(true)}>⚙ &nbsp;Profiles & settings</button><div className="theme-toggle" role="group" aria-label="Appearance"><button type="button" aria-pressed={prefs.theme !== "dark"} className={prefs.theme !== "dark" ? "active" : ""} onClick={() => void saveTheme("light")}>☀ Light</button><button type="button" aria-pressed={prefs.theme === "dark"} className={prefs.theme === "dark" ? "active" : ""} onClick={() => void saveTheme("dark")}>☾ Dark</button></div></div>
      </div>
      <div className="content" ref={contentRef} style={{ gridTemplateColumns: `minmax(0, 1fr) ${rightSidebarOpen ? rightSidebarWidth : 0}px` }}><main className="main">
        <header className="top">
          <div className="search-panel"><div className="search-row"><div className="search-wrap"><span className="search-icon">⌕</span><input ref={queryRef} type="search" aria-label="Search bookmarks" placeholder="Search by name, folder or URL…" value={options.query} onChange={event => updateOptions({ query: event.target.value })} /><span className="key">{labelFor(bindings.find)}</span></div><button className="btn btn-primary" onClick={() => queryRef.current?.focus()}>Search ↵</button></div>
            <div className="search-options"><span className="option-label">Search in</span>
              {(["name", "url", "folder"] as Field[]).map(field => <label className="check" key={field}><input type="checkbox" checked={options.fields.includes(field)} onChange={event => updateOptions({ fields: event.target.checked ? [...options.fields, field] : options.fields.filter(value => value !== field) })} />{field === "folder" ? "Folder name" : field === "url" ? "URL" : "Name"}</label>)}
              <span className="divider" /><label className="check"><input type="checkbox" checked={options.regex} onChange={event => updateOptions({ regex: event.target.checked })} />Regex</label>
              <span className="syntax"><button className="inline-button" aria-expanded={syntaxOpen} onClick={() => setSyntaxOpen(!syntaxOpen)}>Syntax guide ↗</button></span>
            </div>
          </div>
          {syntaxOpen && <div className="syntax-menu show"><strong>Query ideas</strong><p><code>name:"Project plan"</code> matches that exact text anywhere inside a longer name, even mid-word.</p><p><code>url:docs.example.com AND name:guide</code> combines fields.</p><p><code>OR</code> broadens a query. <code>folder:</code> matches the immediate folder name. The folder list sets scope.</p><p>Regex mode treats the full primary query as an expression across the selected fields.</p></div>}
        </header>
        <div className="result-head"><div><h2>{options.query ? "Search results" : scopedFolder?.name || "All bookmarks"}</h2><div className="caption">{result.error || `${result.items.length} matching items · ${visible.length} visible · Folders first`}</div></div>
          <div className="result-tools"><div className="reread-control"><button className="btn" disabled={busy || !enabled.length || !inTauri} onClick={() => void refresh(enabled, "All enabled sources")}>↻ &nbsp;{busy ? "Re-reading…" : "Re-read all sources"}</button><button className="btn" disabled={!enabled.length} aria-label="Choose re-read target" aria-expanded={refreshOpen} onClick={() => setRefreshOpen(!refreshOpen)}>▾</button>
            {refreshOpen && <div className="reread-menu"><div className="reread-menu-label">By source</div><button onClick={() => void refresh(enabled, "Microsoft Edge")}>Microsoft Edge <small>{enabled.length} enabled</small></button><div className="menu-rule" /><div className="reread-menu-label">By profile</div>{enabled.map(profile => <button key={profile.id} onClick={() => void refresh([profile], profile.name)}>Edge · {profile.name}</button>)}</div>}
          </div><div className="sort-wrap"><label htmlFor="sort">Sort by</label><select id="sort" value={options.sort} onChange={event => updateOptions({ sort: event.target.value as Sort })}><option value="relevance">Relevance</option><option value="alphabetical">Alphabetical</option>{hasDates && <option value="created">Date created</option>}{hasModified && <option value="modified">Date modified</option>}</select></div></div>
        </div>
        <div className="source-status" role="status">{status}{Object.entries(errors).map(([id, error]) => <div key={id}>Edge · {profileMap.get(id)?.name || id}: {error}</div>)}</div>
        <div className="active-bar"><span className="chip blue">Edge · {enabled.length} enabled {enabled.length === 1 ? "profile" : "profiles"}</span>{scopedFolder && <span className="chip">{scopedFolder.name} · {options.scopeMode === "direct" ? "direct only" : "with descendants"}</span>}{options.query && <span className="chip">Query: {options.query}</span>}{options.refine && <span className="chip">Within results: {options.refine}</span>}{result.matchedFolderIds.length > 0 && <span className="chip">Folder matches include contents</span>}<span className="chip">{options.regex ? "Regex mode" : `Fields: ${options.fields.join(", ") || "none"}`}</span></div>
        <label className="refine"><span>⌕</span><input ref={refineRef} type="search" aria-label="Search within results" placeholder="Search within these results…" value={options.refine} onChange={event => updateOptions({ refine: event.target.value })} /><span className="key">{labelFor(bindings.refine)}</span></label>
        <div className={`result-list ${virtual ? "virtual" : ""}`} role="tree" aria-label="Search results" tabIndex={0} ref={resultsRef} onScroll={event => setResultScroll(event.currentTarget.scrollTop)}>
          {!visible.length ? <div className="empty"><strong>{result.error ? "Check the search query" : enabled.length ? "No matches in this scope" : "Choose an Edge profile"}</strong>{result.error || (enabled.length ? "Try another query, field, folder, or enabled profile." : "Open Profiles & settings to include local bookmarks.")}</div> : <>
            <div className="list-head"><span>Item / location</span><span>Source</span></div>
            <div className={virtual ? "virtual-space" : "result-rows"} style={virtual ? { height: visible.length * rowHeight } : undefined}>
            {rendered.map((item, offset) => {
              const isFolder = item.kind === "folder";
              const childCount = tree.children.get(item.id)?.length || 0;
              const expanded = !collapsedResults.has(item.id);
              const path = folderPath(item.parentId, folderMap).map(f => f.name).join(" / ");
              const sub = isFolder ? path || "Top level folder" : `${path} · ${item.url}`;
              const textQueries = options.regex ? [options.refine] : [options.query, options.refine];
              const regexMatch = options.regex ? result.regexHighlights?.get(item.id) : undefined;
              const titleSpans: MatchSpan[] = [...(regexMatch?.name || []), ...(isFolder ? regexMatch?.folder || [] : [])];
              const subSpans: MatchSpan[] = [];
              if (!isFolder && regexMatch?.folder?.length) {
                const parentName = folderMap.get(item.parentId || "")?.name || "";
                if (parentName) for (const [start, end] of regexMatch.folder) subSpans.push([path.length - parentName.length + start, path.length - parentName.length + end]);
              }
              if (!isFolder && regexMatch?.url?.length) for (const [start, end] of regexMatch.url) subSpans.push([sub.length - item.url.length + start, sub.length - item.url.length + end]);
              return <button className={`result ${selected?.id === item.id ? "selected" : ""}`} key={item.id}
                role="treeitem" aria-level={item.level} aria-expanded={isFolder && childCount ? expanded : undefined} aria-selected={selected?.id === item.id}
                data-result-id={item.id} style={virtual ? { position: "absolute", top: (firstVisible + offset) * rowHeight, width: "100%", height: 68, paddingLeft: 13 + (item.level - 1) * 19 } : { paddingLeft: 13 + (item.level - 1) * 19 }}
                onContextMenu={isFolder ? event => openFolderMenu("results", item.id, event) : undefined}
                onClick={event => { setSelectedId(item.id); if ((event.target as HTMLElement).closest("[data-result-branch]") && isFolder && childCount) setResultCollapsed(item.id, expanded); focusResult(item.id); }}
                onDoubleClick={() => { setSelectedId(item.id); void openItem(item); }}>
                <span className={`branch ${expanded ? "open" : ""} ${childCount ? "" : "leaf"}`} data-result-branch aria-hidden="true"><Chevron /></span><span className={`item-icon ${isFolder ? "folder" : ""}`}>{isFolder ? "▱" : "↗"}</span><span className="item-body"><span className="item-title"><Highlight value={item.name} queries={textQueries} spans={titleSpans} /></span><span className="item-sub"><Highlight value={sub} queries={textQueries} spans={subSpans} /></span></span>{isFolder && showBookmarkCounts && <span className="bookmark-count" title="Bookmarks including subfolders" aria-label={`${bookmarkCounts.get(item.id) || 0} bookmarks including subfolders`}>{bookmarkCounts.get(item.id) || 0}</span>}<span className="source">Edge · {item.source.profileName}</span>
              </button>;
            })}
            </div>
          </>}
        </div>
      </main>
      {rightSidebarOpen && <div className="resize-handle right-resize" role="separator" aria-label="Resize details sidebar" aria-orientation="vertical" aria-valuemin={sidebarLimits.right.min} aria-valuemax={sidebarLimits.right.max} aria-valuenow={rightSidebarWidth} tabIndex={0} style={{ right: rightSidebarWidth - 4 }} onPointerDown={event => startSidebarResize("right", event)} onPointerMove={moveSidebarResize} onPointerUp={stopSidebarResize} onPointerCancel={stopSidebarResize} onKeyDown={event => sidebarResizeKey("right", event)} />}
      {rightSidebarOpen && <aside className="detail" id="details-sidebar" aria-label="Selected item details"><div className="detail-head">{selected ? `Selected ${selected.kind}` : "Details"}</div>{selected ? <>
        <div className="detail-icon">{selected.kind === "folder" ? "▱" : "↗"}</div><h2>{selected.name}</h2>{selected.kind === "bookmark" && <span className="detail-url">{selected.url}</span>}
        <div className="metadata"><div><span className="meta-label">Source</span><span className="meta-value"><span className="edge-icon">e</span> &nbsp;Microsoft Edge · {selected.source.profileName}</span></div><div><span className="meta-label">Full folder path</span><div className="path">{selectedPath.map(folder => <span key={folder.id}>{folder.name}</span>)}</div></div><div><span className="meta-label">Type</span><span className="meta-value">{selected.kind === "folder" ? "Folder" : "Bookmark"}</span></div></div>
        <div className="detail-actions"><button className="btn btn-primary" onClick={() => void openItem(selected)}>{selected.kind === "folder" ? "Open folder" : "Open in default browser"} ↗</button>{selected.kind === "bookmark" && <button className="btn" onClick={() => void copyItem(selected)}>Copy URL</button>}</div>
      </> : <p className="detail-empty">Select a folder or bookmark to see its source and full path.</p>}<div className="read-only">Read only. Bookmarktivity does not change Edge bookmark files.</div></aside>}
      </div>
      <footer className="footer"><span>Enabled profiles only · Read-only Edge access</span><div className="shortcuts"><span><span className="key">{labelFor(bindings.results)}</span> Results</span><span><span className="key">← →</span> Folders</span><span><span className="key">Esc Esc</span> Reset</span><span><span className="key">{labelFor(bindings.copy)}</span> Copy URL</span></div></footer>
    </div>
    {folderMenu && <div className="folder-context-menu" role="menu" aria-label={`Folder actions for ${folderMap.get(folderMenu.id)?.name || "selected folder"}`} ref={folderMenuRef} style={{ left: folderMenu.x, top: folderMenu.y }} onKeyDown={event => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      event.stopPropagation();
      const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=menuitem]")];
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      buttons[(index + (event.key === "ArrowDown" ? 1 : buttons.length - 1)) % buttons.length]?.focus();
    }}>
      <button role="menuitem" onClick={() => changeFolderBranch(folderMenu.surface, folderMenu.id, false)}>Expand all <span className="key">{labelFor(bindings.expandAll)}</span></button>
      <button role="menuitem" onClick={() => changeFolderBranch(folderMenu.surface, folderMenu.id, true)}>Collapse all <span className="key">{labelFor(bindings.collapseAll)}</span></button>
    </div>}
    {settingsOpen && <div className="modal-backdrop show" role="dialog" aria-modal="true" aria-labelledby="settings-title"><div className="modal"><div className="modal-top"><div><h2 id="settings-title">Profiles & settings</h2><p>Choose which local profiles to include and customize keyboard shortcuts.</p></div><button className="close" aria-label="Close settings" onClick={() => setSettingsOpen(false)}>×</button></div>
      <div className="settings-tabs" role="tablist" aria-label="Settings sections" onKeyDown={event => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === "Home" ? "profiles" : event.key === "End" ? "shortcuts" : settingsTab === "profiles" ? "shortcuts" : "profiles";
        setSettingsTab(next);
        setCapturingShortcut(null);
        event.currentTarget.querySelector<HTMLElement>(`#settings-tab-${next}`)?.focus();
      }}>
        <button id="settings-tab-profiles" type="button" role="tab" aria-selected={settingsTab === "profiles"} aria-controls="settings-panel-profiles" tabIndex={settingsTab === "profiles" ? 0 : -1} onClick={() => { setSettingsTab("profiles"); setCapturingShortcut(null); }}>Local bookmark profiles</button>
        <button id="settings-tab-shortcuts" type="button" role="tab" aria-selected={settingsTab === "shortcuts"} aria-controls="settings-panel-shortcuts" tabIndex={settingsTab === "shortcuts" ? 0 : -1} onClick={() => setSettingsTab("shortcuts")}>Keyboard shortcuts</button>
      </div>
      {settingsTab === "profiles" && <div id="settings-panel-profiles" role="tabpanel" aria-labelledby="settings-tab-profiles" className="settings-panel" tabIndex={0}><div className="settings-section"><h3>Microsoft Edge · Local profiles</h3><div className="directory-row"><label htmlFor="edge-dir">Edge user-data directory</label><div><input id="edge-dir" placeholder="Use system default" value={directoryDraft} onChange={event => setDirectoryDraft(event.target.value)} /><button className="btn" onClick={() => void findProfiles()} disabled={!inTauri}>Find profiles</button></div><small>For a custom Edge location, enter the user-data directory shown at edge://version.</small></div>
        {profiles.map(profile => <label className="profile-setting" key={profile.id}><span><strong><span className="edge-icon">e</span> &nbsp;{profile.name}</strong><small>Microsoft Edge · {profile.id}</small></span><input type="checkbox" checked={prefs.enabledProfileIds.includes(profile.id)} onChange={event => void toggleProfile(profile.id, event.target.checked)} /></label>)}
        {!profiles.length && <p className="settings-note">No profiles found yet. Check the directory and choose Find profiles.</p>}
      </div></div>}
      {settingsTab === "shortcuts" && <div id="settings-panel-shortcuts" role="tabpanel" aria-labelledby="settings-tab-shortcuts" className="settings-panel" tabIndex={0}><div className="settings-section"><h3>Keyboard shortcuts</h3>
        {(Object.keys(shortcutNames) as ShortcutAction[]).map(action => <div key={action}>
          <div className="shortcut-line"><span>{shortcutNames[action]}</span><button ref={capturingShortcut === action ? shortcutCaptureRef : undefined} className={`shortcut-capture ${capturingShortcut === action ? "capturing" : ""}`} onClick={() => { setCapturingShortcut(action); setShortcutDraft(bindings[action]); }}>{capturingShortcut === action ? "Press shortcut…" : labelFor(bindings[action])}</button></div>
          {capturingShortcut === action && <div className="shortcut-editor"><label>Or type a shortcut<input aria-label={`${shortcutNames[action]} shortcut`} value={shortcutDraft} onChange={event => setShortcutDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void applyShortcut(action, shortcutDraft); } }} placeholder={mac ? "Cmd+G" : "Ctrl+G"} /></label><button className="btn" onClick={() => void applyShortcut(action, shortcutDraft)}>Save</button><button className="btn" onClick={() => { setCapturingShortcut(null); setShortcutDraft(""); }}>Cancel</button></div>}
        </div>)}
        <div className="shortcut-line"><span>Reset filters</span><span className="key">Esc Esc</span></div>
        <div className="shortcut-line"><span>Open selected item</span><span className="key">Enter</span></div>
        <button className="inline-button" onClick={() => { void saveShortcuts({}); setCapturingShortcut(null); setShortcutDraft(""); }}>Restore defaults</button>
      </div></div>}
    </div></div>}
    {toast && <div className="toast show" role="status">{toast}</div>}
  </div>;
}
