#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use browser_edge::{Profile, ProfileData};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, fs, path::PathBuf};

#[derive(Default, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
enum Theme {
    #[default]
    Light,
    Dark,
}

#[derive(Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Preferences {
    enabled_profile_ids: Vec<String>,
    edge_user_data_dir: Option<String>,
    #[serde(default)]
    shortcuts: HashMap<String, String>,
    #[serde(default)]
    theme: Theme,
}

fn preferences_path() -> Result<PathBuf, String> {
    let dir = dirs::config_dir()
        .ok_or_else(|| "Cannot find the application configuration directory.".to_string())?
        .join("Bookmarktivity");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("preferences.json"))
}

#[tauri::command]
fn load_preferences() -> Result<Preferences, String> {
    let path = preferences_path()?;
    if !path.exists() {
        return Ok(Preferences::default());
    }
    let bytes = fs::read(path).map_err(|e| e.to_string())?;
    serde_json::from_slice(&bytes).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_preferences(preferences: Preferences) -> Result<(), String> {
    let path = preferences_path()?;
    let bytes = serde_json::to_vec_pretty(&preferences).map_err(|e| e.to_string())?;
    fs::write(path, bytes).map_err(|e| e.to_string())
}

#[tauri::command]
fn discover_profiles(user_data_dir: Option<String>) -> Result<Vec<Profile>, String> {
    browser_edge::discover(user_data_dir.as_deref())
}

#[tauri::command]
fn read_profile(profile_id: String) -> Result<ProfileData, String> {
    let preferences = load_preferences()?;
    if !preferences
        .enabled_profile_ids
        .iter()
        .any(|id| id == &profile_id)
    {
        return Err("Enable this profile before reading it.".into());
    }
    browser_edge::read_profile(&profile_id, preferences.edge_user_data_dir.as_deref())
}

#[tauri::command]
fn open_bookmark(url: String) -> Result<(), String> {
    let lower = url.to_ascii_lowercase();
    if !(lower.starts_with("https://") || lower.starts_with("http://")) {
        return Err("Only HTTP and HTTPS bookmarks can be opened.".into());
    }
    open::that(url).map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            load_preferences,
            save_preferences,
            discover_profiles,
            read_profile,
            open_bookmark
        ])
        .run(tauri::generate_context!())
        .expect("error while running Bookmarktivity");
}
