'use strict'

// ── DOM refs ──────────────────────────────────────────────────────────────────
const audio          = document.getElementById('audio')
const albumArtImg    = document.getElementById('album-art')
const artPlaceholder = document.getElementById('art-placeholder')
const trackTitle     = document.getElementById('track-title')
const trackArtist    = document.getElementById('track-artist')
const trackAlbum     = document.getElementById('track-album')
const progressBar    = document.getElementById('progress-bar')
const progressFill   = document.getElementById('progress-fill')
const timeCurrent    = document.getElementById('time-current')
const timeTotal      = document.getElementById('time-total')
const btnPlayPause   = document.getElementById('btn-playpause')
const btnPrev        = document.getElementById('btn-prev')
const btnNext        = document.getElementById('btn-next')
const btnToggleList  = document.getElementById('btn-toggle-list')
const btnShuffle     = document.getElementById('btn-shuffle')
const btnLoop        = document.getElementById('btn-loop')
const btnOpen        = document.getElementById('btn-open')
const volumeSlider   = document.getElementById('volume-slider')
const playlistPanel  = document.getElementById('playlist-panel')
const playlistList   = document.getElementById('playlist-list')
const dropOverlay    = document.getElementById('drop-overlay')

// ── App state ─────────────────────────────────────────────────────────────────
const state = {
  playlist: [],       // Array of track objects: { path, title, artist, album, albumArt, duration, loaded }
  currentIndex: -1,
  shuffle: false,
  loop: false,
  expanded: false,
  shuffleOrder: [],   // indices in shuffle order
  source: null,       // { type: 'folder'|'m3u'|'files', path?, paths? }
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function formatTime(sec) {
  if (!sec || isNaN(sec) || !isFinite(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function basename(p) {
  return p.replace(/\\/g, '/').split('/').pop() || p
}

function stemName(p) {
  const b = basename(p)
  return b.replace(/\.[^.]+$/, '')
}

/** Convert a local filesystem path to a safe file:// URL. */
function fileUrl(filePath) {
  const parts = filePath.replace(/\\/g, '/').split('/')
  const encoded = parts.map((seg, i) => {
    // Preserve empty strings (leading slash) and Windows drive letters
    if (seg === '' || (i === 0 && /^[a-zA-Z]:$/.test(seg))) return seg
    return encodeURIComponent(seg)
  })
  const joined = encoded.join('/')
  return joined.startsWith('/') ? `file://${joined}` : `file:///${joined}`
}

function makeTrack(p) {
  return { path: p, title: null, artist: null, album: null, albumArt: null, duration: null, loaded: false }
}

// Fisher-Yates shuffle, placing currentIdx first
function buildShuffleOrder(len, currentIdx) {
  const order = Array.from({ length: len }, (_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]]
  }
  if (currentIdx >= 0) {
    const pos = order.indexOf(currentIdx)
    if (pos > 0) [order[0], order[pos]] = [order[pos], order[0]]
  }
  return order
}

function getNextIndex(from) {
  const len = state.playlist.length
  if (len === 0) return null
  if (state.shuffle) {
    const pos = state.shuffleOrder.indexOf(from)
    if (pos < state.shuffleOrder.length - 1) return state.shuffleOrder[pos + 1]
    return state.loop ? state.shuffleOrder[0] : null
  }
  if (from < len - 1) return from + 1
  return state.loop ? 0 : null
}

function getPrevIndex(from) {
  const len = state.playlist.length
  if (len === 0) return null
  if (state.shuffle) {
    const pos = state.shuffleOrder.indexOf(from)
    if (pos > 0) return state.shuffleOrder[pos - 1]
    return state.loop ? state.shuffleOrder[state.shuffleOrder.length - 1] : null
  }
  if (from > 0) return from - 1
  return state.loop ? len - 1 : null
}

// ── Metadata ──────────────────────────────────────────────────────────────────
async function ensureMetadata(track) {
  if (track.loaded) return
  const m = await window.minamp.getMetadata(track.path)
  track.title    = m.title
  track.artist   = m.artist
  track.album    = m.album
  track.duration = m.duration
  track.albumArt = m.albumArt
  track.loaded   = true
}

// ── Playback ──────────────────────────────────────────────────────────────────
async function playTrack(index, autoplay = true) {
  if (index < 0 || index >= state.playlist.length) return
  state.currentIndex = index
  const track = state.playlist[index]

  await ensureMetadata(track)
  updateNowPlaying(track)

  audio.src = fileUrl(track.path)
  if (autoplay) {
    audio.play().catch(err => console.warn('Playback error:', err))
  }

  updatePlaylistHighlight()
  prefetchAdjacent(index)
  persistState()
}

function updateNowPlaying(track) {
  trackTitle.textContent  = track.title  || stemName(track.path)
  trackArtist.textContent = track.artist || ''
  trackAlbum.textContent  = track.album  || ''

  if (track.albumArt) {
    albumArtImg.src           = track.albumArt
    albumArtImg.style.display = 'block'
    artPlaceholder.style.display = 'none'
  } else {
    albumArtImg.style.display    = 'none'
    artPlaceholder.style.display = 'block'
  }
}

function prefetchAdjacent(index) {
  const nextIdx = getNextIndex(index)
  if (nextIdx !== null && nextIdx !== index) {
    const next = state.playlist[nextIdx]
    if (!next.loaded) {
      ensureMetadata(next).then(() => refreshListItem(nextIdx))
    }
  }
}

// ── Playlist UI ───────────────────────────────────────────────────────────────
function renderPlaylist() {
  playlistList.innerHTML = ''
  state.playlist.forEach((track, i) => {
    const li   = document.createElement('li')
    li.dataset.index = i

    const num  = document.createElement('span')
    num.className   = 'track-num'
    num.textContent = i + 1

    const name = document.createElement('span')
    name.className   = 'track-name'
    name.textContent = track.title || stemName(track.path)

    const dur  = document.createElement('span')
    dur.className   = 'track-dur'
    dur.textContent = track.duration ? formatTime(track.duration) : ''

    li.append(num, name, dur)
    li.addEventListener('dblclick', () => playTrack(i))
    playlistList.appendChild(li)
  })
  updatePlaylistHighlight()
  loadPlaylistMetadata()
}

function refreshListItem(index) {
  const li = playlistList.querySelector(`[data-index="${index}"]`)
  if (!li) return
  const track = state.playlist[index]
  li.querySelector('.track-name').textContent = track.title || stemName(track.path)
  li.querySelector('.track-dur').textContent  = track.duration ? formatTime(track.duration) : ''
}

function updatePlaylistHighlight() {
  for (const li of playlistList.querySelectorAll('li')) {
    li.classList.toggle('active', parseInt(li.dataset.index) === state.currentIndex)
  }
  const active = playlistList.querySelector('li.active')
  if (active) active.scrollIntoView({ block: 'nearest' })
}

// Load metadata for all tracks in background (batched to avoid flooding IPC)
async function loadPlaylistMetadata() {
  const BATCH = 20
  for (let i = 0; i < state.playlist.length; i += BATCH) {
    const slice = state.playlist.slice(i, i + BATCH)
    await Promise.all(slice.map(async (track, j) => {
      if (!track.loaded) {
        await ensureMetadata(track)
        refreshListItem(i + j)
      }
    }))
    // Yield to event loop between batches
    await new Promise(r => setTimeout(r, 0))
  }
}

// ── Load a set of paths as the active playlist ────────────────────────────────
async function loadFiles(paths, source) {
  if (paths.length === 0) return
  state.playlist     = paths.map(makeTrack)
  state.source       = source
  state.currentIndex = 0
  if (state.shuffle) state.shuffleOrder = buildShuffleOrder(paths.length, 0)

  renderPlaylist()
  await playTrack(0)
}

// ── Open dialog helpers ───────────────────────────────────────────────────────
async function handleOpen(type) {
  const result = await window.minamp.openDialog(type)
  if (!result || result.length === 0) return

  let files  = []
  let source = null

  if (type === 'folder') {
    files  = await window.minamp.readDirectory(result[0])
    source = { type: 'folder', path: result[0] }
  } else if (type === 'm3u') {
    files  = await window.minamp.parseM3u(result[0])
    source = { type: 'm3u', path: result[0] }
  } else {
    files  = result
    source = { type: 'files', paths: result }
  }

  await loadFiles(files, source)
}

function showOpenMenu(anchorEl) {
  const existing = document.getElementById('open-menu')
  if (existing) existing.remove()

  const menu = document.createElement('div')
  menu.id = 'open-menu'

  const rect = anchorEl.getBoundingClientRect()
  // If the anchor is inside a hidden panel, rect dimensions are zero — fall back to bottom-right
  const bottomOffset = rect.height > 0 ? document.body.clientHeight - rect.top + 4 : 14
  Object.assign(menu.style, {
    position:     'fixed',
    bottom:       `${bottomOffset}px`,
    right:        '10px',
    background:   '#252525',
    border:       '1px solid #444',
    borderRadius: '5px',
    zIndex:       '9998',
    overflow:     'hidden',
    fontSize:     '12px',
    minWidth:     '170px',
  })

  const items = [
    { label: '📁  Open Folder…',         type: 'folder' },
    { label: '📋  Open Playlist (M3U)…', type: 'm3u' },
    { label: '🎵  Open File(s)…',        type: 'files' },
  ]

  for (const item of items) {
    const btn = document.createElement('button')
    btn.textContent = item.label
    Object.assign(btn.style, {
      display:    'block',
      width:      '100%',
      padding:    '7px 13px',
      background: 'none',
      border:     'none',
      color:      '#ccc',
      textAlign:  'left',
      cursor:     'pointer',
    })
    btn.addEventListener('mouseenter', () => { btn.style.background = '#333'; btn.style.color = '#fff' })
    btn.addEventListener('mouseleave', () => { btn.style.background = 'none'; btn.style.color = '#ccc' })
    btn.addEventListener('click', () => { menu.remove(); handleOpen(item.type) })
    menu.appendChild(btn)
  }

  document.body.appendChild(menu)

  // Dismiss on outside click
  setTimeout(() => {
    document.addEventListener('click', function dismiss(e) {
      if (!menu.contains(e.target) && e.target !== anchorEl) {
        menu.remove()
        document.removeEventListener('click', dismiss)
      }
    })
  }, 0)
}

// ── State persistence ─────────────────────────────────────────────────────────
function persistState() {
  window.minamp.saveState({
    source:       state.source,
    currentIndex: state.currentIndex,
    shuffle:      state.shuffle,
    loop:         state.loop,
    expanded:     state.expanded,
    volume:       audio.volume,
  })
}

// ── Restore saved state on launch ─────────────────────────────────────────────
async function restoreState(saved) {
  if (!saved) {
    // First launch — ask the user what to open
    setTimeout(() => showOpenMenu(btnOpen), 400)
    return
  }

  // Restore playback settings
  const vol = saved.volume ?? 1
  audio.volume        = vol
  volumeSlider.value  = vol

  state.shuffle  = !!saved.shuffle
  state.loop     = !!saved.loop
  state.expanded = !!saved.expanded

  btnShuffle.classList.toggle('active', state.shuffle)
  btnLoop.classList.toggle('active', state.loop)
  btnToggleList.classList.toggle('active', state.expanded)

  if (state.expanded) {
    playlistPanel.classList.add('visible')
    window.minamp.setExpanded(true)
  }

  if (!saved.source) return

  // Re-read the source to get current contents (folder may have changed)
  let files = []
  const src = saved.source

  if (src.type === 'folder') {
    files = await window.minamp.readDirectory(src.path)
  } else if (src.type === 'm3u') {
    files = await window.minamp.parseM3u(src.path)
  } else if (src.type === 'files' && Array.isArray(src.paths)) {
    files = src.paths
  }

  if (files.length === 0) return

  state.playlist     = files.map(makeTrack)
  state.source       = src
  state.currentIndex = Math.min(saved.currentIndex || 0, files.length - 1)

  if (state.shuffle) {
    state.shuffleOrder = buildShuffleOrder(files.length, state.currentIndex)
  }

  renderPlaylist()

  // Show track info but don't auto-play
  const track = state.playlist[state.currentIndex]
  await ensureMetadata(track)
  updateNowPlaying(track)
  audio.src = fileUrl(track.path)   // prime the audio element
  updatePlaylistHighlight()
}

// ── Audio event handlers ──────────────────────────────────────────────────────
audio.addEventListener('timeupdate', () => {
  if (!audio.duration || isNaN(audio.duration)) return
  const pct = (audio.currentTime / audio.duration) * 100
  progressFill.style.width = pct + '%'
  timeCurrent.textContent  = formatTime(audio.currentTime)
})

audio.addEventListener('loadedmetadata', () => {
  timeTotal.textContent = formatTime(audio.duration)
  // Backfill duration in playlist row if not yet set from metadata
  const track = state.playlist[state.currentIndex]
  if (!track.duration) {
    track.duration = audio.duration
    refreshListItem(state.currentIndex)
  }
})

audio.addEventListener('ended', async () => {
  const idx = getNextIndex(state.currentIndex)
  if (idx !== null) {
    await playTrack(idx)
  } else {
    // End of playlist, no loop
    btnPlayPause.textContent = '▶'
    progressFill.style.width = '0%'
    timeCurrent.textContent  = '0:00'
    audio.currentTime        = 0
  }
})

audio.addEventListener('play',  () => { btnPlayPause.textContent = '⏸' })
audio.addEventListener('pause', () => { btnPlayPause.textContent = '▶' })

// ── Seek ──────────────────────────────────────────────────────────────────────
progressBar.addEventListener('click', e => {
  if (!audio.duration || isNaN(audio.duration)) return
  const rect = progressBar.getBoundingClientRect()
  audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration
})

// ── Volume ────────────────────────────────────────────────────────────────────
volumeSlider.addEventListener('input', () => {
  audio.volume = parseFloat(volumeSlider.value)
  persistState()
})

// ── Control buttons ───────────────────────────────────────────────────────────
btnPlayPause.addEventListener('click', () => {
  if (state.playlist.length === 0) { showOpenMenu(btnOpen); return }
  if (audio.paused) audio.play().catch(() => {})
  else audio.pause()
})

btnPrev.addEventListener('click', async () => {
  if (audio.currentTime > 3) { audio.currentTime = 0; return }
  const idx = getPrevIndex(state.currentIndex)
  if (idx !== null) await playTrack(idx)
})

btnNext.addEventListener('click', async () => {
  const idx = getNextIndex(state.currentIndex)
  if (idx !== null) await playTrack(idx)
})

btnShuffle.addEventListener('click', () => {
  state.shuffle = !state.shuffle
  btnShuffle.classList.toggle('active', state.shuffle)
  if (state.shuffle) state.shuffleOrder = buildShuffleOrder(state.playlist.length, state.currentIndex)
  persistState()
})

btnLoop.addEventListener('click', () => {
  state.loop = !state.loop
  btnLoop.classList.toggle('active', state.loop)
  persistState()
})

btnToggleList.addEventListener('click', () => {
  state.expanded = !state.expanded
  playlistPanel.classList.toggle('visible', state.expanded)
  btnToggleList.classList.toggle('active', state.expanded)
  window.minamp.setExpanded(state.expanded)
  persistState()
})

btnOpen.addEventListener('click', () => showOpenMenu(btnOpen))

// ── Window chrome ─────────────────────────────────────────────────────────────
document.getElementById('btn-minimize').addEventListener('click', () => window.minamp.minimizeWindow())
document.getElementById('btn-close').addEventListener('click',    () => window.minamp.closeWindow())

// ── Drag and drop ─────────────────────────────────────────────────────────────
const AUDIO_EXTS = new Set(['.mp3', '.flac', '.ogg', '.wav', '.m4a', '.aac', '.opus', '.wma'])
const M3U_EXTS   = new Set(['.m3u', '.m3u8'])

document.addEventListener('dragover', e => {
  e.preventDefault()
  dropOverlay.classList.add('visible')
})

document.addEventListener('dragleave', e => {
  if (!e.relatedTarget || !document.body.contains(e.relatedTarget)) {
    dropOverlay.classList.remove('visible')
  }
})

document.addEventListener('drop', async e => {
  e.preventDefault()
  dropOverlay.classList.remove('visible')

  const files  = Array.from(e.dataTransfer.files)
  if (files.length === 0) return

  let tracks = []
  let source = null

  for (const f of files) {
    const ext = '.' + (f.name.split('.').pop() || '').toLowerCase()

    if (M3U_EXTS.has(ext)) {
      const parsed = await window.minamp.parseM3u(f.path)
      tracks.push(...parsed)
      source = { type: 'm3u', path: f.path }

    } else if (AUDIO_EXTS.has(ext)) {
      tracks.push(f.path)

    } else if (f.type === '' && f.size === 0) {
      // Likely a folder (Electron exposes folder drops this way)
      const dirTracks = await window.minamp.readDirectory(f.path)
      tracks.push(...dirTracks)
      source = { type: 'folder', path: f.path }
    }
  }

  if (tracks.length > 0) {
    if (!source) source = { type: 'files', paths: tracks }
    await loadFiles(tracks, source)
  }
})

// ── IPC from main process ─────────────────────────────────────────────────────
window.minamp.onMenuAction(action => {
  if (action === 'open-folder') handleOpen('folder')
  else if (action === 'open-m3u')   handleOpen('m3u')
  else if (action === 'open-files') handleOpen('files')
})

window.minamp.onOsOpenFile(async filePath => {
  const ext = ('.' + filePath.split('.').pop()).toLowerCase()
  if (M3U_EXTS.has(ext)) {
    const tracks = await window.minamp.parseM3u(filePath)
    await loadFiles(tracks, { type: 'm3u', path: filePath })
  } else if (AUDIO_EXTS.has(ext)) {
    await loadFiles([filePath], { type: 'files', paths: [filePath] })
  }
})

window.minamp.onInitialState(saved => restoreState(saved))
