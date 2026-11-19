/* =========================================================================
   Diário de atividades
   ========================================================================= */
"use strict";

let editDiarioId = null;

const autoDiario = criarAutosalvar({
  tipo: "diario",
  coletar: () => coletarDiario(),
  rotulo: (d) => "Diário " + (d.projeto || "") + (d.data ? " · " + dataBR(d.data) : ""),
  estadoEl: "di-estado",
});

TELAS.diario = {
  id: "tela-diario",
  titulo: () => {
    const d = coletarDiario();
    return {
      titulo: editDiarioId ? "Diário" : "Novo diário",
      sub: [d.projeto, d.data ? dataBR(d.data) : ""].filter(Boolean).join(" · "),
    };
  },
  acoesBarra: () => [{ icone: "ellipsis", acao: "di-menu", rotulo: "Mais opções" }],
  abrir(params, { voltando }) {
    if (voltando) return;
    abrirDiario(params);
  },
  aoSair() {
    autoDiario.encerrar();
  },
};

function coletarDiario() {
  return {
    projetoId: Number($("#diario-projetoid").value) || null,
    projeto: projetoDeCampo($("#diario-projeto").value),
    cliente: $("#diario-cliente").value.trim(),
    local: $("#diario-local").value.trim(),
    data: $("#diario-data").value,
    horario: $("#diario-horario").value.trim(),
    clima: $("#diario-clima").value,
    atividades: $("#diario-atividades").value.replace(/\s+$/, ""),
    observacoes: $("#diario-observacoes").value.trim(),
    responsavel: $("#diario-responsavel").value.trim(),
    auxiliares: $("#diario-auxiliares").value.trim(),
  };
}

function preencherDiario(d) {
  $("#diario-projetoid").value = d.projetoId || "";
  $("#diario-projeto").value = projetoParaCampo(d.projeto || "");
  $("#diario-cliente").value = d.cliente || "";
  $("#diario-local").value = d.local || "";
  $("#diario-data").value = d.data || "";
  $("#diario-horario").value = d.horario || "";
  definirClima(d.clima || "");
  $("#diario-atividades").value = d.atividades || "";
  $("#diario-observacoes").value = d.observacoes || "";
  $("#diario-responsavel").value = d.responsavel || "";
  $("#diario-auxiliares").value = d.auxiliares || "";
}

function definirClima(v) {
  $("#diario-clima").value = v;
  $$("#diario-clima-chips .chip").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.valor === v)));
}

function diarioEmBranco(projetoId) {
  const p = projetoId ? projetoPorId(projetoId) : null;
  return {
    projetoId: p ? p.id : null,
    projeto: p ? p.numero : "",
    cliente: p ? p.cliente : "",
    local: p ? p.local : "",
    data: hojeISO(),
    horario: "",
    clima: "",
    atividades: "",
    observacoes: "",
    responsavel: Dados.config.equipe.responsavel || "",
    auxiliares: Dados.config.equipe.auxiliares || "",
  };
}

