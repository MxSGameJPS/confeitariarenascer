# Bridge GeMaster — contrato de liquidação

Este documento define o fluxo entre o Renascer, o agente local Bridge e o GeMaster.

## Princípio

Abrir, ler ou injetar uma comanda no GeMaster **não representa pagamento**.

O Renascer só pode marcar a comanda como `concluido` / `pago` depois que o Bridge detectar no GeMaster que a venda correspondente foi realmente concluída.

## Fluxo

1. O caixa lê ou digita `C105`.
2. O Bridge chama `POST /api/integrations/bridge/resolve` com um `operationId` UUID.
3. O backend resolve primeiro a comanda física `command_label = C105`; o `order_number` é apenas o ID interno da venda.
4. O Bridge injeta a pré-venda no GeMaster.
5. Se a injeção funcionou, o Bridge chama `PATCH /api/integrations/bridge/dispatches/{dispatchId}` com `status: injected`.
6. **Nenhuma baixa financeira ocorre neste ponto.**
7. O operador recebe o cliente normalmente no GeMaster.
8. Quando o Bridge detectar que a venda GeMaster foi concluída, chama `POST /api/integrations/bridge/dispatches/{dispatchId}/settle`.
9. O backend revalida comanda, itens, total, snapshot enviado e idempotência.
10. Somente então o Renascer fecha a comanda, registra a liquidação externa, atualiza o financeiro e libera a mesa quando não houver outra comanda válida mantendo a visita aberta.

## Payload de liquidação

```json
{
  "operationId": "UUID novo e persistido pela fila local",
  "externalSaleId": "identificador único da venda no GeMaster",
  "total": 38.47,
  "paymentMethod": "dinheiro",
  "fiscalDocument": "identificador fiscal quando disponível",
  "completedAt": "2026-09-03T18:30:00-03:00",
  "metadata": {}
}
```

`paymentMethod`, `fiscalDocument`, `completedAt` e `metadata` podem ser omitidos quando o GeMaster não disponibilizar esses dados. O Bridge nunca deve inventar informação fiscal ou financeira.

## Idempotência

O Bridge deve persistir localmente antes do envio:

- `dispatchId`;
- `operationId` da liquidação;
- `externalSaleId`;
- total confirmado;
- data/hora da conclusão;
- estado de sincronização.

Se a internet cair depois do pagamento no GeMaster, a operação permanece na fila local e deve ser reenviada quando a conexão voltar.

Reenviar a mesma venda não cria outro recebimento. O backend trata a operação e o identificador da venda GeMaster de forma idempotente.

## Estados do despacho

```text
prepared -> injected -> settled
                \
                 -> failed
```

- `prepared`: backend preparou o payload.
- `injected`: pré-venda foi enviada/aberta no GeMaster. Ainda não está paga.
- `settled`: venda realmente concluída no GeMaster e baixada no Renascer.
- `failed`: injeção falhou e o despacho não pode ser liquidado.

## Segurança

O Bridge usa somente o token próprio do dispositivo no header `Authorization: Bearer rbg_...`.

Nunca armazenar `SUPABASE_SECRET_KEY`, service role ou outra credencial administrativa no aplicativo local.

Preço, total, estado da comanda e itens são revalidados pelo backend. O Bridge não é autoridade para preços.

## Concorrência

Se a comanda mudar depois de ser injetada no GeMaster, a liquidação é rejeitada. O caixa/Bridge deverá gerar um novo despacho atualizado antes do pagamento para evitar fechar uma comanda diferente do snapshot que o GeMaster recebeu.

Uma comanda física como `C105` pode ser reutilizada depois do fechamento, mas somente uma instância `C105` pode permanecer aberta ao mesmo tempo.
