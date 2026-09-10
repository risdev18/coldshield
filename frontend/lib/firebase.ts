// Import the functions you need from the SDKs you need
import { initializeApp, getApps } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCILyQUYaln5RhVg0CWs34xw5Xff8onaTQ",
  authDomain: "illshield-a2951.firebaseapp.com",
  projectId: "illshield-a2951",
  storageBucket: "illshield-a2951.firebasestorage.app",
  messagingSenderId: "517455793148",
  appId: "1:517455793148:web:96a10d01d7df9589864079",
  measurementId: "G-2Z1KGXV4DV"
};

// Initialize Firebase (safely for SSR/Next.js)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Only initialize analytics on the client side
let analytics = null;
if (typeof window !== "undefined") {
  isSupported().then((yes) => yes && (analytics = getAnalytics(app)));
}

export { app, analytics };