function abrirDiario(params) {
  $("#diario-gps-info").innerHTML = "";
  $("#di-rascunho").innerHTML = "";
  let rascunho = null;
  let chave;
  if (params.rascunho && Dados.rascunhos[params.rascunho]) {
    chave = params.rascunho;
    rascunho = Dados.rascunhos[chave];
    editDiarioId = rascunho.editId || null;
  } else if (params.id) {
    editDiarioId = params.id;
    chave = "diario:e:" + params.id;
    rascunho = Dados.rascunhos[chave] || null;
  } else {
    editDiarioId = null;
    const pid = params.projetoId || null;
    // Rascunho de um diário novo do mesmo projeto e do mesmo dia
    const achado = Dados.listaRascunhos().find(
      (r) => r.tipo === "diario" && !r.editId && (r.projetoId || null) === pid && r.dados && r.dados.data === hojeISO()
    );
    chave = achado ? achado.chave : "diario:n:" + Date.now();
    rascunho = achado || null;
  }

  // Estado salvo (base para saber se há alterações)
  const salvo = editDiarioId ? Dados.achar("diario", editDiarioId) : null;
  if (editDiarioId && !salvo && !rascunho) {
    toast("Diário não encontrado", { icone: "circle-alert" });
    Nav.voltar();
    return;
  }
  preencherDiario(salvo || diarioEmBranco(params.projetoId || (rascunho && rascunho.projetoId)));
  autoDiario.iniciar(chave, { editId: editDiarioId, projetoId: (salvo && salvo.projetoId) || params.projetoId || null });
  if (rascunho) {
    preencherDiario(rascunho.dados);
    bannerRascunho("di-rascunho", rascunho, () => {
      autoDiario.descartar();
      preencherDiario(salvo || diarioEmBranco(params.projetoId || null));
      autoDiario.rebasear();
      Nav.atualizarBarra();
    });
    autoDiario.mostrarEstado("Rascunho recuperado");
  }
  $("#di-salvar-txt").textContent = editDiarioId ? "Salvar alterações" : "Salvar diário";
  $("#diario-hora-evento").value = horaAgora();
  $("#diario-texto-evento").value = "";
  montarChipsEventos();
  Nav.atualizarBarra();
}

function montarChipsEventos() {
  $("#diario-chips").innerHTML = eventosDiario()
    .map((ev, i) => `<button type="button" class="chip" data-acao="di-evento" data-i="${i}">${esc(ev.t)}${ev.id ? "…" : ""}</button>`)
    .join("");
}

function adicionarEvento(textoForcado) {
  const horaEl = $("#diario-hora-evento");
  const txtEl = $("#diario-texto-evento");
  const txt = (textoForcado || txtEl.value).trim();
  if (!txt) {
    txtEl.focus();
    return;
  }
  const hora = (horaEl.value || horaAgora()).replace(":", "h");
  const ta = $("#diario-atividades");
  ta.value = (ta.value ? ta.value.replace(/\s+$/, "") + "\n" : "") + hora + ": " + txt;
  txtEl.value = "";
  horaEl.value = horaAgora();
  vibrar(15);
  autoDiario.agendar();
  toast(hora + ": " + txt, { icone: "clock", duracao: 1600 });
}

// Pontos do projeto para eventos que pedem identificação (ST, PM, EP)
function pontosDoProjeto(p, texto) {
  const t = semAcento(texto);
  const sts = nomesSTProjeto(p);
  const pms = new Set();
  sondagensDoProjeto(p.id).forEach((r) => r.poco && r.poco.id && pms.add(r.poco.id));
  for (let i = 0; i < (p.qtdPocos || 0); i++) pms.add("PM-" + pad2((p.iniPM || 1) + i));
  const eps = nomesEPProjeto(p);
  if (t.includes("poco")) return [...pms].sort(ordemNatural);
  if (t.includes("ensaio")) return eps;
  return sts;
}

async function eventoComPonto(ev) {
  const p = projetoPorId(Number($("#diario-projetoid").value)) || projetoDigitado("diario-projeto");
  const txtEl = $("#diario-texto-evento");
  if (!p) {
    txtEl.value = ev.t + " ";
    txtEl.focus();
    return;
  }
  const pontos = pontosDoProjeto(p, ev.t);
  const itens = pontos.map((n) => ({ rotulo: n, valor: n }));
  itens.push({ rotulo: "Digitar outro…", valor: "__outro__", icone: "pencil" });
  const escolha = await escolher({ titulo: ev.t, texto: "Qual ponto?", itens });
  if (!escolha) return;
  if (escolha === "__outro__") {
    txtEl.value = ev.t + " ";
    txtEl.focus();
    return;
  }
  adicionarEvento(ev.t + " " + escolha);
}

