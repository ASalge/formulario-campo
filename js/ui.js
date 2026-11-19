/* =========================================================================
   Interface: navegação entre telas, barra superior, abas, voltar por gesto,
   GPS, autosalvamento de rascunhos e delegação de ações (data-acao).
   ========================================================================= */
"use strict";

const TELAS = {};

const Nav = {
  pilha: [],

  topo() {
    return Nav.pilha[Nav.pilha.length - 1] || null;
  },

  ir(tela, params = {}, opcoes = {}) {
    const atual = Nav.topo();
    if (atual) {
      atual.scroll = window.scrollY;
      const def = TELAS[atual.tela];
      if (def && def.aoSair) def.aoSair();
    }
    const item = { tela, params };
    if (opcoes.raiz) Nav.pilha = [item];
    else if (opcoes.substituir && Nav.pilha.length) Nav.pilha[Nav.pilha.length - 1] = item;
    else Nav.pilha.push(item);
    Nav.mostrar(false);
  },

  voltar() {
    if (Folhas.voltar()) return;
    const atual = Nav.topo();
    if (!atual) return;
    if (Nav.pilha.length <= 1) {
      if (atual.tela !== "inicio") Nav.ir("inicio", {}, { raiz: true });
      return;
    }
    const def = TELAS[atual.tela];
    if (def && def.aoSair) def.aoSair();
    Nav.pilha.pop();
    Nav.mostrar(true);
  },

  // Volta para a tela de origem; se não houver, vai para a indicada
  voltarOu(tela, params) {
    if (Nav.pilha.length > 1) {
      const def = TELAS[Nav.topo().tela];
      if (def && def.aoSair) def.aoSair();
      Nav.pilha.pop();
      Nav.mostrar(true);
    } else {
      Nav.ir(tela, params || {}, { raiz: true });
    }
  },

  mostrar(voltando) {
    const item = Nav.topo();
    const def = TELAS[item.tela];
    $$(".tela").forEach((s) => (s.hidden = s.id !== def.id));
    def.abrir(item.params || {}, { voltando });
    Nav.atualizarBarra();
    const comAbas = !!def.abas;
    $("#abas").classList.toggle("oculto", !comAbas);
    $$(".aba").forEach((a) => a.classList.toggle("ativa", a.dataset.tela === (def.aba || item.tela)));
    if (voltando && item.scroll != null) {
      const y = item.scroll;
      requestAnimationFrame(() => window.scrollTo(0, y));
    } else {
      window.scrollTo(0, 0);
    }
  },

  atualizarBarra() {
    const item = Nav.topo();
    const def = TELAS[item.tela];
    const t = def.titulo ? def.titulo(item.params || {}) : { titulo: "" };
    const barra = $("#barra");
    const inicio = item.tela === "inicio";
    barra.classList.toggle("inicio", inicio);
    $("#barra-logo").classList.toggle("oculto", !inicio);
    $("#barra-voltar").classList.toggle("oculto", inicio || (Nav.pilha.length <= 1 && def.raiz));
    $("#barra-titulo").textContent = t.titulo || "";
    $("#barra-sub").textContent = t.sub || "";
    $("#barra-sub").classList.toggle("oculto", !t.sub);
    const acoes = def.acoesBarra ? def.acoesBarra(item.params || {}) : [];
    $("#barra-acoes").innerHTML = acoes
      .map((a) => `<button type="button" class="barra-botao" data-acao="${a.acao}" aria-label="${esc(a.rotulo)}">${ic(a.icone)}</button>`)
      .join("");
  },
};

