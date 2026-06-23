import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '../lib/firebase-admin.js';
import {
  errorResponse, hmac, json, readJson, requirePost, safeEqualHex,
  verifyRequestIntegrity, verifyUser, withSignature
} from '../lib/bind-utils.js';

export default async function handler(req, res) {
  try {
    requirePost(req);
    const user = await verifyUser(req);
    if (user.kalbLinked !== true || !user.kalbDeviceId) {
      throw Object.assign(new Error('This is not a linked-device login.'), { statusCode: 403 });
    }
    const body = await readJson(req);
    const requestId = String(body.requestId || '').trim();
    const pollSecret = String(body.pollSecret || '').trim();
    const ref = adminDb.collection('deviceBindRequests').doc(requestId);
    const now = Date.now();

    await adminDb.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw Object.assign(new Error('Linking request not found.'), { statusCode: 404 });
      const data = snap.data();
      if (!verifyRequestIntegrity(data)) throw Object.assign(new Error('Linking request failed security validation.'), { statusCode: 409 });
      if (!safeEqualHex(data.pollSecretHash, hmac(`poll|${pollSecret}`))) throw Object.assign(new Error('Invalid linking secret.'), { statusCode: 403 });
      if (data.targetUid !== user.uid || data.deviceId !== user.kalbDeviceId) throw Object.assign(new Error('Linked session does not match this request.'), { statusCode: 403 });
      const next = withSignature({ ...data, status: 'completed', completedAt: Timestamp.fromMillis(now), expiresAt: Timestamp.fromMillis(now) });
      tx.set(ref, next);
      tx.set(adminDb.collection('users').doc(user.uid).collection('linkedDevices').doc(user.kalbDeviceId), {
        active: true,
        lastSeenAt: Timestamp.fromMillis(now)
      }, { merge: true });
    });

    json(res, 200, { ok: true, completed: true });
  } catch (error) {
    errorResponse(res, error);
  }
}
