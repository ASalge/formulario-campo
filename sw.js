// Service worker dos Formulários de Campo
// Estratégia: responde do cache na hora (app abre offline) e atualiza o
// cache em segundo plano quando houver internet (stale-while-revalidate).

const CACHE = "formularios-campo-v1";
const ARQUIVOS = [
  "./",
  "./index.html",
  "./LogoColorido.svg",
  "./icon-192.png",
  "./manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        // add individual: um arquivo ausente (ex.: ícone) não impede o cache dos demais
        Promise.all(ARQUIVOS.map((arq) => cache.add(arq).catch(() => {})))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Não intercepta chamadas externas (ex.: geocodificação do OpenStreetMap)
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cacheado) => {
      const atualiza = fetch(req)
        .then((resp) => {
          if (resp && resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE).then((c) => c.put(req, clone));
          }
          return resp;
        })
        .catch(() => cacheado);
      return cacheado || atualiza;
    })
  );
});
