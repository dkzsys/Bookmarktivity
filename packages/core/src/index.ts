export type Field = "name" | "url" | "folder";
export type Sort = "relevance" | "alphabetical" | "created" | "modified";
export type ScopeMode = "descendants" | "direct";

export interface Source {
  browserId: string;
  profileId: string;
  profileName: string;
}

export interface Folder {
  kind: "folder";
  id: string;
  parentId: string | null;
  name: string;
  source: Source;
  dateAdded?: number | null;
  dateModified?: number | null;
}

export interface Bookmark {
  kind: "bookmark";
  id: string;
  parentId: string | null;
  name: string;
  url: string;
  source: Source;
  dateAdded?: number | null;
  dateModified?: number | null;
}

export type Item = Folder | Bookmark;
export interface ProfileData { folders: Folder[]; bookmarks: Bookmark[] }
export interface SearchOptions {
  query: string;
  refine: string;
  fields: Field[];
  regex: boolean;
  scopeId: string | null;
  scopeMode: ScopeMode;
  sort: Sort;
}
export interface SearchResult {
  items: Item[];
  matchedFolderIds: string[];
  error: string | null;
  regexHighlights?: Map<string, Partial<Record<Field, MatchSpan[]>>>;
}
export type MatchSpan = readonly [number, number];

type Term = { field: Field | null; value: string; quoted?: boolean };
type Parsed = Term[][];
const FIELD_SET = new Set<Field>(["name", "url", "folder"]);

export function parseQuery(input: string): Parsed {
  const tokens: (Term | "AND" | "OR")[] = [];
  let i = 0;
  while (i < input.length) {
    if (/\s/.test(input[i])) { i++; continue; }
    const start = i;
    let field: Field | null = null;
    const prefix = /^(name|url|folder):/i.exec(input.slice(i));
    if (prefix) { field = prefix[1].toLowerCase() as Field; i += prefix[0].length; }
    let value = "";
    let quoted = false;
    if (input[i] === '"') {
      quoted = true;
      i++;
      while (i < input.length && input[i] !== '"') value += input[i++];
      if (input[i] !== '"') throw new Error("Close the quoted phrase.");
      i++;
      if (i < input.length && !/\s/.test(input[i])) throw new Error("Add a space after the quoted phrase.");
    } else {
      while (i < input.length && !/\s/.test(input[i])) value += input[i++];
    }
    if (!value) throw new Error("A search term is missing.");
    if (!field && (value.toUpperCase() === "AND" || value.toUpperCase() === "OR")) {
      tokens.push(value.toUpperCase() as "AND" | "OR");
    } else {
      tokens.push(quoted ? { field, value, quoted } : { field, value });
    }
    if (i === start) i++;
  }
  if (!tokens.length) return [];
  const groups: Parsed = [[]];
  let expectTerm = true;
  for (const token of tokens) {
    if (typeof token === "string") {
      if (expectTerm) throw new Error("A search term is missing before an operator.");
      if (token === "OR") groups.push([]);
      expectTerm = true;
    } else {
      groups[groups.length - 1].push(token);
      expectTerm = false;
    }
  }
  if (expectTerm) throw new Error("A search term is missing after an operator.");
  return groups;
}

export function folderPath(folderId: string | null, folderMap: Map<string, Folder>): Folder[] {
  const path: Folder[] = [];
  const seen = new Set<string>();
  let id = folderId;
  while (id && folderMap.has(id) && !seen.has(id)) {
    seen.add(id);
    const folder = folderMap.get(id)!;
    path.unshift(folder);
    id = folder.parentId;
  }
  return path;
}

function fieldsFor(item: Item, folderMap: Map<string, Folder>): Record<Field, string> {
  return {
    name: item.name,
    url: item.kind === "bookmark" ? item.url : "",
    folder: item.kind === "folder" ? item.name : folderMap.get(item.parentId || "")?.name || ""
  };
}

function distanceWithin(a: string, b: string, limit: number): boolean {
  if (Math.abs(a.length - b.length) > limit) return false;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let row = 1; row <= a.length; row++) {
    const current = [row];
    let minimum = row;
    for (let column = 1; column <= b.length; column++) {
      const cost = a[row - 1] === b[column - 1] ? 0 : 1;
      const value = Math.min(previous[column] + 1, current[column - 1] + 1, previous[column - 1] + cost);
      current.push(value);
      minimum = Math.min(minimum, value);
    }
    if (minimum > limit) return false;
    previous = current;
  }
  return previous[b.length] <= limit;
}

