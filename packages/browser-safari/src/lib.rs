//! Read-only Safari adapter.
//!
//! Safari keeps one bookmark collection per user in `Bookmarks.plist`, so each Safari data
//! directory is exposed as a single profile. On macOS the default location is protected and
//! needs Full Disk Access. The Windows location is the one used by the discontinued Safari
//! for Windows (5.x), which wrote the same property-list format.

use browser_model::{node_key, profile_key, resolve_root, Bookmark, Folder, Source};
use plist::{Dictionary, Value};
use std::{
    fs,
    path::{Path, PathBuf},
};

pub use browser_model::{Profile, ProfileData};

const BROWSER_ID: &str = "safari";
const BOOKMARKS_FILE: &str = "Bookmarks.plist";
const PROFILE_FOLDER: &str = "Default";
const STORE: &str = "Bookmarks.plist";
const MAX_DEPTH: usize = 256;

fn candidate_dirs() -> Vec<PathBuf> {
    let mut dirs_out = Vec::new();
    #[cfg(target_os = "macos")]
    if let Some(dir) = dirs::home_dir() {
        dirs_out.push(dir.join("Library").join("Safari"));
    }
    #[cfg(target_os = "windows")]
    if let Some(dir) = dirs::data_dir() {
        dirs_out.push(dir.join("Apple Computer").join("Safari"));
    }
    dirs_out
}

pub fn discover(override_dir: Option<&str>) -> Result<Vec<Profile>, String> {
    let Some(root) = resolve_root(BROWSER_ID, candidate_dirs(), override_dir)? else {
        return Ok(Vec::new());
    };
    match fs::metadata(root.join(BOOKMARKS_FILE)) {
        Ok(metadata) if metadata.is_file() => {}
        Ok(_) => return Ok(Vec::new()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(format!("Cannot inspect Safari's {BOOKMARKS_FILE}: {error}")),
    }
    Ok(vec![Profile {
        id: profile_key(BROWSER_ID, &root, PROFILE_FOLDER),
        folder_id: PROFILE_FOLDER.to_string(),
        name: "Safari".to_string(),
        browser_id: BROWSER_ID.to_string(),
        user_data_dir: root.to_string_lossy().to_string(),
    }])
}

fn text<'a>(node: &'a Dictionary, key: &str) -> Option<&'a str> {
    node.get(key).and_then(Value::as_string)
}

fn visit(
    node: &Dictionary,
    parent_id: Option<&str>,
    position: &str,
    depth: usize,
    source: &Source,
    output: &mut ProfileData,
) {
    // Older files can lack UUIDs; the position within the tree keeps such nodes distinct.
    let raw_id = text(node, "WebBookmarkUUID").unwrap_or(position);
    let id = node_key(&source.profile_id, STORE, raw_id);
    match text(node, "WebBookmarkType") {
        Some("WebBookmarkTypeList") if depth < MAX_DEPTH => {
            let title = text(node, "Title").unwrap_or("");
            // Reading List entries are saved pages rather than bookmarks.
            if depth == 1 && title == "com.apple.ReadingList" {
                return;
            }
            let name = match (depth, title) {
                (1, "BookmarksBar") => "Favorites",
                (1, "BookmarksMenu") => "Bookmarks Menu",
                _ => title,
            };
            output.folders.push(Folder {
                kind: "folder",
                id: id.clone(),
                parent_id: parent_id.map(str::to_string),
                name: name.to_string(),
                source: source.clone(),
                date_added: None,
                date_modified: None,
            });
            visit_children(node, Some(&id), position, depth, source, output);
        }
        Some("WebBookmarkTypeLeaf") => {
            if let Some(url) = text(node, "URLString") {
                let name = node
                    .get("URIDictionary")
                    .and_then(Value::as_dictionary)
                    .and_then(|uri| text(uri, "title"))
                    .or_else(|| text(node, "Title"))
                    .unwrap_or("");
                output.bookmarks.push(Bookmark {
                    kind: "bookmark",
                    id,
                    parent_id: parent_id.map(str::to_string),
                    name: name.to_string(),
                    url: url.to_string(),
                    source: source.clone(),
                    date_added: None,
                    date_modified: None,
                });
            }
        }
        // WebBookmarkTypeProxy marks the History placeholder.
        _ => {}
    }
}

fn visit_children(
    node: &Dictionary,
    parent_id: Option<&str>,
    position: &str,
    depth: usize,
    source: &Source,
    output: &mut ProfileData,
) {
    if let Some(children) = node.get("Children").and_then(Value::as_array) {
        for (index, child) in children.iter().enumerate() {
            if let Some(child) = child.as_dictionary() {
                visit(child, parent_id, &format!("{position}/{index}"), depth + 1, source, output);
            }
        }
    }
}

pub fn read_discovered(profile: &Profile) -> Result<ProfileData, String> {
    let path = Path::new(&profile.user_data_dir).join(BOOKMARKS_FILE);
    let bytes = fs::read(path).map_err(|error| format!("Cannot read Safari's {BOOKMARKS_FILE}: {error}"))?;
    let document = Value::from_reader(std::io::Cursor::new(bytes))
        .map_err(|error| format!("Safari's {BOOKMARKS_FILE} is not a readable property list: {error}"))?;
    let root = document
        .as_dictionary()
        .filter(|root| root.get("Children").and_then(Value::as_array).is_some())
        .ok_or_else(|| format!("Safari's {BOOKMARKS_FILE} has no bookmark tree."))?;
    let mut output = ProfileData::default();
    // The root list is a container; its children are Favorites, the menu, and loose items.
    visit_children(root, None, "", 0, &Source::of(profile), &mut output);
    Ok(output)
}

