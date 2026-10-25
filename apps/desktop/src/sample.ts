import type { ProfileData, Source } from "@bookmarktivity/core";
import type { BrowserProfile } from "./native";

export const sampleProfiles: BrowserProfile[] = [
  { id: "sample-personal", folderId: "sample-personal", name: "Personal", browserId: "edge", userDataDir: "" },
  { id: "sample-work", folderId: "sample-work", name: "Work", browserId: "chrome", userDataDir: "" },
  { id: "sample-archive", folderId: "sample-archive", name: "Archive", browserId: "brave", userDataDir: "" }
];
const source = (browserId: string, id: string, name: string): Source => ({ browserId, profileId: id, profileName: name });
const work = source("chrome", "sample-work", "Work");
const personal = source("edge", "sample-personal", "Personal");
const archive = source("brave", "sample-archive", "Archive");

export const sampleData: Record<string, ProfileData> = {
  "sample-work": {
    folders: [
      { kind: "folder", id: "w-projects", parentId: null, name: "Projects", source: work },
      { kind: "folder", id: "w-atlas", parentId: "w-projects", name: "Atlas", source: work },
      { kind: "folder", id: "w-research", parentId: null, name: "Research", source: work },
      { kind: "folder", id: "w-methods", parentId: "w-research", name: "Methods", source: work }
    ],
    bookmarks: [
      { kind: "bookmark", id: "w-plan", parentId: "w-atlas", name: "Project plan — Atlas", url: "https://docs.example.com/atlas/project-plan", source: work },
      { kind: "bookmark", id: "w-guide", parentId: "w-atlas", name: "Atlas design guide", url: "https://docs.example.com/atlas/design-guide", source: work },
      { kind: "bookmark", id: "w-notes", parentId: "w-research", name: "Browser bookmark API notes", url: "https://developer.example.com/bookmark-api", source: work },
      { kind: "bookmark", id: "w-board", parentId: "w-research", name: "Quarterly research board", url: "https://boards.example.com/research/2026", source: work },
      { kind: "bookmark", id: "w-paper", parentId: "w-methods", name: "Search index paper", url: "https://papers.example.com/search-index", source: work }
    ]
  },
  "sample-personal": {
    folders: [
      { kind: "folder", id: "p-reading", parentId: null, name: "Reading", source: personal },
      { kind: "folder", id: "p-design", parentId: "p-reading", name: "Design", source: personal },
      { kind: "folder", id: "p-travel", parentId: null, name: "Travel", source: personal }
    ],
    bookmarks: [
      { kind: "bookmark", id: "p-color", parentId: "p-design", name: "Color and type inspiration", url: "https://design.example.com/inspiration", source: personal },
      { kind: "bookmark", id: "p-keyboard", parentId: "p-reading", name: "Keyboard navigation patterns", url: "https://ux.example.com/keyboard-guide", source: personal },
      { kind: "bookmark", id: "p-walk", parentId: "p-travel", name: "Weekend walking guide", url: "https://travel.example.com/walking-guide", source: personal },
      { kind: "bookmark", id: "p-template", parentId: "p-reading", name: "Project plan template", url: "https://notes.example.com/project-plan-template", source: personal }
    ]
  },
  "sample-archive": {
    folders: [{ kind: "folder", id: "a-ideas", parentId: null, name: "Ideas", source: archive }],
    bookmarks: [{ kind: "bookmark", id: "a-sketch", parentId: "a-ideas", name: "Old project sketch", url: "https://archive.example.com/sketch", source: archive }]
  }
};

export function benchmarkSample(): Record<string, ProfileData> {
  const folders: ProfileData["folders"] = Array.from({ length: 2000 }, (_, index) => ({
    kind: "folder", id: `bench-folder-${index}`,
    parentId: index < 10 ? null : `bench-folder-${Math.floor((index - 10) / 3)}`,
    name: index % 29 === 0 ? `NGP ${index}` : `Folder ${index}`,
    source: work
  }));
  const bookmarks: ProfileData["bookmarks"] = Array.from({ length: 6000 }, (_, index) => ({
    kind: "bookmark", id: `bench-bookmark-${index}`,
    parentId: `bench-folder-${index % 2000}`,
    name: `Reference document ${index}`,
    url: `https://example.test/reference/${index}`,
    source: work
  }));
  return { "sample-work": { folders, bookmarks } };
}
