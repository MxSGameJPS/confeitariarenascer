const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("renascerBridge", {
  getConfig: () => ipcRenderer.invoke("bridge:get-config"),
  saveConfig: (input) => ipcRenderer.invoke("bridge:save-config", input),
  submitCode: (value) => ipcRenderer.invoke("bridge:submit-code", value),
  hide: () => ipcRenderer.send("bridge:hide"),
  openSettings: () => ipcRenderer.send("bridge:open-settings"),
  setMode: (mode) => ipcRenderer.send("bridge:set-mode", mode),
  onFocusEntry: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("bridge:focus-entry", listener);
    return () => ipcRenderer.removeListener("bridge:focus-entry", listener);
  },
  onShowSettings: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("bridge:show-settings", listener);
    return () => ipcRenderer.removeListener("bridge:show-settings", listener);
  },
});
