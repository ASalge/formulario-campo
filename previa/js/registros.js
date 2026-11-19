/* =========================================================================
   Registros: listas de sondagens, diários e ensaios, com busca, filtro por
   projeto, seleção múltipla, PDF em lote e CSV.
   ========================================================================= */
"use strict";

const RG = {
  tipo: "sondagem",
  projeto: "",
  busca: "",
  sel: new Set(),
};

const RG_TIPOS = {
  sondagem: { dados: "sondagem", nome: "sondagens", um: "sondagem" },
  diario: { dados: "diario", nome: "diários", um: "diário" },
  ensaio: { dados: "ensaios", nome: "ensaios", um: "ensaio" },
  auditoria: { dados: "auditorias", nome: "auditorias", um: "auditoria" },
};

TELAS.registros = {
  id: "tela-registros",
  abas: true,
  raiz: true,
  titulo: () => ({ titulo: "Registros" }),
  abrir(params) {
    if (params.tipo && RG_TIPOS[params.tipo]) {
      if (RG.tipo !== params.tipo) RG.sel.clear();
      RG.tipo = params.tipo;
    }
    renderRegistros();
  },
};

function textoBuscaRegistro(tipo, r) {
  if (tipo === "sondagem")
    return [r.idSond, r.projeto, r.local, r.empresa, r.obs, dataBR(r.data), r.poco && r.poco.id].join(" ");
  if (tipo === "diario")
    return [r.projeto, r.cliente, r.local, dataBR(r.data), r.atividades, r.observacoes, r.responsavel, r.auxiliares].join(" ");
  if (tipo === "auditoria") return [nomeCurtoAuditoria(r), r.tipo, r.referencia, r.projeto, r.cliente, r.local, dataBR(r.data), r.equipe].join(" ");
  return [r.idEnsaio, r.furo, r.projeto, r.local, dataBR(r.data), r.responsavel].join(" ");
}

function registrosFiltrados() {
  const t = RG_TIPOS[RG.tipo];
  let lista = Dados.lista(t.dados).slice();
  if (RG.projeto) lista = lista.filter((r) => (r.projeto || "") === RG.projeto);
  const q = semAcento(RG.busca.trim());
  if (q) lista = lista.filter((r) => semAcento(textoBuscaRegistro(RG.tipo, r)).includes(q));
  const nome = (r) => (RG.tipo === "sondagem" ? r.idSond : RG.tipo === "ensaio" ? r.idEnsaio : "");
  return lista.sort(
    (a, b) => (b.data || "").localeCompare(a.data || "") || ordemNatural(nome(a), nome(b)) || b.id - a.id
  );
}

