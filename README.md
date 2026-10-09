# Renascer Padaria e Confeitaria — ERP / PDV

Sistema web da **Renascer Padaria e Confeitaria**, em evolução para se tornar o ERP/PDV central da operação das unidades do grupo.

O projeto integra atendimento, delivery, comandas, mesas, caixa, produtos, estoque, clientes, funcionários, financeiro e administração em uma única plataforma. A arquitetura também está sendo preparada para pesagem, hardware, operação multiunidade e emissão fiscal.

> O sistema web é a plataforma principal. Aplicativos desktop, Android e integrações com hardware são complementos e nunca devem ser requisitos para o funcionamento do Caixa Web.

## Objetivo

Transformar o Renascer em um ecossistema completo para operação de padarias

- Site e cardápio digital
- Delivery
- Pedidos
- Comandas
- QR Code por mesa
- Caixa / PDV Web
- Produtos e categorias
- Estoque
- Produtos por peso
- Clientes
- Funcionários
- Perfis e permissões
- Mesas
- Financeiro
- Auditoria
- Administração
- Alertas operacionais
- Supabase Realtime
- PWA
- Pesagem integrada a balanças
- Integrações com impressora, leitor, gaveta e TEF
- Fiscal / NFC-e e NF-e
- Multiunidade

## Stack

- **Next.js 16**
- **React 19**
- **JavaScript**
- **CSS Modules**
- **Supabase / PostgreSQL**
- **Supabase Realtime**
- **Vercel**
- **PWA**

O projeto utiliza JavaScript como linguagem principal. TypeScript não deve ser introduzido sem necessidade técnica clara.

## Arquitetura

A aplicação segue separação por responsabilidade sempre que aplicável:

```text
app/
  api/                  Rotas HTTP
  admin/                Administração
  operacao/             Interfaces operacionais
  mesa/                 Fluxos de mesa/comanda
  pedido/               Fluxos de pedidos

src/
  config/               Configurações
  modules/              Domínios da aplicação
    <modulo>/
      *.controller.js
      *.service.js
      *.repository.js
      *.validation.js
  shared/               Código compartilhado

supabase/
  migrations/           Evolução versionada do banco
```

As regras críticas devem ser validadas no servidor e, quando necessário, também no banco de dados através de constraints, funções e RPCs transacionais.

## Módulos atuais

O projeto já possui bases para os seguintes domínios:

- Autenticação administrativa e operacional
- Funcionários
- Perfis e permissões
- Produtos e categorias
- Delivery e pedidos
- Mesas
- Comandas
- Clientes
- Caixa / vendas
- Pagamentos
- Financeiro inicial
- Fornecedores
- Configurações da loja
- Auditoria
- Alertas visuais e sonoros
- Atualizações operacionais via Supabase Realtime

Os módulos continuam em evolução para atender a operação completa de um ERP/PDV.

## Princípios do projeto

### Web primeiro

O Caixa Web deve continuar funcionando pelo navegador independentemente da existência de aplicativos desktop.

Exemplo de contingência: em uma falta de energia, um notebook com bateria e internet compartilhada por celular deve conseguir acessar o sistema e continuar a operação.

### Segurança

Operações críticas devem considerar:

- autenticação;
- autorização e permissões;
- RLS quando aplicável;
- validação server-side;
- auditoria;
- idempotência;
- concorrência;
- prevenção de duplicidades;
- proteção de endpoints;
- proteção de dados e segredos.

Nunca exponha `SUPABASE_SECRET_KEY`, service role ou qualquer outro segredo no frontend, Electron ou Android.

### Confiabilidade

Ao implementar uma operação, considere sempre:

- queda de internet;
- clique duplo;
- duas estações tentando alterar o mesmo recurso;
- indisponibilidade de API externa;
- recuperação após falha;
- duplicidade;
- rastreabilidade e auditoria.

### Realtime

Sempre que possível, atualizações operacionais devem usar Supabase Realtime em vez de polling excessivo.

Delivery e comandas possuem alertas operacionais. Solicitações pendentes podem manter alertas periódicos até serem aceitas, recusadas ou resolvidas.

## Banco de dados e migrations

Alterações estruturais do Supabase devem ser feitas por migrations em:

```text
supabase/migrations/
```

Evite alterações manuais em produção que não estejam representadas no histórico de migrations.

Operações financeiras, estoque, fechamento de caixa, pesagem e fiscal devem preferir funções/RPCs transacionais quando isso reduzir riscos de concorrência ou estados parciais.

## Multiunidade

A arquitetura será preparada para atender todas as unidades da empresa em um único sistema.

