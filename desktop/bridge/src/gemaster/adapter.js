class PendingGemasterAdapter {
  getStatus() {
    return { ready: false, mode: "pending", label: "Aguardando homologação com o GeMaster" };
  }

  async inject(dispatch) {
    return {
      state: "prepared",
      dispatchId: dispatch.dispatch_id,
      message: `${dispatch.command_code || dispatch.reference_code} localizada no Renascer. A integração de escrita no GeMaster ainda precisa ser homologada neste computador; nenhum fechamento foi realizado.`,
    };
  }
}

function createGemasterAdapter() { return new PendingGemasterAdapter(); }
module.exports = { createGemasterAdapter };
