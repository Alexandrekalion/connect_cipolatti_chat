import "./env.mjs";
import { execFile } from "node:child_process";
import crypto from "node:crypto";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { createId, readStore, updateStore } from "./store.mjs";

const scrypt = promisify(crypto.scrypt);
const execFileAsync = promisify(execFile);
const SESSION_COOKIE = "kalion_session";
const REMEMBER_COOKIE = "cipolatti_remember";
const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000;
const SESSION_IDLE_MS = 30 * 60 * 1000;
const REMEMBER_AD_LIFETIME_MS = Number(process.env.REMEMBER_AD_DAYS || 30) * 24 * 60 * 60 * 1000;
const LOCAL_ADMIN_USERNAME = "administrador";
const AD_PASSWORD_CHANGED_CODE = "AD_PASSWORD_CHANGED";
const AD_PASSWORD_CHANGED_TITLE = "🔒 Senha alterada";
const AD_PASSWORD_CHANGED_MESSAGE = "Sua senha do Active Directory foi alterada.\nPor motivos de segurança, sua sessão foi encerrada.\nFaça login novamente utilizando sua nova senha.";

export const rolePages = {
  Administrador: [
    "conversas", "grupos", "agenda", "departamentos",
    "usuarios", "configuracoes",
  ],
  Gestor: [
    "conversas", "grupos", "agenda", "departamentos",
    "usuarios", "configuracoes",
  ],
  "Usuário": ["conversas", "grupos", "agenda", "usuarios", "configuracoes"],
};

const roleCapabilities = {
  Administrador: ["*"],
  Gestor: [
    "internal.directory.read", "internal.conversations.create",
    "internal.conversations.participate", "departments.read.own", "users.read.own",
  ],
  "Usuário": [
    "internal.directory.read", "internal.conversations.create",
    "internal.conversations.participate", "profile.update.self",
  ],
};

const legacyUserPermissionKeys = [
  "Usuario",
  "Usuário",
  `Usu${String.fromCharCode(0xc3)}${String.fromCharCode(0xa1)}rio`,
  `Usu${String.fromCharCode(0xc3)}${String.fromCharCode(0x192)}${String.fromCharCode(0xc2)}${String.fromCharCode(0xa1)}rio`,
];

function normalizeRole(role) {
  const normalized = String(role || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (["administrador", "admin", "administrator"].includes(normalized)) return "Administrador";
  if (["gestor", "manager", "supervisor"].includes(normalized)) return "Gestor";
  return "Usuário";
}

function effectivePermissions(permissions, role) {
  const canonicalRole = normalizeRole(role);
  if (canonicalRole === "Administrador") {
    return { pages: rolePages.Administrador, capabilities: roleCapabilities.Administrador };
  }
  const safePages = new Set(rolePages[canonicalRole] || rolePages["Usuário"]);
  const storedPages = permissions?.[canonicalRole]?.pages;
  return {
    pages: Array.isArray(storedPages) ? storedPages.filter((page) => safePages.has(page)) : [...safePages],
    capabilities: permissions?.[canonicalRole]?.capabilities || roleCapabilities[canonicalRole] || roleCapabilities["Usuário"],
  };
}

function parseOutOfOfficeDate(value, boundary = "start") {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const suffix = boundary === "end" ? "T23:59:59.999-03:00" : "T00:00:00.000-03:00";
    return new Date(`${raw}${suffix}`);
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(raw)) {
    return new Date(`${raw}${raw.length === 16 ? ":00.000" : ""}-03:00`);
  }
  return new Date(raw);
}

function outOfOfficeStatus(outOfOffice = {}, now = new Date()) {
  const enabled = outOfOffice?.enabled === true;
  const start = outOfOffice?.startAt ? parseOutOfOfficeDate(outOfOffice.startAt, "start") : null;
  const end = outOfOffice?.endAt ? parseOutOfOfficeDate(outOfOffice.endAt, "end") : null;
  const validStart = start && Number.isFinite(start.getTime());
  const validEnd = end && Number.isFinite(end.getTime());
  const message = String(outOfOffice?.message || "").trim().slice(0, 1000);
  const active = Boolean(enabled && message && validStart && validEnd && start.getTime() <= now.getTime() && now.getTime() <= end.getTime());
  const scheduled = Boolean(enabled && validStart && validEnd && now.getTime() < start.getTime());
  const expired = Boolean(enabled && validEnd && now.getTime() > end.getTime());
  return {
    enabled,
    active,
    scheduled,
    expired,
    startAt: validStart ? start.toISOString() : "",
    endAt: validEnd ? end.toISOString() : "",
    message,
    label: active ? `Fora da empresa - retorna em ${end.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })}`
      : scheduled ? `Programado - começa em ${start.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })}`
      : expired ? "Expirado" : "Desativado",
  };
}

function publicUser(user, permissions) {
  const role = normalizeRole(user.role);
  const allowed = effectivePermissions(permissions, role);
  return {
    id: user.id,
    name: user.name,
    displayName: user.displayName || user.name,
    email: user.email,
    username: user.username,
    role,
    dept: user.department || user.dept || "",
    department: user.department || user.dept || "",
    jobTitle: user.jobTitle || user.cargo || "",
    phone: user.phone || "",
    extension: user.extension || user.ramal || "",
    signature: user.signature || "",
    preferences: user.preferences || {},
    status: user.status || "Offline",
    accessStatus: user.accessStatus || "Ativo",
    photoUrl: user.photoUrl || "",
    initials: user.initials || initials(user.name),
    mustChangePassword: Boolean(user.mustChangePassword),
    outOfOffice: outOfOfficeStatus(user.outOfOffice),
    allowedPages: allowed.pages,
    capabilities: allowed.capabilities,
  };
}

function initials(name) {
  return String(name || "KC").split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}

function normalizeCredential(value) {
  return String(value || "").trim().toLowerCase();
}

function uniqueCredentials(values) {
  return [...new Set((values || []).map(normalizeCredential).filter(Boolean))];
}

function isProtectedLocalUser(user) {
  return normalizeCredential(user?.username) === LOCAL_ADMIN_USERNAME || user?.authProvider === "local";
}

function canMatchActiveDirectoryIdentity(user) {
  return Boolean(user) && !isProtectedLocalUser(user) && (user.authProvider === "ad" || Boolean(user.adObjectGuid));
}

function isVisibleOperationalUser(user) {
  return user?.authProvider === "ad"
    && user?.accessStatus === "Ativo"
    && Boolean(user?.adObjectGuid)
    && !user?.passwordHash
    && !user?.passwordSalt;
}

function adConfig() {
  const baseDn = process.env.AD_BASE_DN || "";
  return {
    enabled: process.env.AD_AUTH_ENABLED !== "false",
    url: process.env.AD_LDAPS_URL || "",
    baseDn,
    netbios: process.env.AD_NETBIOS || "",
    domain: process.env.AD_DOMAIN || "",
    serviceBindDn: process.env.AD_SERVICE_BIND_DN || "",
    servicePassword: process.env.AD_SERVICE_PASSWORD || "",
    groupDns: {
      "Usuário": process.env.AD_GROUP_USUARIOS_DN || "",
      Gestor: process.env.AD_GROUP_GESTORES_DN || "",
      Administrador: process.env.AD_GROUP_ADMINISTRADORES_DN || "",
    },
  };
}

