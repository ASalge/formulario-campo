// Service worker dos Formulários de Campo
// Estratégia: responde do cache na hora (app abre offline) e atualiza o
// cache em segundo plano quando houver internet (stale-while-revalidate).

const CACHE = "formularios-campo-v6";
const ARQUIVOS = [
  "./",
  "./index.html",
  "./LogoColorido.svg",
  "./icon-192.png",
  "./manifest.json",
  "./vendor/html2canvas.min.js",
  "./vendor/jspdf.umd.min.js",
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

  const guardar = (resp) => {
    if (resp && resp.ok) {
      const clone = resp.clone();
      caches.open(CACHE).then((c) => c.put(req, clone));
    }
    return resp;
  };

  // A página do app vem da rede primeiro (versão mais nova sempre que houver
  // internet); sem sinal, ou se a rede demorar mais de 4 s, usa a cópia guardada.
  const ehPagina =
    req.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith(".html");
  if (ehPagina) {
    event.respondWith(
      caches.match(req, { ignoreSearch: true }).then((cacheado) => {
        const rede = fetch(req).then(guardar);
        if (!cacheado) return rede;
        const limite = new Promise((res) => setTimeout(() => res(cacheado), 4000));
        return Promise.race([rede.catch(() => cacheado), limite]);
      })
    );
    return;
  }

  // Demais arquivos (bibliotecas, logo): resposta imediata do cache e
  // atualização em segundo plano.
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cacheado) => {
      const atualiza = fetch(req).then(guardar).catch(() => cacheado);
      return cacheado || atualiza;
    })
  );
});
