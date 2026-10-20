# Bookmarktivity 0.3.0 (test release)

Bookmarktivity is a desktop workspace for finding and navigating bookmarks from selected local Microsoft Edge profiles. It keeps each bookmark's browser and profile visible and reads Edge bookmark files without modifying them.

## What's new since the 0.2 implementation

- Folder results now start collapsed. Expanding a folder reveals its immediate contents while child folders remain collapsed.
- Expand or collapse an entire folder branch from its context menu or configurable keyboard shortcut.
- Show or hide total bookmark counts for folders, including bookmarks in descendants.
- Resize or hide the folder and details sidebars to make more room for results.
- Switch between light and dark appearance from the main toolbar; the choice is remembered.
- Settings now separates local Edge profiles and keyboard shortcuts into tabs. Shortcut capture, focus behavior, and the details sidebar received fixes.

## Scope

- Microsoft Edge local profiles are the only browser source in this release.
- Only profiles you enable are read into the workspace. Bookmarktivity does not edit Edge bookmarks or sync profiles.
- Bookmark links open in your system default browser.

## Downloads

Choose the file for your operating system and CPU architecture from the assets below. The macOS DMG contains the app to drag into Applications; the Windows EXE runs the installer.

## Installation status

These builds are for testing. The macOS app is ad-hoc signed and not notarized; macOS may require explicit approval to open it after download. The Windows installer is unsigned and can trigger Microsoft Defender SmartScreen, especially on managed PCs. Installation and runtime behavior still need validation on the release platforms.
