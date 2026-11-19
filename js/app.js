/* =========================================================================
   Inicialização
   ========================================================================= */
"use strict";

const APP_VERSAO = "3.0.0";

(async function iniciar() {
  configurarAcoes();
  await Dados.iniciar();
  instalarTexturasPoco();
  configurarVoltar();
  $("#app-versao").textContent = APP_VERSAO;
  Nav.ir("inicio", {}, { raiz: true });
  window.__pronto = true;

  // Service worker: o app abre 100% offline
  if ("serviceWorker" in navigator) {
    try {
      navigator.serviceWorker.register("sw.js").then((reg) => reg.update()).catch(() => {});
    } catch (e) {}
  }
  // Pede ao navegador que não apague os dados para liberar espaço
  if (Dados.lista("sondagem").length || Dados.lista("diario").length) Dados.pedirPersistencia();
})();
