<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: <https://ai.studio/apps/drive/1JUg1AOyAP_NCmQBL6xE9NCaMG5jA12WD>

## Novidades da Versão (Beta 1.1.1)

### 🚀 State Machine de Ordens de Produção

- Fluxo de status automatizado: `PENDENTE` → `PRONTO` → `EM PRODUÇÃO` → `CONCLUÍDO`.
- Validação rigorosa de transições para garantir integridade dos dados.
- Reserva automática de materiais ao confirmar uma OP.

### 📋 Rastreabilidade (Audit Trail)

- **Histórico Completo**: Todas as mudanças de status são registradas com data, hora e responsável.
- **Log de Atividades**: Registro detalhado de apontamentos de produção e refugo vinculado a operadores.
- **Visualização em Tempo Real**: Novo log histórico integrado ao modal de detalhes da OP.

## Execução Local

**Pré-requisitos:** Node.js

1. Instale as dependências:
   `npm install`
2. Configure a `GEMINI_API_KEY` no [.env.local](.env.local)
3. Execute o app:
   `npm run dev`
