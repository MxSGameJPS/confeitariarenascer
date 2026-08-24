import { AppError } from "@/src/shared/errors/app-error";

export const PAYMENT_MODE = Object.freeze({
  PAY_ON_DELIVERY: "pay_on_delivery",
  ONLINE_GATEWAY: "online_gateway",
});

export const ACTIVE_PAYMENT_MODE = PAYMENT_MODE.PAY_ON_DELIVERY;

/**
 * Ponto de extensão para pagamento online futuro.
 *
 * O upgrade deverá implementar um adaptador de gateway nesta função, persistir
 * o identificador externo e a chave de idempotência, e confirmar o pagamento
 * somente por webhook assinado. O frontend nunca deverá marcar um pedido como
 * pago com base apenas no retorno do navegador.
 */
export async function createOnlinePaymentSession() {
  throw new AppError("Pagamento online ainda não está habilitado.", {
    statusCode: 501,
    code: "ONLINE_PAYMENT_NOT_ENABLED",
  });
}

