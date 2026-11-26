import type { Item } from "@bookmarktivity/core";

export type MenuSurface = "nav" | "results";
export type MenuActionId = "open" | "copy" | "expandAll" | "collapseAll";
export interface MenuAction { id: MenuActionId; label: string; shortcut?: string; separatorBefore?: boolean }
export interface MenuShortcuts { copy: string; expandAll: string; collapseAll: string }

interface ActionDefinition {
  id: MenuActionId;
  surfaces: MenuSurface[];
  appliesTo: (item: Item) => boolean;
  label: (item: Item) => string;
  shortcut?: (keys: MenuShortcuts) => string;
  separatorBefore?: boolean;
}

const isFolder = (item: Item) => item.kind === "folder";

// Add new context-menu actions here. Order is display order; each entry decides where it applies.
const definitions: ActionDefinition[] = [
  { id: "open", surfaces: ["results"], appliesTo: () => true, label: item => isFolder(item) ? "Open folder" : "Open in default browser", shortcut: () => "Enter" },
  { id: "copy", surfaces: ["results"], appliesTo: () => true, label: item => isFolder(item) ? "Copy path" : "Copy URL", shortcut: keys => keys.copy },
  { id: "expandAll", surfaces: ["nav", "results"], appliesTo: isFolder, label: () => "Expand all", shortcut: keys => keys.expandAll, separatorBefore: true },
  { id: "collapseAll", surfaces: ["nav", "results"], appliesTo: isFolder, label: () => "Collapse all", shortcut: keys => keys.collapseAll }
];

export function menuActionsFor(surface: MenuSurface, item: Item, keys: MenuShortcuts): MenuAction[] {
  const actions = definitions.filter(action => action.surfaces.includes(surface) && action.appliesTo(item));
  return actions.map((action, index) => ({
    id: action.id,
    label: action.label(item),
    shortcut: action.shortcut?.(keys),
    separatorBefore: index > 0 && action.separatorBefore
  }));
}
