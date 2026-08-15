# Chat | Cipolatti

Aplicacao web corporativa para comunicacao interna, conversas privadas, grupos, reunioes, anexos, audios, notificacoes, perfis por departamento e autenticacao integrada ao Active Directory via LDAPS.

Este repositorio contem somente o codigo-fonte, assets publicos, scripts operacionais genericos e documentacao. Dados reais de producao, banco, anexos, logs, certificados privados e credenciais nunca devem ser versionados.

## Requisitos

- Linux para producao, preferencialmente Debian/Ubuntu.
- Node.js 20 ou superior e npm compativel com `package-lock.json`.
- Nginx como reverse proxy HTTPS.
- systemd para executar o backend e timers de backup.
- `ldap-utils` instalado quando a autenticacao AD usar `ldapsearch`.
- `smbclient` quando a copia de backup para NAS SMB estiver habilitada.
- CA corporativa instalada no sistema operacional quando o AD usar LDAPS com certificado interno.

Exemplo Debian/Ubuntu:

```bash
apt update
apt install -y nodejs npm nginx ldap-utils smbclient ca-certificates
```

A CA corporativa deve ser instalada localmente, por exemplo em `/usr/local/share/ca-certificates/`, seguida de `update-ca-certificates`. Nao publique certificados privados, chaves ou arquivos internos no GitHub.

## Instalacao da aplicacao

```bash
npm ci
cp .env.example .env
npm run build
npm run server
```

Em producao, use um arquivo de ambiente protegido fora do repositorio, por exemplo `/etc/kalion-connect/kalion-connect.env`, com permissao restrita.

## Variaveis de ambiente

Use `.env.example` como modelo. Valores marcados como `CHANGE_ME` devem ser preenchidos somente no servidor ou no cofre de segredos.

Principais grupos:

- Identidade e URL publica da aplicacao.
- Runtime: `PORT`, `KALION_DATA_DIR`, `PUBLIC_BASE_URL` e origens permitidas.
- Sessao/cookies: `SESSION_SECRET` e tempos de revalidacao.
- Active Directory/LDAPS: URL, dominio, Base DN, conta de servico e grupos autorizados.
- Uploads: diretorio persistente e limite de tamanho.
- Integracoes opcionais/legadas, quando usadas pela instalacao.

## Diretorios persistentes

A producao deve manter dados fora do repositorio:

```text
/var/lib/kalion-connect/database.json
/var/lib/kalion-connect/uploads
/var/lib/kalion-connect/media
/etc/kalion-connect/kalion-connect.env
/etc/kalion-connect/backup-nas.env
/root/kalion-connect-secrets/
/var/log/kalion-connect
/var/backups/kalion-connect
```

Esses caminhos contem dados ou configuracoes da instalacao e nao devem ser copiados para o GitHub.

## Build e publicacao

```bash
npm run build
rsync -a --delete dist/ /opt/kalion-connect/external-dist/
systemctl restart kalion-connect
systemctl reload nginx
```

Ajuste o caminho do `external-dist` conforme o servidor Nginx da instalacao.

## Backend com systemd

Exemplo conceitual, sem credenciais:

```ini
[Service]
User=kalion
Group=kalion
WorkingDirectory=/opt/kalion-connect/current
EnvironmentFile=/etc/kalion-connect/kalion-connect.env
ExecStart=/usr/bin/node server/index.mjs
Restart=always
ReadWritePaths=/var/lib/kalion-connect /var/log/kalion-connect
```

A conta do servico precisa ler a configuracao e escrever apenas nos diretorios persistentes necessarios.

## Nginx e HTTPS

O Nginx deve servir o frontend estatico e encaminhar `/api/` e WebSocket/SSE para o backend interno. Configure tambem limite de corpo compativel com a politica de anexos e TLS valido para o dominio publico.

## Active Directory e LDAPS

A autenticacao corporativa depende de:

- `ldap-utils` disponivel no sistema.
- Resolucao DNS do controlador de dominio.
- Conectividade LDAP/LDAPS.
- CA corporativa confiavel quando o certificado for interno.
- Variaveis AD preenchidas no ambiente protegido.

Durante a migracao para uma VM nova, valide `ldapsearch` tecnicamente antes de liberar o login real. Nao registre senhas em logs.

## Funcionalidades sincronizadas

- Chat privado e grupos internos.
- Participantes de grupo com proprietario, administrador e participante.
- Midias compartilhadas e opcao de localizar arquivo na conversa.
- Notificacoes, leitura e reducao de duplicidade.
- Fora do escritorio no backend, com controle anti-spam.
- Envio de mensagens com protecao contra duplo envio.
- Anexos com formatos bloqueados por seguranca e limite de 10 MB por arquivo.
- PWA, manifests, service worker e icones atuais.
- Layout desktop, mobile e PWA.
- Renderizacao segura de negrito no padrao `*texto*`, sem alterar o texto salvo.

## Backup FULL e diferencial

A rotina operacional generica fica em `ops/kalion-connect-backup.sh`.

Agendamentos sugeridos:

- FULL semanal: domingo as 19:00.
- DIFERENCIAL: diariamente as 00:00, 06:00, 12:00 e 18:00.

Arquivos auxiliares:

```text
ops/systemd/kalion-connect-backup.service
ops/systemd/kalion-connect-backup.timer
ops/systemd/kalion-connect-backup-full.service
ops/systemd/kalion-connect-backup-full.timer
ops/examples/backup-nas.env.example
ops/examples/nas-smb.credentials.example
ops/docs/RESTORE_BACKUP_FULL_DIFF.md
```

A copia para NAS usa arquivo de credenciais protegido, fora do repositorio. A rotina gera backup local temporario, valida, envia ao NAS, valida SHA-256 e remove o temporario somente apos sucesso. Se o NAS falhar, o backup fica pendente localmente para reenvio posterior.

A primeira politica de retencao deve ser validada em modo simulacao antes de apagar qualquer arquivo.

## Restauracao

Consulte `ops/docs/RESTORE_BACKUP_FULL_DIFF.md`. Uma restauracao deve sempre:

1. Criar backup de seguranca do estado atual.
2. Selecionar o FULL-base e o diferencial desejado.
3. Validar SHA-256.
4. Extrair em diretorio temporario.
5. Validar `database.json`.
6. Parar o servico somente apos confirmacao explicita.
7. Restaurar, ajustar permissoes, iniciar e validar login, conversas e anexos.

## Seguranca antes de commit/push

Antes de publicar no GitHub, revise:

```bash
git status --short
git diff --cached
git ls-files
git check-ignore -v .env
grep -RInE "password|passwd|secret|token|api_key|Authorization|LDAP_PASSWORD|NAS_PASSWORD|BEGIN PRIVATE KEY" .
```

Remova qualquer valor real encontrado. Use apenas placeholders como `CHANGE_ME`.

Nunca enviar:

- `.env` real ou arquivos em `/etc/kalion-connect`.
- `database.json`, dumps, conversas, mensagens, usuarios reais, grupos ou notificacoes.
- uploads, anexos, imagens, videos, audios e documentos enviados.
- backups `.tar.gz`, logs, sessoes, cookies.
- certificados privados, chaves, tokens, senhas, credenciais LDAP/AD/SMB/NAS.
- IPs internos reais, nomes de servidores internos ou DNs reais da organizacao.

## Repositorio

Repositorio oficial:

```text
https://github.com/Alexandrekalion/connect_cipolatti_chat
```

Branch principal: `main`.
