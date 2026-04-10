const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('minamp', {
  getVersion:     ()     => ipcRenderer.invoke('get-version'),
  openDialog:     (type) => ipcRenderer.invoke('open-dialog', type),
  readDirectory:  (p)    => ipcRenderer.invoke('read-directory', p),
  parseM3u:       (p)    => ipcRenderer.invoke('parse-m3u', p),
  getMetadata:    (p)    => ipcRenderer.invoke('get-metadata', p),
  saveState:      (s)    => ipcRenderer.send('save-state', s),
  setExpanded:    (e)    => ipcRenderer.send('set-expanded', e),
  minimizeWindow: ()     => ipcRenderer.send('minimize-window'),
  closeWindow:    ()     => ipcRenderer.send('close-window'),

  onInitialState: (cb) => ipcRenderer.on('initial-state', (_, s) => cb(s)),
  onMenuAction:   (cb) => ipcRenderer.on('menu-action',   (_, a) => cb(a)),
  onOsOpenFile:   (cb) => ipcRenderer.on('os-open-file',  (_, p) => cb(p)),
  onMediaKey:     (cb) => ipcRenderer.on('media-key',     (_, a) => cb(a)),
})
