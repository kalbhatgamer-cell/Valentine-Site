import crypto from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from './firebase-admin.js';

const secret = String(process.env.BIND_TOKEN_SECRET || '');
if (secret.length < 32) {
  throw new Error('BIND_TOKEN_SECRET must be at least 32 characters long.');
}

export const REQUEST_TTL_MS = 5 * 60 * 1000;
export const APPROVED_TTL_MS = 2 * 60 * 1000;

export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.end(JSON.stringify(body));
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  if (!chunks.length) return {};
  const text = Buffer.concat(chunks).toString('utf8');
  if (text.length > 64_000) throw Object.assign(new Error('Request body too large.'), { statusCode: 413 });
  try { return JSON.parse(text); }
  catch { throw Object.assign(new Error('Invalid JSON body.'), { statusCode: 400 }); }
}

export function requirePost(req) {
  if (req.method !== 'POST') throw Object.assign(new Error('Method not allowed.'), { statusCode: 405 });
}

export function cleanText(value, max = 120) {
  return String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max);
}

export function normalizeUsername(value) {
  return cleanText(value, 64).replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9._-]/g, '');
}

export function normalizeDeviceId(value) {
  const id = cleanText(value, 128);
  if (!/^[A-Za-z0-9_-]{12,128}$/.test(id)) throw Object.assign(new Error('Invalid device identifier.'), { statusCode: 400 });
  return id;
}

export function sanitizeDevice(raw = {}) {
  return {
    deviceId: normalizeDeviceId(raw.deviceId),
    name: cleanText(raw.name || 'Browser device', 80),
    platform: cleanText(raw.platform || 'Unknown platform', 80),
    browser: cleanText(raw.browser || 'Browser', 80),
    userAgent: cleanText(raw.userAgent || '', 350),
    language: cleanText(raw.language || '', 24),
    timezone: cleanText(raw.timezone || '', 64)
  };
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function hmac(value) {
  return crypto.createHmac('sha256', secret).update(String(value)).digest('hex');
}

export function safeEqualHex(a, b) {
  try {
    const aa = Buffer.from(String(a), 'hex');
    const bb = Buffer.from(String(b), 'hex');
    return aa.length === bb.length && aa.length > 0 && crypto.timingSafeEqual(aa, bb);
  } catch { return false; }
}

function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  if (typeof value === 'number') return value;
  return 0;
}

export function requestSignature(data) {
  const canonical = [
    data.requestId || '', data.method || '', data.status || '', data.deviceId || '',
    data.pollSecretHash || '', data.codeHash || '', data.targetUid || '', data.approvedByUid || '',
    String(timestampMillis(data.createdAt)), String(timestampMillis(data.expiresAt)),
    String(timestampMillis(data.approvedAt)), String(timestampMillis(data.completedAt))
  ].join('|');
  return hmac(`request|${canonical}`);
}

export function withSignature(data) {
  const next = { ...data };
  next.serverSignature = requestSignature(next);
  return next;
}

export function verifyRequestIntegrity(data) {
  return !!data && safeEqualHex(data.serverSignature, requestSignature(data));
}

export function isExpired(data, now = Date.now()) {
  return timestampMillis(data?.expiresAt) <= now;
}

export function requestIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || String(req.socket?.remoteAddress || 'unknown');
}

export async function enforceRateLimit(key, limit, windowMs) {
  const ref = adminDb.collection('deviceBindRateLimits').doc(hmac(`rate|${key}`));
  const now = Date.now();
  await adminDb.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const old = snap.exists ? snap.data() : null;
    const start = old?.windowStart?.toMillis?.() || 0;
    const inWindow = now - start < windowMs;
    const count = inWindow ? Number(old?.count || 0) : 0;
    if (count >= limit) throw Object.assign(new Error('Too many attempts. Please wait and try again.'), { statusCode: 429 });
    tx.set(ref, {
      count: count + 1,
      windowStart: Timestamp.fromMillis(inWindow ? start : now),
      updatedAt: Timestamp.fromMillis(now),
      expiresAt: Timestamp.fromMillis(now + windowMs * 2)
    }, { merge: true });
  });
}

export async function verifyUser(req, { requireLinkedActive = true } = {}) {
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) throw Object.assign(new Error('Authentication required.'), { statusCode: 401 });
  const token = header.slice(7).trim();
  let decoded;
  try { decoded = await adminAuth.verifyIdToken(token, true); }
  catch { throw Object.assign(new Error('Invalid or expired login session.'), { statusCode: 401 }); }

  if (requireLinkedActive && decoded.kalbLinked === true) {
    const deviceId = cleanText(decoded.kalbDeviceId, 128);
    if (!deviceId) throw Object.assign(new Error('Linked device session is invalid.'), { statusCode: 401 });
    const snap = await adminDb.collection('users').doc(decoded.uid).collection('linkedDevices').doc(deviceId).get();
    if (!snap.exists || snap.data()?.active !== true) {
      throw Object.assign(new Error('This linked device was removed.'), { statusCode: 401, code: 'DEVICE_REVOKED' });
    }
  }
  return decoded;
}

export function publicOrigin(req) {
  const proto = cleanText(String(req.headers['x-forwarded-proto'] || 'https').split(',')[0], 10) || 'https';
  const host = cleanText(req.headers['x-forwarded-host'] || req.headers.host || '', 200);
  return host ? `${proto}://${host}` : '';
}

export function serializeTimestamp(value) {
  const ms = timestampMillis(value);
  return ms ? new Date(ms).toISOString() : null;
}

export function parseQrPayload(value) {
  const raw = cleanText(value, 1000);
  let token = raw;
  try {
    const u = new URL(raw);
    token = u.searchParams.get('kalbBind') || u.searchParams.get('token') || raw;
  } catch {
    const match = raw.match(/(?:kalbBind=|token=)([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/);
    if (match) token = match[1];
  }
  token = decodeURIComponent(token).trim();
  const parts = token.split('.');
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]{10,80}$/.test(parts[0]) || !/^[A-Za-z0-9_-]{20,200}$/.test(parts[1])) {
    throw Object.assign(new Error('Invalid QR linking code.'), { statusCode: 400 });
  }
  return { requestId: parts[0], pollSecret: parts[1] };
}

export function errorResponse(res, error) {
  const status = Number(error?.statusCode || 500);
  if (status >= 500) console.error(error);
  json(res, status, { ok: false, error: error?.message || 'Server error.', code: error?.code || undefined });
}
