import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '../lib/firebase-admin.js';
import {
  APPROVED_TTL_MS, cleanText, errorResponse, hmac, isExpired, json, parseQrPayload,
  readJson, requirePost, safeEqualHex, verifyRequestIntegrity, verifyUser, withSignature
} from '../lib/bind-utils.js';

function deviceDoc(data, uid, method, now) {
  const d = data.device || {};
  return {
    deviceId: data.deviceId,
    uid,
    active: true,
    method,
    name: cleanText(d.name || 'Linked browser', 80),
    platform: cleanText(d.platform || 'Unknown platform', 80),
    browser: cleanText(d.browser || 'Browser', 80),
    userAgent: cleanText(d.userAgent || '', 350),
    language: cleanText(d.language || '', 24),
    timezone: cleanText(d.timezone || '', 64),
    linkedAt: Timestamp.fromMillis(now),
    lastSeenAt: Timestamp.fromMillis(now),
    revokedAt: null
  };
}

export default async function handler(req, res) {
  try {
    requirePost(req);
    const user = await verifyUser(req);
    if (user.kalbLinked === true) {
      throw Object.assign(new Error('Approve new devices from your primary Google/password login.'), { statusCode: 403 });
    }
    const body = await readJson(req);
    const method = body.method === 'code' ? 'code' : body.method === 'qr' ? 'qr' : '';
    if (!method) throw Object.assign(new Error('Invalid approval method.'), { statusCode: 400 });

    let requestId = '';
    let suppliedPollSecret = '';
    let codeHash = '';

    if (method === 'qr') {
      const parsed = parseQrPayload(body.qrPayload || body.token || '');
      requestId = parsed.requestId;
      suppliedPollSecret = parsed.pollSecret;
    } else {
      const code = cleanText(body.code, 6);
      if (!/^\d{6}$/.test(code)) throw Object.assign(new Error('Enter the six-digit code.'), { statusCode: 400 });
      codeHash = hmac(`code|${code}`);
      const codeSnap = await adminDb.collection('deviceBindCodes').doc(codeHash).get();
      if (!codeSnap.exists) throw Object.assign(new Error('Code is invalid or expired.'), { statusCode: 404 });
      const codeData = codeSnap.data();
      if ((codeData.expiresAt?.toMillis?.() || 0) <= Date.now()) throw Object.assign(new Error('Code expired. Create a new code.'), { statusCode: 410 });
      if (codeData.targetUid !== user.uid) throw Object.assign(new Error('This code belongs to another account.'), { statusCode: 403 });
      requestId = codeData.requestId;
    }

    const requestRef = adminDb.collection('deviceBindRequests').doc(requestId);
    const linkedRef = adminDb.collection('users').doc(user.uid).collection('linkedDevices');
    const now = Date.now();
    let approvedDevice = null;

    await adminDb.runTransaction(async tx => {
      const snap = await tx.get(requestRef);
      if (!snap.exists) throw Object.assign(new Error('Linking request not found.'), { statusCode: 404 });
      const data = snap.data();
      if (!verifyRequestIntegrity(data)) throw Object.assign(new Error('Linking request failed security validation.'), { statusCode: 409 });
      if (data.method !== method) throw Object.assign(new Error('Linking method does not match.'), { statusCode: 400 });
      if (isExpired(data, now)) throw Object.assign(new Error('Linking request expired.'), { statusCode: 410 });
      if (data.status !== 'pending') throw Object.assign(new Error(data.status === 'approved' ? 'This device is already approved.' : 'This request is no longer available.'), { statusCode: 409 });
      if (method === 'qr' && !safeEqualHex(data.pollSecretHash, hmac(`poll|${suppliedPollSecret}`))) {
        throw Object.assign(new Error('QR linking token is invalid.'), { statusCode: 403 });
      }
      if (method === 'code' && (data.codeHash !== codeHash || data.targetUid !== user.uid)) {
        throw Object.assign(new Error('Code does not match this account.'), { statusCode: 403 });
      }

      const next = withSignature({
        ...data,
        status: 'approved',
        targetUid: user.uid,
        approvedByUid: user.uid,
        approvedAt: Timestamp.fromMillis(now),
        expiresAt: Timestamp.fromMillis(now + APPROVED_TTL_MS)
      });
      approvedDevice = deviceDoc(data, user.uid, method, now);
      tx.set(requestRef, next);
      tx.set(linkedRef.doc(data.deviceId), approvedDevice, { merge: true });
      if (method === 'code') tx.delete(adminDb.collection('deviceBindCodes').doc(codeHash));
    });

    json(res, 200, { ok: true, approved: true, device: approvedDevice });
  } catch (error) {
    errorResponse(res, error);
  }
}
