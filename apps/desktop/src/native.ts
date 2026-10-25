import { invoke } from "@tauri-apps/api/core";
import type { ProfileData } from "@bookmarktivity/core";

export type BrowserId = "edge" | "chrome" | "brave";

export const browserNames: Record<BrowserId, string> = { edge: "Microsoft Edge", chrome: "Google Chrome", brave: "Brave" };
export const browserVersionPages: Record<BrowserId, string> = { edge: "edge://version", chrome: "chrome://version", brave: "brave://version" };
export const browserIds: BrowserId[] = ["edge", "chrome", "brave"];

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
  shortcuts?: Record<string, string>;
  theme?: "light" | "dark";
}
export const inTauri = "__TAURI_INTERNALS__" in window;

export const native = {
  loadPreferences: () => invoke<Preferences>("load_preferences"),
  savePreferences: (preferences: Preferences) => invoke<void>("save_preferences", { preferences }),
  discoverProfiles: (browserId: BrowserId, userDataDir: string | null) => invoke<BrowserProfile[]>("discover_profiles", { browserId, userDataDir }),
  readProfile: (profileId: string) => invoke<ProfileData>("read_profile", { profileId }),
  openBookmark: (url: string) => invoke<void>("open_bookmark", { url })
};
