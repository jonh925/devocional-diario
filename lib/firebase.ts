import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getMessaging } from "firebase/messaging";

// chaves do Firebase Console
const firebaseConfig = {
    apiKey: "AIzaSyBn-IMbJVVB4WQYGJ-BaejOtYqUMXX8ORI",
    authDomain: "devocional-diario-2d1e1.firebaseapp.com",
    projectId: "devocional-diario-2d1e1",
    storageBucket: "devocional-diario-2d1e1.firebasestorage.app",
    messagingSenderId: "1053660527157",
    appId: "1:1053660527157:web:164012aaae8c3084d08f7c"
  };

// O Next.js recarrega muito, isso evita que o Firebase tente inicializar duas vezes
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp()

// Exporta as ferramentas que vamos usar nas telas
export const auth = getAuth(app)
export const db = getFirestore(app)
// Inicializa o mensageiro apenas no navegador (para não quebrar o Next.js no servidor)
export const messaging = typeof window !== "undefined" ? getMessaging(app) : null;