// Resumo do dia a partir dos boletins e ensaios da mesma data
function resumoDoDia() {
  const d = coletarDiario();
  if (!d.data) return "";
  const doProjeto = (r) => (d.projetoId && r.projetoId === d.projetoId) || (d.projeto && r.projeto === d.projeto);
  const sond = Dados.lista("sondagem").filter((r) => r.data === d.data && doProjeto(r)).sort((a, b) => ordemNatural(a.idSond, b.idSond));
  const ens = Dados.lista("ensaios").filter((r) => r.data === d.data && doProjeto(r)).sort((a, b) => ordemNatural(a.idEnsaio, b.idEnsaio));
  const linhas = [];
  if (sond.length) {
    linhas.push(
      "Sondagens executadas: " +
        sond.map((r) => (r.idSond || "?") + (r.profFinal ? " (" + fmtDec(r.profFinal, 2) + " m)" : "")).join(", ") + "."
    );
    const pocos = sond.filter((r) => r.poco);
    if (pocos.length) linhas.push("Poços instalados: " + compactarNomes(pocos.map((r) => r.poco.id || r.idSond)) + ".");
    const comNA = sond.filter((r) => r.nivelAgua);
    if (comNA.length) linhas.push("Nível d'água: " + comNA.map((r) => r.idSond + " " + fmtDec(r.nivelAgua, 2) + " m").join(", ") + ".");
  }
  if (ens.length) {
    linhas.push(
      "Ensaios de permeabilidade: " +
        ens.map((r) => {
          const c = calcularEnsaio(r);
          return (r.idEnsaio || "?") + (c.ok ? " (K = " + fmtCientifico(c.K) + " cm/s)" : "");
        }).join(", ") + "."
    );
  }
  return linhas.join("\n");
}

async function salvarDiario() {
  const d = coletarDiario();
  if (!d.projeto) {
    toast("Informe o número do projeto", { icone: "circle-alert" });
    $("#diario-projeto").focus();
    return;
  }
  if (!d.data) {
    toast("Informe a data", { icone: "circle-alert" });
    $("#diario-data").focus();
    return;
  }
  if (!d.horario) d.horario = horarioDasAtividades(d.atividades);
  let vinculo = "";
  if (!d.projetoId) {
    const p = projetoPorNumero(d.projeto);
    if (p) {
      d.projetoId = p.id;
      vinculo = " na pasta " + p.numero;
    }
  }
  const anterior = editDiarioId ? Dados.achar("diario", editDiarioId) : null;
  const reg = {
    id: editDiarioId || Dados.novoId("diario"),
    projetoId: d.projetoId,
    projeto: d.projeto,
    cliente: d.cliente,
    local: d.local,
    data: d.data,
    horario: d.horario,
    clima: d.clima,
    atividades: d.atividades.trim(),
    observacoes: d.observacoes,
    responsavel: d.responsavel,
    auxiliares: d.auxiliares,
  };
  if (anterior) reg.atualizadoEm = Date.now();
  Dados.salvar("diario", reg);
  Dados.pedirPersistencia();
  autoDiario.descartar();
  autoDiario.ativo = false;
  Nav.voltarOu("inicio");
  toast("Diário salvo" + vinculo, { acao: "PDF", aoAgir: () => gerarPDFDiario(reg.id) });
}

async function menuDiario() {
  const itens = [];
  const salvo = editDiarioId ? Dados.achar("diario", editDiarioId) : null;
  if (salvo) {
    itens.push({ rotulo: "Exportar PDF", detalhe: "Versão salva deste diário", valor: "pdf", icone: "file-down" });
    itens.push({ rotulo: "Duplicar para hoje", detalhe: "Mesmo projeto, local e equipe", valor: "duplicar", icone: "copy" });
  }
  itens.push({
    rotulo: salvo ? "Descartar alterações" : "Limpar formulário",
    detalhe: salvo ? "Volta ao que está salvo" : "Começa em branco",
    valor: "limpar",
    icone: "eraser",
  });
  if (salvo) itens.push({ rotulo: "Excluir diário", valor: "excluir", icone: "trash-2" });
  const op = await menuAcoes("Diário", itens);
  if (op === "pdf") gerarPDFDiario(salvo.id);
  else if (op === "duplicar") duplicarDiario(salvo.id);
  else if (op === "limpar") {
    autoDiario.descartar();
    preencherDiario(salvo || diarioEmBranco(Number($("#diario-projetoid").value) || null));
    $("#di-rascunho").innerHTML = "";
    autoDiario.rebasear();
    Nav.atualizarBarra();
    toast(salvo ? "Alterações descartadas" : "Formulário limpo");
  } else if (op === "excluir") {
    autoDiario.descartar();
    autoDiario.ativo = false;
    excluirComDesfazer("diario", salvo.id, "Diário de " + dataBR(salvo.data) + " excluído");
    Nav.voltarOu("inicio");
  }
}