export function fuzzyWordMatch(word: string, query: string): boolean {
  const left = word.toLocaleLowerCase();
  const right = query.toLocaleLowerCase();
  if (right.length < 4) return false;
  return distanceWithin(left, right, right.length >= 8 ? 2 : 1);
}

function textMatches(haystack: string, term: Term): boolean {
  const text = haystack.toLocaleLowerCase();
  const needle = term.value.toLocaleLowerCase();
  // Quoted text is a literal substring anywhere in the field, not a whole-field match.
  if (text.includes(needle)) return true;
  if (term.quoted || needle.length < 4) return false;
  return (text.match(/[\p{L}\p{N}]+/gu) || []).some(word => fuzzyWordMatch(word, needle));
}

function regexSpans(text: string, pattern: RegExp): MatchSpan[] {
  const spans: MatchSpan[] = [];
  for (const match of text.matchAll(new RegExp(pattern.source, "gi"))) {
    if (!match[0].length) continue;
    spans.push([match.index, match.index + match[0].length]);
    if (spans.length === 24) break;
  }
  return spans;
}

function matches(item: Item, groups: Parsed, fields: Field[], folderMap: Map<string, Folder>): boolean {
  if (!groups.length) return true;
  const values = fieldsFor(item, folderMap);
  return groups.some(group => group.every(term => {
    const keys = term.field ? [term.field] : fields;
    return keys.some(key => FIELD_SET.has(key) && fields.includes(key) && textMatches(values[key], term));
  }));
}

function isDescendant(item: Item, ancestorId: string, folderMap: Map<string, Folder>): boolean {
  let id = item.parentId;
  const seen = new Set<string>();
  while (id && !seen.has(id)) {
    if (id === ancestorId) return true;
    seen.add(id);
    id = folderMap.get(id)?.parentId || null;
  }
  return false;
}

function inScope(item: Item, scopeId: string | null, mode: ScopeMode, folderMap: Map<string, Folder>): boolean {
  if (!scopeId) return true;
  if (item.kind === "folder" && item.id === scopeId) return false;
  if (item.parentId === scopeId) return true;
  return mode === "descendants" && isDescendant(item, scopeId, folderMap);
}

function standaloneFolderSearch(groups: Parsed, fields: Field[]): boolean {
  return groups.length === 1 && groups[0].length === 1 &&
    (groups[0][0].field === "folder" || (groups[0][0].field === null && fields.length === 1 && fields[0] === "folder"));
}

function ancestorMatcher(folderIds: string[], folderMap: Map<string, Folder>): (item: Item) => boolean {
  if (!folderIds.length) return () => false;
  const matched = new Set(folderIds);
  const cache = new Map<string, boolean>();
  const visiting = new Set<string>();
  const folderMatches = (id: string | null): boolean => {
    if (!id) return false;
    if (matched.has(id)) return true;
    if (cache.has(id)) return cache.get(id)!;
    if (visiting.has(id)) return false;
    visiting.add(id);
    const result = folderMatches(folderMap.get(id)?.parentId || null);
    visiting.delete(id);
    cache.set(id, result);
    return result;
  };
  return item => folderMatches(item.parentId);
}

function filterStage(items: Item[], groups: Parsed, fields: Field[], folderMap: Map<string, Folder>): { items: Item[]; folderIds: string[] } {
  if (!groups.length) return { items, folderIds: [] };
  const folderIds = standaloneFolderSearch(groups, fields)
    ? items.filter((item): item is Folder => item.kind === "folder" && matches(item, groups, fields, folderMap)).map(item => item.id)
    : [];
  const isWithinMatchedFolder = ancestorMatcher(folderIds, folderMap);
  return {
    items: items.filter(item => matches(item, groups, fields, folderMap) || isWithinMatchedFolder(item)),
    folderIds
  };
}

