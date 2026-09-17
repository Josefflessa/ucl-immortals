# Multiplayer na Cloudflare

O frontend e o multiplayer são publicados pelo mesmo Worker. Cada sala usa uma
Durable Object própria: o estado sobrevive a hibernações/reinícios, os sockets
permanecem conectados durante a hibernação e os timers de draft, abandono e
limpeza são rearmados como alarmes persistidos.

## Primeiro deploy

1. Entre na conta Cloudflare que já publica `ucl-immortals`:

   ```powershell
   pnpm exec wrangler login
   ```

2. Publique o Worker e a migração dos Durable Objects:

   ```powershell
   pnpm deploy:cloudflare
   ```

O nome do Worker continua `ucl-immortals`, portanto o endereço
`ucl-immortals.josefflessa.workers.dev` continua o mesmo. O primeiro deploy
cria os dois Durable Objects `GameRoom` e `RoomDirectory`; não é preciso criar
um banco, serviço Render ou URL de backend separado.

## Validação antes de publicar

```powershell
pnpm check
pnpm test
pnpm build
pnpm exec wrangler deploy --dry-run
```

Para testar o build Cloudflare localmente, use `pnpm dev:cloudflare`. O comando
`pnpm dev` continua usando o Socket.IO local do Vite para não alterar o fluxo de
desenvolvimento já existente.

## Compatibilidade com o servidor Node anterior

O build publicado usa WebSocket nativo por padrão. Se for necessário gerar um
artefato para o servidor Node/Socket.IO antigo, faça o build com:

```powershell
$env:VITE_REALTIME_TRANSPORT = 'socketio'
pnpm build
```
