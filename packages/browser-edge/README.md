# Microsoft Edge integration

This Rust crate discovers Edge profiles in platform-specific or user-configured user-data directories and reads the selected profile's Bookmarks JSON. The Tauri host checks that a profile is enabled before invoking the reader. Records retain Edge and profile identity; browser files are never written. Tests create synthetic profile directories. Any write-back still needs a recorded safety and recovery design.
