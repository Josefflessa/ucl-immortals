# Notificações push

O app envia Web Push pelo próprio Worker. Não há provedor de e-mail ou serviço
de push externo contratado pelo projeto; os navegadores entregam as notificações
usando os endpoints de push que eles próprios fornecem.

## Chaves VAPID

Gere um par localmente:

```powershell
pnpm generate:vapid
```

O comando imprime `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY`.
Use um endereço de contato real no `VAPID_SUBJECT` (por exemplo,
`mailto:contato@seudominio.com`). A chave privada é segredo: não a envie ao
repositório, ao navegador ou a mensagens de suporte.

### Desenvolvimento local

Copie `.dev.vars.example` para `.dev.vars`, substitua os valores pelas chaves
geradas e rode `pnpm dev:all`. `.dev.vars` está no `.gitignore`.

### Produção

Cadastre cada valor como segredo do Worker e use o mesmo par gerado para o
ambiente de produção:

```powershell
pnpm exec wrangler secret put VAPID_SUBJECT
pnpm exec wrangler secret put VAPID_PUBLIC_KEY
pnpm exec wrangler secret put VAPID_PRIVATE_KEY
```

O comando solicita o valor no terminal. Não cole a chave privada em `wrangler.jsonc`
ou em arquivos versionados. A migração `0029_push_subscriptions.sql` também
precisa ser aplicada ao D1 local e ao D1 de produção antes de habilitar a função.

## Uso

Com a conta conectada, abra o sino de notificações e escolha **Ativar neste
dispositivo**. O navegador só pede permissão nesse clique. A preferência é por
dispositivo; ativar no celular não ativa automaticamente no computador.
Ao sair da conta, a inscrição push deste dispositivo é removida junto com a sessão.

Os avisos implementados cobrem novos pedidos e aceitações de amizade, convites
para partidas e propostas de troca. Convites expiram em um minuto. Ao tocar no
aviso, o app abre a tela correspondente ou apresenta o convite existente.
