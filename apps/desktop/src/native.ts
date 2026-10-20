import { invoke } from "@tauri-apps/api/core";
import type { ProfileData } from "@bookmarktivity/core";

export interface EdgeProfile {
  id: string;
  name: string;
  browserId: "edge";
  userDataDir: string;
}
export interface Preferences {
  enabledProfileIds: string[];
  edgeUserDataDir: string | null;
  shortcuts?: Record<string, string>;
  theme?: "light" | "dark";
}
export const inTauri = "__TAURI_INTERNALS__" in window;

export const native = {
  loadPreferences: () => invoke<Preferences>("load_preferences"),
  savePreferences: (preferences: Preferences) => invoke<void>("save_preferences", { preferences }),
  discoverProfiles: (userDataDir: string | null) => invoke<EdgeProfile[]>("discover_profiles", { userDataDir }),
  readProfile: (profileId: string) => invoke<ProfileData>("read_profile", { profileId }),
  openBookmark: (url: string) => invoke<void>("open_bookmark", { url })
};
