const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  setOpacity: v => ipcRenderer.send('set-opacity', v),
  setPin: on => ipcRenderer.send('set-pin', on),
  chooseSyncFolder: () => ipcRenderer.invoke('choose-sync-folder'),
  syncLoad: () => ipcRenderer.invoke('sync-load'),
  syncSave: payload => ipcRenderer.send('sync-save', payload),
});
