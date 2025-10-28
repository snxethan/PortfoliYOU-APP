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
    storageBucket: "portfoli-you.firebasestorage.app",
    appId: "1:736535724327:web:c96c601b15e40e374fa902",
    messagingSenderId: "736535724327",
});

// Initialize Firebase
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence);

export const db = getFirestore(app);
enableIndexedDbPersistence(db).catch(() => {});

export const storage = getStorage(app);
export { app };