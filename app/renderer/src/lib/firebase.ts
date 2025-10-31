// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const app = initializeApp({
    apiKey: "AIzaSyDQBOABYh_XHqUl2cj5iLcvdYKv1J2g2Ts",
    authDomain: "portfoli-you.firebaseapp.com",
    projectId: "portfoli-you",
    // storageBucket accepts a bucket ID. If a web domain like
    // "portfoli-you.firebasestorage.app" is provided, we normalize it below.
    // You can also override via VITE_STORAGE_BUCKET.
    storageBucket: "portfoli-you.firebasestorage.app",
    appId: "1:736535724327:web:c96c601b15e40e374fa902",
    messagingSenderId: "736535724327",
});

// Initialize Firebase
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence);

export const db = getFirestore(app);
enableIndexedDbPersistence(db).catch(() => {});

// Resolve bucket URL with an optional env override and normalize common mistakes
function resolveBucketUrl(): string {
    // Priority:
    // 1) VITE_STORAGE_BUCKET ("gs://bucket" or "bucket")
    // 2) app.options.storageBucket from Firebase config
    // 3) fallback to known default
    let raw: string | undefined;
    try {
        const env = (import.meta as unknown as { env?: { VITE_STORAGE_BUCKET?: string } }).env;
        raw = env?.VITE_STORAGE_BUCKET;
    } catch {
        raw = undefined;
    }
    const configured = (app.options as { storageBucket?: string }).storageBucket;
    let bucket = raw && raw.trim() ? raw.trim() : (configured || 'portfoli-you.appspot.com');

    // If someone provided a web download host (e.g., "project.firebasestorage.app")
    // convert it to a bucket ID. Prefer projectId mapping when available.
    const projId = (app.options as { projectId?: string }).projectId;
    const lower = bucket.toLowerCase();
    if (/^[a-z0-9.-]+\.firebasestorage\.app$/.test(lower)) {
        if (projId && lower === `${projId.toLowerCase()}.firebasestorage.app`) {
            bucket = `${projId}.appspot.com`;
        } else {
            const label = lower.replace(/\.firebasestorage\.app$/, "");
            bucket = `${label}.appspot.com`;
        }
    }

    // If a full https URL was provided, extract the bucket from /v0/b/<bucket>/o or host
    if (/^https?:\/\//i.test(bucket)) {
        try {
            const u = new URL(bucket);
            // Prefer /v0/b/<bucket>/o style
            const m = u.pathname.match(/\/v0\/b\/([^/]+)\/o/);
            let b = m?.[1] || u.hostname; // fallback to host
            // If host is like project.firebasestorage.app, map to appspot bucket id
            const host = u.hostname.toLowerCase();
            if (/^[a-z0-9.-]+\.firebasestorage\.app$/.test(host)) {
                const label = host.replace(/\.firebasestorage\.app$/, "");
                b = `${label}.appspot.com`;
            }
            bucket = b;
        } catch { /* keep as-is */ }
    }

    // Ensure gs:// prefix for getStorage(app, bucket)
    if (!bucket.startsWith('gs://')) bucket = `gs://${bucket}`;
    return bucket;
}

// Explicitly bind to the resolved bucket to avoid stale config during HMR
export const storage = getStorage(app, resolveBucketUrl());
export { app };