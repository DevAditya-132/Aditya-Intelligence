const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('offlineAI', {
  status: () => ipcRenderer.invoke('engine:status'),
  loadHistory: () => ipcRenderer.invoke('history:load'),
  saveHistory: data => ipcRenderer.invoke('history:save', data),
  startChat: data => ipcRenderer.invoke('chat:start', data),
  stopChat: id => ipcRenderer.invoke('chat:stop', id),
  confirmClear: () => ipcRenderer.invoke('dialog:confirm-clear'),
  onStatus: callback => ipcRenderer.on('engine:status', (_e, data) => callback(data)),
  onToken: callback => ipcRenderer.on('chat:token', (_e, data) => callback(data)),
  onDone: callback => ipcRenderer.on('chat:done', (_e, data) => callback(data))
});
