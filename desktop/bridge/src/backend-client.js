class BridgeApiError extends Error {
  constructor(message, { status = 0, code = "BRIDGE_API_ERROR" } = {}) {
    super(message);
    this.name = "BridgeApiError";
    this.status = status;
    this.code = code;
  }
}

class BackendClient {
  constructor(configProvider) { this.configProvider = configProvider; }

  async request(path, { method = "GET", body } = {}) {
    const config = await this.configProvider();
    if (!config.token) throw new BridgeApiError("Configure o token do Renascer Bridge antes de usar.", { code: "NOT_CONFIGURED" });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`${config.apiUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${config.token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new BridgeApiError(payload?.error?.message || `Falha HTTP ${response.status}.`, {
          status: response.status,
          code: payload?.error?.code || "BRIDGE_API_ERROR",
        });
      }
      return payload?.data ?? payload;
    } catch (error) {
      if (error?.name === "AbortError") throw new BridgeApiError("O Renascer não respondeu a tempo. Verifique a internet.", { code: "TIMEOUT" });
      if (error instanceof BridgeApiError) throw error;
      throw new BridgeApiError("Não foi possível conectar ao Renascer. Verifique a internet.", { code: "NETWORK_ERROR" });
    } finally {
      clearTimeout(timeout);
    }
  }

  resolve(code, operationId) {
    return this.request("/api/integrations/bridge/resolve", { method: "POST", body: { code, operationId } });
  }

  updateDispatch(dispatchId, status, error = null) {
    return this.request(`/api/integrations/bridge/dispatches/${dispatchId}`, {
      method: "PATCH",
      body: { status, error },
    });
  }
}

module.exports = { BackendClient, BridgeApiError };
