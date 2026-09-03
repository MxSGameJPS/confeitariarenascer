const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, Tray } = require("electron");
const { BackendClient } = require("./backend-client");
const { ConfigStore } = require("./config-store");
const { normalizeBridgeCode } = require("./code-normalizer");
const { createGemasterAdapter } = require("./gemaster/adapter");

const HOTKEY = "CommandOrControl+Alt+R";
let quickWindow = null;
let tray = null;
let quitting = false;
let configStore = null;
let backendClient = null;
let gemasterAdapter = null;
let hotkeyRegistered = false;
const operationByCode = new Map();

function createBrandImage(size = 32) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#2d6a4f"/><path d="M9 24V8h8.1c4 0 6.5 2.1 6.5 5.4 0 2.4-1.3 4.1-3.6 4.9L24 24h-5.2l-3.2-5H14v5H9zm5-9h2.8c1.3 0 2-.5 2-1.6 0-1-.7-1.5-2-1.5H14V15z" fill="white"/></svg>`;
  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`);
}

function sendFocus() {
  if (!quickWindow || quickWindow.isDestroyed()) return;
  quickWindow.webContents.send("bridge:focus-entry");
}

function setWindowMode(mode) {
  if (!quickWindow || quickWindow.isDestroyed()) return;
  const height = mode === "settings" ? 390 : 300;
  quickWindow.setSize(440, height, true);
}

function showQuickWindow({ settings = false } = {}) {
  if (!quickWindow || quickWindow.isDestroyed()) return;
  setWindowMode(settings ? "settings" : "quick");
  quickWindow.show();
  quickWindow.setAlwaysOnTop(true, "pop-up-menu");
  quickWindow.focus();
  if (settings) quickWindow.webContents.send("bridge:show-settings");
  else sendFocus();
}

function hideQuickWindow() {
  if (quickWindow && !quickWindow.isDestroyed()) quickWindow.hide();
}

function createWindow() {
  quickWindow = new BrowserWindow({
    width: 440,
    height: 300,
    minWidth: 400,
    minHeight: 260,
    show: false,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: "#f7f2eb",
    icon: createBrandImage(64),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged,
    },
  });

  quickWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  quickWindow.on("close", (event) => {
    if (quitting) return;
    event.preventDefault();
    hideQuickWindow();
  });
  quickWindow.webContents.on("did-finish-load", async () => {
    const config = await configStore.getPublicConfig().catch(() => ({ configured: false }));
    if (!config.configured && !process.argv.includes("--background")) showQuickWindow({ settings: true });
  });
}

function createTray() {
  tray = new Tray(createBrandImage(20).resize({ width: 20, height: 20 }));
  tray.setToolTip("Renascer Bridge");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Abrir Renascer Bridge", click: () => showQuickWindow() },
    { label: "Configurações", click: () => showQuickWindow({ settings: true }) },
    { type: "separator" },
    { label: hotkeyRegistered ? "Atalho: Ctrl + Alt + R" : "Atalho indisponível", enabled: false },
    { label: gemasterAdapter.getStatus().label, enabled: false },
    { type: "separator" },
    { label: "Sair", click: () => { quitting = true; app.quit(); } },
  ]));
  tray.on("double-click", () => showQuickWindow());
}

function registerHotkey() {
  hotkeyRegistered = globalShortcut.register(HOTKEY, () => showQuickWindow());
}

function registerIpc() {
  ipcMain.handle("bridge:get-config", async () => ({
    ...(await configStore.getPublicConfig()),
    hotkeyRegistered,
    adapter: gemasterAdapter.getStatus(),
  }));

  ipcMain.handle("bridge:save-config", async (_event, input) => {
    const saved = await configStore.save(input || {});
    return { ok: true, config: saved };
  });

  ipcMain.handle("bridge:submit-code", async (_event, input) => {
    const code = normalizeBridgeCode(input);
    const operationId = operationByCode.get(code) || randomUUID();
    operationByCode.set(code, operationId);
    const dispatch = await backendClient.resolve(code, operationId);
    const injection = await gemasterAdapter.inject(dispatch);

    if (injection.state === "injected") {
      await backendClient.updateDispatch(dispatch.dispatch_id, "injected");
      operationByCode.delete(code);
      return { ok: true, state: "injected", code, message: `${code} enviada ao GeMaster.`, autoHide: true };
    }

    return { ok: true, state: injection.state, code, message: injection.message, autoHide: false };
  });

  ipcMain.on("bridge:hide", hideQuickWindow);
  ipcMain.on("bridge:open-settings", () => showQuickWindow({ settings: true }));
  ipcMain.on("bridge:set-mode", (_event, mode) => setWindowMode(mode === "settings" ? "settings" : "quick"));
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => showQuickWindow());
  app.whenReady().then(() => {
    configStore = new ConfigStore(app.getPath("userData"));
    backendClient = new BackendClient(() => configStore.getPrivateConfig());
    gemasterAdapter = createGemasterAdapter();
    registerHotkey();
    registerIpc();
    createWindow();
    createTray();

    if (app.isPackaged) {
      app.setLoginItemSettings({ openAtLogin: true, path: process.execPath, args: ["--background"] });
    }

    if (!process.argv.includes("--background")) {
      configStore.getPublicConfig().then((config) => {
        if (config.configured) showQuickWindow();
      }).catch(() => showQuickWindow({ settings: true }));
    }
  });
}

app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => {});
