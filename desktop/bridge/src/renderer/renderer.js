const quickPanel = document.getElementById("quickPanel");
const settingsPanel = document.getElementById("settingsPanel");
const codeInput = document.getElementById("codeInput");
const commandPrefix = document.getElementById("commandPrefix");
const submitButton = document.getElementById("submitButton");
const message = document.getElementById("message");
const closeButton = document.getElementById("closeButton");
const settingsButton = document.getElementById("settingsButton");
const apiUrl = document.getElementById("apiUrl");
const deviceToken = document.getElementById("deviceToken");
const saveSettings = document.getElementById("saveSettings");
const cancelSettings = document.getElementById("cancelSettings");
const hotkeyStatus = document.getElementById("hotkeyStatus");
const adapterStatus = document.getElementById("adapterStatus");
const connectionLabel = document.getElementById("connectionLabel");
let busy = false;
let configured = false;

function setMessage(text, state = "idle") { message.textContent = text; message.dataset.state = state; }
function updatePrefix() {
  const value = codeInput.value.trim().toUpperCase();
  commandPrefix.dataset.hidden = value.startsWith("DV") || value.startsWith("C") ? "true" : "false";
}
function focusCode() { if (settingsPanel.hidden) { codeInput.focus(); codeInput.select(); } }
function showSettings() { window.renascerBridge.setMode("settings"); quickPanel.hidden = true; settingsPanel.hidden = false; deviceToken.value = ""; apiUrl.focus(); }
function hideSettings() { if (!configured) return; window.renascerBridge.setMode("quick"); settingsPanel.hidden = true; quickPanel.hidden = false; focusCode(); }

async function refreshConfig() {
  try {
    const config = await window.renascerBridge.getConfig();
    configured = Boolean(config.configured);
    apiUrl.value = config.apiUrl || "";
    hotkeyStatus.textContent = config.hotkeyRegistered ? "✓ Atalho Ctrl + Alt + R ativo" : "⚠ Atalho Ctrl + Alt + R indisponível neste computador";
    adapterStatus.textContent = config.adapter?.label || config.gemasterAdapter || "GeMaster não configurado";
    connectionLabel.textContent = configured ? "Dispositivo configurado" : "Configuração necessária";
    if (!configured) showSettings();
  } catch { configured = false; connectionLabel.textContent = "Falha de configuração"; showSettings(); }
}

async function submit() {
  if (busy) return;
  if (!configured) { showSettings(); return; }
  busy = true;
  submitButton.disabled = true;
  setMessage("Consultando a comanda no Renascer...", "working");
  try {
    const result = await window.renascerBridge.submitCode(codeInput.value);
    setMessage(result.message, result.state === "injected" ? "success" : "working");
    if (result.autoHide) {
      codeInput.value = "";
      updatePrefix();
      setTimeout(() => window.renascerBridge.hide(), 900);
    } else codeInput.select();
  } catch (error) {
    setMessage(error?.message || "Não foi possível processar a comanda.", "error");
    codeInput.select();
  } finally { busy = false; submitButton.disabled = false; }
}

async function saveConfig() {
  saveSettings.disabled = true;
  try {
    const result = await window.renascerBridge.saveConfig({ apiUrl: apiUrl.value, token: deviceToken.value });
    configured = Boolean(result.config?.configured);
    deviceToken.value = "";
    connectionLabel.textContent = "Dispositivo configurado";
    settingsPanel.hidden = true;
    quickPanel.hidden = false;
    setMessage("Configuração salva. Digite uma comanda para testar.", "success");
    await refreshConfig();
    hideSettings();
  } catch (error) {
    alert(error?.message || "Não foi possível salvar a configuração.");
  } finally { saveSettings.disabled = false; }
}

codeInput.addEventListener("input", updatePrefix);
codeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") { event.preventDefault(); submit(); }
  if (event.key === "Escape") window.renascerBridge.hide();
});
submitButton.addEventListener("click", submit);
closeButton.addEventListener("click", () => window.renascerBridge.hide());
settingsButton.addEventListener("click", showSettings);
saveSettings.addEventListener("click", saveConfig);
cancelSettings.addEventListener("click", hideSettings);
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !settingsPanel.hidden) hideSettings(); });
window.renascerBridge.onFocusEntry(focusCode);
window.renascerBridge.onShowSettings(showSettings);
refreshConfig().then(focusCode);
