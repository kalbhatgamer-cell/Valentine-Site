import { Timestamp } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '../lib/firebase-admin.js';
import {
  errorResponse, hmac, isExpired, json, readJson, requirePost, safeEqualHex,
  verifyRequestIntegrity, withSignature
} from '../lib/bind-utils.js';

export default async function handler(req, res) {
  try {
    requirePost(req);
    const body = await readJson(req);
    const requestId = String(body.requestId || '').trim();
    const pollSecret = String(body.pollSecret || '').trim();
    if (!/^[A-Za-z0-9_-]{10,80}$/.test(requestId) || pollSecret.length < 20) {
      throw Object.assign(new Error('Invalid linking request.'), { statusCode: 400 });
    }

    const ref = adminDb.collection('deviceBindRequests').doc(requestId);
    const snap = await ref.get();
    if (!snap.exists) throw Object.assign(new Error('Linking request not found.'), { statusCode: 404 });
    const data = snap.data();
    if (!verifyRequestIntegrity(data)) throw Object.assign(new Error('Linking request failed security validation.'), { statusCode: 409 });
    if (!safeEqualHex(data.pollSecretHash, hmac(`poll|${pollSecret}`))) {
      throw Object.assign(new Error('Invalid linking secret.'), { statusCode: 403 });
    }

    const now = Date.now();
    if (isExpired(data, now) && data.status !== 'completed') {
      const expired = withSignature({ ...data, status: 'expired', expiresAt: Timestamp.fromMillis(now) });
      await ref.set(expired);
      return json(res, 410, { ok: false, status: 'expired', error: 'Linking request expired.' });
    }

    if (data.status === 'pending') return json(res, 200, { ok: true, status: 'pending' });
    if (data.status === 'completed') return json(res, 200, { ok: true, status: 'completed' });
    if (data.status !== 'approved' || !data.targetUid || !data.deviceId) {
      return json(res, 409, { ok: false, status: data.status || 'invalid', error: 'This linking request is not available.' });
    }

    const linkedSnap = await adminDb.collection('users').doc(data.targetUid).collection('linkedDevices').doc(data.deviceId).get();
    if (!linkedSnap.exists || linkedSnap.data()?.active !== true) {
      throw Object.assign(new Error('The device approval was removed.'), { statusCode: 403 });
    }

    const customToken = await adminAuth.createCustomToken(data.targetUid, {
      kalbLinked: true,
      kalbDeviceId: data.deviceId,
      kalbBindVersion: 1
    });
    const updated = withSignature({ ...data, tokenIssuedAt: Timestamp.fromMillis(now) });
    await ref.set(updated);
    json(res, 200, { ok: true, status: 'approved', customToken, deviceId: data.deviceId });
  } catch (error) {
    errorResponse(res, error);
  }
}
