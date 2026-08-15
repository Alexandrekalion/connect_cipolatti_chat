import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createId, dataDir } from "./store.mjs";

const uploadsRoot = path.join(dataDir, "uploads");
const uploadTypes = new Set(["company", "users", "contacts", "audio", "attachments"]);
const maxImageBytes = 3 * 1024 * 1024;
const maxAudioBytes = 8 * 1024 * 1024;
export const maxAttachmentBytes = Number.parseInt(process.env.KALION_MAX_ATTACHMENT_BYTES || "", 10) || 10 * 1024 * 1024;

const mimeMap = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const audioMimeMap = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

const attachmentMimeMap = new Map([
  ["application/pdf", "pdf"],
  ["application/msword", "doc"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
  ["application/vnd.ms-excel", "xls"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"],
  ["application/vnd.ms-powerpoint", "ppt"],
  ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "pptx"],
  ["text/plain", "txt"],
  ["text/csv", "csv"],
  ["application/csv", "csv"],
  ["application/zip", "zip"],
  ["application/x-zip-compressed", "zip"],
  ["application/vnd.rar", "rar"],
  ["application/x-rar-compressed", "rar"],
  ["image/x-icon", "ico"],
  ["image/vnd.microsoft.icon", "ico"],
  ...Object.entries(mimeMap).map(([mime, ext]) => [mime, ext]),
  ...Object.entries(audioMimeMap).map(([mime, ext]) => [mime, ext]),
  ["video/mp4", "mp4"],
  ["video/webm", "webm"],
  ["video/quicktime", "mov"],
  ["application/vnd.sketchup.skp", "skp"],
  ["application/acad", "dwg"],
  ["application/x-acad", "dwg"],
  ["application/dxf", "dxf"],
  ["image/vnd.dxf", "dxf"],
]);

const blockedAttachmentExtensions = new Set(["exe", "msi", "apk", "ps1", "bat"]);

export function publicUploadUrl(type, filename) {
  return `/api/uploads/${type}/${filename}`;
}

export async function ensureUploadDirs() {
  await Promise.all([...uploadTypes].map((type) => mkdir(path.join(uploadsRoot, type), { recursive: true })));
}

function parseContentType(contentType) {
  const match = String(contentType || "").match(/multipart\/form-data;\s*boundary=(?:"([^"]+)"|([^;]+))/i);
  return match?.[1] || match?.[2] || "";
}

function parseMultipartFile(buffer, contentType, label = "arquivo") {
  const boundary = parseContentType(contentType);
  if (!boundary) throw new Error(`Envie o ${label} como multipart/form-data.`);
  const body = buffer.toString("binary");
  const parts = body.split(`--${boundary}`);
  for (const part of parts) {
    const separator = part.indexOf("\r\n\r\n");
    if (separator < 0 || !/name="file"/i.test(part.slice(0, separator))) continue;
    const header = part.slice(0, separator);
    let payload = part.slice(separator + 4);
    if (payload.endsWith("\r\n")) payload = payload.slice(0, -2);
    const filename = header.match(/filename="([^"]*)"/i)?.[1] || "imagem";
    const mime = header.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim().toLowerCase() || "";
    return { filename, mime, buffer: Buffer.from(payload, "binary") };
  }
  throw new Error(`Arquivo de ${label} não encontrado no envio.`);
}

function parseMultipartImage(buffer, contentType) {
  return parseMultipartFile(buffer, contentType, "imagem");
}

function detectMime(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return "";
}

function detectAudioMime(buffer) {
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString("hex") === "1a45dfa3") return "audio/webm";
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString("ascii") === "OggS") return "audio/ogg";
  if (buffer.length >= 3 && buffer.subarray(0, 3).toString("ascii") === "ID3") return "audio/mpeg";
  if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return "audio/mpeg";
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp") return "audio/mp4";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WAVE") return "audio/wav";
  return "";
}

function sanitizeOriginalName(filename) {
  return path.basename(String(filename || "arquivo")).replace(/[^\w.\- ()[\]{}@]+/g, "_").slice(0, 160) || "arquivo";
}

function fileExtension(filename) {
  const ext = path.extname(String(filename || "")).toLowerCase().replace(/^\./, "");
  return ext === "jpeg" ? "jpg" : ext;
}

function attachmentCategory(mime, ext) {
  if (ext === "ico") return "image";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (ext === "pdf") return "pdf";
  if (["doc", "docx"].includes(ext)) return "word";
  if (["xls", "xlsx", "csv"].includes(ext)) return "sheet";
  if (["ppt", "pptx"].includes(ext)) return "presentation";
  if (["zip", "rar", "7z"].includes(ext)) return "archive";
  if (["skp", "dwg", "dxf"].includes(ext)) return "technical";
  return "document";
}

function validateAttachment(file) {
  if (!file.buffer.length) throw new Error("Arquivo vazio.");
  if (file.buffer.length > maxAttachmentBytes) throw new Error("Arquivo acima do limite de 10 MB.");
  const originalName = sanitizeOriginalName(file.filename);
  const declared = file.mime.split(";")[0].trim().toLowerCase();
  const ext = fileExtension(originalName);
  if (blockedAttachmentExtensions.has(ext)) {
    throw new Error(`Este tipo de arquivo nao e permitido. Por seguranca, arquivos .${ext} nao podem ser enviados pelo Chat | Cipolatti.`);
  }
  const expectedExt = attachmentMimeMap.get(declared);
  const flexibleMime = !declared || declared === "application/octet-stream";
  if (!flexibleMime && expectedExt && expectedExt !== ext && !(expectedExt === "jpg" && ext === "jpeg")) {
    throw new Error("Tipo do arquivo nao corresponde a extensao.");
  }
  return { originalName, ext, mime: declared || "application/octet-stream", category: attachmentCategory(declared, ext) };
}

