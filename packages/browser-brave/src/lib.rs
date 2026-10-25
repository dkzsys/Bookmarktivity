use std::path::PathBuf;

pub use browser_chromium::{Profile, ProfileData};

fn candidate_dirs() -> Vec<PathBuf> {
    let mut dirs_out = Vec::new();
    #[cfg(target_os = "macos")]
    if let Some(dir) = dirs::data_dir() {
        dirs_out.push(dir.join("BraveSoftware").join("Brave-Browser"));
    }
    #[cfg(target_os = "windows")]
    if let Some(dir) = dirs::data_local_dir() {
        dirs_out.push(
            dir.join("BraveSoftware")
                .join("Brave-Browser")
                .join("User Data"),
        );
    }
    #[cfg(target_os = "linux")]
    if let Some(dir) = dirs::config_dir() {
        dirs_out.push(dir.join("BraveSoftware").join("Brave-Browser"));
    }
    dirs_out
}

pub fn discover(override_dir: Option<&str>) -> Result<Vec<Profile>, String> {
    browser_chromium::discover("brave", candidate_dirs(), override_dir)
}

pub fn read_profile(profile_id: &str, override_dir: Option<&str>) -> Result<ProfileData, String> {
    let profile = discover(override_dir)?
        .into_iter()
        .find(|profile| profile.id == profile_id)
        .ok_or_else(|| "The selected Brave profile is no longer available.".to_string())?;
    browser_chromium::read_profile(&profile)
}
