#!/usr/bin/env bash
set -euo pipefail

APP_NAME="kalion-connect"
SCRIPT_VERSION="2026.08.14-full-diff-v1"
DATA_DIR="/var/lib/kalion-connect"
DATABASE_FILE="${DATA_DIR}/database.json"
UPLOADS_DIR="${DATA_DIR}/uploads"
MEDIA_DIR="${DATA_DIR}/media"
CONFIG_DIR="/etc/kalion-connect"
NGINX_DIR="/etc/nginx"
SERVICE_FILE="/etc/systemd/system/kalion-connect.service"
STATE_DIR="/var/backups/kalion-connect/state"
PENDING_DIR="/var/backups/kalion-connect/pending"
LOG_FILE="/var/log/kalion-connect/backup.log"
NAS_CONFIG="/etc/kalion-connect/backup-nas.env"
RETENTION_DAYS="${KALION_BACKUP_RETENTION_DAYS:-15}"
RETENTION_APPLY="${KALION_BACKUP_RETENTION_APPLY:-false}"

timestamp="$(date +%Y%m%d-%H%M%S)"
iso_now="$(date -Is)"
work_dir="$(mktemp -d "/tmp/${APP_NAME}-backup-${timestamp}.XXXXXX")"

log() {
  mkdir -p "$(dirname "$LOG_FILE")"
  printf '%s %s\n' "$(date -Is)" "$*" | tee -a "$LOG_FILE"
}

cleanup() {
  rm -rf "$work_dir"
}
trap cleanup EXIT

usage() {
  cat <<USAGE
Uso: $0 [full|diff|auto|retry-pending|retention-dry-run]
USAGE
}

backup_mode="${1:-auto}"
case "$backup_mode" in
  full|FULL) backup_type="FULL" ;;
  diff|DIFF|diferencial|DIFERENCIAL) backup_type="DIFF" ;;
  auto)
    if [ "$(date +%u)" = "7" ] && [ "$(date +%H)" = "19" ]; then
      backup_type="FULL"
    else
      backup_type="DIFF"
    fi
    ;;
  retry-pending) backup_type="RETRY_ONLY" ;;
  retention-dry-run) backup_type="RETENTION_ONLY" ;;
  *) usage; exit 2 ;;
esac

mkdir -p "$STATE_DIR" "$PENDING_DIR"

copy_database_consistently() {
  local destination="$1"
  local attempt
  for attempt in 1 2 3; do
    cp -a "$DATABASE_FILE" "$destination"
    if node -e 'const fs=require("fs"); JSON.parse(fs.readFileSync(process.argv[1], "utf8"));' "$destination"; then
      return 0
    fi
    log "database.json invalido na tentativa ${attempt}; nova tentativa em 2s."
    sleep 2
  done
  log "ERRO: nao foi possivel obter uma copia JSON valida do database.json."
  return 1
}

copy_optional_path() {
  local source="$1"
  local destination="$2"
  if [ -e "$source" ]; then
    mkdir -p "$(dirname "$destination")"
    cp -a "$source" "$destination"
  fi
}

nas_load_config() {
  NAS_ENABLED="false"
  NAS_METHOD=""
  NAS_SMB_SHARE=""
  NAS_SMB_SUBDIR="chat"
  NAS_SMB_CREDENTIALS=""
  if [ -f "$NAS_CONFIG" ]; then
    # shellcheck disable=SC1090
    source "$NAS_CONFIG"
  fi
}

