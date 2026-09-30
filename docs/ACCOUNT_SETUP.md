# Contas e dados online

O jogo continua funcionando como convidado. A conta é uma camada opcional: o navegador sem sessão usa o mesmo fluxo local de antes e não grava histórico de conta.

## Cadastro próprio

O login não depende de Google, e-mail ou lista de usuários de teste. Cada jogador pode criar uma conta com:

- nome de usuário único;
- senha com pelo menos oito caracteres;
- código de recuperação exibido uma única vez após o cadastro.

As senhas são derivadas com PBKDF2-SHA-256 e salt individual antes de serem gravadas. O Worker guarda somente o hash, nunca a senha original. As sessões usam tokens aleatórios armazenados como hash no D1 e cookie `HttpOnly`, `Secure` e `SameSite=Lax`.

O código de recuperação permite redefinir a senha sem e-mail. Após uma recuperação, o código é trocado e o novo código precisa ser guardado pelo jogador.

## Persistência

- O D1 `ucl-immortals-prod` guarda perfis, sessões, amizades e histórico privado.
- O histórico é uma fotografia compacta do resultado final da competição.
- Recordes públicos são calculados no servidor ao encerrar uma sala online. O navegador não pode publicar um valor como recorde.
- Os quatro recordes públicos são separados por dificuldade e limitados ao Top 10: gols, assistências, defesas e maior geral efetivo.
- Recordes carregam o nome do usuário, time e brasão salvos no momento da campanha; não expõem o histórico privado.

## Segurança operacional

Depois de alterar o Worker ou as migrações, publique novamente:

```powershell
pnpm deploy:cloudflare
```

O modo convidado permanece disponível mesmo sem conta.
