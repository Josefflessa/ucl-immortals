# Contas, Google e dados online

O jogo continua funcionando como convidado. A conta é uma camada opcional: o navegador sem sessão usa o mesmo fluxo local de antes e não grava histórico de conta.

## Configurar o Google OAuth

1. No Google Cloud Console, crie um OAuth Client ID do tipo **Web application**.
2. Adicione como redirect URI de produção:

   `https://ucl-immortals.josefflessa.workers.dev/api/auth/google/callback`

3. Se for testar com `wrangler dev`, adicione também a origem/redirect URI local que o terminal informar.
4. Grave as credenciais como secrets do Worker. Elas não devem entrar no Git:

   ```powershell
   pnpm exec wrangler secret put GOOGLE_CLIENT_ID
   pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET
   ```

O Worker usa Authorization Code + PKCE, guarda apenas o vínculo do Google e uma sessão HttpOnly no D1, e nunca recebe a senha do usuário.

## Persistência

- O D1 `ucl-immortals-prod` guarda perfis, sessões, amizades e histórico privado.
- O histórico é uma fotografia compacta do resultado final da competição.
- Recordes públicos são calculados no servidor ao encerrar uma sala online. O navegador não pode publicar um valor como recorde.
- Os quatro recordes públicos são separados por dificuldade e limitados ao Top 10: gols, assistências, defesas e maior geral efetivo.
- Recordes carregam o nome do usuário, time e brasão salvos no momento da campanha; não expõem o histórico privado.

## Segurança operacional

Depois de configurar os secrets, publique novamente:

```powershell
pnpm deploy:cloudflare
```

Se os secrets ainda não estiverem configurados, o botão informa a situação e o modo convidado permanece disponível.
