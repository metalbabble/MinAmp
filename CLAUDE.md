# MinAmp — Claude Context

## Project Overview

MinAmp is a lightweight cross-platform desktop audio player built with Electron. It has no backend server — it's a pure Electron app with a main process, a preload bridge, and a renderer frontend.

## Architecture

```
main.js        — Electron main process: window creation, native menus, IPC handlers
preload.js     — contextBridge (security boundary between main and renderer)
renderer/
  index.html   — Static UI markup (frameless window, custom titlebar)
  renderer.js  — All UI logic, playback state, playlist management
  styles.css   — Dark theme styles
package.json   — electron-builder config, version, build targets
```

### Process Communication (IPC)

`preload.js` exposes a `window.minamp` API to the renderer via `contextBridge`. The renderer never has direct Node.js access — all filesystem/dialog operations go through IPC:

| Method | Direction | Purpose |
|---|---|---|
| `openDialog(type)` | invoke | Native file/folder picker |
| `readDirectory(path)` | invoke | List audio files in a folder |
| `parseM3u(path)` | invoke | Parse an M3U playlist |
| `getMetadata(path)` | invoke | Read ID3/tags via `music-metadata` |
| `saveState(state)` | send | Persist playback state to disk |
| `setExpanded(bool)` | send | Resize the window (compact ↔ expanded) |
| `minimizeWindow()` | send | Minimize |
| `closeWindow()` | send | Close |
| `onInitialState(cb)` | listener | Receive persisted state on load |
| `onMenuAction(cb)` | listener | Native menu → renderer actions |
| `onOsOpenFile(cb)` | listener | OS file association / dock drop |

### Window Sizing

The window is fixed-width (`420px`) and has two heights:
- **Compact** (`178px`): player controls only
- **Expanded** (`478px`): player + playlist panel

Height is toggled via `ipcMain` → `win.setMinimumSize` / `win.setMaximumSize` / `win.setSize`.

### State Persistence

App state is saved to `minamp-state.json` in the Electron `userData` directory (`app.getPath('userData')`). It stores: `source`, `currentIndex`, `shuffle`, `loop`, `expanded`, `volume`. On launch, state is restored and the playlist is re-read from the original source (so folder contents stay current).

### Supported Formats

Audio: `mp3`, `flac`, `ogg`, `wav`, `m4a`, `aac`, `opus`, `wma`
Playlists: `m3u`, `m3u8`

### Dependencies

- `music-metadata` — ID3/tag parsing (ESM, dynamically imported in main process)
- `electron` (dev) — runtime
- `electron-builder` (dev) — packaging/distribution

## Versioning

The version is set in `package.json` → `"version"`. `electron-builder` reads this to name build artifacts.

**When making any change:** increment the patch version (third number) in `package.json` and add an entry to `CHANGELOG.md`. Examples: `0.1.0` → `0.1.1`, `0.1.9` → `0.1.10`.

## Build Commands

```bash
npm start              # run in dev
npm run build:mac      # .dmg (arm64 + x64)
npm run build:win      # .exe NSIS installer (x64)
npm run build:linux    # .AppImage (x64)
npm run build:linux:arm # .AppImage (arm64)
npm run build:all      # all platforms
```

Builds land in `dist/`.
