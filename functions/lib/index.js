"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteProject = exports.createProject = exports.onUserCreate = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const v1_1 = require("firebase-functions/v1");
admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage();
// Seed a default plan when a user signs up (v1 auth trigger for compatibility)
exports.onUserCreate = v1_1.auth.user().onCreate(async (user) => {
    const uid = user.uid;
    const userRef = db.collection('users').doc(uid);
    const snap = await userRef.get();
    if (snap.exists)
        return; // don't overwrite
    await userRef.set({
        plan: { maxCloudProjects: 1 },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
});
// Create a cloud project with server enforcement of per-user plan limit
exports.createProject = (0, https_1.onCall)(async (request) => {
    const auth = request.auth;
    if (!auth) {
        throw new https_1.HttpsError('unauthenticated', 'Sign in required');
    }
    const uid = auth.uid;
    // Read plan
    const userSnap = await db.collection('users').doc(uid).get();
    const planMax = userSnap.exists ? (userSnap.get('plan.maxCloudProjects') ?? 1) : 1;
    const maxCloudProjects = typeof planMax === 'number' && planMax > 0 ? planMax : 1;
    // Count existing projects owned by user
    const existing = await db.collection('projects').where('ownerUid', '==', uid).get();
    if (existing.size >= maxCloudProjects) {
        throw new https_1.HttpsError('failed-precondition', 'Cloud project limit reached');
    }
    // Create project doc
    const docRef = db.collection('projects').doc();
    const now = admin.firestore.FieldValue.serverTimestamp();
    await docRef.set({
        ownerUid: uid,
        name: request.data?.name || 'Untitled',
        description: '',
        schemaVersion: 1,
        serverCreated: true,
        createdAt: now,
        updatedAt: now,
        storagePath: `users/${uid}/projects/${docRef.id}/project.portfoliyou`,
    }, { merge: true });
    return { id: docRef.id };
});
// Secure delete that removes Firestore doc and Storage object
exports.deleteProject = (0, https_1.onCall)(async (request) => {
    const auth = request.auth;
    if (!auth) {
        throw new https_1.HttpsError('unauthenticated', 'Sign in required');
    }
    const uid = auth.uid;
    const projectId = request.data?.projectId;
    if (!projectId) {
        throw new https_1.HttpsError('invalid-argument', 'projectId required');
    }
    const ref = db.collection('projects').doc(projectId);
    const snap = await ref.get();
    if (!snap.exists) {
        // Already gone; treat as success
        return { ok: true };
    }
    const ownerUid = snap.get('ownerUid');
    if (ownerUid !== uid) {
        throw new https_1.HttpsError('permission-denied', 'Not your project');
    }
    // Delete storage file (ignore if missing)
    const storagePath = snap.get('storagePath');
    try {
        if (storagePath) {
            const bucket = storage.bucket();
            await bucket.file(storagePath).delete({ ignoreNotFound: true });
        }
    }
    catch (e) {
        // Ignore failures deleting storage object
    }
    // Delete Firestore doc (for subcollections, use recursive delete if added later)
    await ref.delete();
    return { ok: true };
});
