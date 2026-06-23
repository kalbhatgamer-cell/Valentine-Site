import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '../lib/firebase-admin.js';
import { errorResponse, json, serializeTimestamp, verifyUser } from '../lib/bind-utils.js';

export default async function handler(req, res) {
  try {
    if (!['GET', 'POST'].includes(req.method)) throw Object.assign(new Error('Method not allowed.'), { statusCode: 405 });
    const user = await verifyUser(req);
    const currentDeviceId = user.kalbLinked === true ? String(user.kalbDeviceId || '') : '';
    const col = adminDb.collection('users').doc(user.uid).collection('linkedDevices');

    if (currentDeviceId) {
      await col.doc(currentDeviceId).set({ active: true, lastSeenAt: Timestamp.now() }, { merge: true });
    }

    const snap = await col.get();
    const devices = snap.docs.map(doc => {
      const d = doc.data() || {};
      return {
        deviceId: doc.id,
        active: d.active === true,
        method: d.method || 'linked',
        name: d.name || 'Linked device',
        platform: d.platform || '',
        browser: d.browser || '',
        language: d.language || '',
        timezone: d.timezone || '',
        linkedAt: serializeTimestamp(d.linkedAt),
        lastSeenAt: serializeTimestamp(d.lastSeenAt),
        revokedAt: serializeTimestamp(d.revokedAt),
        current: doc.id === currentDeviceId
      };
    }).sort((a, b) => String(b.lastSeenAt || b.linkedAt || '').localeCompare(String(a.lastSeenAt || a.linkedAt || '')));

    json(res, 200, {
      ok: true,
      currentSession: currentDeviceId ? 'linked' : 'primary',
      currentDeviceId,
      devices
    });
  } catch (error) {
    errorResponse(res, error);
  }
}