nas_preflight() {
  nas_load_config
  if [ "${NAS_ENABLED:-false}" != "true" ]; then
    log "NAS desabilitado; backup local ficara pendente."
    return 1
  fi
  if [ "${NAS_METHOD:-}" != "smbclient" ]; then
    log "NAS_METHOD=${NAS_METHOD:-<vazio>} nao suportado por esta rotina."
    return 1
  fi
  local allowed_share="${KALION_BACKUP_ALLOWED_NAS_SHARE:-}"
  local allowed_subdir="${KALION_BACKUP_ALLOWED_NAS_SUBDIR:-chat}"
  if [ -n "$allowed_share" ] && [ "${NAS_SMB_SHARE:-}" != "$allowed_share" ]; then
    log "ERRO: destino NAS fora do caminho autorizado. share=${NAS_SMB_SHARE:-<vazio>}"
    return 1
  fi
  if [ "${NAS_SMB_SUBDIR:-chat}" != "$allowed_subdir" ]; then
    log "ERRO: subdiretorio NAS fora do caminho autorizado. subdir=${NAS_SMB_SUBDIR:-<vazio>}"
    return 1
  fi
  if [ ! -r "${NAS_SMB_CREDENTIALS:-}" ]; then
    log "Arquivo de credenciais NAS indisponivel ou ilegivel."
    return 1
  fi
  if ! command -v smbclient >/dev/null 2>&1; then
    log "smbclient nao instalado; envio NAS pendente."
    return 1
  fi
}

nas_target_dir_for_archive() {
  case "$(basename "$1")" in
    *-FULL-*) printf 'FULL' ;;
    *-DIFF-*) printf 'DIFERENCIAL' ;;
    *) return 1 ;;
  esac
}

copy_archive_to_nas_smb() {
  local archive_path="$1"
  local archive_name remote_bucket verify_dir verify_file local_sha remote_sha size_bytes
  archive_name="$(basename "$archive_path")"
  remote_bucket="$(nas_target_dir_for_archive "$archive_name")"
  nas_preflight || return 1

  verify_dir="$(mktemp -d "/tmp/${APP_NAME}-nas-verify-${timestamp}.XXXXXX")"
  verify_file="${verify_dir}/${archive_name}"
  local_sha="$(sha256sum "$archive_path" | awk '{print $1}')"
  size_bytes="$(stat -c %s "$archive_path")"

  local smb_put_commands="mkdir FULL; mkdir DIFERENCIAL; cd ${remote_bucket}; put ${archive_path} ${archive_name}"
  if [ -f "${archive_path}.sha256" ]; then
    smb_put_commands="${smb_put_commands}; put ${archive_path}.sha256 ${archive_name}.sha256"
  fi
  if [ -f "${archive_path}.manifest.json" ]; then
    smb_put_commands="${smb_put_commands}; put ${archive_path}.manifest.json ${archive_name}.manifest.json"
  fi
  if ! smbclient "$NAS_SMB_SHARE" -A "$NAS_SMB_CREDENTIALS" -D "$NAS_SMB_SUBDIR" -m SMB3 -c "$smb_put_commands" >/tmp/${APP_NAME}-nas-copy-${timestamp}.log 2>&1; then
    log "AVISO: falha ao copiar ${archive_name} para NAS em ${NAS_SMB_SHARE}/${NAS_SMB_SUBDIR}/${remote_bucket}. Backup local preservado."
    rm -rf "$verify_dir"
    return 1
  fi

  if ! smbclient "$NAS_SMB_SHARE" -A "$NAS_SMB_CREDENTIALS" -D "$NAS_SMB_SUBDIR" -m SMB3 -c "cd ${remote_bucket}; get ${archive_name} ${verify_file}" >/tmp/${APP_NAME}-nas-verify-${timestamp}.log 2>&1; then
    log "AVISO: backup copiado, mas leitura de validacao falhou: ${remote_bucket}/${archive_name}."
    rm -rf "$verify_dir"
    return 1
  fi

  remote_sha="$(sha256sum "$verify_file" | awk '{print $1}')"
  rm -rf "$verify_dir"
  if [ "$local_sha" != "$remote_sha" ]; then
    log "AVISO: checksum divergente na copia NAS ${archive_name}. local=${local_sha} nas=${remote_sha}"
    return 1
  fi

  log "Copia NAS validada: ${NAS_SMB_SHARE}/${NAS_SMB_SUBDIR}/${remote_bucket}/${archive_name} size_bytes=${size_bytes} sha256=${local_sha}"
  return 0
}

