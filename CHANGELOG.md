# Changelog

All notable changes to MinAmp are documented here.
Increment the patch version in `package.json` with every change (e.g. `0.1.0` → `0.1.1`, `0.1.9` → `0.1.10`).

---

## [0.1.4] — 2026-04-10

- Double-clicking the album art (or placeholder) opens an About dialog showing the app name, tagline, and version

## [0.1.3] — 2026-04-10

- Album art placeholder now shows a green music note (♫) instead of an empty grey box

## [0.1.2] — 2026-04-06

- Folder scan now also checks sub-folders recurisvely
- Improved media key support

## [0.1.1] — 2026-04-04

Initial release.

- Plays MP3, FLAC, OGG, WAV, M4A, AAC, Opus, and WMA files
- Displays title, artist, album, and album art from ID3/tag metadata
- Folder and M3U/M3U8 playlist support
- Expandable playlist panel with shuffle (Fisher-Yates) and loop modes
- Drag-and-drop files, folders, or playlists onto the window
- OS file-association support (double-click audio/playlist files to open in MinAmp)
- Remembers last source, track position, volume, shuffle/loop state between sessions
- Custom frameless window with minimize/close controls
- Builds for macOS (DMG arm64+x64), Windows (NSIS x64), Linux (AppImage x64+arm64)