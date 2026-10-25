use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    fs,
    path::{Path, PathBuf},
};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    /// Stable source key: browser, canonical user-data directory, and profile folder.
    pub id: String,
    pub folder_id: String,
    pub name: String,
    pub browser_id: String,
    pub user_data_dir: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Source {
    pub browser_id: String,
    pub profile_id: String,
    pub profile_name: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Folder {
    pub kind: &'static str,
    pub id: String,
    pub parent_id: Option<String>,
    pub name: String,
    pub source: Source,
    pub date_added: Option<i64>,
    pub date_modified: Option<i64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Bookmark {
    pub kind: &'static str,
    pub id: String,
    pub parent_id: Option<String>,
    pub name: String,
    pub url: String,
    pub source: Source,
    pub date_added: Option<i64>,
    pub date_modified: Option<i64>,
}

#[derive(Serialize)]
pub struct ProfileData {
    pub folders: Vec<Folder>,
    pub bookmarks: Vec<Bookmark>,
    pub warning: Option<String>,
}

pub fn profile_key(browser_id: &str, user_data_dir: &Path, folder_id: &str) -> String {
    serde_json::to_string(&(browser_id, user_data_dir.to_string_lossy(), folder_id))
        .expect("profile identity is serializable")
}

fn bookmark_file_exists(path: &Path) -> bool {
    [
        "Bookmarks",
        "AccountBookmarks",
        "EncryptedBookmarks2",
        "EncryptedAccountBookmarks2",
        "EncryptedBookmarks",
        "EncryptedAccountBookmarks",
    ]
    .iter()
    .any(|name| path.join(name).is_file())
}

pub fn discover(
    browser_id: &str,
    candidates: Vec<PathBuf>,
    override_dir: Option<&str>,
) -> Result<Vec<Profile>, String> {
    let root = if let Some(value) = override_dir.filter(|value| !value.trim().is_empty()) {
        let path = PathBuf::from(value);
        if !path.is_dir() {
            return Err(format!(
                "The configured {browser_id} user-data directory does not exist."
            ));
        }
        path
    } else if let Some(path) = candidates.into_iter().find(|path| path.is_dir()) {
        path
    } else {
        return Ok(Vec::new());
    };
    let root = fs::canonicalize(root).map_err(|error| error.to_string())?;
    let names = fs::read(root.join("Local State"))
        .ok()
        .and_then(|bytes| serde_json::from_slice::<Value>(&bytes).ok())
        .and_then(|state| state.pointer("/profile/info_cache").cloned())
        .unwrap_or(Value::Null);
    let mut profiles = Vec::new();
    for entry in fs::read_dir(&root).map_err(|error| error.to_string())? {
        let path = entry.map_err(|error| error.to_string())?.path();
        let folder_id = path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("");
        if !path.is_dir()
            || !(folder_id == "Default" || folder_id.starts_with("Profile "))
            || !bookmark_file_exists(&path)
        {
            continue;
        }
        let name = names
            .get(folder_id)
            .and_then(|profile| profile.get("name"))
            .and_then(Value::as_str)
            .unwrap_or(folder_id)
            .to_string();
        profiles.push(Profile {
            id: profile_key(browser_id, &root, folder_id),
            folder_id: folder_id.to_string(),
            name,
            browser_id: browser_id.to_string(),
            user_data_dir: root.to_string_lossy().to_string(),
        });
    }
    profiles.sort_by(|a, b| a.folder_id.cmp(&b.folder_id));
    Ok(profiles)
}

fn chromium_time(node: &Value, key: &str) -> Option<i64> {
    node.get(key)?
        .as_str()?
        .parse::<i64>()
        .ok()
        .map(|microseconds| microseconds / 1000 - 11_644_473_600_000)
        .filter(|timestamp| *timestamp >= 0)
}

fn visit(
    node: &Value,
    parent_id: Option<&str>,
    store: &str,
    source: &Source,
    output: &mut ProfileData,
) {
    let raw_id = node
        .get("guid")
        .and_then(Value::as_str)
        .or_else(|| node.get("id").and_then(Value::as_str))
        .unwrap_or("");
    let id = serde_json::to_string(&(&source.profile_id, store, raw_id))
        .expect("node identity is serializable");
    let name = node
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    match node.get("type").and_then(Value::as_str) {
        Some("folder") => {
            output.folders.push(Folder {
                kind: "folder",
                id: id.clone(),
                parent_id: parent_id.map(str::to_string),
                name,
                source: source.clone(),
                date_added: chromium_time(node, "date_added"),
                date_modified: chromium_time(node, "date_modified"),
            });
            if let Some(children) = node.get("children").and_then(Value::as_array) {
                for child in children {
                    visit(child, Some(&id), store, source, output);
                }
            }
        }
        Some("url") => {
            if let Some(url) = node.get("url").and_then(Value::as_str) {
                output.bookmarks.push(Bookmark {
                    kind: "bookmark",
                    id,
                    parent_id: parent_id.map(str::to_string),
                    name,
                    url: url.to_string(),
                    source: source.clone(),
                    date_added: chromium_time(node, "date_added"),
                    date_modified: None,
                });
            }
        }
        _ => {}
    }
}

pub fn read_profile(profile: &Profile) -> Result<ProfileData, String> {
    let path = Path::new(&profile.user_data_dir).join(&profile.folder_id);
    let mut output = ProfileData {
        folders: Vec::new(),
        bookmarks: Vec::new(),
        warning: None,
    };
    let mut found = false;
    let mut has_encrypted_copy = false;
    for (store, encrypted_names) in [
        ("Bookmarks", ["EncryptedBookmarks2", "EncryptedBookmarks"]),
        (
            "AccountBookmarks",
            ["EncryptedAccountBookmarks2", "EncryptedAccountBookmarks"],
        ),
    ] {
        let file = path.join(store);
        let encrypted_exists = encrypted_names.iter().any(|name| path.join(name).is_file());
        if encrypted_exists && !file.is_file() {
            return Err(format!(
                "{store} is available only in encrypted storage, which Bookmarktivity cannot read yet."
            ));
        }
        if !file.exists() {
            continue;
        }
        has_encrypted_copy |= encrypted_exists;
        found = true;
        let bytes = fs::read(file).map_err(|error| error.to_string())?;
        let document: Value = serde_json::from_slice(&bytes).map_err(|error| error.to_string())?;
        let roots = document
            .get("roots")
            .and_then(Value::as_object)
            .ok_or_else(|| format!("{store} has no bookmark roots."))?;
        let source = Source {
            browser_id: profile.browser_id.clone(),
            profile_id: profile.id.clone(),
            profile_name: profile.name.clone(),
        };
        for (key, node) in roots {
            if node.get("type").and_then(Value::as_str) == Some("folder") {
                visit(node, None, store, &source, &mut output);
            } else if key != "sync_transaction_version" && key != "meta_info" {
                return Err(format!(
                    "{store} contains an unsupported bookmark root: {key}."
                ));
            }
        }
    }
    if !found {
        return Err("This profile has no supported bookmark file.".into());
    }
    if has_encrypted_copy {
        output.warning = Some("Showing a clear-text bookmark snapshot. Encrypted storage also exists, so these results may be older than the browser's current bookmarks.".into());
    }
    Ok(output)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    static FIXTURE_SEQUENCE: AtomicU64 = AtomicU64::new(0);

    fn fixture_root() -> PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let sequence = FIXTURE_SEQUENCE.fetch_add(1, Ordering::Relaxed);
        let root = std::env::temp_dir().join(format!(
            "bookmarktivity-chromium-{}-{stamp}-{sequence}",
            std::process::id()
        ));
        fs::create_dir_all(root.join("Default")).unwrap();
        fs::write(
            root.join("Local State"),
            r#"{"profile":{"info_cache":{"Default":{"name":"Research"}}}}"#,
        )
        .unwrap();
        fs::write(root.join("Default/Bookmarks"), r#"{"roots":{"bookmark_bar":{"type":"folder","guid":"root","name":"Bar","children":[{"type":"url","guid":"same","name":"Local","url":"https://example.test/local"}]}}}"#).unwrap();
        fs::write(root.join("Default/AccountBookmarks"), r#"{"roots":{"bookmark_bar":{"type":"folder","guid":"root","name":"Account bar","children":[{"type":"url","guid":"same","name":"Account","url":"https://example.test/account"}]}}}"#).unwrap();
        root
    }

    #[test]
    fn keeps_browser_profile_and_store_ids_distinct() {
        let root = fixture_root();
        let other_root = fixture_root();
        let edge = discover("edge", vec![], Some(root.to_str().unwrap()))
            .unwrap()
            .remove(0);
        let chrome = discover("chrome", vec![], Some(root.to_str().unwrap()))
            .unwrap()
            .remove(0);
        let brave = discover("brave", vec![], Some(root.to_str().unwrap()))
            .unwrap()
            .remove(0);
        assert_ne!(edge.id, chrome.id);
        assert_ne!(chrome.id, brave.id);
        let other_chrome = discover("chrome", vec![], Some(other_root.to_str().unwrap()))
            .unwrap()
            .remove(0);
        assert_ne!(chrome.id, other_chrome.id);
        assert_eq!(edge.name, "Research");
        let data = read_profile(&chrome).unwrap();
        assert!(data.warning.is_none());
        assert_eq!(data.bookmarks.len(), 2);
        assert_eq!(data.folders.len(), 2);
        assert_ne!(data.bookmarks[0].id, data.bookmarks[1].id);
        assert_eq!(data.bookmarks[0].source.profile_id, chrome.id);
        fs::remove_dir_all(root).unwrap();
        fs::remove_dir_all(other_root).unwrap();
    }

    #[test]
    fn warns_for_clear_text_with_encrypted_copy_and_rejects_missing_store() {
        let root = fixture_root();
        let profile = discover("chrome", vec![], Some(root.to_str().unwrap()))
            .unwrap()
            .remove(0);
        fs::write(root.join("Default/EncryptedBookmarks2"), b"encrypted").unwrap();
        fs::write(
            root.join("Default/EncryptedAccountBookmarks2"),
            b"encrypted",
        )
        .unwrap();
        let data = read_profile(&profile).unwrap();
        assert_eq!(data.bookmarks.len(), 2);
        assert!(data.warning.unwrap().contains("may be older"));
        fs::remove_file(root.join("Default/AccountBookmarks")).unwrap();
        assert!(read_profile(&profile)
            .err()
            .unwrap()
            .contains("AccountBookmarks is available only in encrypted storage"));
        fs::write(root.join("Default/AccountBookmarks"), r#"{"roots":{}}"#).unwrap();
        fs::remove_file(root.join("Default/Bookmarks")).unwrap();
        assert!(read_profile(&profile)
            .err()
            .unwrap()
            .contains("Bookmarks is available only in encrypted storage"));
        fs::remove_file(root.join("Default/EncryptedBookmarks2")).unwrap();
        fs::remove_file(root.join("Default/EncryptedAccountBookmarks2")).unwrap();
        fs::write(root.join("Default/AccountBookmarks"), "{}").unwrap();
        assert!(read_profile(&profile)
            .err()
            .unwrap()
            .contains("no bookmark roots"));
        fs::remove_dir_all(root).unwrap();
    }
}
