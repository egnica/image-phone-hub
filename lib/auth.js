import crypto from "node:crypto";

const COOKIE_NAME = "media_hub_session";
const SESSION_AGE_SECONDS = 60 * 60 * 24 * 30;

function getPassword() {
  return process.env.MEDIA_HUB_PASSWORD || "";
}

function makeToken() {
  const password = getPassword();
  if (!password) return "";
  return crypto
    .createHmac("sha256", password)
    .update("image-phone-hub-session-v1")
    .digest("hex");
}

function safeEqual(left, right) {
  const a = Buffer.from(left || "");
  const b = Buffer.from(right || "");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index === -1) return [part, ""];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

export function authConfigured() {
  return Boolean(getPassword());
}

export function verifyPassword(candidate) {
  const password = getPassword();
  return Boolean(password) && safeEqual(candidate, password);
}

export function isAuthenticated(request) {
  const expected = makeToken();
  if (!expected) return false;
  const cookies = parseCookies(request.headers.get("cookie") || "");
  return safeEqual(cookies[COOKIE_NAME], expected);
}

export function sessionCookie() {
  return `${COOKIE_NAME}=${encodeURIComponent(makeToken())}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_AGE_SECONDS}`;
}

export function clearedSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
