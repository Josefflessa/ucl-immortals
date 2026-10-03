# Deploy na Cloudflare

O frontend, o multiplayer e as contas são publicados pelo mesmo Worker
(`server/cloudflare-worker.ts`, configurado em `wrangler.jsonc`):

- **Assets estáticos**: `dist/public`, gerado pelo `vite build`, com fallback de SPA.
- **Multiplayer**: cada sala é uma Durable Object `GameRoom` própria. O estado
  sobrevive a hibernações/reinícios, os sockets permanecem conectados durante a
  hibernação e os timers de draft, abandono e limpeza viram alarmes persistidos.
  A Durable Object `RoomDirectory` só reserva os códigos de sala.
- **Contas**: o D1 `ucl-immortals-prod` guarda usuários, sessões, perfis,
  amizades, convites, presença, histórico e recordes (ver `docs/ACCOUNT_SETUP.md`).

O endereço continua `ucl-immortals.josefflessa.workers.dev`. Não há servidor de
backend separado: em produção o cliente fala com `/api/realtime` no mesmo host.

## Publicar

1. Entre na conta Cloudflare que publica `ucl-immortals`:

   ```powershell
   pnpm exec wrangler login
   ```

2. Se houver migração nova em `migrations/`, aplique no D1 de produção:

   ```powershell
   pnpm exec wrangler d1 migrations apply ucl-immortals-prod --remote
   ```

3. Publique o Worker (o primeiro deploy também cria as Durable Objects):

   ```powershell
   pnpm deploy:cloudflare
   ```

## Validação antes de publicar

```powershell
pnpm check
pnpm test
pnpm build
pnpm exec wrangler deploy --dry-run
```

## Desenvolvimento local

- `pnpm dev`: só a interface (Vite na porta 3000). O multiplayer usa o Socket.IO
  embutido no Vite, com os mesmos handlers do Durable Object.
- `pnpm dev:all`: Vite + Worker local na porta 8787 com D1 local, necessário para
  testar contas, perfis e amizades.
- `pnpm dev:cloudflare`: build completo servido pelo `wrangler dev`.
