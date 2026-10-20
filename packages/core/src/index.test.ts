import { describe, expect, it } from "vitest";
import { arrangeTree, parseQuery, search, type Folder, type Bookmark, type SearchOptions } from "./index";

const work = { browserId: "edge", profileId: "Work", profileName: "Work" };
const personal = { browserId: "edge", profileId: "Personal", profileName: "Personal" };
const research: Folder = { kind: "folder", id: "Work:research", parentId: null, name: "Research", source: work };
const methods: Folder = { kind: "folder", id: "Work:methods", parentId: research.id, name: "Methods", source: work };
const other: Folder = { kind: "folder", id: "Personal:research", parentId: null, name: "Research", source: personal };
const paper: Bookmark = { kind: "bookmark", id: "Work:paper", parentId: methods.id, name: "Index paper", url: "https://papers.example.com/index", source: work };
const board: Bookmark = { kind: "bookmark", id: "Work:board", parentId: research.id, name: "Research board", url: "https://boards.example.com/2026", source: work };
const privateNote: Bookmark = { kind: "bookmark", id: "Personal:note", parentId: other.id, name: "Private note", url: "https://notes.example.com", source: personal };
const items = [research, methods, other, paper, board, privateNote];
const defaults: SearchOptions = { query: "", refine: "", fields: ["name", "url", "folder"], regex: false, scopeId: null, scopeMode: "descendants", sort: "relevance" };
const run = (patch: Partial<SearchOptions>) => search(items, { ...defaults, ...patch });

describe("query parsing", () => {
  it("keeps phrases and field prefixes together", () => {
    expect(parseQuery('name:"Index paper" OR url:example.com')).toEqual([
      [{ field: "name", value: "Index paper", quoted: true }],
      [{ field: "url", value: "example.com" }]
    ]);
  });
  it("reports incomplete expressions", () => {
    expect(() => parseQuery("name:paper AND")).toThrow();
    expect(() => parseQuery('name:"unclosed')).toThrow();
  });
});

describe("search", () => {
  it("combines fields with AND and OR", () => {
    expect(run({ query: "url:papers.example.com AND name:index" }).items.map(i => i.id)).toEqual([paper.id]);
    expect(run({ query: "name:board OR name:note" }).items.map(i => i.id)).toEqual([privateNote.id, board.id]);
  });
  it("matches immediate folder names and expands a standalone folder result", () => {
    const found = run({ query: "folder:Research" });
    expect(found.matchedFolderIds).toEqual([research.id, other.id]);
    expect(found.items.map(i => i.id)).toEqual(expect.arrayContaining([research.id, methods.id, paper.id, board.id, other.id, privateNote.id]));
    expect(run({ query: "folder:Research AND name:paper" }).items).toHaveLength(0);
  });
  it("keeps folder scope and profiles distinct", () => {
    expect(run({ scopeId: research.id, scopeMode: "direct" }).items.map(i => i.id)).toEqual([methods.id, board.id]);
    expect(run({ scopeId: research.id, scopeMode: "descendants" }).items.map(i => i.id)).toEqual([methods.id, paper.id, board.id]);
  });
  it("refines the current result set", () => {
    expect(run({ query: "folder:Research", refine: "name:board" }).items.map(i => i.id)).toEqual([board.id]);
  });
  it("reports bad regex without throwing", () => {
    expect(run({ query: "[", regex: true }).error).toBeTruthy();
  });
  it("finds small typos while keeping quoted phrases literal", () => {
    expect(run({ query: "name:Indax" }).items.map(i => i.id)).toEqual([paper.id]);
    expect(run({ query: 'name:"Indax paper"' }).items).toHaveLength(0);
  });
  it("matches quoted text anywhere within a field, including part of a word", () => {
    expect(run({ query: 'name:"DEX PAP"' }).items.map(i => i.id)).toEqual([paper.id]);
    expect(run({ query: 'name:"search BO"' }).items.map(i => i.id)).toEqual([board.id]);
    expect(run({ query: 'url:"AMPLE.COM/IND"' }).items.map(i => i.id)).toEqual([paper.id]);
  });
  it("returns regex highlight positions for visible matching fields", () => {
    const nameMatch = run({ query: "index", regex: true, fields: ["name"] });
    expect(nameMatch.regexHighlights?.get(paper.id)?.name).toEqual([[0, 5]]);
    const folderMatch = run({ query: "research", regex: true, fields: ["folder"] });
    expect(folderMatch.regexHighlights?.get(board.id)?.folder).toEqual([[0, 8]]);
    const urlMatch = run({ query: "papers\\.example", regex: true, fields: ["url"] });
    expect(urlMatch.regexHighlights?.get(paper.id)?.url).toEqual([[8, 22]]);
  });
  it("arranges and collapses visible tree rows", () => {
    const arranged = arrangeTree(items, new Set([research.id]));
    expect(arranged.visible.map(i => i.id)).toEqual([research.id, other.id, privateNote.id]);
  });
});
