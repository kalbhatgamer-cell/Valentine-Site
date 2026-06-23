import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '../lib/firebase-admin.js';
import {
  REQUEST_TTL_MS, cleanText, enforceRateLimit, errorResponse, hmac, json, normalizeUsername,
  publicOrigin, randomToken, readJson, requestIp, requirePost, sanitizeDevice, withSignature
} from '../lib/bind-utils.js';

async function findUserByUsername(username) {
  const snap = await adminDb.collection('users').where('username', '==', username).limit(2).get();
  if (snap.empty) return null;
  if (snap.size > 1) throw Object.assign(new Error('This username is not unique. Use normal email login.'), { statusCode: 409 });
  return { uid: snap.docs[0].id, ...snap.docs[0].data() };
}

export default async function handler(req, res) {
  try {
    requirePost(req);
    const body = await readJson(req);
    const method = body.method === 'code' ? 'code' : body.method === 'qr' ? 'qr' : '';
    if (!method) throw Object.assign(new Error('Choose QR or username code linking.'), { statusCode: 400 });

    const device = sanitizeDevice(body.device || {});
    const ipKey = hmac(`ip|${requestIp(req)}`);
    await enforceRateLimit(`create|${ipKey}`, 10, 15 * 60 * 1000);

    const requestId = randomToken(18);
    const pollSecret = randomToken(32);
    const now = Date.now();
    const expiresAt = now + REQUEST_TTL_MS;
    let code = null;
    let codeHash = '';
    let targetUid = '';
    let targetUsername = '';

    if (method === 'code') {
      const username = normalizeUsername(body.username);
      if (username.length < 3) throw Object.assign(new Error('Enter a valid username.'), { statusCode: 400 });
      await enforceRateLimit(`username|${ipKey}|${hmac(username)}`, 5, 15 * 60 * 1000);
      const user = await findUserByUsername(username);
      if (!user) throw Object.assign(new Error('No account was found with that username.'), { statusCode: 404 });
      targetUid = user.uid;
      targetUsername = username;
    }

    const base = {
      requestId,
      method,
      status: 'pending',
      deviceId: device.deviceId,
      device,
      pollSecretHash: hmac(`poll|${pollSecret}`),
      codeHash: '',
      targetUid,
      targetUsername,
      approvedByUid: '',
      createdAt: Timestamp.fromMillis(now),
      expiresAt: Timestamp.fromMillis(expiresAt),
      approvedAt: null,
      completedAt: null,
      tokenIssuedAt: null,
      attempts: 0
    };

    const requestRef = adminDb.collection('deviceBindRequests').doc(requestId);

    if (method === 'code') {
      let stored = false;
      for (let attempt = 0; attempt < 12 && !stored; attempt++) {
        code = String(Math.floor(100000 + Math.random() * 900000));
        codeHash = hmac(`code|${code}`);
        const codeRef = adminDb.collection('deviceBindCodes').doc(codeHash);
        try {
          await adminDb.runTransaction(async tx => {
            const existing = await tx.get(codeRef);
            if (existing.exists && (existing.data()?.expiresAt?.toMillis?.() || 0) > now) {
              throw Object.assign(new Error('CODE_COLLISION'), { code: 'CODE_COLLISION' });
            }
            const requestData = withSignature({ ...base, codeHash });
            tx.set(requestRef, requestData);
            tx.set(codeRef, {
              requestId,
              targetUid,
              expiresAt: Timestamp.fromMillis(expiresAt),
              createdAt: Timestamp.fromMillis(now)
            });
          });
          stored = true;
        } catch (error) {
          if (error?.code !== 'CODE_COLLISION') throw error;
        }
      }
      if (!stored) throw Object.assign(new Error('Could not generate a code. Please try again.'), { statusCode: 503 });
    } else {
      await requestRef.set(withSignature(base));
    }

    const token = `${requestId}.${pollSecret}`;
    const origin = publicOrigin(req);
    json(res, 200, {
      ok: true,
      method,
      requestId,
      pollSecret,
      expiresAt: new Date(expiresAt).toISOString(),
      qrPayload: method === 'qr' ? `${origin || 'https://kalb-message.vercel.app'}/?kalbBind=${encodeURIComponent(token)}` : undefined,
      code: method === 'code' ? code : undefined,
      username: method === 'code' ? targetUsername : undefined
    });
  } catch (error) {
    errorResponse(res, error);
  }
}