function configurarVoltar() {
  // Histórico: o gesto de borda do Safari e o botão voltar do Android
  // disparam popstate; navegamos dentro do app e rearmamos a armadilha.
  try {
    history.replaceState({ app: 0 }, "");
    history.pushState({ app: 1 }, "");
  } catch (e) {}
  window.addEventListener("popstate", () => {
    Nav.voltar();
    try {
      history.pushState({ app: 1 }, "");
    } catch (e) {}
  });

  // Gesto próprio de arrasto da borda esquerda (modo app instalado)
  let x0 = null;
  let y0 = null;
  let ok = false;
  document.addEventListener(
    "touchstart",
    (e) => {
      const t = e.touches[0];
      ok = t.clientX <= 28;
      x0 = t.clientX;
      y0 = t.clientY;
    },
    { passive: true }
  );
  document.addEventListener(
    "touchmove",
    (e) => {
      if (ok && Math.abs(e.touches[0].clientY - y0) > 60) ok = false;
    },
    { passive: true }
  );
  document.addEventListener(
    "touchend",
    (e) => {
      if (!ok) return;
      ok = false;
      const t = e.changedTouches[0];
      if (t.clientX - x0 > 80 && Math.abs(t.clientY - y0) < 70) Nav.voltar();
    },
    { passive: true }
  );
}

// ---------------------------------------------------------------- Ações

function mostrarErro(e) {
  console.error(e);
  alerta((e && e.message) || String(e), { titulo: "Algo não saiu como esperado" });
}

function configurarAcoes() {
  // Os formulários nunca são enviados (Enter não recarrega a página)
  document.addEventListener("submit", (e) => e.preventDefault());
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-acao]");
    if (!el || el.disabled) return;
    const fn = ACOES[el.dataset.acao];
    if (!fn) return;
    e.preventDefault();
    try {
      const r = fn(el, e);
      if (r && r.catch) r.catch(mostrarErro);
    } catch (err) {
      mostrarErro(err);
    }
  });
}

Object.assign(ACOES, {
  voltar: () => Nav.voltar(),
  aba: (el) => {
    const tela = el.dataset.tela;
    const topo = Nav.topo();
    if (topo && topo.tela === tela && Nav.pilha.length === 1) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    Nav.ir(tela, {}, { raiz: true });
  },
  gps: (el) => capturarLocal(el.dataset.prefixo),
});

// Redesenha a tela atual (listas) depois de uma mudança nos dados
function atualizarTelaAtual() {
  const t = Nav.topo();
  if (!t) return;
  TELAS[t.tela].abrir(t.params || {}, { voltando: true });
  Nav.atualizarBarra();
}

// Exclusão com "Desfazer": o registro sai na hora e volta se o usuário pedir
function excluirComDesfazer(tipo, id, mensagem, opcoes = {}) {
  const inst = Dados.instantaneo([tipo]);
  Dados.remover(tipo, id);
  atualizarTelaAtual();
  toast(mensagem, {
    acao: "Desfazer",
    icone: "trash-2",
    aoExpirar: opcoes.aoExpirar,
    aoAgir: () => {
      Dados.restaurar(inst);
      atualizarTelaAtual();
      toast("Restaurado");
    },
  });
}

// ---------------------------------------------------------------- GPS

