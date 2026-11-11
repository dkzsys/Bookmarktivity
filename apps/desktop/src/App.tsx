import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  arrangeTree, bookmarkCountsByFolder, folderBranchIds, folderPath, fuzzyWordMatch, parseQuery, type Field, type Folder, type Item, type MatchSpan,
  type ProfileData, type ScopeMode, type SearchOptions, type SearchResult, type Sort
} from "@bookmarktivity/core";
import { browserIds, browserNames, browserShortNames, directoryHints, inTauri, native, type BrowserId, type BrowserProfile, type Preferences } from "./native";
import { BrowserBadge, Icons } from "./icons";
import { benchmarkSample, sampleData, sampleProfiles } from "./sample";
import brandMark from "./assets/bookmarktivity-mark.svg";

const defaultPrefs: Preferences = { enabledProfileIds: [], edgeUserDataDir: null, chromeUserDataDir: null, braveUserDataDir: null, firefoxUserDataDir: null, safariUserDataDir: null, theme: "light" };
const directoryFor = (prefs: Preferences, browserId: BrowserId): string | null => ({ edge: prefs.edgeUserDataDir, chrome: prefs.chromeUserDataDir, brave: prefs.braveUserDataDir, firefox: prefs.firefoxUserDataDir, safari: prefs.safariUserDataDir })[browserId] ?? null;
const defaultOptions: SearchOptions = {
  query: "", refine: "", fields: ["name", "url", "folder"], regex: false,
  scopeId: null, scopeMode: "descendants", sort: "relevance"
};
const mac = /Mac|iPhone|iPad/.test(navigator.platform);
const profileDiscoveryError = (error: unknown) => {
  const message = String(error);
  return mac && /permission denied|operation not permitted|access denied/i.test(message)
    ? `${message} On macOS, grant Bookmarktivity Full Disk Access in System Settings, then choose Find profiles or re-read.`
    : message;
};
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
const emptySearchResult: SearchResult = { items: [], matchedFolderIds: [], error: null };

