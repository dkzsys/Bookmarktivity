import { search, type Item, type SearchOptions } from "@bookmarktivity/core";

type Message =
  | { type: "data"; items: Item[] }
  | { type: "search"; id: number; options: SearchOptions };
let items: Item[] = [];

self.onmessage = (event: MessageEvent<Message>) => {
  if (event.data.type === "data") {
    items = event.data.items;
    return;
  }
  self.postMessage({ id: event.data.id, result: search(items, event.data.options) });
};