function capturarLocal(prefixo) {
  const btn = document.getElementById(prefixo + "-btn-gps");
  const info = document.getElementById(prefixo + "-gps-info");
  const campoLocal = document.getElementById(prefixo + "-local");
  if (!navigator.geolocation) {
    alerta("GPS não disponível neste aparelho ou navegador.");
    return;
  }
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = ic("locate-fixed") + "Buscando…";
  const fim = () => {
    btn.disabled = false;
    btn.innerHTML = original;
  };
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      const acc = Math.round(pos.coords.accuracy || 0);
      const utm = utmTexto(lat, lon);
      const cLat = document.getElementById(prefixo + "-lat");
      const cLon = document.getElementById(prefixo + "-lon");
      if (cLat && cLon) {
        cLat.value = lat.toFixed(6);
        cLon.value = lon.toFixed(6);
      }
      info.innerHTML =
        ic("map-pin", "i-p") +
        `<span>${lat.toFixed(5)}, ${lon.toFixed(5)}${acc ? " (±" + acc + " m)" : ""} · ${esc(utm)}</span>`;
      try {
        const end = await enderecoPorCoordenadas(lat, lon);
        if (end) campoLocal.value = end;
        else if (!campoLocal.value) campoLocal.value = utm;
      } catch (e) {
        // Sem internet: as coordenadas UTM ficam como referência do local
        if (!campoLocal.value) campoLocal.value = utm;
      }
      campoLocal.dispatchEvent(new Event("input", { bubbles: true }));
      fim();
    },
    (err) => {
      fim();
      alerta(
        "Não foi possível obter a posição (" + err.message + "). Verifique a permissão de localização do navegador.",
        { titulo: "GPS" }
      );
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

function mostrarCoordenadas(prefixo, lat, lon) {
  const info = document.getElementById(prefixo + "-gps-info");
  if (!info) return;
  if (lat && lon) {
    info.innerHTML = ic("map-pin", "i-p") + `<span>${esc(lat)}, ${esc(lon)} · ${esc(utmTexto(num(lat), num(lon)))}</span>`;
  } else {
    info.innerHTML = "";
  }
}

// ---------------------------------------------------------------- Autosalvamento

// Guarda o formulário como rascunho a cada alteração (sobrevive a recarga,
// bloqueio do celular e fechamento acidental).
function criarAutosalvar({ tipo, coletar, rotulo, estadoEl }) {
  const A = {
    chave: null,
    base: null,
    ativo: false,
    meta: {},

    iniciar(chave, meta = {}) {
      A.chave = chave;
      A.meta = meta;
      A.ativo = true;
      A.base = JSON.stringify(coletar());
      A.mostrarEstado("");
    },

    // Marca a situação atual como "limpa" (ex.: após restaurar)
    rebasear() {
      A.base = JSON.stringify(coletar());
    },

    agendar() {
      if (A.ativo) salvarDep();
    },

    agora() {
      if (A.ativo) salvarDep.agora();
    },

    sujo() {
      return A.ativo && JSON.stringify(coletar()) !== A.base;
    },

    descartar() {
      salvarDep.cancelar();
      if (A.chave) Dados.removerRascunho(A.chave);
      A.mostrarEstado("");
    },

    encerrar() {
      const sujo = A.sujo();
      salvarDep.agora();
      A.ativo = false;
      if (sujo) toast("Alterações guardadas como rascunho", { icone: "history" });
    },

    mostrarEstado(txt) {
      const el = estadoEl && document.getElementById(estadoEl);
      if (el) el.innerHTML = txt ? ic("save", "i-p") + esc(txt) : "";
    },
  };
  const salvarDep = debounce(() => {
    if (!A.ativo || !A.chave) return;
    const dados = coletar();
    if (JSON.stringify(dados) === A.base) {
      Dados.removerRascunho(A.chave);
      A.mostrarEstado("");
      return;
    }
    Dados.salvarRascunho(A.chave, Object.assign({ tipo, rotulo: rotulo(dados), dados }, A.meta));
    A.mostrarEstado("Rascunho guardado");
  }, 600);
  window.addEventListener("pagehide", () => A.agora());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") A.agora();
  });
  return A;
}

// Aviso de rascunho recuperado no topo do formulário
function bannerRascunho(elId, rascunho, aoDescartar) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!rascunho) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = `
    <div class="aviso alerta">
      ${ic("history")}
      <div class="aviso-corpo">
        <strong>Rascunho recuperado</strong> — alterações não salvas de ${esc(tempoRelativo(rascunho.ts))}.
        <div class="aviso-acoes">
          <button type="button" class="bt bt-sec bt-peq" data-rasc="descartar">Descartar o rascunho</button>
          <button type="button" class="bt bt-fan bt-peq" data-rasc="ok">Continuar</button>
        </div>
      </div>
    </div>`;
  el.querySelector('[data-rasc="ok"]').addEventListener("click", () => (el.innerHTML = ""));
  el.querySelector('[data-rasc="descartar"]').addEventListener("click", async () => {
    if (await confirmar("O formulário volta ao que estava salvo (ou em branco, se for novo).", { titulo: "Descartar o rascunho?", ok: "Descartar", perigo: true })) {
      el.innerHTML = "";
      aoDescartar();
    }
  });
}

// ---------------------------------------------------------------- Campo de projeto
// Ao sair do campo "Projeto", completa cliente/local/empresa se o número
// bater com um projeto cadastrado.
function projetoDigitado(campoId) {
  return projetoPorNumero(projetoDeCampo(document.getElementById(campoId).value));
}

function preencherSeVazio(id, valor) {
  const el = document.getElementById(id);
  if (el && !el.value && valor) {
    el.value = valor;
    return true;
  }
  return false;
}
