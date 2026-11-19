/* =========================================================================
   Inicialização
   ========================================================================= */
"use strict";

const APP_VERSAO = window.MODO_PREVIA ? "3.1 · prévia" : "3.1.0";

(async function iniciar() {
  configurarAcoes();
  await Dados.iniciar();
  instalarTexturasPoco();
  configurarVoltar();
  $("#app-versao").textContent = APP_VERSAO;
  Nav.ir("inicio", {}, { raiz: true });
  window.__pronto = true;
  iniciarTarefas();

  // Service worker: o app abre 100% offline (na prévia, o mesmo do app oficial)
  if ("serviceWorker" in navigator) {
    try {
      navigator.serviceWorker.register(RAIZ + "sw.js").then((reg) => reg.update()).catch(() => {});
    } catch (e) {}
  }
  // Pede ao navegador que não apague os dados para liberar espaço
  if (Dados.lista("sondagem").length || Dados.lista("diario").length || Dados.lista("auditorias").length) Dados.pedirPersistencia();
})();
