const fs = require("node:fs/promises");
const path = require("node:path");
const { safeStorage } = require("electron");

const DEFAULT_API_URL = "https://confeitariarenascer.vercel.app";
const TOKEN_PATTERN = /^rbg_[A-Za-z0-9_-]{40,80}$/;

function normalizeApiUrl(value) {
  const candidate = String(value || DEFAULT_API_URL).trim().replace(/\/+$/, "");
  const parsed = new URL(candidate);
  const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) {
    throw new Error("A URL do Renascer deve usar HTTPS.");
  }
  return parsed.toString().replace(/\/$/, "");
}

class ConfigStore {
  constructor(userDataPath) {
    this.filePath = path.join(userDataPath, "bridge-config.json");
  }

  async readRaw() {
    try {
      return JSON.parse(await fs.readFile(this.filePath, "utf8"));
    } catch (error) {
      if (error?.code === "ENOENT") return {};
      throw error;
    }
  }

  async getPrivateConfig() {
    const raw = await this.readRaw();
    let token = null;
    if (raw.encryptedToken) {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error("A criptografia segura do Windows não está disponível para ler o token do Bridge.");
      }
      token = safeStorage.decryptString(Buffer.from(raw.encryptedToken, "base64"));
    }
    return {
      apiUrl: normalizeApiUrl(raw.apiUrl || DEFAULT_API_URL),
      token,
      configured: Boolean(token),
    };
  }

  async getPublicConfig() {
    const config = await this.getPrivateConfig();
    return {
      apiUrl: config.apiUrl,
      configured: config.configured,
      shortcut: "Ctrl + Alt + R",
      gemasterAdapter: "Aguardando homologação local",
    };
  }

  async save({ apiUrl, token }) {
    const current = await this.readRaw();
    const normalizedUrl = normalizeApiUrl(apiUrl || current.apiUrl || DEFAULT_API_URL);
    const normalizedToken = String(token || "").trim();
    let encryptedToken = current.encryptedToken || null;

    if (normalizedToken) {
      if (!TOKEN_PATTERN.test(normalizedToken)) throw new Error("Token do dispositivo Bridge inválido.");
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error("A criptografia segura do Windows não está disponível. O token não será salvo em texto puro.");
      }
      encryptedToken = safeStorage.encryptString(normalizedToken).toString("base64");
    }

    if (!encryptedToken) throw new Error("Informe o token do dispositivo Bridge.");

    const next = { version: 1, apiUrl: normalizedUrl, encryptedToken, updatedAt: new Date().toISOString() };
    const tempPath = `${this.filePath}.tmp`;
    await fs.writeFile(tempPath, `${JSON.stringify(next, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await fs.rename(tempPath, this.filePath);
    return this.getPublicConfig();
  }
}

module.exports = { ConfigStore, DEFAULT_API_URL };
