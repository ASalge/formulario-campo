/* =========================================================================
   Início: atalhos, rascunhos não salvos, projetos e situação do backup
   ========================================================================= */
"use strict";

let iniMostrarTodos = false;

TELAS.inicio = {
  id: "tela-inicio",
  abas: true,
  raiz: true,
  titulo: () => ({ titulo: "Formulários de campo" }),
  abrir() {
    renderInicio();
  },
};

function maiusculaInicial(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// Último momento em que um registro foi criado ou alterado
function momentoRegistro(r) {
  return Math.max(Number(r.id) || 0, Number(r.atualizadoEm) || 0);
}

function atividadeProjeto(p) {
  let t = Number(p.id) || 0;
  [sondagensDoProjeto(p.id), ensaiosDoProjeto(p.id), diariosDoProjeto(p.id)].forEach((l) =>
    l.forEach((r) => (t = Math.max(t, momentoRegistro(r))))
  );
  return t;
}

function ultimaAtividadeGeral() {
  let t = 0;
  ["sondagem", "diario", "ensaios", "projetos"].forEach((tipo) =>
    Dados.lista(tipo).forEach((r) => (t = Math.max(t, momentoRegistro(r))))
  );
  return t;
}

function renderInicio() {
  $("#ini-data").textContent = maiusculaInicial(dataExtenso());
  const hoje = hojeISO();
  const n = (tipo) => Dados.lista(tipo).filter((r) => r.data === hoje).length;
  const partes = [];
  const ns = n("sondagem");
  const nd = n("diario");
  const ne = n("ensaios");
  if (ns) partes.push(ns + (ns === 1 ? " sondagem" : " sondagens"));
  if (nd) partes.push(nd + (nd === 1 ? " diário" : " diários"));
  if (ne) partes.push(ne + (ne === 1 ? " ensaio" : " ensaios"));
  $("#ini-hoje-resumo").textContent = partes.length ? "Hoje: " + listaPt(partes) : "Nenhum registro hoje";
  renderRascunhosInicio();
  renderProjetosInicio();
  renderBackupInicio();
}

function renderRascunhosInicio() {
  const lista = Dados.listaRascunhos();
  const nomes = { sondagem: "Sondagem", diario: "Diário", ensaio: "Ensaio" };
  $("#ini-rascunhos").innerHTML = lista.length
    ? lista
        .map(
          (r) => `
      <div class="cartao-rascunho">
        ${ic("history")}
        <div class="txt">
          <strong>${esc(r.rotulo || nomes[r.tipo] || "Rascunho")}</strong>
          <span class="mini texto-3">${esc(nomes[r.tipo] || "")} ${r.editId ? "com alterações não salvas" : "não salvo"} · ${esc(tempoRelativo(r.ts))}${
            r.tipo === "ensaio" && ((typeof ensTimer !== "undefined" && ensTimer && ensTimer.chave === r.chave) || (typeof ensSat !== "undefined" && ensSat && ensSat.chave === r.chave))
              ? " · cronômetro em andamento"
              : ""
          }</span>
        </div>
        <button type="button" class="bt bt-pri bt-peq" data-acao="rascunho-abrir" data-chave="${esc(r.chave)}">Continuar</button>
        <button type="button" class="bt bt-icone" data-acao="rascunho-descartar" data-chave="${esc(r.chave)}" aria-label="Descartar">${ic("x")}</button>
      </div>`
        )
        .join("")
    : "";
}

function renderProjetosInicio() {
  const todos = Dados.lista("projetos").slice();
  const busca = $("#ini-busca");
  $("#ini-busca-wrap").classList.toggle("oculto", todos.length <= 5);
  const q = semAcento((busca && busca.value) || "").trim();
  let lista = todos
    .map((p) => ({ p, t: atividadeProjeto(p) }))
    .sort((a, b) => b.t - a.t)
    .map((x) => x.p);
  if (q) lista = lista.filter((p) => semAcento([p.numero, p.cliente, p.local, p.empresa].join(" ")).includes(q));
  const cont = $("#ini-projetos");
  if (!todos.length) {
    cont.innerHTML = `
      <div class="vazio">
        ${ic("folder-plus")}
        <p><strong>Nenhum projeto ainda.</strong></p>
        <p class="ajuda">Cadastre o projeto antes do campo (número, cliente, quantidade de sondagens, poços e ensaios). Os boletins já saem pré-preenchidos.</p>
        <button type="button" class="bt bt-pri" data-acao="novo-projeto">${ic("plus")}Cadastrar projeto</button>
      </div>`;
    return;
  }
  if (!lista.length) {
    cont.innerHTML = `<p class="ajuda">Nenhum projeto encontrado para “${esc(busca.value)}”.</p>`;
    return;
  }
  const limite = q || iniMostrarTodos ? lista.length : 8;
  cont.innerHTML =
    lista.slice(0, limite).map(cartaoProjeto).join("") +
    (lista.length > limite
      ? `<button type="button" class="bt bt-fan bt-largo" data-acao="ini-todos">Mostrar todos os ${lista.length} projetos</button>`
      : "");
}

function cartaoProjeto(p) {
  const regs = sondagensDoProjeto(p.id);
  const pocos = regs.filter((r) => r.poco).length;
  const nEns = ensaiosDoProjeto(p.id).length;
  const nomes = nomesSTProjeto(p).slice(0, 26);
  const tubos = nomes
    .map((nome) => {
      const r = regs.find((x) => x.idSond === nome);
      return r ? colunaMiniHTML(r, "tubo") : `<span class="tubo vazio-tubo"></span>`;
    })
    .join("");
  return `
    <button type="button" class="projeto-item" data-acao="abrir-projeto" data-id="${p.id}">
      <div class="projeto-topo">
        <span class="projeto-num">${esc(p.numero || "(sem nº)")}</span>
        <span class="projeto-cliente">${esc(p.cliente || "")}</span>
      </div>
      ${p.local ? `<div class="projeto-local">${esc(p.local)}</div>` : ""}
      <div class="projeto-rodape">
        <div class="caixa-mini" aria-hidden="true">${tubos}</div>
        <div class="progresso-txt">
          <b>${regs.length}</b>/${p.qtdSond || 0} sondagens<br>
          <b>${pocos}</b>/${p.qtdPocos || 0} poços${p.qtdEns || nEns ? ` · <b>${nEns}</b>/${p.qtdEns || 0} ensaios` : ""}
        </div>
      </div>
    </button>`;
}

function renderBackupInicio() {
  const el = $("#ini-backup");
  const total = Dados.lista("sondagem").length + Dados.lista("diario").length + Dados.lista("ensaios").length;
  if (!total) {
    el.innerHTML = "";
    return;
  }
  const ult = Dados.config.ultimoBackup ? Date.parse(Dados.config.ultimoBackup) : 0;
  const novos = ultimaAtividadeGeral() > ult;
  let classe = "ok";
  let texto = "Backup em dia · feito " + tempoRelativo(ult) + ".";
  if (!ult) {
    classe = "alerta";
    texto = "Nenhum backup feito neste aparelho. Os registros existem só aqui.";
  } else if (novos) {
    classe = "alerta";
    texto = "Há registros novos desde o último backup (" + tempoRelativo(ult) + ").";
  }
  el.innerHTML = `
    <div class="aviso ${classe} cartao-backup">
      ${ic(classe === "ok" ? "shield-check" : "triangle-alert")}
      <div class="txt">${esc(texto)}</div>
      <button type="button" class="bt ${classe === "ok" ? "bt-fan" : "bt-pri"} bt-peq" data-acao="backup-exportar">${ic("download", "i-p")}Backup</button>
    </div>`;
}

async function abrirRascunho(chave) {
  const r = Dados.rascunhos[chave];
  if (!r) return;
  const destino = { sondagem: "sondagem", diario: "diario", ensaio: "ensaio" }[r.tipo];
  if (destino) Nav.ir(destino, { rascunho: chave });
}

async function descartarRascunho(chave) {
  const r = Dados.rascunhos[chave];
  if (!r) return;
  const ok = await confirmar("As alterações não salvas deste formulário serão perdidas.", {
    titulo: "Descartar " + (r.rotulo || "rascunho") + "?",
    ok: "Descartar",
    perigo: true,
  });
  if (!ok) return;
  // Fotos tiradas só no rascunho saem do banco
  ((r.dados && r.dados.fotosNovas) || []).forEach((id) => Dados.fotoRemover(id));
  Dados.removerRascunho(chave);
  renderRascunhosInicio();
}

Object.assign(ACOES, {
  "novo-diario": () => Nav.ir("diario", { novo: true }),
  "nova-sondagem": () => Nav.ir("sondagem", { novo: true }),
  "novo-ensaio": () => Nav.ir("ensaio", { novo: true }),
  "novo-projeto": () => Nav.ir("projetoForm", {}),
  "abrir-projeto": (el) => Nav.ir("projeto", { id: Number(el.dataset.id) }),
  "ini-todos": () => {
    iniMostrarTodos = true;
    renderProjetosInicio();
  },
  "rascunho-abrir": (el) => abrirRascunho(el.dataset.chave),
  "rascunho-descartar": (el) => descartarRascunho(el.dataset.chave),
});

document.addEventListener("input", (e) => {
  if (e.target && e.target.id === "ini-busca") renderProjetosInicio();
});
