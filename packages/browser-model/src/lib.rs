//! Browser-neutral records shared by every read-only browser adapter.

use serde::{Deserialize, Serialize};
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

impl Source {
    pub fn of(profile: &Profile) -> Self {
        Source {
            browser_id: profile.browser_id.clone(),
            profile_id: profile.id.clone(),
            profile_name: profile.name.clone(),
        }
    }
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

#[derive(Default, Serialize)]
pub struct ProfileData {
    pub folders: Vec<Folder>,
    pub bookmarks: Vec<Bookmark>,
    pub warning: Option<String>,
}

pub fn profile_key(browser_id: &str, user_data_dir: &Path, folder_id: &str) -> String {
    serde_json::to_string(&(browser_id, user_data_dir.to_string_lossy(), folder_id))
        .expect("profile identity is serializable")
}

/// Node identity within a profile: the profile key, the store the node came from, and the
/// browser's own identifier for it.
pub fn node_key(profile_id: &str, store: &str, raw_id: &str) -> String {
    serde_json::to_string(&(profile_id, store, raw_id)).expect("node identity is serializable")
}

/// Resolve a browser's data directory: the configured override when present, otherwise the
/// first default candidate that exists. A bad override is an error; a missing default is
/// `None`. Access failures are reported rather than treated as absence.
pub fn resolve_root(
    browser_id: &str,
    candidates: Vec<PathBuf>,
    override_dir: Option<&str>,
) -> Result<Option<PathBuf>, String> {
    let root = if let Some(value) = override_dir.filter(|value| !value.trim().is_empty()) {
        let path = PathBuf::from(value);
        match fs::metadata(&path) {
            Ok(metadata) if metadata.is_dir() => {}
            Ok(_) => {
                return Err(format!(
                    "The configured {browser_id} user-data path is not a directory."
                ))
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                return Err(format!(
                    "The configured {browser_id} user-data directory does not exist."
                ))
            }
            Err(error) => {
                return Err(format!(
                    "Cannot access the configured {browser_id} user-data directory: {error}"
                ))
            }
        }
        path
    } else {
        let mut found = None;
        for path in candidates {
            match fs::metadata(&path) {
                Ok(metadata) if metadata.is_dir() => {
                    found = Some(path);
                    break;
                }
                Ok(_) => {}
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(error) => {
                    return Err(format!(
                        "Cannot access the {browser_id} user-data directory: {error}"
                    ))
                }
            }
        }
        match found {
            Some(path) => path,
            None => return Ok(None),
        }
    };
    fs::canonicalize(root)
        .map(Some)
        .map_err(|error| error.to_string())
}
