use serde::Serialize;
use serde_json::Value;
use std::{
    fs,
    path::{Path, PathBuf},
};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub id: String,
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
}

fn candidate_dirs() -> Vec<PathBuf> {
    let mut dirs_out = Vec::new();
    #[cfg(target_os = "macos")]
    if let Some(dir) = dirs::data_dir() {
        dirs_out.push(dir.join("Microsoft Edge"));
    }
    #[cfg(target_os = "windows")]
    if let Some(dir) = dirs::data_local_dir() {
        dirs_out.push(dir.join("Microsoft").join("Edge").join("User Data"));
    }
    #[cfg(target_os = "linux")]
    if let Some(dir) = dirs::config_dir() {
        dirs_out.push(dir.join("microsoft-edge"));
        dirs_out.push(dir.join("microsoft-edge-beta"));
        dirs_out.push(dir.join("microsoft-edge-dev"));
    }
    dirs_out
}

fn chosen_dir(override_dir: Option<&str>) -> Result<PathBuf, String> {
    if let Some(value) = override_dir.filter(|s| !s.trim().is_empty()) {
        let path = PathBuf::from(value);
        if path.is_dir() {
            return Ok(path);
        }
        return Err("The configured Edge user-data directory does not exist.".into());
    }
    candidate_dirs()
        .into_iter()
        .find(|path| path.is_dir())
        .ok_or_else(|| {
            "No Edge user-data directory was found. Set its location in Settings.".into()
        })
}

fn profile_dirs(root: &Path) -> Result<Vec<PathBuf>, String> {
    let mut out = Vec::new();
    for entry in fs::read_dir(root).map_err(|e| e.to_string())? {
        let path = entry.map_err(|e| e.to_string())?.path();
        let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if path.is_dir()
            && (name == "Default" || name.starts_with("Profile "))
            && path.join("Bookmarks").is_file()
        {
            out.push(path);
        }
    }
    out.sort();
    Ok(out)
}

fn display_names(root: &Path) -> Value {
    fs::read(root.join("Local State"))
        .ok()
        .and_then(|bytes| serde_json::from_slice::<Value>(&bytes).ok())
        .and_then(|state| {
            state
                .get("profile")
                .and_then(|p| p.get("info_cache"))
                .cloned()
        })
        .unwrap_or(Value::Null)
}

pub fn discover(override_dir: Option<&str>) -> Result<Vec<Profile>, String> {
    let root = chosen_dir(override_dir)?;
    let names = display_names(&root);
    let canonical = fs::canonicalize(&root).map_err(|e| e.to_string())?;
    profile_dirs(&root)?
        .into_iter()
        .map(|path| {
            let id = path.file_name().unwrap().to_string_lossy().to_string();
            let name = names
                .get(&id)
                .and_then(|p| p.get("name"))
                .and_then(Value::as_str)
                .unwrap_or(&id)
                .to_string();
            Ok(Profile {
                id,
                name,
                browser_id: "edge".into(),
                user_data_dir: canonical.to_string_lossy().to_string(),
            })
        })
        .collect()
}

fn edge_time(value: &Value, key: &str) -> Option<i64> {
    value
        .get(key)?
        .as_str()?
        .parse::<i64>()
        .ok()
        .map(|microseconds| microseconds / 1000 - 11_644_473_600_000)
        .filter(|timestamp| *timestamp >= 0)
}

fn visit(node: &Value, parent_id: Option<&str>, source: &Source, output: &mut ProfileData) {
    let node_type = node.get("type").and_then(Value::as_str).unwrap_or("");
    let raw_id = node
        .get("guid")
        .and_then(Value::as_str)
        .or_else(|| node.get("id").and_then(Value::as_str))
        .unwrap_or("");
    let id = format!("edge:{}:{}", source.profile_id, raw_id);
    let name = node
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    match node_type {
        "folder" => {
            output.folders.push(Folder {
                kind: "folder",
                id: id.clone(),
                parent_id: parent_id.map(str::to_string),
                name,
                source: Source { ..source.clone() },
                date_added: edge_time(node, "date_added"),
                date_modified: edge_time(node, "date_modified"),
            });
            if let Some(children) = node.get("children").and_then(Value::as_array) {
                for child in children {
                    visit(child, Some(&id), source, output);
                }
            }
        }
        "url" => {
            if let Some(url) = node.get("url").and_then(Value::as_str) {
                output.bookmarks.push(Bookmark {
                    kind: "bookmark",
                    id,
                    parent_id: parent_id.map(str::to_string),
                    name,
                    url: url.to_string(),
                    source: Source { ..source.clone() },
                    date_added: edge_time(node, "date_added"),
                    date_modified: None,
                });
            }
        }
        _ => {}
    }
}

pub fn read_profile(profile_id: &str, override_dir: Option<&str>) -> Result<ProfileData, String> {
    let profiles = discover(override_dir)?;
    let profile = profiles
        .into_iter()
        .find(|p| p.id == profile_id)
        .ok_or_else(|| "The selected Edge profile is no longer available.".to_string())?;
    let root = PathBuf::from(&profile.user_data_dir);
    let bytes = fs::read(root.join(&profile.id).join("Bookmarks")).map_err(|e| e.to_string())?;
    let document: Value = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
    let source = Source {
        browser_id: profile.browser_id,
        profile_id: profile.id,
        profile_name: profile.name,
    };
    let mut output = ProfileData {
        folders: Vec::new(),
        bookmarks: Vec::new(),
    };
    if let Some(roots) = document.get("roots").and_then(Value::as_object) {
        for (key, root_node) in roots {
            if key == "sync_transaction_version" {
                continue;
            }
            visit(root_node, None, &source, &mut output);
        }
    }
    Ok(output)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn discovers_and_reads_only_selected_synthetic_profile() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "bookmarktivity-edge-test-{}-{unique}",
            std::process::id()
        ));
        let default = root.join("Default");
        let other = root.join("Profile 1");
        fs::create_dir_all(&default).unwrap();
        fs::create_dir_all(&other).unwrap();
        fs::write(root.join("Local State"), r#"{"profile":{"info_cache":{"Default":{"name":"Work"},"Profile 1":{"name":"Private"}}}}"#).unwrap();
        fs::write(default.join("Bookmarks"), r#"{"roots":{"bookmark_bar":{"type":"folder","id":"1","name":"Bookmarks bar","children":[{"type":"folder","id":"2","name":"Research","children":[{"type":"url","id":"3","name":"Guide","url":"https://example.com/guide"}]}]}}}"#).unwrap();
        fs::write(other.join("Bookmarks"), r#"{"roots":{"bookmark_bar":{"type":"folder","id":"1","name":"Other","children":[{"type":"url","id":"2","name":"Secret","url":"https://private.example"}]}}}"#).unwrap();
        let dir = root.to_str().unwrap();
        let profiles = discover(Some(dir)).unwrap();
        assert_eq!(profiles.len(), 2);
        assert_eq!(profiles[0].name, "Work");
        let data = read_profile("Default", Some(dir)).unwrap();
        assert_eq!(data.folders.len(), 2);
        assert_eq!(data.bookmarks.len(), 1);
        assert_eq!(data.bookmarks[0].source.profile_id, "Default");
        assert_eq!(
            data.bookmarks[0].parent_id.as_deref(),
            Some("edge:Default:2")
        );
        assert_eq!(data.bookmarks[0].url, "https://example.com/guide");
        fs::remove_dir_all(root).unwrap();
    }
}
