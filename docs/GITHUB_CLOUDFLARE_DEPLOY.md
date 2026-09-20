# Deploy automático para a Cloudflare

O workflow `.github/workflows/deploy-cloudflare.yml` publica o Worker sempre
que há um push na branch `master`. Ele também pode ser executado manualmente na
aba **Actions** do GitHub.

Antes do primeiro push, cadastre estes secrets em **Settings → Secrets and
variables → Actions** no repositório:

- `CLOUDFLARE_API_TOKEN`: token da Cloudflare com permissão de edição do
  Workers/Durable Objects na conta do projeto.
- `CLOUDFLARE_ACCOUNT_ID`: ID da conta Cloudflare que hospeda o Worker.

Os valores não devem ser colocados no código ou em arquivos versionados.