function duplicarDiario(id) {
  const base = Dados.achar("diario", id);
  if (!base) return;
  const chave = "diario:n:" + Date.now();
  const dados = Object.assign(diarioEmBranco(base.projetoId), {
    projetoId: base.projetoId || null,
    projeto: base.projeto,
    cliente: base.cliente,
    local: base.local,
    responsavel: base.responsavel,
    auxiliares: base.auxiliares,
    data: hojeISO(),
  });
  Dados.salvarRascunho(chave, { tipo: "diario", rotulo: "Diário " + (dados.projeto || "") + " · " + dataBR(dados.data), dados, projetoId: dados.projetoId });
  Nav.ir("diario", { rascunho: chave }, { substituir: Nav.topo() && Nav.topo().tela === "diario" });
}

Object.assign(ACOES, {
  "di-clima": (el) => {
    definirClima($("#diario-clima").value === el.dataset.valor ? "" : el.dataset.valor);
    autoDiario.agendar();
  },
  "di-lancar": () => adicionarEvento(),
  "di-evento": (el) => {
    const ev = eventosDiario()[+el.dataset.i];
    if (!ev) return;
    if (ev.id) eventoComPonto(ev);
    else adicionarEvento(ev.t);
  },
  "di-resumo-dia": () => {
    const txt = resumoDoDia();
    if (!txt) {
      toast("Nenhum boletim ou ensaio deste projeto nesta data", { icone: "info" });
      return;
    }
    const ta = $("#diario-observacoes");
    ta.value = (ta.value.trim() ? ta.value.trim() + "\n\n" : "") + txt;
    autoDiario.agendar();
    toast("Resumo do dia inserido nas observações");
  },
  "di-usar-ultimo": () => {
    const lista = Dados.lista("diario").filter((r) => r.id !== editDiarioId);
    if (!lista.length) {
      toast("Nenhum diário anterior para copiar", { icone: "info" });
      return;
    }
    const reg = lista[lista.length - 1];
    if (!$("#diario-projeto").value) {
      $("#diario-projeto").value = projetoParaCampo(reg.projeto || "");
      if (!$("#diario-projetoid").value && reg.projetoId) $("#diario-projetoid").value = reg.projetoId;
    }
    ["cliente", "local", "horario", "responsavel", "auxiliares"].forEach((k) => preencherSeVazio("diario-" + k, reg[k]));
    autoDiario.agendar();
    Nav.atualizarBarra();
    toast("Dados do diário de " + dataBR(reg.data) + " aplicados");
  },
  "di-salvar": () => salvarDiario(),
  "di-menu": () => menuDiario(),
});

// Eventos de digitação do formulário
document.addEventListener("input", (e) => {
  if (!e.target.closest || !e.target.closest("#form-diario")) return;
  autoDiario.agendar();
  if (e.target.id === "diario-projeto" || e.target.id === "diario-data") Nav.atualizarBarra();
});
document.addEventListener("change", (e) => {
  if (e.target.closest && e.target.closest("#form-diario")) autoDiario.agendar();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target && e.target.id === "diario-texto-evento") {
    e.preventDefault();
    adicionarEvento();
  }
});
// Ao sair do campo Projeto: completa cliente e local pelo cadastro
document.addEventListener("focusout", (e) => {
  if (e.target && e.target.id === "diario-projeto") {
    const p = projetoDigitado("diario-projeto");
    if (p) {
      if (!$("#diario-projetoid").value) $("#diario-projetoid").value = p.id;
      preencherSeVazio("diario-cliente", p.cliente);
      preencherSeVazio("diario-local", p.local);
      autoDiario.agendar();
    }
  }
});
