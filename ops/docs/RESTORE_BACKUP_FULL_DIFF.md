# Restauracao de backup FULL + DIFERENCIAL - Kalion Connect

Este documento descreve o procedimento. Nao execute uma restauracao sem autorizacao explicita.

## Estrutura no NAS

- //NAS_HOST/backup/chat/FULL
- //NAS_HOST/backup/chat/DIFERENCIAL

## Como escolher um ponto de restauracao

1. Defina a data/hora desejada, por exemplo: 14/08/2026 12:00.
2. Localize em FULL o backup semanal mais recente anterior ou igual ao ponto desejado.
3. Localize em DIFERENCIAL o backup do horario desejado ou o ultimo diferencial anterior a ele.
4. Confirme que o manifest do diferencial referencia o mesmo FULL-base escolhido.
5. A restauracao usa apenas: FULL-base + DIFERENCIAL escolhido.

## Validacoes obrigatorias

Antes de qualquer restauracao:

1. Criar backup de seguranca do estado atual.
2. Baixar os arquivos do NAS para area temporaria local.
3. Validar SHA-256 dos arquivos baixados com os checksums registrados no log/sidecar.
4. Extrair em diretorio temporario, nunca diretamente sobre a producao.
5. Validar JSON de var-lib/database.json com Node.js.
6. Conferir proprietario e permissoes esperados.
7. Solicitar confirmacao explicita para parar kalion-connect.

## Ordem tecnica de restauracao

1. Parar kalion-connect somente apos confirmacao.
2. Preservar copia do estado atual.
3. Restaurar o conteudo do FULL.
4. Sobrepor com o conteudo do DIFERENCIAL escolhido.
5. Ajustar owner/permissoes de /var/lib/kalion-connect e /etc/kalion-connect.
6. Iniciar kalion-connect.
7. Validar /api/health, login, conversas, anexos e notificacoes.

## Observacoes

- O database.json completo esta presente em cada diferencial.
- Uploads/media nos diferenciais contem somente arquivos novos ou alterados desde o FULL-base.
- Nao apagar backups do NAS durante uma restauracao.