function score(item: Item, groups: Parsed, fields: Field[], folderMap: Map<string, Folder>): number {
  const values = fieldsFor(item, folderMap);
  return groups.flat().reduce((total, term) => {
    const keys: Field[] = term.field ? [term.field] : fields;
    if (!keys.length) return total;
    const value = term.value.toLocaleLowerCase();
    const best = Math.max(...keys.map(key => {
      const text = values[key].toLocaleLowerCase();
      const weight = key === "name" ? 3 : key === "folder" ? 2 : 1;
      return text === value ? 8 * weight : text.startsWith(value) ? 5 * weight : text.includes(value) ? 3 * weight : textMatches(text, term) ? weight : 0;
    }));
    return total + best;
  }, 0);
}

export function search(allItems: Item[], options: SearchOptions): SearchResult {
  const folderMap = new Map(allItems.filter((i): i is Folder => i.kind === "folder").map(i => [i.id, i]));
  let items = allItems.filter(item => inScope(item, options.scopeId, options.scopeMode, folderMap));
  let primary: { items: Item[]; folderIds: string[] };
  let refined: { items: Item[]; folderIds: string[] };
  let groups: Parsed = [];
  let regex: RegExp | null = null;
  try {
    if (options.regex && options.query.trim()) {
      const re = regex = new RegExp(options.query, "i");
      const folderIds = options.fields.length === 1 && options.fields[0] === "folder"
        ? items.filter((item): item is Folder => item.kind === "folder" && re.test(item.name)).map(item => item.id)
        : [];
      const isWithinMatchedFolder = ancestorMatcher(folderIds, folderMap);
      primary = {
        items: items.filter(item => options.fields.some(key => re.test(fieldsFor(item, folderMap)[key])) || isWithinMatchedFolder(item)),
        folderIds
      };
    } else {
      groups = parseQuery(options.query);
      primary = filterStage(items, groups, options.fields, folderMap);
    }
    refined = filterStage(primary.items, parseQuery(options.refine), ["name", "url", "folder"], folderMap);
  } catch (error) {
    return { items: [], matchedFolderIds: [], error: error instanceof Error ? error.message : "Invalid query." };
  }
  items = refined.items;
  const scores = options.sort === "relevance" && groups.length
    ? new Map(items.map(item => [item.id, score(item, groups, options.fields, folderMap)]))
    : null;
  items.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
    if (options.sort === "created" || options.sort === "modified") {
      const field = options.sort === "created" ? "dateAdded" : "dateModified";
      const av = a[field] ?? -Infinity, bv = b[field] ?? -Infinity;
      if (av !== bv) return bv - av;
    }
    if (options.sort === "relevance") {
      const difference = (scores?.get(b.id) || 0) - (scores?.get(a.id) || 0);
      if (difference) return difference;
    }
    return a.name.localeCompare(b.name) || a.source.profileId.localeCompare(b.source.profileId) || a.id.localeCompare(b.id);
  });
  const regexHighlights = regex ? new Map<string, Partial<Record<Field, MatchSpan[]>>>() : undefined;
  if (regex && regexHighlights) {
    for (const item of items) {
      const values = fieldsFor(item, folderMap);
      const spans: Partial<Record<Field, MatchSpan[]>> = {};
      for (const field of options.fields) {
        const found = regexSpans(values[field], regex);
        if (found.length) spans[field] = found;
      }
      if (Object.keys(spans).length) regexHighlights.set(item.id, spans);
    }
  }
  return { items, matchedFolderIds: [...new Set([...primary.folderIds, ...refined.folderIds])], error: null, regexHighlights };
}

export function arrangeTree(items: Item[], collapsed: ReadonlySet<string>): { visible: (Item & { level: number })[]; children: Map<string, Item[]>; parents: Map<string, string | null> } {
  const folderMap = new Map(items.filter((i): i is Folder => i.kind === "folder").map(i => [i.id, i]));
  const children = new Map<string, Item[]>([["", []]]);
  const parents = new Map<string, string | null>();
  for (const item of items) {
    let parent = item.parentId;
    while (parent && !folderMap.has(parent)) parent = null;
    parents.set(item.id, parent);
    const key = parent || "";
    if (!children.has(key)) children.set(key, []);
    children.get(key)!.push(item);
  }
  const visible: (Item & { level: number })[] = [];
  const walk = (key: string, level: number) => {
    for (const item of children.get(key) || []) {
      visible.push({ ...item, level });
      if (item.kind === "folder" && !collapsed.has(item.id)) walk(item.id, level + 1);
    }
  };
  walk("", 1);
  return { visible, children, parents };
}