Modelo desejado:

```text
Organização Renascer
├── Unidade 01
├── Unidade 02
├── Unidade 03
├── Unidade 04
├── Unidade 05
├── Unidade 06
└── Unidade 07
```

A evolução do banco deve introduzir conceitos como:

- `organization_id`
- `store_id`

Pedidos, vendas, estoque, funcionários, caixas, mesas, financeiro e documentos fiscais deverão pertencer à unidade correta.

O proprietário poderá visualizar dados consolidados, enquanto funcionários comuns terão acesso somente às unidades autorizadas.

## Estoque

A evolução planejada do estoque considera um ledger de movimentações, evitando depender somente de um campo de quantidade atual.

Exemplos de movimentação:

```text
COMPRA
VENDA
CANCELAMENTO
AJUSTE
PERDA
INVENTÁRIO
TRANSFERÊNCIA
```

Venda e baixa de estoque devem ocorrer de forma transacional para impedir venda concorrente acima da quantidade disponível.

## Pesagem

Arquitetura planejada:

```text
Balança Filizola
      ↓
Renascer Pesagem
      ↓
Backend Renascer
      ↓
Supabase
      ↓
Comanda
      ↓
Realtime
      ↓
Caixa
```

O aplicativo local não será autoridade sobre preços.

O dispositivo envia o produto e a medição; o backend consulta o preço por kg, valida a operação, calcula o valor e registra a pesagem com auditoria.

## Renascer Desktop

Está planejado um aplicativo Electron para Windows funcionando como ponte de hardware para:

- balança;
- impressora térmica;
- leitor de código de barras;
- gaveta de dinheiro;
- TEF;
- outros periféricos.

O Desktop utilizará o mesmo backend e o mesmo banco do sistema web. Não deverá existir banco independente ou catálogo de preços autoritativo no dispositivo.

## Fiscal

O objetivo futuro é permitir que o Renascer assuma também as funções fiscais atualmente executadas pelo sistema legado utilizado pela empresa.

O módulo fiscal deverá ser preparado para, conforme aplicável:

- NFC-e;
- NF-e;
- CPF na nota;
- DANFE;
- XML;
- QR Code fiscal;
- certificado digital;
- CSC;
- cancelamento;
- contingência;
- histórico fiscal;
- integração com pagamentos;
- NCM;
- CFOP;
- CST / CSOSN;
- CEST;
- GTIN / EAN.

Dados tributários nunca devem ser inventados. Devem ser importados de fonte confiável e/ou validados com a contabilidade.

Para emissão fiscal, a preferência arquitetural é utilizar um provedor fiscal especializado atrás de uma abstração própria do Renascer, evitando acoplamento do restante do ERP ao fornecedor.

## Roadmap ERP / PDV

Ordem técnica de evolução recomendada:

1. Fundação multiunidade
2. Idempotência e proteção contra concorrência
3. Estoque transacional e movimentações
4. Testes das regras críticas
5. Estoque completo e inventário
6. Compras e fornecedores
7. Caixa / PDV completo
8. Pesagem integrada
9. Financeiro completo
10. Relatórios e indicadores
11. Cadastro tributário
12. Fiscal / NFC-e / NF-e
13. Pagamentos integrados / TEF
14. Desktop e integrações de hardware
15. Contingência offline avançada
16. Importação de dados do sistema legado
17. Operação paralela e conferência
18. Migração definitiva para o Renascer

## Desenvolvimento local

Instale as dependências:

```bash
npm install
```

Configure as variáveis de ambiente necessárias em `.env.local`.

Nunca versione valores reais de segredos.

Exemplo dos nomes utilizados pelo projeto:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

Execute o ambiente de desenvolvimento:

```bash
npm run dev
```

Aplicação local:

```text
http://localhost:3000
```

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Deploy

O projeto é preparado para deploy na **Vercel**, utilizando Supabase como infraestrutura de banco e serviços associados.

Antes de publicar alterações críticas:

1. confira as migrations;
2. valide variáveis de ambiente;
3. execute lint/build;
4. verifique regras de autorização;
5. teste operações financeiras e de estoque afetadas;
6. confirme o deploy.

## Diretriz de produto

O objetivo não é copiar o sistema legado tela por tela.

O Renascer deve implementar somente as rotinas realmente necessárias à operação, oferecendo uma experiência mais simples, rápida e adequada a padarias, mantendo segurança, confiabilidade, auditabilidade e baixo custo operacional.

---

**Renascer Padaria e Confeitaria — ERP / PDV em evolução.**
