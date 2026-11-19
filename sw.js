// Service worker dos Formulários de campo (Archipel)
// Página: rede primeiro (versão mais nova quando há internet), com a cópia
// guardada como reserva. Demais arquivos: do cache (são versionados).

const VERSAO = "3.0.0";
const CACHE = "campo-v" + VERSAO;
const V = "?v=" + VERSAO;
const ARQUIVOS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/app.css" + V,
  "./css/doc.css" + V,
  "./js/util.js" + V,
  "./js/dados.js" + V,
  "./js/dominio.js" + V,
  "./js/ui.js" + V,
  "./js/inicio.js" + V,
  "./js/projetos.js" + V,
  "./js/diario.js" + V,
  "./js/sondagem.js" + V,
  "./js/wizard.js" + V,
  "./js/ensaio.js" + V,
  "./js/registros.js" + V,
  "./js/ajustes.js" + V,
  "./js/pdf.js" + V,
  "./js/app.js" + V,
  "./fonts/inter-latin.woff2",
  "./fonts/inter-greek.woff2",
  "./img/logo.svg",
  "./img/logo-navy.svg",
  "./img/logo-areia.svg",
  "./img/simbolo.svg",
  "./img/simbolo-tom.svg",
  "./favicon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable.png",
  "./apple-touch-icon.png",
  "./vendor/html2canvas.min.js",
  "./vendor/jspdf.umd.min.js",
  // Versão anterior (reserva), também offline
  "./anterior/",
  "./anterior/LogoColorido.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // individual: um arquivo ausente não impede o cache dos demais
      .then((cache) => Promise.all(ARQUIVOS.map((arq) => cache.add(new Request(arq, { cache: "reload" })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // Não intercepta chamadas externas (ex.: endereço pelo OpenStreetMap)
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  const guardar = (resp) => {
    if (resp && resp.ok && resp.type === "basic") {
      const copia = resp.clone();
      caches.open(CACHE).then((c) => c.put(req, copia));
    }
    return resp;
  };

  const ehPagina = req.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith(".html");
  if (ehPagina) {
    // Sem sinal, ou se a rede demorar mais de 4 s, usa a cópia guardada
    event.respondWith(
      caches.match(req, { ignoreSearch: true }).then((guardada) => {
        const rede = fetch(req).then(guardar);
        if (!guardada) return rede;
        const limite = new Promise((res) => setTimeout(() => res(guardada), 4000));
        return Promise.race([rede.catch(() => guardada), limite]);
      })
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((guardada) => {
      if (guardada) return guardada;
      return fetch(req)
        .then(guardar)
        .catch(() => caches.match(req, { ignoreSearch: true }));
    })
  );
});
