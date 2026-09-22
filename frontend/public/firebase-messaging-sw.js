/* eslint-disable no-undef */
/**
 * Firebase Cloud Messaging service worker.
 * Keep apiKey / projectId / etc. in sync with frontend `.env` (VITE_FIREBASE_*).
 */
importScripts(
  'https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js',
);
importScripts(
  'https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js',
);

firebase.initializeApp({
  apiKey: 'AIzaSyCZQWOAjgUp9mM0sM4GpWN6PhBhDzpHZLg',
  authDomain: 'fleetquix-official.firebaseapp.com',
  projectId: 'fleetquix-official',
  storageBucket: 'fleetquix-official.firebasestorage.app',
  messagingSenderId: '272368598523',
  appId: '1:272368598523:web:73f31edb446cd4fa3adf5e',
  measurementId: "G-X2CVKENXRL"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'FleetQuix';
  const body = payload.notification?.body || '';
  const link = payload.data?.link || '/';
  self.registration.showNotification(title, {
    body,
    icon: '/favicon.ico',
    data: { link },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(link);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(link);
      }
      return undefined;
    }),
  );
});
