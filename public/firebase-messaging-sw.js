// public/firebase-messaging-sw.js

// Importa os scripts do Firebase em segundo plano
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

// COPIE AS SUAS CHAVES DO SEU ARQUIVO lib/firebase.ts E COLE AQUI:
firebase.initializeApp({
    apiKey: "AIzaSyBn-IMbJVVB4WQYGJ-BaejOtYqUMXX8ORI",
    authDomain: "devocional-diario-2d1e1.firebaseapp.com",
    projectId: "devocional-diario-2d1e1",
    storageBucket: "devocional-diario-2d1e1.firebasestorage.app",
    messagingSenderId: "1053660527157",
    appId: "1:1053660527157:web:164012aaae8c3084d08f7c"
});

// Inicializa o serviço de mensagens em segundo plano
const messaging = firebase.messaging();

// Lida com as notificações quando o app está em segundo plano
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Notificação recebida em segundo plano.', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon-192x192.png' // Ícone que vai aparecer na notificação
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});