import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { auth as v1auth } from 'firebase-functions/v1';

admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage();

// Helper to read the default bucket name from environment (Functions provides FIREBASE_CONFIG)
function getDefaultBucket(): string {
  try {
    const cfg = JSON.parse(process.env.FIREBASE_CONFIG || '{}');
    if (typeof cfg.storageBucket === 'string' && cfg.storageBucket) return cfg.storageBucket as string;
  } catch {}
  // Fallback for older projects
  const proj = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
  return proj ? `${proj}.firebasestorage.app` : '';
}

// Seed a default plan when a user signs up (v1 auth trigger for compatibility)
export const onUserCreate = v1auth.user().onCreate(async (user: any) => {
  const uid = user.uid;
  const userRef = db.collection('users').doc(uid);
  const snap = await userRef.get();
  if (snap.exists) return; // don't overwrite
  await userRef.set({
    plan: { maxCloudProjects: 1 },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
});

// Create a cloud project with server enforcement of per-user plan limit
export const createProject = onCall(async (request) => {
  const auth = request.auth;
  if (!auth) {
    throw new HttpsError('unauthenticated', 'Sign in required');
  }
  const uid = auth.uid;

  // Read plan
  const userSnap = await db.collection('users').doc(uid).get();
  const planMax = userSnap.exists ? (userSnap.get('plan.maxCloudProjects') ?? 1) : 1;
  const maxCloudProjects = typeof planMax === 'number' && planMax > 0 ? planMax : 1;

  // Count existing projects owned by user
  const existing = await db.collection('projects').where('ownerUid', '==', uid).get();
  if (existing.size >= maxCloudProjects) {
    throw new HttpsError('failed-precondition', 'Cloud project limit reached');
  }

  // Create project doc
  const docRef = db.collection('projects').doc();
  const now = admin.firestore.FieldValue.serverTimestamp();
  const bucket = getDefaultBucket();
  await docRef.set({
    ownerUid: uid,
    name: request.data?.name || 'Untitled',
    description: '',
    schemaVersion: 1,
    serverCreated: true,
    createdAt: now,
    updatedAt: now,
    storagePath: `users/${uid}/projects/${docRef.id}/project.portfoliyou`,
    storageBucket: bucket || undefined,
  }, { merge: true });

  // Increment user's cloud project counter
  await db.collection('users').doc(uid).set({
    counters: {
      cloudProjects: admin.firestore.FieldValue.increment(1),
      cloudBytesUsed: admin.firestore.FieldValue.increment(0),
    },
    updatedAt: now,
  }, { merge: true });

  return { id: docRef.id };
});

// Secure delete that removes Firestore doc and Storage object
export const deleteProject = onCall(async (request) => {
  const auth = request.auth;
  if (!auth) {
    throw new HttpsError('unauthenticated', 'Sign in required');
  }
  const uid = auth.uid;
  const projectId = request.data?.projectId;
  if (!projectId) {
    throw new HttpsError('invalid-argument', 'projectId required');
  }

  const ref = db.collection('projects').doc(projectId);
  const snap = await ref.get();
  if (!snap.exists) {
    // Already gone; treat as success
    return { ok: true };
  }
  const ownerUid = snap.get('ownerUid');
  if (ownerUid !== uid) {
    throw new HttpsError('permission-denied', 'Not your project');
  }

  // Delete storage file (ignore if missing)
  const storagePath = snap.get('storagePath') as string | undefined;
  const storageBucket = (snap.get('storageBucket') as string | undefined) || getDefaultBucket();
  let sizeBytes = typeof snap.get('sizeBytes') === 'number' ? (snap.get('sizeBytes') as number) : 0;
  try {
    if (storagePath) {
      const b = storage.bucket(storageBucket || undefined);
      // Try to read object size if not present in doc
      if (!sizeBytes) {
        try {
          const [m] = await b.file(storagePath).getMetadata();
          const sz = (m as any).size as unknown;
          sizeBytes = typeof sz === 'number' ? sz : parseInt((sz as string) || '0', 10) || 0;
        } catch {}
      }
      await b.file(storagePath).delete({ ignoreNotFound: true });
    }
  } catch (e) {
    // Ignore failures deleting storage object
  }

  // Delete Firestore doc (for subcollections, use recursive delete if added later)
  await ref.delete();

  // Decrement user's counters
  await db.collection('users').doc(uid).set({
    counters: {
      cloudProjects: admin.firestore.FieldValue.increment(-1),
      cloudBytesUsed: admin.firestore.FieldValue.increment(-sizeBytes),
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  return { ok: true };
});

// Update the stored size of a cloud project and adjust user's counters by the delta
export const updateProjectSize = onCall(async (request) => {
  const auth = request.auth;
  if (!auth) throw new HttpsError('unauthenticated', 'Sign in required');
  const uid = auth.uid;
  const projectId = request.data?.projectId as string | undefined;
  if (!projectId) throw new HttpsError('invalid-argument', 'projectId required');

  const ref = db.collection('projects').doc(projectId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Project not found');
  if (snap.get('ownerUid') !== uid) throw new HttpsError('permission-denied', 'Not your project');

  const storagePath = snap.get('storagePath') as string | undefined;
  const storageBucket = (snap.get('storageBucket') as string | undefined) || getDefaultBucket();
  if (!storagePath) throw new HttpsError('failed-precondition', 'No storagePath');

  const b = storage.bucket(storageBucket || undefined);
  let newSize = 0;
  try {
  const [m] = await b.file(storagePath).getMetadata();
  const sz = (m as any).size as unknown;
  newSize = typeof sz === 'number' ? sz : parseInt((sz as string) || '0', 10) || 0;
  } catch {
    newSize = 0;
  }
  const oldSize = typeof snap.get('sizeBytes') === 'number' ? (snap.get('sizeBytes') as number) : 0;
  const delta = newSize - oldSize;

  await ref.set({ sizeBytes: newSize, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  await db.collection('users').doc(uid).set({
    counters: { cloudBytesUsed: admin.firestore.FieldValue.increment(delta) },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return { ok: true, sizeBytes: newSize };
});
