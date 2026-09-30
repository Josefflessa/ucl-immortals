# Contas e dados online

O jogo continua funcionando como convidado. A conta é uma camada opcional: o navegador sem sessão usa o mesmo fluxo local de antes e não grava histórico de conta.

## Cadastro próprio

O login não depende de Google, e-mail ou lista de usuários de teste. Cada jogador pode criar uma conta com:

- nome de usuário único;
- senha com pelo menos oito caracteres.

As senhas são derivadas com PBKDF2-SHA-256 e salt individual antes de serem gravadas. O Worker guarda somente o hash, nunca a senha original. As sessões usam tokens aleatórios armazenados como hash no D1 e cookie `HttpOnly` e `SameSite=Lax`; em produção o cookie também é `Secure`.

Não há recuperação automática de senha por e-mail. Se o jogador perder a senha, deverá criar outra conta.

## Persistência

- O D1 `ucl-immortals-prod` guarda perfis, sessões, amizades e histórico privado.
- O histórico é uma fotografia compacta do resultado final da competição.
- Recordes públicos são calculados no servidor ao encerrar uma sala online. O navegador não pode publicar um valor como recorde.
- Os quatro recordes públicos são separados por dificuldade e limitados ao Top 10: gols, assistências, defesas e maior geral efetivo.
- Recordes carregam o nome do usuário, time e brasão salvos no momento da campanha; não expõem o histórico privado.

## Desenvolvimento local

Para trabalhar sem publicar cada alteração, use:

```powershell
pnpm dev:all
```

Isso mantém o Vite em `http://localhost:3000` com atualização da interface e inicia um Worker local na porta `8787`, usando um D1 local separado da produção. As migrações locais são aplicadas com:

```powershell
pnpm exec wrangler d1 migrations apply ucl-immortals-prod --local
```

O comando `pnpm dev` continua disponível para trabalhar apenas na interface. Para testar cadastro, login, perfil e amizades localmente, prefira `pnpm dev:all`.

Depois de alterar o Worker ou as migrações, publique novamente:

```powershell
pnpm deploy:cloudflare
```

## Segurança operacional

O modo convidado permanece disponível mesmo sem conta.
