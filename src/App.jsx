import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity, AlertTriangle, Archive, ArrowLeftRight, BarChart3, Bell, Building2, CalendarDays, CheckCircle2,
  ChevronDown, ChevronLeft, ChevronRight, CircleGauge, Clock3, Contact, Download, FileText,
  Eye, EyeOff, Filter, Headphones, History, Image, KeyRound, LockKeyhole, LogOut, Menu,
  MessageCircle, MessageSquare, Mic, MonitorUp, MoreHorizontal, Paperclip, Pencil, Phone,
  Plus, RefreshCw, Save, Search, Send, Settings, ShieldCheck, SlidersHorizontal,
  Smile, StopCircle, Tags, Trash2, UserPlus, Users, Video, Webhook, X, Zap
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from "recharts";
import { activity, chartData, contacts, departments, users } from "./data";

const BRAND_NAME = "CIPOLATTI";
const BRAND_SUBTITLE = "Central de Atendimento Corporativo";
const BRAND_ICON = `${import.meta.env.BASE_URL}cipolatti-icon.png`;
const FRONTEND_BUILD_VERSION = "2026.08.21.11";
const DEFAULT_API_TIMEOUT_MS = 15000;
const LOGIN_API_TIMEOUT_MS = 15000;
const appLifecycle = { hiddenAt: 0, resumedAt: Date.now() };
const MESSAGE_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "👏", "✅"];
const PUSH_PROMPT_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
const PUSH_BLOCKED_NOTICE_SNOOZE_MS = 24 * 60 * 60 * 1000;
const EMOJI_CATEGORIES = [
  { id: "recent", label: "Recentes", icon: "🕘", keywords: "" },
  { id: "faces", label: "Carinhas", icon: "😀", keywords: "feliz sorriso risada triste choro bravo raiva surpresa pensar sono abraco amor", emojis: "😀 😃 😄 😁 😂 🤣 😊 😍 🥰 😎 😉 😌 😋 😜 🤪 😇 🙂 🙃 😢 😭 😡 😠 😱 😨 🤔 🙄 😴 🤗 🥳 😬 😅 😮 😯 😲 😤 😭 😘 😚 😙 😗".split(" ") },
  { id: "people", label: "Gestos", icon: "👍", keywords: "joinha positivo negativo palmas obrigado forca ok paz acordo mao gesto", emojis: "👍 👎 👏 🙏 💪 👌 ✌️ 🤝 👋 🤚 🖐️ ✋ 🫶 🤌 🤟 🤘 ☝️ 👇 👉 👈 🙌 👐 🤲 💅".split(" ") },
  { id: "hearts", label: "Corações", icon: "❤️", keywords: "coracao amor verde azul amarelo laranja roxo preto branco", emojis: "❤️ 💚 💙 💛 🧡 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝".split(" ") },
  { id: "symbols", label: "Símbolos", icon: "✅", keywords: "ok certo errado alerta importante fixar fogo festa aniversario sinal", emojis: "✅ ❌ ⚠️ 📌 🔥 🎉 🎂 ⭐ ✨ 💡 ❗ ❓ ⛔ 🚫 ✔️ ☑️ 🔔 🔕 📣 💬 📨 📎 🧾".split(" ") },
  { id: "nature", label: "Natureza", icon: "🌳", keywords: "animal natureza arvore flor sol lua chuva fogo estrela", emojis: "🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🌳 🌲 🌱 🌿 🍀 🌹 🌻 🌞 🌙 ⭐ 🌧️ ⚡ 🌈".split(" ") },
  { id: "food", label: "Comidas", icon: "🍕", keywords: "comida bebida cafe bolo pizza fruta almoco", emojis: "🍎 🍌 🍇 🍓 🍍 🥑 🍞 🧀 🍔 🍟 🍕 🌭 🥪 🌮 🍝 🍜 🍣 🍰 🎂 ☕ 🍵 🥤 🍺 🥂".split(" ") },
  { id: "activity", label: "Atividades", icon: "⚽", keywords: "atividade esporte jogo musica premio meta trabalho", emojis: "⚽ 🏀 🏈 ⚾ 🎾 🏐 🏓 🎮 🎲 🎯 🏆 🥇 🎧 🎤 🎬 🎨 🎸 🧩 🚴 🏃 🏋️".split(" ") },
  { id: "travel", label: "Lugares", icon: "🚗", keywords: "viagem lugar carro casa empresa predio aviao local", emojis: "🚗 🚕 🚌 🚚 🏍️ 🚲 ✈️ 🚀 🚁 ⛵ 🏠 🏢 🏭 🏥 🏦 🏫 🏪 🏙️ 🌆 📍 🗺️".split(" ") },
  { id: "objects", label: "Objetos", icon: "💼", keywords: "objeto trabalho telefone computador arquivo email calendario", emojis: "💼 💻 🖥️ ⌨️ 🖱️ 📱 ☎️ 📞 📧 ✉️ 📁 📂 📄 📊 📈 📉 📅 🕒 🔒 🔑 🛠️ 🖊️ 📝".split(" ") },
  { id: "flags", label: "Bandeiras", icon: "🏳️", keywords: "bandeira brasil pais", emojis: "🇧🇷 🇺🇸 🇵🇹 🇪🇸 🇫🇷 🇩🇪 🇮🇹 🇦🇷 🇨🇱 🇺🇾 🇵🇾 🇧🇴 🇲🇽 🇨🇦 🇯🇵 🇨🇳 🇬🇧 🏁 🏳️".split(" ") },
];
const ALL_EMOJIS = EMOJI_CATEGORIES.filter((category) => category.id !== "recent").flatMap((category) => category.emojis.map((emoji) => ({ emoji, category })));
const MESSAGE_FONT_SIZE_OPTIONS = [
  { value: "small", label: "Pequena", size: "14 px" },
  { value: "default", label: "Padrão", size: "16 px" },
  { value: "large", label: "Grande", size: "18 px" },
  { value: "xlarge", label: "Muito grande", size: "20 px" },
];

if (typeof window !== "undefined" && !window.__cipolattiLifecycleListeners) {
  window.__cipolattiLifecycleListeners = true;
  const markResumed = () => { appLifecycle.resumedAt = Date.now(); };
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) appLifecycle.hiddenAt = Date.now();
    else markResumed();
  });
  window.addEventListener("pageshow", markResumed);
  window.addEventListener("focus", markResumed);
  window.addEventListener("online", markResumed);
}

function normalizeSearchText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function sortByDisplayName(items = []) {
  return [...items].sort((a, b) => normalizeSearchText(a.displayName || a.name || a.username || a.email)
    .localeCompare(normalizeSearchText(b.displayName || b.name || b.username || b.email), "pt-BR"));
}

function searchMessageText(message = {}) {
  const parts = [
    message.text,
    message.sender,
    message.file?.name,
    message.file?.originalName,
    message.file?.extension,
    message.audio?.name,
    message.albumCaption,
    message.itemCaption,
    ...(Array.isArray(message.albumFiles) ? message.albumFiles.flatMap((item) => [item?.text, item?.itemCaption, item?.file?.name, item?.file?.originalName]) : []),
  ];
  return parts.filter(Boolean).join(" ");
}

function splitTextBySearch(text = "", query = "") {
  const raw = String(text || "");
  const needle = normalizeSearchText(query).trim();
  if (!needle) return [raw];
  const normalized = normalizeSearchText(raw);
  const pieces = [];
  let cursor = 0;
  let index = normalized.indexOf(needle);
  while (index >= 0) {
    if (index > cursor) pieces.push(raw.slice(cursor, index));
    pieces.push({ match: raw.slice(index, index + needle.length) });
    cursor = index + needle.length;
    index = normalized.indexOf(needle, cursor);
  }
  if (cursor < raw.length) pieces.push(raw.slice(cursor));
  return pieces.length ? pieces : [raw];
}

const urlPattern = /((?:https?:\/\/|www\.)[^\s<>"']+)/gi;
const trailingUrlPunctuation = /[.,!?;:)\]}>]+$/;

function linkHref(value = "") {
  const href = /^www\./i.test(value) ? `https://${value}` : value;
  try {
    const parsed = new URL(href);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    return parsed.href;
  } catch {
    return "";
  }
}

function PlainHighlightedText({ text = "", query = "" }) {
  return splitTextBySearch(text, query).map((part, index) => {
    if (typeof part === "string") return <React.Fragment key={index}>{part || <br />}</React.Fragment>;
    return <mark className="message-search-mark" key={index}>{part.match}</mark>;
  });
}

function FormattedPlainText({ text = "", query = "" }) {
  const raw = String(text || "");
  const pieces = [];
  const boldPattern = /\*([^*\n]+)\*/g;
  let cursor = 0;
  for (const match of raw.matchAll(boldPattern)) {
    const start = match.index || 0;
    const value = match[0];
    const inner = match[1] || "";
    if (!inner.trim()) continue;
    if (start > cursor) pieces.push({ type: "text", value: raw.slice(cursor, start) });
    pieces.push({ type: "bold", value: inner });
    cursor = start + value.length;
  }
  if (cursor < raw.length) pieces.push({ type: "text", value: raw.slice(cursor) });
  if (!pieces.length) return <PlainHighlightedText text={raw} query={query} />;
  return pieces.map((piece, index) => piece.type === "bold"
    ? <strong className="message-bold" key={index}><PlainHighlightedText text={piece.value} query={query} /></strong>
    : <PlainHighlightedText key={index} text={piece.value} query={query} />);
}

function LinkifiedText({ text = "", query = "" }) {
  const raw = String(text || "");
  if (!raw) return <br />;
  const pieces = [];
  let cursor = 0;
  for (const match of raw.matchAll(urlPattern)) {
    const start = match.index || 0;
    const value = match[0];
    if (start > cursor) pieces.push({ type: "text", value: raw.slice(cursor, start) });
    let linkText = value;
    let suffix = "";
    const punctuation = linkText.match(trailingUrlPunctuation)?.[0] || "";
    if (punctuation) {
      linkText = linkText.slice(0, -punctuation.length);
      suffix = punctuation;
    }
    const href = linkHref(linkText);
    if (href) pieces.push({ type: "link", value: linkText, href });
    else pieces.push({ type: "text", value });
    if (suffix) pieces.push({ type: "text", value: suffix });
    cursor = start + value.length;
  }
  if (cursor < raw.length) pieces.push({ type: "text", value: raw.slice(cursor) });
  return pieces.map((piece, index) => piece.type === "link"
    ? <a key={index} className="message-link" href={piece.href} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()}><PlainHighlightedText text={piece.value} query={query} /></a>
    : <FormattedPlainText key={index} text={piece.value} query={query} />);
}

function HighlightedText({ text = "", query = "" }) {
  return <LinkifiedText text={text} query={query} />;
}

const navSections = [
  {
    label: "Principal",
    items: [
      ["conversas", "Conversas", MessageCircle],
      ["grupos", "Grupos", Users],
      ["agenda", "Agenda Compartilhada", CalendarDays],
      ["departamentos", "Departamentos", Building2],
      ["usuarios", "Usuários", UserPlus],
    ],
  },
  {
    label: "Administração",
    items: [
      ["configuracoes", "Configurações", Settings],
    ],
  },
];

const pageMeta = {
  conversas: ["Conversas", "Mensagens diretas entre colaboradores"],
  grupos: ["Grupos", "Conversas coletivas internas"],
  agenda: ["Agenda Compartilhada", "Reuniões internas e compromissos"],
  departamentos: ["Departamentos", "Equipes e estrutura organizacional"],
  usuarios: ["Usuários", "Diretório corporativo interno"],
  configuracoes: ["Configurações", "Meu perfil e preferências pessoais"],
};
function readStored(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

const accessByRole = {
  Administrador: new Set(navSections.flatMap((section) => section.items.map(([id]) => id))),
  Gestor: new Set(["conversas", "grupos", "agenda", "departamentos", "usuarios", "configuracoes"]),
  Supervisor: new Set(["conversas", "grupos", "agenda", "departamentos", "usuarios", "configuracoes"]),
  "Usuário": new Set(["conversas", "grupos", "agenda", "usuarios", "configuracoes"]),
  Atendente: new Set(["conversas", "grupos", "agenda", "usuarios", "configuracoes"]),
  Consulta: new Set(["conversas", "grupos", "agenda", "usuarios", "configuracoes"]),
};
const allowedInternalPages = new Set(navSections.flatMap((section) => section.items.map(([id]) => id)));

function normalizeRoleName(role) {
  const normalized = String(role || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (["administrador", "admin", "administrator"].includes(normalized)) return "Administrador";
  if (["gestor", "manager", "supervisor"].includes(normalized)) return "Gestor";
  return "Usuário";
}

function canAccessPage(user, page) {
  if (!allowedInternalPages.has(page)) return false;
  const rolePages = accessByRole[normalizeRoleName(user?.role)] || accessByRole["Usuário"];
  return rolePages?.has(page) ?? false;
}

function generateTemporaryPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const random = crypto.getRandomValues(new Uint8Array(10));
  return `${Array.from(random, (value) => chars[value % chars.length]).join("")}Aa1@`;
}

function downloadFile(filename, content, type = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function timeoutMessageFor(path, timeoutMs) {
  if (path === "/api/auth/login") return "O login foi enviado, mas a API nao respondeu em tempo habil. Tente novamente ou entre em contato com a equipe de TI.";
  if (path === "/api/auth/me") return "Nao foi possivel validar a sessao no tempo esperado. Fa?a login novamente.";
  return `A requisicao ${path} nao respondeu em ${Math.round(timeoutMs / 1000)} segundos.`;
}

function isLikelySuspendedRequest(startedAt) {
  return Boolean(document.hidden || appLifecycle.hiddenAt >= startedAt || Date.now() - appLifecycle.resumedAt < 5000);
}

async function apiRequest(path, options = {}) {
  const apiBase = String(import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");
  const target = path.startsWith("/api/") ? (apiBase ? `${apiBase}${path.slice(4)}` : path) : path;
  const isFormData = options.body instanceof FormData;
  const timeoutMs = Number(options.timeoutMs || DEFAULT_API_TIMEOUT_MS);
  const startedAt = Date.now();
  const startedHidden = document.hidden;
  const controller = new AbortController();
  const externalSignal = options.signal;
  const abortFromExternal = () => controller.abort(externalSignal?.reason);
  if (externalSignal?.aborted) abortFromExternal();
  else externalSignal?.addEventListener?.("abort", abortFromExternal, { once: true });
  const timer = window.setTimeout(() => controller.abort(new Error("API_TIMEOUT")), timeoutMs);
  let response;
  let payload;
  try {
    const { timeoutMs: _timeoutMs, signal: _signal, ...fetchOptions } = options;
    response = await fetch(target, {
      ...fetchOptions,
      credentials: "include",
      signal: controller.signal,
      headers: { ...(isFormData ? {} : { "Content-Type": "application/json" }), ...(options.headers || {}) },
    });
    payload = await response.json().catch(() => ({}));
  } catch (error) {
    if (error?.name === "AbortError" || controller.signal.aborted) {
      if (startedHidden || isLikelySuspendedRequest(startedAt)) {
        const suspendedError = new Error("Requisição pausada enquanto o aplicativo estava em segundo plano.");
        suspendedError.code = "APP_SUSPENDED";
        suspendedError.path = path;
        throw suspendedError;
      }
      const timeoutError = new Error(timeoutMessageFor(path, timeoutMs));
      timeoutError.code = "API_TIMEOUT";
      timeoutError.path = path;
      throw timeoutError;
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
    externalSignal?.removeEventListener?.("abort", abortFromExternal);
  }
  if (!response.ok) {
    const error = new Error(payload.error || `Erro ${response.status} ao acessar o backend.`);
    error.status = response.status;
    error.code = payload.code || "";
    error.title = payload.title || "";
    throw error;
  }
  return payload;
}

function apiUrl(path) {
  const apiBase = String(import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");
  return path?.startsWith("/api/") ? (apiBase ? `${apiBase}${path.slice(4)}` : path) : path;
}

function mediaUrl(path) {
  return path ? apiUrl(path) : "";
}

function websocketApiUrl(path) {
  const target = new URL(apiUrl(path), window.location.origin);
  target.protocol = target.protocol === "https:" ? "wss:" : "ws:";
  return target.toString();
}

function webPushAvailable() {
  return typeof window !== "undefined"
    && window.isSecureContext
    && "Notification" in window
    && "serviceWorker" in navigator
    && "PushManager" in window;
}

function base64UrlToUint8Array(base64String = "") {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

async function getNotificationRegistration() {
  if (!webPushAvailable()) return null;
  const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}notification-sw.js`);
  await navigator.serviceWorker.ready;
  return registration;
}

async function ensureWebPushSubscription() {
  if (!webPushAvailable()) throw new Error("Notificações push exigem HTTPS, Service Worker e suporte do navegador.");
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Permissão de notificação não concedida pelo navegador.");
  const { configured, publicKey } = await apiRequest("/api/push/public-key");
  if (!configured || !publicKey) throw new Error("Web Push ainda não está configurado no servidor.");
  const registration = await getNotificationRegistration();
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(publicKey),
    });
  }
  await apiRequest("/api/push/subscribe", { method: "POST", body: JSON.stringify({ subscription: subscription.toJSON() }) });
  return subscription;
}

async function removeWebPushSubscription() {
  if (!webPushAvailable()) return false;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return false;
  await apiRequest("/api/push/subscribe", { method: "DELETE", body: JSON.stringify({ endpoint: subscription.endpoint }) }).catch(() => {});
  await subscription.unsubscribe().catch(() => {});
  return true;
}

async function currentWebPushStatus() {
  if (!webPushAvailable()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "default";
  const registration = await navigator.serviceWorker.ready.catch(() => null);
  const subscription = registration ? await registration.pushManager.getSubscription().catch(() => null) : null;
  return subscription ? "subscribed" : "granted";
}

async function webPushDiagnostics() {
  const supported = webPushAvailable();
  const permission = typeof Notification !== "undefined" ? Notification.permission : "unsupported";
  let registration = null;
  let subscription = null;
  let scriptVersion = "";
  if (supported) {
    registration = await navigator.serviceWorker.ready.catch(() => null);
    subscription = registration ? await registration.pushManager.getSubscription().catch(() => null) : null;
    scriptVersion = await fetch(`${import.meta.env.BASE_URL}notification-sw.js?diag=${Date.now()}`, { cache: "no-store" })
      .then((response) => response.text())
      .then((text) => text.match(/CIPOLATTI_CHAT_SW_VERSION\s*=\s*"([^"]+)"/)?.[1] || "")
      .catch(() => "");
  }
  return {
    supported,
    permission,
    serviceWorker: Boolean(registration?.active),
    serviceWorkerVersion: scriptVersion,
    serviceWorkerState: registration?.active?.state || registration?.waiting?.state || registration?.installing?.state || "",
    serviceWorkerScope: registration?.scope || "",
    updateAvailable: Boolean(registration?.waiting),
    controlled: Boolean(navigator.serviceWorker?.controller),
    subscription: Boolean(subscription),
    endpoint: subscription?.endpoint || "",
    vibrationSupported: "vibrate" in navigator,
    displayMode: window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone ? "PWA instalada/standalone" : "Navegador",
  };
}

const pushPermissionLabelFromValue = (value) => value === "granted" ? "Permitida"
  : value === "denied" ? "Bloqueada"
  : value === "default" ? "Não solicitada"
  : "Indisponível";

async function sendWebPushTestNotification() {
  const subscription = await ensureWebPushSubscription();
  const endpoint = subscription.endpoint;
  return apiRequest("/api/push/test", { method: "POST", body: JSON.stringify({ endpoint }) });
}

function monitorServiceWorkerUpdates({ onUpdateReady, canAutoApply } = {}) {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return () => {};
  let registrationRef = null;
  let disposed = false;
  let refreshing = false;
  const swUrl = `${import.meta.env.BASE_URL}notification-sw.js`;
  const notifyWaiting = (registration) => {
    if (!registration?.waiting || !navigator.serviceWorker.controller) return;
    if (canAutoApply?.()) {
      registration.waiting.postMessage({ type: "CIPOLATTI_SKIP_WAITING" });
      return;
    }
    onUpdateReady?.(registration);
  };
  const watchInstalling = (registration) => {
    const worker = registration.installing;
    if (!worker) return;
    worker.addEventListener("statechange", () => {
      if (!disposed && worker.state === "installed") notifyWaiting(registration);
    });
  };
  navigator.serviceWorker.register(swUrl).then((registration) => {
    if (disposed) return;
    registrationRef = registration;
    console.info("CIPOLATTI service worker scope:", registration.scope);
    notifyWaiting(registration);
    registration.addEventListener("updatefound", () => watchInstalling(registration));
    registration.update().catch(() => {});
  }).catch(() => {});
  const requestUpdate = () => registrationRef?.update?.().then(() => notifyWaiting(registrationRef)).catch(() => {});
  const onVisible = () => {
    if (document.visibilityState === "visible") requestUpdate();
  };
  const onOnline = () => requestUpdate();
  const onControllerChange = () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", requestUpdate);
  window.addEventListener("online", onOnline);
  navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
  const timer = window.setInterval(requestUpdate, 30 * 60 * 1000);
  return () => {
    disposed = true;
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", requestUpdate);
    window.removeEventListener("online", onOnline);
    navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    window.clearInterval(timer);
  };
}

function normalizePresenceStatus(value = "") {
  const raw = String(value || "").toLowerCase();
  if (raw.includes("ausente")) return "Ausente";
  if (raw.includes("online") || raw.includes("ativo")) return "Online";
  return "Offline";
}

function mergeUserPresence(user = {}, presenceByUserId = {}) {
  const presence = presenceByUserId[user.id] || user.presence || {};
  const status = normalizePresenceStatus(presence.status || user.status || "Offline");
  return {
    ...user,
    status,
    lastSeenAt: presence.lastSeenAt || user.lastSeenAt || "",
    presence: { ...presence, userId: user.id, status },
  };
}

function formatPresenceLastSeen(value = "") {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return `Visto por último às ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

function PresenceIndicator({ user, showLabel = false }) {
  const status = normalizePresenceStatus(user?.presence?.status || user?.status || "Offline");
  const lastSeen = status === "Offline" ? formatPresenceLastSeen(user?.presence?.lastSeenAt || user?.lastSeenAt) : "";
  return <span className={`presence-indicator presence-${status.toLowerCase()}`} title={lastSeen || status}>
    <i />
    {showLabel && <small>{status === "Offline" && lastSeen ? lastSeen : status}</small>}
  </span>;
}

function createClientMessageId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENT_BATCH_BYTES = 50 * 1024 * 1024;
const MAX_ATTACHMENT_BATCH_FILES = 10;
const AD_PASSWORD_CHANGED_NOTICE = {
  code: "AD_PASSWORD_CHANGED",
  title: "🔒 Senha alterada",
  body: "Sua senha do Active Directory foi alterada.\nPor motivos de segurança, sua sessão foi encerrada.\nFaça login novamente utilizando sua nova senha.",
};
const clipboardImageTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/bmp"]);
const blockedAttachmentExtensions = new Set(["exe", "msi", "apk", "ps1", "bat"]);

function fileExtensionFromName(name = "") {
  const base = String(name || "").split(/[\\/]/).pop() || "";
  const index = base.lastIndexOf(".");
  return index > 0 && index < base.length - 1 ? base.slice(index + 1).toLowerCase() : "";
}

function blockedAttachmentMessage(files = []) {
  const blocked = [...new Set(files.map((file) => fileExtensionFromName(file?.name)).filter((ext) => blockedAttachmentExtensions.has(ext)))];
  if (!blocked.length) return "";
  const formatted = blocked.map((ext) => `.${ext}`).join(", ");
  if (blocked.length === 1) return `Este tipo de arquivo nao e permitido. Por seguranca, arquivos ${formatted} nao podem ser enviados pelo Chat | Cipolatti.`;
  return `Alguns arquivos nao puderam ser enviados. Formatos bloqueados: ${formatted}.`;
}

function blockedAttachmentExtensionsFromFiles(files = []) {
  return [...new Set(files.map((file) => fileExtensionFromName(file?.name)).filter((ext) => blockedAttachmentExtensions.has(ext)))];
}

function isBlockedAttachmentFile(file = {}) {
  return blockedAttachmentExtensions.has(fileExtensionFromName(file?.name));
}

function authNoticeFromError(error) {
  if (error?.code === AD_PASSWORD_CHANGED_NOTICE.code) return AD_PASSWORD_CHANGED_NOTICE;
  return error?.message || "Sessão inválida ou expirada.";
}

function normalizeLoginNotice(value) {
  if (!value) return null;
  if (typeof value === "object") return {
    title: value.title || "",
    body: value.body || value.message || value.error || "",
    code: value.code || "",
  };
  return { title: "", body: String(value), code: "" };
}

function formatFileSize(bytes = 0) {
  const value = Number(bytes) || 0;
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  if (value >= 1024) return `${Math.ceil(value / 1024)} KB`;
  return `${value} B`;
}

function fileCategory(file = {}) {
  const mime = String(file.mime || file.type || "").toLowerCase();
  const ext = String(file.extension || fileExtensionFromName(file.name) || "").toLowerCase();
  if (ext === "ico" || mime === "image/x-icon" || mime === "image/vnd.microsoft.icon") return "image";
  if (file.category) return file.category;
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (ext === "pdf") return "pdf";
  if (["doc", "docx"].includes(ext)) return "word";
  if (["xls", "xlsx", "csv"].includes(ext)) return "sheet";
  if (["ppt", "pptx"].includes(ext)) return "presentation";
  if (["zip", "rar", "7z"].includes(ext)) return "archive";
  return "document";
}

function isImageAttachment(file = {}) {
  return fileCategory(file) === "image";
}

function albumLabel(messages = []) {
  const total = messages.length;
  const imageCount = messages.filter((message) => isImageAttachment(message.file)).length;
  if (total > 1 && imageCount === total) return `Álbum com ${total} imagens`;
  if (total > 1 && imageCount) return `Álbum com ${imageCount} imagens e ${total - imageCount} arquivo(s)`;
  return `Lote com ${total} arquivo(s)`;
}

function groupMessagesForDisplay(messages = []) {
  const grouped = [];
  const usedAlbums = new Set();
  for (const message of messages) {
    if (message.type !== "file" || !message.albumId) {
      grouped.push(message);
      continue;
    }
    if (usedAlbums.has(message.albumId)) continue;
    const albumMessages = messages
      .filter((item) => item.type === "file" && item.albumId === message.albumId)
      .sort((a, b) => (Number(a.batchOrder) || 0) - (Number(b.batchOrder) || 0));
    usedAlbums.add(message.albumId);
    if (albumMessages.length <= 1) {
      grouped.push(message);
      continue;
    }
    grouped.push({
      ...albumMessages[0],
      type: "album",
      text: albumMessages[0].albumCaption || albumMessages[0].text || "",
      albumFiles: albumMessages,
    });
  }
  return grouped;
}

function uploadImage(path, file) {
  const body = new FormData();
  body.append("file", file);
  return apiRequest(path, { method: "POST", body });
}

function cleanLogin(value) {
  return String(value || "").trim().replace(/\s+/g, "");
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

const MESSAGE_TIME_ZONE = "America/Sao_Paulo";
const loggedInvalidMessageDateIds = new Set();

function messageOriginalDate(message = {}) {
  return message.createdAt || message.sentAt || message.sent_at || message.timestamp || "";
}

function zonedDateParts(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MESSAGE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date).reduce((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});
  if (!parts.year || !parts.month || !parts.day) return null;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    key: `${parts.year}-${parts.month}-${parts.day}`,
    label: `${parts.day}/${parts.month}/${parts.year}`,
  };
}

function messageDateGroupKey(message, index = 0) {
  const rawDate = messageOriginalDate(message);
  const parts = zonedDateParts(rawDate);
  if (parts) return parts.key;
  const messageId = message?.id || `${message?.time || "sem-hora"}-${index}`;
  if (!loggedInvalidMessageDateIds.has(messageId)) {
    loggedInvalidMessageDateIds.add(messageId);
    console.warn("Mensagem sem data original valida para agrupamento.", { messageId });
  }
  return `invalid-${messageId}`;
}

function formatMessageDateLabel(message) {
  const parts = zonedDateParts(messageOriginalDate(message));
  if (!parts) return "Data não informada";
  const today = zonedDateParts(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = zonedDateParts(yesterdayDate);
  if (today && parts.key === today.key) return "Hoje";
  if (yesterday && parts.key === yesterday.key) return "Ontem";
  return parts.label;
}

function toDateTimeLocalValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function fromDateTimeLocalValue(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function outOfOfficeLabel(outOfOffice) {
  if (!outOfOffice?.active && !outOfOffice?.scheduled) return "";
  return outOfOffice.label || (outOfOffice.active ? `Fora da empresa - retorna em ${formatDateTime(outOfOffice.endAt)}` : `Programado - começa em ${formatDateTime(outOfOffice.startAt)}`);
}

function normalizeOutOfOfficeResponse(response) {
  return response?.outOfOffice || response || {};
}

function cleanEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function apiUserHeaders(user) {
  return {};
}

function isQuietHoursActive(startValue = "", endValue = "", now = new Date()) {
  const start = String(startValue || "").trim();
  const end = String(endValue || "").trim();
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end) || start === end) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;
  return startMinutes < endMinutes
    ? minutes >= startMinutes && minutes < endMinutes
    : minutes >= startMinutes || minutes < endMinutes;
}

function notificationPreferences(user) {
  const preferences = user?.preferences || {};
  const quietHours = isQuietHoursActive(preferences.quietHoursStart, preferences.quietHoursEnd);
  return {
    enabled: preferences.notifications !== false,
    showContent: preferences.showNotificationContent !== false,
    sound: preferences.notificationSound === true,
    persistent: preferences.repeatAlertsUntilRead !== false,
    flashTitle: preferences.flashWindowTitle !== false,
    windows: preferences.browserNotifications !== false,
    doNotDisturb: preferences.doNotDisturb === true || quietHours,
    direct: preferences.notifyDirectMessages !== false,
    groups: preferences.notifyGroups !== false,
  };
}

function browserNotificationsAvailable() {
  return typeof window !== "undefined" && "Notification" in window && window.isSecureContext;
}

function playNotificationTone() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.24);
    window.setTimeout(() => context.close().catch(() => {}), 420);
  } catch {
    // Browser audio policies can block sound until the first user gesture.
  }
}

function messageNotificationPreview(message, showContent) {
  if (!showContent) return "Nova mensagem recebida.";
  if (message?.type === "audio") return "Enviou uma mensagem de audio.";
  const text = String(message?.text || "").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 120) : "Nova mensagem recebida.";
}

async function migrateLegacyBrowserStorage(currentUser) {
  if (currentUser.role !== "Administrador" || localStorage.getItem("kalion-browser-storage-migrated-v1") === "done") return;
  const keys = {
    internalConversations: "kalion-internal-conversations-v4",
    meetings: "kalion-meetings-v1",
    quickReplies: "kalion-v2-respostas-rows",
  };
  const payload = {};
  let hasData = false;
  for (const [field, key] of Object.entries(keys)) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      payload[field] = Array.isArray(value) ? value : [];
      if (payload[field].length) hasData = true;
    } catch {
      payload[field] = [];
    }
  }
  if (hasData) await apiRequest("/api/migrations/browser-storage", { method: "POST", body: JSON.stringify(payload) });
  for (const key of Object.values(keys)) localStorage.removeItem(key);
  localStorage.setItem("kalion-browser-storage-migrated-v1", "done");
}

function mapCloudConversation(conversation) {
  const statusMap = { waiting: "Aguardando", active: "Em atendimento", closed: "Encerrado", triage: "Em triagem", collecting_department_form: "Em triagem" };
  const lastMessage = conversation.messages?.at(-1);
  return {
    ...conversation,
    source: "whatsapp-cloud",
    dept: conversation.department,
    status: statusMap[conversation.status] || conversation.status,
    ended: conversation.status === "closed",
    transferred: Boolean(conversation.transferHistory?.length),
    participants: [conversation.owner].filter((name) => name && name !== "Não atribuído"),
    initials: (conversation.name || conversation.phone).split(" ").map((item) => item[0]).slice(0, 2).join("").toUpperCase(),
    photoUrl: conversation.photoUrl || "",
    color: "#2d8659",
    unread: 0,
    time: conversation.updatedAt ? new Date(conversation.updatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "",
    preview: lastMessage?.text || "Atendimento recebido pelo WhatsApp",
    customerData: {
      documentType: conversation.triage?.documentType || "",
      document: conversation.formAnswers?.find((item) => ["CPF", "CNPJ"].includes(item.question))?.answer || "",
      reason: conversation.reason || "",
    },
    messages: (conversation.messages || []).map((message) => ({
      type: message.type === "system" ? "system" : "message",
      side: message.direction === "out" ? "out" : "in",
      sender: message.sender,
      text: message.text,
      media: message.media,
      status: message.status,
      errors: message.errors,
      time: message.createdAt ? new Date(message.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "",
      createdAt: message.createdAt,
      sentAt: message.sentAt,
    })),
  };
}

function mapInternalConversation(conversation, currentUser) {
  const lastMessage = conversation.messages?.at(-1);
  const isGroup = conversation.type === "group";
  const otherUser = conversation.participantUsers?.find((user) => user.id !== currentUser?.id);
  const title = isGroup
    ? conversation.title || "Grupo interno"
    : otherUser?.name || conversation.participants?.filter((name) => name !== currentUser?.name)[0] || conversation.title || "Conversa interna";
  return {
    ...conversation,
    source: "internal-api",
    name: title,
    phone: conversation.department,
    dept: conversation.department,
    status: conversation.status === "closed" ? "Encerrado" : "Em atendimento",
    ended: conversation.status === "closed",
    transferred: false,
    initials: (title || "CI").split(" ").map((item) => item[0]).slice(0, 2).join("").toUpperCase(),
    participantUsers: conversation.participantUsers || [],
    otherUser: isGroup ? null : otherUser || null,
    otherUserOutOfOffice: isGroup ? null : otherUser?.outOfOffice || null,
    photoUrl: isGroup ? conversation.imageUrl || "" : otherUser?.photoUrl || "",
    color: isGroup ? "#c49a2c" : "#536f8b",
    unread: Number(conversation.unreadCount || 0),
    time: conversation.updatedAt ? new Date(conversation.updatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "",
    preview: lastMessage?.type === "audio" ? "Mensagem de audio" : lastMessage?.type === "file" ? lastMessage.file?.originalName || lastMessage.file?.name || "Arquivo anexado" : lastMessage?.text || "Conversa interna",
    messages: (conversation.messages || []).map((message) => ({
      id: message.id,
      type: message.type === "system" ? "system" : message.type === "audio" ? "audio" : message.type === "file" ? "file" : "message",
      side: message.senderId === currentUser?.id ? "out" : "in",
      sender: message.sender,
      senderId: message.senderId,
      role: message.role,
      text: message.text,
      audio: message.audio,
      file: message.file,
      albumId: message.albumId,
      albumCaption: message.albumCaption,
      itemCaption: message.itemCaption,
      batchOrder: message.batchOrder,
      batchTotal: message.batchTotal,
      replyTo: message.replyTo,
      replyToMessageId: message.replyToMessageId,
      forwardedFrom: message.forwardedFrom,
      reactions: Array.isArray(message.reactions) ? message.reactions : [],
      readDetails: message.readDetails || null,
      status: message.status || "sent",
      messageType: message.messageType || "",
      isAutomatic: Boolean(message.isAutomatic || message.automatic),
      outOfOffice: Boolean(message.outOfOffice),
      editedAt: message.editedAt || null,
      editedBy: message.editedBy || null,
      time: message.createdAt ? new Date(message.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "",
      createdAt: message.createdAt,
    })),
  };
}

function notificationIcon(type = "") {
  if (String(type).includes("group")) return <Users size={16}/>;
  if (String(type).includes("message")) return <MessageCircle size={16}/>;
  return <Bell size={16}/>;
}

function formatNotificationTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff >= 0 && diff < 60_000) return "Agora";
  if (diff >= 0 && diff < 60 * 60_000) return `H? ${Math.max(1, Math.floor(diff / 60_000))} minutos`;
  const sameDay = date.toLocaleDateString("pt-BR") === now.toLocaleDateString("pt-BR");
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `Hoje, ${time}`;
  if (date.toLocaleDateString("pt-BR") === yesterday.toLocaleDateString("pt-BR")) return `Ontem, ${time}`;
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function notificationText(item = {}) {
  return String(item.message || item.description || item.title || "").trim();
}

function Modal({ title, children, onClose, footer, className = "" }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={title}>
        <header><h2>{title}</h2><button className="icon-button" aria-label="Fechar" onClick={onClose}><X size={19} /></button></header>
        <div className="modal-body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </section>
    </div>
  );
}

function BlockedAttachmentModal({ extensions = [], allowedCount = 0, onClose }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation?.();
      onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);
  const uniqueExtensions = [...new Set(extensions)].map((ext) => `.${String(ext).toUpperCase()}`);
  const multiple = uniqueExtensions.length > 1;
  const allBlocked = allowedCount <= 0;
  return (
    <div className="modal-backdrop blocked-file-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="blocked-file-modal" role="alertdialog" aria-modal="true" aria-labelledby="blocked-file-title">
        <div className="blocked-file-icon"><AlertTriangle size={42} strokeWidth={2.2} /></div>
        <h2 id="blocked-file-title">{multiple ? "ALGUNS ARQUIVOS NÃO FORAM ENVIADOS" : "ARQUIVO NÃO PERMITIDO"}</h2>
        <p>
          {multiple
            ? "Os seguintes formatos são bloqueados por segurança:"
            : "Por segurança, arquivos deste formato não podem ser enviados pelo Chat | Cipolatti."}
        </p>
        <div className="blocked-file-selected">
          <span>{multiple ? "Formatos bloqueados" : "Formato selecionado"}</span>
          <strong>{uniqueExtensions.join(" • ")}</strong>
        </div>
        {!allBlocked && <p className="blocked-file-note">Os demais arquivos permitidos podem continuar sendo enviados.</p>}
        <button type="button" className="primary-button blocked-file-confirm" onClick={onClose}>ENTENDI</button>
      </section>
    </div>
  );
}

function LargeAttachmentModal({ files = [], batch = false, totalSize = 0, onClose }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation?.();
      onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);
  const selectedFiles = Array.isArray(files) ? files.filter(Boolean) : [];
  const multiple = selectedFiles.length > 1;
  return (
    <div className="modal-backdrop blocked-file-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="blocked-file-modal" role="alertdialog" aria-modal="true" aria-labelledby="large-file-title">
        <div className="blocked-file-icon"><AlertTriangle size={42} strokeWidth={2.2} /></div>
        <h2 id="large-file-title">{batch ? "LOTE MUITO GRANDE" : "ARQUIVO MUITO GRANDE"}</h2>
        <p>
          {batch
            ? "Os arquivos selecionados ultrapassam o limite permitido pelo Chat | Cipolatti."
            : "O arquivo selecionado ultrapassa o limite permitido pelo Chat | Cipolatti."}
        </p>
        <p><strong>Tamanho máximo permitido: {batch ? "50 MB por envio." : "10 MB por arquivo."}</strong></p>
        <div className="blocked-file-selected large-file-selected">
          <span>{batch ? "Total selecionado" : multiple ? "Arquivos selecionados" : "Arquivo selecionado"}</span>
          <strong>
            {batch
              ? formatFileSize(totalSize)
              : selectedFiles.map((file) => `${file.name} — ${formatFileSize(file.size)}`).join(" • ")}
          </strong>
        </div>
        <button type="button" className="primary-button blocked-file-confirm" onClick={onClose}>ENTENDI</button>
      </section>
    </div>
  );
}

function Toast({ message, tone = "success", onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 2600);
    return () => clearTimeout(timer);
  }, [onClose]);
  return <div className={`toast toast-${tone}`} role="status">{message}<button aria-label="Fechar aviso" onClick={onClose}><X size={14} /></button></div>;
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, resetKey: props.resetKey };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  static getDerivedStateFromProps(props, state) {
    return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null;
  }
  componentDidCatch(error) {
    console.error("CIPOLATTI UI error", error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return <div className="content-page"><article className="panel error-panel"><ShieldCheck/><div><h2>Não foi possível abrir esta área</h2><p>O painel continuou ativo. Volte para Conversas e tente novamente.</p><code>{this.state.error.message}</code></div><button className="primary-button" onClick={this.props.onReset}>Voltar para Conversas</button></article></div>;
  }
}

function Avatar({ initials, size = "md", color, src, alt = "" }) {
  if (src) return <img className={`avatar avatar-${size}`} src={mediaUrl(src)} alt={alt} />;
  return <span className={`avatar avatar-${size}`} style={{ background: color }}>{initials}</span>;
}

function Status({ children }) {
  const key = children.toLowerCase().replaceAll(" ", "-");
  return <span className={`status status-${key}`}>{children}</span>;
}

function BrandIdentity({ compact = false }) {
  return (
    <div className={`brand-identity ${compact ? "compact" : ""}`}>
      <img src={BRAND_ICON} alt="Ícone oficial CIPOLATTI" />
      <span>{BRAND_NAME}</span>
    </div>
  );
}

function Sidebar({ page, setPage, mobileOpen, setMobileOpen, currentUser, collapsed, setCollapsed }) {
  const toggleLabel = collapsed ? "Expandir menu" : "Recolher menu";
  return (
    <>
      {mobileOpen && <button className="sidebar-backdrop" aria-label="Fechar menu" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : "sidebar-expanded"} ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <BrandIdentity compact={collapsed} />
          <button className="icon-button sidebar-close" onClick={() => setMobileOpen(false)}><X size={20} /></button>
        </div>
        <button className="sidebar-toggle" type="button" aria-label={toggleLabel} title={toggleLabel} onClick={() => setCollapsed((value) => !value)}>
          {collapsed ? <ChevronRight size={17} /> : <Menu size={17} />}
          <span>{toggleLabel}</span>
        </button>
        <nav>
          {navSections.map((section) => ({ ...section, items: section.items.filter(([id]) => canAccessPage(currentUser, id)) })).filter((section) => section.items.length).map((section) => (
            <div className="nav-section" key={section.label}>
              <div className="nav-label">{section.label}</div>
              {section.items.map(([id, label, Icon, badge]) => (
                <button
                  className={`nav-item ${page === id ? "active" : ""}`}
                  key={id}
                  aria-label={label}
                  title={label}
                  data-label={label}
                  onClick={() => { setPage(id); setMobileOpen(false); }}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                  {badge && <b>{badge}</b>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span>© 2026 CIPOLATTI - Todos os direitos reservados.</span>
        </div>
      </aside>
    </>
  );
}

function Topbar({ page, setPage, setMobileOpen, currentUser, theme, setTheme, onLogout, onCurrentUserUpdated }) {
  const [title, subtitle] = pageMeta[page];
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({ notificationsUnread: 0, messagesUnread: 0 });
  const [messageBanner, setMessageBanner] = useState(null);
  const [profileToast, setProfileToast] = useState("");
  const notificationSeededRef = useRef(false);
  const notifiedMessagesRef = useRef(new Set());
  const notifiedNotificationsRef = useRef(new Set());
  const pendingMessageAlertsRef = useRef(new Map());
  const lastNotificationSoundRef = useRef(0);
  const audioUnlockedRef = useRef(false);
  const nativeNotificationFallbackRef = useRef(true);
  const loadUnreadCounts = async () => {
    try {
      const counts = await apiRequest("/api/unread-counts");
      setUnreadCounts(counts);
    } catch {
      setUnreadCounts({ notificationsUnread: 0, messagesUnread: 0 });
    }
  };
  const loadNotifications = async () => {
    try {
      const result = await apiRequest("/api/notifications");
      setNotifications(result.notifications || []);
      if (result.counts) setUnreadCounts(result.counts);
    } catch (error) {
      setProfileToast(error.message);
    }
  };
  const openInternalConversationFromAlert = async ({ conversationId, isGroup = false, messageId = "", notificationId = "" } = {}) => {
    if (!conversationId) return;
    pendingMessageAlertsRef.current = new Map([...pendingMessageAlertsRef.current].filter(([, item]) => item.conversationId !== conversationId));
    setMessageBanner((current) => current?.conversationId === conversationId ? null : current);
    if (notificationId) {
      const now = new Date().toISOString();
      setNotifications((items) => items.map((item) => item.id === notificationId ? { ...item, read: true, isRead: true, readAt: item.readAt || now, resolvedAt: item.resolvedAt || now } : item));
    }
    if (messageId) {
      sessionStorage.setItem("cipolatti-open-message-id", messageId);
      sessionStorage.setItem("cipolatti-open-message-target", JSON.stringify({ conversationId, messageId }));
    }
    sessionStorage.setItem("cipolatti-open-conversation-id", conversationId);
    setPage(isGroup ? "grupos" : "conversas");
    window.dispatchEvent(new CustomEvent("cipolatti-open-conversation", { detail: { id: conversationId, messageId } }));
    try {
      const result = notificationId
        ? await apiRequest(`/api/notifications/${notificationId}/read`, { method: "POST", body: "{}" })
        : await apiRequest(`/api/internal/conversations/${conversationId}/read`, { method: "POST", body: "{}" });
      if (result.counts) setUnreadCounts(result.counts);
      else loadUnreadCounts();
      if (result.notification) setNotifications((items) => items.map((item) => item.id === notificationId ? { ...item, ...result.notification, read: true, isRead: true } : item));
      window.dispatchEvent(new CustomEvent("kalion-unread-refresh"));
    } catch {
      loadUnreadCounts();
    }
  };
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const counts = await apiRequest("/api/unread-counts");
        if (active) setUnreadCounts(counts);
      } catch {
        if (active) setUnreadCounts({ notificationsUnread: 0, messagesUnread: 0 });
      }
    };
    refresh();
    const onRefresh = () => refresh();
    window.addEventListener("kalion-unread-refresh", onRefresh);
    const timer = window.setInterval(refresh, 10000);
    return () => {
      active = false;
      window.removeEventListener("kalion-unread-refresh", onRefresh);
      window.clearInterval(timer);
    };
  }, [currentUser.id]);
  useEffect(() => {
    const unlock = () => { audioUnlockedRef.current = true; };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);
  useEffect(() => {
    if (notificationPreferences(currentUser).flashTitle === false) {
      document.title = "Chat | Cipolatti";
      return () => { document.title = "Chat | Cipolatti"; };
    }
    const totalUnread = Number(unreadCounts.messagesUnread || 0) + Number(unreadCounts.notificationsUnread || 0);
    document.title = totalUnread > 0 ? `(${totalUnread}) Chat | Cipolatti` : "Chat | Cipolatti";
    return () => { document.title = "Chat | Cipolatti"; };
  }, [currentUser.preferences, unreadCounts.messagesUnread, unreadCounts.notificationsUnread]);
  useEffect(() => {
    if (!messageBanner) return undefined;
    const onFocus = () => setMessageBanner((current) => current ? { ...current, visible: true } : current);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [messageBanner]);
  useEffect(() => {
    if (!currentUser?.id) return undefined;
    let active = true;
    const refreshFallbackMode = () => {
      currentWebPushStatus()
        .then((status) => {
          if (active) nativeNotificationFallbackRef.current = status !== "subscribed";
        })
        .catch(() => {
          if (active) nativeNotificationFallbackRef.current = true;
        });
    };
    refreshFallbackMode();
    const timer = window.setInterval(refreshFallbackMode, 30000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [currentUser?.id]);
  useEffect(() => {
    if (!currentUser?.id) return undefined;
    let active = true;
    notificationSeededRef.current = false;
    notifiedMessagesRef.current = new Set();
    const pollMessages = async () => {
      try {
        const conversations = await apiRequest("/api/internal/conversations");
        if (!active) return;
        const preferences = notificationPreferences(currentUser);
        const activeConversationId = sessionStorage.getItem("cipolatti-active-conversation-id") || "";
        const isFocused = document.visibilityState === "visible" && document.hasFocus();
        const nextPending = new Map();
        conversations.forEach((conversation) => {
          const isGroup = conversation.type === "group";
          if ((isGroup && !preferences.groups) || (!isGroup && !preferences.direct)) return;
          if (Number(conversation.unreadCount || 0) <= 0) return;
          (conversation.messages || []).forEach((message) => {
            const messageId = message.id || `${conversation.id}-${message.createdAt || ""}-${message.senderId || ""}-${message.text || ""}`;
            if (message.type === "system" || message.senderId === currentUser.id) return;
            const alertInfo = {
              id: messageId,
              conversationId: conversation.id,
              isGroup,
              groupTitle: isGroup ? conversation.title || "Grupo interno" : "",
              sender: message.sender || conversation.title || "CIPOLATTI",
              title: isGroup ? `Nova mensagem em ${conversation.title || "Grupo interno"}` : `Nova mensagem de ${message.sender || conversation.title || "CIPOLATTI"}`,
              preview: messageNotificationPreview(message, preferences.showContent),
            };
            nextPending.set(messageId, alertInfo);
            if (notifiedMessagesRef.current.has(messageId)) return;
            notifiedMessagesRef.current.add(messageId);
            if (!notificationSeededRef.current) return;
            if (!preferences.enabled || preferences.doNotDisturb) return;
            if (activeConversationId === conversation.id && isFocused) return;
            setMessageBanner({ ...alertInfo, visible: true });
            if (!nativeNotificationFallbackRef.current || !preferences.windows || !browserNotificationsAvailable() || Notification.permission !== "granted") return;
            const titleText = isGroup
              ? `Grupo: ${conversation.title || "Grupo interno"}`
              : `Mensagem de ${message.sender || conversation.title || "CIPOLATTI"}`;
            let notification;
            try {
              notification = new Notification(titleText, {
                body: `${message.sender || "CIPOLATTI"}: ${messageNotificationPreview(message, preferences.showContent)}`,
                icon: BRAND_ICON,
                badge: BRAND_ICON,
                tag: `cipolatti-${conversation.id}`,
                renotify: true,
              });
              notification.onclick = () => {
                window.focus();
                openInternalConversationFromAlert({ conversationId: conversation.id, isGroup, messageId });
                notification.close();
              };
            } catch {
              return;
            }
            if (preferences.sound && audioUnlockedRef.current && Date.now() - lastNotificationSoundRef.current > 15000) {
              lastNotificationSoundRef.current = Date.now();
              playNotificationTone();
            }
          });
        });
        pendingMessageAlertsRef.current = nextPending;
        notificationSeededRef.current = true;
      } catch {
        // The topbar already keeps the UI usable if the polling endpoint is unavailable.
      }
    };
    pollMessages();
    const timer = window.setInterval(pollMessages, 8000);
    const repeatTimer = window.setInterval(() => {
      const preferences = notificationPreferences(currentUser);
      if (!preferences.enabled || !preferences.persistent || preferences.doNotDisturb) return;
      const pending = [...pendingMessageAlertsRef.current.values()][0];
      if (!pending) return;
      setMessageBanner({ ...pending, visible: true });
      if (preferences.sound && audioUnlockedRef.current && Date.now() - lastNotificationSoundRef.current > 45000) {
        lastNotificationSoundRef.current = Date.now();
        playNotificationTone();
      }
      if (nativeNotificationFallbackRef.current && preferences.windows && browserNotificationsAvailable() && Notification.permission === "granted") {
        try {
          const notice = new Notification(pending.title, {
            body: pending.preview,
            icon: BRAND_ICON,
            badge: BRAND_ICON,
            tag: `cipolatti-repeat-${pending.conversationId}`,
            renotify: true,
          });
          notice.onclick = () => {
            window.focus();
            openInternalConversationFromAlert({ conversationId: pending.conversationId, isGroup: pending.isGroup, messageId: pending.id });
            notice.close();
          };
        } catch {}
      }
    }, 60000);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.clearInterval(repeatTimer);
    };
  }, [currentUser.id, currentUser.preferences, setPage]);
  useEffect(() => {
    if (noticesOpen) loadNotifications();
  }, [noticesOpen]);
  const openNotifications = () => setNoticesOpen((value) => !value);
  const readNotification = async (notification) => {
    try {
      const result = await apiRequest(`/api/notifications/${notification.id}/read`, { method: "POST", body: "{}" });
      setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, read: true, readAt: result.notification?.readAt || new Date().toISOString() } : item));
      if (result.counts) setUnreadCounts(result.counts);
      if (notification.conversationId || notification.internalConversationId) {
        const isGroupNotification = notification.type === "group_participant_added" || Boolean(notification.groupTitle);
        openInternalConversationFromAlert({
          conversationId: notification.internalConversationId || notification.conversationId,
          isGroup: isGroupNotification,
          messageId: notification.messageId || "",
          notificationId: notification.id,
        });
      }
      setNoticesOpen(false);
    } catch (error) {
      setProfileToast(error.message);
    }
  };
  useEffect(() => {
    if (!currentUser?.id) return undefined;
    let active = true;
    const pollNotifications = async () => {
      try {
        const result = await apiRequest("/api/notifications");
        if (!active) return;
        if (result.counts) setUnreadCounts(result.counts);
        const preferences = notificationPreferences(currentUser);
        if (!preferences.enabled || !nativeNotificationFallbackRef.current || !browserNotificationsAvailable() || Notification.permission !== "granted") return;
        for (const notification of result.notifications || []) {
          if (notification.read || notifiedNotificationsRef.current.has(notification.id)) continue;
          notifiedNotificationsRef.current.add(notification.id);
          if (notification.type !== "group_participant_added") continue;
          const notice = new Notification(notification.title || "Você foi adicionado ao grupo", {
            body: notification.message || "Abra o grupo para ver a conversa.",
            icon: BRAND_ICON,
            badge: BRAND_ICON,
            tag: `cipolatti-notification-${notification.id}`,
            renotify: true,
          });
          notice.onclick = () => {
            window.focus();
            openInternalConversationFromAlert({
              conversationId: notification.internalConversationId || notification.conversationId,
              isGroup: true,
              messageId: notification.messageId || "",
              notificationId: notification.id,
            });
            notice.close();
          };
          if (preferences.sound && audioUnlockedRef.current) playNotificationTone();
        }
      } catch {
        // Notification polling is intentionally quiet to avoid interrupting chat usage.
      }
    };
    pollNotifications();
    const timer = window.setInterval(pollNotifications, 10000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [currentUser.id, currentUser.preferences, setPage]);
  const readAllNotifications = async () => {
    try {
      const counts = await apiRequest("/api/notifications/read-all", { method: "POST", body: "{}" });
      setNotifications((items) => items.map((item) => ({ ...item, read: true, readAt: item.readAt || new Date().toISOString() })));
      setUnreadCounts(counts);
    } catch (error) {
      setProfileToast(error.message);
    }
  };
  const openMessageBannerConversation = () => {
    if (!messageBanner?.conversationId) return;
    openInternalConversationFromAlert({ conversationId: messageBanner.conversationId, isGroup: messageBanner.isGroup, messageId: messageBanner.id });
  };
  return (
    <>
    <header className="topbar">
      <button className="icon-button mobile-menu" aria-label="Abrir menu" onClick={() => setMobileOpen(true)}><Menu /></button>
      <div className="page-title">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="topbar-spacer" />
      <button className="icon-button notification" aria-label="Notificações" onClick={openNotifications}><Bell size={20} />{unreadCounts.notificationsUnread > 0 && <b>{unreadCounts.notificationsUnread}</b>}</button>
      <button className="icon-button notification desktop-only" aria-label="Abrir conversas" onClick={() => setPage("conversas")}><MessageCircle size={20} />{unreadCounts.messagesUnread > 0 && <b>{unreadCounts.messagesUnread}</b>}</button>
      <div className="theme-switcher" aria-label="Tema do painel">
        {["light", "dark"].map((item) => <button key={item} className={theme === item ? "active" : ""} onClick={() => setTheme(item)}>{item === "dark" ? "Escuro" : "Claro"}</button>)}
      </div>
      <div className="profile authenticated-profile">
        <label className="profile-photo-picker" title="Alterar minha foto interna">
          <Avatar initials={currentUser.initials} color="#a76d56" src={currentUser.photoUrl} alt={currentUser.name} />
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={async(event)=>{const file=event.target.files?.[0];event.target.value="";if(!file)return;try{const updated=await uploadImage(`/api/uploads/users/${currentUser.id}/photo`,file);onCurrentUserUpdated({...currentUser,...updated});setProfileToast("Foto interna atualizada.");}catch(error){setProfileToast(error.message)}}}/>
        </label>
        <div><strong>{currentUser.name}</strong></div>
        <button className="icon-button profile-settings-button" onClick={() => setPage("configuracoes")} title="Preferências" aria-label="Abrir preferências"><Settings size={17}/></button>
        <button className="icon-button logout-button" onClick={onLogout} title="Sair"><LogOut size={17}/></button>
      </div>
      {noticesOpen && <div className="topbar-popover"><div className="popover-title"><strong>Notificações</strong>{notifications.some((item) => !item.read) && <button onClick={readAllNotifications}>Marcar todas como lidas</button>}</div>{notifications.length ? notifications.slice(0, 8).map((item) => <button key={item.id} className={item.read ? "read" : "unread"} onClick={() => readNotification(item)}><span>{item.title || item.message}</span><small>{item.createdAt ? new Date(item.createdAt).toLocaleString("pt-BR") : ""}</small></button>) : <p className="empty-popover">Nenhuma notificação recente.</p>}</div>}
      {profileToast && <Toast message={profileToast} tone={profileToast.includes("inválido") || profileToast.includes("permissão") ? "warning" : "success"} onClose={()=>setProfileToast("")}/>}
    </header>
    {messageBanner?.visible && <div className="persistent-message-banner" role="status">
      <div><strong>Nova mensagem</strong><span className="banner-sender">{messageBanner.sender}</span>{messageBanner.groupTitle && <span className="banner-group">{messageBanner.groupTitle}</span>}<p>"{messageBanner.preview}"</p></div>
      <button className="secondary-button compact-action" onClick={openMessageBannerConversation}>Abrir</button>
      <button className="icon-button" aria-label="Dispensar alerta" onClick={() => setMessageBanner((current) => current ? { ...current, visible: false } : current)}><X size={15}/></button>
    </div>}
    </>
  );
}

function PanelHeader({ title, action }) {
  return <div className="panel-header"><h3>{title}</h3>{action && <span className="panel-label">{action}</span>}</div>;
}

const initialExternalConversations = contacts.map((contact, index) => ({
  ...contact,
  protocol: `CIPO-20260620-${String(5821 - index).padStart(4, "0")}`,
  createdAt: `2026-06-${String(20 - Math.min(index, 3)).padStart(2, "0")}T${contact.time === "Ontem" ? "16:00" : contact.time}:00`,
  owner: index === 0 ? "João Silva" : users[index % users.length].name,
  participants: ["João Silva"],
  department: contact.dept,
  ended: contact.status === "Solucionado",
  transferred: false,
  customerData: {
    documentType: index === 2 ? "CNPJ" : "CPF",
    document: index === 2 ? "12.345.678/0001-90" : "123.456.789-10",
    company: contact.company,
    reason: contact.preview.replace("...", ""),
  },
  formAnswers: contact.dept === "RH" ? [
    { question: "Qual vaga deseja consultar?", answer: "Assistente Administrativo" },
    { question: "Já enviou currículo?", answer: "Sim" },
    { question: "Possui experiência na área?", answer: "Sim, 2 anos" },
  ] : [{ question: "Como podemos ajudar?", answer: contact.preview.replace("...", "") }],
  transferHistory: [],
  messages: index === 0 ? [
    { type: "message", side: "in", sender: "Mariana Alves", text: "Olá, bom dia!\nQuero mais informações sobre o curso de gestão empresarial.", time: "09:48" },
    { type: "message", side: "out", sender: "João Silva", text: "Olá Mariana! Tudo bem?\nSerá um prazer te ajudar com informações sobre o curso.", time: "09:49" },
    { type: "message", side: "in", sender: "Mariana Alves", text: "Quais são as formas de pagamento?", time: "09:50" },
  ] : [{ type: "message", side: "in", sender: contact.name, text: contact.preview, time: contact.time }],
}));

function mergeConversationDefaults(stored, fallback) {
  return stored.map((conversation) => {
    const defaults = fallback.find((item) => item.id === conversation.id) || {};
    return {
      ...defaults,
      ...conversation,
      customerData: { ...(defaults.customerData || {}), ...(conversation.customerData || {}) },
      formAnswers: conversation.formAnswers || defaults.formAnswers || [],
      transferHistory: conversation.transferHistory || [],
      messages: conversation.messages || defaults.messages || [],
    };
  });
}

function ChatPage({ internal = false, groupOnly = false, currentUser = users[0] }) {
  const [conversations, setConversations] = useState([]);
  const [collaborators, setCollaborators] = useState([]);
  const [presenceByUserId, setPresenceByUserId] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [mobileChat, setMobileChat] = useState(false);
  const [filter, setFilter] = useState("Todos");
  const [search, setSearch] = useState("");
  const [conversationSearchOpen, setConversationSearchOpen] = useState(false);
  const [conversationSearch, setConversationSearch] = useState("");
  const [locatedMessageId, setLocatedMessageId] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [mode, setMode] = useState("Responder");
  const [modal, setModal] = useState("");
  const [toast, setToast] = useState("");
  const [blockedAttachmentAlert, setBlockedAttachmentAlert] = useState(null);
  const [largeAttachmentAlert, setLargeAttachmentAlert] = useState(null);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [draftsByConversationId, setDraftsByConversationId] = useState({});
  const [replyByConversationId, setReplyByConversationId] = useState({});
  const [forwarding, setForwarding] = useState(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [showJumpLatest, setShowJumpLatest] = useState(false);
  const [pendingLatestCount, setPendingLatestCount] = useState(0);
  const [audioDraft, setAudioDraft] = useState(null);
  const [recordingAudio, setRecordingAudio] = useState(false);
  const [fileDrafts, setFileDrafts] = useState([]);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [attachmentMessage, setAttachmentMessage] = useState("");
  const [fileProgressLabel, setFileProgressLabel] = useState("");
  const [fileSending, setFileSending] = useState(false);
  const [messageSending, setMessageSending] = useState(false);
  const [fileProgress, setFileProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [recentEmojis, setRecentEmojis] = useState([]);
  const messagesRef = useRef(null);
  const composerTextRef = useRef(null);
  const sendingMessageRef = useRef(false);
  const pendingMessageKeysRef = useRef(new Set());
  const pendingUploadKeysRef = useRef(new Set());
  useEffect(() => {
    window.__cipolattiHasPendingChatWork = () => Boolean(
      String(text || "").trim()
      || String(attachmentMessage || "").trim()
      || fileDrafts.length
      || messageSending
      || fileSending
      || audioDraft
      || recordingAudio
    );
    return () => {
      if (window.__cipolattiHasPendingChatWork) delete window.__cipolattiHasPendingChatWork;
    };
  }, [text, attachmentMessage, fileDrafts.length, messageSending, fileSending, audioDraft, recordingAudio]);
  const fileInputRef = useRef(null);
  const conversationSearchRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const previousSelectedRef = useRef(null);
  const previousMessageCountRef = useRef(0);
  const followLatestRef = useRef(true);
  const draftsRef = useRef({});
  const replyRef = useRef({});
  const recorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioStartRef = useRef(0);
  const collaboratorsErrorNotifiedRef = useRef(false);
  const fileDraft = fileDrafts[activeFileIndex] || null;
  const draftStorageKey = currentUser?.id ? `cipolatti_chat_drafts_${currentUser.id}` : "";
  const isAdmin = currentUser.role === "Administrador";
  const isManager = currentUser.role === "Gestor" || currentUser.role === "Supervisor";
  const collaboratorsWithPresence = useMemo(() =>
    collaborators.map((user) => mergeUserPresence(user, presenceByUserId)),
  [collaborators, presenceByUserId]);
  const conversationsWithPresence = useMemo(() => internal
    ? conversations.map((conversation) => {
      const participantUsers = (conversation.participantUsers || []).map((user) => mergeUserPresence(user, presenceByUserId));
      const otherUser = conversation.type === "group" ? null : participantUsers.find((user) => user.id !== currentUser?.id) || conversation.otherUser || null;
      return { ...conversation, participantUsers, otherUser };
    })
    : conversations,
  [conversations, currentUser?.id, internal, presenceByUserId]);
  const accessibleConversations = internal
    ? conversationsWithPresence
    : conversations.filter((conversation) => isAdmin || conversation.department === currentUser.dept || conversation.owner === currentUser.name || conversation.participants?.includes(currentUser.name));
  const scopedConversations = groupOnly ? accessibleConversations.filter((conversation) => conversation.type === "group") : accessibleConversations;
  const current = scopedConversations.find((conversation) => conversation.id === selectedId) || null;
  const currentGroupRole = current?.currentUserGroupRole || current?.memberRoles?.[currentUser?.id] || "participant";
  const currentCanManageGroup = current?.type === "group" && ["owner", "admin"].includes(currentGroupRole);
  const currentCanSendMessages = !internal || !current || current.ended || current.type !== "group" || current.messageSendMode !== "admins" || currentCanManageGroup;
  const groupSendBlocked = Boolean(internal && current?.type === "group" && !current.ended && !currentCanSendMessages);
  const canSendToConversation = (conversation) => {
    if (!internal || !conversation || conversation.ended || conversation.type !== "group" || conversation.messageSendMode !== "admins") return true;
    const role = conversation.currentUserGroupRole || conversation.memberRoles?.[currentUser?.id] || "participant";
    return ["owner", "admin"].includes(role);
  };
  const visibleMessages = useMemo(() => groupMessagesForDisplay(current?.messages || []), [current?.messages]);
  const searchResults = useMemo(() => {
    const query = normalizeSearchText(conversationSearch).trim();
    if (!query || !current) return [];
    return visibleMessages
      .map((message, index) => ({ message, index, haystack: normalizeSearchText(searchMessageText(message)) }))
      .filter((item) => item.haystack.includes(query))
      .map((item, resultIndex) => ({
        id: item.message.id || `${item.message.time || ""}-${item.index}`,
        message: item.message,
        index: item.index,
        resultIndex,
      }));
  }, [conversationSearch, current?.id, visibleMessages]);
  const activeSearchResult = searchResults[Math.min(activeSearchIndex, Math.max(0, searchResults.length - 1))] || null;
  const activeSearchMessageId = activeSearchResult?.id || "";

  useEffect(() => {
    const syncMobileChatState = () => {
      const mobileViewport = window.matchMedia?.("(max-width: 768px)").matches;
      document.body.classList.toggle("cipolatti-mobile-chat-active", Boolean(internal && mobileChat && mobileViewport));
    };
    syncMobileChatState();
    window.addEventListener("resize", syncMobileChatState);
    window.visualViewport?.addEventListener?.("resize", syncMobileChatState);
    return () => {
      window.removeEventListener("resize", syncMobileChatState);
      window.visualViewport?.removeEventListener?.("resize", syncMobileChatState);
      document.body.classList.remove("cipolatti-mobile-chat-active");
    };
  }, [internal, mobileChat]);

  useEffect(() => {
    if (!internal || !currentUser?.id) return undefined;
    let socket = null;
    let reconnectTimer = 0;
    let heartbeatTimer = 0;
    let closed = false;
    let lastActivitySent = 0;
    const mergePresenceRows = (rows = []) => {
      setPresenceByUserId((currentMap) => {
        const next = { ...currentMap };
        for (const row of rows) if (row?.userId) next[row.userId] = row;
        return next;
      });
    };
    const markSelfOnline = () => mergePresenceRows([{ userId: currentUser.id, status: "Online", online: true, away: false, lastSeenAt: "" }]);
    const sendPresence = (type) => {
      if (socket?.readyState !== WebSocket.OPEN) return;
      socket.send(JSON.stringify({ type, at: Date.now() }));
    };
    const sendActivity = () => {
      const now = Date.now();
      if (now - lastActivitySent < 10_000) return;
      lastActivitySent = now;
      sendPresence("presence:activity");
    };
    const connect = () => {
      if (closed) return;
      window.clearTimeout(reconnectTimer);
      window.clearInterval(heartbeatTimer);
      socket = new WebSocket(websocketApiUrl("/api/presence"));
      socket.onopen = () => {
        markSelfOnline();
        sendPresence("presence:activity");
        window.clearInterval(heartbeatTimer);
        heartbeatTimer = window.setInterval(() => sendPresence("presence:heartbeat"), 30_000);
      };
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (Array.isArray(payload.users)) mergePresenceRows(payload.users);
        } catch {}
      };
      socket.onclose = () => {
        window.clearInterval(heartbeatTimer);
        if (!closed) reconnectTimer = window.setTimeout(connect, 5000);
      };
      socket.onerror = () => socket?.close();
    };
    const ensurePresenceConnected = () => {
      if (document.hidden) return;
      if (socket?.readyState === WebSocket.OPEN) {
        markSelfOnline();
        sendPresence("presence:activity");
        apiRequest("/api/presence").then(mergePresenceRows).catch(() => {});
        return;
      }
      window.clearTimeout(reconnectTimer);
      connect();
    };
    apiRequest("/api/presence").then(mergePresenceRows).catch(() => {});
    const pollTimer = window.setInterval(() => apiRequest("/api/presence").then(mergePresenceRows).catch(() => {}), 30_000);
    connect();
    const activityEvents = ["pointerdown", "keydown", "touchstart", "focus"];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, sendActivity, { passive: true }));
    document.addEventListener("visibilitychange", sendActivity);
    document.addEventListener("visibilitychange", ensurePresenceConnected);
    window.addEventListener("pageshow", ensurePresenceConnected);
    window.addEventListener("online", ensurePresenceConnected);
    return () => {
      closed = true;
      window.clearTimeout(reconnectTimer);
      window.clearInterval(heartbeatTimer);
      window.clearInterval(pollTimer);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, sendActivity));
      document.removeEventListener("visibilitychange", sendActivity);
      document.removeEventListener("visibilitychange", ensurePresenceConnected);
      window.removeEventListener("pageshow", ensurePresenceConnected);
      window.removeEventListener("online", ensurePresenceConnected);
      socket?.close();
    };
  }, [currentUser?.id, internal]);

  useEffect(() => {
    const textarea = composerTextRef.current;
    if (!textarea) return;
    const minHeight = 44;
    const maxHeight = 168;
    textarea.style.setProperty("height", "auto", "important");
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
    textarea.style.setProperty("height", `${nextHeight}px`, "important");
    textarea.style.setProperty("overflow-y", textarea.scrollHeight > maxHeight ? "auto" : "hidden", "important");
  }, [text, current?.id, editingMessage?.id, fileDraft?.id, replyTo?.id, currentUser?.messageFontSize]);

  useEffect(() => {
    if (!internal) return undefined;
    if (selectedId) sessionStorage.setItem("cipolatti-active-conversation-id", selectedId);
    return () => sessionStorage.removeItem("cipolatti-active-conversation-id");
  }, [internal, selectedId]);

  useEffect(() => {
    const mobileViewport = window.matchMedia?.("(max-width: 768px)").matches;
    if (!internal || !mobileViewport || (!mobileChat && !modal && !moreMenuOpen && !conversationSearchOpen)) return undefined;
    const state = { cipolattiMobilePanel: true, conversationId: selectedId };
    window.history.pushState(state, "");
    const handleMobileBack = () => {
      if (moreMenuOpen) {
        setMoreMenuOpen(false);
        return;
      }
      if (conversationSearchOpen) {
        setConversationSearchOpen(false);
        setConversationSearch("");
        setActiveSearchIndex(0);
        return;
      }
      if (modal) {
        setModal("");
        return;
      }
      if (mobileChat) {
        setMobileChat(false);
        sessionStorage.removeItem("cipolatti-open-message-target");
        sessionStorage.removeItem("cipolatti-open-message-id");
      }
    };
    window.addEventListener("popstate", handleMobileBack);
    return () => window.removeEventListener("popstate", handleMobileBack);
  }, [internal, mobileChat, selectedId, modal, moreMenuOpen, conversationSearchOpen]);

  useEffect(() => {
    if (!currentUser?.id) return;
    try {
      const stored = JSON.parse(localStorage.getItem(`cipolatti-recent-emojis-${currentUser.id}`) || "[]");
      setRecentEmojis(Array.isArray(stored) ? stored.slice(0, 24) : []);
    } catch {
      setRecentEmojis([]);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (!draftStorageKey) {
      draftsRef.current = {};
      setDraftsByConversationId({});
      return;
    }
    try {
      const stored = JSON.parse(localStorage.getItem(draftStorageKey) || "{}");
      const safeDrafts = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
      draftsRef.current = safeDrafts;
      setDraftsByConversationId(safeDrafts);
    } catch {
      draftsRef.current = {};
      setDraftsByConversationId({});
    }
  }, [draftStorageKey]);

  useEffect(() => {
    draftsRef.current = draftsByConversationId;
  }, [draftsByConversationId]);

  useEffect(() => {
    replyRef.current = replyByConversationId;
  }, [replyByConversationId]);

  const persistConversationDrafts = (drafts) => {
    draftsRef.current = drafts;
    if (!draftStorageKey) return;
    try {
      if (Object.keys(drafts).length) localStorage.setItem(draftStorageKey, JSON.stringify(drafts));
      else localStorage.removeItem(draftStorageKey);
    } catch {}
  };

  const setConversationDraft = (conversationId, value) => {
    if (!conversationId) return;
    const cleanText = String(value || "");
    setDraftsByConversationId((currentDrafts) => {
      const next = { ...currentDrafts };
      if (cleanText.trim()) next[conversationId] = { text: cleanText, updatedAt: new Date().toISOString() };
      else delete next[conversationId];
      persistConversationDrafts(next);
      return next;
    });
  };

  const clearConversationDraft = (conversationId) => {
    if (!conversationId) return;
    setDraftsByConversationId((currentDrafts) => {
      if (!currentDrafts[conversationId]) return currentDrafts;
      const next = { ...currentDrafts };
      delete next[conversationId];
      persistConversationDrafts(next);
      return next;
    });
  };

  useEffect(() => {
    if (!emojiOpen) return undefined;
    const close = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) setEmojiOpen(false);
    };
    const closeOnEsc = (event) => {
      if (event.key === "Escape") setEmojiOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    document.addEventListener("keydown", closeOnEsc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
      document.removeEventListener("keydown", closeOnEsc);
    };
  }, [emojiOpen]);

  useEffect(() => {
    if (!internal) return undefined;
    const openRequestedConversation = (event) => {
      const detail = event?.detail || {};
      const requestedId = detail.id || sessionStorage.getItem("cipolatti-open-conversation-id");
      const requestedMessageId = detail.messageId || sessionStorage.getItem("cipolatti-open-message-id") || "";
      if (!requestedId) return;
      if (!scopedConversations.some((conversation) => conversation.id === requestedId)) return;
      if (requestedMessageId) sessionStorage.setItem("cipolatti-open-message-target", JSON.stringify({ conversationId: requestedId, messageId: requestedMessageId }));
      setSelectedId(requestedId);
      setMobileChat(true);
      sessionStorage.removeItem("cipolatti-open-conversation-id");
    };
    openRequestedConversation();
    window.addEventListener("cipolatti-open-conversation", openRequestedConversation);
    return () => window.removeEventListener("cipolatti-open-conversation", openRequestedConversation);
  }, [internal, scopedConversations]);

  useEffect(() => {
    if (!internal) return undefined;
    let active = true;
    let refreshTimer = 0;
    let refreshInFlight = false;
    const scheduleRefresh = (delay = 3000) => {
      window.clearTimeout(refreshTimer);
      if (!active) return;
      refreshTimer = window.setTimeout(refresh, delay);
    };
    const refresh = async () => {
      if (!active || refreshInFlight) return;
      if (document.hidden) {
        scheduleRefresh(3000);
        return;
      }
      refreshInFlight = true;
      try {
        const conversationRows = await apiRequest("/api/internal/conversations");
        if (!active) return;
        const mapped = conversationRows.map((conversation) => mapInternalConversation(conversation, currentUser));
        setConversations(mapped);
        const scoped = groupOnly ? mapped.filter((item) => item.type === "group") : mapped;
        setSelectedId((value) => value && scoped.some((item) => item.id === value) ? value : null);
        apiRequest("/api/collaborators", { timeoutMs: 10000 })
          .then((directoryRows) => {
            if (!active) return;
            collaboratorsErrorNotifiedRef.current = false;
            setCollaborators(sortByDisplayName(directoryRows));
          })
          .catch((error) => {
            if (!active || collaboratorsErrorNotifiedRef.current) return;
            collaboratorsErrorNotifiedRef.current = true;
            setToast(`Lista de usuários indisponível: ${error.message}`);
          });
      } catch (error) {
        if (error?.code === "APP_SUSPENDED") return;
        if (active) setToast(error.message);
      } finally {
        refreshInFlight = false;
        scheduleRefresh(3000);
      }
    };
    const resumeRefresh = () => {
      if (document.hidden) return;
      window.clearTimeout(refreshTimer);
      refresh();
    };
    refresh();
    document.addEventListener("visibilitychange", resumeRefresh);
    window.addEventListener("pageshow", resumeRefresh);
    window.addEventListener("focus", resumeRefresh);
    window.addEventListener("online", resumeRefresh);
    return () => {
      active = false;
      window.clearTimeout(refreshTimer);
      document.removeEventListener("visibilitychange", resumeRefresh);
      window.removeEventListener("pageshow", resumeRefresh);
      window.removeEventListener("focus", resumeRefresh);
      window.removeEventListener("online", resumeRefresh);
    };
  }, [internal, groupOnly, currentUser.id]);

  useEffect(() => {
    if (!internal || !current?.id || current.source !== "internal-api" || !current.unread) return;
    let active = true;
    apiRequest(`/api/internal/conversations/${current.id}/read`, { method: "POST", body: "{}" })
      .then((result) => {
        if (!active) return;
        if (result.conversation) {
          setConversations((items) => items.map((item) => item.id === current.id ? mapInternalConversation(result.conversation, currentUser) : item));
        }
        window.dispatchEvent(new CustomEvent("kalion-unread-refresh"));
      })
      .catch(() => {});
    return () => { active = false; };
  }, [internal, current?.id, current?.unread, currentUser.id]);

  useEffect(() => {
    if (internal) return undefined;
    let active = true;
    const refresh = async () => {
      try {
        const cloud = await apiRequest("/api/whatsapp/conversations", { headers: apiUserHeaders(currentUser) });
        if (!active) return;
        setConversations(cloud.map(mapCloudConversation));
      } catch (error) {
        if (active) setToast(`WhatsApp Cloud API: ${error.message}`);
      }
    };
    refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [internal, currentUser.id]);

  const isNearMessagesBottom = () => {
    const container = messagesRef.current;
    if (!container) return true;
    return container.scrollHeight - container.scrollTop - container.clientHeight < 140;
  };
  const scrollMessagesToBottom = (behavior = "auto") => {
    const container = messagesRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior });
    followLatestRef.current = true;
    setShowJumpLatest(false);
    setPendingLatestCount(0);
  };
  useEffect(() => {
    const messageCount = current?.messages?.length || 0;
    const changedConversation = previousSelectedRef.current !== selectedId;
    const previousCount = previousMessageCountRef.current || 0;
    previousSelectedRef.current = selectedId;
    previousMessageCountRef.current = messageCount;
    if (!selectedId) {
      setShowJumpLatest(false);
      setPendingLatestCount(0);
      return undefined;
    }
    const addedMessages = Math.max(0, messageCount - previousCount);
    const shouldFollow = changedConversation || followLatestRef.current || isNearMessagesBottom();
    let secondFrame;
    const frame = requestAnimationFrame(() => {
      if (shouldFollow) {
        scrollMessagesToBottom(changedConversation ? "auto" : "smooth");
        secondFrame = requestAnimationFrame(() => scrollMessagesToBottom("auto"));
      } else if (addedMessages > 0) {
        setPendingLatestCount((count) => Math.min(99, count + addedMessages));
        setShowJumpLatest(true);
      }
    });
    return () => {
      cancelAnimationFrame(frame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
    };
  }, [current?.messages?.length, selectedId]);

  useEffect(() => {
    const container = messagesRef.current;
    if (!container || !current?.id) return undefined;
    const observer = new ResizeObserver(() => {
      if (followLatestRef.current || isNearMessagesBottom()) scrollMessagesToBottom("auto");
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [current?.id]);

  useEffect(() => {
    const conversationId = current?.id || "";
    setText(conversationId ? draftsRef.current[conversationId]?.text || "" : "");
    setReplyTo(conversationId ? replyRef.current[conversationId] || null : null);
    setEditingMessage(null);
    setEmojiOpen(false);
    setAudioDraft((draft) => {
      if (draft?.url) URL.revokeObjectURL(draft.url);
      return null;
    });
    setFileDrafts((drafts) => {
      drafts.forEach((draft) => draft.previewUrl && URL.revokeObjectURL(draft.previewUrl));
      return [];
    });
    setActiveFileIndex(0);
    setAttachmentMessage("");
    setLocatedMessageId("");
  }, [current?.id]);

  useEffect(() => {
    setConversationSearch("");
    setActiveSearchIndex(0);
    setConversationSearchOpen(false);
  }, [current?.id]);

  useEffect(() => {
    if (!conversationSearchOpen) return undefined;
    const frame = requestAnimationFrame(() => conversationSearchRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [conversationSearchOpen]);

  useEffect(() => {
    setActiveSearchIndex(0);
  }, [conversationSearch]);

  useEffect(() => {
    if (!activeSearchMessageId) return;
    const safeId = window.CSS?.escape ? CSS.escape(String(activeSearchMessageId)) : String(activeSearchMessageId).replace(/"/g, "");
    const node = messagesRef.current?.querySelector(`[data-message-id="${safeId}"]`);
    if (node) node.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeSearchMessageId]);

  const updateCurrent = (updater) => {
    setConversations((items) => items.map((conversation) => conversation.id === current.id ? updater(conversation) : conversation));
  };
  const appendSystem = (message) => updateCurrent((conversation) => ({
    ...conversation,
    preview: message,
    time: "Agora",
    messages: [...conversation.messages, { type: "system", text: message, time: "Agora" }],
  }));
  const messageExcerpt = (message) => {
    if (!message) return "";
    if (message.type === "album") return albumLabel(message.albumFiles || []);
    if (message.type === "audio") return "Mensagem de audio";
    if (message.type === "file") return message.file?.originalName || message.file?.name || message.text || "Arquivo";
    return String(message.text || "").replace(/\s+/g, " ").trim() || "Mensagem";
  };
  const updateComposerText = (value) => {
    setText(value);
    setConversationDraft(current?.id, value);
  };
  const selectReply = (message) => {
    setEditingMessage(null);
    setReplyTo(message);
    if (current?.id) {
      setReplyByConversationId((items) => {
        const next = { ...items, [current.id]: message };
        replyRef.current = next;
        return next;
      });
    }
    window.setTimeout(() => composerTextRef.current?.focus(), 0);
  };
  const clearReplyForCurrent = () => {
    setReplyTo(null);
    if (!current?.id) return;
    setReplyByConversationId((items) => {
      if (!items[current.id]) return items;
      const next = { ...items };
      delete next[current.id];
      replyRef.current = next;
      return next;
    });
  };
  const canEditMessage = (message) => {
    if (!internal || current?.ended || !message?.id) return false;
    if (message.senderId !== currentUser.id) return false;
    if (!["message", "file"].includes(message.type || "message")) return false;
    const createdAt = new Date(message.createdAt || 0).getTime();
    return Number.isFinite(createdAt) && Date.now() - createdAt <= 24 * 60 * 60 * 1000;
  };
  const startEditingMessage = (message) => {
    if (!canEditMessage(message)) {
      setToast("Esta mensagem não pode mais ser editada.");
      return;
    }
    clearReplyForCurrent();
    setEditingMessage({ id: message.id, text: message.text || "", conversationId: current.id });
    setText(message.text || "");
    window.setTimeout(() => {
      composerTextRef.current?.focus();
      const length = String(message.text || "").length;
      composerTextRef.current?.setSelectionRange(length, length);
    }, 0);
  };
  const cancelEditingMessage = () => {
    setEditingMessage(null);
    setText(current?.id ? draftsRef.current[current.id]?.text || "" : "");
  };
  const saveEditedMessage = async () => {
    if (!editingMessage || !current?.id) return;
    const nextText = text.trim();
    if (!nextText) return setToast("Digite uma mensagem.");
    if (nextText === String(editingMessage.text || "").trim()) {
      cancelEditingMessage();
      return;
    }
    try {
      const updated = await apiRequest(`/api/internal/conversations/${current.id}/edit`, {
        method: "POST",
        body: JSON.stringify({ messageId: editingMessage.id, text: nextText }),
      });
      setConversations((items) => items.map((item) => item.id === current.id ? mapInternalConversation(updated, currentUser) : item));
      setEditingMessage(null);
      setText(current?.id ? draftsRef.current[current.id]?.text || "" : "");
      setToast("Mensagem editada.");
    } catch (error) {
      setToast(error.message);
    }
  };
  const insertEmoji = (emoji) => {
    const input = composerTextRef.current;
    const start = input?.selectionStart ?? text.length;
    const end = input?.selectionEnd ?? start;
    const nextText = `${text.slice(0, start)}${emoji}${text.slice(end)}`;
    updateComposerText(nextText);
    setRecentEmojis((items) => {
      const next = [emoji, ...items.filter((item) => item !== emoji)].slice(0, 24);
      try { localStorage.setItem(`cipolatti-recent-emojis-${currentUser.id}`, JSON.stringify(next)); } catch {}
      return next;
    });
    window.setTimeout(() => {
      composerTextRef.current?.focus();
      const cursor = start + emoji.length;
      composerTextRef.current?.setSelectionRange(cursor, cursor);
    }, 0);
  };
  const sendMessage = async () => {
    if (editingMessage) {
      await saveEditedMessage();
      return;
    }
    if (!currentCanSendMessages) {
      setToast("Somente administradores podem enviar mensagens neste momento.");
      return;
    }
    if (fileDraft?.file) {
      sendFileDraft();
      return;
    }
    if (!text.trim() || current.ended) return;
    const conversationId = current.id;
    const rawText = text;
    const sentText = mode === "Observa??o interna" ? `[Observa??o interna] ${text.trim()}` : text.trim();
    const duplicateKey = `${conversationId}:${currentUser.id}:${sentText}`;
    if (pendingMessageKeysRef.current.has(duplicateKey)) return;
    const clientMessageId = createClientMessageId();
    const optimisticMessageId = `pending-${clientMessageId}`;
    const replyToMessageId = replyTo?.id || null;
    const optimisticMessage = {
      id: optimisticMessageId,
      type: "message",
      side: "out",
      sender: currentUser.name,
      senderId: currentUser.id,
      role: currentUser.role,
      text: sentText,
      time: "Agora",
      createdAt: new Date().toISOString(),
      status: "sending",
      replyTo: replyTo || null,
      replyToMessageId,
      clientMessageId,
    };
    pendingMessageKeysRef.current.add(duplicateKey);
    sendingMessageRef.current = true;
    setMessageSending(true);
    setText("");
    clearConversationDraft(conversationId);
    clearReplyForCurrent();
    if (current.source === "internal-api") {
      updateCurrent((conversation) => ({
        ...conversation,
        preview: sentText,
        time: "Agora",
        messages: [...conversation.messages, optimisticMessage],
      }));
    }
    try {
      if (current.source === "internal-api") {
        const updated = await apiRequest(`/api/internal/conversations/${current.id}/messages`, {
          method: "POST",
          body: JSON.stringify({ text: sentText, replyToMessageId, clientMessageId }),
        });
        setConversations((items) => items.map((item) => item.id === current.id ? mapInternalConversation(updated, currentUser) : item));
      } else {
        if (current.source === "whatsapp-cloud" && mode === "Responder") {
          await apiRequest(`/api/whatsapp/conversations/${current.id}/messages`, {
            method: "POST",
            headers: apiUserHeaders(currentUser),
            body: JSON.stringify({ text: sentText, sender: currentUser.name, clientMessageId }),
          });
        }
        updateCurrent((conversation) => ({
          ...conversation,
          preview: sentText,
          time: "Agora",
          messages: [...conversation.messages, { type: "message", side: "out", sender: currentUser.name, role: currentUser.role, text: sentText, time: "Agora", status: "sent" }],
        }));
      }
    } catch (error) {
      setText((currentText) => currentText || rawText);
      if (current.source === "internal-api") {
        updateCurrent((conversation) => ({
          ...conversation,
          messages: conversation.messages.map((message) => message.id === optimisticMessageId ? { ...message, status: "failed", errors: [{ message: error.message }] } : message),
        }));
      }
      setToast(error.message);
    } finally {
      pendingMessageKeysRef.current.delete(duplicateKey);
      sendingMessageRef.current = false;
      setMessageSending(false);
    }
  };
  const startAudioRecording = async () => {
    if (!internal || current.ended) return;
    if (!currentCanSendMessages) {
      setToast("Somente administradores podem enviar mensagens neste momento.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setToast("Gravação de áudio não é suportada neste navegador.");
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const recorder = new MediaRecorder(media, { mimeType });
      audioChunksRef.current = [];
      audioStartRef.current = Date.now();
      recorder.ondataavailable = (event) => event.data.size && audioChunksRef.current.push(event.data);
      recorder.onstop = () => {
        media.getTracks().forEach((track) => track.stop());
        const durationSeconds = Math.max(1, Math.round((Date.now() - audioStartRef.current) / 1000));
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (blob.size) setAudioDraft({ blob, url: URL.createObjectURL(blob), durationSeconds });
        setRecordingAudio(false);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecordingAudio(true);
      window.setTimeout(() => {
        if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      }, 180000);
    } catch {
      setToast("Permissão de microfone negada ou indisponível.");
    }
  };
  const cancelAudioDraft = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    recorderRef.current = null;
    if (audioDraft?.url) URL.revokeObjectURL(audioDraft.url);
    setAudioDraft(null);
    setRecordingAudio(false);
  };
  const sendAudioDraft = async () => {
    if (!audioDraft || !current?.id) return;
    if (!currentCanSendMessages) {
      setToast("Somente administradores podem enviar mensagens neste momento.");
      return;
    }
    try {
      const body = new FormData();
      body.append("file", audioDraft.blob, `audio-${Date.now()}.webm`);
      const updated = await apiRequest(`/api/internal/conversations/${current.id}/audio`, {
        method: "POST",
        body,
        headers: {
          "X-Audio-Duration": String(audioDraft.durationSeconds || 0),
          ...(replyTo?.id ? { "X-Reply-To-Message-Id": replyTo.id } : {}),
        },
      });
      setConversations((items) => items.map((item) => item.id === current.id ? mapInternalConversation(updated, currentUser) : item));
      clearReplyForCurrent();
      cancelAudioDraft();
    } catch (error) {
      setToast(error.message);
    }
  };
  const clearFileDrafts = () => {
    fileDrafts.forEach((draft) => draft.previewUrl && URL.revokeObjectURL(draft.previewUrl));
    setFileDrafts([]);
    setActiveFileIndex(0);
    setAttachmentMessage("");
    setFileProgressLabel("");
    setFileProgress(0);
    setFileSending(false);
  };
  const closeSelectedConversation = () => {
    setSelectedId(null);
    setMobileChat(false);
    setShowJumpLatest(false);
    setPendingLatestCount(0);
    sessionStorage.removeItem("cipolatti-active-conversation-id");
  };
  useEffect(() => {
    if (!editingMessage) return undefined;
    const handleEditingEsc = (event) => {
      if (event.key !== "Escape") return;
      if (modal || forwarding || fileDrafts.length || blockedAttachmentAlert || largeAttachmentAlert) return;
      event.preventDefault();
      cancelEditingMessage();
    };
    document.addEventListener("keydown", handleEditingEsc);
    return () => document.removeEventListener("keydown", handleEditingEsc);
  }, [editingMessage, modal, forwarding, fileDrafts.length, blockedAttachmentAlert, largeAttachmentAlert]);
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key !== "Escape") return;
      if (modal || forwarding || fileDrafts.length || emojiOpen || conversationSearchOpen || editingMessage || moreMenuOpen || blockedAttachmentAlert || largeAttachmentAlert) return;
      if (!selectedId) return;
      const target = event.target;
      if (target?.closest?.(".modal,.blocked-file-modal,.message-actions-portal,.emoji-picker,.attachment-modal-shell")) return;
      event.preventDefault();
      closeSelectedConversation();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [modal, forwarding, fileDrafts.length, emojiOpen, conversationSearchOpen, editingMessage, moreMenuOpen, blockedAttachmentAlert, largeAttachmentAlert, selectedId]);
  const cancelFileDraft = () => {
    if (fileDrafts.length > 1) {
      const confirmed = window.confirm("Cancelar o envio e remover todos os arquivos selecionados?");
      if (!confirmed) return;
    }
    clearFileDrafts();
  };
  const draftKey = (file) => `${file.name}-${file.size}-${file.lastModified || 0}`;
  const createFileDraft = (files, source = "anexo") => {
    let incoming = Array.isArray(files) ? files.filter(Boolean) : [files].filter(Boolean);
    if (!incoming.length) return;
    if (!internal) {
      setToast("Anexos estao disponiveis no chat interno.");
      return;
    }
    if (current.ended) {
      setToast("Conversa encerrada. Inicie uma nova conversa para enviar anexos.");
      return;
    }
    if (!currentCanSendMessages) {
      setToast("Somente administradores podem enviar mensagens neste momento.");
      return;
    }
    const blockedExtensions = blockedAttachmentExtensionsFromFiles(incoming);
    if (blockedExtensions.length) {
      const allowedFiles = incoming.filter((file) => !isBlockedAttachmentFile(file));
      setBlockedAttachmentAlert({ extensions: blockedExtensions, allowedCount: allowedFiles.length });
      incoming = allowedFiles;
      if (!incoming.length) return;
    }
    const tooLargeFiles = incoming.filter((file) => file.size > MAX_ATTACHMENT_BYTES);
    if (tooLargeFiles.length) {
      setLargeAttachmentAlert({ files: tooLargeFiles });
      return;
    }
    const currentKeys = new Set(fileDrafts.map((draft) => draft.key));
    const uniqueFiles = incoming.filter((file) => !currentKeys.has(draftKey(file)));
    if (!uniqueFiles.length) {
      setToast("Os arquivos selecionados ja estao na lista.");
      return;
    }
    if (fileDrafts.length + uniqueFiles.length > MAX_ATTACHMENT_BATCH_FILES) {
      setToast(`Selecione no maximo ${MAX_ATTACHMENT_BATCH_FILES} arquivos por envio.`);
      return;
    }
    const totalSize = [...fileDrafts.map((draft) => draft.file), ...uniqueFiles].reduce((sum, file) => sum + file.size, 0);
    if (totalSize > MAX_ATTACHMENT_BATCH_BYTES) {
      setLargeAttachmentAlert({ files: uniqueFiles, batch: true, totalSize });
      return;
    }
    const nextDrafts = uniqueFiles.map((file, index) => {
      const category = fileCategory(file);
      return {
        id: `draft-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
        key: draftKey(file),
        file,
        previewUrl: ["image", "video", "audio"].includes(category) ? URL.createObjectURL(file) : "",
        category,
        status: "waiting",
        progress: 0,
        error: "",
      };
    });
    setFileDrafts((drafts) => {
      const startIndex = drafts.length;
      setActiveFileIndex(startIndex);
      return [...drafts, ...nextDrafts];
    });
    setFileProgress(0);
    if (source === "clipboard") setToast("Imagem colada. Revise e clique em Enviar.");
    if (source === "drop") setToast(uniqueFiles.length > 1 ? "Arquivos adicionados. Revise e clique em Enviar." : "Arquivo adicionado. Revise e clique em Enviar.");
  };
  const selectFileDraft = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    createFileDraft(files, "anexo");
  };
  const clipboardImageFile = (clipboardData) => {
    const items = Array.from(clipboardData?.items || []);
    for (const item of items) {
      const type = String(item.type || "").toLowerCase();
      if (!clipboardImageTypes.has(type)) continue;
      const file = item.getAsFile?.();
      if (!file) continue;
      const extension = type.split("/")[1]?.replace("jpeg", "jpg") || "png";
      const name = file.name && file.name !== "image.png" ? file.name : `captura-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`;
      return new File([file], name, { type: file.type || type, lastModified: Date.now() });
    }
    const files = Array.from(clipboardData?.files || []);
    return files.find((file) => clipboardImageTypes.has(String(file.type || "").toLowerCase())) || null;
  };
  const handlePaste = (event) => {
    if (!internal || current.ended || !currentCanSendMessages) return;
    const file = clipboardImageFile(event.clipboardData);
    if (!file) return;
    event.preventDefault();
    event.stopPropagation();
    createFileDraft(file, "clipboard");
  };
  const handleDragOver = (event) => {
    if (!internal || current.ended || fileSending || !currentCanSendMessages) return;
    if (!Array.from(event.dataTransfer?.types || []).includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDragActive(true);
  };
  const handleDragLeave = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setDragActive(false);
  };
  const handleDrop = (event) => {
    if (!internal || current.ended || fileSending || !currentCanSendMessages) return;
    const files = Array.from(event.dataTransfer?.files || []);
    if (!files.length) return;
    event.preventDefault();
    setDragActive(false);
    createFileDraft(files, "drop");
  };
  const removeFileDraft = (id) => {
    setFileDrafts((drafts) => {
      const index = drafts.findIndex((draft) => draft.id === id);
      if (index >= 0 && drafts[index]?.previewUrl) URL.revokeObjectURL(drafts[index].previewUrl);
      const next = drafts.filter((draft) => draft.id !== id);
      setActiveFileIndex((value) => Math.min(Math.max(0, value > index ? value - 1 : value), Math.max(0, next.length - 1)));
      return next;
    });
  };
  const updateDraftStatus = (id, patch) => {
    setFileDrafts((drafts) => drafts.map((draft) => draft.id === id ? { ...draft, ...patch } : draft));
  };
  const updateOptimisticFileMessage = (conversationId, messageId, patch) => {
    setConversations((items) => items.map((item) => item.id === conversationId ? {
      ...item,
      messages: item.messages.map((message) => message.id === messageId ? {
        ...message,
        ...patch,
        file: patch.file ? { ...message.file, ...patch.file } : message.file,
      } : message),
    } : item));
  };
  const localAttachmentFile = (draft, clientMessageId) => {
    const extension = fileExtensionFromName(draft.file.name);
    return {
      id: clientMessageId,
      name: draft.file.name,
      originalName: draft.file.name,
      mime: draft.file.type || "application/octet-stream",
      size: draft.file.size,
      extension,
      url: draft.previewUrl || "",
      uploadProgress: 0,
      uploadStatus: "sending",
    };
  };
  const optimisticAttachmentMessage = ({ draft, conversationId, clientMessageId, batchId, order, total, caption, reply }) => ({
    id: `pending-file-${clientMessageId}`,
    type: "file",
    side: "out",
    sender: currentUser.name,
    senderId: currentUser.id,
    role: currentUser.role,
    text: order === 1 ? caption : "",
    file: localAttachmentFile(draft, clientMessageId),
    albumId: batchId || null,
    albumCaption: batchId ? caption : null,
    itemCaption: "",
    batchOrder: order,
    batchTotal: total,
    createdAt: new Date().toISOString(),
    time: "Agora",
    status: "sending",
    replyTo: reply || null,
    replyToMessageId: reply?.id || null,
    clientMessageId,
    retryDraft: { file: draft.file, previewUrl: draft.previewUrl || "", category: draft.category, caption },
    conversationId,
  });
  const uploadFileDraft = (draft, batch = {}) => new Promise((resolve, reject) => {
    const body = new FormData();
    body.append("file", draft.file, draft.file.name);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", apiUrl(`/api/internal/conversations/${batch.conversationId || current.id}/files`));
    xhr.withCredentials = true;
    if (batch.replyToMessageId) xhr.setRequestHeader("X-Reply-To-Message-Id", batch.replyToMessageId);
    if (batch.clientMessageId) xhr.setRequestHeader("X-Client-Message-Id", batch.clientMessageId);
    if (batch.message) xhr.setRequestHeader("X-Attachment-Caption", encodeURIComponent(batch.message));
    if (batch.albumId) xhr.setRequestHeader("X-Attachment-Album-Id", batch.albumId);
    if (batch.total) xhr.setRequestHeader("X-Attachment-Batch-Total", String(batch.total));
    if (batch.order) xhr.setRequestHeader("X-Attachment-Batch-Order", String(batch.order));
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const progress = Math.max(1, Math.round((event.loaded / event.total) * 100));
      updateDraftStatus(draft.id, { progress });
      batch.onProgress?.(progress);
    };
    xhr.onload = () => {
      let payload = {};
      try { payload = JSON.parse(xhr.responseText || "{}"); } catch {}
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(payload.error || `Erro ${xhr.status} ao enviar ${draft.file.name}.`));
        return;
      }
      resolve(payload);
    };
    xhr.onerror = () => reject(new Error(`Falha de rede ao enviar ${draft.file.name}.`));
    xhr.send(body);
  });
  const addMoreFiles = () => {
    if (fileSending) return;
    fileInputRef.current?.click();
  };
  const sendFileDraft = async () => {
    if (!fileDrafts.length || !current?.id || fileSending) return;
    if (!currentCanSendMessages) {
      setToast("Somente administradores podem enviar mensagens neste momento.");
      return;
    }
    const conversationSnapshot = current;
    const replySnapshot = replyTo;
    const failed = [];
    let latestPayload = null;
    const uploadable = fileDrafts.filter((draft) => draft.status !== "sent" && draft.status !== "sending");
    if (!uploadable.length) return;
    const duplicate = uploadable.find((draft) => pendingUploadKeysRef.current.has(`${conversationSnapshot.id}:${currentUser.id}:${draft.key}`));
    if (duplicate) {
      setToast(`${duplicate.file.name} ja esta sendo enviado.`);
      return;
    }
    setFileSending(true);
    setFileProgress(0);
    setFileProgressLabel("");
    const batchId = uploadable.length > 1 ? `album-${Date.now()}-${Math.random().toString(36).slice(2, 10)}` : "";
    const message = String(attachmentMessage || "").trim();
    const prepared = uploadable.map((draft, index) => ({
      draft,
      clientMessageId: createClientMessageId(),
      order: fileDrafts.findIndex((item) => item.id === draft.id) + 1 || index + 1,
    }));
    const optimisticMessages = prepared.map(({ draft, clientMessageId, order }) => optimisticAttachmentMessage({
      draft,
      conversationId: conversationSnapshot.id,
      clientMessageId,
      batchId,
      order,
      total: fileDrafts.length,
      caption: message,
      reply: replySnapshot,
    }));
    prepared.forEach(({ draft }) => pendingUploadKeysRef.current.add(`${conversationSnapshot.id}:${currentUser.id}:${draft.key}`));
    const localPreviewUrls = prepared.map(({ draft }) => draft.previewUrl).filter(Boolean);
    setConversations((items) => items.map((item) => item.id === conversationSnapshot.id ? {
      ...item,
      preview: message || prepared[0]?.draft.file.name || "Arquivo anexado",
      time: "Agora",
      messages: [...item.messages, ...optimisticMessages],
    } : item));
    setFileDrafts([]);
    setActiveFileIndex(0);
    setAttachmentMessage("");
    setFileSending(false);
    clearReplyForCurrent();
    for (let index = 0; index < uploadable.length; index += 1) {
      const { draft, clientMessageId, order } = prepared[index];
      const optimisticId = `pending-file-${clientMessageId}`;
      updateDraftStatus(draft.id, { status: "sending", progress: 0, error: "" });
      setFileProgressLabel(`Enviando ${index + 1} de ${uploadable.length}`);
      try {
        latestPayload = await uploadFileDraft(draft, {
          conversationId: conversationSnapshot.id,
          replyToMessageId: replySnapshot?.id || "",
          clientMessageId,
          albumId: batchId,
          order,
          total: fileDrafts.length,
          message: index === 0 ? message : "",
          onProgress: (progress) => updateOptimisticFileMessage(conversationSnapshot.id, optimisticId, { file: { uploadProgress: progress } }),
        });
        updateOptimisticFileMessage(conversationSnapshot.id, optimisticId, { status: "sent", file: { uploadProgress: 100, uploadStatus: "sent" } });
        updateDraftStatus(draft.id, { status: "sent", progress: 100, error: "" });
        setFileProgress(Math.round(((index + 1) / uploadable.length) * 100));
      } catch (error) {
        failed.push(optimisticId);
        updateOptimisticFileMessage(conversationSnapshot.id, optimisticId, { status: "failed", errors: [{ message: error.message }], file: { uploadStatus: "failed", uploadProgress: 0 } });
        updateDraftStatus(draft.id, { status: "error", error: error.message, progress: 0 });
      } finally {
        pendingUploadKeysRef.current.delete(`${conversationSnapshot.id}:${currentUser.id}:${draft.key}`);
      }
    }
    setFileProgressLabel("");
    if (failed.length) {
      if (latestPayload) {
        const failedMessages = optimisticMessages.filter((message) => failed.includes(message.id)).map((message) => ({ ...message, status: "failed", file: { ...message.file, uploadStatus: "failed", uploadProgress: 0 } }));
        setConversations((items) => items.map((item) => item.id === conversationSnapshot.id ? {
          ...mapInternalConversation(latestPayload, currentUser),
          messages: [...mapInternalConversation(latestPayload, currentUser).messages, ...failedMessages],
        } : item));
      }
      setToast("Alguns arquivos falharam. Use Tentar novamente na mensagem com falha.");
      return;
    }
    if (latestPayload) setConversations((items) => items.map((item) => item.id === conversationSnapshot.id ? mapInternalConversation(latestPayload, currentUser) : item));
    localPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    setToast(uploadable.length > 1 ? "Álbum enviado." : "Arquivo enviado.");
  };
  const retryAttachmentUpload = async (message) => {
    const retry = message.retryDraft;
    if (!retry?.file || !current?.id) return;
    if (!currentCanSendMessages) {
      setToast("Somente administradores podem enviar mensagens neste momento.");
      return;
    }
    const clientMessageId = createClientMessageId();
    const optimisticId = message.id;
    updateOptimisticFileMessage(current.id, optimisticId, {
      status: "sending",
      errors: [],
      clientMessageId,
      file: { uploadStatus: "sending", uploadProgress: 0 },
    });
    try {
      const payload = await uploadFileDraft({ id: optimisticId, key: draftKey(retry.file), file: retry.file, previewUrl: retry.previewUrl || "", category: retry.category }, {
        conversationId: current.id,
        clientMessageId,
        message: retry.caption || "",
        onProgress: (progress) => updateOptimisticFileMessage(current.id, optimisticId, { file: { uploadProgress: progress } }),
      });
      setConversations((items) => items.map((item) => item.id === current.id ? mapInternalConversation(payload, currentUser) : item));
    } catch (error) {
      updateOptimisticFileMessage(current.id, optimisticId, { status: "failed", errors: [{ message: error.message }], file: { uploadStatus: "failed", uploadProgress: 0 } });
      setToast(error.message);
    }
  };
  const addParticipant = async (selection) => {
    const selectedUsers = (Array.isArray(selection) ? selection : [selection])
      .map((item) => typeof item === "string" ? collaboratorsWithPresence.find((user) => user.name === item) : mergeUserPresence(item, presenceByUserId))
      .filter(Boolean);
    if (!selectedUsers.length) { setToast("Selecione pelo menos uma pessoa."); return; }
    if (internal && current?.id) {
      const existingIds = new Set(current.participantIds || []);
      const existingNames = new Set(current.participants || []);
      const toAdd = selectedUsers.filter((user) => user?.id && !existingIds.has(user.id) && !existingNames.has(user.name));
      if (!toAdd.length) { setToast("As pessoas selecionadas ja participam do grupo."); return; }
      try {
        let updated = null;
        for (const participant of toAdd) {
          updated = await apiRequest(`/api/internal/conversations/${current.id}/participants`, { method: "POST", body: JSON.stringify({ userId: participant.id, action: "add" }) });
        }
        if (updated) setConversations((items) => items.map((item) => item.id === current.id ? mapInternalConversation(updated, currentUser) : item));
        setModal("");
        setToast(toAdd.length === 1 ? `${toAdd[0].name} adicionado ao grupo.` : `${toAdd.length} pessoas adicionadas ao grupo.`);
      } catch (error) { setToast(error.message || "Nao foi possivel adicionar participantes."); }
      return;
    }
    const [name] = selectedUsers.map((user) => user.name || user).filter(Boolean);
    if (!name) return;
    if (current.participants.includes(name)) { setToast(`${name} ja participa desta conversa.`); setModal(""); return; }
    updateCurrent((conversation) => ({ ...conversation, participants: [...conversation.participants, name], messages: [...conversation.messages, { type: "system", text: `${name} foi adicionado a conversa por ${currentUser.name}`, time: "Agora" }] }));
    setModal("");
    setToast(`${name} adicionado a conversa.`);
  };
  const changeParticipantRole = async (user, action) => {
    if (!internal || !current?.id || current.type !== "group") return;
    if (!user?.id) {
      setToast("Participante sem identificador válido. Atualize a conversa e tente novamente.");
      return;
    }
    const actionLabels = {
      promote: "Participante promovido a administrador.",
      demote: "Administrador removido da função.",
      remove: "Participante removido do grupo.",
    };
    try {
      const updated = await apiRequest(`/api/internal/conversations/${current.id}/participants`, {
        method: "POST",
        body: JSON.stringify({ userId: user.id, action }),
      });
      setConversations((items) => items.map((item) => item.id === current.id ? mapInternalConversation(updated, currentUser) : item));
      setToast(actionLabels[action] || "Participantes atualizados.");
    } catch (error) {
      setToast(error.message || "Não foi possível atualizar o participante.");
    }
  };
  const changeGroupSendPolicy = async (messageSendMode) => {
    if (!internal || !current?.id || current.type !== "group") return;
    try {
      const updated = await apiRequest(`/api/internal/conversations/${current.id}/send-policy`, {
        method: "POST",
        body: JSON.stringify({ messageSendMode }),
      });
      setConversations((items) => items.map((item) => item.id === current.id ? mapInternalConversation(updated, currentUser) : item));
      setModal("");
      setMoreMenuOpen(false);
      setToast(messageSendMode === "admins" ? "Somente administradores podem enviar mensagens." : "Todos os participantes podem enviar mensagens.");
    } catch (error) {
      setToast(error.message || "Não foi possível alterar quem envia mensagens.");
    }
  };

  const leaveGroup = async () => {
    if (!current?.id || current.type !== "group") return;
    try {
      await apiRequest(`/api/internal/conversations/${current.id}/participants`, {
        method: "POST",
        body: JSON.stringify({ action: "leave" }),
      });
      setConversations((items) => items.filter((item) => item.id !== current.id));
      setSelectedId(null);
      setMoreMenuOpen(false);
      setToast("Você saiu do grupo.");
    } catch (error) {
      setToast(error.message);
    }
  };
  const transfer = async ({ department, user, reason }) => {
    if (current.source === "whatsapp-cloud") {
      try {
        await apiRequest(`/api/whatsapp/conversations/${current.id}/transfer`, {
          method: "POST",
          headers: apiUserHeaders(currentUser),
          body: JSON.stringify({ department, user, reason }),
        });
      } catch (error) {
        setToast(error.message);
        return;
      }
    }
    updateCurrent((conversation) => ({
      ...conversation,
      previousOwner: conversation.owner,
      department,
      dept: department,
      owner: user,
      participants: [...new Set([...conversation.participants, user])],
      transferred: true,
      status: "Transferido",
      preview: `Transferido para ${user} / ${department}`,
      transferHistory: [...(conversation.transferHistory || []), { from: conversation.owner, to: user, department, reason, time: new Date().toISOString() }],
      messages: [...conversation.messages, { type: "system", text: `Atendimento transferido por ${currentUser.name} para ${user} / ${department}. Motivo: ${reason}`, time: "Agora" }],
    }));
    setModal("");
    setToast(`Responsável atualizado para ${user}.`);
  };
  const startConversation = (target) => {
    const user = typeof target === "string"
      ? collaboratorsWithPresence.find((item) => item.name === target || item.displayName === target || item.username === target || item.email === target)
      : target;
    if (!user) {
      setToast("Colaborador não encontrado ou sem acesso.");
      return;
    }
    if (user.id === currentUser.id) {
      setToast("Não é possível iniciar conversa com você mesmo.");
      return;
    }
    const userName = user.name || user.displayName || user.username || user.email;
    const currentUserName = currentUser.name || currentUser.displayName || currentUser.username || currentUser.email;
    const existing = conversations.find((conversation) => {
      if (conversation.ended || conversation.type === "group") return false;
      const participantIds = conversation.participantIds || conversation.participantsIds || [];
      const participants = conversation.participants || [];
      const hasTarget = participantIds.includes(user.id) || participants.includes(userName) || participants.includes(user.displayName) || participants.includes(user.name);
      const hasCurrent = participantIds.includes(currentUser.id) || participants.includes(currentUserName) || participants.includes(currentUser.displayName) || participants.includes(currentUser.name);
      return hasTarget && hasCurrent && participants.length <= 2;
    });
    if (existing) {
      setSelectedId(existing.id);
      setMobileChat(true);
      setModal("");
      setToast("Conversa existente aberta.");
      return;
    }
    apiRequest("/api/internal/conversations", {
      method: "POST",
      body: JSON.stringify({ participantIds: [user.id], department: user.department || user.dept }),
    }).then((created) => {
      const conversation = mapInternalConversation(created, currentUser);
      setConversations((items) => [conversation, ...items.filter((item) => item.id !== conversation.id)]);
      setSelectedId(conversation.id);
      setMobileChat(true);
      setModal("");
    }).catch((error) => setToast(error.message));
  };
  const startGroup = (group) => {
    apiRequest("/api/internal/conversations", {
      method: "POST",
      body: JSON.stringify({ type: "group", title: group.title, description: group.description, participantIds: group.participantIds }),
    }).then((created) => {
      const conversation = mapInternalConversation(created, currentUser);
      setConversations((items) => [conversation, ...items.filter((item) => item.id !== conversation.id)]);
      setSelectedId(conversation.id);
      setMobileChat(true);
      setModal("");
      setToast("Grupo criado com participantes autorizados.");
    }).catch((error) => setToast(error.message));
  };
  const forwardMessage = async ({ destinationIds, comment }) => {
    if (!forwarding) return;
    const blockedDestination = scopedConversations.find((conversation) => destinationIds.includes(conversation.id) && !canSendToConversation(conversation));
    if (blockedDestination) {
      setToast(`Somente administradores podem encaminhar mensagens para ${blockedDestination.name}.`);
      return;
    }
    try {
      await apiRequest(`/api/internal/conversations/${current.id}/forward`, {
        method: "POST",
        body: JSON.stringify({ messageId: forwarding.id, destinationIds, comment }),
      });
      const rows = await apiRequest("/api/internal/conversations");
      setConversations(rows.map((item) => mapInternalConversation(item, currentUser)));
      setForwarding(null);
      setToast("Mensagem encaminhada.");
    } catch (error) {
      setToast(error.message);
    }
  };
  const reactToMessage = async (message, emoji) => {
    if (!internal || !current?.id || current.source !== "internal-api" || !message?.id) return;
    try {
      const updated = await apiRequest(`/api/internal/conversations/${current.id}/react`, {
        method: "POST",
        body: JSON.stringify({ messageId: message.id, emoji }),
      });
      setConversations((items) => items.map((item) => item.id === current.id ? mapInternalConversation(updated, currentUser) : item));
    } catch (error) {
      setToast(error.message);
    }
  };
  const endConversation = async () => {
    if (current.source === "internal-api") {
      try {
        const updated = await apiRequest(`/api/internal/conversations/${current.id}/close`, {
          method: "POST",
          body: "{}",
        });
        setConversations((items) => items.map((item) => item.id === current.id ? mapInternalConversation(updated, currentUser) : item));
        setModal("");
        return;
      } catch (error) {
        setToast(error.message);
        return;
      }
    }
    if (current.source === "whatsapp-cloud") {
      try {
        await apiRequest(`/api/whatsapp/conversations/${current.id}/close`, {
          method: "POST",
          headers: apiUserHeaders(currentUser),
          body: "{}",
        });
      } catch (error) {
        setToast(error.message);
        return;
      }
    }
    updateCurrent((conversation) => ({
      ...conversation,
      ended: true,
      status: "Encerrado",
      preview: internal ? "Conversa encerrada" : "Atendimento encerrado",
      messages: [...conversation.messages, { type: "system", text: `${internal ? "Conversa encerrada" : "Atendimento encerrado"} por ${currentUser.name}`, time: "Agora" }],
    }));
    setModal("");
  };
  const handleMoreAction = (action) => {
    setMoreMenuOpen(false);
    if (action === "participants") return setModal("participants");
    if (action === "message-policy") return setModal("message-policy");
    if (action === "shared-media") return setModal("shared-media");
    if (action === "mute") return setToast("Silenciar grupo será disponibilizado em uma próxima etapa.");
    if (action === "edit") return setToast("Editar grupo será disponibilizado em uma próxima etapa.");
    if (action === "image") return setToast("Alterar imagem será disponibilizado em uma próxima etapa.");
    if (action === "leave") return leaveGroup();
    if (action === "end") return setModal("end");
  };

  const filteredConversations = scopedConversations.filter((conversation) => {
    const searchableText = [
      conversation.name,
      conversation.phone,
      conversation.preview,
      conversation.department,
      conversation.dept,
      conversation.owner,
      conversation.status,
      ...(conversation.participants || []),
      ...(conversation.participantUsers || []).flatMap((user) => [user?.name, user?.displayName, user?.username, user?.email, user?.department, user?.dept]),
    ].filter(Boolean).join(" ");
    const matchesText = normalizeSearchText(searchableText).includes(normalizeSearchText(search).trim());
    const matchesFilter = internal
      ? filter === "Todos" || (filter === "Diretas" && conversation.type !== "group") || (filter === "Grupos" && conversation.type === "group")
      : filter === "Todos" || conversation.status === filter;
    return matchesText && matchesFilter;
  });
  const jumpToMessage = (messageId) => {
    const safeId = window.CSS?.escape ? CSS.escape(String(messageId)) : String(messageId).replace(/"/g, "");
    const node = messagesRef.current?.querySelector(`[data-message-id="${safeId}"]`);
    if (node) node.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const highlightMessage = (messageId) => {
    setLocatedMessageId(messageId);
    window.setTimeout(() => setLocatedMessageId((value) => value === messageId ? "" : value), 3200);
  };
  const openMessageInConversation = async (item) => {
    if (!item?.messageId || !current?.id) return setToast("Nao foi possivel localizar a mensagem original.");
    setModal("");
    setSelectedId(item.conversationId || current.id);
    setMobileChat(true);
    let found = (current.messages || []).some((message) => message.id === item.messageId);
    if (!found && internal) {
      try {
        const result = await apiRequest(`/api/internal/conversations/${item.conversationId || current.id}/messages/around/${item.messageId}`);
        if (Array.isArray(result.messages)) {
          setConversations((rows) => rows.map((conversation) => {
            if (conversation.id !== (item.conversationId || current.id)) return conversation;
            const byId = new Map((conversation.messages || []).map((message) => [message.id, message]));
            result.messages.forEach((message) => byId.set(message.id, message));
            const messages = Array.from(byId.values()).sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
            return { ...conversation, messages };
          }));
          found = result.messages.some((message) => message.id === item.messageId);
        }
      } catch (error) {
        setToast(error.message || "Nao foi possivel localizar a mensagem original.");
        return;
      }
    }
    if (!found) return setToast("Nao foi possivel localizar a mensagem original.");
    window.setTimeout(() => { jumpToMessage(item.messageId); highlightMessage(item.messageId); }, 120);
  };
  useEffect(() => {
    if (!internal || !current?.id) return;
    let target = null;
    try { target = JSON.parse(sessionStorage.getItem("cipolatti-open-message-target") || "null"); } catch { target = null; }
    const requestedMessageId = target?.messageId || sessionStorage.getItem("cipolatti-open-message-id") || "";
    const requestedConversationId = target?.conversationId || current.id;
    if (requestedConversationId !== current.id) return;
    if (!requestedMessageId) {
      window.setTimeout(() => scrollMessagesToBottom("smooth"), 160);
      return;
    }
    sessionStorage.removeItem("cipolatti-open-message-target");
    sessionStorage.removeItem("cipolatti-open-message-id");
    window.setTimeout(() => openMessageInConversation({ conversationId: current.id, messageId: requestedMessageId }), 160);
  }, [internal, current?.id, current?.messages?.length]);

  const moveSearchResult = (delta) => {
    if (!searchResults.length) return;
    setActiveSearchIndex((value) => (value + delta + searchResults.length) % searchResults.length);
  };
  const closeConversationSearch = () => {
    setConversationSearchOpen(false);
    setConversationSearch("");
    setActiveSearchIndex(0);
  };
  const handleConversationSearchKey = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeConversationSearch();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      moveSearchResult(event.shiftKey ? -1 : 1);
    }
  };
  const draftPreview = (conversationId) => {
    const value = draftsByConversationId[conversationId]?.text || "";
    const clean = value.replace(/\s+/g, " ").trim();
    return clean ? `Rascunho: ${clean.slice(0, 90)}${clean.length > 90 ? "..." : ""}` : "";
  };

  if (!current) return (
    <div className={`chat-layout ${internal ? "internal-chat-layout" : ""}`}>
      <aside className="conversation-list">
        <div className="conversation-heading">
          <h2>{groupOnly ? "Grupos" : internal ? "Conversas" : "Atendimentos"}</h2>
          {internal ? <div className="conversation-heading-actions">{groupOnly ? <button className="primary-button new-chat-button" onClick={() => setModal("new-group")}><Users size={16} /> Novo grupo</button> : <button className="primary-button new-chat-button" onClick={() => setModal("new-chat")}><Plus size={16} /> Nova conversa</button>}</div> : <Filter size={18} />}
        </div>
        <div className="conversation-tabs">{(internal ? ["Todos", "Diretas", "Grupos"] : ["Todos", "Aguardando", "Em atendimento"]).map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}{item === "Todos" && ` ${scopedConversations.length}`}</button>)}</div>
        <label className="list-search conversation-list-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={internal ? "Buscar conversa ou usuário..." : "Buscar atendimentos..."} />{search && <button type="button" className="list-search-clear" onClick={() => setSearch("")} aria-label="Limpar busca"><X size={14} /></button>}</label>
        <div className="conversation-items">
          {filteredConversations.map((conversation) => (
            <button key={conversation.id} className={`conversation-item ${conversation.unread ? "unread" : ""}`} onClick={() => { setSelectedId(conversation.id); setMobileChat(true); }}>
              <Avatar initials={conversation.initials} color={conversation.color} src={conversation.photoUrl} alt={conversation.name} />
              <div><strong>{conversation.name}{internal && conversation.otherUser && <PresenceIndicator user={conversation.otherUser} />}</strong><span className={draftPreview(conversation.id) ? "draft-preview" : ""}>{outOfOfficeLabel(conversation.otherUserOutOfOffice) || draftPreview(conversation.id) || conversation.preview}</span>{conversation.unread > 0 && <em className="unread-label">Não lido</em>}</div>
              <time>{conversation.time}{conversation.unread > 0 && <b title="Não lido">{conversation.unread > 9 ? "9+" : conversation.unread}</b>}{conversation.transferred && <b title="Transferido">T</b>}</time>
            </button>
          ))}
        </div>
      </aside>
      <main className="chat-main empty-selection-main">
        <div className="empty-chat"><MessageCircle /><h2>{scopedConversations.length ? "Selecione uma conversa para começar" : groupOnly ? "Nenhum grupo" : "Nenhuma conversa"}</h2><p className="panel-copy">{scopedConversations.length ? "Escolha uma conversa na lista ao lado." : groupOnly ? "Você ainda não participa de grupos." : "Você ainda não possui conversas."}</p><div className="empty-chat-actions">{groupOnly ? <button className="primary-button" onClick={() => setModal("new-group")}><Users size={16}/> Novo grupo</button> : <button className="primary-button" onClick={() => setModal("new-chat")}><Plus size={16}/> Nova conversa</button>}</div></div>
      </main>
      {modal === "new-chat" && <NewConversationModal collaborators={collaboratorsWithPresence} currentUser={currentUser} onClose={() => setModal("")} onConfirm={startConversation} />}
      {modal === "new-group" && <GroupModal currentUser={currentUser} collaborators={collaboratorsWithPresence} onClose={() => setModal("")} onConfirm={startGroup} />}
      {blockedAttachmentAlert && <BlockedAttachmentModal {...blockedAttachmentAlert} onClose={() => setBlockedAttachmentAlert(null)} />}
      {largeAttachmentAlert && <LargeAttachmentModal {...largeAttachmentAlert} onClose={() => setLargeAttachmentAlert(null)} />}
      {toast && <Toast message={toast} tone="warning" onClose={() => setToast("")} />}
    </div>
  );

  return (
    <div className={`chat-layout ${internal ? "internal-chat-layout" : ""} ${mobileChat ? "mobile-chat-open" : ""}`}>
      <aside className="conversation-list">
        <div className="conversation-heading">
          <h2>{groupOnly ? "Grupos" : internal ? "Conversas" : "Atendimentos"}</h2>
          {internal ? <div className="conversation-heading-actions">{groupOnly ? <button className="primary-button new-chat-button" onClick={() => setModal("new-group")}><Users size={16} /> Novo grupo</button> : <button className="primary-button new-chat-button" onClick={() => setModal("new-chat")}><Plus size={16} /> Nova conversa</button>}</div> : <Filter size={18} />}
        </div>
        <div className="conversation-tabs">{(internal ? ["Todos", "Diretas", "Grupos"] : ["Todos", "Aguardando", "Em atendimento"]).map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}{item === "Todos" && ` ${scopedConversations.length}`}</button>)}</div>
        <label className="list-search conversation-list-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setSearch(""); } if (event.key === "Enter" && filteredConversations[0]) { event.preventDefault(); setSelectedId(filteredConversations[0].id); setMobileChat(true); } }} placeholder={internal ? "Buscar conversa ou usuário..." : "Buscar atendimentos..."} />{search && <button type="button" className="list-search-clear" onClick={() => setSearch("")} aria-label="Limpar busca"><X size={14} /></button>}</label>
        <div className="conversation-items">
          {filteredConversations.map((conversation) => (
            <button key={conversation.id} className={`conversation-item ${current.id === conversation.id ? "selected" : ""} ${conversation.unread ? "unread" : ""}`} onClick={() => { setSelectedId(conversation.id); setMobileChat(true); }}>
              <Avatar initials={conversation.initials} color={conversation.color} src={conversation.photoUrl} alt={conversation.name} />
              <div><strong>{conversation.name}{internal && conversation.otherUser && <PresenceIndicator user={conversation.otherUser} />}</strong><span className={draftPreview(conversation.id) ? "draft-preview" : ""}>{outOfOfficeLabel(conversation.otherUserOutOfOffice) || draftPreview(conversation.id) || conversation.preview}</span>{conversation.unread > 0 && <em className="unread-label">Não lido</em>}</div>
              <time>{conversation.time}{conversation.unread > 0 && <b title="Não lido">{conversation.unread > 9 ? "9+" : conversation.unread}</b>}{conversation.transferred && <b title="Transferido">T</b>}</time>
            </button>
          ))}
        </div>
        {!internal && <button className="load-more" disabled>Todos os atendimentos carregados</button>}
      </aside>

      <main className={`chat-main ${dragActive ? "drag-active" : ""}`} onPaste={handlePaste} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
        <header className="chat-contact-header">
          <button className="icon-button mobile-back" onClick={() => setMobileChat(false)} aria-label="Voltar para lista"><ChevronLeft size={22} /></button>
          <Avatar initials={current.initials} color={current.color} src={current.photoUrl} alt={current.name} />
          <div><h2>{current.name}</h2><p>{internal ? (current.type === "group" ? <button type="button" className="header-participants-button" onClick={() => setModal("participants")}>{current.participants.length} participantes</button> : <PresenceIndicator user={current.otherUser} showLabel />) : current.phone}</p>{internal && outOfOfficeLabel(current.otherUserOutOfOffice) && <small className="out-of-office-inline">{outOfOfficeLabel(current.otherUserOutOfOffice)}</small>}</div>
          <div className="chat-actions">
            {!internal && <button className="secondary-button" onClick={() => setModal("transfer")}><ArrowLeftRight size={17} /> Transferir</button>}
            {internal && <button className="secondary-button" onClick={() => setModal("shared-media")}><Paperclip size={17} /> Midias</button>}
            {internal && current.type === "group" && currentCanManageGroup && <button className="secondary-button" onClick={() => setModal("participant")}><UserPlus size={17} /> Adicionar pessoa</button>}
            {internal && current.type === "group" && <div className="chat-more"><button className="icon-button" aria-label="Mais opções" onClick={() => setMoreMenuOpen((value) => !value)}><MoreHorizontal size={19}/></button>{moreMenuOpen && <div className="chat-more-menu"><button onClick={() => handleMoreAction("edit")}>Editar grupo</button><button onClick={() => handleMoreAction("image")}>Alterar imagem</button><button onClick={() => handleMoreAction("participants")}>Ver participantes</button>{currentCanManageGroup && <button onClick={() => handleMoreAction("message-policy")}>Permitir mensagens</button>}<button onClick={() => handleMoreAction("shared-media")}>Midias compartilhadas</button><button onClick={() => handleMoreAction("mute")}>Silenciar grupo</button><button className="danger-option" disabled={current.ended} onClick={() => handleMoreAction("end")}>Encerrar grupo</button><button onClick={() => handleMoreAction("leave")}>Sair do grupo</button></div>}</div>}
            {internal ? <button className="secondary-button" onClick={() => setConversationSearchOpen(true)}><Search size={17} /> Buscar na conversa</button> : <button className="danger-button" disabled={current.ended} onClick={() => setModal("end")}>{current.ended ? "Atendimento encerrado" : "Encerrar atendimento"}</button>}
          </div>
        </header>
        {internal && outOfOfficeLabel(current.otherUserOutOfOffice) && <div className="out-of-office-chat-notice"><Clock3 size={15}/><span>{current.name} está fora da empresa. {outOfOfficeLabel(current.otherUserOutOfOffice)}</span></div>}
        {conversationSearchOpen && <div className="conversation-search-bar">
          <label><Search size={16}/><input ref={conversationSearchRef} value={conversationSearch} onChange={(event) => setConversationSearch(event.target.value)} onKeyDown={handleConversationSearchKey} placeholder="Buscar na conversa..." /></label>
          <span>{conversationSearch.trim() ? (searchResults.length ? `${Math.min(activeSearchIndex + 1, searchResults.length)} de ${searchResults.length}` : "0 ocorrências") : "Digite para buscar"}</span>
          <button className="icon-button" disabled={!searchResults.length} onClick={() => moveSearchResult(-1)} title="Resultado anterior"><ChevronDown className="rotate-up" size={17}/></button>
          <button className="icon-button" disabled={!searchResults.length} onClick={() => moveSearchResult(1)} title="Próximo resultado"><ChevronDown size={17}/></button>
          <button className="icon-button" onClick={closeConversationSearch} title="Fechar busca"><X size={17}/></button>
        </div>}
        {!internal && <div className="chat-meta">
          <span>{current.department}</span>
          <p>Responsável: <b>{current.owner}</b></p>
          <p>Participantes: {current.participants.join(", ")}</p>
          {current.transferred && <Status>Transferido</Status>}
        </div>}
        <div className="messages" ref={messagesRef} data-testid="messages-scroll" onScroll={() => { const nearBottom = isNearMessagesBottom(); followLatestRef.current = nearBottom; setShowJumpLatest(!nearBottom); if (nearBottom) setPendingLatestCount(0); }}>
          {dragActive && <div className="drop-overlay"><Paperclip size={22}/><span>Solte o arquivo para anexar</span></div>}
          {visibleMessages.map((message, index) => {
            const messageId = message.id || `${message.time || ""}-${index}`;
            const previousMessage = visibleMessages[index - 1];
            const currentDateKey = messageDateGroupKey(message, index);
            const previousDateKey = previousMessage ? messageDateGroupKey(previousMessage, index - 1) : "";
            const showDateDivider = currentDateKey !== previousDateKey;
            const matched = searchResults.some((item) => item.id === messageId);
            const activeMatch = activeSearchMessageId === messageId;
            const isOutOfOfficeMessage = message.messageType === "out_of_office" || message.outOfOffice;
            const renderedMessage = message.type === "system"
              ? <div className={`system-message ${isOutOfOfficeMessage ? "system-message-out-of-office" : ""} ${matched ? "search-matched" : ""} ${activeMatch ? "search-active" : ""} ${locatedMessageId === messageId ? "message-located" : ""}`} data-message-id={messageId}>{isOutOfOfficeMessage && <strong>Resposta automática - Fora do escritório</strong>}<HighlightedText text={message.text} query={conversationSearch} /><time>{message.time}</time></div>
              : <MessageBubble {...message} id={messageId} showSender={current?.type === "group" || (current?.participantUsers?.length || 0) > 2} searchQuery={conversationSearch} searchMatched={matched} searchActive={activeMatch} located={locatedMessageId === messageId} currentUserId={currentUser.id} onReply={() => selectReply(message)} onForward={internal ? () => setForwarding(message) : null} onReact={internal ? (emoji) => reactToMessage(message, emoji) : null} onEdit={canEditMessage(message) ? () => startEditingMessage(message) : null} onJump={jumpToMessage} onRetry={message.status === "failed" && message.retryDraft ? () => retryAttachmentUpload(message) : null} />;
            return <React.Fragment key={messageId}>
              {showDateDivider && <div className="date-divider"><span>{formatMessageDateLabel(message)}</span></div>}
              {renderedMessage}
            </React.Fragment>;
          })}
        </div>
          <div className="composer-wrap">
            {showJumpLatest && <button type="button" className="jump-latest" onClick={() => scrollMessagesToBottom("smooth")}>↓ {pendingLatestCount > 0 ? `${pendingLatestCount} nova${pendingLatestCount === 1 ? "" : "s"} mensagem${pendingLatestCount === 1 ? "" : "s"}` : "Novas mensagens"}</button>}
            {!internal && <div className="composer-tabs">{["Responder", "Observação interna"].map((item) => <button key={item} className={mode === item ? "active" : ""} onClick={() => setMode(item)}>{item}</button>)}</div>}
            {replyTo && <div className="reply-preview" data-testid="reply-preview"><button type="button" onClick={() => jumpToMessage(replyTo.id)}><strong>Respondendo a {replyTo.sender || "mensagem"}</strong><span>{messageExcerpt(replyTo)}</span></button><button type="button" className="icon-button" onClick={clearReplyForCurrent} aria-label="Cancelar resposta"><X size={15}/></button></div>}
            {editingMessage && <div className="edit-preview" data-testid="edit-preview"><div><strong>Editando mensagem</strong><span>Enter salva · Esc cancela</span></div><button type="button" className="icon-button" onClick={cancelEditingMessage} aria-label="Cancelar edição"><X size={15}/></button></div>}
          {groupSendBlocked && <div className="composer-blocked-notice">Somente administradores podem enviar mensagens neste momento.</div>}
          <div className={`composer ${groupSendBlocked ? "composer-disabled" : ""}`}>
            {internal && <input ref={fileInputRef} type="file" multiple hidden onChange={selectFileDraft} />}
            <textarea ref={composerTextRef} disabled={current.ended || groupSendBlocked || Boolean(fileDraft)} value={text} onPaste={handlePaste} onChange={(event) => editingMessage ? setText(event.target.value) : updateComposerText(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape" && editingMessage) { event.preventDefault(); cancelEditingMessage(); } if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} placeholder={current.ended ? "Conversa encerrada. Inicie uma nova conversa." : groupSendBlocked ? "Somente administradores podem enviar mensagens." : editingMessage ? "Edite sua mensagem..." : fileDraft ? "Envie ou cancele os anexos selecionados." : "Digite sua mensagem..."} />
            <div className="composer-tools">
              <span className="composer-left-tools"><button title="Emoji" aria-label="Abrir emojis" disabled={current.ended || groupSendBlocked || Boolean(fileDraft)} onClick={() => setEmojiOpen((value) => !value)}><Smile /></button><button title="Anexar" disabled={current.ended || groupSendBlocked || !internal || Boolean(fileDraft)} onClick={() => fileInputRef.current?.click()}><Paperclip /></button>{internal&&<button className={recordingAudio ? "recording-tool" : ""} title={recordingAudio ? "Parar gravação" : "Gravar áudio"} disabled={current.ended || groupSendBlocked || Boolean(audioDraft) || Boolean(fileDraft)} onClick={() => recordingAudio ? recorderRef.current?.stop() : startAudioRecording()}><Mic /></button>}</span>
              {editingMessage && <button className="secondary-button compact-action" type="button" onClick={cancelEditingMessage}>Cancelar</button>}
              <button className="send-button" disabled={current.ended || groupSendBlocked || fileSending || (!text.trim() && !fileDraft?.file)} onClick={sendMessage} title={editingMessage ? "Salvar edição" : "Enviar"}>{editingMessage ? <Save /> : <Send />}</button>
            </div>
            {emojiOpen && <EmojiPickerPanel pickerRef={emojiPickerRef} recentEmojis={recentEmojis} onSelect={insertEmoji} onClose={() => setEmojiOpen(false)} />}
          </div>
          {internal && fileDrafts.length > 0 && <AttachmentModal drafts={fileDrafts} activeIndex={activeFileIndex} sending={fileSending} totalProgress={fileProgress} progressLabel={fileProgressLabel} message={attachmentMessage} onMessageChange={setAttachmentMessage} onActiveChange={setActiveFileIndex} onRemove={removeFileDraft} onAddMore={addMoreFiles} onCancel={cancelFileDraft} onSend={sendFileDraft} onDrop={(files) => createFileDraft(files, "drop")} />}
          {internal && audioDraft && <div className="audio-draft"><Mic size={16}/><audio controls src={audioDraft.url}/><span>{audioDraft.durationSeconds}s</span><button className="secondary-button" onClick={cancelAudioDraft}>Cancelar</button><button className="primary-button" onClick={sendAudioDraft}><Send size={15}/> Enviar áudio</button></div>}
          {internal && recordingAudio && <div className="audio-draft recording"><Mic size={16}/><span>Gravando áudio...</span><button className="danger-button" onClick={() => recorderRef.current?.stop()}>Parar</button></div>}
          <small className="typing">{current.ended ? "Esta conversa foi encerrada." : `Você está respondendo como ${currentUser.name} - ${currentUser.role}`}</small>
        </div>
      </main>

      {!internal && <ContactPanel contact={current} onToast={setToast} onEdit={() => setModal("contact")} onShortcut={(value) => updateComposerText(value)} />}

      {modal === "new-chat" && <NewConversationModal collaborators={collaboratorsWithPresence} currentUser={currentUser} onClose={() => setModal("")} onConfirm={startConversation} />}
      {modal === "new-group" && <GroupModal currentUser={currentUser} collaborators={collaboratorsWithPresence} onClose={() => setModal("")} onConfirm={startGroup} />}
      {modal === "transfer" && <TransferModal onClose={() => setModal("")} onConfirm={transfer} />}
      {modal === "participant" && <AddParticipantsModal conversation={current} directory={collaboratorsWithPresence} onClose={() => setModal("")} onConfirm={addParticipant} />}
      {modal === "participants" && <ParticipantsModal conversation={current} directory={collaboratorsWithPresence} currentUser={currentUser} onAction={changeParticipantRole} onClose={() => setModal("")} />}
      {modal === "message-policy" && <Modal title="Permitir mensagens" onClose={() => setModal("")} footer={<><button className="secondary-button" onClick={() => setModal("")}>Cancelar</button><button className="primary-button" onClick={() => changeGroupSendPolicy(current?.messageSendMode === "admins" ? "all" : "admins")}>{current?.messageSendMode === "admins" ? "Permitir todos" : "Somente administradores"}</button></>}><div className="group-send-policy"><p>Defina quem pode enviar texto, áudio, imagens, anexos, respostas e encaminhamentos neste grupo.</p><label className={current?.messageSendMode !== "admins" ? "selected" : ""}><input type="radio" name="group-send-policy" checked={current?.messageSendMode !== "admins"} onChange={() => changeGroupSendPolicy("all")} /><span><strong>Todos os participantes</strong><small>Todos continuam lendo e enviando normalmente.</small></span></label><label className={current?.messageSendMode === "admins" ? "selected" : ""}><input type="radio" name="group-send-policy" checked={current?.messageSendMode === "admins"} onChange={() => changeGroupSendPolicy("admins")} /><span><strong>Somente administradores</strong><small>Participantes comuns continuam lendo, mas não enviam mensagens.</small></span></label></div></Modal>}
      {modal === "shared-media" && <SharedMediaModal conversation={current} onClose={() => setModal("")} onOpenMessage={openMessageInConversation} />}
      {modal === "contact" && <TextModal title="Editar contato" label="Nome do contato" initialValue={current.name} onClose={() => setModal("")} onConfirm={(value) => { updateCurrent((conversation) => ({ ...conversation, name: value })); setModal(""); }} />}
      {modal === "end" && <Modal title={internal ? "Encerrar conversa" : "Encerrar atendimento"} onClose={() => setModal("")} footer={<><button className="secondary-button" onClick={() => setModal("")}>Cancelar</button><button className="danger-button" onClick={endConversation}>Confirmar encerramento</button></>}><p>O histórico será preservado e uma nova conversa poderá ser iniciada a qualquer momento.</p></Modal>}
      {forwarding && <ForwardModal conversations={scopedConversations.filter((conversation) => conversation.id !== current.id && !conversation.ended && canSendToConversation(conversation))} message={forwarding} onClose={() => setForwarding(null)} onConfirm={forwardMessage} />}
      {blockedAttachmentAlert && <BlockedAttachmentModal {...blockedAttachmentAlert} onClose={() => setBlockedAttachmentAlert(null)} />}
      {largeAttachmentAlert && <LargeAttachmentModal {...largeAttachmentAlert} onClose={() => setLargeAttachmentAlert(null)} />}
      {toast && <Toast message={toast} tone={toast.includes("dependem") ? "warning" : "success"} onClose={() => setToast("")} />}
    </div>
  );
}

function sharedMediaItems(conversation = {}) {
  const linkRe = /https?:\/\/[^\s<>()]+/gi;
  return (conversation.messages || []).flatMap((message) => {
    const base = { conversationId: conversation.id, messageId: message.id, senderId: message.senderId, sender: message.sender, createdAt: message.createdAt };
    const rows = [];
    if (message.type === "file" && message.file) rows.push({ ...base, attachmentId: message.file.id, kind: fileCategory(message.file), name: message.file.originalName || message.file.name || "Arquivo", file: message.file, url: mediaUrl(message.file.url), size: message.file.size, extension: message.file.extension });
    if (message.type === "audio" && message.audio?.url) rows.push({ ...base, attachmentId: message.audio.id || message.id, kind: "audio", name: message.audio.originalName || "Audio gravado", file: message.audio, url: mediaUrl(message.audio.url), size: message.audio.size, extension: "audio" });
    const links = String(message.text || "").match(linkRe) || [];
    links.forEach((url, index) => rows.push({ ...base, attachmentId: `${message.id}-link-${index}`, kind: "link", name: url, url }));
    return rows;
  }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function SharedMediaModal({ conversation, onClose, onOpenMessage }) {
  const [tab, setTab] = useState("todos");
  const [query, setQuery] = useState("");
  const items = useMemo(() => sharedMediaItems(conversation), [conversation]);
  const tabs = [["todos", "Todos"], ["image", "Fotos"], ["video", "Vídeos"], ["audio", "Áudios"], ["document", "Documentos"], ["link", "Links"]];
  const filtered = items.filter((item) => {
    const kind = ["pdf", "word", "sheet", "presentation", "archive", "technical", "document"].includes(item.kind) ? "document" : item.kind;
    const matchesTab = tab === "todos" || kind === tab;
    const haystack = normalizeSearchText([item.name, item.extension, item.sender, item.kind, item.createdAt].filter(Boolean).join(" "));
    return matchesTab && (!query.trim() || haystack.includes(normalizeSearchText(query).trim()));
  });
  return <Modal title="Mídias compartilhadas" className="shared-media-modal-shell" onClose={onClose} footer={<button className="primary-button" onClick={onClose}>Fechar</button>}>
    <div className="shared-media-modal">
      <div className="shared-media-toolbar">
        <label className="list-search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome, tipo, data ou remetente" autoFocus /></label>
        <div className="shared-media-tabs">{tabs.map(([id, label]) => <button type="button" key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>)}</div>
      </div>
      <div className="shared-media-list">
        {filtered.map((item) => <article className={`shared-media-item shared-media-${item.kind}`} key={item.attachmentId || item.messageId}>
          <div className="shared-media-card-main">
            <div className="shared-media-preview">{item.kind === "image" && item.url ? <img src={item.url} alt="" /> : item.kind === "video" ? <Video size={20}/> : item.kind === "audio" ? <Mic size={20}/> : item.kind === "link" ? <Webhook size={20}/> : <AttachmentIcon category={item.kind} />}</div>
            <div className="shared-media-info">
              <strong title={item.name}>{item.name}</strong>
              <span>{item.sender || "Remetente"}</span>
              <span>{item.createdAt ? new Date(item.createdAt).toLocaleString("pt-BR") : "Data indisponível"}</span>
              {(item.size || item.extension) ? <small>{item.size ? formatFileSize(item.size) : "Tamanho indisponível"}{item.extension ? ` • ${String(item.extension).toUpperCase()}` : ""}</small> : null}
            </div>
          </div>
          <div className="shared-media-actions">
            <button type="button" className="primary-button compact-action" onClick={() => onOpenMessage(item)}>Ver na conversa</button>
          </div>
        </article>)}
        {!filtered.length && <div className="empty-result">Nenhuma mídia encontrada.</div>}
      </div>
    </div>
  </Modal>;
}


function TransferModal({ onClose, onConfirm }) {
  const [activeDepartments, setActiveDepartments] = useState([]);
  const [collaborators, setCollaborators] = useState([]);
  const [department, setDepartment] = useState("");
  const [user, setUser] = useState("");
  const [reason, setReason] = useState("");
  const availableUsers = collaborators.filter((item) => item.dept === department || item.role === "Administrador");

  useEffect(() => {
    let active = true;
    Promise.all([apiRequest("/api/departments"), apiRequest("/api/users")])
      .then(([departmentRows, userRows]) => {
        if (!active) return;
        const departments = departmentRows.filter((item) => item.status === "Ativo");
        setActiveDepartments(departments);
        setCollaborators(sortByDisplayName(userRows));
        setDepartment(departments[0]?.name || "");
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setUser((collaborators.find((item) => item.dept === department) || collaborators[0])?.name || "");
  }, [department, collaborators]);

  return <Modal title="Transferir atendimento" onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={!reason.trim() || !user} onClick={() => onConfirm({ department, user, reason: reason.trim() })}>Transferir com histórico</button></>}>
    <div className="modal-grid">
      <label className="modal-field"><span>Departamento</span><select value={department} onChange={(event) => setDepartment(event.target.value)}>{activeDepartments.map((item) => <option key={item.id}>{item.name}</option>)}</select></label>
      <label className="modal-field"><span>Novo responsável</span><select value={user} onChange={(event) => setUser(event.target.value)}>{availableUsers.map((item) => <option key={item.name}>{item.name}</option>)}</select></label>
      <label className="modal-field full"><span>Motivo da transferência</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explique o contexto para o próximo atendente."/></label>
    </div>
    {!availableUsers.length && <p className="transfer-note">Este departamento ainda não possui colaborador vinculado. Cadastre a equipe antes de transferir.</p>}
    <p className="transfer-note">Dados do cliente, formulário, mensagens e responsáveis anteriores serão preservados.</p>
  </Modal>;
}

function AddParticipantsModal({ conversation, directory = [], onClose, onConfirm }) {
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const participantIds = new Set(conversation.participantIds || []);
  const participantNames = new Set(conversation.participants || []);
  const normalizedQuery = normalizeSearchText(query).trim();
  const rows = directory.filter((user) => {
    const haystack = normalizeSearchText([user.name, user.displayName, user.username, user.email, user.department, user.dept, user.jobTitle, user.role].filter(Boolean).join(" "));
    return !normalizedQuery || haystack.includes(normalizedQuery);
  });
  const selectedUsers = selectedIds.map((id) => directory.find((user) => user.id === id)).filter(Boolean);
  const toggle = (user) => {
    const disabled = participantIds.has(user.id) || participantNames.has(user.name);
    if (disabled) return;
    setSelectedIds((items) => items.includes(user.id) ? items.filter((id) => id !== user.id) : [...items, user.id]);
  };
  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  return <Modal title="Adicionar pessoas" className="add-participants-modal-shell" onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={!selectedUsers.length} onClick={() => onConfirm(selectedUsers)}>Adicionar {selectedUsers.length ? `(${selectedUsers.length})` : ""}</button></>}>
    <div className="add-participants-modal">
      <label className="list-search add-participants-search"><Search size={17}/><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome, departamento ou cargo" /></label>
      <div className="add-participants-list" role="listbox" aria-label="Usuarios disponiveis" aria-multiselectable="true">
        {rows.map((user) => {
          const alreadyInGroup = participantIds.has(user.id) || participantNames.has(user.name);
          const checked = selectedIds.includes(user.id);
          const detail = [user.jobTitle || user.role || "Colaborador", user.department || user.dept].filter(Boolean).join(" - ");
          return <button type="button" key={user.id || user.name} className={`add-participant-row ${checked ? "selected" : ""} ${alreadyInGroup ? "disabled" : ""}`} disabled={alreadyInGroup} role="option" aria-selected={checked} onClick={() => toggle(user)}>
            <Avatar initials={user.initials || "CP"} size="sm" src={user.photoUrl} alt={user.name}/>
            <span><strong>{user.name}</strong><small>{detail}</small></span>
            <em>{alreadyInGroup ? "Ja participa" : checked ? "Selecionado" : "Adicionar"}</em>
          </button>;
        })}
        {!rows.length && <p className="empty-list-message">Nenhum usuario encontrado.</p>}
      </div>
    </div>
  </Modal>;
}


function ParticipantsModal({ conversation, directory = [], currentUser, onAction, onClose }) {
  const [openMenu, setOpenMenu] = useState(null);
  const participantUsers = conversation.participants.map((name) => (
    conversation.participantUsers?.find((item) => item.name === name)
    || directory.find((item) => item.name === name)
    || { name, initials: name.split(" " ).map((item) => item[0]).slice(0, 2).join("").toUpperCase(), groupRole: "participant" }
  ));
  const createdAt = conversation.createdAt ? new Date(conversation.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "";
  const viewerRole = conversation.currentUserGroupRole || conversation.memberRoles?.[currentUser?.id] || "participant";
  const canManage = ["owner", "admin"].includes(viewerRole);
  const roleFor = (user) => user.groupRole || conversation.memberRoles?.[user.id] || (user.id === conversation.ownerId || user.name === conversation.owner ? "owner" : conversation.adminIds?.includes(user.id) ? "admin" : "participant");
  const roleText = (role) => role === "owner" ? "Proprietário" : role === "admin" ? "Administrador" : "Participante";
  const actionsFor = (user) => {
    const role = roleFor(user);
    if (!canManage || user.id === currentUser?.id || role === "owner") return [];
    if (role === "participant") return [["promote", "Tornar administrador"], ["remove", "Remover do grupo"]];
    if (role === "admin") return [["demote", "Remover como administrador"]];
    return [];
  };
  const runAction = (user, action) => {
    setOpenMenu(null);
    if (action === "profile") return;
    onAction?.(user, action);
  };
  useEffect(() => {
    const close = () => setOpenMenu(null);
    const keyClose = (event) => {
      if (event.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", keyClose);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", keyClose);
    };
  }, []);
  return <Modal title="Participantes do grupo" className="participants-modal-shell" onClose={onClose} footer={<button className="primary-button" onClick={onClose}>Fechar</button>}>
    <div className="participants-modal">
      <div className="participants-modal-summary">
        <Avatar initials={conversation.initials} color={conversation.color} src={conversation.photoUrl} alt={conversation.name} />
        <div>
          <strong>{conversation.name}</strong>
          <span>{conversation.type === "group" ? "Grupo interno" : "Conversa individual"}</span>
          <small>{conversation.participants.length} participantes{createdAt ? ` - Criado em ${createdAt}` : ""}</small>
        </div>
      </div>
      <div className="participants-modal-list" role="list" aria-label="Participantes do grupo">
        {participantUsers.map((user, index) => {
          const role = roleFor(user);
          const detail = outOfOfficeLabel(user.outOfOffice) || [user.jobTitle || user.role || "Colaborador", user.department || user.dept].filter(Boolean).join(" - " );
          const actions = actionsFor(user);
          const menuId = `participant-menu-${user.id || index}`;
          const menuKey = user.id || user.name;
          const isOpen = openMenu === menuKey;
          const openUp = participantUsers.length > 5 && index >= participantUsers.length - 3;
          return <div className="participant-modal-row" key={user.id || user.name} role="listitem">
            <div className="participant-card-head">
              <Avatar initials={user.initials || "CP"} size="sm" src={user.photoUrl} alt={user.name}/>
              <span className="participant-main">
                <strong title={user.name}>{user.name}</strong>
                <small title={detail}>{detail}</small>
              </span>
              <div className="participant-menu-wrap" onClick={(event) => event.stopPropagation()}>
                <button type="button" className="icon-button participant-menu-button" aria-label={`Ações de ${user.name}`} aria-haspopup="menu" aria-expanded={isOpen} aria-controls={menuId} onClick={() => setOpenMenu(isOpen ? null : menuKey)}><span aria-hidden="true" className="participant-menu-dots">⋮</span></button>
                {isOpen && <div id={menuId} className={`participant-menu ${openUp ? "participant-menu-up" : ""}`} role="menu">
                  <button type="button" role="menuitem" onClick={() => runAction(user, "profile")}>Ver perfil</button>
                  {actions.map(([action, label]) => <button type="button" role="menuitem" key={action} className={action === "remove" ? "danger-option" : ""} onClick={() => runAction(user, action)}>{label}</button>)}
                </div>}
              </div>
            </div>
            <span className={`participant-role-badge participant-role-${role}`}>{roleText(role)}</span>
          </div>;
        })}
      </div>
    </div>
  </Modal>;
}

function NewConversationModal({ collaborators = [], currentUser, onClose, onConfirm }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = normalizeSearchText(query).trim();
  const visibleCollaborators = collaborators
    .filter((user) => user?.id && user.id !== currentUser?.id)
    .filter((user) => normalizeSearchText(user.username) !== "administrador")
    .filter((user) => {
      const accessStatus = normalizeSearchText(user.accessStatus || user.status || "ativo");
      const authProvider = normalizeSearchText(user.authProvider || "ad");
      return accessStatus !== "inativo" && accessStatus !== "inactive" && authProvider !== "local";
    })
    .filter((user) => {
      const haystack = [
        user.name,
        user.displayName,
        user.username,
        user.email,
        user.jobTitle,
        user.role,
        user.department,
        user.dept,
        user.extension,
        user.ramal,
        user.mobile,
      ].filter(Boolean).join(" ");
      return !normalizedQuery || normalizeSearchText(haystack).includes(normalizedQuery);
    });
  const selectUser = (user) => onConfirm(user);
  return <Modal title="Nova conversa" className="new-conversation-shell" onClose={onClose} footer={<button className="secondary-button" onClick={onClose}>Cancelar</button>}>
    <div className="new-conversation-modal">
      <label className="modal-field new-conversation-search"><span>Buscar colaborador</span><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setQuery(""); if (event.key === "Enter" && visibleCollaborators[0]) selectUser(visibleCollaborators[0]); }} placeholder="Nome, usuário AD, e-mail, cargo, departamento ou ramal" autoFocus /></label>
      <div className="table-scroll new-conversation-scroll">
        <table className="users-directory-table new-conversation-table">
          <thead><tr><th>Usuário</th><th>Cargo</th><th>Departamento</th><th>Ramal / e-mail</th><th>Status</th><th>Conversa</th></tr></thead>
          <tbody>{visibleCollaborators.map((user) => <tr key={user.id}>
            <td><div className="table-person collaborator-person"><Avatar initials={user.initials} size="md" src={user.photoUrl || user.avatarUrl} alt={user.name || user.displayName}/><span><strong>{user.displayName || user.name}</strong><small>{outOfOfficeLabel(user.outOfOffice) || user.username || user.email || "Usuário AD"}</small></span></div></td>
            <td>{user.jobTitle || user.role || "Usuário"}</td>
            <td>{user.dept || user.department || "Sem departamento"}</td>
            <td>{user.extension || user.ramal ? `Ramal ${user.extension || user.ramal}` : user.email || "-"}</td>
            <td>{user.outOfOffice?.active ? <Status>Fora da empresa</Status> : <PresenceIndicator user={user} showLabel />}</td>
            <td><button className="secondary-button compact-action" onClick={() => selectUser(user)}><MessageCircle size={15}/> Conversar</button></td>
          </tr>)}</tbody>
        </table>
      </div>
      {!visibleCollaborators.length && <div className="empty-result">Nenhum colaborador ativo encontrado.</div>}
    </div>
  </Modal>;
}


function GroupModal({ currentUser, collaborators = [], onClose, onConfirm }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const candidates = collaborators
    .filter((user) => user.id !== currentUser.id)
    .filter((user) => `${user.name} ${user.username || ""} ${user.email || ""} ${user.department || user.dept || ""}`.toLowerCase().includes(search.toLowerCase()));
  const toggle = (id) => setSelected((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  return <Modal title="Novo grupo interno" onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={!title.trim() || selected.length < 1} onClick={() => onConfirm({ title: title.trim(), description: description.trim(), participantIds: selected })}>Criar grupo</button></>}>
    <div className="modal-grid">
      <label className="modal-field"><span>Nome do grupo</span><input value={title} onChange={(event) => setTitle(event.target.value)} autoFocus /></label>
      <label className="modal-field"><span>Descricao opcional</span><input value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      <label className="modal-field full"><span>Pesquisar participantes</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, e-mail ou departamento" /></label>
    </div>
    <div className="participant-picker group-picker">{candidates.map((user) => <label key={user.id} className={selected.includes(user.id) ? "selected" : ""}><input type="checkbox" checked={selected.includes(user.id)} onChange={() => toggle(user.id)} /><Avatar initials={user.initials} size="xs" src={user.photoUrl} alt={user.name}/><span><strong>{user.name} <PresenceIndicator user={user} /></strong><small>{user.role} - {user.department || user.dept}</small></span></label>)}</div>
    <p className="transfer-note">O criador entra automaticamente e sera o administrador inicial do grupo.</p>
  </Modal>;
}

function ForwardModal({ conversations = [], message, onClose, onConfirm }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [comment, setComment] = useState("");
  const rows = conversations.filter((conversation) => `${conversation.name} ${conversation.participants?.join(" ")}`.toLowerCase().includes(search.toLowerCase()));
  const toggle = (id) => setSelected((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  return <Modal title="Encaminhar mensagem" onClose={onClose} footer={<><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="button" className="primary-button" data-testid="forward-confirm" disabled={!selected.length} onClick={() => onConfirm({ destinationIds: selected, comment: comment.trim() })}>Encaminhar</button></>}>
    <div className="forward-source"><ArrowLeftRight size={16}/><span>{message?.type === "album" ? albumLabel(message.albumFiles || []) : message?.text || "Mensagem de audio"}</span></div>
    <label className="modal-field"><span>Buscar conversa ou grupo</span><input value={search} onChange={(event) => setSearch(event.target.value)} /></label>
    <div className="participant-picker group-picker" data-testid="forward-modal">{rows.map((conversation) => <label key={conversation.id} className={selected.includes(conversation.id) ? "selected" : ""}><input type="checkbox" checked={selected.includes(conversation.id)} onChange={() => toggle(conversation.id)} /><Avatar initials={conversation.initials} size="xs" src={conversation.photoUrl} alt={conversation.name}/><span><strong>{conversation.name}</strong><small>{conversation.type === "group" ? "Grupo" : "Conversa"} - {conversation.participants?.length || 0} participantes</small></span></label>)}{!rows.length && <p>Nenhuma conversa disponivel para encaminhar.</p>}</div>
    <label className="modal-field full"><span>Comentario opcional</span><textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Se vazio, encaminha o texto original." /></label>
  </Modal>;
}

function TextModal({ title, label, initialValue = "", onClose, onConfirm }) {
  const [value, setValue] = useState(initialValue);
  return <Modal title={title} onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={!value.trim()} onClick={() => onConfirm(value.trim())}>Salvar</button></>}><label className="modal-field"><span>{label}</span><input value={value} onChange={(event) => setValue(event.target.value)} autoFocus /></label></Modal>;
}

function AttachmentIcon({ category }) {
  if (category === "image") return <Image size={18} />;
  if (category === "video") return <Video size={18} />;
  if (category === "audio") return <Mic size={18} />;
  if (category === "archive") return <Archive size={18} />;
  return <FileText size={18} />;
}

function EmojiPickerPanel({ pickerRef, recentEmojis = [], onSelect, onClose }) {
  const [activeCategory, setActiveCategory] = useState(recentEmojis.length ? "recent" : "faces");
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const categoryRows = EMOJI_CATEGORIES.filter((category) => category.id !== "recent" || recentEmojis.length);
  const searchRows = normalizedQuery
    ? ALL_EMOJIS.filter(({ emoji, category }) => `${emoji} ${category.label} ${category.keywords}`.toLowerCase().includes(normalizedQuery))
    : [];
  const activeRows = normalizedQuery
    ? [{ id: "search", label: `Resultados para "${query}"`, emojis: searchRows.map((item) => item.emoji) }]
    : activeCategory === "recent"
      ? [{ id: "recent", label: "Recentes", emojis: recentEmojis }]
      : EMOJI_CATEGORIES.filter((category) => category.id === activeCategory);
  const rows = activeRows.filter((row) => row.emojis?.length);
  return <div className="emoji-picker" ref={pickerRef} role="dialog" aria-label="Selecionar emoji">
    <div className="emoji-picker-header">
      <label><Search size={14}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar emoji..." autoFocus /></label>
      <button type="button" className="icon-button" aria-label="Fechar emojis" onClick={onClose}><X size={16}/></button>
    </div>
    <div className="emoji-category-tabs" role="tablist">
      {categoryRows.map((category) => <button type="button" key={category.id} className={activeCategory === category.id && !normalizedQuery ? "active" : ""} title={category.label} onClick={() => { setQuery(""); setActiveCategory(category.id); }}>{category.icon}</button>)}
    </div>
    <div className="emoji-picker-grid">
      {rows.map((row) => <section key={row.id}>
        <h4>{row.label}</h4>
        <div>{row.emojis.map((emoji, index) => <button type="button" key={`${emoji}-${index}`} onClick={() => onSelect(emoji)} title={emoji}>{emoji}</button>)}</div>
      </section>)}
      {!rows.length && <p className="emoji-empty">Nenhum emoji encontrado.</p>}
    </div>
  </div>;
}

function AttachmentModal({ drafts, activeIndex, sending, totalProgress, progressLabel, message, onMessageChange, onActiveChange, onRemove, onAddMore, onCancel, onSend, onDrop }) {
  const [dragging, setDragging] = useState(false);
  const active = drafts[activeIndex] || drafts[0];
  const totalSize = drafts.reduce((sum, draft) => sum + draft.file.size, 0);
  const canSend = drafts.some((draft) => draft.status !== "sent" && draft.status !== "sending");
  useEffect(() => {
    document.body.classList.add("attachment-modal-open");
    document.documentElement.classList.add("attachment-modal-open");
    return () => {
      document.body.classList.remove("attachment-modal-open");
      document.documentElement.classList.remove("attachment-modal-open");
    };
  }, []);
  const preview = () => {
    if (!active) return null;
    const url = active.previewUrl;
    if (active.category === "image" && url) return <img src={url} alt={active.file.name} />;
    if (active.category === "video" && url) return <video src={url} controls preload="metadata" />;
    if (active.category === "audio" && url) return <div className="attachment-modal-audio"><Mic size={24}/><audio src={url} controls preload="metadata" /></div>;
    return <div className="attachment-modal-file"><AttachmentIcon category={active.category} /><strong>{active.file.name}</strong><span>{formatFileSize(active.file.size)}{active.file.type ? ` - ${active.file.type}` : ""}</span></div>;
  };
  const move = (delta) => onActiveChange(Math.min(Math.max(0, activeIndex + delta), drafts.length - 1));
  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    const files = Array.from(event.dataTransfer?.files || []);
    if (files.length) onDrop(files);
  };
  return <Modal title="Enviar arquivos" className="attachment-modal-shell" onClose={onCancel} footer={<>
    <span className="attachment-footer-count">{drafts.length} arquivo{drafts.length === 1 ? "" : "s"}{sending && progressLabel ? ` - ${progressLabel}` : ""}</span>
    <button className="secondary-button" disabled={sending} onClick={onCancel}>Cancelar</button>
    <button className="primary-button" disabled={sending || !canSend} onClick={onSend}><Send size={15}/> {sending ? "Enviando..." : drafts.length > 1 ? `Enviar ${drafts.length}` : "Enviar"}</button>
  </>}>
    <div className={`attachment-modal ${dragging ? "dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }} onDrop={handleDrop}>
      <div className="attachment-modal-meta">
        <span>{activeIndex + 1} de {drafts.length}</span>
        <span>{formatFileSize(totalSize)} no lote</span>
        <span>{drafts.filter((draft) => draft.category === "image").length} imagem(ns)</span>
      </div>
      <div className="attachment-modal-preview">
        {drafts.length > 1 && <button type="button" className="attachment-nav prev" disabled={activeIndex <= 0 || sending} onClick={() => move(-1)}><ChevronRight size={18}/></button>}
        {preview()}
        {drafts.length > 1 && <button type="button" className="attachment-nav next" disabled={activeIndex >= drafts.length - 1 || sending} onClick={() => move(1)}><ChevronRight size={18}/></button>}
      </div>
      {active?.status === "error" && <p className="field-error">{active.error}</p>}
      <div className="attachment-modal-strip">
        {drafts.map((draft, index) => <button type="button" key={draft.id} className={`attachment-thumb ${index === activeIndex ? "active" : ""} status-${draft.status}`} onClick={() => onActiveChange(index)}>
          {draft.category === "image" && draft.previewUrl ? <img src={draft.previewUrl} alt="" /> : <AttachmentIcon category={draft.category} />}
          <span>{draft.file.name}</span>
          <small>{draft.status === "sending" ? `${draft.progress || 0}%` : draft.status === "sent" ? "Enviado" : draft.status === "error" ? "Erro" : "Aguardando"}</small>
          <i style={{ width: `${draft.progress || 0}%` }} />
          <span className="attachment-remove" tabIndex={0} aria-label={`Remover ${draft.file.name}`} onClick={(event) => { event.stopPropagation(); if (!sending) onRemove(draft.id); }} onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && !sending) { event.preventDefault(); event.stopPropagation(); onRemove(draft.id); } }}>×</span>
        </button>)}
        <button type="button" className="attachment-thumb add" disabled={sending || drafts.length >= MAX_ATTACHMENT_BATCH_FILES} onClick={onAddMore}><Plus size={19}/><span>Adicionar</span></button>
      </div>
      <textarea className="attachment-modal-message" value={message || ""} disabled={sending} maxLength={2000} onChange={(event) => onMessageChange(event.target.value.slice(0, 2000))} placeholder="Mensagem" aria-label="Mensagem do anexo" />
      {sending && <div className="upload-progress attachment-modal-progress"><i style={{ width: `${Math.max(totalProgress, 4)}%` }} /><span>{Math.max(totalProgress, 0)}%</span></div>}
    </div>
  </Modal>;
}

function FileAttachment({ file, searchQuery = "" }) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const category = fileCategory(file);
  const url = mediaUrl(file.url);
  const name = file.originalName || file.name || "Arquivo";
  const uploadStatus = file.uploadStatus || "";
  const uploadProgress = Math.max(0, Math.min(100, Number(file.uploadProgress || 0)));
  return <div className={`file-attachment file-attachment-${category}`}>
    {category === "image" && url ? <button type="button" className="file-image-preview" onClick={() => setViewerOpen(true)}><img src={url} alt={name} /></button>
      : category === "video" && url ? <video controls preload="metadata" src={url} />
      : category === "audio" && url ? <audio controls preload="metadata" src={url} />
      : <div className="file-attachment-icon"><AttachmentIcon category={category} /></div>}
    <div><strong><HighlightedText text={name} query={searchQuery} /></strong><span>{formatFileSize(file.size)}{file.extension ? ` - ${file.extension.toUpperCase()}` : ""}</span>{uploadStatus && <small className={`attachment-upload-status attachment-upload-${uploadStatus}`}><i style={{ width: `${uploadStatus === "sent" ? 100 : uploadProgress}%` }} />{uploadStatus === "failed" ? "Falha no envio" : uploadStatus === "sent" ? "Enviado" : `Enviando... ${uploadProgress || 1}%`}</small>}</div>
    {url && <a className="file-download" href={url} target="_blank" rel="noreferrer" download={name}><Download size={15}/> Baixar</a>}
    {category === "image" && url && viewerOpen && <div className="album-viewer single" role="dialog" aria-modal="true" aria-label="Visualizar imagem">
      <button type="button" className="album-viewer-close" onClick={() => setViewerOpen(false)}><X size={20}/></button>
      <figure>
        <img src={url} alt={name} />
        <figcaption><strong>{name}</strong><a href={url} target="_blank" rel="noreferrer" download={name}><Download size={15}/> Baixar</a></figcaption>
      </figure>
    </div>}
  </div>;
}

function AlbumAttachment({ files = [], caption = "" }) {
  const [viewerIndex, setViewerIndex] = useState(null);
  const images = files.filter((message) => isImageAttachment(message.file));
  const documents = files.filter((message) => !isImageAttachment(message.file));
  const visibleImages = images.slice(0, 4);
  const currentImage = viewerIndex === null ? null : images[viewerIndex];
  const move = (delta) => setViewerIndex((index) => {
    if (index === null || !images.length) return null;
    return (index + delta + images.length) % images.length;
  });
  return <div className="album-attachment">
    {images.length > 0 && <div className={`album-grid album-grid-${Math.min(visibleImages.length, 4)}`}>
      {visibleImages.map((message, index) => {
        const hidden = index === visibleImages.length - 1 ? images.length - visibleImages.length : 0;
        const name = message.file?.originalName || message.file?.name || `Imagem ${index + 1}`;
        return <button type="button" key={message.id || `${message.albumId}-${index}`} className="album-tile" onClick={() => setViewerIndex(index)} aria-label={`Abrir ${name}`}>
          <img src={mediaUrl(message.file?.url)} alt={name} />
          {hidden > 0 && <span>+{hidden}</span>}
        </button>;
      })}
    </div>}
    {documents.length > 0 && <div className="album-documents">
      {documents.map((message) => <FileAttachment key={message.id || message.file?.id} file={message.file} />)}
    </div>}
    {caption && <div className="attachment-caption">{caption.split("\n").map((line, i) => <span key={i}>{line || <br />}</span>)}</div>}
    {currentImage && <div className="album-viewer" role="dialog" aria-modal="true" aria-label="Visualizar álbum">
      <button type="button" className="album-viewer-close" onClick={() => setViewerIndex(null)}><X size={20}/></button>
      {images.length > 1 && <button type="button" className="album-viewer-nav prev" onClick={() => move(-1)}><ChevronRight size={24}/></button>}
      <figure>
        <img src={mediaUrl(currentImage.file?.url)} alt={currentImage.file?.originalName || currentImage.file?.name || ""} />
        <figcaption>
          <strong>{viewerIndex + 1} de {images.length} - {currentImage.file?.originalName || currentImage.file?.name || "Imagem"}</strong>
          {(currentImage.itemCaption || currentImage.text) && <span>{currentImage.itemCaption || currentImage.text}</span>}
          <a href={mediaUrl(currentImage.file?.url)} target="_blank" rel="noreferrer" download={currentImage.file?.originalName || currentImage.file?.name}><Download size={15}/> Baixar</a>
        </figcaption>
      </figure>
      {images.length > 1 && <button type="button" className="album-viewer-nav next" onClick={() => move(1)}><ChevronRight size={24}/></button>}
    </div>}
  </div>;
}

function MessageBubble({ id, side, sender, senderId, role, text, time, status, errors = [], type = "message", audio, file, albumFiles = [], replyTo, forwardedFrom, reactions = [], readDetails = null, editedAt = null, searchQuery = "", searchMatched = false, searchActive = false, located = false, showSender = true, currentUserId, onReply, onForward, onReact, onEdit, onJump, onRetry }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [reactionOpen, setReactionOpen] = useState(false);
  const [portalStyle, setPortalStyle] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const portalRef = useRef(null);
  const longPressRef = useRef(null);
  const effectiveStatus = status || (side === "out" ? "sent" : "received");
  const isOwnMessage = senderId && currentUserId ? senderId === currentUserId : side === "out";
  const delivery = {
    received: { label: "Recebido", icon: "•" },
    sent: { label: "Enviado", icon: "✓" },
    delivered: { label: "Entregue", icon: "✓✓" },
    read: { label: "Lido", icon: "✓✓" },
    failed: { label: "Falhou", icon: "!" },
    sending: { label: "Enviando", icon: "..." },
    skipped: { label: "Somente local", icon: "?" },
  }[effectiveStatus] || { label: effectiveStatus, icon: "?" };
  const errorCode = Number(errors?.[0]?.code);
  const errorText = errorCode === 131030
    ? "Numero nao autorizado na lista de teste da Meta."
    : errorCode === 130497
      ? "A conta empresarial esta restrita para enviar mensagens a usuarios deste pais."
      : errors?.[0]?.details || errors?.[0]?.error_data?.details || errors?.[0]?.message || "";
  const readTooltip = (() => {
    if (!readDetails || side !== "out") return errorText || delivery.label;
    const readers = Array.isArray(readDetails.readers) ? readDetails.readers : [];
    const pending = Array.isArray(readDetails.pending) ? readDetails.pending : [];
    const readLines = readers.length
      ? readers.slice(0, 8).map((reader) => `Lida por ${reader.name} em ${reader.readAt ? new Date(reader.readAt).toLocaleString("pt-BR") : "-"}`)
      : ["Ainda não lida"];
    const pendingLines = pending.length ? [`Ainda não leu: ${pending.slice(0, 8).map((user) => user.name).join(", ")}`] : [];
    return [...readLines, ...pendingLines].join("\n");
  })();
  const attachmentCaption = type === "file" ? String(text || "").trim() : "";
  const attachmentNames = type === "file" ? [file?.name, file?.originalName].filter(Boolean).map((value) => String(value).trim()) : [];
  const showAttachmentCaption = Boolean(attachmentCaption) && !attachmentNames.includes(attachmentCaption);
  const availableActions = Boolean(onReply || onForward || onReact || onEdit);
  const reactionGroups = Object.values((Array.isArray(reactions) ? reactions : []).reduce((groups, reaction) => {
    const emoji = String(reaction?.emoji || "").trim();
    if (!emoji) return groups;
    groups[emoji] ||= { emoji, count: 0, names: [], active: false };
    groups[emoji].count += 1;
    groups[emoji].names.push(reaction.userName || reaction.sender || "Usuário");
    if (reaction.userId === currentUserId) groups[emoji].active = true;
    return groups;
  }, {}));
  const closeActions = () => {
    setMenuOpen(false);
    setReactionOpen(false);
  };
  const calculatePortalPosition = (kind = "menu") => {
    const trigger = triggerRef.current;
    if (!trigger) return { top: 0, left: 0 };
    const rect = trigger.getBoundingClientRect();
    const viewport = window.visualViewport || { width: window.innerWidth, height: window.innerHeight, offsetLeft: 0, offsetTop: 0 };
    const viewportLeft = viewport.offsetLeft || 0;
    const viewportTop = viewport.offsetTop || 0;
    const viewportWidth = viewport.width || window.innerWidth;
    const viewportHeight = viewport.height || window.innerHeight;
    const height = kind === "reaction" ? 48 : (onEdit ? 146 : 112);
    const margin = 8;
    const width = Math.min(kind === "reaction" ? 238 : 176, viewportWidth - margin * 2);
    const rightSpace = viewportLeft + viewportWidth - rect.right - margin;
    const leftSpace = rect.left - viewportLeft - margin;
    let left;
    if (rightSpace >= width || rightSpace >= leftSpace) left = rect.right + margin;
    else left = rect.left - width - margin;
    left = Math.max(viewportLeft + margin, Math.min(left, viewportLeft + viewportWidth - width - margin));
    let top = rect.top + rect.height / 2 - 18;
    if (top + height > viewportTop + viewportHeight - margin) top = viewportTop + viewportHeight - height - margin;
    top = Math.max(viewportTop + margin, top);
    return { top: Math.round(top), left: Math.round(left), minWidth: width };
  };
  const openMenu = () => {
    setReactionOpen(false);
    if (menuOpen) return setMenuOpen(false);
    setPortalStyle(calculatePortalPosition("menu"));
    setMenuOpen(true);
  };
  const openReactions = () => {
    setMenuOpen(false);
    setPortalStyle(calculatePortalPosition("reaction"));
    setReactionOpen(true);
  };
  useEffect(() => {
    if (!menuOpen && !reactionOpen) return undefined;
    const closeOutside = (event) => {
      if (triggerRef.current?.contains(event.target) || portalRef.current?.contains(event.target)) return;
      closeActions();
    };
    const closeOnEsc = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation?.();
      closeActions();
    };
    const closeOnLayoutChange = () => closeActions();
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("touchstart", closeOutside);
    document.addEventListener("keydown", closeOnEsc);
    document.addEventListener("scroll", closeOnLayoutChange, true);
    window.addEventListener("resize", closeOnLayoutChange);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("touchstart", closeOutside);
      document.removeEventListener("keydown", closeOnEsc);
      document.removeEventListener("scroll", closeOnLayoutChange, true);
      window.removeEventListener("resize", closeOnLayoutChange);
    };
  }, [menuOpen, reactionOpen]);
  useEffect(() => closeActions, [id]);
  const chooseAction = (action) => {
    closeActions();
    action?.();
  };
  const startLongPress = () => {
    if (!availableActions) return;
    window.clearTimeout(longPressRef.current);
    longPressRef.current = window.setTimeout(() => {
      setPortalStyle(calculatePortalPosition("menu"));
      setMenuOpen(true);
    }, 460);
  };
  const cancelLongPress = () => window.clearTimeout(longPressRef.current);
  useEffect(() => () => window.clearTimeout(longPressRef.current), []);
  const actionPortal = menuOpen ? createPortal(
    <div className={`message-actions-popover message-actions-portal ${isOwnMessage ? "own" : "received"}`} ref={portalRef} role="menu" style={portalStyle}>
      {onReply && <button type="button" role="menuitem" data-testid="message-action-reply" onClick={() => chooseAction(onReply)}>Responder</button>}
      {onForward && <button type="button" role="menuitem" data-testid="message-action-forward" onClick={() => chooseAction(onForward)}>Encaminhar</button>}
      {onReact && <button type="button" role="menuitem" onClick={openReactions}>Reagir</button>}
      {onEdit && <button type="button" role="menuitem" data-testid="message-action-edit" onClick={() => chooseAction(onEdit)}>Editar mensagem</button>}
    </div>, document.body
  ) : reactionOpen ? createPortal(
    <div className={`message-reaction-picker message-actions-portal ${isOwnMessage ? "own" : "received"}`} ref={portalRef} role="menu" aria-label="Reagir à mensagem" style={portalStyle}>
      {MESSAGE_REACTIONS.map((emoji) => <button key={emoji} type="button" role="menuitem" className={reactions.some((reaction) => reaction.userId === currentUserId && reaction.emoji === emoji) ? "active" : ""} onClick={() => chooseAction(() => onReact?.(emoji))}>{emoji}</button>)}
    </div>, document.body
  ) : null;
  return <div className={`message-row ${side} message-status-${effectiveStatus} ${searchMatched ? "search-matched" : ""} ${searchActive ? "search-active" : ""} ${located ? "message-located" : ""}`} data-message-id={id || ""}>
    {showSender && <div className="message-sender">{sender}{role ? ` - ${role}` : ""}</div>}
    <div className={`message-bubble message-bubble-${type}`} onTouchStart={startLongPress} onTouchEnd={cancelLongPress} onTouchMove={cancelLongPress} onTouchCancel={cancelLongPress}>
      {availableActions && <div className="message-actions-menu">
        <button ref={triggerRef} type="button" className="message-actions-trigger" aria-label="Ações da mensagem" title="Ações da mensagem" aria-expanded={menuOpen || reactionOpen} onClick={openMenu}><ChevronDown size={16} strokeWidth={2.4} /></button>
        {actionPortal}
      </div>}
      {forwardedFrom && <div className="forwarded-label"><ArrowLeftRight size={13}/> Encaminhada</div>}
      {replyTo && <button type="button" className="reply-reference" onClick={() => onJump?.(replyTo.id)}><strong>{replyTo.unavailable ? "Mensagem indisponivel" : `Respondendo a ${replyTo.sender}`}</strong><span><HighlightedText text={replyTo.text} query={searchQuery} /></span></button>}
      {type === "album" ? <AlbumAttachment files={albumFiles} caption={text} />
        : type === "audio" && audio?.url ? <div className="audio-message"><Mic size={16}/><audio controls preload="metadata" src={mediaUrl(audio.url)} /><small>{audio.durationSeconds ? `${audio.durationSeconds}s` : "Audio gravado"}</small></div>
        : type === "file" && file ? <><FileAttachment file={file} searchQuery={searchQuery} />{showAttachmentCaption && <div className="attachment-caption">{attachmentCaption.split("\n").map((line, i) => <span key={i}><HighlightedText text={line} query={searchQuery} /></span>)}</div>}</>
        : String(text || "").split("\n").map((line, i) => <span key={i}><HighlightedText text={line} query={searchQuery} /></span>)}
      {editedAt && <small className="message-edited-label">(Editada às {new Date(editedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })})</small>}
      {reactionGroups.length > 0 && <div className="message-reactions">
        {reactionGroups.map((group) => <button key={group.emoji} type="button" className={group.active ? "active" : ""} title={group.names.join(", ")} onClick={() => onReact?.(group.emoji)}>{group.emoji}<span>{group.count}</span></button>)}
      </div>}
      <time>{time}<b className="delivery-state" title={readTooltip}>{delivery.icon} {delivery.label}</b></time>
    </div>
    {effectiveStatus === "failed" && <small className="delivery-error">{errorText || "A mensagem ficou registrada localmente, mas nao foi entregue."}{onRetry && <button type="button" onClick={onRetry}>Tentar novamente</button>}</small>}
  </div>;
}
function ContactPanel({ contact, onToast, onEdit, onShortcut }) {
  const [shortcutSearch, setShortcutSearch] = useState("");
  const [shortcutRows, setShortcutRows] = useState([]);
  useEffect(() => {
    apiRequest("/api/quick-replies")
      .then((rows) => setShortcutRows(rows.filter((item) => item.status === "Ativo")))
      .catch((error) => onToast(error.message));
  }, []);
  const shortcuts = shortcutRows.filter((item) => `${item.shortcut} ${item.description} ${item.content}`.toLowerCase().includes(shortcutSearch.toLowerCase()));
  const selectShortcut = async (item) => {
    onShortcut(item.content);
    apiRequest(`/api/quick-replies/${item.id}/use`, { method: "POST", body: "{}" }).catch(() => {});
  };
  return (
    <aside className="contact-panel">
      <section>
        <div className="contact-panel-title"><h3>Informações do contato</h3><MoreHorizontal size={19} /></div>
        <div className="contact-profile"><Avatar initials={contact.initials} size="lg" color={contact.color} src={contact.photoUrl} alt={contact.name}/><div><h2>{contact.name}</h2><span>{contact.phone}</span></div><button className="icon-button" aria-label="Editar contato" onClick={onEdit}><Pencil size={16} /></button></div>
        <dl><dt>Protocolo</dt><dd>{contact.protocol || "Em criação"}</dd><dt>{contact.customerData?.documentType || "Documento"}</dt><dd>{contact.customerData?.document || "Não informado"}</dd><dt>Empresa</dt><dd>{contact.customerData?.company || "Pessoa Física"}</dd><dt>Motivo do contato</dt><dd>{contact.customerData?.reason || contact.preview}</dd></dl>
        <div className="automatic-answers"><strong>Respostas da triagem</strong>{(contact.formAnswers || []).map((item, index) => <div key={index}><span>{item.question}</span><p>{item.answer}</p></div>)}</div>
        <div className="observation"><span>Observações</span><p>Cliente demonstrou interesse no curso de gestão empresarial. Retornar com a proposta.</p><Pencil size={14} /></div>
      </section>
      <section>
        <div className="contact-panel-title"><h3>Histórico do atendimento</h3><SlidersHorizontal size={16} /></div>
        <div className="timeline">
          <div><i className="green"><MessageCircle size={14} /></i><span><time>09:48</time><strong>Atendimento iniciado</strong><small>via WhatsApp</small></span></div>
          <div><i className="blue"><Users size={14} /></i><span><time>09:48</time><strong>Alocado para João Silva</strong><small>Departamento: Comercial</small></span></div>
          <div><i className="blue"><Clock3 size={14} /></i><span><time>09:50</time><strong>Status alterado para</strong><small>Em atendimento</small></span></div>
        </div>
      </section>
      <section className="shortcut-section">
        <div className="contact-panel-title"><h3>Atalhos / Respostas rápidas</h3><ChevronDown size={16} /></div>
        <label className="list-search"><Search size={15} /><input value={shortcutSearch} onChange={(event) => setShortcutSearch(event.target.value)} placeholder="Buscar atalhos..." /></label>
        {shortcuts.map((item) => <button key={item.id} onClick={() => selectShortcut(item)}><strong>{item.shortcut}</strong><span>{item.description}</span></button>)}
      </section>
    </aside>
  );
}

const defaultDepartmentConfigs = departments.map((department, index) => ({
  id: `dept-${index + 1}`,
  name: department.name,
  description: `Comunicacao interna do departamento ${department.name}.`,
  color: department.color,
  icon: "Building2",
  status: "Ativo",
  manager: users.find((user) => user.dept === department.name && ["Gestor", "Supervisor", "Administrador"].includes(user.role))?.name || "Não definido",
  members: users.filter((user) => user.dept === department.name).map((user) => user.name),
  schedule: "Segunda a sexta, 08:00 às 18:00",
  welcomeMessages: ["Bem-vindo ao departamento.", "Descreva sua solicitacao interna.", "Informe a prioridade, se necessario."],
  questions: department.name === "RH" ? ["Qual assunto interno deseja tratar?", "Existe prazo para retorno?", "Deseja anexar alguma informacao complementar?"] : ["Descreva com detalhes sua solicitacao interna."],
  waitMessages: [
    { delay: "30 segundos", text: "Recebemos sua mensagem. Aguarde um instante." },
    { delay: "2 minutos", text: "Estamos notificando o departamento." },
    { delay: "A cada 2 minutos", text: "Sua conversa continua registrada." },
  ],
  alertAfter: "Formulário concluído",
  alerts: ["Gestor responsável", "Colaboradores do departamento"],
}));

function DepartmentsPage({ setPage, currentUser }) {
  const [items, setItems] = useState([]);
  const [backendUsers,setBackendUsers]=useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState("Visão geral");
  const [modal, setModal] = useState(false);
  const [toast, setToast] = useState("");
  const load=async()=>{try{const departmentsResult=await apiRequest("/api/departments");setItems(departmentsResult);setSelectedId((value)=>value||departmentsResult[0]?.id);if(["Administrador","Gestor"].includes(currentUser.role)){const usersResult=await apiRequest("/api/users");setBackendUsers(usersResult)}}catch(error){setToast(error.message)}};
  useEffect(()=>{load()},[currentUser?.id]);
  const visibleItems = currentUser.role === "Administrador" ? items : items.filter((item) => item.name === currentUser.dept);
  const selected = visibleItems.find((item) => item.id === selectedId) || visibleItems[0];
  const updateSelected = (changes) => setItems((current) => current.map((item) => item.id === selected.id ? { ...item, ...changes } : item));
  const saveSelected=async()=>{try{const saved=await apiRequest(`/api/departments/${encodeURIComponent(selected.id)}`,{method:"PUT",body:JSON.stringify(selected)});setItems((current)=>current.map((item)=>item.id===saved.id?saved:item));setToast("Configuração do departamento persistida no backend.")}catch(error){setToast(error.message)}};
  const createDepartment=async(department)=>{try{const created=await apiRequest("/api/departments",{method:"POST",body:JSON.stringify(department)});setItems((current)=>[created,...current]);setSelectedId(created.id);setModal(false);setToast("Departamento criado e persistido no backend.")}catch(error){setToast(error.message)}};
  if (!selected) return <div className="empty-result">Nenhum departamento cadastrado.</div>;
  return <div className="department-page">
    <div className="section-toolbar"><div className="title-icon"><Building2/><div><h2>Estrutura de departamentos</h2><p>Configure primeiro o departamento; depois equipe, permissoes e comunicacao interna.</p></div></div>{currentUser.role==="Administrador"&&<button className="primary-button" onClick={() => setModal(true)}><Plus size={17}/> Novo departamento</button>}</div>
    <div className="flow-order"><span className="active">1. Departamento</span><ChevronRight/><button onClick={() => setTab("Equipe")}>2. Equipe</button><ChevronRight/><button onClick={() => setTab("Comunicacao")}>3. Comunicacao</button></div>
    <div className="department-workspace">
      <aside className="panel department-list"><label><Search size={16}/><input placeholder="Buscar departamento"/></label>{visibleItems.map((item) => <button key={item.id} className={selected.id === item.id ? "active" : ""} onClick={() => { setSelectedId(item.id); setTab("Visão geral"); }}><i style={{background:item.color}}/><span><strong>{item.name}</strong><small>{item.members.length} colaboradores</small></span><Status>{item.status}</Status></button>)}</aside>
      <section className="panel department-editor">
        <header><div className="department-identity"><span style={{background:selected.color}}><Building2/></span><div><h2>{selected.name}</h2><p>{selected.description}</p></div></div><Status>{selected.status}</Status></header>
        <nav>{["Visao geral","Configuracoes","Equipe","Comunicacao","Fluxo interno"].map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</nav>
        <div className="department-tab">
          {(tab === "Visao geral" || tab === "Visão geral") && <div className="department-overview"><article><span>Gestor responsavel</span><strong>{selected.manager}</strong></article><article><span>Equipe vinculada</span><strong>{selected.members.length} colaboradores</strong></article><article><span>Horario</span><strong>{selected.schedule}</strong></article><article><span>Perguntas internas</span><strong>{selected.questions.length}</strong></article><div className="flow-preview"><h3>Fluxo interno</h3>{["Boas-vindas do departamento","Identificacao do assunto","Escolha dos participantes","Registro da conversa","Perguntas internas","Alerta da equipe","Acompanhamento interno"].map((step, index) => <div key={step}><b>{index + 1}</b><span>{step}</span></div>)}</div></div>}
          {(tab === "Configuracoes" || tab === "Configurações") && <DepartmentSettings department={selected} onChange={updateSelected} usersList={backendUsers}/>}
          {tab === "Equipe" && <DepartmentTeam department={selected} onChange={updateSelected} onUsers={() => setPage("usuarios")} usersList={backendUsers}/>}
          {tab === "Comunicacao" && <DepartmentWaiting department={selected} onChange={updateSelected}/>}
          {tab === "Fluxo interno" && <DepartmentAutomation department={selected} onChange={updateSelected}/>}
        </div>
        <footer><span>Alteracoes sao aplicadas ao fluxo interno apos salvar.</span><button className="primary-button" onClick={saveSelected}><Save size={16}/> Salvar configuracao</button></footer>
      </section>
    </div>
    {modal && <DepartmentModal onClose={() => setModal(false)} onConfirm={createDepartment}/>}
    {toast && <Toast message={toast} onClose={() => setToast("")}/>}
  </div>;
}

function DepartmentSettings({ department, onChange, usersList=[] }) {
  return <div className="department-form"><label><span>Nome</span><input value={department.name} onChange={(event) => onChange({name:event.target.value})}/></label><label><span>Gestor responsavel</span><select value={department.manager} onChange={(event) => onChange({manager:event.target.value})}><option>Nao definido</option>{usersList.filter((user) => ["Administrador","Gestor"].includes(user.role)).map((user) => <option key={user.name}>{user.name}</option>)}</select></label><label className="full"><span>Descricao</span><textarea value={department.description||""} onChange={(event) => onChange({description:event.target.value})}/></label><label><span>Cor</span><div className="color-field"><input type="color" value={department.color||"#2875ed"} onChange={(event) => onChange({color:event.target.value})}/><code>{department.color}</code></div></label><label><span>Status</span><select value={department.status} onChange={(event) => onChange({status:event.target.value})}><option>Ativo</option><option>Inativo</option></select></label><label className="full"><span>Horario de comunicacao</span><input value={department.schedule||""} onChange={(event) => onChange({schedule:event.target.value})}/></label></div>;
}

function DepartmentTeam({ department, onChange, onUsers, usersList=[] }) {
  const members=department.members||[];const available = usersList.filter((user) => !members.includes(user.name));
  return <div><div className="tab-heading"><div><h3>Equipe vinculada</h3><p>Usuários vinculados recebem comunicados e participam dos grupos do departamento.</p></div><button className="secondary-button" onClick={onUsers}><UserPlus size={16}/> Cadastrar usuário</button></div><div className="team-list">{members.map((name) => { const user=usersList.find((item)=>item.name===name); return <div key={name}><Avatar initials={user?.initials || "CP"} src={user?.photoUrl} alt={name}/><span><strong>{name}</strong><small>{user?.role || "Usuário"}</small></span><button className="icon-button" onClick={() => onChange({members:members.filter((item)=>item!==name)})} title="Desvincular"><X size={16}/></button></div>;})}</div>{available.length>0 && <label className="inline-add"><span>Vincular usuário existente</span><select defaultValue="" onChange={(event) => event.target.value && onChange({members:[...members,event.target.value]})}><option value="">Selecione...</option>{available.map((user)=><option key={user.name}>{user.name}</option>)}</select></label>}</div>;
}

function DepartmentWaiting({ department, onChange }) {
  const messages=department.waitMessages||[];const alerts=department.alerts||[];
  const updateMessage=(index,key,value)=>onChange({waitMessages:messages.map((item,i)=>i===index?{...item,[key]:value}:item)});
  return <div><div className="tab-heading"><div><h3>Avisos automaticos</h3><p>Mensagens internas usadas para orientar colaboradores do departamento.</p></div></div><div className="wait-message-list">{messages.map((item,index)=><div key={index}><label><span>Quando enviar</span><input value={item.delay||`${item.afterSeconds||120} segundos`} onChange={(event)=>updateMessage(index,"delay",event.target.value)}/></label><label><span>Mensagem</span><textarea value={item.text} onChange={(event)=>updateMessage(index,"text",event.target.value)}/></label><button className="icon-button danger-icon" onClick={()=>onChange({waitMessages:messages.filter((_,i)=>i!==index)})}><Trash2 size={16}/></button></div>)}</div><button className="secondary-button" onClick={()=>onChange({waitMessages:[...messages,{delay:"2 minutos",afterSeconds:120,repeatSeconds:null,text:"Novo aviso interno"}]})}><Plus size={16}/> Adicionar aviso</button><div className="alert-config"><label><span>Disparar alertas</span><select value={department.alertAfter||"Solicitacao concluida"} onChange={(event)=>onChange({alertAfter:event.target.value})}><option>Solicitacao concluida</option><option>Nova conversa interna</option><option>Apos 2 minutos sem retorno</option></select></label>{["Gestor responsavel","Colaboradores do departamento"].map((target)=><label className="check-row" key={target}><input type="checkbox" checked={alerts.includes(target)} onChange={()=>onChange({alerts:alerts.includes(target)?alerts.filter((item)=>item!==target):[...alerts,target]})}/>{target}</label>)}</div></div>;
}

function DepartmentAutomation({ department, onChange }) {
  const updateQuestion=(index,value)=>onChange({questions:department.questions.map((item,i)=>i===index?value:item)});
  return <div><div className="automation-block"><h3>Boas-vindas internas</h3><p>Mensagens padrao usadas em fluxos internos do departamento.</p>{department.welcomeMessages.map((message,index)=><div className="automation-step" key={index}><b>{index+1}</b><textarea value={message} onChange={(event)=>onChange({welcomeMessages:department.welcomeMessages.map((item,i)=>i===index?event.target.value:item)})}/></div>)}</div><div className="automation-block"><h3>Perguntas internas de {department.name}</h3><p>As respostas ficam registradas no historico da conversa interna.</p>{department.questions.map((question,index)=><div className="automation-step" key={index}><b>{index+1}</b><input value={question} onChange={(event)=>updateQuestion(index,event.target.value)}/><button className="icon-button danger-icon" onClick={()=>onChange({questions:department.questions.filter((_,i)=>i!==index)})}><Trash2 size={15}/></button></div>)}<button className="secondary-button" onClick={()=>onChange({questions:[...department.questions,"Nova pergunta"]})}><Plus size={16}/> Adicionar pergunta</button></div></div>;
}

function DepartmentModal({ onClose, onConfirm }) {
  const [form,setForm]=useState({name:"",description:"",color:"#2875ed",status:"Ativo"});
  return <Modal title="Novo departamento" onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={!form.name.trim()} onClick={()=>onConfirm({...form,id:`dept-${Date.now()}`,icon:"Building2",manager:"Nao definido",members:[],schedule:"Segunda a sexta, 08:00 as 18:00",welcomeMessages:["Bem-vindo ao departamento.","Descreva sua solicitacao interna.","Informe a prioridade, se necessario."],questions:["Descreva com detalhes sua solicitacao interna."],waitMessages:[{delay:"30 segundos",text:"Recebemos sua mensagem. Aguarde um instante."},{delay:"2 minutos",text:"Estamos notificando o departamento."},{delay:"A cada 2 minutos",text:"Sua conversa continua registrada."}],alertAfter:"Solicitacao concluida",alerts:["Gestor responsavel","Colaboradores do departamento"]})}>Criar departamento</button></>}><div className="modal-grid"><label className="modal-field"><span>Nome</span><input value={form.name} onChange={(event)=>setForm({...form,name:event.target.value})}/></label><label className="modal-field"><span>Cor</span><input type="color" value={form.color} onChange={(event)=>setForm({...form,color:event.target.value})}/></label><label className="modal-field full"><span>Descricao</span><textarea value={form.description} onChange={(event)=>setForm({...form,description:event.target.value})}/></label></div></Modal>;
}

function CollaboratorDirectoryPage({ currentUser, setPage }) {
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const load = () => apiRequest("/api/collaborators").then(setRows).catch((error) => setToast(error.message));
  useEffect(() => { load(); }, [currentUser?.id]);
  const visible = rows.filter((user) => {
    const haystack = `${user.name} ${user.displayName || ""} ${user.jobTitle || ""} ${user.department || ""} ${user.email || ""} ${user.extension || ""}`.toLowerCase();
    return user.id !== currentUser.id && haystack.includes(query.toLowerCase());
  });
  const startConversation = async (user) => {
    try {
      await apiRequest("/api/internal/conversations", {
        method: "POST",
        body: JSON.stringify({ participantIds: [user.id], department: user.department }),
      });
      setToast(`Conversa com ${user.displayName || user.name} aberta.`);
      setPage("conversas");
    } catch (error) {
      setToast(error.message);
    }
  };
  return <div className="content-page">
    <div className="section-toolbar"><div className="title-icon"><Users/><div><h2>Colaboradores</h2><p>Diretório interno para iniciar conversas corporativas.</p></div></div><button className="secondary-button" onClick={load}><RefreshCw size={16}/> Atualizar</button></div>
    <div className="filter-bar panel"><label><Search size={17}/><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Buscar por nome, cargo, departamento, e-mail ou ramal..." /></label><span className="select-button">{rows.length} ativos</span></div>
    <article className="panel data-table-panel collaborator-directory-panel"><div className="table-scroll"><table className="collaborator-directory-table"><thead><tr><th>Colaborador</th><th>Cargo</th><th>Departamento</th><th>Ramal / e-mail</th><th>Status</th><th>Conversa</th></tr></thead><tbody>{visible.map((user) => <tr key={user.id}><td><div className="table-person collaborator-person"><Avatar initials={user.initials} src={user.photoUrl || user.avatarUrl} alt={user.name} size="md"/><span><strong>{user.displayName || user.name}</strong><small>{outOfOfficeLabel(user.outOfOffice) || user.email || "Sem e-mail cadastrado"}</small></span></div></td><td>{user.jobTitle || user.role || "Colaborador"}</td><td>{user.department || "Sem departamento"}</td><td>{user.extension ? `Ramal ${user.extension}` : user.email || "-"}</td><td>{user.outOfOffice?.active ? <Status>Fora da empresa</Status> : <PresenceIndicator user={user} showLabel />}</td><td><button className="secondary-button compact-action" onClick={() => startConversation(user)}><MessageCircle size={15}/> Conversar</button></td></tr>)}</tbody></table></div></article>
    {!visible.length && <div className="empty-result">Nenhum colaborador encontrado.</div>}
    {toast && <Toast message={toast} tone={toast.includes("erro") ? "warning" : "success"} onClose={()=>setToast("")}/>}
  </div>;
}

function CollaboratorsPage({ setPage, currentUser, onCurrentUserUpdated }) {
  const [configuredDepartments,setConfiguredDepartments]=useState([]);
  const [rows,setRows]=useState([]);
  const [query,setQuery]=useState("");
  const accounts=rows;
  const [modal,setModal]=useState(false); const [editing,setEditing]=useState(null); const [deleting,setDeleting]=useState(null); const [toast,setToast]=useState("");
  const load=async()=>{try{const [usersResult,departmentsResult]=await Promise.all([apiRequest("/api/users"),apiRequest("/api/departments")]);setRows(sortByDisplayName(usersResult));setConfiguredDepartments(departmentsResult.filter((item)=>item.status==="Ativo"))}catch(error){setToast(error.message)}};
  useEffect(()=>{load()},[currentUser?.id]);
  const canCreate=currentUser.role==="Administrador";
  const canEditUser=(user)=>currentUser.role==="Administrador";
  const addCollaborator=async ({user,password})=>{
    try{const created=await apiRequest("/api/users",{method:"POST",body:JSON.stringify({...user,email:cleanEmail(user.email),username:cleanLogin(user.username).toLowerCase(),department:user.dept,password})});setRows((current)=>sortByDisplayName([created,...current]));setModal(false);setToast("Usuário e acesso persistidos no backend.")}catch(error){setToast(error.message)}
  };
  const editCollaborator=async ({user,password,originalEmail,photoFile,removePhoto})=>{
    const existing=rows.find((item)=>item.email===originalEmail);if(!existing)return;
    try{let updated=await apiRequest(`/api/users/${existing.id}`,{method:"PUT",body:JSON.stringify({...user,email:cleanEmail(user.email),username:cleanLogin(user.username).toLowerCase(),department:user.dept,...(password?{password}:{})})});if(removePhoto)updated=await apiRequest(`/api/uploads/users/${existing.id}/photo`,{method:"DELETE",body:"{}"});if(photoFile)updated=await uploadImage(`/api/uploads/users/${existing.id}/photo`,photoFile);setRows((current)=>sortByDisplayName(current.map((item)=>item.id===updated.id?updated:item)));if(updated.id===currentUser.id)onCurrentUserUpdated(updated);setEditing(null);setToast(`Acesso de ${user.name} atualizado no backend.`)}catch(error){setToast(error.message)}
  };
  const deleteCollaborator=async()=>{
    const user=rows.find((item)=>item.email===deleting.email);if(!user)return;
    try{await apiRequest(`/api/users/${user.id}`,{method:"DELETE"});setRows((current)=>current.filter((item)=>item.id!==user.id));setDeleting(null);setToast(`${user.name} foi excluído; o histórico foi preservado.`)}catch(error){setToast(error.message)}
  };
  const startConversation=async(user)=>{
    try{await apiRequest("/api/internal/conversations",{method:"POST",body:JSON.stringify({participantIds:[user.id],department:user.dept||user.department})});setToast(`Conversa com ${user.displayName||user.name} aberta.`);setPage("conversas")}catch(error){setToast(error.message)}
  };
  const visibleRows=sortByDisplayName(rows.filter((user)=>{
    const haystack=normalizeSearchText(`${user.name} ${user.displayName||""} ${user.jobTitle||""} ${user.role||""} ${user.dept||user.department||""} ${user.extension||""} ${user.email||""} ${user.status||""} ${user.accessStatus||""}`);
    return haystack.includes(normalizeSearchText(query).trim());
  }));
  const allowedDepartments=currentUser.role==="Administrador"?configuredDepartments:configuredDepartments.filter((item)=>item.name===currentUser.dept);
  return <div className="content-page"><div className="section-toolbar"><div className="title-icon"><Users/><div><h2>Usuários</h2><p>Diretório corporativo interno para localizar pessoas e iniciar conversas.</p></div></div>{canCreate&&<button className="primary-button" disabled={!allowedDepartments.length} onClick={()=>setModal(true)}><UserPlus size={17}/> Novo usuário</button>}</div><div className="filter-bar panel"><label><Search size={17}/><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Buscar por nome, cargo, departamento, e-mail, ramal ou status..."/></label><button className="secondary-button" onClick={load}><RefreshCw size={16}/> Atualizar</button><span className="select-button">{visibleRows.length} usuários</span></div><article className="panel data-table-panel users-directory-panel"><div className="table-scroll"><table className="users-directory-table"><thead><tr><th>Usuário</th><th>Cargo</th><th>Departamento</th><th>Ramal / e-mail</th><th>Status</th><th>Conversa</th>{rows.some(canEditUser)&&<th>Ações</th>}</tr></thead><tbody>{visibleRows.map((user)=><tr key={user.id}><td><div className="table-person collaborator-person"><Avatar initials={user.initials} size="md" src={user.photoUrl} alt={user.name}/><span><strong>{user.displayName||user.name}</strong><small>{outOfOfficeLabel(user.outOfOffice)||user.email||user.username||"Sem e-mail cadastrado"}</small></span></div></td><td>{user.jobTitle||user.role||"Usuário"}</td><td>{user.dept||user.department||"Sem departamento"}</td><td>{user.extension?`Ramal ${user.extension}`:user.email||"-"}</td><td>{user.outOfOffice?.active?<Status>Fora da empresa</Status>:user.accessStatus==="Ativo"?<PresenceIndicator user={user} showLabel />:<Status>{user.accessStatus}</Status>}</td><td><button className="secondary-button compact-action" disabled={user.id===currentUser.id||user.accessStatus!=="Ativo"} onClick={()=>startConversation(user)}><MessageCircle size={15}/> Conversar</button></td>{rows.some(canEditUser)&&<td>{canEditUser(user)?<div className="row-actions"><button className="secondary-button compact-action" onClick={()=>setEditing({...user,originalEmail:user.email})}><Pencil size={15}/> Editar</button>{currentUser.role==="Administrador"&&<button className="icon-button danger-icon" disabled={user.id===currentUser.id} onClick={()=>setDeleting({email:user.email,name:user.name,role:user.role})} title={user.id===currentUser.id?"Não é possível excluir a conta conectada":"Excluir usuário"}><Trash2 size={16}/></button>}</div>:<span className="muted-cell">Somente leitura</span>}</td>}</tr>)}</tbody></table></div></article>{!visibleRows.length&&<div className="empty-result">Nenhum usuário encontrado.</div>}{modal&&<CollaboratorModal departments={allowedDepartments} accounts={accounts} allowedRoles={["Administrador","Gestor","Usuário"]} onClose={()=>setModal(false)} onConfirm={addCollaborator}/>} {editing&&<EditCollaboratorModal initial={editing} departments={configuredDepartments} accounts={accounts} currentUser={currentUser} onClose={()=>setEditing(null)} onConfirm={editCollaborator}/>} {deleting&&<Modal title={`Excluir ${deleting.name}`} onClose={()=>setDeleting(null)} footer={<><button className="secondary-button" onClick={()=>setDeleting(null)}>Cancelar</button><button className="danger-button" onClick={deleteCollaborator}><Trash2 size={16}/> Excluir definitivamente</button></>}><div className="delete-warning"><Trash2/><div><strong>O acesso e o cadastro serão removidos.</strong><p>Mensagens e autoria histórica serão preservadas nas conversas existentes.</p></div></div></Modal>} {toast&&<Toast message={toast} tone={toast.includes("não")||toast.includes("erro")?"warning":"success"} onClose={()=>setToast("")}/>}</div>;
}

function CollaboratorModal({departments:availableDepartments,accounts,allowedRoles,onClose,onConfirm}) {
  const [form,setForm]=useState({name:"",email:"",username:"",password:"",confirmPassword:"",role:"Usuário",dept:availableDepartments[0]?.name||"",status:"Online",accessStatus:"Ativo",mustChangePassword:true});
  const duplicate=accounts.some((item)=>item.email.toLowerCase()===form.email.toLowerCase()||item.username.toLowerCase()===form.username.toLowerCase());
  const valid=form.name&&form.email&&form.username&&form.dept&&form.password.length>=8&&form.password===form.confirmPassword&&!duplicate;
  const user={name:form.name,email:form.email,username:form.username,role:form.role,dept:form.dept,status:form.status,accessStatus:form.accessStatus,mustChangePassword:form.mustChangePassword,initials:form.name.split(" ").map((item)=>item[0]).slice(0,2).join("").toUpperCase()};
  return <Modal title="Cadastrar colaborador" onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={!valid} onClick={()=>onConfirm({user,password:form.password})}>Cadastrar e criar acesso</button></>}><div className="access-section-title"><KeyRound/><div><h3>Dados do colaborador</h3><p>Identidade, departamento e perfil de autorização.</p></div></div><div className="modal-grid"><label className="modal-field"><span>Nome completo</span><input value={form.name} onChange={(event)=>setForm({...form,name:event.target.value})}/></label><label className="modal-field"><span>Departamento ativo</span><select value={form.dept} onChange={(event)=>setForm({...form,dept:event.target.value})}>{availableDepartments.map((item)=><option key={item.id}>{item.name}</option>)}</select></label><label className="modal-field"><span>Perfil</span><select value={form.role} onChange={(event)=>setForm({...form,role:event.target.value})}>{allowedRoles.map((item)=><option key={item}>{item}</option>)}</select></label><label className="modal-field"><span>Status do colaborador</span><select value={form.status} onChange={(event)=>setForm({...form,status:event.target.value})}><option>Online</option><option>Offline</option></select></label></div><div className="access-section-title"><LockKeyhole/><div><h3>Acesso ao Sistema</h3><p>Credenciais e regras do primeiro acesso.</p></div></div><div className="modal-grid"><label className="modal-field"><span>E-mail</span><input type="email" value={form.email} onChange={(event)=>setForm({...form,email:event.target.value})}/></label><label className="modal-field"><span>Usuário / login</span><input value={form.username} onChange={(event)=>setForm({...form,username:event.target.value.replace(/\s/g,"").toLowerCase()})}/></label><label className="modal-field"><span>Senha temporária</span><input type="password" value={form.password} onChange={(event)=>setForm({...form,password:event.target.value})}/></label><label className="modal-field"><span>Confirmar senha</span><input type="password" value={form.confirmPassword} onChange={(event)=>setForm({...form,confirmPassword:event.target.value})}/></label><label className="modal-field"><span>Status do acesso</span><select value={form.accessStatus} onChange={(event)=>setForm({...form,accessStatus:event.target.value})}><option>Ativo</option><option>Inativo</option></select></label><label className="check-row access-check"><input type="checkbox" checked={form.mustChangePassword} onChange={(event)=>setForm({...form,mustChangePassword:event.target.checked})}/> Obrigar troca de senha no primeiro acesso</label></div>{duplicate&&<p className="field-error">E-mail ou login já cadastrado.</p>}<p className="transfer-note">A senha precisa ter pelo menos 8 caracteres. Em produção, o hash e a sessão devem ficar exclusivamente no servidor.</p></Modal>;
}

function EditCollaboratorModal({initial,departments:availableDepartments,accounts,currentUser,onClose,onConfirm}) {
  const normalizedRole=["Administrador","Gestor","Usuário"].includes(initial.role)?initial.role:"Usuário";
  const [form,setForm]=useState({name:initial.name,email:initial.email,username:initial.username||initial.email,role:normalizedRole,dept:initial.dept,accessStatus:initial.accessStatus||"Ativo",mustChangePassword:!!initial.mustChangePassword,password:"",confirmPassword:""});
  const [generatedPassword,setGeneratedPassword]=useState(false);
  const [photoFile,setPhotoFile]=useState(null);
  const [removePhoto,setRemovePhoto]=useState(false);
  const duplicate=accounts.some((item)=>item.email!==initial.originalEmail&&(item.email.toLowerCase()===form.email.toLowerCase()||(item.username||"").toLowerCase()===form.username.toLowerCase()));
  const activeAdmins=accounts.filter((item)=>item.role==="Administrador"&&item.accessStatus==="Ativo").length;
  const removingLastAdmin=initial.role==="Administrador"&&initial.accessStatus==="Ativo"&&activeAdmins===1&&(form.role!=="Administrador"||form.accessStatus!=="Ativo");
  const disablingSelf=initial.originalEmail===currentUser.email&&(form.role!=="Administrador"||form.accessStatus!=="Ativo");
  const passwordValid=!form.password||(form.password.length>=8&&form.password===form.confirmPassword);
  const valid=form.name.trim()&&form.email.trim()&&form.username.trim()&&form.dept&&!duplicate&&!removingLastAdmin&&!disablingSelf&&passwordValid;
  const generate=()=>{const password=generateTemporaryPassword();setGeneratedPassword(true);setForm({...form,password,confirmPassword:password,mustChangePassword:true})};
  const user={name:form.name.trim(),email:form.email.trim(),username:form.username.trim().toLowerCase(),role:form.role,dept:form.dept,accessStatus:form.accessStatus,mustChangePassword:form.mustChangePassword,initials:form.name.split(" ").map((item)=>item[0]).slice(0,2).join("").toUpperCase(),status:initial.status||"Online"};
  return <Modal title={`Editar acesso - ${initial.name}`} onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={!valid} onClick={()=>onConfirm({user,password:form.password,originalEmail:initial.originalEmail,photoFile,removePhoto})}><Save size={16}/> Salvar alterações</button></>}>
    <div className="access-section-title"><Users/><div><h3>Colaborador e permissões</h3><p>Alterações de perfil e departamento passam a valer no próximo acesso.</p></div></div>
    <div className="modal-grid"><label className="modal-field"><span>Nome completo</span><input value={form.name} onChange={(event)=>setForm({...form,name:event.target.value})}/></label><label className="modal-field"><span>Departamento</span><select value={form.dept} onChange={(event)=>setForm({...form,dept:event.target.value})}>{availableDepartments.map((item)=><option key={item.id}>{item.name}</option>)}</select></label><label className="modal-field"><span>Perfil</span><select value={form.role} onChange={(event)=>setForm({...form,role:event.target.value})}>{["Administrador","Gestor","Usuário"].map((item)=><option key={item}>{item}</option>)}</select></label><label className="modal-field"><span>Status do acesso</span><select value={form.accessStatus} onChange={(event)=>setForm({...form,accessStatus:event.target.value})}><option>Ativo</option><option>Inativo</option></select></label><label className="modal-field"><span>E-mail</span><input type="email" value={form.email} onChange={(event)=>setForm({...form,email:event.target.value})}/></label><label className="modal-field"><span>Usuário / login</span><input value={form.username} onChange={(event)=>setForm({...form,username:event.target.value.replace(/\s/g,"")})}/></label></div>
    <div className="access-section-title password-edit-title"><KeyRound/><div><h3>Redefinição de senha</h3><p>Deixe em branco para manter a senha atual.</p></div><button className="secondary-button" onClick={generate}><RefreshCw size={15}/> Gerar temporária</button></div>
    <div className="modal-grid"><label className="modal-field"><span>Nova senha</span><input type={generatedPassword?"text":"password"} value={form.password} onChange={(event)=>{setGeneratedPassword(false);setForm({...form,password:event.target.value})}}/></label><label className="modal-field"><span>Confirmar senha</span><input type={generatedPassword?"text":"password"} value={form.confirmPassword} onChange={(event)=>{setGeneratedPassword(false);setForm({...form,confirmPassword:event.target.value})}}/></label><label className="check-row access-check full"><input type="checkbox" checked={form.mustChangePassword} onChange={(event)=>setForm({...form,mustChangePassword:event.target.checked})}/> Obrigar troca no próximo login</label></div>
    <div className="access-section-title password-edit-title"><Image/><div><h3>Foto interna</h3><p>Usada no chat interno, reuniões, lista de colaboradores e topo do painel.</p></div></div>
    <div className="profile-photo-editor"><Avatar initials={initial.initials || "CP"} src={removePhoto ? "" : initial.photoUrl} alt={initial.name} size="lg"/><label className="secondary-button"><Image size={15}/> Escolher foto<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event)=>{setPhotoFile(event.target.files?.[0]||null);setRemovePhoto(false)}}/></label>{initial.photoUrl&&<button className="secondary-button" onClick={()=>{setRemovePhoto(true);setPhotoFile(null)}}>Remover foto</button>}<span>{photoFile?photoFile.name:removePhoto?"Foto será removida":"JPG, PNG ou WEBP até 3 MB."}</span></div>
    {generatedPassword&&<div className="generated-password"><KeyRound size={16}/><span><strong>Senha temporária gerada</strong><code>{form.password}</code></span><button className="secondary-button" onClick={()=>navigator.clipboard?.writeText(form.password)}>Copiar</button></div>}
    {duplicate&&<p className="field-error">E-mail ou login já pertence a outro usuário.</p>}{removingLastAdmin&&<p className="field-error">Não é permitido remover ou inativar o último Administrador ativo.</p>}{disablingSelf&&<p className="field-error">O Administrador conectado não pode remover o próprio acesso administrativo.</p>}{!passwordValid&&<p className="field-error">A nova senha deve ter pelo menos 8 caracteres e coincidir com a confirmação.</p>}<p className="transfer-note">A auditoria registrará os campos alterados, mas nunca armazenará a senha informada.</p>
  </Modal>;
}

const defaultContactRecords = contacts.map((contact, index) => ({
  id: `contact-${contact.id}`,
  type: index === 2 ? "PJ" : "PF",
  name: contact.name,
  phone: contact.phone,
  cpf: index === 2 ? "" : index === 0 ? "123.456.789-10" : "",
  cnpj: index === 2 ? "12.345.678/0001-90" : "",
  legalName: index === 2 ? "Empresa ABC Comércio e Serviços Ltda" : "",
  tradeName: index === 2 ? "Empresa ABC" : "",
  email: index === 0 ? "mariana.alves@email.com" : "",
  notes: index === 0 ? "Cliente demonstrou interesse em soluções comerciais." : "",
  photoUrl: "",
  photoSource: "Imagem padrão",
  createdAt: `2026-06-${String(12 + index).padStart(2, "0")}T09:00:00`,
}));

function migrateContactRecords() {
  const existing = readStored("kalion-contacts-v3", null);
  if (existing) return existing;
  const legacy = readStored("kalion-v2-contatos-rows", []);
  if (!legacy.length) return defaultContactRecords;
  return legacy.map((row, index) => ({
    id: `legacy-contact-${index + 1}`,
    type: row[2] ? "PJ" : "PF",
    name: row[0] || "Contato sem nome",
    phone: row[1] || "",
    cpf: "",
    cnpj: "",
    legalName: row[2] || "",
    tradeName: row[2] || "",
    email: "",
    notes: [row[3] ? `Departamento do último registro: ${row[3]}.` : "", row[4] ? `Status anterior preservado: ${row[4]}.` : ""].filter(Boolean).join(" "),
    photoUrl: "",
    photoSource: "Imagem padrão",
    createdAt: new Date().toISOString(),
  }));
}

function ContactsPage({ currentUser }) {
  const [records, setRecords] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("Todos");
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState("Dados");
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState("");
  const canManage = ["Administrador", "Gestor", "Supervisor"].includes(currentUser.role);
  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest("/api/whatsapp/contacts", { headers: apiUserHeaders(currentUser) }),
      apiRequest("/api/whatsapp/conversations", { headers: apiUserHeaders(currentUser) }),
    ]).then(([cloudContacts, cloudConversations]) => {
      if (!active) return;
      setRecords(cloudContacts.map((contact) => ({
          ...contact,
          source: "whatsapp-cloud",
          type: contact.cnpj ? "PJ" : "PF",
          legalName: contact.company || "",
          tradeName: contact.company || "",
          notes: "Contato criado automaticamente pela WhatsApp Cloud API.",
          photoUrl: contact.photoUrl || "",
          photoSource: "Imagem padrão",
        })));
      setConversations(cloudConversations.map(mapCloudConversation));
    }).catch((error) => active && setToast(`WhatsApp Cloud API: ${error.message}`));
    return () => { active = false; };
  }, [currentUser]);
  const relationshipFor = (contact) => conversations.filter((conversation) => conversation.phone === contact.phone || conversation.name === contact.name);
  const visible = records.filter((contact) => {
    const company = contact.tradeName || contact.legalName;
    return `${contact.name} ${contact.phone} ${company} ${contact.cpf} ${contact.cnpj}`.toLowerCase().includes(query.toLowerCase()) && (type === "Todos" || contact.type === type);
  });
  const selected = records.find((contact) => contact.id === selectedId);
  const selectedRelationships = selected ? relationshipFor(selected) : [];
  const saveContact = async(contact) => {
    try{const saved=await apiRequest(contact.id?`/api/whatsapp/contacts/${contact.id}`:"/api/whatsapp/contacts",{method:contact.id?"PUT":"POST",body:JSON.stringify(contact)});const normalized={...saved,source:"whatsapp-cloud",type:saved.cnpj?"PJ":"PF",legalName:saved.legalName||saved.company||"",tradeName:saved.tradeName||saved.company||"",photoSource:saved.photoSource||"Imagem padrão"};setRecords((current)=>contact.id?current.map((item)=>item.id===saved.id?normalized:item):[normalized,...current]);setEditing(null);setToast(contact.id?"Cadastro persistido no backend.":"Contato cadastrado no backend.")}catch(error){setToast(error.message)}
  };
  const saveContactWithPhoto = async(contact) => {
    try{
      let saved=await apiRequest(contact.id?`/api/whatsapp/contacts/${contact.id}`:"/api/whatsapp/contacts",{method:contact.id?"PUT":"POST",body:JSON.stringify(contact)});
      if(contact.removePhoto)saved=await apiRequest(`/api/uploads/contacts/${saved.id}/photo`,{method:"DELETE",body:"{}"});
      if(contact.photoFile)saved=await uploadImage(`/api/uploads/contacts/${saved.id}/photo`,contact.photoFile);
      const normalized={...saved,source:"whatsapp-cloud",type:saved.cnpj?"PJ":"PF",legalName:saved.legalName||saved.company||"",tradeName:saved.tradeName||saved.company||"",photoSource:saved.photoSource||"Imagem padrão"};
      setRecords((current)=>contact.id?current.map((item)=>item.id===saved.id?normalized:item):[normalized,...current]);
      setEditing(null);
      setToast(contact.id?"Cadastro persistido no backend.":"Contato cadastrado no backend.");
    }catch(error){setToast(error.message)}
  };
  return <div className="contacts-page">
    <div className="section-toolbar"><div className="title-icon"><Contact/><div><h2>Contatos</h2><p>Cadastro de pessoas e empresas, separado do fluxo operacional de atendimento.</p></div></div>{canManage && <button className="primary-button" onClick={() => setEditing({type:"PF",name:"",phone:"",cpf:"",cnpj:"",legalName:"",tradeName:"",email:"",notes:""})}><Plus size={17}/> Novo contato</button>}</div>
    <div className="contact-principle"><Contact size={18}/><div><strong>Contato é cadastro e relacionamento.</strong><span>Departamento, responsável, status e protocolo pertencem a cada atendimento.</span></div></div>
    <div className="filter-bar panel contacts-filter"><label><Search size={17}/><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Buscar por nome, telefone, CPF, CNPJ ou empresa..."/></label><div className="contact-type-filter">{["Todos","PF","PJ"].map((item)=><button key={item} className={type===item?"active":""} onClick={()=>setType(item)}>{item==="PF"?"Pessoa Física":item==="PJ"?"Pessoa Jurídica":"Todos"}</button>)}</div></div>
    <article className="panel contacts-table-panel"><div className="table-scroll"><table className="contacts-table"><thead><tr><th>Contato</th><th>Telefone</th><th>Empresa</th><th>Último atendimento</th><th>Total de atendimentos</th><th>Último contato</th><th></th></tr></thead><tbody>{visible.map((contact)=>{
      const relationships=relationshipFor(contact); const latest=relationships[0];
      return <tr key={contact.id} onClick={()=>{setSelectedId(contact.id);setTab("Dados");}}><td><div className="contact-table-person">{contact.photoUrl?<img src={mediaUrl(contact.photoUrl)} alt=""/>:<Avatar initials={contact.name.split(" ").map((item)=>item[0]).slice(0,2).join("").toUpperCase()} color="#536f8b"/>}<span><strong>{contact.name}</strong><small>{contact.type==="PF"?"Pessoa Física":"Pessoa Jurídica"}</small></span></div></td><td>{contact.phone}</td><td>{contact.tradeName||contact.legalName||"—"}</td><td>{latest?latest.department:"Sem atendimento"}</td><td>{relationships.length}</td><td>{latest?new Date(latest.createdAt).toLocaleDateString("pt-BR"):"—"}</td><td><button className="icon-button" aria-label={`Abrir cadastro de ${contact.name}`}><ChevronRight size={17}/></button></td></tr>;
    })}</tbody></table></div>{!visible.length&&<div className="empty-result">Nenhum contato encontrado.</div>}</article>
    {selected&&<ContactDetail contact={selected} relationships={selectedRelationships} tab={tab} setTab={setTab} canManage={canManage} onEdit={()=>setEditing(selected)} onClose={()=>setSelectedId(null)} onPhoto={()=>setToast("A API oficial disponível nesta instalação não fornece foto de perfil. A imagem padrão foi mantida.")}/>}
    {editing&&<ContactEditModal initial={editing} onClose={()=>setEditing(null)} onSave={saveContactWithPhoto}/>}
    {toast&&<Toast message={toast} tone={toast.includes("não fornece")?"warning":"success"} onClose={()=>setToast("")}/>}
  </div>;
}

function ContactDetail({contact,relationships,tab,setTab,canManage,onEdit,onClose,onPhoto}) {
  const protocols=relationships.filter((item)=>item.protocol);
  const attachments=relationships.flatMap((conversation)=>conversation.messages.filter((message)=>message.type==="file").map((message)=>({...message,protocol:conversation.protocol})));
  return <div className="contact-detail-backdrop" onMouseDown={(event)=>event.target===event.currentTarget&&onClose()}><aside className="contact-detail">
    <header><button className="icon-button" onClick={onClose}><X size={18}/></button><div className="contact-detail-profile">{contact.photoUrl?<img src={mediaUrl(contact.photoUrl)} alt=""/>:<Avatar initials={contact.name.split(" ").map((item)=>item[0]).slice(0,2).join("").toUpperCase()} size="lg" color="#536f8b"/>}<div><h2>{contact.name}</h2><span>{contact.phone} · {contact.type==="PF"?"Pessoa Física":"Pessoa Jurídica"}</span></div></div>{canManage&&<button className="secondary-button" onClick={onEdit}><Pencil size={16}/> Editar</button>}</header>
    <nav>{["Dados","Histórico","Conversas","Protocolos","Anexos"].map((item)=><button key={item} className={tab===item?"active":""} onClick={()=>setTab(item)}>{item}</button>)}</nav>
    <div className="contact-detail-body">
      {tab==="Dados"&&<div className="contact-data-view"><section><h3>Cadastro</h3><dl><dt>Nome</dt><dd>{contact.name}</dd><dt>Telefone</dt><dd>{contact.phone}</dd><dt>{contact.type==="PF"?"CPF":"CNPJ"}</dt><dd>{contact.type==="PF"?(contact.cpf||"Não informado"):(contact.cnpj||"Não informado")}</dd><dt>E-mail</dt><dd>{contact.email||"Não informado"}</dd>{contact.type==="PJ"&&<><dt>Razão Social</dt><dd>{contact.legalName||"Não informado"}</dd><dt>Nome Fantasia</dt><dd>{contact.tradeName||"Não informado"}</dd></>}</dl></section><section><div className="detail-section-title"><h3>Foto do WhatsApp</h3><button className="secondary-button" onClick={onPhoto}><RefreshCw size={15}/> Atualizar</button></div><div className="photo-source"><Avatar initials={contact.name.split(" ").map((item)=>item[0]).slice(0,2).join("").toUpperCase()} size="lg" color="#536f8b" src={contact.photoUrl} alt={contact.name}/><span><strong>{contact.photoSource}</strong><small>Atualização automática depende da permissão da API utilizada.</small></span></div></section><section><h3>Observações</h3><p>{contact.notes||"Nenhuma observação cadastrada."}</p></section></div>}
      {tab==="Histórico"&&<RelationshipHistory relationships={relationships}/>}
      {tab==="Conversas"&&<div className="relationship-list">{relationships.map((item)=><article key={item.id}><MessageCircle/><div><strong>{item.preview}</strong><span>{item.department} · {item.owner}</span><small>{item.messages.length} mensagens</small></div><Status>{item.status}</Status></article>)}{!relationships.length&&<div className="empty-result">Nenhuma conversa vinculada.</div>}</div>}
      {tab==="Protocolos"&&<div className="protocol-list">{protocols.map((item)=><article key={item.protocol}><FileText/><div><strong>{item.protocol}</strong><span>{item.department} · {item.status}</span><small>{new Date(item.createdAt).toLocaleString("pt-BR")}</small></div></article>)}{!protocols.length&&<div className="empty-result">Nenhum protocolo gerado.</div>}</div>}
      {tab==="Anexos"&&<div className="attachment-list">{attachments.map((item,index)=><article key={index}><Paperclip/><div><strong>{item.name||"Arquivo enviado"}</strong><span>{item.protocol}</span></div></article>)}{!attachments.length&&<div className="empty-result">Nenhum arquivo enviado por este contato.</div>}</div>}
    </div>
  </aside></div>;
}

function RelationshipHistory({relationships}) {
  return <div className="relationship-history">{relationships.map((item)=><article key={item.id}><div className="history-date"><strong>{new Date(item.createdAt).toLocaleDateString("pt-BR")}</strong><span>{item.time}</span></div><div><h3>{item.protocol||"Atendimento sem protocolo"}</h3><p>{item.customerData?.reason||item.preview}</p><span>{item.department} · Responsável: {item.owner}</span>{item.transferHistory?.map((transfer,index)=><small key={index}>Transferido de {transfer.from} para {transfer.to}: {transfer.reason}</small>)}</div><Status>{item.status}</Status></article>)}{!relationships.length&&<div className="empty-result">Este contato ainda não possui atendimentos.</div>}</div>;
}

function ContactEditModal({initial,onClose,onSave}) {
  const [form,setForm]=useState({...initial});
  const [photoFile,setPhotoFile]=useState(null);
  const [removePhoto,setRemovePhoto]=useState(false);
  const valid=form.name.trim()&&form.phone.trim()&&(form.type==="PF"||form.cnpj.trim());
  return <Modal title={form.id?"Editar contato":"Novo contato"} onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={!valid} onClick={()=>onSave({...form,photoFile,removePhoto})}><Save size={16}/> Salvar cadastro</button></>}>
    <div className="contact-kind"><button className={form.type==="PF"?"active":""} onClick={()=>setForm({...form,type:"PF"})}>Pessoa Física</button><button className={form.type==="PJ"?"active":""} onClick={()=>setForm({...form,type:"PJ"})}>Pessoa Jurídica</button></div>
    <div className="modal-grid"><label className="modal-field"><span>{form.type==="PF"?"Nome completo":"Nome do contato"}</span><input value={form.name} onChange={(event)=>setForm({...form,name:event.target.value})}/></label><label className="modal-field"><span>Telefone</span><input value={form.phone} onChange={(event)=>setForm({...form,phone:event.target.value})}/></label>{form.type==="PF"?<label className="modal-field"><span>CPF (opcional)</span><input value={form.cpf} onChange={(event)=>setForm({...form,cpf:event.target.value})}/></label>:<><label className="modal-field"><span>CNPJ</span><input value={form.cnpj} onChange={(event)=>setForm({...form,cnpj:event.target.value})}/></label><label className="modal-field"><span>Razão Social</span><input value={form.legalName} onChange={(event)=>setForm({...form,legalName:event.target.value})}/></label><label className="modal-field"><span>Nome Fantasia</span><input value={form.tradeName} onChange={(event)=>setForm({...form,tradeName:event.target.value})}/></label></>}<label className="modal-field"><span>E-mail (opcional)</span><input type="email" value={form.email} onChange={(event)=>setForm({...form,email:event.target.value})}/></label><label className="modal-field full"><span>Observações</span><textarea value={form.notes} onChange={(event)=>setForm({...form,notes:event.target.value})}/></label></div>
    <div className="profile-photo-editor"><Avatar initials={form.name?.split(" ").map((item)=>item[0]).slice(0,2).join("").toUpperCase() || "CT"} src={removePhoto ? "" : form.photoUrl} alt={form.name} size="lg"/><label className="secondary-button"><Image size={15}/> Foto do contato<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event)=>{setPhotoFile(event.target.files?.[0]||null);setRemovePhoto(false)}}/></label>{form.photoUrl&&<button className="secondary-button" onClick={()=>{setRemovePhoto(true);setPhotoFile(null)}}>Remover foto</button>}<span>{photoFile?photoFile.name:removePhoto?"Foto será removida":"Foto manual. A Cloud API oficial não fornece foto do cliente nesta instalação."}</span></div>
  </Modal>;
}

function TemplatesPage() {
  const [rows,setRows]=useState([]);
  const [toast,setToast]=useState("");
  const [loading,setLoading]=useState(true);
  const load=()=>{setLoading(true);apiRequest("/api/integrations/whatsapp/templates").then((result)=>setRows(result.data||[])).catch((error)=>setToast(error.message)).finally(()=>setLoading(false))};
  useEffect(()=>{load();},[]);
  return <div className="content-page"><div className="section-toolbar"><div className="title-icon"><FileText/><div><h2>Templates WhatsApp</h2><p>Modelos sincronizados diretamente da WABA configurada.</p></div></div><button className="secondary-button" onClick={load}><RefreshCw size={16}/> Atualizar</button></div><article className="panel data-table-panel"><div className="table-scroll"><table><thead><tr><th>Template</th><th>Categoria</th><th>Idioma</th><th>Qualidade</th><th>Status</th></tr></thead><tbody>{rows.map((item)=><tr key={item.id||`${item.name}-${item.language}`}><td>{item.name}</td><td>{item.category}</td><td>{item.language}</td><td>{item.quality_score?.score||"-"}</td><td><Status>{item.status}</Status></td></tr>)}</tbody></table></div>{!loading&&!rows.length&&<div className="empty-result">Nenhum template retornado pela Meta.</div>}</article>{toast&&<Toast message={toast} tone="warning" onClose={()=>setToast("")}/>}</div>;
}

function LogsPage() {
  const [rows,setRows]=useState([]);
  const [toast,setToast]=useState("");
  const load=()=>apiRequest("/api/whatsapp/logs").then((result)=>setRows([
    ...(result.login||[]).map((item)=>[item.at,item.login||item.userId||"-",item.action,item.ip||"-"]),
    ...(result.audit||[]).map((item)=>[item.at,item.actor||"-",item.action,item.detail||"-"]),
    ...(result.integration||[]).map((item)=>[item.at,item.source||"-",item.code||item.level||"-",item.message||item.operation||"-"]),
  ])).catch((error)=>setToast(error.message));
  useEffect(()=>{load();},[]);
  return <div className="content-page"><div className="section-toolbar"><div className="title-icon"><Archive/><div><h2>Logs do Sistema</h2><p>Login, auditoria e integração persistidos no backend.</p></div></div><button className="secondary-button" onClick={load}><RefreshCw size={16}/> Atualizar</button></div><article className="panel data-table-panel"><div className="table-scroll"><table><thead><tr><th>Data e hora</th><th>Origem</th><th>Ação/código</th><th>Detalhe</th></tr></thead><tbody>{rows.map((row,index)=><tr key={`${row[0]}-${index}`}>{row.map((cell, cellIndex)=><td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div></article>{toast&&<Toast message={toast} tone="warning" onClose={()=>setToast("")}/>}</div>;
}

function OperationsHistoryPage({ mode }) {
  const [rows,setRows]=useState([]);
  const [toast,setToast]=useState("");
  const load=()=>apiRequest("/api/whatsapp/conversations").then((items)=>setRows(items)).catch((error)=>setToast(error.message));
  useEffect(()=>{load();},[]);
  const transfers=rows.flatMap((conversation)=>(conversation.transferHistory||[]).map((item)=>({conversation,...item})));
  const historical=rows.filter((item)=>item.status==="closed"||item.closedAt);
  const exportRows=()=>{const values=mode==="transferencias"?transfers.map((item)=>[item.conversation.name,item.from,item.department,item.to,item.reason,item.at]):historical.map((item)=>[item.protocol,item.name,item.department,item.owner,item.closedAt]);downloadFile(`${mode}-${new Date().toISOString().slice(0,10)}.csv`,values.map((row)=>row.join(";")).join("\r\n"));};
  return <div className="content-page"><div className="section-toolbar"><div className="title-icon">{mode==="transferencias"?<ArrowLeftRight/>:<History/>}<div><h2>{mode==="transferencias"?"Transferências":"Histórico de conversas"}</h2><p>Dados reais persistidos no backend.</p></div></div><button className="primary-button" onClick={exportRows}><Download size={16}/> Exportar</button></div><article className="panel data-table-panel"><div className="table-scroll"><table><thead>{mode==="transferencias"?<tr><th>Cliente</th><th>Origem</th><th>Destino</th><th>Responsável</th><th>Motivo</th><th>Data</th></tr>:<tr><th>Protocolo</th><th>Contato</th><th>Departamento</th><th>Responsável</th><th>Encerrado em</th></tr>}</thead><tbody>{mode==="transferencias"?transfers.map((item,index)=><tr key={`${item.at}-${index}`}><td>{item.conversation.name}</td><td>{item.from}</td><td>{item.department}</td><td>{item.to}</td><td>{item.reason}</td><td>{new Date(item.at).toLocaleString("pt-BR")}</td></tr>):historical.map((item)=><tr key={item.id}><td>{item.protocol||"-"}</td><td>{item.name}</td><td>{item.department}</td><td>{item.owner}</td><td>{item.closedAt?new Date(item.closedAt).toLocaleString("pt-BR"):"-"}</td></tr>)}</tbody></table></div></article>{toast&&<Toast message={toast} tone="warning" onClose={()=>setToast("")}/>}</div>;
}

function QuickRepliesPage({ currentUser }) {
  const [rows, setRows] = useState([]);
  const [departmentRows, setDepartmentRows] = useState([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [toast, setToast] = useState("");
  const load = async () => {
    try {
      const [replies, departmentsResult] = await Promise.all([
        apiRequest("/api/quick-replies"),
        apiRequest("/api/departments"),
      ]);
      setRows(replies);
      setDepartmentRows(departmentsResult);
    } catch (error) {
      setToast(error.message);
    }
  };
  useEffect(() => { load(); }, [currentUser.id]);
  const visibleRows = rows.filter((row) => {
    const text = `${row.shortcut} ${row.description} ${row.content} ${row.department} ${row.owner || ""}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (statusFilter === "Todos" || row.status === statusFilter);
  });
  const save = async (form) => {
    try {
      await apiRequest(editing?.id ? `/api/quick-replies/${editing.id}` : "/api/quick-replies", {
        method: editing?.id ? "PUT" : "POST",
        body: JSON.stringify(form),
      });
      setEditing(null);
      setToast(editing?.id ? "Resposta rápida atualizada." : "Resposta rápida cadastrada.");
      await load();
    } catch (error) {
      setToast(error.message);
    }
  };
  const remove = async () => {
    try {
      await apiRequest(`/api/quick-replies/${deleting.id}`, { method: "DELETE" });
      setDeleting(null);
      setToast("Resposta rápida excluída.");
      await load();
    } catch (error) {
      setToast(error.message);
    }
  };
  return <div className="content-page">
    <div className="section-toolbar"><div className="title-icon"><Zap/><div><h2>Respostas rápidas</h2><p>Atalhos persistidos por usuário, departamento ou em escopo global.</p></div></div><button className="primary-button" onClick={() => setEditing({})}><Plus size={17}/> Nova resposta</button></div>
    <div className="filter-bar panel"><label><Search size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar atalhos e mensagens..."/></label><select className="secondary-button" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>Todos</option><option>Ativo</option><option>Inativo</option></select><button className="secondary-button" onClick={load}><RefreshCw size={16}/> Atualizar</button></div>
    <article className="panel data-table-panel"><div className="table-scroll"><table><thead><tr><th>Atalho</th><th>Descrição</th><th>Escopo</th><th>Departamento / usuário</th><th>Uso</th><th>Status</th><th>Ações</th></tr></thead><tbody>{visibleRows.map((row) => { const canManage = currentUser.role === "Administrador" || (currentUser.role === "Gestor" && row.scope !== "global" && row.department === currentUser.dept) || (row.scope === "personal" && row.ownerId === currentUser.id); return <tr key={row.id}><td><strong>{row.shortcut}</strong></td><td>{row.description}</td><td>{row.scope === "global" ? "Global" : row.scope === "department" ? "Departamento" : "Pessoal"}</td><td>{row.scope === "personal" ? row.owner : row.department}</td><td>{row.usageCount || 0}</td><td><Status>{row.status}</Status></td><td>{canManage ? <div className="row-actions"><button className="icon-button" onClick={() => setEditing(row)} title="Editar"><Pencil size={16}/></button><button className="icon-button danger-icon" onClick={() => setDeleting(row)} title="Excluir"><Trash2 size={16}/></button></div> : <span>Somente leitura</span>}</td></tr>; })}</tbody></table></div><div className="pagination"><span>Exibindo {visibleRows.length} de {rows.length} respostas persistidas</span></div></article>
    {editing && <QuickReplyModal currentUser={currentUser} departments={departmentRows} initial={editing} onClose={() => setEditing(null)} onSave={save}/>}
    {deleting && <Modal title="Excluir resposta rápida" onClose={() => setDeleting(null)} footer={<><button className="secondary-button" onClick={() => setDeleting(null)}>Cancelar</button><button className="danger-button" onClick={remove}>Excluir</button></>}><p>Confirma a exclusão de <strong>{deleting.shortcut}</strong>? A operação será registrada na auditoria.</p></Modal>}
    {toast && <Toast message={toast} tone={toast.toLowerCase().includes("erro") || toast.includes("permissão") ? "warning" : "success"} onClose={() => setToast("")}/>}
  </div>;
}

function QuickReplyModal({ currentUser, departments, initial, onClose, onSave }) {
  const allowedScopes = currentUser.role === "Administrador" ? ["global", "department", "personal"] : currentUser.role === "Gestor" ? ["department", "personal"] : ["personal"];
  const [form, setForm] = useState({
    shortcut: initial.shortcut || "/",
    description: initial.description || "",
    content: initial.content || "",
    scope: initial.scope || allowedScopes[0],
    department: initial.department === "Todos" ? currentUser.dept : initial.department || currentUser.dept,
    status: initial.status || "Ativo",
  });
  const valid = /^\/[a-z0-9_-]{2,40}$/i.test(form.shortcut) && form.description.trim() && form.content.trim();
  return <Modal title={initial.id ? "Editar resposta rápida" : "Nova resposta rápida"} onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={!valid} onClick={() => onSave(form)}><Save size={16}/> Salvar</button></>}>
    <div className="modal-grid"><label className="modal-field"><span>Atalho</span><input value={form.shortcut} onChange={(event) => setForm({...form, shortcut:event.target.value.replace(/\s/g, "").toLowerCase()})} placeholder="/meu_atalho"/></label><label className="modal-field"><span>Descrição</span><input value={form.description} onChange={(event) => setForm({...form, description:event.target.value})}/></label><label className="modal-field"><span>Escopo</span><select value={form.scope} disabled={Boolean(initial.id)} onChange={(event) => setForm({...form, scope:event.target.value})}>{allowedScopes.map((scope) => <option key={scope} value={scope}>{scope === "global" ? "Global" : scope === "department" ? "Departamento" : "Pessoal"}</option>)}</select></label><label className="modal-field"><span>Departamento</span><select value={form.department} disabled={form.scope !== "department" || currentUser.role !== "Administrador"} onChange={(event) => setForm({...form, department:event.target.value})}>{departments.map((department) => <option key={department.id}>{department.name}</option>)}</select></label><label className="modal-field"><span>Status</span><select value={form.status} onChange={(event) => setForm({...form, status:event.target.value})}><option>Ativo</option><option>Inativo</option></select></label><label className="modal-field full"><span>Mensagem</span><textarea value={form.content} onChange={(event) => setForm({...form, content:event.target.value})} rows={6}/></label></div>
  </Modal>;
}

function GenericPage({ page }) {
  const configs = {
    respostas: { icon: Zap, title: "Respostas rápidas", button: "Nova resposta", columns: ["Atalho", "Descrição", "Departamento", "Uso", "Status"], rows: [["/curso_valores", "Valores e formas de pagamento", "Comercial", "284 vezes", "Ativo"], ["/boas_vindas", "Saudação inicial", "Todos", "198 vezes", "Ativo"], ["/suporte_acesso", "Orientação de primeiro acesso", "Suporte", "142 vezes", "Ativo"], ["/rh_documentos", "Lista de documentos necessários", "RH", "97 vezes", "Ativo"]] },
    templates: { icon: FileText, title: "Templates WhatsApp", button: "Novo template", columns: ["Template", "Categoria", "Idioma", "Qualidade", "Status"], rows: [["boas_vindas_kalion", "Marketing", "Português", "Alta", "Aprovado"], ["retorno_candidato", "Utilidade", "Português", "Alta", "Aprovado"], ["lembrete_atendimento", "Utilidade", "Português", "Média", "Em análise"], ["proposta_comercial", "Marketing", "Português", "-", "Rascunho"]] },
    transferencias: { icon: ArrowLeftRight, title: "Transferências", button: "Exportar", columns: ["Cliente", "Origem", "Destino", "Responsável", "Motivo"], rows: [["Mariana Alves", "Suporte", "Comercial", "João Silva", "Interesse comercial"], ["Lucas Pereira", "Comercial", "Suporte", "Maria Santos", "Dúvida técnica"], ["Empresa ABC Ltda", "Vendas", "Financeiro", "Júlia Souza", "Negociação de boleto"], ["Ana Beatriz", "RH", "Jurídico", "Pedro Costa", "Análise documental"]] },
    historico: { icon: History, title: "Histórico de conversas", button: "Exportar histórico", columns: ["Protocolo", "Contato", "Departamento", "Atendente", "Encerrado em"], rows: [["#5820", "Carlos Eduardo", "Suporte", "Maria Santos", "Hoje, 08:31"], ["#5819", "Juliana Costa", "Comercial", "João Silva", "Ontem, 17:42"], ["#5818", "Pedro Henrique", "RH", "Felipe Lima", "Ontem, 16:10"], ["#5817", "Empresa XPTO", "Financeiro", "Júlia Souza", "Ontem, 14:55"]] },
    logs: { icon: Archive, title: "Logs do Sistema", button: "Exportar logs", columns: ["Data e hora", "Usuário", "Ação", "Detalhe", "Login"], rows: [...readStored("kalion-login-logs-v1", []).map((item) => [new Date(item.at).toLocaleString("pt-BR"), item.user, item.action, item.detail || "—", item.login]), ["20/06/2026 09:52", "João Silva", "Enviou mensagem", "Atendimento #5821", "joao"]] },
  };
  const cfg = configs[page] || configs.respostas;
  const Icon = cfg.icon;
  const storageKey = `kalion-v2-${page}-rows`;
  const [rows, setRows] = useState(() => readStored(storageKey, cfg.rows));
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [toast, setToast] = useState("");
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(rows));
  }, [rows, storageKey]);
  const statusOptions = ["Todos", ...new Set(rows.map((row) => String(row[row.length - 1])))];
  const visibleRows = rows.filter((row) => row.join(" ").toLowerCase().includes(query.toLowerCase()) && (statusFilter === "Todos" || String(row[row.length - 1]) === statusFilter));
  const exportRows = () => {
    const csv = [cfg.columns, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(";")).join("\r\n");
    downloadFile(`${page}-${new Date().toISOString().slice(0, 10)}.csv`, `\uFEFF${csv}`);
    setToast("Arquivo CSV exportado.");
  };
  const saveRow = (values) => {
    if (editing?.index >= 0) setRows((current) => current.map((row, index) => index === editing.index ? values : row));
    else setRows((current) => [values, ...current]);
    setEditing(null);
    setToast(editing?.index >= 0 ? "Registro atualizado." : "Registro cadastrado.");
  };
  return (
    <div className="content-page">
      <div className="section-toolbar">
        <div className="title-icon"><Icon /><div><h2>{cfg.title}</h2><p>Gerencie informações e acompanhe a operação.</p></div></div>
        <button className="primary-button" onClick={cfg.button.includes("Exportar") ? exportRows : () => setEditing({ index: -1, row: cfg.columns.map((column, index) => index === cfg.columns.length - 1 ? "Ativo" : "") })}>{cfg.button.includes("Exportar") ? <Download size={17} /> : <Plus size={17} />}{cfg.button}</button>
      </div>
      <div className="filter-bar panel">
        <label><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Buscar em ${cfg.title.toLowerCase()}...`} /></label>
        <select className="secondary-button" aria-label="Filtrar por status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select>
        <button className="secondary-button" onClick={() => { setQuery(""); setStatusFilter("Todos"); setRows(readStored(storageKey, cfg.rows)); setToast("Dados recarregados."); }}><RefreshCw size={16} /> Atualizar</button>
      </div>
      <article className="panel data-table-panel">
        <div className="table-scroll">
          <table>
            <thead><tr>{cfg.columns.map(c => <th key={c}>{c}</th>)}<th>Ações</th></tr></thead>
            <tbody>{visibleRows.map((row) => {
              const sourceIndex = rows.indexOf(row);
              return <tr key={`${row[0]}-${sourceIndex}`}>{row.map((cell, j) => <td key={j}>{j === row.length - 1 ? <Status>{String(cell)}</Status> : cell}</td>)}<td><div className="row-actions"><button className="icon-button" aria-label={`Editar ${row[0]}`} onClick={() => setEditing({ index: sourceIndex, row })}><Pencil size={16} /></button><button className="icon-button danger-icon" aria-label={`Excluir ${row[0]}`} onClick={() => setDeleting({ index: sourceIndex, name: row[0] })}><Trash2 size={16} /></button></div></td></tr>;
            })}</tbody>
          </table>
        </div>
        <div className="pagination"><span>Exibindo {visibleRows.length} de {rows.length} registros</span><div><button disabled>Anterior</button><button className="active">1</button><button disabled>Próxima</button></div></div>
      </article>
      {editing && <GenericEditModal title={editing.index >= 0 ? `Editar ${cfg.title}` : cfg.button} columns={cfg.columns} initial={editing.row} onClose={() => setEditing(null)} onSave={saveRow} />}
      {deleting && <Modal title="Excluir registro" onClose={() => setDeleting(null)} footer={<><button className="secondary-button" onClick={() => setDeleting(null)}>Cancelar</button><button className="danger-button" onClick={() => { setRows((current) => current.filter((_, index) => index !== deleting.index)); setDeleting(null); setToast("Registro excluído."); }}>Excluir</button></>}><p>Confirma a exclusão de <strong>{deleting.name}</strong>? Esta ação afeta apenas os dados demonstrativos armazenados neste navegador.</p></Modal>}
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </div>
  );
}

function GenericEditModal({ title, columns, initial, onClose, onSave }) {
  const [values, setValues] = useState([...initial]);
  const valid = values.slice(0, -1).every((value) => String(value).trim());
  return <Modal title={title} onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={!valid} onClick={() => onSave(values)}><Save size={16} /> Salvar</button></>}>
    <div className="modal-grid">{columns.map((column, index) => <label className="modal-field" key={column}><span>{column}</span>{index === columns.length - 1 ? <select value={values[index]} onChange={(event) => setValues((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.value : value))}><option>Ativo</option><option>Inativo</option><option>Online</option><option>Offline</option><option>Aguardando</option><option>Em atendimento</option><option>Pendente</option><option>Solucionado</option><option>Aprovado</option><option>Em análise</option><option>Rascunho</option></select> : <input value={values[index]} onChange={(event) => setValues((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.value : value))} />}</label>)}</div>
  </Modal>;
}

function ReportsPage({ chartsOnly = false, currentUser }) {
  const [period, setPeriod] = useState("Este mês");
  const [metrics,setMetrics]=useState({totals:{all:0,solved:0},byDepartment:[],byHour:[],byOwner:[],averageResponseSeconds:0});
  const [toast,setToast]=useState("");
  useEffect(()=>{apiRequest("/api/metrics/reports").then(setMetrics).catch((error)=>setToast(error.message))},[currentUser?.id,period]);
  const solvedRate=metrics.totals.all?((metrics.totals.solved/metrics.totals.all)*100).toFixed(1):"0.0";
  const responseLabel=`${Math.floor(metrics.averageResponseSeconds/60)}m ${metrics.averageResponseSeconds%60}s`;
  return (
    <div className="content-page">
      <div className="section-toolbar">
        <div className="title-icon"><BarChart3 /><div><h2>{chartsOnly ? "Análise de desempenho" : "Relatório operacional"}</h2><p>Dados consolidados diretamente do banco operacional.</p></div></div>
        <div className="toolbar-actions"><select className="select-button" aria-label="Período do relatório" value={period} onChange={(event) => setPeriod(event.target.value)}><option>Hoje</option><option>Esta semana</option><option>Este mês</option></select><button className="primary-button" onClick={() => window.print()}><Download size={17} /> Imprimir relatório</button></div>
      </div>
      <section className="report-metrics">
        <div className="panel"><span>Total no período</span><strong>{metrics.totals.all}</strong><small>atendimentos no escopo</small></div>
        <div className="panel"><span>Taxa de solução</span><strong>{solvedRate}%</strong><small>{metrics.totals.solved} solucionados</small></div>
        <div className="panel"><span>Primeira resposta</span><strong>{responseLabel}</strong><small>média das conversas registradas</small></div>
        <div className="panel"><span>Contatos atendidos</span><strong>{metrics.totals.contacts||0}</strong><small>contatos únicos</small></div>
      </section>
      <section className="reports-grid">
        <article className="panel report-chart">
          <PanelHeader title="Volume de atendimentos" action="Diário" />
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={metrics.byHour}><CartesianGrid stroke="#262b31" vertical={false}/><XAxis dataKey="time" tick={{fill:"#8c949f",fontSize:11}}/><YAxis tick={{fill:"#8c949f",fontSize:11}}/><Tooltip contentStyle={{background:"#161b21",border:"1px solid #30363d"}}/><Area type="monotone" dataKey="value" stroke="#ed2f3b" fill="#ed2f3b33" strokeWidth={3}/></AreaChart>
          </ResponsiveContainer>
        </article>
        <article className="panel department-performance">
          <PanelHeader title="Desempenho por departamento" />
          {metrics.byDepartment.map((d, i) => {const color=departments.find((item)=>item.name===d.name)?.color||"#2875ed";const percent=metrics.totals.all?Math.round(d.value/metrics.totals.all*100):0;return <div key={d.name}><span><i style={{background:color}}/>{d.name}</span><div><b style={{width:`${percent}%`,background:color}}/></div><strong>{percent}%</strong></div>})}
        </article>
        <article className="panel heatmap-panel">
          <PanelHeader title="Horários de maior demanda" />
          <div className="heatmap">
            <div><span>Hoje</span>{metrics.byHour.filter((_,index)=>index%2===0).map((item)=><i key={item.time} title={`${item.time}: ${item.value}`} style={{opacity:.15+(item.value/(Math.max(...metrics.byHour.map((point)=>point.value),1))*.85)}}/>)}</div>
          </div>
          <div className="heatmap-scale"><span>Menor demanda</span><i/><i/><i/><i/><span>Maior demanda</span></div>
        </article>
        <article className="panel ranking-large">
          <PanelHeader title="Ranking de atendentes" action="Ver completo" />
          {metrics.byOwner.map((u,i)=><div key={`${u.name}-${i}`}><b>{i+1}</b><Avatar initials={u.name.split(" ").map((part)=>part[0]).slice(0,2).join("")}/><span><strong>{u.name}</strong><small>Responsável</small></span><em>{u.value} atendimentos</em><Status>Ativo</Status></div>)}
        </article>
      </section>
      {toast&&<Toast message={toast} tone="warning" onClose={()=>setToast("")}/>}
    </div>
  );
}

const permissionRows = [
  ["Visualizar conversas internas das quais participa", true, true, true, true, true],
  ["Iniciar conversas diretas", true, true, true, true, true],
  ["Criar grupos internos", true, true, true, true, false],
  ["Adicionar participantes", true, true, true, true, false],
  ["Acessar agenda compartilhada", true, true, true, true, true],
  ["Gerenciar usuarios e departamentos", true, false, false, false, false],
  ["Alterar configuracoes administrativas", true, false, false, false, false],
];

function PermissionsPage() {
  const roles=["Administrador","Gestor","Usuário"];
  const resources=navSections.flatMap((section)=>section.items.map(([id,label])=>({id,label})));
  const [permissions,setPermissions]=useState({});
  const [selectedRole, setSelectedRole] = useState("Administrador");
  const [toast, setToast] = useState("");
  useEffect(()=>{apiRequest("/api/permissions").then(setPermissions).catch((error)=>setToast(error.message))},[]);
  const toggle=(role,page)=>setPermissions((current)=>({...current,[role]:{...(current[role]||{}),pages:(current[role]?.pages||[]).includes(page)?current[role].pages.filter((item)=>item!==page):[...(current[role]?.pages||[]),page]}}));
  const save = async() => {
    try{const saved=await apiRequest("/api/permissions",{method:"PUT",body:JSON.stringify(permissions)});setPermissions(saved);setToast("Permissões persistidas e aplicadas pelo backend.")}catch(error){setToast(error.message)}
  };
  return (
    <div className="content-page">
      <div className="section-toolbar">
        <div className="title-icon"><ShieldCheck /><div><h2>Perfis e permissoes</h2><p>Controle o acesso sem expor conversas privadas fora dos participantes.</p></div></div>
        <button className="primary-button" onClick={save}><Save size={17}/> Salvar permissões</button>
      </div>
      <section className="role-cards">
        {roles.map((role,i)=><button key={role} onClick={() => setSelectedRole(role)} className={`panel ${selectedRole===role?"active":""}`}><span className={`role-icon role-${i}`}><ShieldCheck/></span><strong>{role}</strong><small>{permissions[role]?.pages?.length||0} recursos</small><ChevronRight/></button>)}
      </section>
      <article className="panel permissions-panel">
        <div className="permissions-heading"><div><h3>Matriz de permissões: {selectedRole}</h3><p>O backend usa esta matriz ao criar a sessão autenticada.</p></div><button className="primary-button" onClick={save}>Salvar alterações</button></div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Recurso</th>{roles.map(r=><th key={r}>{r}</th>)}</tr></thead>
            <tbody>{resources.map((resource)=><tr key={resource.id}><td>{resource.label}</td>{roles.map((role)=><td key={role}><label className="switch"><input type="checkbox" checked={(permissions[role]?.pages||[]).includes(resource.id)} disabled={role==="Administrador"} onChange={()=>toggle(role,resource.id)}/><span/></label></td>)}</tr>)}</tbody>
          </table>
        </div>
      </article>
      {toast && <Toast message={toast} tone={toast.includes("erro") ? "warning" : "success"} onClose={() => setToast("")} />}
    </div>
  );
}

function PersistentSessionsPanel() {
  const [rows,setRows]=useState([]);
  const [query,setQuery]=useState("");
  const [status,setStatus]=useState("Todos");
  const [toast,setToast]=useState("");
  const load=()=>apiRequest("/api/admin/persistent-sessions").then(setRows).catch((error)=>setToast(error.message));
  useEffect(()=>{load();},[]);
  const revoke=async(row)=>{
    if(!confirm(`Encerrar a sessão persistente de ${row.username}?`))return;
    try{const result=await apiRequest(`/api/admin/persistent-sessions/${row.id}/revoke`,{method:"POST",body:JSON.stringify({reason:"Revogação pelo painel administrativo"})});setToast(`${result.revoked} sessão encerrada.`);load()}catch(error){setToast(error.message)}
  };
  const revokeUser=async(row)=>{
    if(!confirm(`Encerrar todas as sessões persistentes de ${row.username}?`))return;
    try{const result=await apiRequest(`/api/admin/persistent-sessions/user/${row.userId}/revoke`,{method:"POST",body:JSON.stringify({reason:"Revogação por usuário pelo painel administrativo"})});setToast(`${result.revoked} sessões encerradas para ${row.username}.`);load()}catch(error){setToast(error.message)}
  };
  const revokeAll=async()=>{
    if(!confirm("Esta ação encerrará todas as sessões persistentes e exigirá novo login dos usuários. Deseja continuar?"))return;
    try{const result=await apiRequest("/api/admin/persistent-sessions/revoke-all",{method:"POST",body:JSON.stringify({reason:"Forçar novo login para todos pelo painel administrativo"})});setToast(`${result.revoked} sessões persistentes encerradas.`);load()}catch(error){setToast(error.message)}
  };
  const filtered=rows.filter((row)=>{
    const haystack=`${row.name} ${row.username} ${row.authProvider} ${row.deviceId} ${row.browser} ${row.os} ${row.ip} ${row.lastIp} ${row.status} ${row.revokedReason}`.toLowerCase();
    return (!query||haystack.includes(query.toLowerCase()))&&(status==="Todos"||row.status===status);
  });
  return <article className="panel profile-modern-card persistent-sessions-panel"><div className="settings-heading"><span className="large-setting-icon"><ShieldCheck/></span><div><h2>Sessões persistentes</h2><p>Tokens de manter conectado, sem exibir hashes ou cookies.</p></div></div><div className="filter-bar embedded-filter"><label><Search size={16}/><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Filtrar por usuário, dispositivo, IP..."/></label><select value={status} onChange={(event)=>setStatus(event.target.value)}><option>Todos</option><option>Ativa</option><option>Revogada</option><option>Expirada</option></select><button className="secondary-button" onClick={load}><RefreshCw size={15}/> Atualizar</button><button className="danger-button" onClick={revokeAll}>Forçar novo login de todos</button></div><div className="table-scroll"><table className="persistent-session-table"><thead><tr><th>Usuário</th><th>Dispositivo</th><th>IP</th><th>Criada</th><th>Último uso</th><th>Expira</th><th>Status</th><th>Ações</th></tr></thead><tbody>{filtered.map((row)=><tr key={row.id}><td><strong>{row.name}</strong><small>{row.username} · {row.authProvider}</small></td><td><strong>{row.browser}</strong><small>{row.os} · {row.deviceId}</small></td><td><strong>{row.ip||"-"}</strong><small>Último: {row.lastIp||"-"}</small></td><td>{formatDateTime(row.createdAt)}</td><td>{formatDateTime(row.lastUsedAt)}</td><td>{formatDateTime(row.expiresAt)}</td><td><Status>{row.status}</Status>{row.revokedReason&&<small>{row.revokedReason}</small>}</td><td><div className="row-actions"><button className="secondary-button compact-action" disabled={row.status!=="Ativa"} onClick={()=>revoke(row)}>Encerrar</button><button className="secondary-button compact-action" onClick={()=>revokeUser(row)}>Usuário</button></div></td></tr>)}</tbody></table></div>{!filtered.length&&<div className="empty-result">Nenhuma sessão persistente encontrada.</div>}{toast&&<Toast message={toast} tone={toast.includes("erro")? "warning":"success"} onClose={()=>setToast("")}/>}</article>;
}

function ProfileSettingsPage({ currentUser, theme, onThemeChange, onCurrentUserUpdated, onLogout, onOpenAgenda }) {
  const [form, setForm] = useState({
    displayName: currentUser.displayName || currentUser.name || "",
    phone: currentUser.phone || "",
    extension: currentUser.extension || "",
    jobTitle: currentUser.jobTitle || "",
    signature: currentUser.signature || "",
    status: currentUser.status || "Online",
    preferences: { ...(currentUser.preferences || {}), theme: theme || currentUser.preferences?.theme || "light" },
  });
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [outOfOffice, setOutOfOffice] = useState({
    enabled: false,
    startAt: toDateTimeLocalValue(currentUser.outOfOffice?.startAt),
    endAt: toDateTimeLocalValue(currentUser.outOfOffice?.endAt),
    message: currentUser.outOfOffice?.message || "",
    label: currentUser.outOfOffice?.label || "Desativado",
  });
  const [savingOutOfOffice, setSavingOutOfOffice] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(() => browserNotificationsAvailable() ? Notification.permission : "unsupported");
  const [pushStatus, setPushStatus] = useState("checking");
  const [pushDiagnostic, setPushDiagnostic] = useState(null);
  const [testingPush, setTestingPush] = useState(false);
  useEffect(() => {
    let active = true;
    apiRequest("/api/me/out-of-office").then((response) => {
      if (!active) return;
      const result = normalizeOutOfOfficeResponse(response);
      setOutOfOffice({
        enabled: result.enabled === true,
        startAt: toDateTimeLocalValue(result.startAt),
        endAt: toDateTimeLocalValue(result.endAt),
        message: result.message || "",
        label: result.label || "Desativado",
      });
    }).catch(() => {});
    return () => { active = false; };
  }, [currentUser.id]);
  useEffect(() => {
    let active = true;
    Promise.all([currentWebPushStatus(), webPushDiagnostics()]).then(([status, diagnostic]) => {
      if (!active) return;
      setPushStatus(status);
      setPushDiagnostic(diagnostic);
    }).catch(() => {
      if (active) setPushStatus("unsupported");
    });
    return () => { active = false; };
  }, [currentUser.id, notificationPermission]);
  const save = async () => {
    setSaving(true);
    try {
      const result = await apiRequest("/api/profile", { method: "PUT", body: JSON.stringify(form) });
      setForm({
        displayName: result.user.displayName || result.user.name || "",
        phone: result.user.phone || "",
        extension: result.user.extension || "",
        jobTitle: result.user.jobTitle || "",
        signature: result.user.signature || "",
        status: result.user.status || "Online",
        preferences: result.user.preferences || {},
      });
      if (result.user) onCurrentUserUpdated?.(result.user);
      setToast("Perfil atualizado.");
    } catch (error) {
      setToast(error.message);
    } finally {
      setSaving(false);
    }
  };
  const changeTheme = (value) => {
    setForm((current) => ({ ...current, preferences: { ...current.preferences, theme: value } }));
    onThemeChange?.(value);
  };
  const savePreferencePatch = async (patch, message = "Preferências salvas.") => {
    const nextPreferences = { ...form.preferences, ...patch };
    setForm((current) => ({ ...current, preferences: nextPreferences }));
    if (patch.theme) onThemeChange?.(patch.theme);
    try {
      const result = await apiRequest("/api/profile", { method: "PUT", body: JSON.stringify({ preferences: nextPreferences }) });
      if (result.user) {
        onCurrentUserUpdated?.(result.user);
        setForm((current) => ({ ...current, preferences: result.user.preferences || nextPreferences }));
      }
      setToast(message);
    } catch (error) {
      setToast(error.message);
    }
  };
  const requestNotifications = async () => {
    if (!webPushAvailable()) {
      setToast("Notificações push exigem HTTPS e suporte do navegador.");
      return;
    }
    try {
      await ensureWebPushSubscription();
      setNotificationPermission(Notification.permission);
      setPushStatus("subscribed");
      setPushDiagnostic(await webPushDiagnostics().catch(() => null));
      await savePreferencePatch({ browserNotifications: true, notifications: true }, "Notificações push ativadas para este dispositivo.");
    } catch (error) {
      setNotificationPermission(browserNotificationsAvailable() ? Notification.permission : "unsupported");
      setPushStatus(Notification.permission === "denied" ? "denied" : "default");
      await savePreferencePatch({ browserNotifications: false }, error.message || "Não foi possível ativar notificações push.");
    }
  };
  const notificationStatus = notificationPermission === "granted" ? "Ativadas no navegador" : notificationPermission === "denied" ? "Bloqueadas no navegador" : notificationPermission === "unsupported" ? "Indisponíveis neste acesso" : "Aguardando autorização";
  const pushStatusLabel = pushStatus === "subscribed" ? "Push em background ativado neste dispositivo"
    : pushStatus === "granted" ? "Permissão concedida, dispositivo ainda não inscrito"
    : pushStatus === "denied" ? "Bloqueadas no navegador"
    : pushStatus === "unsupported" ? "Indisponíveis neste acesso"
    : "Não configuradas neste dispositivo";
  const pushPermissionLabel = pushPermissionLabelFromValue(pushDiagnostic?.permission);
  const testPushNotification = async () => {
    setTestingPush(true);
    try {
      const result = await sendWebPushTestNotification();
      setNotificationPermission(Notification.permission);
      setPushStatus("subscribed");
      setPushDiagnostic(await webPushDiagnostics().catch(() => null));
      setToast(`Push real enviado para este dispositivo. Status ${result.statusCode || "OK"}.`);
    } catch (error) {
      setPushDiagnostic(await webPushDiagnostics().catch(() => null));
      setToast(error.message || "Não foi possível enviar o teste Web Push.");
    } finally {
      setTestingPush(false);
    }
  };
  const uploadProfilePhoto = async(file) => {
    if (!file) return;
    try {
      const updated = await uploadImage(`/api/uploads/users/${currentUser.id}/photo`, file);
      onCurrentUserUpdated?.(updated);
      setToast("Foto atualizada.");
    } catch (error) {
      setToast(error.message);
    }
  };
  const removeProfilePhoto = async() => {
    try {
      const updated = await apiRequest(`/api/uploads/users/${currentUser.id}/photo`, { method:"DELETE", body:"{}" });
      onCurrentUserUpdated?.(updated);
      setToast("Foto removida.");
    } catch (error) {
      setToast(error.message);
    }
  };
  const logoutEverywhere=async()=>{
    if(!confirm("Deseja sair de todos os dispositivos? Será necessário entrar novamente em todos os navegadores e computadores."))return;
    try{await apiRequest("/api/auth/logout-all-devices",{method:"POST",body:"{}"});alert("Todas as suas sessões foram encerradas.");onLogout?.()}catch(error){setToast(error.message)}
  };
  const saveOutOfOffice = async () => {
    if (outOfOffice.enabled) {
      if (!outOfOffice.startAt || !outOfOffice.endAt) return setToast("Informe início e retorno da ausência.");
      if (new Date(outOfOffice.endAt) <= new Date(outOfOffice.startAt)) return setToast("O retorno precisa ser posterior ao início.");
      if (!outOfOffice.message.trim()) return setToast("Informe a mensagem automática.");
      if (outOfOffice.message.trim().length > 1000) return setToast("A mensagem automática deve ter no máximo 1.000 caracteres.");
    }
    setSavingOutOfOffice(true);
    try {
      const response = await apiRequest("/api/me/out-of-office", {
        method: "PUT",
        body: JSON.stringify({
          enabled: outOfOffice.enabled,
          startAt: fromDateTimeLocalValue(outOfOffice.startAt),
          endAt: fromDateTimeLocalValue(outOfOffice.endAt),
          message: outOfOffice.message,
        }),
      });
      const result = normalizeOutOfOfficeResponse(response);
      setOutOfOffice({
        enabled: result.enabled === true,
        startAt: toDateTimeLocalValue(result.startAt),
        endAt: toDateTimeLocalValue(result.endAt),
        message: result.message || "",
        label: result.label || "Desativado",
      });
      onCurrentUserUpdated?.({ ...currentUser, outOfOffice: result });
      setToast("Fora da empresa salvo.");
    } catch (error) {
      setToast(error.message);
    } finally {
      setSavingOutOfOffice(false);
    }
  };
  const disableOutOfOffice = async () => {
      setSavingOutOfOffice(true);
    try {
      const response = await apiRequest("/api/me/out-of-office", { method: "DELETE", body: "{}" });
      const result = normalizeOutOfOfficeResponse(response);
      setOutOfOffice({ enabled: false, startAt: "", endAt: "", message: "", label: result.label || "Desativado" });
      onCurrentUserUpdated?.({ ...currentUser, outOfOffice: result });
      setToast("Fora da empresa desativado.");
    } catch (error) {
      setToast(error.message);
    } finally {
      setSavingOutOfOffice(false);
    }
  };
  return <div className="content-page profile-settings-page">
    <section className="panel profile-hero-card">
      <div className="profile-hero-main"><Avatar initials={currentUser.initials} src={currentUser.photoUrl} alt={currentUser.name} size="lg"/><div><h2>{form.displayName || currentUser.name}</h2><p>{form.jobTitle || currentUser.role}</p><span>{currentUser.department || currentUser.dept} · {form.status}</span></div></div>
      <div className="profile-hero-actions"><button className="secondary-button mobile-agenda-shortcut" type="button" onClick={onOpenAgenda}><CalendarDays size={16}/> Agenda</button><label className="secondary-button photo-upload-button"><Image size={16}/> Alterar foto<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event)=>{const file=event.target.files?.[0];event.target.value="";uploadProfilePhoto(file)}}/></label><button className="secondary-button" onClick={removeProfilePhoto}>Remover foto</button><button className="primary-button" disabled={saving} onClick={save}><Save size={16}/> {saving ? "Salvando..." : "Salvar alterações"}</button></div>
    </section>
    <section className="profile-modern-grid">
      <article className="panel profile-modern-card"><div className="settings-heading"><span className="large-setting-icon"><Users/></span><div><h2>Dados profissionais</h2><p>Informações exibidas no diretório corporativo.</p></div></div><div className="form-grid"><label><span>Nome de exibição</span><input value={form.displayName} onChange={(event)=>setForm({...form,displayName:event.target.value})}/></label><label><span>Cargo</span><input value={form.jobTitle} onChange={(event)=>setForm({...form,jobTitle:event.target.value})}/></label><label><span>Departamento</span><input value={currentUser.department || currentUser.dept || ""} disabled /></label><label><span>Status</span><select value={form.status} onChange={(event)=>setForm({...form,status:event.target.value})}><option>Online</option><option>Ocupado</option><option>Ausente</option><option>Offline</option></select></label><label className="full"><span>Assinatura</span><textarea value={form.signature} onChange={(event)=>setForm({...form,signature:event.target.value})}/></label></div></article>
      <article className="panel profile-modern-card"><div className="settings-heading"><span className="large-setting-icon"><Contact/></span><div><h2>Contato</h2><p>Canais usados no diretório interno.</p></div></div><div className="form-grid"><label><span>E-mail corporativo</span><input value={currentUser.email || ""} disabled /></label><label><span>Telefone</span><input value={form.phone} onChange={(event)=>setForm({...form,phone:event.target.value})}/></label><label><span>Ramal</span><input value={form.extension} onChange={(event)=>setForm({...form,extension:event.target.value})}/></label></div></article>
      <article className="panel profile-modern-card"><div className="settings-heading"><span className="large-setting-icon"><Bell/></span><div><h2>Preferências</h2><p>Tema, idioma e notificações.</p></div></div><div className="form-grid"><fieldset className="theme-choice"><legend>Tema</legend><label><input type="radio" name="profile-theme" value="light" checked={(form.preferences.theme || "light") === "light"} onChange={(event)=>changeTheme(event.target.value)}/> Claro</label><label><input type="radio" name="profile-theme" value="dark" checked={form.preferences.theme === "dark"} onChange={(event)=>changeTheme(event.target.value)}/> Escuro</label></fieldset><label><span>Idioma</span><select value={form.preferences.language || "pt-BR"} onChange={(event)=>setForm({...form,preferences:{...form.preferences,language:event.target.value}})}><option value="pt-BR">Português</option></select></label><fieldset className="message-font-size-choice"><legend>Tamanho da fonte das mensagens</legend>{MESSAGE_FONT_SIZE_OPTIONS.map((option)=><label key={option.value}><input type="radio" name="message-font-size" value={option.value} checked={(form.preferences.messageFontSize || "default") === option.value} onChange={(event)=>savePreferencePatch({messageFontSize:event.target.value})}/><span>{option.label}</span><small>{option.size}</small></label>)}</fieldset><label className="check-row"><input type="checkbox" checked={form.preferences.notifications !== false} onChange={(event)=>savePreferencePatch({notifications:event.target.checked})}/> Receber notificações internas</label></div><div className="notification-preferences"><div className="notification-permission"><div><strong>Notificações do navegador</strong><span>{notificationStatus}</span><small>{pushStatusLabel}</small></div><button className="secondary-button" type="button" onClick={requestNotifications} disabled={pushStatus === "subscribed"}><Bell size={15}/> {pushStatus === "subscribed" ? "Push ativado" : "Ativar notificações push"}</button><button className="secondary-button" type="button" onClick={testPushNotification} disabled={testingPush}><Bell size={15}/> {testingPush ? "Testando..." : "Testar notificação"}</button></div><div className="push-diagnostic-grid push-diagnostic-grid-wide"><span><strong>Push</strong><small>{pushStatus === "subscribed" ? "Ativo" : "Inativo"}</small></span><span><strong>Permissão</strong><small>{pushPermissionLabel}</small></span><span><strong>Subscription</strong><small>{pushDiagnostic?.subscription ? "Registrada" : "Não registrada"}</small></span><span><strong>Service Worker</strong><small>{pushDiagnostic?.serviceWorker ? "Ativo" : "Inativo"}</small></span><span><strong>Notificações</strong><small>{pushStatus === "subscribed" && notificationPermission === "granted" ? "Ativadas" : "Verificar"}</small></span><span><strong>Som do sistema</strong><small>Verificar Android</small></span><span><strong>Vibração</strong><small>{pushDiagnostic?.vibrationSupported ? "Suportada" : "Não detectada"}</small></span></div><small className="push-diagnostic-note">{pushDiagnostic?.displayMode || "Verificando dispositivo"} · O Web Push usa silent:false, renotify:true e vibração [200, 100, 200]. No Android, o som é o padrão do canal de notificações do PWA; se não tocar, verifique se o canal do Chat | Cipolatti não está marcado como silencioso nas configurações do aparelho.</small><Toggle label="Mostrar conteúdo da mensagem" description="Exibe remetente e prévia quando o navegador mostrar o aviso." checked={form.preferences.showNotificationContent !== false} onChange={(value)=>savePreferencePatch({showNotificationContent:value})}/><Toggle label="Som de nova mensagem" description="Toca um alerta discreto em intervalos controlados." checked={form.preferences.notificationSound === true} onChange={(value)=>savePreferencePatch({notificationSound:value})}/><Toggle label="Piscar/contador da janela" description="Mantém contador no título enquanto houver mensagens pendentes." checked={form.preferences.flashWindowTitle !== false} onChange={(value)=>savePreferencePatch({flashWindowTitle:value})}/><Toggle label="Notificações do Windows" description="Usa avisos nativos do navegador quando permitido." checked={form.preferences.browserNotifications !== false} onChange={(value)=>savePreferencePatch({browserNotifications:value})}/><Toggle label="Repetir alerta até leitura" description="Repete o banner e o aviso a cada 60 segundos enquanto a conversa não for aberta." checked={form.preferences.repeatAlertsUntilRead !== false} onChange={(value)=>savePreferencePatch({repeatAlertsUntilRead:value})}/><Toggle label="Não perturbe" description="Silencia banners, sons e avisos persistentes temporariamente." checked={form.preferences.doNotDisturb === true} onChange={(value)=>savePreferencePatch({doNotDisturb:value})}/><div className="quiet-hours-fields"><label><span>Horário silencioso início</span><input type="time" value={form.preferences.quietHoursStart || ""} onChange={(event)=>savePreferencePatch({quietHoursStart:event.target.value})}/></label><label><span>Horário silencioso fim</span><input type="time" value={form.preferences.quietHoursEnd || ""} onChange={(event)=>savePreferencePatch({quietHoursEnd:event.target.value})}/></label></div><Toggle label="Notificar mensagens individuais" description="Avisar novas conversas diretas quando esta aba estiver em segundo plano." checked={form.preferences.notifyDirectMessages !== false} onChange={(value)=>savePreferencePatch({notifyDirectMessages:value})}/><Toggle label="Notificar grupos" description="Avisar novas mensagens de grupos dos quais você participa." checked={form.preferences.notifyGroups !== false} onChange={(value)=>savePreferencePatch({notifyGroups:value})}/></div></article>
      <article className="panel profile-modern-card out-of-office-card"><div className="settings-heading"><span className="large-setting-icon"><Clock3/></span><div><h2>Fora da empresa</h2><p>Resposta automática para conversas privadas durante ausências programadas.</p></div></div><div className="out-of-office-status"><Status>{outOfOffice.label || "Desativado"}</Status></div><div className="form-grid"><label className="check-row full"><input type="checkbox" checked={outOfOffice.enabled} onChange={(event)=>setOutOfOffice({...outOfOffice,enabled:event.target.checked})}/> Ativar “Fora da empresa”</label><label><span>Data e hora de início</span><input type="datetime-local" value={outOfOffice.startAt} onChange={(event)=>setOutOfOffice({...outOfOffice,startAt:event.target.value})}/></label><label><span>Data e hora de retorno</span><input type="datetime-local" value={outOfOffice.endAt} onChange={(event)=>setOutOfOffice({...outOfOffice,endAt:event.target.value})}/></label><label className="full"><span>Mensagem automática</span><textarea maxLength={1000} value={outOfOffice.message} onChange={(event)=>setOutOfOffice({...outOfOffice,message:event.target.value})} placeholder="Olá! Estou fora da empresa e retornarei em breve. Em caso de urgência, entre em contato com meu departamento."/></label></div><div className="out-of-office-actions"><small>{outOfOffice.message.length}/1000 caracteres · respostas automáticas são enviadas uma vez por conversa a cada 24 horas.</small><div><button type="button" className="secondary-button" disabled={savingOutOfOffice} onClick={disableOutOfOffice}>Desativar agora</button><button type="button" className="primary-button" disabled={savingOutOfOffice} onClick={saveOutOfOffice}><Save size={16}/> {savingOutOfOffice ? "Salvando..." : "Salvar"}</button></div></div></article>
      <article className="panel profile-modern-card"><div className="settings-heading"><span className="large-setting-icon"><ShieldCheck/></span><div><h2>Segurança</h2><p>Acesso local e Active Directory.</p></div></div><div className="security-banner profile-security-banner"><ShieldCheck/><div><strong>Manter conectado</strong><span>Sessões persistentes usam token seguro, validação no AD e rotação automática.</span></div></div><div className="security-banner profile-security-banner muted"><KeyRound/><div><strong>Active Directory</strong><span>A senha é gerenciada pelo AD e nunca fica armazenada no CIPOLATTI CHAT.</span></div></div><button className="danger-button full-width-security-action" onClick={logoutEverywhere}>Sair de todos os dispositivos</button></article>
      <article className="panel profile-modern-card about-build-card"><div className="settings-heading"><span className="large-setting-icon"><MonitorUp/></span><div><h2>Sobre</h2><p>Versão instalada neste dispositivo.</p></div></div><div className="about-build-info"><span>Frontend</span><strong>{FRONTEND_BUILD_VERSION}</strong><small>Service worker: {pushDiagnostic?.serviceWorkerVersion || "verificando"} · {pushDiagnostic?.serviceWorkerState || "sem estado"} · {pushDiagnostic?.controlled ? "controlando a página" : "sem controle ativo"}</small><small>Scope: {pushDiagnostic?.serviceWorkerScope || "-"}</small><small>Atualização pendente: {pushDiagnostic?.updateAvailable ? "sim" : "não"}</small></div></article>
      {currentUser.role==="Administrador"&&<PersistentSessionsPanel/>}
    </section>
    {toast && <Toast message={toast} tone={toast.includes("erro") ? "warning" : "success"} onClose={()=>setToast("")}/>}
  </div>;
}

function PushActivationModal({ currentUser, mode = "invite", onClose, onCurrentUserUpdated }) {
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [diagnostic, setDiagnostic] = useState(null);
  const refreshDiagnostic = async () => {
    const result = await webPushDiagnostics().catch(() => null);
    setDiagnostic(result);
    return result;
  };
  useEffect(() => { refreshDiagnostic(); }, []);
  const persistNotificationPreference = async () => {
    const nextPreferences = { ...(currentUser.preferences || {}), notifications: true, browserNotifications: true };
    const result = await apiRequest("/api/profile", { method: "PUT", body: JSON.stringify({ preferences: nextPreferences }) });
    if (result.user) onCurrentUserUpdated?.(result.user);
  };
  const activatePush = async () => {
    setBusy(true);
    setMessage("");
    try {
      await ensureWebPushSubscription();
      await persistNotificationPreference();
      await refreshDiagnostic();
      setMessage("Notificações ativadas com sucesso.");
    } catch (error) {
      await refreshDiagnostic();
      setMessage(error.message || "Não foi possível ativar notificações neste dispositivo.");
    } finally {
      setBusy(false);
    }
  };
  const testPush = async () => {
    setTesting(true);
    setMessage("");
    try {
      const result = await sendWebPushTestNotification();
      await refreshDiagnostic();
      setMessage(`Push real enviado para este dispositivo. Status ${result.statusCode || "OK"}.`);
    } catch (error) {
      await refreshDiagnostic();
      setMessage(error.message || "Não foi possível enviar o teste Web Push.");
    } finally {
      setTesting(false);
    }
  };
  const permission = diagnostic?.permission || (browserNotificationsAvailable() ? Notification.permission : "unsupported");
  const isBlocked = mode === "blocked" || permission === "denied";
  const closeReason = isBlocked ? "blocked" : "later";
  return createPortal(
    <div className="modal-backdrop push-activation-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(closeReason); }}>
      <div className="modal push-activation-modal" role="dialog" aria-modal="true" aria-labelledby="push-activation-title">
        <header>
          <h2 id="push-activation-title">{isBlocked ? "NOTIFICAÇÕES BLOQUEADAS" : "ATIVAR NOTIFICAÇÕES"}</h2>
          <button className="icon-button" type="button" aria-label="Fechar" onClick={() => onClose?.(closeReason)}><X size={18}/></button>
        </header>
        <div className="modal-body">
          <div className="push-activation-hero"><Bell size={34}/></div>
          {isBlocked
            ? <p>Notificações estão bloqueadas neste dispositivo. Ative-as nas configurações do navegador/aplicativo para receber avisos de novas mensagens.</p>
            : <p>Receba um aviso quando novas mensagens chegarem, mesmo quando o Chat estiver minimizado ou você estiver usando outro aplicativo.</p>}
          <div className="push-diagnostic-grid push-activation-grid">
            <span><strong>Push</strong><small>{diagnostic?.subscription ? "Ativo" : "Inativo"}</small></span>
            <span><strong>Permissão</strong><small>{pushPermissionLabelFromValue(permission)}</small></span>
            <span><strong>Subscription</strong><small>{diagnostic?.subscription ? "Registrada" : "Não registrada"}</small></span>
            <span><strong>Service Worker</strong><small>{diagnostic?.serviceWorker ? "Ativo" : "Inativo"}</small></span>
          </div>
          <small className="push-diagnostic-note">{diagnostic?.displayMode || "Verificando dispositivo"} · No Android, confirme que o canal de notificações do PWA não está silencioso.</small>
          {message && <div className={`push-activation-result ${message.includes("sucesso") || message.includes("enviado") ? "success" : "warning"}`}>{message}</div>}
        </div>
        <footer>
          {isBlocked ? (
            <button type="button" className="secondary-button" onClick={() => onClose?.("blocked")}>Entendi</button>
          ) : (
            <>
              <button type="button" className="secondary-button" onClick={() => onClose?.("later")}>Agora não</button>
              <button type="button" className="primary-button" disabled={busy} onClick={activatePush}><Bell size={15}/> {busy ? "Ativando..." : "Ativar notificações"}</button>
            </>
          )}
          <button type="button" className="secondary-button" disabled={testing || isBlocked} onClick={testPush}>{testing ? "Testando..." : "Testar notificação"}</button>
        </footer>
      </div>
    </div>,
    document.body
  );
}

function SettingsPage({ integration = false, currentUser, theme, onThemeChange, onCurrentUserUpdated, onLogout, setPage }) {
  return <ProfileSettingsPage currentUser={currentUser} theme={theme} onThemeChange={onThemeChange} onCurrentUserUpdated={onCurrentUserUpdated} onLogout={onLogout} onOpenAgenda={() => setPage?.("agenda")}/>;
  if (integration) return <WhatsAppIntegrationPage currentUser={currentUser}/>;
  const [saved, setSaved] = useState(false);
  const [form,setForm]=useState({companyName:"",companyLogoUrl:"",companyDescription:"",officialWhatsappNumber:"",timezone:"America/Sao_Paulo",language:"pt-BR",dateFormat:"DD/MM/YYYY",agentIdentification:"{atendente} - Departamento {departamento}:",automaticRefresh:true,auditEnabled:true,preserveTransferHistory:true});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const tabs = [["Geral", Settings], ["Horários de atendimento", Clock3], ["Notificações", Bell], ["Triagem automática", Tags], ["Backup e retenção", Archive]];
  const [activeTab, setActiveTab] = useState(tabs[0][0]);
  const [toast, setToast] = useState("");
  const primaryTab = tabs[0][0];
  const loadSettings = () => {
    setLoading(true);
    apiRequest("/api/settings/general", { headers: apiUserHeaders(currentUser) })
      .then((settings) => setForm((current)=>({...current,...settings})))
      .catch((error) => setToast(error.message))
      .finally(() => setLoading(false));
  };
  useEffect(()=>{loadSettings();}, []);
  const saveSettings = async () => {
    setSaving(true);
    try {
      const settings = await apiRequest("/api/settings/general", {
        method: "PUT",
        headers: apiUserHeaders(currentUser),
        body: JSON.stringify(form),
      });
      setForm((current)=>({...current,...settings}));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (error) {
      setToast(error.message);
    } finally {
      setSaving(false);
    }
  };
  const uploadCompanyLogo = async(file) => {
    if (!file) return;
    setSaving(true);
    try {
      const settings = await uploadImage("/api/uploads/company/logo", file);
      setForm((current)=>({...current,...settings}));
      setToast("Logo interno da empresa atualizado.");
    } catch (error) {
      setToast(error.message);
    } finally {
      setSaving(false);
    }
  };
  const removeCompanyLogo = async() => {
    setSaving(true);
    try {
      const settings = await apiRequest("/api/uploads/company/logo", { method:"DELETE", body:"{}" });
      setForm((current)=>({...current,...settings}));
      setToast("Logo interno da empresa removido.");
    } catch (error) {
      setToast(error.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="content-page settings-page">
      <div className="settings-nav panel">
        {tabs.map(([label, Icon]) => <button key={label} className={activeTab === label ? "active" : ""} onClick={() => setActiveTab(label)}><Icon/> {label}</button>)}
      </div>
      <article className="panel settings-form">
        <div className="settings-heading">
          <span className="large-setting-icon"><Settings/></span>
          <div><h2>{activeTab}</h2><p>Preferências operacionais persistidas no servidor.</p></div>
        </div>
        {activeTab !== primaryTab ? <div className="empty-settings"><SlidersHorizontal size={36}/><h3>{activeTab}</h3><p>Esta área ainda depende da implementação do backend. Nenhum controle falso foi mantido nesta seção.</p></div> : (
          <div className="form-grid">
            <label><span>Nome da empresa</span><input value={form.companyName} disabled={loading || saving} onChange={(event) => setForm({...form,companyName:event.target.value})}/></label>
            <label><span>Número oficial WhatsApp</span><input value={form.officialWhatsappNumber||""} disabled={loading || saving} onChange={(event) => setForm({...form,officialWhatsappNumber:event.target.value})} placeholder="5511940163275"/></label>
            <label className="full"><span>Descrição curta da empresa</span><input value={form.companyDescription||""} disabled={loading || saving} onChange={(event) => setForm({...form,companyDescription:event.target.value})}/></label>
            <div className="profile-photo-editor full"><Avatar initials={(form.companyName||BRAND_NAME).split(" ").map((item)=>item[0]).slice(0,2).join("").toUpperCase()} src={form.companyLogoUrl} alt={form.companyName} size="lg"/><label className="secondary-button"><Image size={15}/> Logo/foto da empresa<input type="file" accept="image/jpeg,image/png,image/webp" disabled={loading || saving} onChange={(event)=>{const file=event.target.files?.[0];event.target.value="";uploadCompanyLogo(file)}}/></label>{form.companyLogoUrl&&<button className="secondary-button" disabled={saving} onClick={removeCompanyLogo}>Remover logo</button>}<span>Uso interno no sistema. A foto oficial vista pelo cliente deve ser configurada na Meta/WhatsApp Manager.</span></div>
            <label><span>Fuso horário</span><select value={form.timezone} onChange={(event)=>setForm({...form,timezone:event.target.value})}><option>America/Sao_Paulo</option></select></label>
            <label><span>Idioma do painel</span><select value={form.language} onChange={(event)=>setForm({...form,language:event.target.value})}><option value="pt-BR">Português (Brasil)</option></select></label>
            <label><span>Formato de data</span><select value={form.dateFormat} onChange={(event)=>setForm({...form,dateFormat:event.target.value})}><option>DD/MM/YYYY</option></select></label>
            <label className="full"><span>Mensagem de identificação do atendente</span><input value={form.agentIdentification} onChange={(event)=>setForm({...form,agentIdentification:event.target.value})}/></label>
            <div className="settings-toggles full">
              <Toggle label="Atualização automática das mensagens" description="Receber novas mensagens em tempo real." checked={form.automaticRefresh} onChange={(value)=>setForm({...form,automaticRefresh:value})}/>
              <Toggle label="Registrar ações na auditoria" description="Manter a trilha completa de alterações críticas." checked={form.auditEnabled} onChange={(value)=>setForm({...form,auditEnabled:value})}/>
              <Toggle label="Preservar histórico nas transferências" description="O novo departamento recebe toda a conversa e arquivos." checked={form.preserveTransferHistory} onChange={(value)=>setForm({...form,preserveTransferHistory:value})}/>
            </div>
          </div>
        )}
        <div className="form-footer">{saved && <span className="saved-message"><CheckCircle2 size={16}/> Alterações salvas</span>}<button className="secondary-button" disabled={saving} onClick={loadSettings}>Cancelar</button><button className="primary-button" disabled={activeTab !== primaryTab || loading || saving || form.companyName.trim().length < 2} onClick={saveSettings}>{saving ? "Salvando..." : "Salvar alterações"}</button></div>
      </article>
      {toast && <Toast message={toast} tone={toast.includes("indisponível") ? "warning" : "success"} onClose={() => setToast("")} />}
    </div>
  );
}

function WhatsAppIntegrationPage({ currentUser }) {
  const [config,setConfig]=useState({phoneNumberId:"",businessAccountId:"",graphVersion:"v25.0",publicBaseUrl:"",webhookUrl:"",configured:false,readyForMeta:false,checks:[],tokenConfigured:false,verifyTokenConfigured:false,appSecretConfigured:false});
  const [secrets,setSecrets]=useState({accessToken:"",verifyToken:"",appSecret:""});
  const [test,setTest]=useState({to:"",message:"Mensagem de teste da CIPOLATTI."});
  const [loading,setLoading]=useState(true);const [busy,setBusy]=useState("");const [toast,setToast]=useState("");
  const load=()=>{setLoading(true);apiRequest("/api/integrations/whatsapp",{headers:apiUserHeaders(currentUser)}).then(setConfig).catch((error)=>setToast(error.message)).finally(()=>setLoading(false))};
  useEffect(()=>{load();},[]);
  const headers=apiUserHeaders(currentUser);
  const save=async()=>{
    setBusy("save");
    try{const result=await apiRequest("/api/integrations/whatsapp",{method:"PUT",headers,body:JSON.stringify({...config,...secrets})});setConfig(result);setSecrets((value)=>({...value,accessToken:"",verifyToken:"",appSecret:""}));setToast("Configuração criptografada e salva no backend.");}
    catch(error){setToast(error.message)}finally{setBusy("")}
  };
  const testConnection=async()=>{setBusy("connection");try{const result=await apiRequest("/api/integrations/whatsapp/test",{method:"POST",headers,body:"{}"});setToast(`Conexão validada: ${result.verified_name||result.display_phone_number||"número confirmado"}.`)}catch(error){setToast(error.message)}finally{setBusy("")}};
  const validateWebhook=async()=>{setBusy("webhook");try{await apiRequest("/api/integrations/whatsapp/validate-webhook",{method:"POST",headers,body:"{}"});setToast("Webhook HTTPS validado de ponta a ponta.");load()}catch(error){setToast(error.message)}finally{setBusy("")}};
  const subscribeWaba=async()=>{setBusy("subscribe");try{await apiRequest("/api/integrations/whatsapp/subscribe",{method:"POST",headers,body:"{}"});setToast("Aplicativo vinculado ao WABA para recebimento de eventos.")}catch(error){setToast(error.message)}finally{setBusy("")}};
  const testMessage=async()=>{setBusy("message");try{await apiRequest("/api/integrations/whatsapp/test-message",{method:"POST",headers,body:JSON.stringify(test)});setToast("Mensagem de teste enviada pela Cloud API.")}catch(error){setToast(error.message)}finally{setBusy("")}};
  if(loading)return <div className="empty-settings"><RefreshCw className="spin"/><h3>Conectando ao backend</h3></div>;
  return <div className="content-page whatsapp-settings">
    <div className="section-toolbar"><div className="title-icon"><MessageCircle/><div><h2>WhatsApp Cloud API</h2><p>Integração oficial da Meta, sem QR Code ou WhatsApp Web.</p></div></div><Status>{config.readyForMeta?"Pronto para homologar":"Preparação pendente"}</Status></div>
    <section className="integration-status-grid"><article className="panel"><span>Backend</span><strong>Conectado</strong><small>API corporativa ativa</small></article><article className="panel"><span>Graph API</span><strong>{config.graphVersion}</strong><small>Versão oficial configurada</small></article><article className="panel"><span>Homologação</span><strong>{config.readyForMeta?"Pronta":"Pendente"}</strong><small>Token nunca retorna ao navegador</small></article></section>
    <article className="panel integration-readiness"><div className="settings-heading"><span className="large-setting-icon"><ShieldCheck/></span><div><h2>Prontidão para a Meta</h2><p>Todos os requisitos abaixo precisam estar confirmados antes de validar o webhook.</p></div></div><div className="readiness-list">{config.checks?.map((check)=><div key={check.id} className={check.ready?"ready":"pending"}>{check.ready?<CheckCircle2 size={17}/>:<Clock3 size={17}/>}<span>{check.label}</span><strong>{check.ready?"Pronto":"Pendente"}</strong></div>)}</div></article>
    <article className="panel integration-form-panel"><div className="settings-heading"><span className="large-setting-icon"><Webhook/></span><div><h2>Credenciais e webhook</h2><p>Os segredos são criptografados no backend com AES-256-GCM.</p></div></div>
      <div className="form-grid">
        <label><span>WhatsApp Business Account ID</span><input value={config.businessAccountId} onChange={(event)=>setConfig({...config,businessAccountId:event.target.value})}/></label>
        <label><span>Phone Number ID</span><input value={config.phoneNumberId} onChange={(event)=>setConfig({...config,phoneNumberId:event.target.value})}/></label>
        <label className="full"><span>Access Token {config.tokenConfigured&&"(já configurado)"}</span><input type="password" value={secrets.accessToken} onChange={(event)=>setSecrets({...secrets,accessToken:event.target.value})} placeholder={config.tokenConfigured?"Deixe em branco para manter o token atual":"Token permanente da Meta"}/></label>
        <label><span>Verify Token {config.verifyTokenConfigured&&"(já configurado)"}</span><input type="password" value={secrets.verifyToken} onChange={(event)=>setSecrets({...secrets,verifyToken:event.target.value})}/></label>
        <label><span>App Secret {config.appSecretConfigured&&"(já configurado)"}</span><input type="password" value={secrets.appSecret} onChange={(event)=>setSecrets({...secrets,appSecret:event.target.value})} placeholder="Usado para validar X-Hub-Signature-256"/></label>
        <label><span>Versão da Graph API</span><select value={config.graphVersion} onChange={(event)=>setConfig({...config,graphVersion:event.target.value})}><option>v25.0</option><option>v24.0</option></select></label>
        <label><span>URL pública do sistema</span><input value={config.publicBaseUrl} onChange={(event)=>setConfig({...config,publicBaseUrl:event.target.value,webhookUrl:`${event.target.value.replace(/\/+$/,"")}/webhooks/whatsapp`})} placeholder="https://api.suaempresa.com.br"/></label>
        <label className="full"><span>URL HTTPS exata do Webhook</span><div className="input-action"><input value={config.webhookUrl} onChange={(event)=>setConfig({...config,webhookUrl:event.target.value})} placeholder="https://api.suaempresa.com.br/webhooks/whatsapp"/><button onClick={()=>navigator.clipboard?.writeText(config.webhookUrl)}>Copiar</button></div></label>
      </div>
      <div className="form-footer"><button className="secondary-button" onClick={load}><RefreshCw size={16}/> Recarregar</button><button className="secondary-button" disabled={busy} onClick={validateWebhook}><Webhook size={16}/> {busy==="webhook"?"Validando...":"Validar URL HTTPS"}</button><button className="primary-button" disabled={busy} onClick={save}><Save size={16}/> {busy==="save"?"Salvando...":"Salvar no backend"}</button></div>
    </article>
    <div className="integration-actions">
      <article className="panel"><Webhook/><div><h3>Testar conexão e WABA</h3><p>Valida token, Phone Number ID e vínculo com a conta empresarial.</p></div><button className="secondary-button" disabled={busy} onClick={testConnection}>{busy==="connection"?"Testando...":"Testar conexão"}</button><button className="secondary-button" disabled={busy} onClick={subscribeWaba}>{busy==="subscribe"?"Vinculando...":"Vincular WABA"}</button></article>
      <article className="panel test-message-card"><Send/><div><h3>Enviar mensagem de teste</h3><p>Use um número com código do país, sem espaços.</p></div><input value={test.to} onChange={(event)=>setTest({...test,to:event.target.value})} placeholder="5511999999999"/><input value={test.message} onChange={(event)=>setTest({...test,message:event.target.value})}/><button className="primary-button" disabled={!test.to||busy} onClick={testMessage}>{busy==="message"?"Enviando...":"Enviar teste"}</button></article>
    </div>
    <div className="security-banner"><ShieldCheck/><div><strong>Segurança da integração</strong><span>Access Token e App Secret não são devolvidos ao frontend. O webhook valida assinatura quando o App Secret está configurado.</span></div></div>
    {toast&&<Toast message={toast} tone={toast.toLowerCase().includes("erro")||toast.toLowerCase().includes("inválid")?"warning":"success"} onClose={()=>setToast("")}/>}
  </div>;
}

function Toggle({label,description,defaultChecked,checked,onChange}) {
  return <label className="toggle-row"><div><strong>{label}</strong><span>{description}</span></div><span className="switch"><input type="checkbox" {...(checked===undefined?{defaultChecked}:{checked,onChange:(event)=>onChange?.(event.target.checked)})}/><span/></span></label>;
}

function AttendanceManagement({ currentUser }) {
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState({ search: "", owner: "Todos", department: "Todos", status: "Todos", situation: "Todos", date: "" });
  const refresh=()=>apiRequest("/api/whatsapp/conversations").then((items)=>setConversations(items.map(mapCloudConversation))).catch(()=>setConversations([]));
  useEffect(() => {refresh();const timer=setInterval(refresh,10000);return()=>clearInterval(timer)}, [currentUser?.id]);
  const isAdmin = currentUser.role === "Administrador";
  const isManager = currentUser.role === "Gestor" || currentUser.role === "Supervisor";
  const allowed = conversations.filter((conversation) => isAdmin || (isManager ? conversation.department === currentUser.dept : conversation.owner === currentUser.name || conversation.participants?.includes(currentUser.name)));
  const visible = allowed.filter((conversation) => {
    const haystack = `${conversation.id} ${conversation.name} ${conversation.owner} ${conversation.department} ${conversation.phone}`.toLowerCase();
    return haystack.includes(filters.search.toLowerCase())
      && (filters.owner === "Todos" || conversation.owner === filters.owner)
      && (filters.department === "Todos" || conversation.department === filters.department)
      && (filters.status === "Todos" || conversation.status === filters.status)
      && (filters.situation === "Todos" || (filters.situation === "Abertos" ? !conversation.ended : conversation.ended))
      && (!filters.date || (conversation.createdAt || "2026-06-20").slice(0, 10) === filters.date);
  });
  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  return <div className="management-page">
    <section className="management-summary">
      <div><span>Escopo do perfil</span><strong>{isAdmin ? "Todos os departamentos" : isManager ? currentUser.dept : "Somente meus atendimentos"}</strong></div>
      <div><span>Conversas visíveis</span><strong>{allowed.length}</strong></div>
      <div><span>Em andamento</span><strong>{allowed.filter((item) => !item.ended).length}</strong></div>
      <div><span>Transferidas</span><strong>{allowed.filter((item) => item.transferred).length}</strong></div>
    </section>
    <section className="panel management-panel">
      <div className="management-heading"><div><h2>Supervisão de atendimentos</h2><p>Dados persistidos das conversas, com acesso limitado pelo backend.</p></div><button className="secondary-button" onClick={refresh}><RefreshCw size={16}/> Atualizar</button></div>
      <div className="management-filters">
        <label className="wide"><span>Nome, cliente ou conversa</span><div><Search size={16}/><input value={filters.search} onChange={(event) => setFilter("search", event.target.value)} placeholder="Buscar por nome, telefone ou ID"/></div></label>
        <label><span>Colaborador</span><select value={filters.owner} onChange={(event) => setFilter("owner", event.target.value)}><option>Todos</option>{[...new Set(allowed.map((item)=>item.owner))].filter(Boolean).map((name) => <option key={name}>{name}</option>)}</select></label>
        <label><span>Departamento</span><select value={filters.department} onChange={(event) => setFilter("department", event.target.value)} disabled={!isAdmin}><option>Todos</option>{[...new Set(allowed.map((item)=>item.department))].filter(Boolean).map((name) => <option key={name}>{name}</option>)}</select></label>
        <label><span>Status</span><select value={filters.status} onChange={(event) => setFilter("status", event.target.value)}><option>Todos</option>{[...new Set(allowed.map((item) => item.status))].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>Situação</span><select value={filters.situation} onChange={(event) => setFilter("situation", event.target.value)}><option>Todos</option><option>Abertos</option><option>Encerrados</option></select></label>
        <label><span>Data</span><input type="date" value={filters.date} onChange={(event) => setFilter("date", event.target.value)}/></label>
      </div>
      <div className="table-scroll"><table className="management-table"><thead><tr><th>Conversa</th><th>Cliente</th><th>Colaborador</th><th>Departamento</th><th>Status</th><th>Data / hora</th><th></th></tr></thead><tbody>{visible.map((conversation) => <tr key={conversation.id} onClick={() => setSelected(conversation)}>
        <td>#{String(conversation.id).replace(/\D/g, "").slice(-6) || conversation.id}</td><td><strong>{conversation.name}</strong><small>{conversation.phone}</small></td><td>{conversation.owner}</td><td>{conversation.department}</td><td><Status>{conversation.status}</Status></td><td>{new Date(conversation.createdAt || "2026-06-20T09:00:00").toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</td><td><button className="icon-button" aria-label={`Ver histórico de ${conversation.name}`}><ChevronRight size={17}/></button></td>
      </tr>)}</tbody></table>{!visible.length && <div className="empty-result">Nenhuma conversa encontrada para este perfil e filtros.</div>}</div>
    </section>
    {selected && <Modal title={`Histórico completo - ${selected.name}`} onClose={() => setSelected(null)} footer={<button className="secondary-button" onClick={() => setSelected(null)}>Fechar</button>}>
      <div className="history-overview"><span><b>Responsável</b>{selected.owner}</span><span><b>Departamento</b>{selected.department}</span><span><b>Status</b>{selected.status}</span><span><b>Participantes</b>{selected.participants?.join(", ")}</span></div>
      <div className="history-messages">{selected.messages.map((message, index) => <div key={index} className={message.type === "system" ? "history-system" : `history-message ${message.side}`}><strong>{message.type === "system" ? "Sistema" : message.sender}</strong><p>{message.text}</p><time>{message.time}</time></div>)}</div>
    </Modal>}
  </div>;
}

function InternalHub({ currentUser }) {
  const [tab, setTab] = useState("messages");
  return <div className="internal-hub">
    <div className="internal-tabs"><button className={tab === "messages" ? "active" : ""} onClick={() => setTab("messages")}><MessageCircle size={17}/> Mensagens</button><button className={tab === "meetings" ? "active" : ""} onClick={() => setTab("meetings")}><Video size={17}/> Reuniões</button></div>
    <div className="internal-content">{tab === "messages" ? <ChatPage internal currentUser={currentUser}/> : <MeetingsPage currentUser={currentUser}/>}</div>
  </div>;
}

function MeetingsPage({ currentUser }) {
  const [meetings, setMeetings] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [meetingDepartments, setMeetingDepartments] = useState([]);
  const [modal, setModal] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [chatText, setChatText] = useState("");
  const [toast, setToast] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [meetingHistory, setMeetingHistory] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyMeta, setHistoryMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [stream, setStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [remoteScreenStream, setRemoteScreenStream] = useState(null);
  const [remoteSharer, setRemoteSharer] = useState(null);
  const [meetingPeers, setMeetingPeers] = useState([]);
  const [signalStatus, setSignalStatus] = useState("Desconectado");
  const [signalNonce, setSignalNonce] = useState(0);
  const [micStream, setMicStream] = useState(null);
  const [activeMicIds, setActiveMicIds] = useState([]);
  const [speakingIds, setSpeakingIds] = useState([]);
  const [recording, setRecording] = useState(null);
  const videoRef = useRef(null);
  const screenRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const micStreamRef = useRef(null);
  const wsRef = useRef(null);
  const peersRef = useRef(new Map());
  const roomPeersRef = useRef([]);
  const activeShareRef = useRef(null);
  const activeMicIdsRef = useRef(new Set());
  const remoteAudioRef = useRef(new Map());
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const [meetingRows, userRows, departmentRows] = await Promise.all([
          apiRequest("/api/meetings"),
          apiRequest("/api/collaborators"),
          apiRequest("/api/departments"),
        ]);
        if (!active) return;
        setMeetings(meetingRows);
        setDirectory(userRows);
        setMeetingDepartments(departmentRows);
        if (activeId && !meetingRows.some((meeting) => meeting.id === activeId)) setActiveId(null);
      } catch (error) {
        if (active) setToast(error.message);
      }
    };
    refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [currentUser.id]);
  useEffect(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, [stream, activeId]);
  useEffect(() => { if (screenRef.current) screenRef.current.srcObject = remoteScreenStream || screenStream; }, [remoteScreenStream, screenStream, activeId]);
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    stopScreenShare(false);
    closeAllPeers();
  }, []);
  const scoped = meetings.filter((meeting) => {
    if (currentUser.role === "Administrador") return true;
    if (currentUser.role === "Gestor" || currentUser.role === "Supervisor") return meeting.department === currentUser.dept;
    return meeting.owner === currentUser.name || meeting.participants.includes(currentUser.name);
  });
  const active = meetings.find((meeting) => meeting.id === activeId);
  const replaceMeeting = (updated) => setMeetings((items) => items.map((item) => item.id === updated.id ? updated : item));
  const loadMeetingHistory = async (page = historyPage) => {
    const result = await apiRequest(`/api/meetings?status=closed&page=${page}&pageSize=20`);
    setMeetingHistory(Array.isArray(result.items) ? result.items : []);
    setHistoryMeta({
      page: result.page || page,
      pageSize: result.pageSize || 20,
      total: result.total || 0,
      totalPages: result.totalPages || 1,
    });
  };
  useEffect(() => {
    if (!showHistory) return undefined;
    let active = true;
    apiRequest(`/api/meetings?status=closed&page=${historyPage}&pageSize=20`)
      .then((result) => {
        if (!active) return;
        setMeetingHistory(Array.isArray(result.items) ? result.items : []);
        setHistoryMeta({
          page: result.page || historyPage,
          pageSize: result.pageSize || 20,
          total: result.total || 0,
          totalPages: result.totalPages || 1,
        });
      })
      .catch((error) => active && setToast(error.message));
    return () => { active = false; };
  }, [showHistory, historyPage, currentUser.id]);
  const enterMeeting = async (meeting) => {
    try {
      const updated = await apiRequest(`/api/meetings/${meeting.id}/start`, { method: "POST", body: "{}" });
      replaceMeeting(updated);
      setActiveId(updated.id);
    } catch (error) {
      setToast(error.message);
    }
  };
  const signalingUrl = (meetingId) => {
    const target = new URL(apiUrl(`/api/meetings/${meetingId}/signaling`), window.location.origin);
    target.protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return target.toString();
  };
  const sendSignal = (payload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(payload));
  };
  const closePeer = (peerId) => {
    const entry = peersRef.current.get(peerId);
    if (!entry) return;
    entry.pc.ontrack = null;
    entry.pc.onicecandidate = null;
    entry.pc.close();
    peersRef.current.delete(peerId);
    const audio = remoteAudioRef.current.get(peerId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      remoteAudioRef.current.delete(peerId);
    }
  };
  const closeAllPeers = () => {
    for (const peerId of [...peersRef.current.keys()]) closePeer(peerId);
    setRemoteScreenStream(null);
    setRemoteSharer(null);
  };
  const createPeer = async (peerId, offerer = false) => {
    closePeer(peerId);
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    peersRef.current.set(peerId, { pc });
    pc.onicecandidate = (event) => {
      if (event.candidate) sendSignal({ type: "signal", to: peerId, signal: { type: "candidate", candidate: event.candidate } });
    };
    pc.ontrack = (event) => {
      const incoming = event.streams?.[0] || new MediaStream([event.track]);
      const peer = roomPeersRef.current.find((item) => item.id === peerId) || activeShareRef.current?.peer || { name: "Participante" };
      if (event.track.kind === "audio") {
        let audio = remoteAudioRef.current.get(peerId);
        if (!audio) {
          audio = new Audio();
          audio.autoplay = true;
          audio.playsInline = true;
          remoteAudioRef.current.set(peerId, audio);
        }
        audio.srcObject = incoming;
        audio.play().catch(() => setToast(`Clique na reunião para liberar o áudio de ${peer.name}.`));
        setSpeakingIds((ids) => [...new Set([...ids, peerId])]);
        window.setTimeout(() => setSpeakingIds((ids) => ids.filter((id) => id !== peerId)), 2500);
      } else {
        setRemoteScreenStream(incoming);
        setRemoteSharer(peer);
        setSignalStatus(`${peer.name} está compartilhando a tela.`);
      }
    };
    const handleConnectionDrop = () => {
      sendSignal({ type: "peer-status", status: "reconnecting", detail: `Conexão WebRTC com ${peerId} em renegociação.` });
      setSignalStatus("Reconectando mídia da reunião...");
      if (screenStreamRef.current || micStreamRef.current) {
        window.setTimeout(() => createPeer(peerId, true).catch(() => setSignalStatus("Falha ao reconectar mídia.")), 1200);
      } else if (activeShareRef.current?.peer?.id === peerId || activeMicIdsRef.current.has(peerId)) {
        window.setTimeout(() => createPeer(peerId, false).catch(() => setSignalStatus("Falha ao reconectar visualização.")), 1200);
      }
    };
    pc.oniceconnectionstatechange = () => {
      if (["failed", "disconnected"].includes(pc.iceConnectionState)) handleConnectionDrop();
    };
    pc.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
        handleConnectionDrop();
        if (activeShareRef.current?.peer?.id === peerId) {
          setRemoteScreenStream(null);
          setRemoteSharer(null);
        }
      }
    };
    if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, screenStreamRef.current));
    if (micStreamRef.current) micStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, micStreamRef.current));
    if (offerer) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal({ type: "signal", to: peerId, signal: pc.localDescription });
    }
    return pc;
  };
  const handleSignal = async (from, signal) => {
    try {
      let entry = peersRef.current.get(from);
      if (!entry) {
        const pc = await createPeer(from, false);
        entry = { pc };
        peersRef.current.set(from, entry);
      }
      const pc = entry.pc;
      if (signal.type === "offer") {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal({ type: "signal", to: from, signal: pc.localDescription });
      } else if (signal.type === "answer") {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
      } else if (signal.type === "candidate" && signal.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    } catch {
      setToast("Falha ao sincronizar o compartilhamento de tela.");
    }
  };
  useEffect(() => {
    if (!active) return undefined;
    let closed = false;
    const ws = new WebSocket(signalingUrl(active.id));
    wsRef.current = ws;
    setSignalStatus("Conectando sala em tempo real...");
    ws.onopen = () => setSignalStatus("Sala em tempo real conectada.");
    ws.onerror = () => setSignalStatus("Falha na conexão em tempo real.");
    ws.onclose = () => {
      if (!closed) {
        setSignalStatus("Sala em tempo real desconectada. Reconectando...");
        window.setTimeout(() => setSignalNonce((value) => value + 1), 1500);
      }
      if (wsRef.current === ws) wsRef.current = null;
      closeAllPeers();
    };
    ws.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "meeting-presence") {
        roomPeersRef.current = message.peers || [];
        setMeetingPeers(message.peers || []);
        activeShareRef.current = message.activeShare || null;
        activeMicIdsRef.current = new Set((message.activeMics || []).map((item) => item.peer?.id).filter(Boolean));
        setActiveMicIds([...activeMicIdsRef.current]);
        if (message.activeShare?.peer?.id && message.activeShare.peer.id !== currentUser.id) {
          setRemoteSharer(message.activeShare.peer);
          setSignalStatus(`${message.activeShare.peer.name} está compartilhando. Conectando visualização...`);
        }
      } else if (message.type === "peer-joined" || message.type === "peer-left") {
        roomPeersRef.current = message.peers || [];
        setMeetingPeers(message.peers || []);
        if (message.type === "peer-joined" && screenStreamRef.current && message.peer?.id !== currentUser.id) await createPeer(message.peer.id, true);
        if (message.type === "peer-joined" && micStreamRef.current && message.peer?.id !== currentUser.id) await createPeer(message.peer.id, true);
        if (message.type === "peer-left") closePeer(message.peerId);
      } else if (message.type === "screen-share-started") {
        activeShareRef.current = message.share;
        if (message.share?.peer?.id !== currentUser.id) {
          setRemoteSharer(message.share.peer);
          setSignalStatus(`${message.share.peer.name} iniciou compartilhamento de tela.`);
        }
      } else if (message.type === "screen-share-stopped") {
        if (activeShareRef.current?.peer?.id === message.peerId) activeShareRef.current = null;
        if (remoteSharer?.id === message.peerId) {
          setRemoteScreenStream(null);
          setRemoteSharer(null);
          setSignalStatus("Compartilhamento encerrado.");
        }
        closePeer(message.peerId);
      } else if (message.type === "mic-started") {
        activeMicIdsRef.current.add(message.peer.id);
        setActiveMicIds([...activeMicIdsRef.current]);
        if (message.peer?.id !== currentUser.id) setSignalStatus(`${message.peer.name} ativou o microfone.`);
      } else if (message.type === "mic-stopped") {
        activeMicIdsRef.current.delete(message.peerId);
        setActiveMicIds([...activeMicIdsRef.current]);
        const audio = remoteAudioRef.current.get(message.peerId);
        if (audio) {
          audio.pause();
          audio.srcObject = null;
          remoteAudioRef.current.delete(message.peerId);
        }
      } else if (message.type === "peer-status") {
        if (message.status === "reconnecting") setSignalStatus(`${message.peer?.name || "Participante"} está reconectando mídia.`);
      } else if (message.type === "signal") {
        await handleSignal(message.from, message.signal);
      } else if (message.type === "error") {
        setToast(message.error || "Erro na sala em tempo real.");
      }
    };
    return () => {
      closed = true;
      if (wsRef.current === ws) wsRef.current = null;
      ws.close();
      stopScreenShare(false);
      disableMeetingMic(false);
      closeAllPeers();
      setMeetingPeers([]);
      setSignalStatus("Desconectado");
    };
  }, [active?.id, currentUser.id, signalNonce]);
  const openMedia = async () => {
    try { const media = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = media; setStream(media); }
    catch { setToast("Não foi possível acessar câmera e microfone. Verifique a permissão do navegador."); }
  };
  const enableMeetingMic = async () => {
    try {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return setToast("A sala em tempo real ainda não está conectada.");
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current?.getTracks().forEach((track) => track.stop());
      micStreamRef.current = media;
      setMicStream(media);
      activeMicIdsRef.current.add(currentUser.id);
      setActiveMicIds([...activeMicIdsRef.current]);
      sendSignal({ type: "mic-start" });
      setSignalStatus("Seu microfone está ativo.");
      for (const peer of roomPeersRef.current) if (peer.id !== currentUser.id) await createPeer(peer.id, true);
    } catch {
      setToast("Permissão de microfone negada ou indisponível.");
    }
  };
  const disableMeetingMic = (announce = true) => {
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
    setMicStream(null);
    activeMicIdsRef.current.delete(currentUser.id);
    setActiveMicIds([...activeMicIdsRef.current]);
    if (announce) sendSignal({ type: "mic-stop" });
    if (screenStreamRef.current) {
      for (const peer of roomPeersRef.current) if (peer.id !== currentUser.id) createPeer(peer.id, true).catch(() => {});
    } else {
      for (const peerId of [...peersRef.current.keys()]) closePeer(peerId);
    }
    if (announce) setSignalStatus("Microfone silenciado.");
  };
  async function shareScreen() {
    try {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return setToast("A sala em tempo real ainda não está conectada.");
      const media = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      stopScreenShare(false);
      screenStreamRef.current = media;
      setScreenStream(media);
      setRemoteScreenStream(null);
      setRemoteSharer(null);
      sendSignal({ type: "screen-start" });
      setSignalStatus("Você está compartilhando a tela.");
      media.getVideoTracks()[0].addEventListener("ended", () => stopScreenShare(true), { once: true });
      for (const peer of roomPeersRef.current) if (peer.id !== currentUser.id) await createPeer(peer.id, true);
    } catch {
      setToast("Compartilhamento de tela cancelado ou não autorizado pelo navegador.");
    }
  }
  function stopScreenShare(announce = true) {
    if (recording) stopRecording();
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;
    setScreenStream(null);
    for (const peerId of [...peersRef.current.keys()]) closePeer(peerId);
    if (announce) sendSignal({ type: "screen-stop" });
    if (announce) setSignalStatus("Compartilhamento encerrado.");
  };
  const startRecording = () => {
    const source = screenStream || stream;
    if (!source || !window.MediaRecorder) return setToast("Ative câmera ou compartilhamento antes de gravar.");
    chunksRef.current = [];
    const recorder = new MediaRecorder(source);
    recorder.ondataavailable = (event) => event.data.size && chunksRef.current.push(event.data);
    recorder.onstop = () => downloadFile(`reuniao-${active.id}.webm`, new Blob(chunksRef.current, { type: "video/webm" }), "video/webm");
    recorder.start();
    setRecording(recorder);
  };
  const stopRecording = () => { recording?.stop(); setRecording(null); };
  const endMeeting = async () => {
    stream?.getTracks().forEach((track) => track.stop()); stopScreenShare(true); disableMeetingMic(true);
    try {
      const updated = await apiRequest(`/api/meetings/${active.id}/close`, { method: "POST", body: "{}" });
      setMeetings((items) => items.filter((item) => item.id !== updated.id));
      if (showHistory) loadMeetingHistory(1).catch((error) => setToast(error.message));
      streamRef.current = null; screenStreamRef.current = null; setStream(null); setScreenStream(null); setActiveId(null); setToast("Reunião encerrada e histórico salvo.");
    } catch (error) {
      setToast(error.message);
    }
  };
  const displayStream = remoteScreenStream || screenStream;
  const activeParticipants = meetingPeers.length ? meetingPeers : (active?.participantUsers || []).length ? active.participantUsers : (active?.participants || []).map((name) => ({ id: name, name }));
  if (active) return <div className="meeting-room">
    <header><div><h2>{active.title}</h2><p>{active.department} · Responsável: {active.owner}</p></div><button className="danger-button" onClick={endMeeting}>Encerrar reunião</button></header>
    <div className="meeting-stage">
      <div className="video-stage">{displayStream ? <div className="screen-share-view"><video ref={screenRef} autoPlay playsInline muted={Boolean(screenStream)}/><div className="screen-share-badge"><MonitorUp size={15}/><span>{remoteSharer ? `${remoteSharer.name} está compartilhando` : "Você está compartilhando"}</span></div></div> : stream ? <video ref={videoRef} autoPlay playsInline muted/> : <div className="camera-placeholder"><Video size={46}/><strong>Nenhum compartilhamento ativo</strong><span>Ative câmera ou aguarde alguém compartilhar a tela.</span></div>}</div>
      <aside><h3>Participantes ({activeParticipants.length})</h3>{activeParticipants.map((user) => { const micOn=activeMicIds.includes(user.id); const speaking=speakingIds.includes(user.id); const label=user.id === active.ownerId || user.name === active.owner ? "Responsável" : user.id === remoteSharer?.id ? "Compartilhando tela" : speaking ? "Falando" : micOn ? "Microfone ativo" : "Participante"; return <div className={`meeting-person ${speaking ? "speaking" : ""}`} key={user.id || user.name}><Avatar initials={user.initials || "CP"} src={user.photoUrl} alt={user.name} size="sm"/><span>{user.name}<small>{label}</small></span>{micOn&&<Mic size={13}/>}</div>; })}<h3>Chat da reunião</h3><div className="meeting-chat">{active.chat.map((message, index) => <div key={message.id || index}><strong>{message.sender}</strong><p>{message.text}</p></div>)}</div><form onSubmit={async(event) => { event.preventDefault(); if (!chatText.trim()) return; try { const updated = await apiRequest(`/api/meetings/${active.id}/messages`, { method: "POST", body: JSON.stringify({ text: chatText.trim() }) }); replaceMeeting(updated); setChatText(""); } catch (error) { setToast(error.message); } }}><input value={chatText} onChange={(event) => setChatText(event.target.value)} placeholder="Mensagem para a reunião"/><button className="icon-button"><Send size={16}/></button></form></aside>
    </div>
    <div className="meeting-controls"><button onClick={openMedia}><Video/> Câmera</button><button className={micStream ? "recording" : ""} onClick={micStream ? () => disableMeetingMic(true) : enableMeetingMic}>{micStream ? <StopCircle/> : <Mic/>}{micStream ? "Silenciar" : "Ativar microfone"}</button><button className={screenStream ? "recording" : ""} onClick={screenStream ? () => stopScreenShare(true) : shareScreen}><MonitorUp/> {screenStream ? "Parar compartilhamento" : "Compartilhar tela"}</button><button className={recording ? "recording" : ""} onClick={recording ? stopRecording : startRecording}>{recording ? <StopCircle/> : <Mic/>}{recording ? "Parar gravação" : "Gravar local"}</button></div>
    <div className="realtime-notice">{signalStatus} O conteúdo da tela trafega por WebRTC entre participantes autorizados; o backend registra apenas eventos técnicos.</div>
    {toast && <Toast message={toast} tone="warning" onClose={() => setToast("")}/>}
  </div>;
  const toggleHistory = () => {
    setShowHistory((value) => !value);
    if (!showHistory) setHistoryPage(1);
  };
  return <div className="meetings-page">
    <div className="meetings-toolbar"><div><h2>{showHistory ? "Histórico de reuniões" : "Reuniões internas"}</h2><p>{showHistory ? "Reuniões encerradas preservadas com paginação e permissões." : "Agenda, participantes e histórico conforme o seu perfil e departamento."}</p></div><div className="meeting-toolbar-actions"><button className="secondary-button" onClick={toggleHistory}><History size={17}/> {showHistory ? "Ver agenda ativa" : "Reuniões encerradas"}</button><button className="primary-button" onClick={() => setModal(true)}><CalendarDays size={17}/> Agendar reunião</button></div></div>
    {showHistory ? <>
      <section className="meeting-list">{meetingHistory.map((meeting) => <article className="panel meeting-card meeting-card-history" key={meeting.id}><div className="meeting-date"><strong>{meeting.date?.split("-").reverse().join("/") || "-"}</strong><span>{meeting.time || "-"}</span></div><div className="meeting-info"><Status>{meeting.status}</Status><h3>{meeting.title}</h3><p>{meeting.department} · {meeting.participants.length} participantes · Responsável: {meeting.owner}</p><small>Encerrada em: {meeting.endedAt ? new Date(meeting.endedAt).toLocaleString("pt-BR") : "-"}{meeting.closedBy ? ` · Por: ${meeting.closedBy}` : ""}</small>{meeting.duration && <small>Duração: {meeting.duration}</small>}</div><button className="secondary-button" disabled><History size={16}/> Histórico</button></article>)}</section>
      {!meetingHistory.length && <div className="empty-result">Nenhuma reunião encerrada disponível para este perfil.</div>}
      <div className="pagination meeting-history-pagination"><span>{historyMeta.total} reuniões encerradas</span><div><button disabled={historyMeta.page <= 1} onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}>Anterior</button><button className="active">Página {historyMeta.page} de {historyMeta.totalPages}</button><button disabled={historyMeta.page >= historyMeta.totalPages} onClick={() => setHistoryPage((page) => page + 1)}>Próxima</button></div></div>
    </> : <>
      <section className="meeting-list">{scoped.map((meeting) => <article className="panel meeting-card" key={meeting.id}><div className="meeting-date"><strong>{meeting.date.split("-").reverse().join("/")}</strong><span>{meeting.time}</span></div><div className="meeting-info"><Status>{meeting.status}</Status><h3>{meeting.title}</h3><p>{meeting.department} · {meeting.participants.length} participantes · Responsável: {meeting.owner}</p>{meeting.duration && <small>Duração: {meeting.duration}</small>}</div><button className="secondary-button" disabled={meeting.status === "Encerrada"} onClick={() => enterMeeting(meeting)}><Video size={16}/> {meeting.status === "Agendada" ? "Iniciar" : "Entrar"}</button></article>)}</section>
      {!scoped.length && <div className="empty-result">Nenhuma reunião disponível para este perfil.</div>}
    </>}
    {modal && <MeetingModal currentUser={currentUser} directory={directory} departmentRows={meetingDepartments} onClose={() => setModal(false)} onConfirm={async(meeting) => { try { const created = await apiRequest("/api/meetings", { method: "POST", body: JSON.stringify(meeting) }); setMeetings((items) => [created, ...items]); setModal(false); setToast("Reunião agendada e convite registrado."); } catch (error) { setToast(error.message); } }}/>}
    {toast && <Toast message={toast} onClose={() => setToast("")}/>}
  </div>;
}

function MeetingModal({ currentUser, directory = [], departmentRows = [], onClose, onConfirm }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ title: "", date: today, time: "09:00", department: currentUser.dept, participantIds: [currentUser.id] });
  const toggle = (id) => setForm((current) => ({ ...current, participantIds: current.participantIds.includes(id) ? current.participantIds.filter((item) => item !== id) : [...current.participantIds, id] }));
  return <Modal title="Agendar reunião interna" onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={!form.title.trim()} onClick={() => onConfirm(form)}>Agendar e convidar</button></>}>
    <div className="modal-grid"><label className="modal-field full"><span>Título</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })}/></label><label className="modal-field"><span>Data</span><input type="date" min={today} value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })}/></label><label className="modal-field"><span>Horário</span><input type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })}/></label><label className="modal-field full"><span>Departamento</span><select value={form.department} disabled={currentUser.role !== "Administrador"} onChange={(event) => setForm({ ...form, department: event.target.value, participantIds: [currentUser.id] })}>{departmentRows.map((item) => <option key={item.name}>{item.name}</option>)}</select></label></div>
    <div className="participant-picker"><span>Convidar participantes</span>{directory.filter((user) => currentUser.role === "Administrador" ? user.dept === form.department || user.id === currentUser.id : user.dept === form.department).map((user) => <label key={user.id}><input type="checkbox" checked={form.participantIds.includes(user.id)} disabled={user.id === currentUser.id} onChange={() => toggle(user.id)}/><Avatar initials={user.initials} size="xs" src={user.photoUrl} alt={user.name}/><span><strong>{user.name}</strong><small>{user.role} · {user.dept}</small></span></label>)}</div>
  </Modal>;
}

function LoginScreen({ onAuthenticated, initialMessage = "" }) {
  const [mode,setMode]=useState("login");
  const [identifier,setIdentifier]=useState("");
  const [password,setPassword]=useState("");
  const [remember,setRemember]=useState(false);
  const [showPassword,setShowPassword]=useState(false);
  const [message,setMessage]=useState(initialMessage);
  const [loading,setLoading]=useState(false);
  useEffect(() => { setMessage(initialMessage); }, [initialMessage]);
  const notice = normalizeLoginNotice(message);
  const submit=async(event)=>{
    event.preventDefault(); setMessage(""); setLoading(true);
    try {
      const result = await apiRequest("/api/auth/login", {
        method: "POST",
        timeoutMs: LOGIN_API_TIMEOUT_MS,
        body: JSON.stringify({ identifier: cleanLogin(identifier), password, rememberMe: Boolean(remember) }),
      });
      onAuthenticated(result.user);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };
  const recover=async(event)=>{
    event.preventDefault();
    setMessage("Se o acesso existir, as instruções serão enviadas pelo canal configurado. Nesta instalação local, o envio depende do backend.");
  };
  return <div className="login-screen"><div className="login-brand"><BrandIdentity/><div><strong>{BRAND_SUBTITLE}</strong><span>Acesso protegido por perfil e departamento</span></div></div><main className="login-panel"><div className="login-product"><BrandIdentity/><p>{BRAND_SUBTITLE}</p></div><div className="login-heading"><span><LockKeyhole/></span><div><h1>{mode==="login"?"Acessar sistema":"Recuperar acesso"}</h1><p>{mode==="login"?"Informe suas credenciais para continuar.":"Informe seu usuário cadastrado."}</p></div></div><form onSubmit={mode==="login"?submit:recover}><label><span>Usuário</span><input value={identifier} placeholder="Digite seu usuário" onChange={(event)=>setIdentifier(event.target.value)} autoComplete="username" autoFocus/></label>{mode==="login"&&<label><span>Senha</span><div className="password-input"><input type={showPassword?"text":"password"} value={password} onChange={(event)=>setPassword(event.target.value)} autoComplete="current-password"/><button type="button" onClick={()=>setShowPassword((value)=>!value)} title={showPassword?"Ocultar senha":"Mostrar senha"}>{showPassword?<EyeOff/>:<Eye/>}</button></div></label>}{mode==="login"&&<label className="remember-login"><input type="checkbox" checked={remember} onChange={(event)=>setRemember(event.target.checked)}/><span>Manter conectado</span></label>}{notice&&<div className={`login-message ${notice.body.includes("instruções")?"info":""}`} data-code={notice.code||undefined}>{notice.title&&<strong>{notice.title}</strong>}<span>{notice.body}</span></div>}<button className="primary-button login-submit" disabled={loading||!identifier||(mode==="login"&&!password)}>{loading?"Validando...":mode==="login"?"Entrar":"Solicitar recuperação"}</button><button type="button" className="login-link" onClick={()=>{setMode(mode==="login"?"recover":"login");setMessage("");}}>{mode==="login"?"Esqueci minha senha":"Voltar para o login"}</button></form><div className="login-security"><ShieldCheck/><span>Sessão com expiração e bloqueio de acesso inativo.</span></div></main></div>;
}

function ChangePasswordScreen({ account, onChanged, onLogout }) {
  const [currentPassword,setCurrentPassword]=useState("");const [password,setPassword]=useState("");const [confirm,setConfirm]=useState("");const [message,setMessage]=useState("");
  const save=async(event)=>{
    event.preventDefault();if(password.length<8||password!==confirm){setMessage("A senha deve ter 8 caracteres ou mais e as confirmações precisam ser iguais.");return}
    try {
      await apiRequest("/api/auth/change-password", { method:"POST", body:JSON.stringify({currentPassword,newPassword:password}) });
      setMessage("Senha alterada. Entre novamente.");
      setTimeout(onLogout, 800);
    } catch (error) { setMessage(error.message); }
  };
  return <div className="login-screen"><main className="login-panel password-change"><div className="login-heading"><span><KeyRound/></span><div><h1>Crie uma nova senha</h1><p>Este acesso utiliza uma senha temporária e precisa ser atualizado.</p></div></div><form onSubmit={save}>{!account.mustChangePassword&&<label><span>Senha atual</span><input type="password" value={currentPassword} onChange={(event)=>setCurrentPassword(event.target.value)}/></label>}<label><span>Nova senha</span><input type="password" value={password} onChange={(event)=>setPassword(event.target.value)}/></label><label><span>Confirmar nova senha</span><input type="password" value={confirm} onChange={(event)=>setConfirm(event.target.value)}/></label>{message&&<div className="login-message">{message}</div>}<button className="primary-button login-submit">Atualizar senha</button><button type="button" className="login-link" onClick={onLogout}>Cancelar e sair</button></form></main></div>;
}

function PresenceKeeper({ currentUser }) {
  useEffect(() => {
    if (!currentUser?.id) return undefined;
    let socket = null;
    let reconnectTimer = 0;
    let heartbeatTimer = 0;
    let closed = false;
    let lastActivitySent = 0;
    const sendPresence = (type) => {
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type, at: Date.now() }));
    };
    const sendActivity = () => {
      const now = Date.now();
      if (now - lastActivitySent < 10_000) return;
      lastActivitySent = now;
      sendPresence("presence:activity");
    };
    const connect = () => {
      if (closed) return;
      window.clearTimeout(reconnectTimer);
      window.clearInterval(heartbeatTimer);
      socket = new WebSocket(websocketApiUrl("/api/presence"));
      socket.onopen = () => {
        sendPresence("presence:activity");
        window.clearInterval(heartbeatTimer);
        heartbeatTimer = window.setInterval(() => sendPresence("presence:heartbeat"), 30_000);
      };
      socket.onclose = () => {
        window.clearInterval(heartbeatTimer);
        if (!closed) reconnectTimer = window.setTimeout(connect, 5000);
      };
      socket.onerror = () => socket?.close();
    };
    const ensurePresenceConnected = () => {
      if (document.hidden) return;
      if (socket?.readyState === WebSocket.OPEN) {
        sendPresence("presence:activity");
        return;
      }
      window.clearTimeout(reconnectTimer);
      connect();
    };
    connect();
    const activityEvents = ["pointerdown", "keydown", "touchstart", "focus"];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, sendActivity, { passive: true }));
    document.addEventListener("visibilitychange", sendActivity);
    document.addEventListener("visibilitychange", ensurePresenceConnected);
    window.addEventListener("pageshow", ensurePresenceConnected);
    window.addEventListener("online", ensurePresenceConnected);
    return () => {
      closed = true;
      window.clearTimeout(reconnectTimer);
      window.clearInterval(heartbeatTimer);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, sendActivity));
      document.removeEventListener("visibilitychange", sendActivity);
      document.removeEventListener("visibilitychange", ensurePresenceConnected);
      window.removeEventListener("pageshow", ensurePresenceConnected);
      window.removeEventListener("online", ensurePresenceConnected);
      socket?.close();
    };
  }, [currentUser?.id]);
  return null;
}

function App() {
  const [page, setPage] = useState("conversas");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authReady,setAuthReady]=useState(false);
  const [currentUser,setCurrentUser]=useState(null);
  const [theme, setTheme] = useState("light");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [authNotice,setAuthNotice]=useState("");
  const [serviceWorkerUpdate, setServiceWorkerUpdate] = useState(null);
  const [pushActivationPrompt, setPushActivationPrompt] = useState(null);
  const authRefreshPromiseRef = useRef(null);
  useEffect(() => {
    console.info(`CIPOLATTI frontend build: ${FRONTEND_BUILD_VERSION}`);
  }, []);
  useEffect(() => {
    return monitorServiceWorkerUpdates({
      onUpdateReady: setServiceWorkerUpdate,
      canAutoApply: () => !window.__cipolattiHasPendingChatWork?.(),
    });
  }, []);
  const applyServiceWorkerUpdate = () => {
    const worker = serviceWorkerUpdate?.waiting;
    if (!worker) return setServiceWorkerUpdate(null);
    worker.postMessage({ type: "CIPOLATTI_SKIP_WAITING" });
  };
  useEffect(() => {
    if (!serviceWorkerUpdate) return undefined;
    const timer = window.setInterval(() => {
      if (!window.__cipolattiHasPendingChatWork?.()) applyServiceWorkerUpdate();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [serviceWorkerUpdate]);
  const openConversationFromPush = (detail = {}) => {
    const conversationId = detail.conversationId || "";
    if (!conversationId) return;
    if (detail.messageId) {
      sessionStorage.setItem("cipolatti-open-message-id", detail.messageId);
      sessionStorage.setItem("cipolatti-open-message-target", JSON.stringify({ conversationId, messageId: detail.messageId }));
    }
    sessionStorage.setItem("cipolatti-open-conversation-id", conversationId);
    setPage(detail.groupId || detail.isGroup || detail.group ? "grupos" : "conversas");
    window.dispatchEvent(new CustomEvent("cipolatti-open-conversation", { detail: { id: conversationId, messageId: detail.messageId || "" } }));
    if (detail.notificationId) apiRequest(`/api/notifications/${detail.notificationId}/read`, { method: "POST", body: "{}" }).catch(() => {});
    else apiRequest(`/api/internal/conversations/${conversationId}/read`, { method: "POST", body: "{}" }).catch(() => {});
  };
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return undefined;
    const onMessage = (event) => {
      if (event.data?.type === "cipolatti-open-push") openConversationFromPush(event.data);
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);
  const handleSessionExpired = (error) => {
    setAuthNotice(authNoticeFromError(error));
    setCurrentUser(null);
    setPage("conversas");
  };
  const refreshCurrentSession = () => {
    if (authRefreshPromiseRef.current) return authRefreshPromiseRef.current;
    authRefreshPromiseRef.current = apiRequest("/api/auth/me").then((result) => {
      setAuthNotice("");
      setCurrentUser(result.user);
      return result.user;
    }).catch((error) => {
      handleSessionExpired(error);
      throw error;
    }).finally(() => {
      authRefreshPromiseRef.current = null;
    });
    return authRefreshPromiseRef.current;
  };
  useEffect(()=>{refreshCurrentSession().catch(()=>{}).finally(()=>setAuthReady(true));},[]);
  useEffect(() => {
    if(!currentUser)return;
    const savedTheme = currentUser.preferences?.theme || localStorage.getItem(`kalion-theme-${currentUser.email}`) || "light";
    setTheme(savedTheme === "dark" ? "dark" : "light");
    const savedSidebar = localStorage.getItem(`cipolatti-sidebar-collapsed-${currentUser.email || currentUser.username || currentUser.id}`);
    setSidebarCollapsed(savedSidebar === null ? true : savedSidebar !== "false");
    migrateLegacyBrowserStorage(currentUser).catch(() => {});
  }, [currentUser]);
  useEffect(() => {
    if (!currentUser || !webPushAvailable() || Notification.permission !== "granted") return;
    const preferences = currentUser.preferences || {};
    if (preferences.notifications === false || preferences.browserNotifications === false) return;
    ensureWebPushSubscription().catch(() => {});
  }, [currentUser?.id, currentUser?.preferences?.notifications, currentUser?.preferences?.browserNotifications]);
  useEffect(() => {
    if (!currentUser || !webPushAvailable()) return undefined;
    let active = true;
    const keyBase = currentUser.email || currentUser.username || currentUser.id;
    const inviteKey = `cipolatti-push-invite-snooze-${keyBase}`;
    const blockedKey = `cipolatti-push-blocked-snooze-${keyBase}`;
    const run = async () => {
      const status = await currentWebPushStatus().catch(() => "unsupported");
      if (!active || status === "unsupported" || status === "subscribed") return;
      const now = Date.now();
      if (status === "denied") {
        const blockedUntil = Number(localStorage.getItem(blockedKey) || 0);
        if (now >= blockedUntil) setPushActivationPrompt({ mode: "blocked", inviteKey, blockedKey });
        return;
      }
      const snoozedUntil = Number(localStorage.getItem(inviteKey) || 0);
      if (now < snoozedUntil) return;
      setPushActivationPrompt({ mode: "invite", inviteKey, blockedKey });
    };
    const timer = window.setTimeout(run, 1500);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [currentUser?.id]);
  useEffect(() => {
    if (!currentUser) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("source") !== "push" || !params.get("conversationId")) return;
    const detail = {
      conversationId: params.get("conversationId") || "",
      messageId: params.get("messageId") || "",
      notificationId: params.get("notificationId") || "",
      group: params.get("group") === "1",
    };
    openConversationFromPush(detail);
    window.history.replaceState({}, document.title, window.location.pathname);
  }, [currentUser?.id]);
  useEffect(() => {if(currentUser)localStorage.setItem(`kalion-theme-${currentUser.email}`, theme)}, [theme, currentUser]);
  useEffect(() => {
    if (!currentUser) return;
    localStorage.setItem(`cipolatti-sidebar-collapsed-${currentUser.email || currentUser.username || currentUser.id}`, sidebarCollapsed ? "true" : "false");
  }, [sidebarCollapsed, currentUser]);
  const updateTheme = async (value) => {
    const nextTheme = value === "dark" ? "dark" : "light";
    setTheme(nextTheme);
    if (currentUser) localStorage.setItem(`kalion-theme-${currentUser.email}`, nextTheme);
    if (!currentUser) return;
    const nextPreferences = { ...(currentUser.preferences || {}), theme: nextTheme };
    setCurrentUser((user) => user ? { ...user, preferences: nextPreferences } : user);
    try {
      const result = await apiRequest("/api/profile", {
        method: "PUT",
        body: JSON.stringify({ preferences: nextPreferences }),
      });
      if (result.user) setCurrentUser(result.user);
    } catch (error) {
      console.warn("Nao foi possivel salvar o tema do usuario.", error);
    }
  };
  const authenticate=(account)=>{setAuthNotice("");setCurrentUser(account);setPage("conversas")};
  const logout=async()=>{await removeWebPushSubscription().catch(()=>{});await apiRequest("/api/auth/logout",{method:"POST",body:"{}"}).catch(()=>{});setAuthNotice("");setCurrentUser(null);setPage("conversas")};
  const closePushActivationPrompt = (reason) => {
    if (reason === "blocked" && pushActivationPrompt?.blockedKey) localStorage.setItem(pushActivationPrompt.blockedKey, String(Date.now() + PUSH_BLOCKED_NOTICE_SNOOZE_MS));
    if (reason === "later" && pushActivationPrompt?.inviteKey) localStorage.setItem(pushActivationPrompt.inviteKey, String(Date.now() + PUSH_PROMPT_SNOOZE_MS));
    setPushActivationPrompt(null);
  };
  useEffect(()=>{if(currentUser&&!canAccessPage(currentUser,page))setPage("conversas")},[currentUser,page]);
  const content = useMemo(() => {
    if(!currentUser)return null;
    if (page === "conversas") return <ChatPage key="internal-chat" internal currentUser={currentUser}/>;
    if (page === "grupos") return <ChatPage key="internal-groups" internal groupOnly currentUser={currentUser}/>;
    if (page === "agenda") return <MeetingsPage currentUser={currentUser}/>;
    if (page === "departamentos") return <DepartmentsPage setPage={setPage} currentUser={currentUser}/>;
    if (page === "usuarios") return <CollaboratorsPage setPage={setPage} currentUser={currentUser} onCurrentUserUpdated={authenticate}/>;
    if (page === "configuracoes") return <SettingsPage key="settings" currentUser={currentUser} theme={theme} onThemeChange={updateTheme} onCurrentUserUpdated={setCurrentUser} onLogout={logout} setPage={setPage} />;
    return <GenericPage key={page} page={page} />;
  }, [page, currentUser, theme]);

  if(!authReady)return <div className="auth-loading"><BrandIdentity/><span>Preparando acesso seguro...</span></div>;
  if(!currentUser)return <LoginScreen onAuthenticated={authenticate} initialMessage={authNotice}/>;
  if(currentUser.mustChangePassword)return <ChangePasswordScreen account={currentUser} onChanged={authenticate} onLogout={logout}/>;
  const messageFontSize = MESSAGE_FONT_SIZE_OPTIONS.some((option) => option.value === currentUser.preferences?.messageFontSize)
    ? currentUser.preferences.messageFontSize
    : "default";
  return (
    <div className="app-shell" data-theme={theme} data-message-font-size={messageFontSize}>
      <PresenceKeeper currentUser={currentUser} />
      {serviceWorkerUpdate && <div className="pwa-update-banner" role="status" aria-live="polite"><div><strong>Nova versão disponível</strong><span>O Chat | Cipolatti foi atualizado.</span></div><button type="button" className="primary-button" onClick={applyServiceWorkerUpdate}>Atualizar agora</button><button type="button" className="icon-button" aria-label="Ocultar atualização" onClick={() => setServiceWorkerUpdate(null)}><X size={16}/></button></div>}
      {pushActivationPrompt && <PushActivationModal currentUser={currentUser} mode={pushActivationPrompt.mode} onClose={closePushActivationPrompt} onCurrentUserUpdated={setCurrentUser}/>}
      <Sidebar page={page} setPage={setPage} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} currentUser={currentUser} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      <div className="app-main">
        <Topbar page={page} setPage={setPage} setMobileOpen={setMobileOpen} currentUser={currentUser} theme={theme} setTheme={updateTheme} onLogout={logout} onCurrentUserUpdated={setCurrentUser} />
        <div className={`page-content page-${page}`}><ErrorBoundary resetKey={`${page}-${currentUser.id}`} onReset={()=>setPage("conversas")}>{content}</ErrorBoundary></div>
      </div>
    </div>
  );
}

export default App;