export async function saveUploadedImage(type, rawBody, contentType) {
  if (!uploadTypes.has(type)) throw new Error("Tipo de upload inválido.");
  await ensureUploadDirs();
  const file = parseMultipartImage(rawBody, contentType);
  if (!file.buffer.length) throw new Error("Imagem vazia.");
  if (file.buffer.length > maxImageBytes) throw new Error("Imagem acima do limite de 3 MB.");
  const detected = detectMime(file.buffer);
  if (!detected || !mimeMap[detected] || (file.mime && file.mime !== detected)) {
    throw new Error("Formato inválido. Use JPG, JPEG, PNG ou WEBP.");
  }
  const filename = `${createId(type)}.${mimeMap[detected]}`;
  const target = path.join(uploadsRoot, type, filename);
  await writeFile(target, file.buffer, { mode: 0o640 });
  return {
    filename,
    url: publicUploadUrl(type, filename),
    size: file.buffer.length,
    mime: detected,
    originalName: path.basename(file.filename).slice(0, 120),
  };
}

export async function readUploadedImage(type, filename) {
  if (!uploadTypes.has(type) || !/^[a-z0-9_-]+-\d+-[a-z0-9]+\.(jpg|png|webp)$/i.test(filename)) {
    throw new Error("Imagem inválida.");
  }
  const target = path.join(uploadsRoot, type, filename);
  const resolved = path.resolve(target);
  const allowed = path.resolve(path.join(uploadsRoot, type));
  if (!resolved.startsWith(`${allowed}${path.sep}`)) throw new Error("Imagem inválida.");
  const buffer = await readFile(resolved);
  const mime = detectMime(buffer);
  if (!mime) throw new Error("Imagem inválida.");
  return { buffer, mime };
}

export async function saveUploadedAudio(rawBody, contentType) {
  await ensureUploadDirs();
  const file = parseMultipartFile(rawBody, contentType, "áudio");
  if (!file.buffer.length) throw new Error("Áudio vazio.");
  if (file.buffer.length > maxAudioBytes) throw new Error("Áudio acima do limite de 8 MB.");
  const detected = detectAudioMime(file.buffer);
  const declared = file.mime.split(";")[0].trim().toLowerCase();
  if (!detected || !audioMimeMap[detected] || (declared && audioMimeMap[declared] && declared !== detected)) {
    throw new Error("Formato de áudio inválido. Use WEBM, OGG, MP3, M4A ou WAV.");
  }
  const filename = `${createId("audio")}.${audioMimeMap[detected]}`;
  const target = path.join(uploadsRoot, "audio", filename);
  await writeFile(target, file.buffer, { mode: 0o640 });
  return {
    filename,
    url: publicUploadUrl("audio", filename),
    size: file.buffer.length,
    mime: detected,
    originalName: path.basename(file.filename).slice(0, 120),
  };
}

export async function readUploadedAudio(filename) {
  if (!/^[a-z0-9_-]+-\d+-[a-z0-9]+\.(webm|ogg|mp3|m4a|wav)$/i.test(filename)) {
    throw new Error("Áudio inválido.");
  }
  const target = path.join(uploadsRoot, "audio", filename);
  const resolved = path.resolve(target);
  const allowed = path.resolve(path.join(uploadsRoot, "audio"));
  if (!resolved.startsWith(`${allowed}${path.sep}`)) throw new Error("Áudio inválido.");
  const buffer = await readFile(resolved);
  const mime = detectAudioMime(buffer);
  if (!mime) throw new Error("Áudio inválido.");
  return { buffer, mime };
}

export async function saveUploadedAttachment(rawBody, contentType) {
  await ensureUploadDirs();
  const file = parseMultipartFile(rawBody, contentType, "anexo");
  const details = validateAttachment(file);
  const id = createId("attachment");
  const storedName = details.ext ? `${id}.${details.ext}` : id;
  const target = path.join(uploadsRoot, "attachments", storedName);
  await writeFile(target, file.buffer, { mode: 0o640 });
  return {
    id,
    storedName,
    url: `/api/internal/attachments/${id}/download`,
    name: details.originalName,
    originalName: details.originalName,
    size: file.buffer.length,
    mime: details.mime,
    extension: details.ext,
    category: details.category,
  };
}

export async function readUploadedAttachment(storedName) {
  if (!/^[a-z0-9_-]+-\d+-[a-z0-9]+(?:\.[a-z0-9]+)?$/i.test(storedName || "")) {
    throw new Error("Anexo invalido.");
  }
  const target = path.join(uploadsRoot, "attachments", storedName);
  const resolved = path.resolve(target);
  const allowed = path.resolve(path.join(uploadsRoot, "attachments"));
  if (!resolved.startsWith(`${allowed}${path.sep}`)) throw new Error("Anexo invalido.");
  return readFile(resolved);
}

export async function removeUploadedImage(url) {
  const match = String(url || "").match(/^\/api\/uploads\/(company|users|contacts)\/([a-z0-9_-]+-\d+-[a-z0-9]+\.(?:jpg|png|webp))$/i);
  if (!match) return;
  const target = path.resolve(path.join(uploadsRoot, match[1], match[2]));
  const allowed = path.resolve(path.join(uploadsRoot, match[1]));
  if (!target.startsWith(`${allowed}${path.sep}`)) return;
  await rm(target, { force: true });
}
