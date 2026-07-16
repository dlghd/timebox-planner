const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  setOpacity: v => ipcRenderer.send('set-opacity', v),
  setPin: on => ipcRenderer.send('set-pin', on),
});
