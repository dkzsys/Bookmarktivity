# Shared Chromium bookmark reader

This Rust crate discovers profile folders within a browser adapter's selected user-data directory and reads `Bookmarks` and `AccountBookmarks` JSON from a selected profile. It assigns source and node IDs that remain distinct across browsers, user-data directories, profiles, and storage files. A clear-text file with an encrypted counterpart is loaded with a possible-staleness warning; an encrypted-only store fails the profile read. Browser files are never written, and tests use synthetic data.