function ldapEscape(value) {
  return String(value || "").replace(/[\0()*\\]/g, (char) => ({
    "\0": "\\00", "(": "\\28", ")": "\\29", "*": "\\2a", "\\": "\\5c",
  }[char]));
}

function decodeLdifValue(line, name = "") {
  const separator = line.indexOf(":");
  if (separator < 0) return "";
  if (line[separator + 1] === ":") {
    if (["objectGUID", "thumbnailPhoto"].includes(name)) return line.slice(separator + 3).trim();
    return Buffer.from(line.slice(separator + 3).trim(), "base64").toString("utf8");
  }
  return line.slice(separator + 2);
}

function parseLdif(output) {
  const entries = [];
  let current = null;
  for (const rawLine of String(output || "").split(/\r?\n/)) {
    if (!rawLine || rawLine.startsWith("#")) {
      if (!rawLine && current) { entries.push(current); current = null; }
      continue;
    }
    if (rawLine.startsWith(" ")) continue;
    const name = rawLine.slice(0, rawLine.indexOf(":"));
    const value = decodeLdifValue(rawLine, name);
    if (name === "dn") {
      if (current) entries.push(current);
      current = { dn: value };
      continue;
    }
    if (!current) current = {};
    current[name] ||= [];
    current[name].push(value);
  }
  if (current) entries.push(current);
  return entries;
}

function firstAttr(entry, name) {
  return entry?.[name]?.[0] || "";
}

function activeDirectoryUserIsActive(entry) {
  const flags = Number(firstAttr(entry, "userAccountControl") || 0);
  const lockoutTime = BigInt(firstAttr(entry, "lockoutTime") || "0");
  return Boolean(flags) && (flags & 2) === 0 && lockoutTime === 0n;
}

function roleFromAdMembership(entry, config) {
  const memberOf = new Set((entry.memberOf || []).map((item) => item.toLowerCase()));
  if (memberOf.has(config.groupDns.Administrador.toLowerCase())) return "Administrador";
  if (memberOf.has(config.groupDns.Gestor.toLowerCase())) return "Gestor";
  if (memberOf.has(config.groupDns["Usuário"].toLowerCase())) return "Usuário";
  return "";
}

async function withPasswordFile(password, operation) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "cipolatti-ldap-"));
  const file = path.join(dir, "secret");
  try {
    await writeFile(file, String(password), { mode: 0o600 });
    await chmod(file, 0o600);
    return await operation(file);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function ldapSearch({ bindDn, password, filter, attributes, baseDn = adConfig().baseDn }) {
  const config = adConfig();
  return withPasswordFile(password, async (passwordFile) => {
    const { stdout } = await execFileAsync("ldapsearch", [
      "-o", "ldif-wrap=no",
      "-LLL",
      "-H", config.url,
      "-D", bindDn,
      "-y", passwordFile,
      "-b", baseDn,
      filter,
      ...attributes,
    ], {
      timeout: 15000,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, LDAPTLS_REQCERT: "demand" },
    });
    return parseLdif(stdout);
  });
}

async function ldapWhoAmI(bindDn, password) {
  const config = adConfig();
  return withPasswordFile(password, async (passwordFile) => execFileAsync("ldapwhoami", [
    "-H", config.url,
    "-D", bindDn,
    "-y", passwordFile,
  ], {
    timeout: 10000,
    maxBuffer: 64 * 1024,
    env: { ...process.env, LDAPTLS_REQCERT: "demand" },
  }));
}

function userBindCandidates(identifier, userEntry, config) {
  const raw = String(identifier || "").trim();
  const sam = firstAttr(userEntry, "sAMAccountName");
  const upn = firstAttr(userEntry, "userPrincipalName");
  return [...new Set([
    raw.includes("@") ? raw : "",
    upn,
    sam ? `${config.netbios}\\${sam}` : "",
    raw && !raw.includes("@") && !raw.includes("\\") ? `${config.netbios}\\${raw}` : raw,
  ].filter(Boolean))];
}

async function authenticateActiveDirectory(identifier, password) {
  const config = adConfig();
  if (!config.enabled) throw new Error("Autenticação Active Directory desativada.");
  if (!config.servicePassword) throw new Error("Autenticação Active Directory não configurada.");
  const raw = String(identifier || "").trim();
  const normalized = normalizeCredential(raw);
  const loginName = normalized.includes("@") ? normalized.split("@")[0] : normalized.includes("\\") ? normalized.split("\\").pop() : normalized;
  const filter = `(&(objectClass=user)(|(sAMAccountName=${ldapEscape(loginName)})(userPrincipalName=${ldapEscape(normalized)})))`;
  const [entry] = await ldapSearch({
    bindDn: config.serviceBindDn,
    password: config.servicePassword,
    filter,
    attributes: [
      "distinguishedName", "sAMAccountName", "userPrincipalName", "displayName", "mail",
      "department", "title", "telephoneNumber", "mobile", "thumbnailPhoto", "memberOf",
      "userAccountControl", "objectGUID", "pwdLastSet", "lockoutTime", "accountExpires",
      "msDS-UserPasswordExpiryTimeComputed",
    ],
  });
  if (!entry) {
    const error = new Error("Usuário não encontrado no Active Directory.");
    error.status = 401;
    throw error;
  }
  if (!activeDirectoryUserIsActive(entry)) {
    const error = new Error("Usuário desabilitado no Active Directory.");
    error.status = 403;
    throw error;
  }
  const role = roleFromAdMembership(entry, config);
  if (!role) {
    const error = new Error("Usuário fora dos grupos autorizados do CIPOLATTI CHAT.");
    error.status = 403;
    throw error;
  }
  let bindOk = false;
  let lastError = "";
  for (const candidate of userBindCandidates(raw, entry, config)) {
    try {
      await ldapWhoAmI(candidate, password);
      bindOk = true;
      break;
    } catch (error) {
      lastError = error.stderr || error.message || "Falha no bind LDAP.";
    }
  }
  if (!bindOk) {
    const error = new Error("Usuário ou senha inválidos no Active Directory.");
    error.status = 401;
    error.detail = lastError;
    throw error;
  }
  return { entry, role };
}

async function loadActiveDirectoryUserByUsername(username) {
  const config = adConfig();
  if (!config.enabled || !config.servicePassword || !username) return null;
  const [entry] = await ldapSearch({
    bindDn: config.serviceBindDn,
    password: config.servicePassword,
    filter: `(&(objectClass=user)(sAMAccountName=${ldapEscape(username)}))`,
    attributes: [
      "distinguishedName", "sAMAccountName", "userPrincipalName", "displayName", "mail",
      "department", "title", "telephoneNumber", "mobile", "thumbnailPhoto", "memberOf",
      "userAccountControl", "objectGUID", "pwdLastSet", "lockoutTime", "accountExpires",
      "msDS-UserPasswordExpiryTimeComputed",
    ],
  });
  if (!entry || !activeDirectoryUserIsActive(entry)) return null;
  const role = roleFromAdMembership(entry, config);
  if (!role) return null;
  return { entry, role, snapshot: adUserSnapshot(entry, role) };
}

