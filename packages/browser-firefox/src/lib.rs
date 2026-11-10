//! Read-only Firefox adapter.
//!
//! Firefox keeps bookmarks in `places.sqlite`, which also holds browsing history and is
//! held open in write-ahead-log mode while Firefox runs. This adapter never opens that file
//! through SQLite: it reads the database (and any `-wal` file) into memory, applies the
//! committed log frames there, and queries the in-memory image. Nothing is written to the
//! profile, no sidecar files are created, and no copy is placed on disk.

use browser_model::{node_key, profile_key, resolve_root, Bookmark, Folder, Source};
use rusqlite::{Connection, MAIN_DB};
use std::{
    collections::{HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
};

pub use browser_model::{Profile, ProfileData};

const BROWSER_ID: &str = "firefox";
const DATABASE: &str = "places.sqlite";
const STORE: &str = "places";
const READ_ATTEMPTS: usize = 5;

fn candidate_dirs() -> Vec<PathBuf> {
    let mut dirs_out = Vec::new();
    #[cfg(target_os = "macos")]
    if let Some(dir) = dirs::data_dir() {
        dirs_out.push(dir.join("Firefox"));
    }
    #[cfg(target_os = "windows")]
    if let Some(dir) = dirs::data_dir() {
        dirs_out.push(dir.join("Mozilla").join("Firefox"));
    }
    // Firefox installed from the Microsoft Store keeps its data inside the package folder.
    #[cfg(target_os = "windows")]
    if let Some(dir) = dirs::data_local_dir() {
        dirs_out.push(dir.join("Packages/Mozilla.Firefox_n80bbvh6b1yt2/LocalCache/Roaming/Mozilla/Firefox"));
    }
    #[cfg(target_os = "linux")]
    {
        if let Some(dir) = dirs::home_dir() {
            dirs_out.push(dir.join(".mozilla").join("firefox"));
        }
        if let Some(dir) = dirs::config_dir() {
            dirs_out.push(dir.join("mozilla").join("firefox"));
        }
        if let Some(dir) = dirs::home_dir() {
            dirs_out.push(dir.join("snap/firefox/common/.mozilla/firefox"));
            dirs_out.push(dir.join(".var/app/org.mozilla.firefox/.mozilla/firefox"));
        }
    }
    dirs_out
}

fn has_database(path: &Path) -> Result<bool, String> {
    match fs::metadata(path.join(DATABASE)) {
        Ok(metadata) => Ok(metadata.is_file()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(format!(
            "Cannot inspect {DATABASE} in a Firefox profile: {error}"
        )),
    }
}

/// `(name, path, is_relative)` for each `[Profile…]` section of `profiles.ini`.
fn parse_profiles_ini(text: &str) -> Vec<(Option<String>, String, bool)> {
    let mut profiles = Vec::new();
    let mut current: Option<(Option<String>, Option<String>, bool)> = None;
    let mut flush = |entry: Option<(Option<String>, Option<String>, bool)>| {
        if let Some((name, Some(path), relative)) = entry {
            profiles.push((name, path, relative));
        }
    };
    for line in text.lines() {
        let line = line.trim();
        if line.starts_with('[') {
            flush(current.take());
            if line.starts_with("[Profile") {
                current = Some((None, None, true));
            }
        } else if let (Some(entry), Some((key, value))) = (current.as_mut(), line.split_once('=')) {
            match key.trim() {
                "Name" => entry.0 = Some(value.trim().to_string()),
                "Path" => entry.1 = Some(value.trim().to_string()),
                "IsRelative" => entry.2 = value.trim() != "0",
                _ => {}
            }
        }
    }
    flush(current.take());
    profiles
}

fn scan_for_profiles(root: &Path) -> Result<Vec<(Option<String>, String, bool)>, String> {
    let mut found = Vec::new();
    for (dir, prefix) in [(root.to_path_buf(), ""), (root.join("Profiles"), "Profiles/")] {
        let entries = match fs::read_dir(&dir) {
            Ok(entries) => entries,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
            Err(error) => return Err(error.to_string()),
        };
        for entry in entries {
            let entry = entry.map_err(|error| error.to_string())?;
            if let Some(name) = entry.file_name().to_str() {
                if entry.path().is_dir() {
                    found.push((None, format!("{prefix}{name}"), true));
                }
            }
        }
    }
    Ok(found)
}

pub fn discover(override_dir: Option<&str>) -> Result<Vec<Profile>, String> {
    let Some(root) = resolve_root(BROWSER_ID, candidate_dirs(), override_dir)? else {
        return Ok(Vec::new());
    };
    let listed = match fs::read(root.join("profiles.ini")) {
        Ok(bytes) => parse_profiles_ini(&String::from_utf8_lossy(&bytes)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => scan_for_profiles(&root)?,
        Err(error) => return Err(format!("Cannot read Firefox profiles.ini: {error}")),
    };
    let mut profiles = Vec::new();
    for (name, path, relative) in listed {
        // A relative path stays relative to the user-data directory in the profile key; an
        // absolute one (IsRelative=0) is kept whole, and `Path::join` resolves either form.
        let location = if relative { root.join(&path) } else { PathBuf::from(&path) };
        if !has_database(&location)? {
            continue;
        }
        let fallback = path
            .rsplit(['/', '\\'])
            .next()
            .map(|folder| folder.split_once('.').map_or(folder, |(_, label)| label))
            .unwrap_or(&path)
            .to_string();
        profiles.push(Profile {
            id: profile_key(BROWSER_ID, &root, &path),
            name: name.filter(|name| !name.is_empty()).unwrap_or(fallback),
            folder_id: path,
            browser_id: BROWSER_ID.to_string(),
            user_data_dir: root.to_string_lossy().to_string(),
        });
    }
    profiles.sort_by(|a, b| a.folder_id.cmp(&b.folder_id));
    profiles.dedup_by(|a, b| a.id == b.id);
    Ok(profiles)
}

fn be32(bytes: &[u8], offset: usize) -> u32 {
    u32::from_be_bytes(bytes[offset..offset + 4].try_into().unwrap())
}

fn wal_checksum(big_endian: bool, data: &[u8], mut sum: (u32, u32)) -> (u32, u32) {
    for pair in data.chunks_exact(8) {
        let word = |offset: usize| {
            let raw: [u8; 4] = pair[offset..offset + 4].try_into().unwrap();
            if big_endian { u32::from_be_bytes(raw) } else { u32::from_le_bytes(raw) }
        };
        sum.0 = sum.0.wrapping_add(word(0)).wrapping_add(sum.1);
        sum.1 = sum.1.wrapping_add(word(4)).wrapping_add(sum.0);
    }
    sum
}

/// Bring a database image up to its last committed transaction by applying valid frames
/// from its write-ahead log, following SQLite's own recovery rules: frames count only while
/// their salts and running checksums hold, and only up to the last commit frame.
fn apply_wal(image: &mut Vec<u8>, wal: &[u8]) {
    const HEADER: usize = 32;
    const FRAME_HEADER: usize = 24;
    if wal.len() < HEADER {
        return;
    }
    let big_endian = match be32(wal, 0) {
        0x377f_0682 => false,
        0x377f_0683 => true,
        _ => return,
    };
    let page_size = be32(wal, 8) as usize;
    if page_size < 512 || !page_size.is_power_of_two() {
        return;
    }
    let mut sum = wal_checksum(big_endian, &wal[..24], (0, 0));
    if (be32(wal, 24), be32(wal, 28)) != sum {
        return;
    }
    let salts = &wal[16..24];
    let mut pending: Vec<(usize, &[u8])> = Vec::new();
    let mut offset = HEADER;
    while offset + FRAME_HEADER + page_size <= wal.len() {
        let header = &wal[offset..offset + FRAME_HEADER];
        let page = &wal[offset + FRAME_HEADER..offset + FRAME_HEADER + page_size];
        let page_number = be32(header, 0) as usize;
        let commit_size = be32(header, 4) as usize;
        if page_number == 0 || &header[8..16] != salts {
            break;
        }
        sum = wal_checksum(big_endian, &header[..8], sum);
        sum = wal_checksum(big_endian, page, sum);
        if (be32(header, 16), be32(header, 20)) != sum {
            break;
        }
        pending.push((page_number, page));
        if commit_size != 0 {
            for (number, content) in pending.drain(..) {
                let end = number * page_size;
                if image.len() < end {
                    image.resize(end, 0);
                }
                image[end - page_size..end].copy_from_slice(content);
            }
            image.resize(commit_size * page_size, 0);
        }
        offset += FRAME_HEADER + page_size;
    }
}

/// Read a consistent in-memory image of the database. Only a checkpoint writes to the main
/// file in WAL mode, and it writes pages the log already holds, so an image is consistent
/// whenever the log is byte-identical before and after the main file is read.
fn snapshot(database: &Path) -> Result<Vec<u8>, String> {
    let mut wal_path = database.as_os_str().to_owned();
    wal_path.push("-wal");
    let read_wal = || match fs::read(&wal_path) {
        Ok(bytes) => Ok(bytes),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(Vec::new()),
        Err(error) => Err(format!("Cannot read the Firefox bookmark log: {error}")),
    };
    for attempt in 0..READ_ATTEMPTS {
        if attempt > 0 {
            std::thread::sleep(std::time::Duration::from_millis(40 * attempt as u64));
        }
        let before = read_wal()?;
        let mut image = fs::read(database)
            .map_err(|error| format!("Cannot read the Firefox bookmark database: {error}"))?;
        if before != read_wal()? {
            continue;
        }
        if image.len() < 100 || &image[..16] != b"SQLite format 3\0" {
            return Err("The Firefox bookmark database is not a SQLite file.".into());
        }
        apply_wal(&mut image, &before);
        // Mark the image as a rollback-journal database so SQLite reads it without a log.
        image[18] = 1;
        image[19] = 1;
        let page_size = match u16::from_be_bytes([image[16], image[17]]) {
            1 => 65536,
            size => size as usize,
        };
        if page_size >= 512 {
            let pages = (image.len() / page_size) as u32;
            image[28..32].copy_from_slice(&pages.to_be_bytes());
            let change_counter: [u8; 4] = image[24..28].try_into().unwrap();
            image[92..96].copy_from_slice(&change_counter);
        }
        return Ok(image);
    }
    Err("Firefox kept writing to its bookmark database during the read. Re-read this profile to try again.".into())
}

struct Row {
    kind: i64,
    parent: i64,
    title: String,
    added: Option<i64>,
    modified: Option<i64>,
    guid: String,
    url: Option<String>,
}

fn root_title(guid: &str) -> Option<&'static str> {
    Some(match guid {
        "menu________" => "Bookmarks Menu",
        "toolbar_____" => "Bookmarks Toolbar",
        "unfiled_____" => "Other Bookmarks",
        "mobile______" => "Mobile Bookmarks",
        _ => return None,
    })
}

/// Firefox stores microseconds since the Unix epoch; records carry milliseconds.
fn firefox_time(value: Option<i64>) -> Option<i64> {
    value.map(|microseconds| microseconds / 1000).filter(|timestamp| *timestamp > 0)
}

fn read_database(image: Vec<u8>, source: &Source) -> Result<ProfileData, rusqlite::Error> {
    let mut connection = Connection::open_in_memory()?;
    connection.deserialize_read_exact(MAIN_DB, image.as_slice(), image.len(), true)?;
    drop(image);
    let mut rows: HashMap<i64, Row> = HashMap::new();
    let mut children: HashMap<i64, Vec<i64>> = HashMap::new();
    {
        let mut statement = connection.prepare(
            "SELECT b.id, b.type, b.parent, b.title, b.dateAdded, b.lastModified, b.guid, p.url \
             FROM moz_bookmarks b LEFT JOIN moz_places p ON p.id = b.fk \
             ORDER BY b.parent, b.position, b.id",
        )?;
        let mut query = statement.query([])?;
        while let Some(row) = query.next()? {
            let id: i64 = row.get(0)?;
            let parent: i64 = row.get::<_, Option<i64>>(2)?.unwrap_or(0);
            children.entry(parent).or_default().push(id);
            rows.insert(id, Row {
                kind: row.get(1)?,
                parent,
                title: row.get::<_, Option<String>>(3)?.unwrap_or_default(),
                added: row.get(4)?,
                modified: row.get(5)?,
                guid: row.get::<_, Option<String>>(6)?.unwrap_or_else(|| id.to_string()),
                url: row.get(7)?,
            });
        }
    }
    let mut output = ProfileData::default();
    // The places root is a container, not a user-visible folder; its children are the roots.
    let Some(places_root) = rows
        .iter()
        .find(|(_, row)| row.guid == "root________" || row.parent == 0)
        .map(|(id, _)| *id)
    else {
        return Ok(output);
    };
    let no_children = Vec::new();
    let mut seen = HashSet::from([places_root]);
    let mut pending: Vec<(i64, Option<String>)> = Vec::new();
    let push_children = |pending: &mut Vec<(i64, Option<String>)>, id: i64, key: Option<&str>| {
        for child in children.get(&id).unwrap_or(&no_children).iter().rev() {
            pending.push((*child, key.map(str::to_string)));
        }
    };
    push_children(&mut pending, places_root, None);
    while let Some((id, parent_id)) = pending.pop() {
        let row = &rows[&id];
        if !seen.insert(id) {
            continue;
        }
        let top_level = row.parent == places_root;
        // Tags are stored as folders of duplicate bookmark rows; they are not bookmarks.
        if top_level && row.guid == "tags________" {
            continue;
        }
        let key = node_key(&source.profile_id, STORE, &row.guid);
        match (row.kind, &row.url) {
            (2, _) => {
                let empty = children.get(&id).is_none_or(Vec::is_empty);
                if top_level && empty && row.guid == "mobile______" {
                    continue;
                }
                output.folders.push(Folder {
                    kind: "folder",
                    id: key.clone(),
                    parent_id,
                    name: top_level
                        .then(|| root_title(&row.guid))
                        .flatten()
                        .map_or_else(|| row.title.clone(), str::to_string),
                    source: source.clone(),
                    date_added: firefox_time(row.added),
                    date_modified: firefox_time(row.modified),
                });
                push_children(&mut pending, id, Some(&key));
            }
            // `place:` URLs are saved history queries (for example "Most Visited").
            (1, Some(url)) if !url.starts_with("place:") => output.bookmarks.push(Bookmark {
                kind: "bookmark",
                id: key,
                parent_id,
                name: row.title.clone(),
                url: url.clone(),
                source: source.clone(),
                date_added: firefox_time(row.added),
                date_modified: firefox_time(row.modified),
            }),
            _ => {}
        }
    }
    Ok(output)
}

pub fn read_discovered(profile: &Profile) -> Result<ProfileData, String> {
    let database = Path::new(&profile.user_data_dir)
        .join(&profile.folder_id)
        .join(DATABASE);
    let image = snapshot(&database)?;
    read_database(image, &Source::of(profile))
        .map_err(|error| format!("Cannot read Firefox bookmarks from {DATABASE}: {error}"))
}

pub fn read_profile(profile_id: &str, override_dir: Option<&str>) -> Result<ProfileData, String> {
    let profile = discover(override_dir)?
        .into_iter()
        .find(|profile| profile.id == profile_id)
        .ok_or_else(|| "The selected Firefox profile is no longer available.".to_string())?;
    read_discovered(&profile)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};

    static FIXTURE_SEQUENCE: AtomicU64 = AtomicU64::new(0);

    const SCHEMA: &str = "
        CREATE TABLE moz_places (id INTEGER PRIMARY KEY, url LONGVARCHAR);
        CREATE TABLE moz_bookmarks (id INTEGER PRIMARY KEY, type INTEGER, fk INTEGER, parent INTEGER,
            position INTEGER, title LONGVARCHAR, dateAdded INTEGER, lastModified INTEGER, guid TEXT);
        INSERT INTO moz_places VALUES
            (1, 'https://example.test/toolbar'), (2, 'https://example.test/nested'),
            (3, 'place:sort=8&maxResults=10'), (4, 'https://example.test/menu');
        INSERT INTO moz_bookmarks VALUES
            (1, 2, NULL, 0, 0, '', 1700000000000000, 1700000000000000, 'root________'),
            (2, 2, NULL, 1, 0, 'menu', 1700000000000000, 1700000000000000, 'menu________'),
            (3, 2, NULL, 1, 1, 'toolbar', 1700000000000000, 1700000001000000, 'toolbar_____'),
            (4, 2, NULL, 1, 2, 'tags', 1700000000000000, 1700000000000000, 'tags________'),
            (5, 2, NULL, 1, 3, 'unfiled', 1700000000000000, 1700000000000000, 'unfiled_____'),
            (6, 2, NULL, 1, 4, 'mobile', 1700000000000000, 1700000000000000, 'mobile______'),
            (7, 1, 1, 3, 1, 'Toolbar link', 1700000002000000, 1700000003000000, 'bm-toolbar00'),
            (8, 2, NULL, 3, 0, 'Research', 1700000000000000, 1700000000000000, 'fd-research0'),
            (9, 1, 2, 8, 0, 'Nested link', 1700000000000000, 1700000000000000, 'bm-nested000'),
            (10, 3, NULL, 3, 2, NULL, 1700000000000000, 1700000000000000, 'sep000000000'),
            (11, 1, 3, 3, 3, 'Most Visited', 1700000000000000, 1700000000000000, 'bm-query0000'),
            (12, 2, NULL, 4, 0, 'a-tag', 1700000000000000, 1700000000000000, 'fd-tag000000'),
            (13, 1, 1, 12, 0, NULL, 1700000000000000, 1700000000000000, 'bm-tagged000'),
            (14, 1, 4, 2, 0, 'Menu link', 1700000000000000, 1700000000000000, 'bm-menu00000');
    ";

    fn fixture_root(profiles_ini: Option<&str>) -> PathBuf {
        let sequence = FIXTURE_SEQUENCE.fetch_add(1, Ordering::Relaxed);
        let root = std::env::temp_dir().join(format!(
            "bookmarktivity-firefox-{}-{sequence}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&root);
        let profile = root.join("Profiles").join("abc123.default-release");
        fs::create_dir_all(&profile).unwrap();
        if let Some(text) = profiles_ini {
            fs::write(root.join("profiles.ini"), text).unwrap();
        }
        let connection = Connection::open(profile.join(DATABASE)).unwrap();
        connection.execute_batch(SCHEMA).unwrap();
        root
    }

    const INI: &str = "[Install4F96D1932A9F858E]\nDefault=Profiles/abc123.default-release\n\n[Profile1]\nName=missing\nIsRelative=1\nPath=Profiles/gone.default\n\n[Profile0]\nName=Research\nIsRelative=1\nPath=Profiles/abc123.default-release\nDefault=1\n\n[General]\nStartWithLastProfile=1\n";

    #[test]
    fn discovers_listed_profiles_that_have_a_bookmark_database() {
        let root = fixture_root(Some(INI));
        let profiles = discover(Some(root.to_str().unwrap())).unwrap();
        assert_eq!(profiles.len(), 1);
        assert_eq!(profiles[0].name, "Research");
        assert_eq!(profiles[0].folder_id, "Profiles/abc123.default-release");
        assert_eq!(profiles[0].browser_id, "firefox");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn discovers_absolute_and_unlisted_profiles() {
        let root = fixture_root(None);
        let scanned = discover(Some(root.to_str().unwrap())).unwrap();
        assert_eq!(scanned.len(), 1);
        assert_eq!(scanned[0].name, "default-release");
        // Pointing at the Profiles folder itself also works.
        let direct = discover(Some(root.join("Profiles").to_str().unwrap())).unwrap();
        assert_eq!(direct[0].folder_id, "abc123.default-release");
        assert_ne!(direct[0].id, scanned[0].id);

        let elsewhere = fixture_root(None);
        let absolute = elsewhere.join("Profiles").join("abc123.default-release");
        fs::write(
            root.join("profiles.ini"),
            format!("[Profile0]\nName=Elsewhere\nIsRelative=0\nPath={}\n", absolute.display()),
        )
        .unwrap();
        let listed = discover(Some(root.to_str().unwrap())).unwrap();
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].name, "Elsewhere");
        assert_eq!(read_discovered(&listed[0]).unwrap().bookmarks.len(), 3);
        fs::remove_dir_all(root).unwrap();
        fs::remove_dir_all(elsewhere).unwrap();
    }

    #[test]
    fn reads_folders_and_bookmarks_without_tags_queries_or_separators() {
        let root = fixture_root(Some(INI));
        let profile = discover(Some(root.to_str().unwrap())).unwrap().remove(0);
        let data = read_profile(&profile.id, Some(root.to_str().unwrap())).unwrap();
        assert!(data.warning.is_none());
        let folders: Vec<_> = data.folders.iter().map(|f| f.name.as_str()).collect();
        assert_eq!(folders, ["Bookmarks Menu", "Bookmarks Toolbar", "Research", "Other Bookmarks"]);
        let bookmarks: Vec<_> = data.bookmarks.iter().map(|b| b.name.as_str()).collect();
        assert_eq!(bookmarks, ["Menu link", "Nested link", "Toolbar link"]);
        assert!(data.folders.iter().take(2).all(|f| f.parent_id.is_none()));
        let research = data.folders.iter().find(|f| f.name == "Research").unwrap();
        let toolbar = data.folders.iter().find(|f| f.name == "Bookmarks Toolbar").unwrap();
        assert_eq!(research.parent_id.as_ref(), Some(&toolbar.id));
        let nested = data.bookmarks.iter().find(|b| b.name == "Nested link").unwrap();
        assert_eq!(nested.parent_id.as_ref(), Some(&research.id));
        assert_eq!(nested.url, "https://example.test/nested");
        assert_eq!(nested.source.profile_id, profile.id);
        let link = data.bookmarks.iter().find(|b| b.name == "Toolbar link").unwrap();
        assert_eq!(link.date_added, Some(1_700_000_002_000));
        assert_eq!(link.date_modified, Some(1_700_000_003_000));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reads_uncheckpointed_changes_while_the_database_is_open_and_leaves_the_profile_untouched() {
        let root = fixture_root(Some(INI));
        let profile_dir = root.join("Profiles").join("abc123.default-release");
        // Stand in for a running Firefox: WAL mode, an open connection, and changes that
        // exist only in the log (including enough rows to grow the database file).
        let firefox = Connection::open(profile_dir.join(DATABASE)).unwrap();
        firefox
            .query_row("PRAGMA journal_mode=WAL", [], |row| row.get::<_, String>(0))
            .unwrap();
        firefox.execute_batch("PRAGMA wal_autocheckpoint=0;").unwrap();
        firefox
            .execute_batch(
                "INSERT INTO moz_places VALUES (50, 'https://example.test/new');
                 INSERT INTO moz_bookmarks VALUES (50, 1, 50, 5, 0, 'Just added', 1700000009000000, 1700000009000000, 'bm-new000000');
                 DELETE FROM moz_bookmarks WHERE id = 14;",
            )
            .unwrap();
        firefox.execute_batch("BEGIN").unwrap();
        for index in 0..400 {
            firefox
                .execute(
                    "INSERT INTO moz_places VALUES (?1, ?2)",
                    (1000 + index, format!("https://example.test/bulk/{index}/{}", "x".repeat(200))),
                )
                .unwrap();
            firefox
                .execute(
                    "INSERT INTO moz_bookmarks VALUES (?1, 1, ?1, 8, ?2, 'Bulk', 1, 1, ?3)",
                    (1000 + index, 10 + index, format!("bulk{index:08}")),
                )
                .unwrap();
        }
        firefox.execute_batch("COMMIT").unwrap();
        // An uncommitted transaction must not be visible.
        firefox
            .execute_batch("BEGIN; INSERT INTO moz_places VALUES (60, 'https://example.test/uncommitted'); INSERT INTO moz_bookmarks VALUES (60, 1, 60, 5, 1, 'Uncommitted', 1, 1, 'bm-uncommit0');")
            .unwrap();

        let listing = |dir: &Path| {
            let mut files: Vec<_> = fs::read_dir(dir)
                .unwrap()
                .map(|entry| {
                    let entry = entry.unwrap();
                    let metadata = entry.metadata().unwrap();
                    (entry.file_name(), metadata.len(), metadata.modified().unwrap())
                })
                .collect();
            files.sort();
            files
        };
        let before = listing(&profile_dir);
        assert!(before.iter().any(|(name, len, _)| name == "places.sqlite-wal" && *len > 0));

        let profile = discover(Some(root.to_str().unwrap())).unwrap().remove(0);
        let data = read_discovered(&profile).unwrap();
        let names: HashSet<_> = data.bookmarks.iter().map(|b| b.name.as_str()).collect();
        assert!(names.contains("Just added"));
        assert!(!names.contains("Menu link"));
        assert!(!names.contains("Uncommitted"));
        assert_eq!(data.bookmarks.len(), 3 + 400);
        assert_eq!(listing(&profile_dir), before);

        // A torn or foreign log tail is ignored rather than applied.
        drop(firefox);
        let mut image = fs::read(profile_dir.join(DATABASE)).unwrap();
        let clean = image.clone();
        apply_wal(&mut image, b"not a write-ahead log, just forty bytes.");
        assert_eq!(image, clean);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_a_file_that_is_not_a_database() {
        let root = fixture_root(Some(INI));
        let profile = discover(Some(root.to_str().unwrap())).unwrap().remove(0);
        fs::write(root.join("Profiles/abc123.default-release").join(DATABASE), b"nope").unwrap();
        assert!(read_discovered(&profile).err().unwrap().contains("not a SQLite file"));
        fs::write(
            root.join("Profiles/abc123.default-release").join(DATABASE),
            [b"SQLite format 3\0".as_slice(), &[0u8; 4096]].concat(),
        )
        .unwrap();
        assert!(read_discovered(&profile).err().unwrap().contains("Cannot read Firefox bookmarks"));
        fs::remove_dir_all(root).unwrap();
    }
}