function renderRegistros() {
  Object.keys(RG_TIPOS).forEach((k) => {
    $("#rg-n-" + k).textContent = Dados.lista(RG_TIPOS[k].dados).length;
  });
  $$("#rg-tipos button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.valor === RG.tipo)));
  if ($("#rg-busca").value !== RG.busca) $("#rg-busca").value = RG.busca;

  // Filtro por projeto (os mais recentes primeiro)
  const t = RG_TIPOS[RG.tipo];
  const recencia = {};
  Dados.lista(t.dados).forEach((r) => {
    const p = r.projeto || "";
    if (!p) return;
    recencia[p] = Math.max(recencia[p] || 0, momentoRegistro(r));
  });
  const projetos = Object.keys(recencia).sort((a, b) => recencia[b] - recencia[a]);
  if (RG.projeto && !projetos.includes(RG.projeto)) RG.projeto = "";
  $("#rg-projetos").innerHTML = projetos.length > 1
    ? [`<button type="button" class="chip chip-peq" data-acao="rg-projeto" data-valor="" aria-pressed="${!RG.projeto}">Todos</button>`]
        .concat(projetos.map((p) => `<button type="button" class="chip chip-peq" data-acao="rg-projeto" data-valor="${esc(p)}" aria-pressed="${RG.projeto === p}">${esc(p)}</button>`))
        .join("")
    : "";

  const lista = registrosFiltrados();
  // Seleção só do que existe
  const ids = new Set(Dados.lista(t.dados).map((r) => r.id));
  [...RG.sel].forEach((id) => {
    if (!ids.has(id)) RG.sel.delete(id);
  });
  const total = Dados.lista(t.dados).length;
  $("#rg-ferramentas").classList.toggle("oculto", RG.tipo === "auditoria");
  $("#rg-total").textContent =
    lista.length === total ? total + " " + (total === 1 ? t.um : t.nome) : lista.length + " de " + total + " " + t.nome;

  const cont = $("#rg-lista");
  if (!total) {
    const novo = { sondagem: "nova-sondagem", diario: "novo-diario", ensaio: "novo-ensaio", auditoria: "nova-auditoria" }[RG.tipo];
    cont.innerHTML = `<div class="vazio">${ic("clipboard-list")}<p>Nenhum ${t.um} salvo ainda.</p>
      <button type="button" class="bt bt-pri" data-acao="${novo}">${ic("plus")}Criar ${t.um}</button></div>`;
  } else if (!lista.length) {
    cont.innerHTML = `<p class="ajuda">Nada encontrado com esse filtro.</p>`;
  } else {
    cont.innerHTML = lista.map((r) => itemRegistro(RG.tipo, r)).join("");
  }
  atualizarBulkRegistros();
}

function itemRegistro(tipo, r) {
  const sel = RG.sel.has(r.id);
  const marca = `<label class="marca"><input type="checkbox" data-rgsel="${r.id}" ${sel ? "checked" : ""} aria-label="Selecionar"></label>`;
  const acoes = (pdf) => `
    <div class="reg-acoes">
      <button type="button" class="bt bt-sec bt-peq" data-acao="${pdf}" data-id="${r.id}">${ic("file-down", "i-p")}PDF</button>
      <button type="button" class="bt bt-sec bt-peq" data-acao="rg-editar" data-id="${r.id}">${ic("pencil", "i-p")}Abrir</button>
      <button type="button" class="bt bt-icone" data-acao="rg-mais" data-id="${r.id}" aria-label="Mais opções">${ic("ellipsis")}</button>
    </div>`;
  if (tipo === "sondagem") {
    const selos = [];
    const nc = (r.camadas || []).length;
    const nv = (r.vocs || []).length;
    selos.push(`<span class="selo areia">${nc} ${nc === 1 ? "camada" : "camadas"}</span>`);
    if (nv) selos.push(`<span class="selo areia">${nv} VOC</span>`);
    if (r.poco) selos.push(`<span class="selo ok">${ic("droplet")}${esc(r.poco.id || "poço")}</span>`);
    if (r.liner && (r.liner.amostras || []).length) selos.push(`<span class="selo areia">${r.liner.amostras.length} liners</span>`);
    if ((r.fotos || []).length) selos.push(`<span class="selo areia">${ic("camera")}${r.fotos.length}</span>`);
    return `
      <article class="reg${sel ? " selecionado" : ""}">
        ${marca}
        <div class="reg-visual">${colunaMiniHTML(r)}</div>
        <div class="reg-corpo">
          <div class="reg-titulo">${esc(r.idSond || "Sem ID")} <small>${esc(r.projeto || "sem projeto")}</small></div>
          <div class="meta">
            <span>${ic("calendar")}${esc(dataBR(r.data) || "sem data")}</span>
            <span>${ic("ruler")}${r.profFinal ? esc(fmtDec(r.profFinal, 2)) + " m" : "—"}</span>
            <span>${ic("droplets")}${r.nivelAgua ? "NA " + esc(fmtDec(r.nivelAgua, 2)) + " m" : "seco"}</span>
          </div>
          <div class="reg-selos">${selos.join("")}</div>
          ${r.obs ? `<div class="reg-texto">${esc(r.obs)}</div>` : ""}
        </div>
        ${acoes("rg-pdf-um")}
      </article>`;
  }
  if (tipo === "diario") {
    const d = partesData(r.data);
    return `
      <article class="reg${sel ? " selecionado" : ""}">
        ${marca}
        <div class="reg-dia"><b>${d ? pad2(d.dia) : "—"}</b><span>${d ? MESES[d.mes - 1] + " " + String(d.ano).slice(2) : ""}</span></div>
        <div class="reg-corpo">
          <div class="reg-titulo">${esc(r.projeto || "sem projeto")} <small>${esc(r.cliente || "")}</small></div>
          <div class="meta">
            ${r.local ? `<span>${ic("map-pin")}${esc(r.local.length > 42 ? r.local.slice(0, 40) + "…" : r.local)}</span>` : ""}
            ${r.horario ? `<span>${ic("clock")}${esc(r.horario)}</span>` : ""}
            ${r.clima ? `<span>${ic("cloud-sun")}${esc(r.clima)}</span>` : ""}
          </div>
          ${r.atividades ? `<div class="reg-texto">${esc(r.atividades)}</div>` : ""}
        </div>
        ${acoes("rg-pdf-um")}
      </article>`;
  }
  if (tipo === "auditoria") {
    const m = modeloAuditoria(r.modeloId);
    const pr = m ? auProgresso(r, m) : { pct: 0, pend: [], fotos: 0 };
    return `
      <article class="reg reg-sem-marca">
        <span></span>
        <div class="reg-visual"><div class="reg-pct${pr.pend.length ? "" : " ok"}" style="--p:${pr.pct}"><span><b>${pr.pct}</b>%</span></div></div>
        <div class="reg-corpo">
          <div class="reg-titulo">${esc(nomeCurtoAuditoria(r))} <small>${esc(r.projeto || "sem projeto")}</small></div>
          <div class="meta">
            <span>${ic("calendar")}${esc(dataBR(r.data) || "sem data")}</span>
            ${r.cliente ? `<span>${ic("building-2")}${esc(r.cliente)}</span>` : ""}
          </div>
          <div class="reg-selos"><span class="selo areia">${esc(r.referencia || "")}</span>${
      pr.pend.length ? `<span class="selo alerta">${pr.pend.length} ${pr.pend.length === 1 ? "pendência" : "pendências"}</span>` : `<span class="selo ok">${ic("check")}completa</span>`
    }${pr.fotos ? `<span class="selo areia">${ic("camera")}${pr.fotos}</span>` : ""}</div>
        </div>
        <div class="reg-acoes">
          <button type="button" class="bt bt-sec bt-peq" data-acao="rg-pdf-um" data-id="${r.id}">${ic("share-2", "i-p")}Exportar</button>
          <button type="button" class="bt bt-sec bt-peq" data-acao="rg-editar" data-id="${r.id}">${ic("pencil", "i-p")}Abrir</button>
          <button type="button" class="bt bt-icone" data-acao="rg-mais" data-id="${r.id}" aria-label="Mais opções">${ic("ellipsis")}</button>
        </div>
      </article>`;
  }
  const c = calcularEnsaio(r);
  return `
    <article class="reg${sel ? " selecionado" : ""}">
      ${marca}
      <div class="reg-visual"><div class="reg-k"></div></div>
      <div class="reg-corpo">
        <div class="reg-titulo">${esc(r.idEnsaio || "Ensaio")} <small>${esc(r.projeto || "sem projeto")}</small></div>
        <div class="meta">
          <span>${ic("calendar")}${esc(dataBR(r.data) || "sem data")}</span>
          <span>${ic("ruler")}Ø ${esc(rotuloDiametro(r))} · ${esc(fmtNumBR(c.trechoM))} m</span>
        </div>
        <div class="reg-selos"><span class="selo${c.ok ? "" : " alerta"}">${c.ok ? "K = " + fmtCientifico(c.K) + " cm/s" : esc(c.aviso)}</span></div>
      </div>
      ${acoes("rg-pdf-um")}
    </article>`;
}

function atualizarBulkRegistros() {
  const n = RG.sel.size;
  $("#rg-bulk").classList.toggle("oculto", !n);
  $("#rg-bulk-txt").textContent = n + (n === 1 ? " selecionado" : " selecionados");
}

function abrirRegistro(id) {
  if (RG.tipo === "sondagem") Nav.ir("sondagem", { id });
  else if (RG.tipo === "diario") Nav.ir("diario", { id });
  else if (RG.tipo === "auditoria") Nav.ir("auditoria", { id });
  else Nav.ir("ensaio", { id });
}

async function maisRegistro(id) {
  if (RG.tipo === "auditoria") return maisAuditoria(id);
  const t = RG_TIPOS[RG.tipo];
  const r = Dados.achar(t.dados, id);
  if (!r) return;
  const itens = [];
  const p = r.projetoId ? projetoPorId(r.projetoId) : null;
  if (p) itens.push({ rotulo: "Abrir o projeto " + p.numero, valor: "projeto", icone: "folder-open" });
  if (RG.tipo === "diario") itens.push({ rotulo: "Duplicar para hoje", detalhe: "Mesmo projeto, local e equipe", valor: "duplicar", icone: "copy" });
  itens.push({ rotulo: "Excluir", valor: "excluir", icone: "trash-2" });
  const titulo = RG.tipo === "sondagem" ? r.idSond : RG.tipo === "ensaio" ? r.idEnsaio : "Diário de " + dataBR(r.data);
  const op = await menuAcoes(titulo || "Registro", itens);
  if (op === "projeto") Nav.ir("projeto", { id: p.id });
  else if (op === "duplicar") duplicarDiario(id);
  else if (op === "excluir") {
    RG.sel.delete(id);
    if (RG.tipo === "sondagem") excluirSondagem(id);
    else excluirComDesfazer(t.dados, id, (titulo || "Registro") + " excluído");
  }
}

function exportarCSVRegistros() {
  const lista = registrosFiltrados().slice().reverse();
  if (!lista.length) {
    toast("Não há registros para exportar", { icone: "info" });
    return;
  }
  const hoje = hojeISO().replace(/-/g, "");
  const base = { sondagem: "sondagem_pocos_", diario: "diario_atividades_", ensaio: "ensaios_permeabilidade_" }[RG.tipo];
  const filtro = RG.projeto ? sanitizarNome(RG.projeto) + "_" : "";
  const csv = RG.tipo === "sondagem" ? csvSondagem(lista) : RG.tipo === "diario" ? csvDiario(lista) : csvEnsaio(lista);
  baixarBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), base + filtro + hoje + ".csv");
  toast("CSV com " + lista.length + " registro(s) exportado", { icone: "file-spreadsheet" });
}