retry_pending_backups() {
  local archive sent_any="false"
  shopt -s nullglob
  for archive in "$PENDING_DIR"/kalion-connect-FULL-*.tar.gz "$PENDING_DIR"/kalion-connect-DIFF-*.tar.gz; do
    sent_any="true"
    log "Tentando reenviar backup pendente: $(basename "$archive")"
    if copy_archive_to_nas_smb "$archive"; then
      rm -f "$archive"
      rm -f "${archive}.sha256" "${archive}.manifest.json"
      log "Backup pendente enviado e removido localmente: $(basename "$archive")"
    else
      log "Backup pendente continua preservado localmente: $(basename "$archive")"
    fi
  done
  shopt -u nullglob
  [ "$sent_any" = "true" ] || log "Nenhum backup pendente encontrado."
}

latest_full_state() {
  [ -f "${STATE_DIR}/latest-full.env" ] && cat "${STATE_DIR}/latest-full.env"
}

write_latest_full_state() {
  local archive_name="$1"
  local created_at="$2"
  local epoch="$3"
  local sha="$4"
  {
    printf 'FULL_NAME=%q\n' "$archive_name"
    printf 'FULL_CREATED_AT=%q\n' "$created_at"
    printf 'FULL_EPOCH=%q\n' "$epoch"
    printf 'FULL_SHA256=%q\n' "$sha"
  } > "${STATE_DIR}/latest-full.env"
  chmod 0600 "${STATE_DIR}/latest-full.env"
}

prepare_common_tree() {
  mkdir -p "${work_dir}/var-lib" "${work_dir}/etc" "${work_dir}/metadata"
  copy_database_consistently "${work_dir}/var-lib/database.json"
  copy_optional_path "${DATA_DIR}/secure-config.json" "${work_dir}/var-lib/secure-config.json"
  copy_optional_path "$CONFIG_DIR" "${work_dir}/etc/kalion-connect"
  copy_optional_path "$NGINX_DIR" "${work_dir}/etc/nginx"
  copy_optional_path "$SERVICE_FILE" "${work_dir}/etc/kalion-connect.service"
}

copy_changed_files_since_full() {
  local full_epoch="$1"
  local source rel target
  for source in "$UPLOADS_DIR" "$MEDIA_DIR"; do
    [ -d "$source" ] || continue
    while IFS= read -r -d '' file; do
      rel="${file#${DATA_DIR}/}"
      target="${work_dir}/var-lib/${rel}"
      mkdir -p "$(dirname "$target")"
      cp -a "$file" "$target"
    done < <(find "$source" -type f -newermt "@${full_epoch}" -print0 2>/dev/null)
  done
}

write_manifest() {
  local archive_name="$1"
  local type="$2"
  local full_base="$3"
  local content_sha="$4"
  local archive_size="$5"
  local file_count total_payload_bytes
  file_count="$(find "$work_dir" -type f | wc -l)"
  total_payload_bytes="$(du -sb "$work_dir" | awk '{print $1}')"
  cat > "${work_dir}/metadata/manifest.json" <<JSON
{
  "scriptVersion": "${SCRIPT_VERSION}",
  "createdAt": "${iso_now}",
  "host": "$(hostname)",
  "type": "${type}",
  "archiveName": "${archive_name}",
  "fullBase": "${full_base}",
  "contentSha256": "${content_sha}",
  "archiveSha256": "recorded-after-packaging-in-sidecar-and-backup-log",
  "archiveSizeBytes": ${archive_size},
  "payloadFileCount": ${file_count},
  "payloadSizeBytes": ${total_payload_bytes},
  "databaseIncludedComplete": true,
  "uploadsMode": "$( [ "$type" = "FULL" ] && printf 'complete' || printf 'changed_since_full' )",
  "mediaMode": "$( [ "$type" = "FULL" ] && printf 'complete' || printf 'changed_since_full' )",
  "retentionDays": ${RETENTION_DAYS},
  "retentionApplied": false
}
JSON
}

