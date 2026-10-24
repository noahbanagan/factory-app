// Bridge between the CAM page and the desktop shell. Only these functions are exposed to the page.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  version: () => ipcRenderer.invoke('app:version'),
  saveFile: (name, text) => ipcRenderer.invoke('fs:save', {name, text}),
  openFile: (filters) => ipcRenderer.invoke('fs:open', {filters}),
  auth: {
    status: () => ipcRenderer.invoke('auth:status'),
    setClient: (clientId, clientSecret) => ipcRenderer.invoke('auth:setClient', {clientId, clientSecret}),
    signIn: () => ipcRenderer.invoke('auth:signIn'),
    token: () => ipcRenderer.invoke('auth:token'),
    signOut: () => ipcRenderer.invoke('auth:signOut')
  },
  update: { check: () => ipcRenderer.invoke('update:check') },
  onUpdate: (cb) => ipcRenderer.on('update:event', (_, e) => cb(e))
});
