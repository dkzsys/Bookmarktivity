/*
 * Shared synthetic data and behaviour for the Bookmarktivity full-UI design mocks.
 * Every direction renders the same content and interactions; only markup placement and CSS differ.
 * No real browser data is used.
 */
(() => {
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  const svg = body => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  const icon = {
    search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
    folder: svg('<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2.5h7.5A2.5 2.5 0 0 1 21 10v7.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/>'),
    bookmark: svg('<path d="M7 3.5h10a1 1 0 0 1 1 1V21l-6-4-6 4V4.5a1 1 0 0 1 1-1z"/>'),
    chevron: svg('<path d="m9 6 6 6-6 6"/>'),
    caret: svg('<path d="m6 9 6 6 6-6"/>'),
    settings: svg('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'),
    refresh: svg('<path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/>'),
    sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    moon: svg('<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>'),
    panelLeft: svg('<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M9 4v16"/>'),
    panelRight: svg('<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M15 4v16"/>'),
    panelBottom: svg('<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 14h18"/>'),
    hash: svg('<path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16"/>'),
    copy: svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
    external: svg('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
    close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
    alert: svg('<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4M12 17h.01"/>'),
    error: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5M12 16h.01"/>'),
    ok: svg('<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16.5 9.5"/>'),
    lock: svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
    filter: svg('<path d="M4 5h16l-6 7.5V19l-4 2v-8.5z"/>'),
    layers: svg('<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>'),
    help: svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.2M12 17h.01"/>'),
    grid: svg('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'),
    keyboard: svg('<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>'),
    user: svg('<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>'),
    mark: '<svg viewBox="0 0 512 512" aria-hidden="true"><rect x="24" y="24" width="464" height="464" rx="132" fill="var(--mark, #5b5bd6)"/><path d="M163 133c0-17 14-31 31-31h124c17 0 31 14 31 31v253c0 12-14 19-24 12l-69-48-69 48c-10 7-24 0-24-12V133Z" fill="var(--mark-ink, #fff)"/><path d="m209 279 92-92m-56 0h56v56" fill="none" stroke="var(--mark, #5b5bd6)" stroke-width="25" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  const BROWSERS = {
    edge: { name: "Microsoft Edge", short: "Edge", letter: "E", hint: "For a custom location, use the parent of the profile directory shown at edge://version." },
    chrome: { name: "Google Chrome", short: "Chrome", letter: "C", hint: "For a custom location, use the parent of the profile directory shown at chrome://version." },
    brave: { name: "Brave", short: "Brave", letter: "B", hint: "For a custom location, use the parent of the profile directory shown at brave://version." },
    firefox: { name: "Firefox", short: "Firefox", letter: "F", hint: "For a custom location, use the folder containing profiles.ini, or the parent of the profile Root Directory shown at about:profiles." },
    safari: { name: "Safari", short: "Safari", letter: "S", hint: "Safari keeps one bookmark collection per user. For a custom location, use the folder containing Bookmarks.plist." }
  };
  const PROFILES = [
    { id: "edge-work", browser: "edge", name: "Work", folder: "Default", enabled: true },
    { id: "edge-personal", browser: "edge", name: "Personal", folder: "Profile 1", enabled: false },
    { id: "chrome-research", browser: "chrome", name: "Research", folder: "Default", enabled: true },
    { id: "chrome-side", browser: "chrome", name: "Side project", folder: "Profile 2", enabled: true, error: "AccountBookmarks is available only in encrypted storage, which Bookmarktivity cannot read yet." },
    { id: "brave-archive", browser: "brave", name: "Archive", folder: "Default", enabled: true, warning: "Showing a clear-text bookmark snapshot. Encrypted storage also exists, so these results may be older than the browser's current bookmarks." },
    { id: "firefox-default", browser: "firefox", name: "default-release", folder: "Profiles/x7k2.default-release", enabled: true },
    { id: "safari-default", browser: "safari", name: "Safari", folder: "Default", enabled: true, noDates: true }
  ];
  const TREE = {
    "edge-work": [
      ["Favorites bar", [
        ["Team wiki", "https://wiki.example.com/team"],
        ["Sprint board", "https://boards.example.com/sprint-42"],
        ["Research", [
          ["Browser bookmark API notes", "https://developer.example.com/bookmark-api"],
          ["Accessibility checklist", "https://a11y.example.org/checklist"],
          ["Keyboard tree navigation patterns", "https://patterns.example.org/tree-view"]
        ]],
        ["Design", [["Design tokens 2026", "https://design.example.com/tokens"], ["Icon library", "https://icons.example.com/library"]]]
      ]],
      ["Other favorites", [["Expense portal", "https://expenses.example.com"], ["Travel policy", "https://intranet.example.com/policies/travel"]]]
    ],
    "edge-personal": [["Favorites bar", [["Home budget", "https://budget.example.net"], ["Garden planner", "https://garden.example.org/plan"]]]],
    "chrome-research": [
      ["Bookmarks bar", [
        ["Project plan 2026", "https://docs.example.com/project-plan-2026"],
        ["Research", [
          ["Online timezone converter", "https://time.example.net/convert"],
          ["Regex tester", "https://regex.example.dev"],
          ["Papers", [["Fuzzy search survey", "https://papers.example.org/fuzzy-search"], ["Ranking with edit distance", "https://papers.example.org/edit-distance"]]]
        ]],
        ["Docs guides", [["Docs style guide", "https://docs.example.com/guide/style"], ["API reference guide", "https://docs.example.com/guide/api"]]]
      ]],
      ["Other bookmarks", [["Conference schedule", "https://events.example.com/2026/schedule"]]]
    ],
    "brave-archive": [
      ["Bookmarks", [
        ["Archive 2024", [["Old project plan", "https://docs.example.com/project-plan-2024"], ["Conference notes", "https://notes.example.net/conf-2024"]]],
        ["Recipes", [["Weeknight noodles", "https://recipes.example.org/noodles"], ["Sourdough timeline", "https://recipes.example.org/sourdough"]]]
      ]]
    ],
    "firefox-default": [
      ["Bookmarks Toolbar", [
        ["Developer docs", "https://developer.example.org/docs"],
        ["Research", [["SQLite WAL format notes", "https://sqlite.example.org/wal"], ["Rust SQLite guide", "https://rust.example.dev/sqlite"]]]
      ]],
      ["Bookmarks Menu", [["Release checklist", "https://handbook.example.com/release"]]],
      ["Other Bookmarks", [["Kanban tips", "https://blog.example.com/kanban"]]]
    ],
    "safari-default": [
      ["Favorites", [["Support articles", "https://support.example.com"], ["Research", [["Swift concurrency notes", "https://swift.example.dev/concurrency"]]]]],
      ["Bookmarks Menu", [["Travel booking", "https://travel.example.com/book"]]]
    ]
  };

  const ITEMS = [];
  let sequence = 0;
  const build = (profile, nodes, parentId) => {
    for (const [name, value] of nodes) {
      sequence++;
      const id = `${profile.id}/${sequence}`;
      const age = (sequence * 37) % 900;
      const added = profile.noDates ? null : Date.UTC(2026, 9, 30) - age * 864e5;
      const base = { id, parentId, name, profileId: profile.id, browser: profile.browser, added, modified: added && added + ((sequence * 13) % 60) * 864e5 };
      if (Array.isArray(value)) { ITEMS.push({ ...base, kind: "folder" }); build(profile, value, id); }
      else ITEMS.push({ ...base, kind: "bookmark", url: value });
    }
  };
  PROFILES.forEach(profile => TREE[profile.id] && !profile.error && build(profile, TREE[profile.id], null));
  const BY_ID = new Map(ITEMS.map(item => [item.id, item]));
  const ORDER = new Map(ITEMS.map((item, index) => [item.id, index]));
  const CHILDREN = new Map();
  for (const item of ITEMS) {
    const key = item.parentId || `root:${item.profileId}`;
    if (!CHILDREN.has(key)) CHILDREN.set(key, []);
    CHILDREN.get(key).push(item);
  }
  const PROFILE = new Map(PROFILES.map(profile => [profile.id, profile]));
  const COUNTS = new Map();
  for (const item of ITEMS) {
    if (item.kind !== "bookmark") continue;
    for (let id = item.parentId; id; id = BY_ID.get(id).parentId) COUNTS.set(id, (COUNTS.get(id) || 0) + 1);
  }
  const folderPath = id => { const path = []; for (; id; id = BY_ID.get(id)?.parentId) path.unshift(BY_ID.get(id)); return path; };
  const folderKids = id => (CHILDREN.get(id) || []).filter(item => item.kind === "folder");

  const DEFAULT_BINDINGS = {
    find: mac ? "Meta+F" : "Ctrl+F", refine: "Alt+F", results: mac ? "Meta+G" : "Alt+R", copy: mac ? "Meta+C" : "Ctrl+C",
    settings: mac ? "Meta+," : "Ctrl+,", expandAll: mac ? "Meta+E" : "Ctrl+E", collapseAll: mac ? "Meta+Shift+E" : "Ctrl+Shift+E"
  };
  const SHORTCUT_NAMES = {
    find: "Global search", refine: "Search within results", results: "Navigate to results", copy: "Copy selected URL",
    settings: "Profiles & settings", expandAll: "Expand all in selected folder", collapseAll: "Collapse all in selected folder"
  };
  const labelFor = binding => binding.replace("Meta", "⌘").replace("Ctrl", mac ? "⌃" : "Ctrl").replace("Alt", mac ? "⌥" : "Alt").replace("Shift", "⇧").replaceAll("+", mac ? "" : "+");
  const chordFor = event => {
    if (["Meta", "Control", "Alt", "Shift"].includes(event.key)) return null;
    const modifiers = [event.metaKey && "Meta", event.ctrlKey && "Ctrl", event.altKey && "Alt", event.shiftKey && "Shift"].filter(Boolean);
    const key = /^Key[A-Z]$/.test(event.code) ? event.code.slice(3) : /^Digit\d$/.test(event.code) ? event.code.slice(5) : event.code === "Comma" ? "," : event.key.length === 1 ? event.key.toUpperCase() : event.key;
    return [...modifiers, key].join("+");
  };

  const navCollapsed = new Set(ITEMS.filter(item => item.kind === "folder").map(item => item.id));
  navCollapsed.delete(ITEMS[0].id);
  const S = {
    query: "", refine: "", fields: ["name", "url", "folder"], regex: false, scopeId: null, scopeMode: "descendants", sort: "relevance",
    selectedId: null, collapsedResults: new Set(), navCollapsed, signature: null, folderSection: true,
    folders: true, details: true, counts: true, settings: false, tab: "profiles", reread: false, syntax: false, ctx: null, busy: false,
    capturing: null, bindings: { ...DEFAULT_BINDINGS }, focusResults: false, escapeAt: 0,
    status: "Startup: 5 refreshed, 1 failed. Data for failed profiles was removed."
  };
  let RESULT = null;
  let TREE_VIEW = null;

  const ALL_FIELDS = ["name", "url", "folder"];
  const values = item => ({ name: item.name, url: item.url || "", folder: item.kind === "folder" ? item.name : BY_ID.get(item.parentId)?.name || "" });
  const parse = query => {
    const groups = [[]];
    const pattern = /(?:(name|url|folder):)?(?:"([^"]*)"|(\S+))/gi;
    for (const match of query.matchAll(pattern)) {
      const field = match[1]?.toLowerCase() || null;
      const value = match[2] ?? match[3] ?? "";
      if (!field && match[2] === undefined && /^(AND|OR)$/.test(value)) { if (value === "OR") groups.push([]); continue; }
      if (value) groups.at(-1).push({ field, value: value.toLowerCase() });
    }
    return groups.filter(group => group.length);
  };
  const matches = (item, groups, fields) => {
    const v = values(item);
    return groups.some(group => group.every(term => (term.field ? [term.field] : fields).some(key => fields.includes(key) && v[key].toLowerCase().includes(term.value))));
  };
  const hasAncestor = (item, ids) => { for (let id = item.parentId; id; id = BY_ID.get(id)?.parentId) if (ids.has(id)) return true; return false; };
  const stage = (pool, groups, fields) => {
    const standalone = groups.length === 1 && groups[0].length === 1 && (groups[0][0].field === "folder" || (!groups[0][0].field && fields.length === 1 && fields[0] === "folder"));
    const folderIds = standalone ? new Set(pool.filter(item => item.kind === "folder" && matches(item, groups, fields)).map(item => item.id)) : new Set();
    return { items: pool.filter(item => matches(item, groups, fields) || hasAncestor(item, folderIds)), folderIds: [...folderIds] };
  };
  const inScope = item => {
    if (!S.scopeId) return true;
    if (item.id === S.scopeId) return false;
    if (item.parentId === S.scopeId) return true;
    return S.scopeMode === "descendants" && hasAncestor(item, new Set([S.scopeId]));
  };
  const enabledProfiles = () => PROFILES.filter(profile => profile.enabled);

  function compute() {
    const enabled = new Set(enabledProfiles().map(profile => profile.id));
    let pool = ITEMS.filter(item => enabled.has(item.profileId) && inScope(item));
    let error = null, folderIds = [], regex = null;
    const terms = [];
    try {
      if (S.query.trim()) {
        if (S.regex) {
          regex = new RegExp(S.query, "i");
          pool = pool.filter(item => S.fields.some(field => regex.test(values(item)[field])));
        } else {
          const groups = parse(S.query);
          terms.push(...groups.flat());
          ({ items: pool, folderIds } = stage(pool, groups, S.fields));
        }
      }
      if (S.refine.trim()) {
        const groups = parse(S.refine);
        terms.push(...groups.flat());
        const refined = stage(pool, groups, ALL_FIELDS);
        pool = refined.items;
        folderIds = [...folderIds, ...refined.folderIds];
      }
    } catch (failure) {
      error = `Invalid regular expression: ${failure.message.replace(/^Invalid regular expression: /, "")}`;
      pool = [];
    }
    const score = item => {
      if (!terms.length) return 0;
      const name = item.name.toLowerCase();
      return terms.reduce((total, term) => total + (name.startsWith(term.value) ? 3 : name.includes(term.value) ? 2 : 1), 0);
    };
    pool.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
      if (S.sort === "alphabetical") return a.name.localeCompare(b.name);
      if (S.sort === "created" || S.sort === "modified") {
        const key = S.sort === "created" ? "added" : "modified";
        return (b[key] ?? -Infinity) - (a[key] ?? -Infinity) || a.name.localeCompare(b.name);
      }
      return score(b) - score(a) || ORDER.get(a.id) - ORDER.get(b.id);
    });
    return { items: pool, error, folderIds, regex, terms };
  }

  function arrange(items) {
    const present = new Set(items.map(item => item.id));
    const children = new Map([["", []]]);
    const parents = new Map();
    for (const item of items) {
      const parent = present.has(item.parentId) ? item.parentId : "";
      parents.set(item.id, parent || null);
      if (!children.has(parent)) children.set(parent, []);
      children.get(parent).push(item);
    }
    const visible = [];
    const walk = (key, level) => {
      for (const item of children.get(key) || []) {
        visible.push({ item, level });
        if (item.kind === "folder" && !S.collapsedResults.has(item.id)) walk(item.id, level + 1);
      }
    };
    walk("", 1);
    return { visible, children, parents };
  }

  function highlight(text) {
    text = String(text ?? "");
    const lower = text.toLowerCase();
    let spans = [];
    if (RESULT?.regex) {
      try { for (const match of text.matchAll(new RegExp(RESULT.regex.source, "gi"))) { if (!match[0]) break; spans.push([match.index, match.index + match[0].length]); } } catch { /* ignore */ }
    } else {
      for (const term of RESULT?.terms || []) {
        for (let index = lower.indexOf(term.value); term.value && index >= 0; index = lower.indexOf(term.value, index + term.value.length)) spans.push([index, index + term.value.length]);
      }
    }
    if (!spans.length) return esc(text);
    spans.sort((a, b) => a[0] - b[0]);
    const merged = [spans[0]];
    for (const [start, end] of spans.slice(1)) { const last = merged.at(-1); if (start <= last[1]) last[1] = Math.max(last[1], end); else merged.push([start, end]); }
    let html = "", at = 0;
    for (const [start, end] of merged) { html += esc(text.slice(at, start)) + `<mark>${esc(text.slice(start, end))}</mark>`; at = end; }
    return html + esc(text.slice(at));
  }

  const badge = browser => `<span class="badge" data-browser="${browser}" title="${esc(BROWSERS[browser].name)}">${BROWSERS[browser].letter}</span>`;
  const sourceLabel = profile => profile.name === BROWSERS[profile.browser].short ? profile.name : `${BROWSERS[profile.browser].short} · ${profile.name}`;
  const put = (selector, html) => { const element = $(selector); if (element) element.innerHTML = html; };
  const date = value => value ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "Not provided by this browser";

  function renderNav() {
    const row = (folder, level) => {
      const kids = folderKids(folder.id);
      const open = !S.navCollapsed.has(folder.id);
      return `<button type="button" class="nav-row${S.scopeId === folder.id ? " active" : ""}" role="treeitem" aria-level="${level}" ${kids.length ? `aria-expanded="${open}"` : ""} data-nav="${folder.id}" style="--level:${level - 1}">`
        + `<span class="nav-branch${kids.length ? (open ? " open" : "") : " leaf"}" data-nav-branch>${icon.chevron}</span>`
        + `<span class="nav-icon">${icon.folder}</span><span class="nav-label">${esc(folder.name)}</span><span class="nav-count count">${COUNTS.get(folder.id) || 0}</span></button>`
        + (open ? kids.map(kid => row(kid, level + 1)).join("") : "");
    };
    const html = enabledProfiles().map(profile => {
      const flag = profile.error ? `<span class="nav-flag error" title="${esc(profile.error)}">Read failed</span>` : profile.warning ? `<span class="nav-flag warn" title="${esc(profile.warning)}">Possibly stale</span>` : "";
      return `<div class="nav-group" role="group"><div class="nav-group-label">${badge(profile.browser)}<span class="nav-group-name">${esc(sourceLabel(profile))}</span>${flag}</div>`
        + folderKids(`root:${profile.id}`).map(folder => row(folder, 1)).join("") + `</div>`;
    }).join("");
    put("#nav-tree", html || `<p class="nav-empty">No profiles enabled.</p>`);
    const total = ITEMS.filter(item => item.kind === "bookmark" && PROFILE.get(item.profileId).enabled).length;
    put("#all-count", String(total));
    $("#all-row")?.classList.toggle("active", !S.scopeId);
    const section = $("[data-action=folder-section]");
    section?.setAttribute("aria-expanded", S.folderSection);
    $("#nav-tree")?.toggleAttribute("hidden", !S.folderSection);
    $("#folder-actions")?.toggleAttribute("hidden", !S.folderSection);
  }

  function renderResults() {
    const { visible, children } = TREE_VIEW;
    const enabledCount = enabledProfiles().length;
    if (!visible.length) {
      const [title, message] = RESULT.error ? ["Check the search query", RESULT.error]
        : enabledCount ? ["No matches in this scope", "Try another query, field, folder, or enabled profile."]
        : ["Choose a browser profile", "Open Profiles & settings to include local bookmarks."];
      put("#results", `<div class="empty">${icon.search}<strong>${esc(title)}</strong><span>${esc(message)}</span></div>`);
      return;
    }
    const rows = visible.map(({ item, level }) => {
      const folder = item.kind === "folder";
      const kids = children.get(item.id)?.length || 0;
      const open = !S.collapsedResults.has(item.id);
      const selected = item.id === S.selectedId;
      const path = folderPath(item.parentId).map(entry => entry.name).join(" / ");
      const profile = PROFILE.get(item.profileId);
      return `<div class="row ${item.kind}${selected ? " selected" : ""}" role="treeitem" aria-level="${level}" ${folder && kids ? `aria-expanded="${open}"` : ""} aria-selected="${selected}" tabindex="${selected ? 0 : -1}" data-row="${item.id}" style="--level:${level - 1}">`
        + `<span class="row-branch${kids ? (open ? " open" : "") : " leaf"}" data-branch>${icon.chevron}</span>`
        + `<span class="row-icon">${folder ? icon.folder : icon.bookmark}</span>`
        + `<span class="row-main"><span class="row-title">${highlight(item.name)}</span>`
        + `<span class="row-path">${path ? highlight(path) : "Top-level folder"}</span>`
        + `<span class="row-url">${folder ? "" : highlight(item.url)}</span></span>`
        + `<span class="row-count count">${folder ? COUNTS.get(item.id) || 0 : ""}</span>`
        + `<span class="source">${badge(item.browser)}<span class="source-text">${esc(sourceLabel(profile))}</span></span></div>`;
    }).join("");
    put("#results", `<div class="list-head" aria-hidden="true"><span class="lh-name">Item</span><span class="lh-path">Location</span><span class="lh-count count">Bookmarks</span><span class="lh-source">Source</span></div>${rows}`);
  }

  function renderDetail() {
    const item = BY_ID.get(S.selectedId);
    put("#detail-kicker", item ? `Selected ${item.kind}` : "Details");
    if (!item) { put("#detail-body", `<p class="detail-empty">Select a folder or bookmark to see its source and full path.</p>`); return; }
    const profile = PROFILE.get(item.profileId);
    const path = folderPath(item.kind === "folder" ? item.id : item.parentId);
    put("#detail-body", `<div class="detail-icon">${item.kind === "folder" ? icon.folder : icon.bookmark}</div>`
      + `<h2 class="detail-title">${esc(item.name)}</h2>`
      + (item.kind === "bookmark" ? `<a class="detail-url" href="#" data-action="open-item">${esc(item.url)}</a>` : "")
      + `<div class="detail-actions"><button class="btn primary" data-action="open-item">${item.kind === "folder" ? "Open folder" : "Open in default browser"} ${icon.external}</button>`
      + (item.kind === "bookmark" ? `<button class="btn" data-action="copy-url">${icon.copy} Copy URL</button>` : "") + `</div>`
      + `<dl class="meta">`
      + `<div class="meta-item"><dt>Source</dt><dd class="meta-source">${badge(profile.browser)}<span>${esc(BROWSERS[profile.browser].name)} · ${esc(profile.name)}</span>${profile.warning ? `<span class="stale">Possibly stale snapshot</span>` : ""}</dd></div>`
      + `<div class="meta-item"><dt>Full folder path</dt><dd><ol class="crumbs">${path.map(folder => `<li>${esc(folder.name)}</li>`).join("")}</ol></dd></div>`
      + `<div class="meta-item"><dt>Type</dt><dd>${item.kind === "folder" ? "Folder" : "Bookmark"}</dd></div>`
      + `<div class="meta-item"><dt>Date added</dt><dd>${esc(date(item.added))}</dd></div>`
      + `</dl>`);
  }

  function renderStatus() {
    const errors = enabledProfiles().filter(profile => profile.error);
    const warnings = enabledProfiles().filter(profile => profile.warning);
    put("#status", `<p class="status-line">${icon.ok}<span>${esc(S.status)}</span></p>`
      + errors.map(profile => `<p class="status-item error">${icon.error}<span><strong>${esc(sourceLabel(profile))}</strong> ${esc(profile.error)}</span></p>`).join("")
      + warnings.map(profile => `<p class="status-item warn">${icon.alert}<span><strong>${esc(sourceLabel(profile))}</strong> ${esc(profile.warning)}</span></p>`).join(""));
  }

  function renderChips() {
    const enabledCount = enabledProfiles().length;
    const stale = enabledProfiles().filter(profile => profile.warning).length;
    const scoped = BY_ID.get(S.scopeId);
    const chips = [`<span class="chip accent">${enabledCount} enabled ${enabledCount === 1 ? "profile" : "profiles"}</span>`];
    if (stale) chips.push(`<span class="chip warn">${stale} possibly stale ${stale === 1 ? "profile" : "profiles"}</span>`);
    if (scoped) chips.push(`<span class="chip">${esc(scoped.name)} · ${S.scopeMode === "direct" ? "direct only" : "with descendants"}</span>`);
    if (S.query) chips.push(`<span class="chip">Query: ${esc(S.query)}</span>`);
    if (S.refine) chips.push(`<span class="chip">Within results: ${esc(S.refine)}</span>`);
    if (RESULT.folderIds.length) chips.push(`<span class="chip">Folder matches include contents</span>`);
    chips.push(`<span class="chip">${S.regex ? "Regex mode" : `Fields: ${S.fields.join(", ") || "none"}`}</span>`);
    put("#chips", chips.join(""));
  }

  function renderHeader() {
    const scoped = BY_ID.get(S.scopeId);
    put("#result-title", esc(S.query ? "Search results" : scoped?.name || "All bookmarks"));
    put("#result-caption", esc(RESULT.error || `${RESULT.items.length} matching items · ${TREE_VIEW.visible.length} visible · Folders first`));
    const crumb = scoped ? `${PROFILE.get(scoped.profileId).name} / ${folderPath(scoped.id).map(folder => folder.name).join(" / ")}` : "All bookmarks";
    put("#breadcrumb", `<span>Workspace</span><span class="crumb-sep">${icon.chevron}</span><strong>${esc(crumb)}</strong>`);
    const enabled = enabledProfiles();
    put("#reread-menu", `<div class="menu-label">By source</div>`
      + Object.keys(BROWSERS).map(browser => { const n = enabled.filter(profile => profile.browser === browser).length; return n ? `<button type="button" role="menuitem" data-action="reread" data-target="browser:${browser}">${badge(browser)}<span>${BROWSERS[browser].name}</span><small>${n} enabled</small></button>` : ""; }).join("")
      + `<div class="menu-rule"></div><div class="menu-label">By profile</div>`
      + enabled.map(profile => `<button type="button" role="menuitem" data-action="reread" data-target="${profile.id}">${badge(profile.browser)}<span>${esc(sourceLabel(profile))}</span></button>`).join(""));
    $("#reread-menu")?.toggleAttribute("hidden", !S.reread);
    $("[data-action=reread-toggle]")?.setAttribute("aria-expanded", S.reread);
    $$("[data-action=reread-all]").forEach(button => { button.disabled = S.busy || !enabled.length; const label = $("[data-label]", button); if (label) label.textContent = S.busy ? "Re-reading…" : "Re-read all sources"; });
  }

  function renderSettings() {
    $("#settings")?.toggleAttribute("hidden", !S.settings);
    if (!S.settings) return;
    $$("[data-tab]").forEach(tab => { const selected = tab.dataset.tab === S.tab; tab.setAttribute("aria-selected", selected); tab.tabIndex = selected ? 0 : -1; });
    if (S.tab === "profiles") {
      put("#settings-panel", `<section class="set-section fda"><h3>${icon.lock} macOS browser access</h3><p>To discover browser profiles automatically, add Bookmarktivity in System Settings › Privacy &amp; Security › Full Disk Access. After allowing access, return here and choose Find profiles for each browser.</p><button class="btn" data-action="fda">Open Full Disk Access settings</button></section>`
        + Object.entries(BROWSERS).map(([browser, info]) => {
          const profiles = PROFILES.filter(profile => profile.browser === browser);
          return `<section class="set-section"><h3>${badge(browser)} ${info.name} · Local profiles</h3>`
            + `<div class="dir-row"><label for="dir-${browser}">${info.name} user-data directory</label><div class="dir-controls"><input id="dir-${browser}" autocorrect="off" spellcheck="false" placeholder="Use system default"><button class="btn" data-action="choose-folder" data-browser="${browser}">Choose folder…</button><button class="btn" data-action="find-profiles" data-browser="${browser}">Find profiles</button></div><small>${esc(info.hint)}</small></div>`
            + profiles.map(profile => `<label class="profile-toggle"><span class="pt-text"><strong>${badge(browser)} ${esc(profile.name)}</strong><small>${info.name} · ${esc(profile.folder)}</small>${profile.error && profile.enabled ? `<em class="pt-error">${esc(profile.error)}</em>` : ""}</span><input type="checkbox" role="switch" data-profile="${profile.id}"${profile.enabled ? " checked" : ""}></label>`).join("")
            + (profiles.length ? "" : `<p class="set-note">No profiles found. Check the directory and choose Find profiles.</p>`) + `</section>`;
        }).join(""));
    } else {
      put("#settings-panel", `<section class="set-section"><h3>${icon.keyboard} Keyboard shortcuts</h3>`
        + Object.entries(SHORTCUT_NAMES).map(([action, name]) => `<div class="sc-row"><span>${name}</span><button type="button" class="sc-capture${S.capturing === action ? " capturing" : ""}" data-action="capture" data-shortcut="${action}">${S.capturing === action ? "Press shortcut…" : esc(labelFor(S.bindings[action]))}</button></div>`
          + (S.capturing === action ? `<div class="sc-editor"><label>Or type a shortcut<input id="sc-input" value="${esc(S.bindings[action])}" placeholder="${mac ? "Cmd+G" : "Ctrl+G"}"></label><button class="btn" data-action="capture-save">Save</button><button class="btn" data-action="capture-cancel">Cancel</button></div>` : "")).join("")
        + `<div class="sc-row fixed"><span>Reset filters</span><span class="kbd">Esc Esc</span></div><div class="sc-row fixed"><span>Open selected item</span><span class="kbd">Enter</span></div>`
        + `<button type="button" class="link-button" data-action="restore-shortcuts">Restore defaults</button></section>`);
    }
  }

  function renderControls() {
    const app = $("#app");
    app.classList.toggle("hide-folders", !S.folders);
    app.classList.toggle("hide-details", !S.details);
    app.classList.toggle("no-counts", !S.counts);
    const pressed = { "toggle-folders": S.folders, "toggle-details": S.details, "toggle-counts": S.counts };
    for (const [action, on] of Object.entries(pressed)) $$(`[data-action=${action}]`).forEach(button => {
      button.setAttribute("aria-pressed", on);
      const text = $("[data-on]", button); if (text) text.textContent = on ? text.dataset.on : text.dataset.off;
      if (button.dataset.titleOn) button.title = on ? button.dataset.titleOn : button.dataset.titleOff;
    });
    $$("[data-action=theme]").forEach(button => button.setAttribute("aria-pressed", button.dataset.value === document.documentElement.dataset.theme));
    $$("input[name=field]").forEach(input => { input.checked = S.fields.includes(input.value); });
    $$("#regex").forEach(input => { input.checked = S.regex; });
    $$("input[name=mode]").forEach(input => { input.checked = (input.value === "regex") === S.regex; });
    $$("[name=sort]").forEach(control => { if (control.tagName === "SELECT") control.value = S.sort; else control.checked = control.value === S.sort; });
    $$("[name=scope-mode]").forEach(control => { if (control.tagName === "SELECT") control.value = S.scopeMode; else control.checked = control.value === S.scopeMode; });
    $$("[data-key]").forEach(element => { const binding = S.bindings[element.dataset.key]; if (binding) element.textContent = labelFor(binding); });
    $("#syntax")?.toggleAttribute("hidden", !S.syntax);
    $("[data-action=syntax]")?.setAttribute("aria-expanded", S.syntax);
    const ctx = $("#ctx");
    if (ctx) {
      ctx.hidden = !S.ctx;
      if (S.ctx) {
        ctx.style.left = `${Math.min(S.ctx.x, innerWidth - 220)}px`;
        ctx.style.top = `${Math.min(S.ctx.y, innerHeight - 110)}px`;
        ctx.innerHTML = `<button type="button" role="menuitem" data-action="ctx-expand">Expand all <span class="kbd">${esc(labelFor(S.bindings.expandAll))}</span></button><button type="button" role="menuitem" data-action="ctx-collapse">Collapse all <span class="kbd">${esc(labelFor(S.bindings.collapseAll))}</span></button>`;
      }
    }
  }

  function render() {
    RESULT = compute();
    const signature = JSON.stringify([S.query, S.refine, S.fields, S.regex, S.scopeId, S.scopeMode, S.sort, enabledProfiles().map(profile => profile.id)]);
    if (signature !== S.signature) {
      S.signature = signature;
      S.collapsedResults = new Set(RESULT.items.filter(item => item.kind === "folder").map(item => item.id));
    }
    TREE_VIEW = arrange(RESULT.items);
    if (!TREE_VIEW.visible.some(entry => entry.item.id === S.selectedId)) S.selectedId = TREE_VIEW.visible[0]?.item.id || null;
    renderNav(); renderResults(); renderDetail(); renderStatus(); renderChips(); renderHeader(); renderSettings(); renderControls();
    if (S.focusResults) { S.focusResults = false; focusSelected(); }
  }

  let toastTimer = 0;
  const toast = message => {
    const element = $("#toast");
    if (!element) return;
    element.textContent = message;
    element.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { element.hidden = true; }, 2600);
  };
  const focusSelected = () => {
    const row = S.selectedId && $(`[data-row="${CSS.escape(S.selectedId)}"]`);
    if (row) { row.focus(); row.scrollIntoView({ block: "nearest" }); } else $("#results")?.focus();
  };
  const branchIds = (surface, id) => {
    const ids = [];
    const pending = [id];
    while (pending.length) {
      const next = pending.pop();
      ids.push(next);
      const kids = surface === "results" ? (TREE_VIEW.children.get(next) || []).filter(item => item.kind === "folder").map(item => item.id) : folderKids(next).map(item => item.id);
      pending.push(...kids);
    }
    return ids;
  };
  const changeBranch = (surface, id, collapse) => {
    const set = surface === "results" ? S.collapsedResults : S.navCollapsed;
    for (const folderId of branchIds(surface, id)) collapse ? set.add(folderId) : set.delete(folderId);
  };
  const openItem = item => {
    if (!item) return;
    if (item.kind === "bookmark") { toast(`Opens in the system default browser: ${item.url}`); return; }
    if (TREE_VIEW.children.get(item.id)?.length && S.collapsedResults.has(item.id)) S.collapsedResults.delete(item.id);
    else S.scopeId = item.id;
  };
  const copyUrl = item => {
    if (item?.kind !== "bookmark") return;
    navigator.clipboard?.writeText(item.url).catch(() => {});
    toast("URL copied");
  };
  const reread = targets => {
    S.reread = false;
    S.busy = true;
    render();
    setTimeout(() => {
      S.busy = false;
      const failed = targets.filter(profile => profile.error).length;
      const label = targets.length === enabledProfiles().length ? "All enabled sources" : targets.length === 1 ? targets[0].name : BROWSERS[targets[0].browser].name;
      S.status = `${label}: ${targets.length - failed} refreshed${failed ? `, ${failed} failed. Data for failed profiles was removed.` : "."}`;
      toast(S.status);
      render();
    }, 650);
  };

  function act(action, element) {
    const selected = BY_ID.get(S.selectedId);
    switch (action) {
      case "toggle-folders": S.folders = !S.folders; break;
      case "toggle-details": S.details = !S.details; break;
      case "toggle-counts": S.counts = !S.counts; break;
      case "theme": document.documentElement.dataset.theme = element.dataset.value; break;
      case "theme-toggle": document.documentElement.dataset.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; break;
      case "settings-open": S.settings = true; S.reread = false; break;
      case "settings-close": S.settings = false; S.capturing = null; break;
      case "tab": S.tab = element.dataset.tab; S.capturing = null; break;
      case "reread-toggle": S.reread = !S.reread; break;
      case "reread-all": reread(enabledProfiles()); return;
      case "reread": {
        const target = element.dataset.target;
        reread(target.startsWith("browser:") ? enabledProfiles().filter(profile => profile.browser === target.slice(8)) : [PROFILE.get(target)]);
        return;
      }
      case "syntax": S.syntax = !S.syntax; break;
      case "scope-all": S.scopeId = null; break;
      case "folder-section": S.folderSection = !S.folderSection; break;
      case "nav-collapse-all": ITEMS.forEach(item => item.kind === "folder" && S.navCollapsed.add(item.id)); break;
      case "nav-expand-all": S.navCollapsed.clear(); break;
      case "focus-search": $("#q")?.focus(); break;
      case "open-item": openItem(selected); break;
      case "copy-url": copyUrl(selected); break;
      case "ctx-expand": case "ctx-collapse": changeBranch(S.ctx.surface, S.ctx.id, action === "ctx-collapse"); S.ctx = null; break;
      case "fda": toast("Opens System Settings › Privacy & Security › Full Disk Access"); break;
      case "choose-folder": toast(`Opens the native folder picker for ${BROWSERS[element.dataset.browser].name}`); break;
      case "find-profiles": {
        const n = PROFILES.filter(profile => profile.browser === element.dataset.browser).length;
        S.status = `Found ${n} ${BROWSERS[element.dataset.browser].name} ${n === 1 ? "profile" : "profiles"}. Choose which to include.`;
        toast(S.status);
        break;
      }
      case "capture": S.capturing = element.dataset.shortcut; break;
      case "capture-save": { const value = $("#sc-input")?.value.trim(); if (value) S.bindings[S.capturing] = value; S.capturing = null; toast("Shortcut saved"); break; }
      case "capture-cancel": S.capturing = null; break;
      case "restore-shortcuts": S.bindings = { ...DEFAULT_BINDINGS }; S.capturing = null; toast("Default shortcuts restored"); break;
    }
  }

  document.addEventListener("click", event => {
    const target = event.target;
    if (S.ctx && !target.closest("#ctx")) S.ctx = null;
    if (S.reread && !target.closest(".reread")) S.reread = false;
    if (S.syntax && !target.closest(".syntax-wrap")) S.syntax = false;
    if (S.settings && target.id === "settings") { S.settings = false; render(); return; }
    const actionElement = target.closest("[data-action]");
    const row = target.closest("[data-row]");
    const nav = target.closest("[data-nav]");
    if (actionElement) { event.preventDefault(); act(actionElement.dataset.action, actionElement); }
    else if (row) {
      const id = row.dataset.row;
      S.selectedId = id;
      if (target.closest("[data-branch]") && TREE_VIEW.children.get(id)?.length) S.collapsedResults.has(id) ? S.collapsedResults.delete(id) : S.collapsedResults.add(id);
      S.focusResults = true;
    } else if (nav) {
      const id = nav.dataset.nav;
      if (target.closest("[data-nav-branch]") && folderKids(id).length) S.navCollapsed.has(id) ? S.navCollapsed.delete(id) : S.navCollapsed.add(id);
      else S.scopeId = id;
    }
    render();
  });
  document.addEventListener("dblclick", event => {
    const row = event.target.closest("[data-row]");
    if (row) { S.selectedId = row.dataset.row; openItem(BY_ID.get(row.dataset.row)); render(); }
  });
  document.addEventListener("contextmenu", event => {
    const row = event.target.closest(".row.folder[data-row]");
    const nav = event.target.closest("[data-nav]");
    if (!row && !nav) return;
    event.preventDefault();
    S.ctx = { surface: row ? "results" : "nav", id: row ? row.dataset.row : nav.dataset.nav, x: event.clientX, y: event.clientY };
    if (row) S.selectedId = row.dataset.row;
    render();
    $("#ctx button")?.focus();
  });
  document.addEventListener("input", event => {
    if (event.target.id === "q") { S.query = event.target.value; render(); }
    if (event.target.id === "refine") { S.refine = event.target.value; render(); }
  });
  document.addEventListener("change", event => {
    const target = event.target;
    if (target.name === "field") S.fields = target.checked ? [...new Set([...S.fields, target.value])] : S.fields.filter(field => field !== target.value);
    else if (target.id === "regex") S.regex = target.checked;
    else if (target.name === "mode") S.regex = target.value === "regex";
    else if (target.name === "sort") S.sort = target.value;
    else if (target.name === "scope-mode") S.scopeMode = target.value;
    else if (target.dataset.profile) {
      const profile = PROFILE.get(target.dataset.profile);
      profile.enabled = target.checked;
      if (!target.checked && BY_ID.get(S.scopeId)?.profileId === profile.id) S.scopeId = null;
      S.status = target.checked ? (profile.error ? `${profile.name}: 0 refreshed, 1 failed. Data for failed profiles was removed.` : `${profile.name}: 1 refreshed.`) : "Profile removed from this workspace.";
    } else return;
    render();
  });

  document.addEventListener("keydown", event => {
    const chord = chordFor(event);
    if (S.capturing && document.activeElement?.id !== "sc-input") {
      if (!chord || event.key === "Tab") return;
      event.preventDefault();
      if (event.key !== "Escape") { S.bindings[S.capturing] = chord; toast("Shortcut saved"); }
      S.capturing = null;
      render();
      return;
    }
    const is = action => chord === S.bindings[action];
    if (event.key === "Escape") {
      if (S.ctx || S.reread || S.syntax || S.settings) { S.ctx = null; S.reread = false; S.syntax = false; S.settings = false; render(); return; }
      const now = Date.now();
      if (now - S.escapeAt < 500) {
        Object.assign(S, { query: "", refine: "", fields: [...ALL_FIELDS], regex: false, scopeId: null, scopeMode: "descendants", sort: "relevance", signature: null });
        $("#q") && ($("#q").value = "");
        $("#refine") && ($("#refine").value = "");
        toast("Search, filters, and folder scope reset");
        render();
      }
      S.escapeAt = now;
      return;
    }
    if (is("find")) { event.preventDefault(); S.scopeId = null; S.refine = ""; if ($("#refine")) $("#refine").value = ""; render(); $("#q")?.focus(); $("#q")?.select(); return; }
    if (is("refine")) { event.preventDefault(); $("#refine")?.focus(); return; }
    if (is("results")) { event.preventDefault(); focusSelected(); return; }
    if (is("settings")) { event.preventDefault(); S.settings = true; render(); return; }
    const active = document.activeElement;
    if ((active?.id === "q" || active?.id === "refine") && event.key === "ArrowDown") { event.preventDefault(); focusSelected(); return; }
    const row = active?.closest?.("[data-row]");
    if (row) {
      const list = TREE_VIEW.visible.map(entry => entry.item.id);
      const index = list.indexOf(row.dataset.row);
      const item = BY_ID.get(row.dataset.row);
      const kids = TREE_VIEW.children.get(item.id) || [];
      let next = null;
      if (event.key === "ArrowDown") next = list[Math.min(list.length - 1, index + 1)];
      else if (event.key === "ArrowUp") next = list[Math.max(0, index - 1)];
      else if (event.key === "Home") next = list[0];
      else if (event.key === "End") next = list.at(-1);
      else if (event.key === "ArrowRight" && item.kind === "folder") { if (S.collapsedResults.has(item.id) && kids.length) S.collapsedResults.delete(item.id); else next = kids[0]?.id; }
      else if (event.key === "ArrowLeft") { if (item.kind === "folder" && kids.length && !S.collapsedResults.has(item.id)) S.collapsedResults.add(item.id); else next = TREE_VIEW.parents.get(item.id); }
      else if (event.key === "Enter") openItem(item);
      else if (is("copy")) copyUrl(item);
      else if (is("expandAll") || is("collapseAll")) { if (item.kind === "folder") changeBranch("results", item.id, is("collapseAll")); }
      else return;
      event.preventDefault();
      if (next) S.selectedId = next;
      S.focusResults = true;
      render();
      return;
    }
    const nav = active?.closest?.("[data-nav]");
    if (nav && ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      const rows = $$("[data-nav]");
      const index = rows.indexOf(nav);
      const id = nav.dataset.nav;
      const kids = folderKids(id);
      let focus = null;
      if (event.key === "ArrowDown") focus = rows[Math.min(rows.length - 1, index + 1)]?.dataset.nav;
      if (event.key === "ArrowUp") focus = rows[Math.max(0, index - 1)]?.dataset.nav;
      if (event.key === "ArrowRight") { if (kids.length && S.navCollapsed.has(id)) { S.navCollapsed.delete(id); focus = id; } else focus = kids[0]?.id; }
      if (event.key === "ArrowLeft") { if (kids.length && !S.navCollapsed.has(id)) { S.navCollapsed.add(id); focus = id; } else focus = BY_ID.get(id).parentId; }
      render();
      if (focus) $(`[data-nav="${CSS.escape(focus)}"]`)?.focus();
    }
  });

  // Drag or arrow-key resize for panels: data-resize="left" | "right" | "bottom".
  let drag = null;
  document.addEventListener("pointerdown", event => {
    const handle = event.target.closest("[data-resize]");
    if (!handle) return;
    const side = handle.dataset.resize;
    const panel = $(handle.dataset.panel);
    if (!panel) return;
    drag = { side, start: side === "bottom" ? event.clientY : event.clientX, size: side === "bottom" ? panel.offsetHeight : panel.offsetWidth };
    handle.setPointerCapture(event.pointerId);
  });
  document.addEventListener("pointermove", event => {
    if (!drag) return;
    const delta = drag.side === "bottom" ? drag.start - event.clientY : (event.clientX - drag.start) * (drag.side === "left" ? 1 : -1);
    const limits = { left: [180, 420], right: [240, 520], bottom: [140, 420] }[drag.side];
    $("#app").style.setProperty(`--${drag.side}-size`, `${Math.max(limits[0], Math.min(limits[1], drag.size + delta))}px`);
  });
  document.addEventListener("pointerup", () => { drag = null; });

  function init() {
    $$("i[data-icon]").forEach(element => { element.outerHTML = `<span class="icon icon-${element.dataset.icon}">${icon[element.dataset.icon] || ""}</span>`; });
    const here = location.pathname.split("/").pop();
    const bar = document.createElement("nav");
    bar.className = "mock-bar";
    bar.setAttribute("aria-label", "Design directions");
    bar.innerHTML = `<span>Bookmarktivity design review · synthetic data</span>` + [["01-native.html", "01 Native"], ["02-command.html", "02 Command"], ["03-facets.html", "03 Facets"]]
      .map(([file, name]) => `<a href="${file}"${file === here ? ' aria-current="page"' : ""}>${name}</a>`).join("");
    document.body.prepend(bar);
    const style = document.createElement("style");
    style.textContent = `:root{--mock-bar:28px}.mock-bar{position:fixed;inset:0 0 auto 0;z-index:100;height:28px;display:flex;align-items:center;gap:6px;padding:0 12px;background:#111;color:#bbb;font:12px/1 system-ui,sans-serif}.mock-bar span{margin-right:auto}.mock-bar a{color:#ddd;text-decoration:none;padding:5px 9px;border-radius:5px}.mock-bar a:hover{background:#333}.mock-bar a[aria-current]{background:#fff;color:#111;font-weight:600}body{padding-top:28px}`;
    document.head.append(style);
    // Review helpers: ?q=…&refine=…&theme=dark&settings=profiles|shortcuts&select=n
    const params = new URLSearchParams(location.search);
    if (params.get("theme")) document.documentElement.dataset.theme = params.get("theme");
    if (params.get("q")) { S.query = params.get("q"); $("#q").value = S.query; }
    if (params.get("refine")) { S.refine = params.get("refine"); $("#refine").value = S.refine; }
    if (params.get("settings")) { S.settings = true; S.tab = params.get("settings"); }
    render();
    if (params.get("expand")) { S.collapsedResults.clear(); render(); }
  }
  init();
})();
