import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '../lib/firebase-admin.js';
import { errorResponse, json, normalizeDeviceId, readJson, requirePost, verifyUser } from '../lib/bind-utils.js';

export default async function handler(req, res) {
  try {
    requirePost(req);
    const user = await verifyUser(req);
    const body = await readJson(req);
    const currentDeviceId = user.kalbLinked === true ? String(user.kalbDeviceId || '') : '';
    const col = adminDb.collection('users').doc(user.uid).collection('linkedDevices');
    const now = Timestamp.now();
    let revoked = [];

    if (body.allOthers === true) {
      if (currentDeviceId) throw Object.assign(new Error('Only a primary login can remove other linked devices.'), { statusCode: 403 });
      const snap = await col.get();
      const batch = adminDb.batch();
      for (const doc of snap.docs) {
        if (doc.id === currentDeviceId) continue;
        batch.set(doc.ref, { active: false, revokedAt: now }, { merge: true });
        revoked.push(doc.id);
      }
      await batch.commit();
    } else {
      const deviceId = normalizeDeviceId(body.deviceId);
      if (currentDeviceId && deviceId !== currentDeviceId) {
        throw Object.assign(new Error('A linked session can remove only itself.'), { statusCode: 403 });
      }
      await col.doc(deviceId).set({ active: false, revokedAt: now }, { merge: true });
      revoked = [deviceId];
    }

    json(res, 200, {
      ok: true,
      revoked,
      shouldSignOut: !!currentDeviceId && revoked.includes(currentDeviceId)
    });
  } catch (error) {
    errorResponse(res, error);
  }
}
