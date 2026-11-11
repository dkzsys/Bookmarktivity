import type { ReactNode } from "react";
import type { BrowserId } from "./native";

// One stroke icon family so controls render the same on macOS, Windows, and Linux.
const icon = (body: ReactNode) => function Icon() {
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{body}</svg>;
};

export const Icons = {
  search: icon(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>),
  filter: icon(<path d="M4 5h16l-6 7.5V19l-4 2v-8.5z" />),
  folder: icon(<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2.5h7.5A2.5 2.5 0 0 1 21 10v7.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z" />),
  bookmark: icon(<path d="M7 3.5h10a1 1 0 0 1 1 1V21l-6-4-6 4V4.5a1 1 0 0 1 1-1z" />),
  chevron: icon(<path d="m9 6 6 6-6 6" />),
  caret: icon(<path d="m6 9 6 6 6-6" />),
  settings: icon(<><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>),
  refresh: icon(<><path d="M20 12a8 8 0 1 1-2.34-5.66" /><path d="M20 4v5h-5" /></>),
  sun: icon(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>),
  moon: icon(<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />),
  panelLeft: icon(<><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M9 4v16" /></>),
  panelRight: icon(<><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M15 4v16" /></>),
  hash: icon(<path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16" />),
  copy: icon(<><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>),
  external: icon(<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />),
  close: icon(<path d="M6 6l12 12M18 6 6 18" />),
  warning: icon(<><path d="M12 3.5 2.5 20h19z" /><path d="M12 10v4M12 17h.01" /></>),
  error: icon(<><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5M12 16h.01" /></>),
  ok: icon(<><circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.8 2.8L16.5 9.5" /></>),
  lock: icon(<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>),
  help: icon(<><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.2M12 17h.01" /></>),
  grid: icon(<><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>),
  keyboard: icon(<><rect x="2.5" y="6" width="19" height="12" rx="2" /><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" /></>),
  user: icon(<><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>)
};

const letters: Record<BrowserId, string> = { edge: "E", chrome: "C", brave: "B", firefox: "F", safari: "S" };

/** A small coloured letter tile that tells browsers apart without using their logos. */
export function BrowserBadge({ browserId }: { browserId: string }) {
  return <span className="badge" data-browser={browserId} aria-hidden="true">{letters[browserId as BrowserId] || browserId[0]?.toUpperCase()}</span>;
}