function adUserSnapshot(entry, role) {
  const username = normalizeCredential(firstAttr(entry, "sAMAccountName"));
  const email = normalizeCredential(firstAttr(entry, "mail") || firstAttr(entry, "userPrincipalName") || `${username}@${config.domain || "example.local"}`);
  const displayName = firstAttr(entry, "displayName") || username;
  const loginAliases = uniqueCredentials([email, username, firstAttr(entry, "userPrincipalName")])
    .filter((alias) => alias !== LOCAL_ADMIN_USERNAME);
  return {
    adObjectGuid: firstAttr(entry, "objectGUID"),
    adDistinguishedName: firstAttr(entry, "distinguishedName") || entry.dn || "",
    adPwdLastSet: firstAttr(entry, "pwdLastSet") || "",
    adPasswordExpiresAt: firstAttr(entry, "msDS-UserPasswordExpiryTimeComputed") || "",
    name: displayName,
    displayName,
    email,
    username,
    role,
    department: firstAttr(entry, "department") || "",
    jobTitle: firstAttr(entry, "title") || "",
    phone: firstAttr(entry, "mobile") || firstAttr(entry, "telephoneNumber") || "",
    extension: firstAttr(entry, "telephoneNumber") || "",
    loginAliases,
  };
}

async function passwordRecord(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await scrypt(String(password), salt, 64);
  return { passwordSalt: salt, passwordHash: Buffer.from(derived).toString("hex") };
}

async function passwordMatches(password, user) {
  if (!user.passwordSalt || !user.passwordHash) return false;
  const derived = await scrypt(String(password), user.passwordSalt, 64);
  const actual = Buffer.from(derived);
  const expected = Buffer.from(user.passwordHash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function tokenHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function newToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function requestIp(request) {
  return String(request.headers["x-forwarded-for"] || request.socket.remoteAddress || "").split(",")[0].trim();
}

function requestUserAgent(request) {
  return String(request.headers["user-agent"] || "").slice(0, 300);
}

function cookies(request) {
  return Object.fromEntries(String(request.headers.cookie || "").split(";").map((item) => item.trim()).filter(Boolean).map((item) => {
    const index = item.indexOf("=");
    return index < 0 ? [item, ""] : [item.slice(0, index), decodeURIComponent(item.slice(index + 1))];
  }));
}

function secureRequest(request) {
  return request.headers["x-forwarded-proto"] === "https";
}

function normalizeOrigin(value) {
  try {
    const url = new URL(String(value || "").trim());
    return `${url.protocol}//${url.host}`;
  } catch {
    return "";
  }
}

function envUrl(value) {
  return normalizeOrigin(value);
}

function internalOrigins() {
  const configured = String(process.env.KALION_ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => normalizeOrigin(item))
    .filter(Boolean);
  const values = [
    ...configured,
    envUrl(process.env.PUBLIC_BASE_URL),
  ];
  return new Set(values.filter(Boolean));
}

export function isAllowedOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) return false;
  const hostOrigin = normalizeOrigin(`${request.headers["x-forwarded-proto"] || "https"}://${request.headers.host || ""}`);
  return normalizedOrigin === hostOrigin || internalOrigins().has(normalizedOrigin);
}

export function applyCorsHeaders(request, response) {
  const origin = request.headers.origin;
  if (!origin || !isAllowedOrigin(request)) return;
  response.setHeader("Access-Control-Allow-Origin", normalizeOrigin(origin));
  response.setHeader("Access-Control-Allow-Credentials", "true");
  response.setHeader("Vary", "Origin");
}