function useSearch(items: Item[], options: SearchOptions): { result: SearchResult; searching: boolean } {
  const [result, setResult] = useState<SearchResult>(emptySearchResult);
  const [searching, setSearching] = useState(false);
  const requested = useRef<{ items: Item[]; options: SearchOptions } | null>(null);
  const worker = useRef<Worker | null>(null);
  const serial = useRef(0);
  const timer = useRef<number | null>(null);
  const debounce = useRef<number | null>(null);
  const running = useRef(false);
  const createWorker = useCallback(() => {
    const instance = new Worker(new URL("./search.worker.ts", import.meta.url), { type: "module" });
    instance.onmessage = (event: MessageEvent<SearchEnvelope>) => {
      if (instance !== worker.current || event.data.id !== serial.current) return;
      running.current = false;
      if (timer.current) window.clearTimeout(timer.current);
      setResult(event.data.result);
      setSearching(false);
    };
    instance.onerror = () => {
      if (instance !== worker.current) return;
      running.current = false;
      if (timer.current) window.clearTimeout(timer.current);
      setResult({ items: [], matchedFolderIds: [], error: "Search could not complete." });
      setSearching(false);
    };
    instance.postMessage({ type: "data", items });
    return instance;
  }, [items]);
  useEffect(() => {
    worker.current?.terminate();
    running.current = false;
    worker.current = createWorker();
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      if (debounce.current) window.clearTimeout(debounce.current);
      worker.current?.terminate();
      worker.current = null;
    };
  }, [createWorker]);
  useEffect(() => {
    const id = ++serial.current;
    requested.current = { items, options };
    if (debounce.current) window.clearTimeout(debounce.current);
    if (running.current) {
      worker.current?.terminate();
      worker.current = createWorker();
      running.current = false;
    }
    if (timer.current) window.clearTimeout(timer.current);
    setResult(emptySearchResult);
    setSearching(true);
    debounce.current = window.setTimeout(() => {
      running.current = true;
      worker.current?.postMessage({ type: "search", id, options });
      if (options.regex && options.query.trim()) timer.current = window.setTimeout(() => {
        if (id !== serial.current) return;
        worker.current?.terminate();
        worker.current = createWorker();
        running.current = false;
        setResult({ items: [], matchedFolderIds: [], error: "Regex search took too long. Try a narrower expression." });
        setSearching(false);
      }, 350);
    }, 120);
    return () => {
      if (debounce.current) window.clearTimeout(debounce.current);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [createWorker, items, options]);
  return requested.current?.items === items && requested.current.options === options
    ? { result, searching }
    : { result: emptySearchResult, searching: true };
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

/** Short source label; a Safari profile named "Safari" is shown once rather than as "Safari · Safari". */
function sourceLabel(browserId: string, profileName: string) {
  const browser = browserShortNames[browserId as BrowserId] || browserId;
  return profileName === browser ? browser : `${browser} · ${profileName}`;
}

export default function App() {
  const [profiles, setProfiles] = useState<BrowserProfile[]>([]);
  const [discoveryErrors, setDiscoveryErrors] = useState<Partial<Record<BrowserId, string>>>({});
  const [fullDiskAccessError, setFullDiskAccessError] = useState<string | null>(null);
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
  const [status, setStatus] = useState("Choose a browser profile in Settings to begin.");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState("");
  const [directoryDrafts, setDirectoryDrafts] = useState<Record<BrowserId, string>>({ edge: "", chrome: "", brave: "", firefox: "", safari: "" });
  const [capturingShortcut, setCapturingShortcut] = useState<ShortcutAction | null>(null);
  const [shortcutDraft, setShortcutDraft] = useState("");
  const shortcutCaptureRef = useRef<HTMLButtonElement>(null);
  const queryRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLElement>(null);
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
  const snapshotWarnings = useMemo(() => enabled.filter(profile => Boolean(data[profile.id]?.warning)), [enabled, data]);
  const { result, searching } = useSearch(allItems, options);
  useLayoutEffect(() => {
    setCollapsedResults(new Set(result.items.filter(item => item.kind === "folder").map(item => item.id)));
  }, [result.items]);
  const tree = useMemo(() => arrangeTree(result.items, collapsedResults), [result.items, collapsedResults]);
  const visible = tree.visible;
  const virtual = visible.length > 250;
  const rowHeight = 44;
  const listHeadHeight = 28;
  const firstVisible = virtual ? Math.max(0, Math.floor(Math.max(0, resultScroll - listHeadHeight) / rowHeight) - 4) : 0;
  const lastVisible = virtual ? Math.min(visible.length, firstVisible + Math.ceil(resultHeight / rowHeight) + 10) : visible.length;
  const rendered = visible.slice(firstVisible, lastVisible);
  const selected = visible.find(item => item.id === selectedId) || visible[0] || null;
  const selectedPath = selected ? folderPath(selected.kind === "folder" ? selected.id : selected.parentId, folderMap) : [];
  const scopedFolder = options.scopeId ? folderMap.get(options.scopeId) : null;
  const hasDates = allItems.some(item => item.dateAdded != null);
  const hasModified = allItems.some(item => item.dateModified != null);
  const totalBookmarks = useMemo(() => allItems.reduce((total, item) => total + (item.kind === "bookmark" ? 1 : 0), 0), [allItems]);

  const readTargets = useCallback(async (targets: BrowserProfile[], label: string) => {
    if (!targets.length) { setStatus("No enabled profiles to re-read."); return; }
    setBusy(true);
    const outcomes = await Promise.allSettled(targets.map(profile => native.readProfile(profile.id)));
    const updates: Record<string, ProfileData> = {};
    const failures: Record<string, string> = {};
    outcomes.forEach((outcome, index) => {
      const profile = targets[index];
      if (outcome.status === "fulfilled") updates[profile.id] = outcome.value;
      else failures[profile.id] = profileDiscoveryError(outcome.reason);
    });
    setData(previous => {
      const next = { ...previous, ...updates };
      targets.forEach(profile => { if (failures[profile.id]) delete next[profile.id]; });
      return next;
    });
    setErrors(previous => {
      const next = { ...previous };
      targets.forEach(profile => delete next[profile.id]);
      return { ...next, ...failures };
    });
    const successCount = Object.keys(updates).length;
    const failedCount = Object.keys(failures).length;
    setStatus(`${label}: ${successCount} refreshed${failedCount ? `, ${failedCount} failed. Data for failed profiles was removed.` : "."}`);
    setBusy(false);
  }, []);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    if (!inTauri) {
      setProfiles(sampleProfiles);
      let previewTheme: "light" | "dark" = "light";
      try { if (window.localStorage.getItem("bookmarktivity-theme") === "dark") previewTheme = "dark"; } catch { /* use light theme */ }
      setPrefs({ ...defaultPrefs, enabledProfileIds: ["sample-personal", "sample-work"], theme: previewTheme });
      const benchmark = import.meta.env.DEV && new URLSearchParams(location.search).has("benchmark");
      setData(benchmark ? benchmarkSample() : sampleData);
      setStatus(benchmark
        ? "Synthetic performance collection · 8,000 items."
        : "Browser preview with synthetic bookmarks. Open the Tauri desktop app to connect browser profiles.");
      return;
    }
    void (async () => {
      try {
        const saved = await native.loadPreferences();
        setDirectoryDrafts({ edge: saved.edgeUserDataDir || "", chrome: saved.chromeUserDataDir || "", brave: saved.braveUserDataDir || "", firefox: saved.firefoxUserDataDir || "", safari: saved.safariUserDataDir || "" });
        const outcomes = await Promise.allSettled(browserIds.map(browserId => native.discoverProfiles(browserId, directoryFor(saved, browserId))));
        setDiscoveryErrors(Object.fromEntries(outcomes.flatMap((outcome, index) => outcome.status === "rejected" ? [[browserIds[index], profileDiscoveryError(outcome.reason)]] : [])));
        const discovered = outcomes.flatMap(outcome => outcome.status === "fulfilled" ? outcome.value : []);
        const migrated = [...new Set(saved.enabledProfileIds.map(id => {
          const legacy = discovered.find(profile => profile.browserId === "edge" && profile.folderId === id);
          return legacy?.id || id;
        }))];
        const nextPrefs = { ...defaultPrefs, ...saved, enabledProfileIds: migrated };
        if (migrated.some((id, index) => id !== saved.enabledProfileIds[index])) await native.savePreferences(nextPrefs);
        setPrefs(nextPrefs);
        setProfiles(discovered);
        await readTargets(discovered.filter(p => migrated.includes(p.id)), "Startup");
        const failures = outcomes.flatMap((outcome, index) => outcome.status === "rejected" ? [`${browserNames[browserIds[index]]}: ${profileDiscoveryError(outcome.reason)}`] : []);
        if (failures.length) setStatus(failures.join(" · "));
        if (!discovered.some(profile => migrated.includes(profile.id))) setSettingsOpen(true);
      } catch (error) {
        setStatus(profileDiscoveryError(error));
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

  const refresh = async (targets: BrowserProfile[], label: string) => {
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

  const findProfiles = async (browserId: BrowserId, chosenDirectory?: string) => {
    const directory = (chosenDirectory ?? directoryDrafts[browserId]).trim() || null;
    try {
      const found = await native.discoverProfiles(browserId, directory);
      setDiscoveryErrors(previous => { const next = { ...previous }; delete next[browserId]; return next; });
      const oldIds = profiles.filter(profile => profile.browserId === browserId).map(profile => profile.id);
      const foundIds = new Set(found.map(profile => profile.id));
      const next: Preferences = {
        ...prefs,
        enabledProfileIds: prefs.enabledProfileIds.filter(id => !oldIds.includes(id) || foundIds.has(id)),
        [`${browserId}UserDataDir`]: directory
      };
      await native.savePreferences(next);
      setPrefs(next);
      setProfiles(previous => [...previous.filter(profile => profile.browserId !== browserId), ...found]);
      if (oldIds.some(id => !foundIds.has(id))) {
        setData(previous => { const copy = { ...previous }; oldIds.filter(id => !foundIds.has(id)).forEach(id => delete copy[id]); return copy; });
        updateOptions({ scopeId: null });
      }
      const enabledFound = found.filter(profile => next.enabledProfileIds.includes(profile.id));
      if (enabledFound.length) await readTargets(enabledFound, browserNames[browserId]);
      else setStatus(`Found ${found.length} ${browserNames[browserId]} ${found.length === 1 ? "profile" : "profiles"}. Choose which to include.`);
    } catch (error) {
      const message = profileDiscoveryError(error);
      setDiscoveryErrors(previous => ({ ...previous, [browserId]: message }));
      setStatus(message);
    }
  };

  const chooseProfileDirectory = async (browserId: BrowserId) => {
    try {
      const directory = await native.chooseUserDataDir(browserId);
      if (!directory) return;
      setDirectoryDrafts(previous => ({ ...previous, [browserId]: directory }));
      await findProfiles(browserId, directory);
    } catch (error) { setStatus(profileDiscoveryError(error)); }
  };

  const openFullDiskAccessSettings = async () => {
    try {
      await native.openFullDiskAccessSettings();
      setFullDiskAccessError(null);
    } catch (error) { setFullDiskAccessError(String(error)); }
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
      const targetTop = listHeadHeight + index * rowHeight;
      if (targetTop < element.scrollTop || targetTop + rowHeight > element.scrollTop + element.clientHeight) {
        element.scrollTop = Math.max(0, targetTop - element.clientHeight / 3);
        setResultScroll(element.scrollTop);
      }
    }
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-result-id="${CSS.escape(id)}"]`)?.focus();
    }));
  };
  const focusResults = () => {
    if (selected) focusResult(selected.id);
    else resultsRef.current?.focus();
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
  const focusSearch = (field: "query" | "refine") => {
    const input = field === "query" ? queryRef.current : refineRef.current;
    if (field === "query") mainRef.current?.scrollTo({ top: 0, behavior: "auto" });
    else input?.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
    requestAnimationFrame(() => {
      input?.focus({ preventScroll: true });
      input?.select();
    });
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
        focusSearch("query"); return;
      }
      if (chord === bindings.refine) {
        event.preventDefault(); setSettingsOpen(false); focusSearch("refine"); return;
      }
      if (chord === bindings.results) {
        event.preventDefault(); setSettingsOpen(false);
        focusResults();
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
      if (event.key === "ArrowDown" && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey
        && (target === queryRef.current || target === refineRef.current)) {
        event.preventDefault();
        focusResults();
        return;
      }
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
        <button type="button" className={`nav-row ${options.scopeId === folder.id ? "active" : ""}`}
          role="treeitem" aria-level={level} aria-expanded={children.length ? open : undefined}
          data-folder-id={folder.id} style={{ "--level": level - 1 } as React.CSSProperties}
          onContextMenu={event => openFolderMenu("nav", folder.id, event)}
          onClick={event => {
            if ((event.target as HTMLElement).closest("[data-branch]") && children.length) {
              setNavCollapsed(folder.id, open);
            } else {
              setOptions(previous => ({ ...previous, scopeId: folder.id }));
            }
          }}>
          <span className={`branch ${open ? "open" : ""} ${children.length ? "" : "leaf"}`} data-branch aria-hidden="true"><Icons.chevron /></span>
          <span className="nav-icon"><Icons.folder /></span>
          <span className="nav-label">{folder.name}</span>
          {showBookmarkCounts && <span className="count" title="Bookmarks including subfolders" aria-label={`${bookmarkCounts.get(folder.id) || 0} bookmarks including subfolders`}>{bookmarkCounts.get(folder.id) || 0}</span>}
        </button>
        {open && children.map(child => renderFolder(child, level + 1))}
      </div>;
    };
    return enabled.map(profile => <div className="nav-group" key={profile.id}>
      <div className="nav-group-label"><BrowserBadge browserId={profile.browserId} /><span className="nav-group-name" title={`${browserNames[profile.browserId]} · ${profile.name}`}>{sourceLabel(profile.browserId, profile.name)}</span>
        {errors[profile.id] ? <span className="nav-flag error" title={errors[profile.id]}>Read failed</span> : data[profile.id]?.warning ? <span className="nav-flag warn" title={data[profile.id].warning || ""}>Possibly stale</span> : null}</div>
      {(folderChildren.get("") || []).filter(folder => folder.source.profileId === profile.id).map(folder => renderFolder(folder, 1))}
    </div>);
  }, [enabled, folderChildren, collapsedNav, options.scopeId, showBookmarkCounts, bookmarkCounts, errors, data]);

  const scopeTrail = scopedFolder ? `${profileMap.get(scopedFolder.source.profileId)?.name} / ${folderPath(scopedFolder.id, folderMap).map(f => f.name).join(" / ")}` : "All bookmarks";
  const settingsTabs = [
    { id: "profiles" as const, label: "Local bookmark profiles", Icon: Icons.user },
    { id: "shortcuts" as const, label: "Keyboard shortcuts", Icon: Icons.keyboard }
  ];

  return <div className={`frame ${showBookmarkCounts ? "" : "no-counts"}`} ref={frameRef} style={{ gridTemplateColumns: `${leftSidebarOpen ? leftSidebarWidth : 0}px minmax(0, 1fr)` }}>
    {leftSidebarOpen && <aside className="sidebar" id="folder-sidebar" aria-label="Folder scope">
      <div className="side-brand"><img className="brand-mark" src={brandMark} alt="" /> Bookmarktivity</div>
      <nav className="side-scroll">
        <div className="side-label">Workspace</div>
        <button type="button" className={`side-row ${!options.scopeId ? "active" : ""}`} onClick={() => updateOptions({ scopeId: null })}><Icons.grid /><span>All bookmarks</span><span className="count" title="Bookmarks in enabled profiles">{totalBookmarks}</span></button>
        <button type="button" className="side-section" aria-expanded={foldersOpen} onClick={() => setFoldersOpen(!foldersOpen)}><span>Your Folders</span><Icons.chevron /></button>
        {foldersOpen && <>
          <div className="folder-actions">
            <button type="button" onClick={() => setCollapsedNav(new Set(allItems.filter(item => item.kind === "folder").map(item => item.id)))}>Collapse all</button>
            <button type="button" onClick={() => setCollapsedNav(new Set())}>Expand all</button>
          </div>
          <div role="tree" aria-label="Folders">
            {navigationGroups}
            {!enabled.length && <p className="sidebar-empty">No profiles enabled.</p>}
          </div>
        </>}
      </nav>
    </aside>}
    {leftSidebarOpen && <div className="resize-handle left-resize" role="separator" aria-label="Resize folders sidebar" aria-orientation="vertical" aria-valuemin={sidebarLimits.left.min} aria-valuemax={sidebarLimits.left.max} aria-valuenow={leftSidebarWidth} tabIndex={0} style={{ left: leftSidebarWidth - 4 }} onPointerDown={event => startSidebarResize("left", event)} onPointerMove={moveSidebarResize} onPointerUp={stopSidebarResize} onPointerCancel={stopSidebarResize} onKeyDown={event => sidebarResizeKey("left", event)} />}
    <div className="workspace">
      <header className="toolbar">
        <button type="button" className="icon-btn" aria-label={leftSidebarOpen ? "Hide folders" : "Show folders"} title={leftSidebarOpen ? "Hide folders" : "Show folders"} aria-controls={leftSidebarOpen ? "folder-sidebar" : undefined} aria-expanded={leftSidebarOpen} onClick={() => setLeftSidebarOpen(open => !open)}><Icons.panelLeft /></button>
        <div className="breadcrumb"><span>Workspace</span><Icons.chevron /><strong title={scopeTrail}>{scopeTrail}</strong></div>
        <label className="search"><Icons.search /><input ref={queryRef} type="search" aria-label="Search bookmarks" autoCorrect="off" autoCapitalize="off" spellCheck={false} placeholder="Search by name, folder or URL…" value={options.query} onChange={event => updateOptions({ query: event.target.value })} /><span className="key">{labelFor(bindings.find)}</span><button type="button" className="search-go" onClick={() => queryRef.current?.focus()}>Search</button></label>
        <div className="tool-group">
          <div className="reread-control"><button type="button" className="btn" disabled={busy || !enabled.length || !inTauri} onClick={() => void refresh(enabled, "All enabled sources")}><Icons.refresh />{busy ? "Re-reading…" : "Re-read all sources"}</button><button type="button" className="btn" disabled={!enabled.length} aria-label="Choose re-read target" aria-haspopup="menu" aria-expanded={refreshOpen} onClick={() => setRefreshOpen(!refreshOpen)}><Icons.caret /></button>
            {refreshOpen && <div className="menu reread-menu" role="menu"><div className="menu-label">By source</div>{browserIds.map(browserId => {
              const targets = enabled.filter(profile => profile.browserId === browserId);
              return targets.length ? <button type="button" role="menuitem" key={browserId} onClick={() => void refresh(targets, browserNames[browserId])}><BrowserBadge browserId={browserId} />{browserNames[browserId]} <small>{targets.length} enabled</small></button> : null;
            })}<div className="menu-rule" /><div className="menu-label">By profile</div>{enabled.map(profile => <button type="button" role="menuitem" key={profile.id} onClick={() => void refresh([profile], profile.name)}><BrowserBadge browserId={profile.browserId} />{browserNames[profile.browserId]} · {profile.name}</button>)}</div>}
          </div>
          <span className="tool-sep" />
          <button type="button" className="icon-btn" aria-pressed={showBookmarkCounts} aria-label={showBookmarkCounts ? "Hide counts" : "Show counts"} title={showBookmarkCounts ? "Hide counts" : "Show counts"} onClick={() => setShowBookmarkCounts(show => !show)}><Icons.hash /></button>
          <button type="button" className="icon-btn" aria-label={rightSidebarOpen ? "Hide details" : "Show details"} title={rightSidebarOpen ? "Hide details" : "Show details"} aria-controls={rightSidebarOpen ? "details-sidebar" : undefined} aria-expanded={rightSidebarOpen} onClick={() => setRightSidebarOpen(open => !open)}><Icons.panelRight /></button>
          <button type="button" className="icon-btn" aria-label="Profiles & settings" title={`Profiles & settings (${labelFor(bindings.settings)})`} onClick={() => setSettingsOpen(true)}><Icons.settings /></button>
          <div className="segmented" role="group" aria-label="Appearance"><button type="button" aria-label="Light" title="Light" aria-pressed={prefs.theme !== "dark"} onClick={() => void saveTheme("light")}><Icons.sun /></button><button type="button" aria-label="Dark" title="Dark" aria-pressed={prefs.theme === "dark"} onClick={() => void saveTheme("dark")}><Icons.moon /></button></div>
        </div>
      </header>
      <div className="filterbar">
        <div className="filter-group" role="group" aria-label="Search in"><span className="filter-label">Search in</span>
          {(["name", "url", "folder"] as Field[]).map(field => <label className="pill" key={field}><input type="checkbox" checked={options.fields.includes(field)} onChange={event => updateOptions({ fields: event.target.checked ? [...options.fields, field] : options.fields.filter(value => value !== field) })} /><span>{field === "folder" ? "Folder name" : field === "url" ? "URL" : "Name"}</span></label>)}
          <label className="pill"><input type="checkbox" checked={options.regex} onChange={event => updateOptions({ regex: event.target.checked })} /><span>Regex</span></label>
        </div>
        <div className="syntax"><button type="button" className="link" aria-expanded={syntaxOpen} onClick={() => setSyntaxOpen(!syntaxOpen)}><Icons.help />Syntax guide</button>
          {syntaxOpen && <div className="syntax-menu"><strong>Query ideas</strong><p><code>name:"Project plan"</code> matches that exact text anywhere inside a longer name, even mid-word.</p><p><code>url:docs.example.com AND name:guide</code> combines fields.</p><p><code>OR</code> broadens a query. <code>folder:</code> matches the immediate folder name. The folder list sets scope.</p><p>Regex mode treats the full primary query as an expression across the selected fields.</p></div>}
        </div>
        <div className="filter-group" role="radiogroup" aria-label="Search selected folder"><span className="filter-label">Search selected folder</span>
          {([["descendants", "Including descendants"], ["direct", "Direct contents only"]] as [ScopeMode, string][]).map(([mode, label]) => <label className="pill" key={mode}><input type="radio" name="scope-mode" checked={options.scopeMode === mode} onChange={() => updateOptions({ scopeMode: mode })} /><span>{label}</span></label>)}
        </div>
        <span className="filter-spacer" />
        <div className="filter-group"><label className="filter-label" htmlFor="sort">Sort by</label><select id="sort" value={options.sort} onChange={event => updateOptions({ sort: event.target.value as Sort })}><option value="relevance">Relevance</option><option value="alphabetical">Alphabetical</option>{hasDates && <option value="created">Date created</option>}{hasModified && <option value="modified">Date modified</option>}</select></div>
      </div>
      <div className="content" ref={contentRef} style={{ gridTemplateColumns: `minmax(0, 1fr) ${rightSidebarOpen ? rightSidebarWidth : 0}px` }}><main className="main" ref={mainRef}>
        <div className="result-head">
          <div className="result-heading"><h1>{options.query ? "Search results" : scopedFolder?.name || "All bookmarks"}</h1><div className="caption">{searching ? "Searching bookmarks…" : result.error || `${result.items.length} matching items · ${visible.length} visible · Folders first`}</div></div>
          <label className="refine"><Icons.filter /><input ref={refineRef} type="search" aria-label="Search within results" autoCorrect="off" autoCapitalize="off" spellCheck={false} placeholder="Search within these results…" value={options.refine} onChange={event => updateOptions({ refine: event.target.value })} /><span className="key">{labelFor(bindings.refine)}</span></label>
        </div>
        <div className="source-status" role="status">
          <p className="status-line"><Icons.ok /><span>{status}</span></p>
          {Object.entries(errors).map(([id, error]) => <p className="status-item error" key={id}><Icons.error /><span><strong>{profileMap.get(id) ? `${browserNames[profileMap.get(id)!.browserId]} · ${profileMap.get(id)!.name}` : id}</strong> {error}</span></p>)}
          {snapshotWarnings.map(profile => <p className="status-item warn" key={profile.id}><Icons.warning /><span><strong>{browserNames[profile.browserId]} · {profile.name}</strong> {data[profile.id].warning}</span></p>)}
        </div>
        <div className="active-bar"><span className="chip accent">{enabled.length} enabled {enabled.length === 1 ? "profile" : "profiles"}</span>{snapshotWarnings.length > 0 && <span className="chip warn">{snapshotWarnings.length} possibly stale {snapshotWarnings.length === 1 ? "profile" : "profiles"}</span>}{scopedFolder && <span className="chip">{scopedFolder.name} · {options.scopeMode === "direct" ? "direct only" : "with descendants"}</span>}{options.query && <span className="chip">Query: {options.query}</span>}{options.refine && <span className="chip">Within results: {options.refine}</span>}{result.matchedFolderIds.length > 0 && <span className="chip">Folder matches include contents</span>}<span className="chip">{options.regex ? "Regex mode" : `Fields: ${options.fields.join(", ") || "none"}`}</span></div>
        <div className={`result-list ${virtual ? "virtual" : ""}`} role="tree" aria-label="Search results" aria-busy={searching} tabIndex={0} ref={resultsRef} onScroll={event => setResultScroll(event.currentTarget.scrollTop)}>
          {!visible.length ? <div className="empty"><Icons.search /><strong>{searching ? "Searching bookmarks" : result.error ? "Check the search query" : enabled.length ? "No matches in this scope" : "Choose a browser profile"}</strong><span>{searching ? "Checking the enabled profiles…" : result.error || (enabled.length ? "Try another query, field, folder, or enabled profile." : "Open Profiles & settings to include local bookmarks.")}</span></div> : <>
            <div className="list-head" aria-hidden="true"><span className="lh-name">Item</span><span className="lh-path">Location</span><span className="lh-count">Bookmarks</span><span className="lh-source">Source</span></div>
            <div className={virtual ? "virtual-space" : "result-rows"} style={virtual ? { height: visible.length * rowHeight } : undefined}>
            {rendered.map((item, offset) => {
              const isFolder = item.kind === "folder";
              const childCount = tree.children.get(item.id)?.length || 0;
              const expanded = !collapsedResults.has(item.id);
              const path = folderPath(item.parentId, folderMap).map(f => f.name).join(" / ");
              const textQueries = options.regex ? [options.refine] : [options.query, options.refine];
              const regexMatch = options.regex ? result.regexHighlights?.get(item.id) : undefined;
              const titleSpans: MatchSpan[] = [...(regexMatch?.name || []), ...(isFolder ? regexMatch?.folder || [] : [])];
              const pathSpans: MatchSpan[] = [];
              if (!isFolder && regexMatch?.folder?.length) {
                const parentName = folderMap.get(item.parentId || "")?.name || "";
                if (parentName) for (const [start, end] of regexMatch.folder) pathSpans.push([path.length - parentName.length + start, path.length - parentName.length + end]);
              }
              const rowStyle = { "--level": item.level - 1, ...(virtual ? { position: "absolute", top: (firstVisible + offset) * rowHeight, left: 0, right: 0, height: rowHeight } : {}) } as React.CSSProperties;
              return <button type="button" className={`row ${item.kind} ${selected?.id === item.id ? "selected" : ""}`} key={item.id}
                role="treeitem" aria-level={item.level} aria-expanded={isFolder && childCount ? expanded : undefined} aria-selected={selected?.id === item.id}
                data-result-id={item.id} style={rowStyle}
                onContextMenu={isFolder ? event => openFolderMenu("results", item.id, event) : undefined}
                onClick={event => { setSelectedId(item.id); if ((event.target as HTMLElement).closest("[data-result-branch]") && isFolder && childCount) setResultCollapsed(item.id, expanded); focusResult(item.id); }}
                onDoubleClick={() => { setSelectedId(item.id); void openItem(item); }}>
                <span className={`branch ${expanded ? "open" : ""} ${childCount ? "" : "leaf"}`} data-result-branch aria-hidden="true"><Icons.chevron /></span>
                <span className="row-icon">{isFolder ? <Icons.folder /> : <Icons.bookmark />}</span>
                <span className="row-title"><Highlight value={item.name} queries={textQueries} spans={titleSpans} /></span>
                {!isFolder && <span className="row-url"><Highlight value={item.url} queries={textQueries} spans={regexMatch?.url} /></span>}
                <span className="row-path">{path ? <Highlight value={path} queries={textQueries} spans={pathSpans} /> : "Top-level folder"}</span>
                <span className="count row-count">{isFolder && showBookmarkCounts ? <span title="Bookmarks including subfolders" aria-label={`${bookmarkCounts.get(item.id) || 0} bookmarks including subfolders`}>{bookmarkCounts.get(item.id) || 0}</span> : null}</span>
                <span className="source" title={`${browserNames[item.source.browserId as BrowserId]} · ${item.source.profileName}`}><BrowserBadge browserId={item.source.browserId} /><span className="source-text">{sourceLabel(item.source.browserId, item.source.profileName)}</span></span>
              </button>;
            })}
            </div>
          </>}
        </div>
      </main>
      {rightSidebarOpen && <div className="resize-handle right-resize" role="separator" aria-label="Resize details sidebar" aria-orientation="vertical" aria-valuemin={sidebarLimits.right.min} aria-valuemax={sidebarLimits.right.max} aria-valuenow={rightSidebarWidth} tabIndex={0} style={{ right: rightSidebarWidth - 4 }} onPointerDown={event => startSidebarResize("right", event)} onPointerMove={moveSidebarResize} onPointerUp={stopSidebarResize} onPointerCancel={stopSidebarResize} onKeyDown={event => sidebarResizeKey("right", event)} />}
      {rightSidebarOpen && <aside className="detail" id="details-sidebar" aria-label="Selected item details"><div className="detail-head">{selected ? `Selected ${selected.kind}` : "Details"}</div>{selected ? <>
        <div className="detail-icon">{selected.kind === "folder" ? <Icons.folder /> : <Icons.bookmark />}</div><h2>{selected.name}</h2>{selected.kind === "bookmark" && <span className="detail-url">{selected.url}</span>}
        <div className="detail-actions"><button type="button" className="btn btn-primary" onClick={() => void openItem(selected)}>{selected.kind === "folder" ? "Open folder" : "Open in default browser"}<Icons.external /></button>{selected.kind === "bookmark" && <button type="button" className="btn" onClick={() => void copyItem(selected)}><Icons.copy />Copy URL</button>}</div>
        <dl className="metadata">
          <div><dt>Source</dt><dd className="meta-source"><BrowserBadge browserId={selected.source.browserId} />{browserNames[selected.source.browserId as BrowserId]} · {selected.source.profileName}{data[selected.source.profileId]?.warning && <span className="stale">Possibly stale snapshot</span>}</dd></div>
          <div><dt>Full folder path</dt><dd><ol className="path">{selectedPath.map(folder => <li key={folder.id}>{folder.name}</li>)}</ol></dd></div>
          <div><dt>Type</dt><dd>{selected.kind === "folder" ? "Folder" : "Bookmark"}</dd></div>
          <div><dt>Date added</dt><dd>{selected.dateAdded != null ? new Date(selected.dateAdded).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "Not provided by this browser"}</dd></div>
        </dl>
      </> : <p className="detail-empty">Select a folder or bookmark to see its source and full path.</p>}<div className="read-only"><Icons.lock /><span>Read only. Bookmarktivity does not change browser bookmark files.</span></div></aside>}
      </div>
      <footer className="footer"><span>Enabled profiles only · Read-only browser access</span><div className="shortcuts"><span><span className="key">{labelFor(bindings.results)}</span> Results</span><span><span className="key">← →</span> Folders</span><span><span className="key">Esc Esc</span> Reset</span><span><span className="key">{labelFor(bindings.copy)}</span> Copy URL</span></div></footer>
    </div>
    {folderMenu && <div className="menu folder-context-menu" role="menu" aria-label={`Folder actions for ${folderMap.get(folderMenu.id)?.name || "selected folder"}`} ref={folderMenuRef} style={{ left: folderMenu.x, top: folderMenu.y }} onKeyDown={event => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      event.stopPropagation();
      const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=menuitem]")];
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      buttons[(index + (event.key === "ArrowDown" ? 1 : buttons.length - 1)) % buttons.length]?.focus();
    }}>
      <button type="button" role="menuitem" onClick={() => changeFolderBranch(folderMenu.surface, folderMenu.id, false)}>Expand all <span className="key">{labelFor(bindings.expandAll)}</span></button>
      <button type="button" role="menuitem" onClick={() => changeFolderBranch(folderMenu.surface, folderMenu.id, true)}>Collapse all <span className="key">{labelFor(bindings.collapseAll)}</span></button>
    </div>}
    {settingsOpen && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="settings-title" onPointerDown={event => { if (event.target === event.currentTarget) setSettingsOpen(false); }}><div className="modal">
      <nav className="modal-nav"><h2 id="settings-title">Profiles & settings</h2>
        <div className="settings-tabs" role="tablist" aria-orientation="vertical" aria-label="Settings sections" onKeyDown={event => {
          if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === "Home" ? "profiles" : event.key === "End" ? "shortcuts" : settingsTab === "profiles" ? "shortcuts" : "profiles";
          setSettingsTab(next);
          setCapturingShortcut(null);
          event.currentTarget.querySelector<HTMLElement>(`#settings-tab-${next}`)?.focus();
        }}>
          {settingsTabs.map(({ id, label, Icon }) => <button key={id} id={`settings-tab-${id}`} type="button" role="tab" aria-selected={settingsTab === id} aria-controls={`settings-panel-${id}`} tabIndex={settingsTab === id ? 0 : -1} onClick={() => { setSettingsTab(id); setCapturingShortcut(null); }}><Icon />{label}</button>)}
        </div>
      </nav>
      <div className="modal-body">
        <div className="modal-top"><div><h3>{settingsTab === "profiles" ? "Local bookmark profiles" : "Keyboard shortcuts"}</h3><p>Choose which local profiles to include and customize keyboard shortcuts.</p></div><button type="button" className="icon-btn" aria-label="Close settings" onClick={() => setSettingsOpen(false)}><Icons.close /></button></div>
        {settingsTab === "profiles" && <div id="settings-panel-profiles" role="tabpanel" aria-labelledby="settings-tab-profiles" className="settings-panel" tabIndex={0}>
          {mac && <div className="settings-section fda"><h4><Icons.lock />macOS browser access</h4><p>To discover browser profiles automatically, add Bookmarktivity in System Settings › Privacy &amp; Security › Full Disk Access. After allowing access, return here and choose Find profiles for each browser.</p><button type="button" className="btn" onClick={() => void openFullDiskAccessSettings()} disabled={!inTauri}>Open Full Disk Access settings</button>{fullDiskAccessError && <p className="settings-note error" role="alert">{fullDiskAccessError}</p>}</div>}
          {browserIds.map(browserId => <div className="settings-section" key={browserId}><h4><BrowserBadge browserId={browserId} />{browserNames[browserId]} · Local profiles</h4>
            <div className="directory-row"><label htmlFor={`${browserId}-dir`}>{browserNames[browserId]} user-data directory</label><div><input id={`${browserId}-dir`} autoCorrect="off" autoCapitalize="off" spellCheck={false} placeholder="Use system default" value={directoryDrafts[browserId]} onChange={event => setDirectoryDrafts(previous => ({ ...previous, [browserId]: event.target.value }))} />{mac && <button type="button" className="btn" onClick={() => void chooseProfileDirectory(browserId)} disabled={!inTauri}>Choose folder…</button>}<button type="button" className="btn" onClick={() => void findProfiles(browserId)} disabled={!inTauri}>Find profiles</button></div><small>{directoryHints[browserId]}</small></div>
            {profiles.filter(profile => profile.browserId === browserId).map(profile => <label className="profile-setting" key={profile.id}><span><strong>{profile.name}</strong><small>{browserNames[browserId]} · {profile.folderId}</small>{errors[profile.id] && <em className="profile-error">{errors[profile.id]}</em>}</span><input type="checkbox" role="switch" checked={prefs.enabledProfileIds.includes(profile.id)} onChange={event => void toggleProfile(profile.id, event.target.checked)} /></label>)}
            {discoveryErrors[browserId] && <p className="settings-note error" role="alert">{discoveryErrors[browserId]}</p>}
            {!profiles.some(profile => profile.browserId === browserId) && !discoveryErrors[browserId] && <p className="settings-note">No profiles found. Check the directory and choose Find profiles.</p>}
          </div>)}
        </div>}
        {settingsTab === "shortcuts" && <div id="settings-panel-shortcuts" role="tabpanel" aria-labelledby="settings-tab-shortcuts" className="settings-panel" tabIndex={0}><div className="settings-section">
          {(Object.keys(shortcutNames) as ShortcutAction[]).map(action => <div key={action}>
            <div className="shortcut-line"><span>{shortcutNames[action]}</span><button type="button" ref={capturingShortcut === action ? shortcutCaptureRef : undefined} className={`shortcut-capture ${capturingShortcut === action ? "capturing" : ""}`} onClick={() => { setCapturingShortcut(action); setShortcutDraft(bindings[action]); }}>{capturingShortcut === action ? "Press shortcut…" : labelFor(bindings[action])}</button></div>
            {capturingShortcut === action && <div className="shortcut-editor"><label>Or type a shortcut<input aria-label={`${shortcutNames[action]} shortcut`} autoCorrect="off" value={shortcutDraft} onChange={event => setShortcutDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void applyShortcut(action, shortcutDraft); } }} placeholder={mac ? "Cmd+G" : "Ctrl+G"} /></label><button type="button" className="btn" onClick={() => void applyShortcut(action, shortcutDraft)}>Save</button><button type="button" className="btn" onClick={() => { setCapturingShortcut(null); setShortcutDraft(""); }}>Cancel</button></div>}
          </div>)}
          <div className="shortcut-line"><span>Reset filters</span><span className="key">Esc Esc</span></div>
          <div className="shortcut-line"><span>Open selected item</span><span className="key">Enter</span></div>
          <button type="button" className="inline-button" onClick={() => { void saveShortcuts({}); setCapturingShortcut(null); setShortcutDraft(""); }}>Restore defaults</button>
        </div></div>}
      </div>
    </div></div>}
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>;
}
