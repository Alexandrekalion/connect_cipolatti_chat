import "./env.mjs";
import crypto from "node:crypto";
import { chmod, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { dataDir } from "./store.mjs";

const configFile = path.join(dataDir, "secure-config.json");

function normalizeUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function webhookFromBaseUrl(value) {
  const baseUrl = normalizeUrl(value);
  return baseUrl ? `${baseUrl}/webhooks/whatsapp` : "";
}

function baseUrlFromWebhook(value) {
  return normalizeUrl(value).replace(/\/webhooks\/whatsapp$/i, "");
}

function key() {
  const source = process.env.KALION_ENCRYPTION_KEY;
  if (!source) return null;
  return /^[a-f0-9]{64}$/i.test(source) ? Buffer.from(source, "hex") : crypto.createHash("sha256").update(source).digest();
}

function encrypt(value) {
  if (!value) return "";
  const encryptionKey = key();
  if (!encryptionKey) throw new Error("KALION_ENCRYPTION_KEY não configurada.");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}.${cipher.getAuthTag().toString("hex")}.${encrypted.toString("hex")}`;
}

function decrypt(value) {
  if (!value) return "";
  const encryptionKey = key();
  if (!encryptionKey) return "";
  const [iv, tag, encrypted] = value.split(".");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "hex")), decipher.final()]).toString("utf8");
}

export async function getSecureConfig() {
  let saved = {};
  try { saved = JSON.parse(await readFile(configFile, "utf8")); } catch {}
  const webhookUrl = normalizeUrl(saved.webhookUrl || process.env.WEBHOOK_URL || webhookFromBaseUrl(saved.publicBaseUrl || process.env.PUBLIC_BASE_URL));
  const publicBaseUrl = normalizeUrl(saved.publicBaseUrl || process.env.PUBLIC_BASE_URL || baseUrlFromWebhook(webhookUrl));
  return {
    phoneNumberId: saved.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    businessAccountId: saved.businessAccountId || process.env.WHATSAPP_WABA_ID || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "",
    accessToken: decrypt(saved.accessToken) || process.env.WHATSAPP_ACCESS_TOKEN || "",
    verifyToken: decrypt(saved.verifyToken) || process.env.WHATSAPP_VERIFY_TOKEN || "",
    appSecret: decrypt(saved.appSecret) || process.env.META_APP_SECRET || "",
    graphVersion: saved.graphVersion || process.env.META_GRAPH_VERSION || "v25.0",
    tokenType: saved.tokenType || "system_user",
    publicBaseUrl,
    webhookUrl: webhookUrl || webhookFromBaseUrl(publicBaseUrl),
  };
}

export async function saveSecureConfig(input) {
  const current = await getSecureConfig();
  const next = {
    phoneNumberId: input.phoneNumberId || current.phoneNumberId,
    businessAccountId: input.businessAccountId || current.businessAccountId,
    graphVersion: input.graphVersion || current.graphVersion || "v25.0",
    tokenType: input.tokenType || current.tokenType || "system_user",
    publicBaseUrl: normalizeUrl(input.publicBaseUrl || baseUrlFromWebhook(input.webhookUrl) || current.publicBaseUrl),
    webhookUrl: normalizeUrl(input.webhookUrl || webhookFromBaseUrl(input.publicBaseUrl) || current.webhookUrl),
    accessToken: encrypt(input.accessToken || current.accessToken),
    verifyToken: encrypt(input.verifyToken || current.verifyToken),
    appSecret: encrypt(input.appSecret || current.appSecret),
    updatedAt: new Date().toISOString(),
  };
  await writeFile(configFile, JSON.stringify(next, null, 2), { encoding: "utf8", mode: 0o640 });
  await chmod(configFile, 0o640);
  return getSecureConfig();
}

export function publicConfig(config) {
  const checks = [
    { id: "phoneNumberId", label: "Phone Number ID", ready: Boolean(config.phoneNumberId) },
    { id: "wabaId", label: "WhatsApp Business Account ID", ready: Boolean(config.businessAccountId) },
    { id: "accessToken", label: "Access Token", ready: Boolean(config.accessToken) },
    { id: "verifyToken", label: "Verify Token", ready: Boolean(config.verifyToken) },
    { id: "appSecret", label: "App Secret", ready: Boolean(config.appSecret) },
    { id: "httpsWebhook", label: "Webhook público HTTPS", ready: /^https:\/\/[^/]+/i.test(config.webhookUrl) },
    { id: "mockDisabled", label: "Modo simulado desativado", ready: process.env.WHATSAPP_MOCK_MODE !== "true" },
  ];
  return {
    phoneNumberId: config.phoneNumberId,
    businessAccountId: config.businessAccountId,
    graphVersion: config.graphVersion,
    tokenType: config.tokenType,
    publicBaseUrl: config.publicBaseUrl,
    webhookUrl: config.webhookUrl,
    tokenConfigured: Boolean(config.accessToken),
    verifyTokenConfigured: Boolean(config.verifyToken),
    appSecretConfigured: Boolean(config.appSecret),
    permanentTokenPrepared: config.tokenType === "system_user" && Boolean(config.accessToken),
    configured: Boolean(config.phoneNumberId && config.businessAccountId && config.accessToken && config.verifyToken),
    readyForMeta: checks.every((check) => check.ready),
    checks,
  };
}