export function handleCorsPreflight(request, response) {
  if (request.method !== "OPTIONS") return false;
  if (!isAllowedOrigin(request)) {
    response.writeHead(403, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    response.end(JSON.stringify({ error: "Origem da requisição inválida." }));
    return true;
  }
  applyCorsHeaders(request, response);
  response.writeHead(204, {
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Kalion-Api-Key",
    "Access-Control-Max-Age": "600",
    "Cache-Control": "no-store",
  });
  response.end();
  return true;
}

export function setSessionCookie(response, token, request) {
  const secure = secureRequest(request) ? "; Secure" : "";
  response.setHeader("Set-Cookie", `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(SESSION_LIFETIME_MS / 1000)}${secure}`);
}

function appendCookie(response, cookie) {
  const current = response.getHeader("Set-Cookie");
  if (!current) return response.setHeader("Set-Cookie", cookie);
  response.setHeader("Set-Cookie", Array.isArray(current) ? [...current, cookie] : [current, cookie]);
}

export function setRememberCookie(response, token, request, maxAgeSeconds = Math.floor(REMEMBER_AD_LIFETIME_MS / 1000)) {
  const secure = secureRequest(request) ? "; Secure" : "";
  appendCookie(response, `${REMEMBER_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}${secure}`);
}

export function clearSessionCookie(response, request) {
  const secure = secureRequest(request) ? "; Secure" : "";
  response.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`);
}

export function clearRememberCookie(response, request) {
  const secure = secureRequest(request) ? "; Secure" : "";
  appendCookie(response, `${REMEMBER_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`);
}

export function validateMutationOrigin(request) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return true;
  return isAllowedOrigin(request);
}

export async function ensureAuthSchema() {
  const data = await readStore();
  if (Array.isArray(data.users) && data.users.length) {
    await updateStore((store) => {
      store.permissions ||= {};
      const legacyUserPermissions = legacyUserPermissionKeys.map((key) => store.permissions[key]).find(Boolean);
      store.permissions.Administrador = {
        pages: rolePages.Administrador,
        capabilities: roleCapabilities.Administrador,
      };
      store.permissions.Gestor ||= {
        pages: rolePages.Gestor,
        capabilities: roleCapabilities.Gestor,
      };
      store.permissions["Usuário"] = legacyUserPermissions || {
        pages: rolePages["Usuário"],
        capabilities: roleCapabilities["Usuário"],
      };
      legacyUserPermissionKeys.filter((key) => key !== "Usuário").forEach((key) => {
        delete store.permissions[key];
      });
      for (const user of store.users || []) {
        const canonicalRole = normalizeRole(user.role);
        if (user.role !== canonicalRole) user.role = canonicalRole;
        user.department = user.department || user.dept || "";
        user.accessStatus ||= "Ativo";
        if (normalizeCredential(user.username) === LOCAL_ADMIN_USERNAME) {
          user.loginAliases = [];
          user.authProvider = "local";
          delete user.adObjectGuid;
          delete user.adDistinguishedName;
        } else {
          user.loginAliases = uniqueCredentials(user.loginAliases || []);
        }
      }
      store.sessions ||= [];
      store.rememberTokens ||= [];
      store.loginLogs ||= [];
    });
    return;
  }
  const bootstrapPassword = process.env.KALION_BOOTSTRAP_ADMIN_PASSWORD;
  if (!bootstrapPassword) throw new Error("KALION_BOOTSTRAP_ADMIN_PASSWORD precisa ser configurada para inicializar a autenticação.");
  const adminPassword = await passwordRecord(bootstrapPassword);
  await updateStore((store) => {
    store.permissions ||= Object.fromEntries(Object.keys(rolePages).map((role) => [role, {
        pages: rolePages["Usuário"],
        capabilities: roleCapabilities["Usuário"],
    }]));
    store.users ||= [];
    if (!store.users.length) {
      store.users.push({
        id: createId("user"),
        name: "Administrador",
        email: "administrador@kalion.local",
        username: "administrador",
        role: "Administrador",
        department: "TI",
        status: "Online",
      accessStatus: "Ativo",
      photoUrl: "",
        mustChangePassword: false,
        failedAttempts: 0,
        lockedUntil: null,
        initials: "AD",
        ...adminPassword,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    store.sessions ||= [];
    store.rememberTokens ||= [];
    store.loginLogs ||= [];
  });
}

function createSessionRecord(user, request, now = Date.now()) {
  const token = newToken();
  const adSession = user.authProvider === "ad" ? {
    authProvider: "ad",
    objectGUID: user.adObjectGuid || "",
    pwdLastSet: user.adPwdLastSet || "",
    adValidatedAt: new Date().toISOString(),
    adGroups: user.adGroups || [],
    role: normalizeRole(user.role),
  } : {
    authProvider: user.authProvider || "local",
  };
  return {
    token,
    session: {
      id: createId("session"),
      tokenHash: tokenHash(token),
      userId: user.id,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(now + SESSION_LIFETIME_MS).toISOString(),
      idleExpiresAt: new Date(now + SESSION_IDLE_MS).toISOString(),
      lastSeenAt: new Date().toISOString(),
      ip: requestIp(request),
      userAgent: requestUserAgent(request),
      ...adSession,
    },
  };
}

function revokeUserSessionsForSecurity(data, user, reason, request = null) {
  const nowIso = new Date().toISOString();
  let sessionCount = 0;
  let rememberCount = 0;
  data.sessions = (data.sessions || []).filter((session) => {
    const match = session.userId === user.id || (user.adObjectGuid && session.objectGUID === user.adObjectGuid);
    if (match) sessionCount += 1;
    return !match;
  });
  for (const token of data.rememberTokens || []) {
    const match = token.userId === user.id || (user.adObjectGuid && token.objectGUID === user.adObjectGuid);
    if (match && !token.revokedAt) {
      token.revokedAt = nowIso;
      token.revokedReason = reason;
      rememberCount += 1;
    }
  }
  user.sessionInvalidAfter = nowIso;
  data.auditLogs ||= [];
  data.auditLogs.unshift({
    id: createId("audit"),
    at: nowIso,
    action: "Sessões AD revogadas por segurança",
    detail: `${user.username}: ${reason}; sessões: ${sessionCount}; tokens persistentes: ${rememberCount}`,
    actor: "Active Directory",
    actorId: user.id,
    ip: request ? requestIp(request) : "",
  });
  data.loginLogs ||= [];
  data.loginLogs.unshift({
    id: createId("login"),
    at: nowIso,
    userId: user.id,
    login: user.username,
    action: `Sessões encerradas: ${reason}`,
    ip: request ? requestIp(request) : "",
  });
  data.loginLogs = data.loginLogs.slice(0, 1000);
  return { sessionCount, rememberCount };
}

function sessionInvalidatedByUser(user, session) {
  if (!user?.sessionInvalidAfter || !session?.createdAt) return false;
  return new Date(session.createdAt).getTime() <= new Date(user.sessionInvalidAfter).getTime();
}

function createRememberRecord(user, request) {
  const token = newToken();
  const now = Date.now();
  return {
    token,
    record: {
      id: createId("remember"),
      userId: user.id,
      tokenHash: tokenHash(token),
      objectGUID: user.adObjectGuid || "",
      pwdLastSet: user.adPwdLastSet || "",
      role: normalizeRole(user.role),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(now + REMEMBER_AD_LIFETIME_MS).toISOString(),
      lastUsedAt: new Date().toISOString(),
      revokedAt: null,
      revokedReason: "",
      ip: requestIp(request),
      lastIp: requestIp(request),
      userAgent: requestUserAgent(request),
      deviceId: tokenHash(`${requestUserAgent(request)}|${requestIp(request)}`).slice(0, 24),
    },
  };
}

export async function login(identifier, password, request, remember = false) {
  let result;
  await updateStore(async (data) => {
    const normalized = normalizeCredential(identifier);
    const isLocalAdminLogin = normalized === LOCAL_ADMIN_USERNAME;
    let user = isLocalAdminLogin
      ? data.users.find((item) => normalizeCredential(item.username) === LOCAL_ADMIN_USERNAME && item.authProvider !== "ad")
      : null;
    const now = Date.now();
    let failure = "";
    let status = 401;
    let countPasswordFailure = false;
    let loginSource = "local";
    let syncedFields = [];

    if (isLocalAdminLogin) {
      if (!user) {
        failure = "E-mail, usuario ou senha invalidos.";
      } else if (user.accessStatus !== "Ativo") {
        failure = "Usuario inativo. Solicite reativacao ao Administrador.";
        status = 403;
      } else if (user.lockedUntil && new Date(user.lockedUntil).getTime() > now) {
        failure = "Usuario temporariamente bloqueado por tentativas invalidas.";
        status = 423;
      } else if (!(await passwordMatches(password, user))) {
        failure = "E-mail, usuario ou senha invalidos.";
        countPasswordFailure = true;
      }
    } else {
      try {
        const adResult = await authenticateActiveDirectory(identifier, password);
        const snapshot = adUserSnapshot(adResult.entry, adResult.role);
        loginSource = "Active Directory";
        user = data.users.find((item) =>
          canMatchActiveDirectoryIdentity(item)
          && item.adObjectGuid
          && item.adObjectGuid === snapshot.adObjectGuid
        )
          || data.users.find((item) =>
            canMatchActiveDirectoryIdentity(item)
            && (
              normalizeCredential(item.username) === snapshot.username
              || normalizeCredential(item.email) === snapshot.email
              || (item.loginAliases || []).some((alias) => snapshot.loginAliases.includes(normalizeCredential(alias)))
            )
          );
        if (!user) {
          user = {
            id: createId("user"),
            status: "Online",
            accessStatus: "Ativo",
            photoUrl: "",
            preferences: {},
            failedAttempts: 0,
            lockedUntil: null,
            mustChangePassword: false,
            authProvider: "ad",
            createdAt: new Date().toISOString(),
          };
          data.users.push(user);
          data.auditLogs ||= [];
          data.auditLogs.unshift({
            id: createId("audit"), at: new Date().toISOString(), action: "Usuário AD criado automaticamente",
            detail: `${snapshot.username} (${snapshot.role})`, actor: "Active Directory", actorId: null,
            ip: request.socket.remoteAddress,
          });
        }
        const guidOwner = data.users.find((item) =>
          item.id !== user.id
          && item.adObjectGuid
          && item.adObjectGuid === snapshot.adObjectGuid
        );
        if (guidOwner) {
          const error = new Error("ObjectGUID duplicado. Login bloqueado para preservar integridade.");
          error.status = 409;
          throw error;
        }
        const before = {
          name: user.name, email: user.email, username: user.username, role: user.role,
          department: user.department, jobTitle: user.jobTitle, phone: user.phone,
        };
        Object.assign(user, {
          ...snapshot,
          authProvider: "ad",
          accessStatus: "Ativo",
          status: user.status || "Online",
          mustChangePassword: false,
          failedAttempts: 0,
          lockedUntil: null,
          initials: initials(snapshot.name),
          updatedAt: new Date().toISOString(),
        });
        user.loginAliases = uniqueCredentials(user.loginAliases).filter((alias) => alias !== LOCAL_ADMIN_USERNAME);
        delete user.passwordHash;
        delete user.passwordSalt;
        syncedFields = Object.entries(before)
          .filter(([key, value]) => value !== user[key])
          .map(([key]) => key);
        if (syncedFields.length) {
          data.auditLogs ||= [];
          data.auditLogs.unshift({
            id: createId("audit"), at: new Date().toISOString(), action: "Sincronização AD realizada",
            detail: `${user.username}: ${syncedFields.join(", ")}`, actor: "Active Directory", actorId: user.id,
            ip: request.socket.remoteAddress,
          });
        }
      } catch (error) {
        failure = error.message || "Falha na autenticação Active Directory.";
        status = error.status || 401;
      }
    }

    if (failure) {
      if (user && countPasswordFailure) {
        const attempts = (user.failedAttempts || 0) + 1;
        user.failedAttempts = attempts >= 5 ? 0 : attempts;
        user.lockedUntil = attempts >= 5 ? new Date(now + 15 * 60 * 1000).toISOString() : null;
      }
      data.loginLogs.unshift({
        id: createId("login"), at: new Date().toISOString(), userId: user?.id || null,
        login: normalized, action: `Falha no login: ${failure}`, ip: request.socket.remoteAddress,
      });
      data.loginLogs = data.loginLogs.slice(0, 1000);
      result = { error: failure, status };
      return;
    }
    user.failedAttempts = 0;
    user.lockedUntil = null;
    user.lastLoginAt = new Date().toISOString();
    const { token, session } = createSessionRecord(user, request, now);
    data.sessions = (data.sessions || []).filter((item) => new Date(item.expiresAt).getTime() > now && new Date(item.idleExpiresAt).getTime() > now);
    data.sessions.push(session);
    let rememberToken = null;
    if (remember && user.authProvider === "ad" && user.adObjectGuid) {
      const persistent = createRememberRecord(user, request);
      rememberToken = persistent.token;
      data.rememberTokens ||= [];
      data.rememberTokens.push(persistent.record);
      data.auditLogs ||= [];
      data.auditLogs.unshift({
        id: createId("audit"), at: new Date().toISOString(), action: "Token persistente criado",
        detail: `${user.username}: manter conectado ativado`, actor: user.name || user.username, actorId: user.id,
        ip: requestIp(request),
      });
    }
    data.loginLogs.unshift({
      id: createId("login"), at: new Date().toISOString(), userId: user.id,
      login: user.username, action: `Login realizado (${loginSource})`, ip: request.socket.remoteAddress,
    });
    data.loginLogs = data.loginLogs.slice(0, 1000);
    result = { token, rememberToken, rememberMaxAge: Math.floor(REMEMBER_AD_LIFETIME_MS / 1000), user: publicUser(user, data.permissions) };
  });
  return result;
}

export async function authenticate(request, options = {}) {
  const validateAd = Boolean(options.validateAd);
  const token = cookies(request)[SESSION_COOKIE];
  if (!token) return null;
  const hash = tokenHash(token);
  const data = await readStore();
  const now = Date.now();
  const session = (data.sessions || []).find((item) => item.tokenHash === hash);
  if (!session || new Date(session.expiresAt).getTime() <= now || new Date(session.idleExpiresAt).getTime() <= now) return null;
  const user = (data.users || []).find((item) => item.id === session.userId && item.accessStatus === "Ativo");
  if (!user) return null;
  if (sessionInvalidatedByUser(user, session)) {
    request.authError = { status: 401, error: "Sessão revogada. Faça login novamente.", clearSession: true, clearRemember: true };
    return null;
  }
  const shouldRevalidateAd = validateAd
    && user.authProvider === "ad"
    && user.adObjectGuid
    && !request.adSessionValidated;
  if (shouldRevalidateAd) {
    request.adSessionValidated = true;
    let authResult = null;
    await updateStore(async (store) => {
      store.sessions ||= [];
      store.rememberTokens ||= [];
      const current = store.sessions.find((item) => item.id === session.id);
      const currentUser = (store.users || []).find((item) => item.id === session.userId && item.accessStatus === "Ativo");
      if (!current || !currentUser || currentUser.authProvider !== "ad" || !currentUser.adObjectGuid) {
        authResult = { status: 401, error: "Sessão inválida ou expirada.", clearSession: true };
        return;
      }
      const ad = await loadActiveDirectoryUserByUsername(currentUser.username);
      if (!ad || ad.snapshot.adObjectGuid !== currentUser.adObjectGuid || (current.objectGUID && current.objectGUID !== ad.snapshot.adObjectGuid)) {
        revokeUserSessionsForSecurity(store, currentUser, "AD_ACCESS_REVOKED", request);
        authResult = { status: 403, error: "Seu acesso ao CIPOLATTI CHAT não está mais autorizado. Entre em contato com o setor de TI.", clearSession: true, clearRemember: true };
        return;
      }
      const sessionPwdLastSet = current.pwdLastSet || currentUser.adPwdLastSet || "";
      if (sessionPwdLastSet && sessionPwdLastSet !== ad.snapshot.adPwdLastSet) {
        revokeUserSessionsForSecurity(store, currentUser, AD_PASSWORD_CHANGED_CODE, request);
        authResult = { status: 401, code: AD_PASSWORD_CHANGED_CODE, title: AD_PASSWORD_CHANGED_TITLE, error: AD_PASSWORD_CHANGED_MESSAGE, clearSession: true, clearRemember: true };
        return;
      }
      Object.assign(currentUser, {
        ...ad.snapshot,
        authProvider: "ad",
        accessStatus: "Ativo",
        mustChangePassword: false,
        failedAttempts: 0,
        lockedUntil: null,
        initials: initials(ad.snapshot.name),
        updatedAt: new Date().toISOString(),
      });
      delete currentUser.passwordHash;
      delete currentUser.passwordSalt;
      Object.assign(current, {
        objectGUID: ad.snapshot.adObjectGuid,
        pwdLastSet: ad.snapshot.adPwdLastSet || "",
        adValidatedAt: new Date().toISOString(),
        adGroups: ad.snapshot.adGroups || [],
        role: normalizeRole(ad.snapshot.role),
        lastSeenAt: new Date().toISOString(),
        idleExpiresAt: new Date(now + SESSION_IDLE_MS).toISOString(),
      });
      authResult = { user: publicUser(currentUser, store.permissions), sessionId: current.id };
    });
    if (authResult?.user) return { ...authResult.user, sessionId: authResult.sessionId };
    request.authError = authResult || { status: 401, error: "Sessão inválida ou expirada.", clearSession: true };
    return null;
  }
  if (now - new Date(session.lastSeenAt || session.createdAt).getTime() > 5 * 60 * 1000) {
    updateStore((store) => {
      const current = store.sessions.find((item) => item.id === session.id);
      if (current) {
        current.lastSeenAt = new Date().toISOString();
        current.idleExpiresAt = new Date(now + SESSION_IDLE_MS).toISOString();
      }
    }).catch(() => {});
  }
  return { ...publicUser(user, data.permissions), sessionId: session.id };
}

export async function restoreRememberedSession(request) {
  const rememberToken = cookies(request)[REMEMBER_COOKIE];
  if (!rememberToken) return null;
  const rememberHash = tokenHash(rememberToken);
  let result = null;
  await updateStore(async (data) => {
    const now = Date.now();
    data.rememberTokens ||= [];
    const remember = data.rememberTokens.find((item) => item.tokenHash === rememberHash);
    if (remember?.revokedAt && remember.revokedReason === AD_PASSWORD_CHANGED_CODE) {
      result = { code: AD_PASSWORD_CHANGED_CODE, title: AD_PASSWORD_CHANGED_TITLE, error: AD_PASSWORD_CHANGED_MESSAGE, status: 401, clearRemember: true };
      return;
    }
    if (!remember || remember.revokedAt || new Date(remember.expiresAt).getTime() <= now) {
      result = { error: "Sessão persistente inválida ou expirada.", status: 401, clearRemember: true };
      return;
    }
    const user = (data.users || []).find((item) => item.id === remember.userId && item.accessStatus === "Ativo");
    if (!user || user.authProvider !== "ad" || !user.adObjectGuid) {
      remember.revokedAt = new Date().toISOString();
      remember.revokedReason = "Usuário inativo ou não AD";
      result = { error: "Sessão persistente revogada. Faça login novamente.", status: 401, clearRemember: true };
      return;
    }
    const ad = await loadActiveDirectoryUserByUsername(user.username);
    if (!ad || ad.snapshot.adObjectGuid !== remember.objectGUID || ad.snapshot.adObjectGuid !== user.adObjectGuid) {
      remember.revokedAt = new Date().toISOString();
      remember.revokedReason = "Conta AD removida, bloqueada, sem grupo ou objectGUID divergente";
      result = { error: "Seu acesso ao CIPOLATTI CHAT não está mais autorizado. Entre em contato com o setor de TI.", status: 403, clearRemember: true };
      return;
    }
    if ((remember.pwdLastSet || "") !== (ad.snapshot.adPwdLastSet || "")) {
      remember.revokedAt = new Date().toISOString();
      remember.revokedReason = AD_PASSWORD_CHANGED_CODE;
      result = { code: AD_PASSWORD_CHANGED_CODE, title: AD_PASSWORD_CHANGED_TITLE, error: AD_PASSWORD_CHANGED_MESSAGE, status: 401, clearRemember: true };
      return;
    }
    Object.assign(user, {
      ...ad.snapshot,
      authProvider: "ad",
      accessStatus: "Ativo",
      mustChangePassword: false,
      failedAttempts: 0,
      lockedUntil: null,
      initials: initials(ad.snapshot.name),
      updatedAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    });
    user.loginAliases = uniqueCredentials(user.loginAliases).filter((alias) => alias !== LOCAL_ADMIN_USERNAME);
    delete user.passwordHash;
    delete user.passwordSalt;

    const { token, session } = createSessionRecord(user, request, now);
    data.sessions = (data.sessions || []).filter((item) => new Date(item.expiresAt).getTime() > now && new Date(item.idleExpiresAt).getTime() > now);
    data.sessions.push(session);

    const rotated = createRememberRecord(user, request);
    remember.revokedAt = new Date().toISOString();
    remember.revokedReason = "Rotacionado após uso";
    remember.lastUsedAt = new Date().toISOString();
    remember.lastIp = requestIp(request);
    data.rememberTokens.push(rotated.record);
    data.loginLogs ||= [];
    data.loginLogs.unshift({
      id: createId("login"), at: new Date().toISOString(), userId: user.id,
      login: user.username, action: "Sessão restaurada por manter conectado", ip: requestIp(request),
    });
    data.loginLogs = data.loginLogs.slice(0, 1000);
    result = {
      token,
      rememberToken: rotated.token,
      rememberMaxAge: Math.floor(REMEMBER_AD_LIFETIME_MS / 1000),
      user: publicUser(user, data.permissions),
    };
  });
  return result;
}

export async function logout(request) {
  const token = cookies(request)[SESSION_COOKIE];
  const rememberToken = cookies(request)[REMEMBER_COOKIE];
  const hash = tokenHash(token);
  const rememberHash = tokenHash(rememberToken);
  await updateStore((data) => {
    const session = token ? (data.sessions || []).find((item) => item.tokenHash === hash) : null;
    if (session) data.loginLogs.unshift({
      id: createId("login"), at: new Date().toISOString(), userId: session.userId,
      action: "Logout realizado", ip: requestIp(request),
    });
    data.sessions = token ? (data.sessions || []).filter((item) => item.tokenHash !== hash) : (data.sessions || []);
    if (rememberToken) {
      for (const item of data.rememberTokens || []) {
        if (item.tokenHash === rememberHash && !item.revokedAt) {
          item.revokedAt = new Date().toISOString();
          item.revokedReason = "Logout manual";
        }
      }
    }
  });
}

function rememberStatus(token, now = Date.now()) {
  if (token.revokedAt) return "Revogada";
  if (new Date(token.expiresAt).getTime() <= now) return "Expirada";
  return "Ativa";
}

function parseUserAgent(value) {
  const userAgent = String(value || "");
  const browser = userAgent.includes("Edg/") ? "Edge"
    : userAgent.includes("Chrome/") ? "Chrome"
    : userAgent.includes("Firefox/") ? "Firefox"
    : userAgent.includes("Safari/") ? "Safari"
    : userAgent ? "Navegador identificado" : "Não informado";
  const os = userAgent.includes("Windows") ? "Windows"
    : userAgent.includes("Mac OS") ? "macOS"
    : userAgent.includes("Android") ? "Android"
    : userAgent.includes("iPhone") || userAgent.includes("iPad") ? "iOS"
    : userAgent.includes("Linux") ? "Linux"
    : "Não identificado";
  return { browser, os };
}

function rememberTokenView(token, usersById) {
  const user = usersById.get(token.userId);
  const agent = parseUserAgent(token.userAgent);
  return {
    id: token.id,
    userId: token.userId,
    name: user?.displayName || user?.name || token.userId,
    username: user?.username || "",
    authProvider: user?.authProvider || "",
    deviceId: token.deviceId || "",
    browser: agent.browser,
    os: agent.os,
    ip: token.ip || "",
    lastIp: token.lastIp || "",
    createdAt: token.createdAt,
    lastUsedAt: token.lastUsedAt,
    expiresAt: token.expiresAt,
    status: rememberStatus(token),
    revokedAt: token.revokedAt || "",
    revokedReason: token.revokedReason || "",
  };
}

function auditRememberAction(data, request, action, detail) {
  data.auditLogs ||= [];
  data.auditLogs.unshift({
    id: createId("audit"),
    at: new Date().toISOString(),
    action,
    detail,
    actor: request.auth?.name || request.auth?.username || "Sistema",
    actorId: request.auth?.id || null,
    ip: requestIp(request),
  });
}

export async function listPersistentSessions(actor) {
  if (!isAdmin(actor)) throw new Error("Sem permissão para visualizar sessões persistentes.");
  const data = await readStore();
  const usersById = new Map((data.users || []).map((user) => [user.id, user]));
  return (data.rememberTokens || [])
    .map((token) => rememberTokenView(token, usersById))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

export async function revokePersistentSession(tokenId, actor, request, reason = "Revogação administrativa") {
  if (!isAdmin(actor)) throw new Error("Sem permissão para revogar sessões persistentes.");
  let count = 0;
  await updateStore((data) => {
    for (const token of data.rememberTokens || []) {
      if (token.id === tokenId && !token.revokedAt) {
        token.revokedAt = new Date().toISOString();
        token.revokedReason = reason;
        count += 1;
      }
    }
    auditRememberAction(data, request, "Sessão persistente revogada", `Token: ${tokenId}; quantidade: ${count}; motivo: ${reason}`);
  });
  return { revoked: count };
}

export async function revokePersistentSessionsByUser(userId, actor, request, reason = "Revogação administrativa por usuário") {
  if (!isAdmin(actor)) throw new Error("Sem permissão para revogar sessões persistentes.");
  let count = 0;
  await updateStore((data) => {
    for (const token of data.rememberTokens || []) {
      if (token.userId === userId && !token.revokedAt) {
        token.revokedAt = new Date().toISOString();
        token.revokedReason = reason;
        count += 1;
      }
    }
    const user = (data.users || []).find((item) => item.id === userId);
    auditRememberAction(data, request, "Sessões persistentes do usuário revogadas", `Usuário: ${user?.username || userId}; quantidade: ${count}; motivo: ${reason}`);
  });
  return { revoked: count };
}

export async function revokeAllPersistentSessions(actor, request, reason = "Revogação administrativa global") {
  if (!isAdmin(actor)) throw new Error("Sem permissão para revogar sessões persistentes.");
  let count = 0;
  await updateStore((data) => {
    for (const token of data.rememberTokens || []) {
      if (!token.revokedAt) {
        token.revokedAt = new Date().toISOString();
        token.revokedReason = reason;
        count += 1;
      }
    }
    auditRememberAction(data, request, "Todas as sessões persistentes revogadas", `Quantidade: ${count}; motivo: ${reason}`);
  });
  return { revoked: count };
}

export async function logoutAllDevices(userId, request) {
  let count = 0;
  await updateStore((data) => {
    data.sessions = (data.sessions || []).filter((session) => session.userId !== userId);
    for (const token of data.rememberTokens || []) {
      if (token.userId === userId && !token.revokedAt) {
        token.revokedAt = new Date().toISOString();
        token.revokedReason = "Sair de todos os dispositivos";
        count += 1;
      }
    }
    auditRememberAction(data, request, "Usuário saiu de todos os dispositivos", `Quantidade de tokens persistentes revogados: ${count}`);
  });
  return { revoked: count };
}

export async function changePassword(userId, currentPassword, newPassword) {
  let changed = false;
  await updateStore(async (data) => {
    const user = data.users.find((item) => item.id === userId);
    if (user?.authProvider === "ad") return;
    if (!user || (!user.mustChangePassword && !(await passwordMatches(currentPassword, user)))) return;
    Object.assign(user, await passwordRecord(newPassword), {
      mustChangePassword: false,
      updatedAt: new Date().toISOString(),
    });
    data.sessions = data.sessions.filter((item) => item.userId !== user.id);
    changed = true;
  });
  return changed;
}

export function isAdmin(user) {
  return user?.role === "Administrador";
}

export function canManageUsers(actor, target = null) {
  if (isAdmin(actor)) return true;
  return actor?.role === "Gestor" && (!target || (target.department || target.dept) === actor.department);
}

export function canAccessConversation(user, conversation) {
  if (isAdmin(user)) return true;
  if (user.role === "Gestor") return conversation.department === user.department;
  return conversation.owner === user.name
    || (conversation.department === user.department && ["waiting", "triage", "collecting_department_form"].includes(conversation.status));
}

function departmentKeys(data, departmentName) {
  const name = String(departmentName || "").trim();
  const department = (data.departments || []).find((item) => item.name === name || item.id === name);
  return new Set([name, department?.id, department?.name].filter(Boolean));
}

function conversationHasDepartmentLink(conversation, departmentKeysSet) {
  if (!conversation) return false;
  if (departmentKeysSet.has(conversation.department)) return true;
  return (conversation.transferHistory || []).some((item) =>
    departmentKeysSet.has(item.department) || departmentKeysSet.has(item.fromDepartment) || departmentKeysSet.has(item.toDepartment)
  );
}

function conversationHasUserLink(user, conversation) {
  if (!conversation) return false;
  if (conversation.owner === user.name || conversation.ownerId === user.id) return true;
  return (conversation.transferHistory || []).some((item) => item.userId === user.id || item.to === user.name || item.from === user.name);
}

export function canAccessContact(user, contact, data) {
  if (isAdmin(user)) return true;
  if (!contact) return false;
  const deptKeys = departmentKeys(data, user.department || user.dept);
  if (contact.visibilityScope === "global") return true;
  if (contact.ownerUserId === user.id || contact.createdBy === user.id) return true;
  if (contact.visibilityScope === "private") return false;
  if (deptKeys.has(contact.ownerDepartmentId) || deptKeys.has(contact.ownerDepartment)) return true;
  if ((contact.sharedDepartmentIds || []).some((item) => deptKeys.has(item))) return true;
  const linkedIds = new Set((contact.linkedAttendanceIds || []).filter(Boolean));
  const linkedConversations = (data.conversations || []).filter((conversation) =>
    linkedIds.has(conversation.id) || conversation.contactId === contact.id || conversation.phone === contact.phone
  );
  if (user.role === "Gestor") return linkedConversations.some((conversation) => conversationHasDepartmentLink(conversation, deptKeys));
  return linkedConversations.some((conversation) =>
    conversationHasUserLink(user, conversation) || conversationHasDepartmentLink(conversation, deptKeys)
  );
}

export function canManageContact(user, contact, data) {
  if (isAdmin(user)) return true;
  if (!canAccessContact(user, contact, data)) return false;
  if (contact.ownerUserId === user.id || contact.createdBy === user.id) return true;
  return user.role === "Gestor";
}

export function canAccessInternalConversation(user, conversation) {
  return (conversation.participantIds || []).includes(user.id);
}

export function canAccessMeeting(user, meeting) {
  if (isAdmin(user)) return true;
  if (user.role === "Gestor") return meeting.department === user.department;
  return meeting.ownerId === user.id || (meeting.participantIds || []).includes(user.id);
}

export function canAccessQuickReply(user, reply) {
  if (isAdmin(user)) return true;
  if (reply.scope === "global") return true;
  if (reply.scope === "department") return reply.department === user.department;
  return reply.ownerId === user.id;
}

export async function createUser(input, actor) {
  let created;
  await updateStore(async (data) => {
    const role = normalizeRole(input.role);
    if (!isAdmin(actor) && role !== "Usuário") throw new Error("Somente Administrador pode atribuir perfil administrativo.");
    const email = normalizeCredential(input.email);
    const username = normalizeCredential(input.username);
    if (!email || !username) throw new Error("E-mail e login são obrigatórios.");
    if ((data.users || []).some((item) => normalizeCredential(item.email) === email || normalizeCredential(item.username) === username)) {
      throw new Error("E-mail ou login já cadastrado.");
    }
    const password = await passwordRecord(input.password);
    created = {
      id: createId("user"), name: String(input.name || "").trim(), email,
      username, role,
      department: input.department || input.dept || actor.department,
      status: input.status || "Offline", accessStatus: input.accessStatus || "Ativo",
      photoUrl: input.photoUrl || "",
      loginAliases: Array.isArray(input.loginAliases) ? uniqueCredentials(input.loginAliases) : [],
      mustChangePassword: input.mustChangePassword !== false, initials: initials(input.name),
      failedAttempts: 0, lockedUntil: null, ...password,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    data.users.push(created);
  });
  const data = await readStore();
  return publicUser(created, data.permissions);
}

export async function updateUser(userId, input, actor) {
  let updated;
  await updateStore(async (data) => {
    const user = data.users.find((item) => item.id === userId);
    if (!user) throw new Error("Usuário não encontrado.");
    if (!canManageUsers(actor, user)) throw new Error("Sem permissão para editar este usuário.");
    const role = normalizeRole(input.role || user.role);
    if (!isAdmin(actor) && role !== "Usuário") throw new Error("Somente Administrador pode atribuir perfil administrativo.");
    if (user.id === actor.id && (role !== "Administrador" || input.accessStatus === "Inativo")) throw new Error("Não é permitido remover o próprio acesso administrativo.");
    const email = normalizeCredential(input.email || user.email);
    const username = normalizeCredential(input.username || user.username);
    const aliases = Array.isArray(input.loginAliases) ? uniqueCredentials(input.loginAliases) : uniqueCredentials(user.loginAliases || []);
    const duplicate = data.users.some((item) => item.id !== user.id && (
      normalizeCredential(item.email) === email
      || normalizeCredential(item.username) === username
      || (item.loginAliases || []).some((alias) => alias === email || alias === username)
      || aliases.some((alias) => alias && (alias === normalizeCredential(item.email) || alias === normalizeCredential(item.username) || (item.loginAliases || []).includes(alias)))
    ));
    if (duplicate) throw new Error("E-mail ou login já cadastrado.");
    Object.assign(user, {
      name: input.name?.trim() || user.name,
      email,
      username,
      role,
      department: input.department || input.dept || user.department,
      accessStatus: input.accessStatus || user.accessStatus,
      loginAliases: aliases,
      mustChangePassword: input.mustChangePassword ?? user.mustChangePassword,
      initials: initials(input.name || user.name),
      updatedAt: new Date().toISOString(),
    });
    if (input.password) Object.assign(user, await passwordRecord(input.password), { mustChangePassword: input.mustChangePassword !== false });
    data.sessions = data.sessions.filter((item) => item.userId !== user.id || user.id === actor.id);
    updated = user;
  });
  const data = await readStore();
  return publicUser(updated, data.permissions);
}

export async function deleteUser(userId, actor) {
  await updateStore((data) => {
    const user = data.users.find((item) => item.id === userId);
    if (!user) throw new Error("Usuário não encontrado.");
    if (!isAdmin(actor)) throw new Error("Somente Administrador pode excluir usuários.");
    if (user.id === actor.id) throw new Error("Não é permitido excluir a própria conta.");
    const admins = data.users.filter((item) => item.role === "Administrador" && item.accessStatus === "Ativo");
    if (user.role === "Administrador" && admins.length === 1) throw new Error("Não é permitido excluir o último Administrador ativo.");
    data.users = data.users.filter((item) => item.id !== user.id);
    data.sessions = data.sessions.filter((item) => item.userId !== user.id);
    for (const conversation of data.conversations) {
      if (conversation.owner === user.name && conversation.status !== "closed") {
        conversation.owner = "Não atribuído";
        conversation.status = "waiting";
      }
    }
    for (const department of data.departments) {
      department.members = (department.members || []).filter((name) => name !== user.name);
      if (department.manager === user.name) department.manager = "Não definido";
    }
  });
}

export async function listUsers(actor) {
  const data = await readStore();
  return data.users
    .filter(isVisibleOperationalUser)
    .map((user) => publicUser(user, data.permissions));
}

export async function listPermissions() {
  const data = await readStore();
  const sanitized = {};
  for (const role of Object.keys(rolePages)) {
    const safePages = new Set(rolePages[role]);
    sanitized[role] = {
      pages: role === "Administrador"
        ? rolePages.Administrador
        : (Array.isArray(data.permissions?.[role]?.pages)
          ? data.permissions[role].pages.filter((page) => safePages.has(page))
          : rolePages[role]),
      capabilities: role === "Administrador"
        ? roleCapabilities.Administrador
        : (Array.isArray(data.permissions?.[role]?.capabilities)
          ? data.permissions[role].capabilities
          : roleCapabilities[role]),
    };
  }
  return sanitized;
}

export async function savePermissions(input) {
  await updateStore((data) => {
    data.permissions ||= {};
    data.permissions.Administrador = {
      pages: rolePages.Administrador,
      capabilities: roleCapabilities.Administrador,
    };
    for (const role of Object.keys(rolePages)) {
      if (role === "Administrador") continue;
      if (!input[role]) continue;
      const safePages = new Set(rolePages[role]);
      data.permissions[role] = {
        pages: Array.from(new Set(input[role].pages || [])).filter((page) => safePages.has(page)),
        capabilities: Array.from(new Set(input[role].capabilities || [])),
      };
    }
  });
  return listPermissions();
}
