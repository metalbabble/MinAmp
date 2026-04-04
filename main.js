const { app, BrowserWindow, ipcMain, dialog, Menu, globalShortcut } = require('electron')
const path = require('path')
const fs = require('fs')

const COMPACT_HEIGHT = 178
const EXPANDED_HEIGHT = 478
const WINDOW_WIDTH = 420

let win
let mmParseFile = null
let pendingOpenPath = null  // queued before window is ready

async function getParseFile() {
  if (!mmParseFile) {
    const mm = await import('music-metadata')
    mmParseFile = mm.parseFile
  }
  return mmParseFile
}

const STATE_PATH = path.join(app.getPath('userData'), 'minamp-state.json')

function loadState() {
  try {
    if (fs.existsSync(STATE_PATH)) {
      return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'))
    }
  } catch {}
  return null
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_PATH, JSON.stringify(state))
  } catch {}
}

function createWindow() {
  win = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: COMPACT_HEIGHT,
    minWidth: WINDOW_WIDTH,
    maxWidth: WINDOW_WIDTH,
    frame: false,
    backgroundColor: '#1a1a1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  })

  win.setMinimumSize(WINDOW_WIDTH, COMPACT_HEIGHT)
  win.setMaximumSize(WINDOW_WIDTH, COMPACT_HEIGHT)
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'))

  const menu = Menu.buildFromTemplate([
    {
      label: 'MinAmp',
      submenu: [
        { label: 'Open Folder…', click: () => win.webContents.send('menu-action', 'open-folder') },
        { label: 'Open Playlist (M3U)…', click: () => win.webContents.send('menu-action', 'open-m3u') },
        { label: 'Open File(s)…', click: () => win.webContents.send('menu-action', 'open-files') },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [{ role: 'cut' }, { role: 'copy' }, { role: 'paste' }]
    }
  ])
  Menu.setApplicationMenu(menu)
}

app.whenReady().then(() => {
  // Windows / Linux: file/folder passed as CLI argument
  if (process.platform !== 'darwin') {
    const args = process.argv.slice(app.isPackaged ? 1 : 2)
    const pathArg = args.find(a => !a.startsWith('-'))
    if (pathArg) pendingOpenPath = pathArg
  }

  createWindow()

  globalShortcut.register('MediaPlayPause',     () => win.webContents.send('media-key', 'playpause'))
  globalShortcut.register('MediaNextTrack',     () => win.webContents.send('media-key', 'next'))
  globalShortcut.register('MediaPreviousTrack', () => win.webContents.send('media-key', 'previous'))

  win.webContents.on('did-finish-load', () => {
    win.webContents.send('initial-state', loadState())
    if (pendingOpenPath) {
      win.webContents.send('os-open-file', pendingOpenPath)
      pendingOpenPath = null
    }
  })
})

app.on('will-quit', () => globalShortcut.unregisterAll())

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// macOS: file/folder opened via Finder / dock drop
app.on('open-file', (event, filePath) => {
  event.preventDefault()
  if (win) {
    win.webContents.send('os-open-file', filePath)
  } else {
    pendingOpenPath = filePath  // app not ready yet; deliver after window loads
  }
})

// IPC -------------------------------------------------------------------

ipcMain.handle('open-dialog', async (_, type) => {
  let properties, filters

  if (type === 'folder') {
    properties = ['openDirectory']
    filters = []
  } else if (type === 'm3u') {
    properties = ['openFile']
    filters = [{ name: 'Playlists', extensions: ['m3u', 'm3u8'] }]
  } else {
    properties = ['openFile', 'multiSelections']
    filters = [{ name: 'Audio', extensions: ['mp3', 'flac', 'ogg', 'wav', 'm4a', 'aac', 'opus', 'wma'] }]
  }

  const result = await dialog.showOpenDialog(win, { properties, filters })
  return result.canceled ? null : result.filePaths
})

const AUDIO_EXTS = new Set(['.mp3', '.flac', '.ogg', '.wav', '.m4a', '.aac', '.opus', '.wma'])

ipcMain.handle('read-directory', (_, dirPath) => {
  try {
    return fs.readdirSync(dirPath)
      .filter(f => AUDIO_EXTS.has(path.extname(f).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
      .map(f => path.join(dirPath, f))
  } catch { return [] }
})

ipcMain.handle('parse-m3u', (_, filePath) => {
  const dir = path.dirname(filePath)
  try {
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
    const tracks = []
    for (const line of lines) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const resolved = path.isAbsolute(t) ? t : path.resolve(dir, t)
      if (fs.existsSync(resolved)) tracks.push(resolved)
    }
    return tracks
  } catch { return [] }
})

ipcMain.handle('get-metadata', async (_, filePath) => {
  try {
    const parseFile = await getParseFile()
    const meta = await parseFile(filePath, { duration: true, skipCovers: false })
    const c = meta.common
    let albumArt = null
    if (c.picture && c.picture.length > 0) {
      const pic = c.picture[0]
      albumArt = `data:${pic.format};base64,${Buffer.from(pic.data).toString('base64')}`
    }
    return {
      title: c.title || null,
      artist: c.artist || null,
      album: c.album || null,
      duration: meta.format.duration || null,
      albumArt
    }
  } catch {
    return { title: null, artist: null, album: null, duration: null, albumArt: null }
  }
})

ipcMain.on('save-state', (_, state) => saveState(state))

ipcMain.on('set-expanded', (_, expanded) => {
  if (!win) return
  const h = expanded ? EXPANDED_HEIGHT : COMPACT_HEIGHT
  win.setMinimumSize(WINDOW_WIDTH, h)
  win.setMaximumSize(WINDOW_WIDTH, h)
  win.setSize(WINDOW_WIDTH, h)
})

ipcMain.on('minimize-window', () => win && win.minimize())
ipcMain.on('close-window', () => win && win.close())