Object.assign(ACOES, {
  "rg-tipo": (el) => {
    if (RG.tipo !== el.dataset.valor) RG.sel.clear();
    RG.tipo = el.dataset.valor;
    renderRegistros();
  },
  "rg-projeto": (el) => {
    RG.projeto = el.dataset.valor;
    renderRegistros();
  },
  "rg-editar": (el) => abrirRegistro(Number(el.dataset.id)),
  "rg-mais": (el) => maisRegistro(Number(el.dataset.id)),
  "rg-pdf-um": (el) => {
    const id = Number(el.dataset.id);
    if (RG.tipo === "sondagem") return gerarPDFSondagem(id);
    if (RG.tipo === "diario") return gerarPDFDiario(id);
    if (RG.tipo === "auditoria") return exportarAuditoria(id);
    return gerarPDFEnsaio(id);
  },
  "rg-todos": () => {
    const lista = registrosFiltrados();
    const todos = lista.length && lista.every((r) => RG.sel.has(r.id));
    if (todos) lista.forEach((r) => RG.sel.delete(r.id));
    else lista.forEach((r) => RG.sel.add(r.id));
    renderRegistros();
  },
  "rg-limpar": () => {
    RG.sel.clear();
    renderRegistros();
  },
  "rg-pdf": () => exportarPDFLote(RG.tipo, [...RG.sel]),
  "rg-csv": () => exportarCSVRegistros(),
});

document.addEventListener("input", (e) => {
  if (e.target && e.target.id === "rg-busca") {
    RG.busca = e.target.value;
    renderRegistrosDep();
  }
});
const renderRegistrosDep = debounce(() => renderRegistros(), 160);

document.addEventListener("change", (e) => {
  const t = e.target;
  if (t && t.dataset && t.dataset.rgsel) {
    const id = Number(t.dataset.rgsel);
    if (t.checked) RG.sel.add(id);
    else RG.sel.delete(id);
    const art = t.closest(".reg");
    if (art) art.classList.toggle("selecionado", t.checked);
    atualizarBulkRegistros();
  }
});
