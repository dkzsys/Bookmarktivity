import { invoke } from "@tauri-apps/api/core";
import type { ProfileData } from "@bookmarktivity/core";

export type BrowserId = "edge" | "chrome" | "brave" | "firefox" | "safari";

export const browserNames: Record<BrowserId, string> = { edge: "Microsoft Edge", chrome: "Google Chrome", brave: "Brave", firefox: "Firefox", safari: "Safari" };
export const directoryHints: Record<BrowserId, string> = {
  edge: "For a custom location, use the parent of the profile directory shown at edge://version.",
  chrome: "For a custom location, use the parent of the profile directory shown at chrome://version.",
  brave: "For a custom location, use the parent of the profile directory shown at brave://version.",
  firefox: "For a custom location, use the folder containing profiles.ini, or the parent of the profile Root Directory shown at about:profiles.",
  safari: "Safari keeps one bookmark collection per user. For a custom location, use the folder containing Bookmarks.plist."
};
// Safari has never shipped for Linux, so its section is not offered there.
export const browserIds: BrowserId[] = ["edge", "chrome", "brave", "firefox", ...(/Linux/.test(navigator.platform) ? [] : ["safari" as const])];

export interface BrowserProfile {
  id: string;
  folderId: string;
  name: string;
  browserId: BrowserId;
  userDataDir: string;
}
export interface Preferences {
  enabledProfileIds: string[];
  edgeUserDataDir: string | null;
  chromeUserDataDir: string | null;
  braveUserDataDir: string | null;
  firefoxUserDataDir?: string | null;
  safariUserDataDir?: string | null;
  shortcuts?: Record<string, string>;
  theme?: "light" | "dark";
}
export const inTauri = "__TAURI_INTERNALS__" in window;

export const native = {
  loadPreferences: () => invoke<Preferences>("load_preferences"),
  savePreferences: (preferences: Preferences) => invoke<void>("save_preferences", { preferences }),
  discoverProfiles: (browserId: BrowserId, userDataDir: string | null) => invoke<BrowserProfile[]>("discover_profiles", { browserId, userDataDir }),
  chooseUserDataDir: (browserId: BrowserId) => invoke<string | null>("choose_user_data_dir", { browserId }),
  openFullDiskAccessSettings: () => invoke<void>("open_full_disk_access_settings"),
  readProfile: (profileId: string) => invoke<ProfileData>("read_profile", { profileId }),
  openBookmark: (url: string) => invoke<void>("open_bookmark", { url })
};