pub fn read_profile(profile_id: &str, override_dir: Option<&str>) -> Result<ProfileData, String> {
    let profile = discover(override_dir)?
        .into_iter()
        .find(|profile| profile.id == profile_id)
        .ok_or_else(|| "Safari bookmarks are no longer available at this location.".to_string())?;
    read_discovered(&profile)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};

    static FIXTURE_SEQUENCE: AtomicU64 = AtomicU64::new(0);

    fn list(title: &str, uuid: Option<&str>, children: Vec<Value>) -> Value {
        let mut node = Dictionary::new();
        node.insert("WebBookmarkType".into(), "WebBookmarkTypeList".into());
        node.insert("Title".into(), title.into());
        if let Some(uuid) = uuid {
            node.insert("WebBookmarkUUID".into(), uuid.into());
        }
        node.insert("Children".into(), Value::Array(children));
        Value::Dictionary(node)
    }

    fn leaf(title: &str, url: &str, uuid: Option<&str>) -> Value {
        let mut uri = Dictionary::new();
        uri.insert("title".into(), title.into());
        let mut node = Dictionary::new();
        node.insert("WebBookmarkType".into(), "WebBookmarkTypeLeaf".into());
        node.insert("URLString".into(), url.into());
        node.insert("URIDictionary".into(), Value::Dictionary(uri));
        if let Some(uuid) = uuid {
            node.insert("WebBookmarkUUID".into(), uuid.into());
        }
        Value::Dictionary(node)
    }

    fn document() -> Value {
        let mut history = Dictionary::new();
        history.insert("WebBookmarkType".into(), "WebBookmarkTypeProxy".into());
        history.insert("Title".into(), "History".into());
        list("", Some("root"), vec![
            Value::Dictionary(history),
            list("BookmarksBar", Some("bar"), vec![
                leaf("Favorite", "https://example.test/favorite", Some("fav")),
                list("Research", Some("research"), vec![
                    leaf("Nested", "https://example.test/nested", Some("nested")),
                ]),
            ]),
            list("BookmarksMenu", Some("menu"), vec![]),
            list("com.apple.ReadingList", Some("reading"), vec![
                leaf("Saved page", "https://example.test/reading", Some("saved")),
            ]),
            list("Loose folder", None, vec![leaf("No id A", "https://example.test/a", None)]),
            list("Loose folder", None, vec![leaf("No id B", "https://example.test/b", None)]),
            leaf("Loose bookmark", "https://example.test/loose", Some("loose")),
        ])
    }

    fn fixture_root(binary: bool) -> PathBuf {
        let sequence = FIXTURE_SEQUENCE.fetch_add(1, Ordering::Relaxed);
        let root = std::env::temp_dir().join(format!(
            "bookmarktivity-safari-{}-{sequence}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        let path = root.join(BOOKMARKS_FILE);
        if binary { document().to_file_binary(path).unwrap() } else { document().to_file_xml(path).unwrap() }
        root
    }

    #[test]
    fn reads_binary_and_xml_bookmark_trees() {
        for binary in [true, false] {
            let root = fixture_root(binary);
            let profiles = discover(Some(root.to_str().unwrap())).unwrap();
            assert_eq!(profiles.len(), 1);
            assert_eq!(profiles[0].browser_id, "safari");
            let data = read_profile(&profiles[0].id, Some(root.to_str().unwrap())).unwrap();
            let folders: Vec<_> = data.folders.iter().map(|f| f.name.as_str()).collect();
            assert_eq!(folders, ["Favorites", "Research", "Bookmarks Menu", "Loose folder", "Loose folder"]);
            let bookmarks: Vec<_> = data.bookmarks.iter().map(|b| b.name.as_str()).collect();
            assert_eq!(bookmarks, ["Favorite", "Nested", "No id A", "No id B", "Loose bookmark"]);
            let research = data.folders.iter().find(|f| f.name == "Research").unwrap();
            assert_eq!(research.parent_id.as_ref(), Some(&data.folders[0].id));
            assert_eq!(data.bookmarks[1].parent_id.as_ref(), Some(&research.id));
            assert_eq!(data.bookmarks[1].source.profile_id, profiles[0].id);
            assert!(data.bookmarks[4].parent_id.is_none());
            // Nodes without UUIDs still get distinct identities and correct parents.
            assert_ne!(data.folders[3].id, data.folders[4].id);
            assert_eq!(data.bookmarks[3].parent_id.as_ref(), Some(&data.folders[4].id));
            let mut ids: Vec<_> = data.folders.iter().map(|f| &f.id).chain(data.bookmarks.iter().map(|b| &b.id)).collect();
            ids.sort();
            ids.dedup();
            assert_eq!(ids.len(), 10);
            fs::remove_dir_all(root).unwrap();
        }
    }

    #[test]
    fn reports_missing_and_malformed_files() {
        let root = fixture_root(true);
        let profile = discover(Some(root.to_str().unwrap())).unwrap().remove(0);
        fs::write(root.join(BOOKMARKS_FILE), b"not a plist").unwrap();
        assert!(read_discovered(&profile).err().unwrap().contains("not a readable property list"));
        Value::Dictionary(Dictionary::new()).to_file_xml(root.join(BOOKMARKS_FILE)).unwrap();
        assert!(read_discovered(&profile).err().unwrap().contains("no bookmark tree"));
        fs::remove_file(root.join(BOOKMARKS_FILE)).unwrap();
        assert!(discover(Some(root.to_str().unwrap())).unwrap().is_empty());
        assert!(read_profile(&profile.id, Some(root.to_str().unwrap())).is_err());
        assert!(discover(Some(root.join("absent").to_str().unwrap())).unwrap_err().contains("does not exist"));
        fs::remove_dir_all(root).unwrap();
    }
}
