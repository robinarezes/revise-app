// Service worker minimal : juste ce qu'il faut pour que le site soit
// installable ("Ajouter à l'écran d'accueil"). Ne met rien en cache
// volontairement, pour ne jamais servir une vieille version du site après
// un déploiement.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
