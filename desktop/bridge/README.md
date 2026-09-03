# Renascer Bridge Desktop

Aplicativo Electron para Windows que funciona como ponte local entre o ecossistema Renascer e o GeMaster.

## Fluxo desta etapa

1. O Bridge inicia com o Windows e permanece na bandeja.
2. `Ctrl + Alt + R` abre a janela rápida sobre o GeMaster.
3. O operador digita somente o número da comanda (`105`) ou um código completo (`C105` / `DVXXXXXXXX`).
4. `Enter` consulta o backend Renascer usando o token do dispositivo Bridge.
5. O backend prepara um dispatch idempotente com os itens e códigos GeMaster.
6. O adaptador local recebe o payload.

**Importante:** o adaptador que escreve efetivamente no GeMaster ainda está em modo `pending`, pois essa parte depende da homologação no computador real da padaria. Enquanto o adaptador não estiver homologado, o aplicativo NÃO marca o dispatch como `injected` e NÃO fecha comandas.

## Segurança

- `contextIsolation: true`, `nodeIntegration: false` e renderer em sandbox.
- O token `rbg_...` nunca é exposto ao renderer depois de salvo.
- O token é criptografado com `safeStorage` do Electron (DPAPI no Windows quando disponível).
- Se a criptografia segura não estiver disponível, o Bridge se recusa a salvar o token em texto puro.
- Nenhuma `SUPABASE_SECRET_KEY` ou service role existe no Desktop.
- O Desktop acessa somente os endpoints autenticados do Bridge no backend Renascer.

## Desenvolvimento

```bash
cd desktop/bridge
npm install
npm test
npm run check
npm run dev
```

Na primeira abertura, informe a URL `https://confeitariarenascer.vercel.app` e o token do dispositivo Bridge criado no painel administrativo.

Depois teste:

```text
Ctrl + Alt + R
105
Enter
```

O backend deve localizar `C105` e preparar o dispatch.

## Build Windows

```bash
npm run dist:win
```

O instalador é gerado em `desktop/bridge/dist/`. Ele cria atalhos no Desktop/Menu Iniciar e, depois de instalado, o Bridge configura inicialização automática com o Windows.

## Próxima homologação no GeMaster

A implementação concreta entra em `src/gemaster/adapter.js`. O adaptador só pode retornar `state: "injected"` depois que houver confirmação local de que a pré-venda foi realmente escrita/carregada no GeMaster. Somente então `main.js` informa `injected` ao backend.

A conclusão financeira é outra etapa: após o GeMaster confirmar a venda paga, o Bridge usa o endpoint de settlement já existente. `injected` nunca significa `pago`.