create_backup() {
  local type="$1"
  local archive_name archive_path full_name="" full_epoch="" full_created="" full_sha="" archive_sha archive_size content_sha
  archive_name="${APP_NAME}-${type}-${timestamp}.tar.gz"
  archive_path="${PENDING_DIR}/${archive_name}"

  prepare_common_tree

  if [ "$type" = "FULL" ]; then
    copy_optional_path "$UPLOADS_DIR" "${work_dir}/var-lib/uploads"
    copy_optional_path "$MEDIA_DIR" "${work_dir}/var-lib/media"
    full_name="$archive_name"
  else
    if [ ! -f "${STATE_DIR}/latest-full.env" ]; then
      log "Nenhum FULL-base encontrado; gerando FULL em vez de DIFERENCIAL."
      create_backup "FULL"
      return
    fi
    # shellcheck disable=SC1090
    source "${STATE_DIR}/latest-full.env"
    full_name="${FULL_NAME:-}"
    full_epoch="${FULL_EPOCH:-}"
    full_created="${FULL_CREATED_AT:-}"
    full_sha="${FULL_SHA256:-}"
    if [ -z "$full_name" ] || [ -z "$full_epoch" ]; then
      log "Estado do FULL-base invalido; gerando FULL em vez de DIFERENCIAL."
      create_backup "FULL"
      return
    fi
    copy_changed_files_since_full "$full_epoch"
  fi

  node -e 'const fs=require("fs"); JSON.parse(fs.readFileSync(process.argv[1], "utf8"));' "${work_dir}/var-lib/database.json"
  content_sha="$(find "$work_dir" -type f ! -path "${work_dir}/metadata/manifest.json" -print0 | sort -z | xargs -0 sha256sum | sha256sum | awk '{print $1}')"
  write_manifest "$archive_name" "$type" "$full_name" "$content_sha" 0
  tar -C "$work_dir" -czf "$archive_path" .
  chmod 0600 "$archive_path"
  archive_sha="$(sha256sum "$archive_path" | awk '{print $1}')"
  archive_size="$(stat -c %s "$archive_path")"
  sha256sum "$archive_path" > "${archive_path}.sha256"
  cat > "${archive_path}.manifest.json" <<JSON
{
  "scriptVersion": "${SCRIPT_VERSION}",
  "createdAt": "${iso_now}",
  "host": "$(hostname)",
  "type": "${type}",
  "archiveName": "${archive_name}",
  "fullBase": "${full_name}",
  "contentSha256": "${content_sha}",
  "archiveSha256": "${archive_sha}",
  "archiveSizeBytes": ${archive_size},
  "databaseIncludedComplete": true,
  "retentionDays": ${RETENTION_DAYS},
  "retentionApplied": false
}
JSON

  log "Backup ${type} gerado localmente: ${archive_path} size_bytes=${archive_size} sha256=${archive_sha} full_base=${full_name}"

  if copy_archive_to_nas_smb "$archive_path"; then
    if [ "$type" = "FULL" ]; then
      write_latest_full_state "$archive_name" "$iso_now" "$(date +%s)" "$archive_sha"
    fi
    rm -f "$archive_path" "${archive_path}.sha256" "${archive_path}.manifest.json"
    log "Backup ${type} validado no NAS e removido do armazenamento temporario local: ${archive_name}"
    retention_report
  else
    log "Backup ${type} preservado localmente para reenvio posterior: ${archive_path}"
  fi
}

retention_report() {
  local cutoff
  cutoff="$(date -d "-${RETENTION_DAYS} days" +%Y%m%d-%H%M%S)"
  log "Retencao NAS em modo simulacao: manter ${RETENTION_DAYS} dias restauraveis; cutoff=${cutoff}; nenhuma exclusao aplicada."
  log "Regra: FULL antigo so pode ser removido quando nao houver DIFERENCIAL dentro da janela que dependa dele."
  if [ "$RETENTION_APPLY" = "true" ]; then
    log "AVISO: KALION_BACKUP_RETENTION_APPLY=true ignorado nesta versao inicial; primeira execucao nao remove backups."
  fi
}

case "$backup_type" in
  RETRY_ONLY)
    retry_pending_backups
    ;;
  RETENTION_ONLY)
    retention_report
    ;;
  FULL|DIFF)
    retry_pending_backups || true
    create_backup "$backup_type"
    ;;
esac
