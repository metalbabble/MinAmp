# MinAmp

A lightweight, cross-platform audio player built with Electron. Inspired by the simplicity of classic media players.

![screenshot.png](screenshot.png)

## Features

- Plays MP3, FLAC, OGG, WAV, M4A, AAC, Opus, and WMA files
- Displays track title, artist, album, and album art from ID3/metadata tags
- Folder and M3U playlist support
- Expandable playlist view with shuffle and loop
- Drag-and-drop files, folders, or playlists onto the window
- Remembers the last loaded source and track position between sessions

## Requirements

- [Node.js](https://nodejs.org/) (v18 or later)

## Getting Started

```bash
npm install
npm start
```

## Usage

### Opening music

- **On first launch**, an open menu appears automatically — choose a folder, M3U playlist, or individual files.
- **Drag and drop** a folder, M3U file, or audio files directly onto the window at any time.
- **App menu** (MinAmp → Open Folder / Open Playlist / Open File(s)) works from the menu bar.
- **Playlist panel** has its own Open… button.

### Controls

| Control | Action |
|---------|--------|
| ▶ / ⏸ | Play / Pause |
| ⏮ | Previous track (or restart current if >3 s in) |
| ⏭ | Next track |
| Seek bar | Click anywhere to jump |
| Volume | Drag the slider |
| ☰ | Toggle playlist panel |

### Playlist panel

Click **☰** to expand the window and reveal the track list. From here you can:

- **Double-click** any track to play it immediately
- Toggle **Shuffle** (Fisher-Yates order, current track plays first)
- Toggle **Loop** (restarts playlist from the beginning when the last track ends)

## Project Structure

```
MinAmp/
├── main.js          # Electron main process, IPC handlers, metadata via music-metadata
├── preload.js       # Secure contextBridge IPC bridge
└── renderer/
    ├── index.html   # UI markup
    ├── renderer.js  # Playback logic, UI state, drag-and-drop
    └── styles.css   # Dark theme
```

## License

MIT
