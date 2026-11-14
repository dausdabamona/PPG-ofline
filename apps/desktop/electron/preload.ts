// Preload (sandbox, contextIsolation): hanya mengekspos API IPC minimal ke renderer.
import { contextBridge, ipcRenderer } from 'electron'
import { KANAL, type ApiDesktop } from './api'

const api: ApiDesktop = {
  muatDb: () => ipcRenderer.invoke(KANAL.muatDb),
  simpanDb: (bytes) => ipcRenderer.invoke(KANAL.simpanDb, bytes),
  bukaBanyak: (filter, banyak = true) => ipcRenderer.invoke(KANAL.bukaBanyak, filter, banyak),
  simpanBerkas: (namaSaran, bytes) => ipcRenderer.invoke(KANAL.simpanBerkas, namaSaran, bytes),
  simpanKeFolder: (daftar) => ipcRenderer.invoke(KANAL.simpanKeFolder, daftar),
  folderData: () => ipcRenderer.invoke(KANAL.folderData),
  saatAkanTutup: (fn) => {
    ipcRenderer.removeAllListeners(KANAL.akanTutup)
    ipcRenderer.on(KANAL.akanTutup, () => {
      fn()
        .catch(() => undefined)
        .finally(() => ipcRenderer.send(KANAL.siapTutup))
    })
  },
}

contextBridge.exposeInMainWorld('ppgAdmin', api)
