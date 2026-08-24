# Upgrade futuro: gateway de pagamento

O modo atual é `pay_on_delivery`: o pedido nasce com pagamento pendente e só é
marcado como pago quando o Atendente conclui a entrega ou retirada.

Para habilitar um gateway no futuro:

1. implementar um adaptador em `payment-gateway.js`;
2. criar uma sessão de pagamento no backend, nunca diretamente no navegador;
3. salvar ID externo, chave de idempotência e estado da tentativa;
4. validar assinatura e repetição do webhook;
5. confirmar `payment_status` e financeiro apenas pelo webhook autenticado;
6. manter o fluxo atual como opção configurável de pagamento na entrega.

