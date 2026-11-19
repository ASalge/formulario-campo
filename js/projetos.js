/* =========================================================================
   Projetos: pasta do projeto (grade de sondagens/ensaios, diários, resumo)
   e cadastro/edição.
   ========================================================================= */
"use strict";

let projetoAtivoId = null;

TELAS.projeto = {
  id: "tela-projeto",
  abas: true,
  aba: "inicio",
  titulo: (params) => {
    const p = projetoPorId(params.id);
    return { titulo: p ? p.numero || "Projeto" : "Projeto", sub: p ? p.cliente || "" : "" };
  },
  acoesBarra: () => [{ icone: "pencil", acao: "pj-editar", rotulo: "Editar projeto" }],
  abrir(params) {
    projetoAtivoId = params.id;
    renderProjeto();
  },
};

function projetoAtivo() {
  return projetoPorId(projetoAtivoId);
}

function renderProjeto() {
  const p = projetoAtivo();
  if (!p) {
    Nav.ir("inicio", {}, { raiz: true });
    return;
  }
  const sond = sondagensDoProjeto(p.id);
  const ens = ensaiosDoProjeto(p.id);
  const dia = diariosDoProjeto(p.id);
  const pocos = sond.filter((r) => r.poco).length;

  $("#pj-titulo").textContent = p.cliente || p.numero || "Projeto";
  $("#pj-meta").innerHTML =
    (p.local ? `<span>${ic("map-pin")}${esc(p.local)}</span>` : "") +
    (p.empresa ? `<span>${ic("building-2")}${esc(p.empresa)}</span>` : "");

  const estat = (v, t, rot) =>
    `<div class="estat"><b>${v}${t != null ? `<small>/${t}</small>` : ""}</b><span>${rot}</span></div>`;
  $("#pj-estat").innerHTML =
    estat(sond.length, p.qtdSond || 0, "sondagens") +
    estat(pocos, p.qtdPocos || 0, "poços") +
    estat(ens.length, p.qtdEns || 0, "ensaios") +
    estat(dia.length, null, dia.length === 1 ? "diário" : "diários");

  // Registros com o mesmo número feitos fora da pasta
  const soltos = soltosDoProjeto(p);
  const nSoltos = soltos.sondagem.length + soltos.diario.length + soltos.ensaios.length;
  $("#pj-vincular").innerHTML = nSoltos
    ? `<div class="aviso" style="margin-bottom:20px">${ic("link")}
        <div class="aviso-corpo">${nSoltos} registro(s) com o número ${esc(p.numero)} estão fora desta pasta
          (${esc(
            listaPt(
              [
                soltos.sondagem.length ? soltos.sondagem.length + " sondagem(ns)" : "",
                soltos.diario.length ? soltos.diario.length + " diário(s)" : "",
                soltos.ensaios.length ? soltos.ensaios.length + " ensaio(s)" : "",
              ].filter(Boolean)
            )
          )}).
          <div class="aviso-acoes"><button type="button" class="bt bt-pri bt-peq" data-acao="pj-vincular">Trazer para o projeto</button></div>
        </div></div>`
    : "";

  // Sondagens: cada compartimento mostra a coluna litológica do furo
  const nomes = nomesSTProjeto(p);
  $("#pj-sts").innerHTML = nomes.length
    ? nomes
        .map((nome) => {
          const r = sond.find((x) => x.idSond === nome);
          if (!r) {
            return `<button type="button" class="nucleo pendente" data-acao="pj-st" data-nome="${esc(nome)}">
              <span class="nucleo-nome">${esc(nome)}</span>
              <span class="nucleo-corpo"><span class="coluna" style="width:16px;height:72px"></span>
              <span class="nucleo-info">pendente</span></span></button>`;
          }
          const pf = num(r.profFinal);
          return `<button type="button" class="nucleo" data-acao="pj-st" data-nome="${esc(nome)}">
            <span class="nucleo-nome">${esc(nome)}</span>
            <span class="nucleo-corpo">${colunaMiniHTML(r)}
              <span class="nucleo-info">${!isNaN(pf) ? `<b>${fmtDec(pf, 2)} m</b>` : "<b>—</b>"}${
                r.nivelAgua ? "NA " + esc(fmtDec(r.nivelAgua, 2)) + "<br>" : "seco<br>"
              }${r.poco ? esc(r.poco.id || "poço") : ""}</span>
            </span></button>`;
        })
        .join("")
    : `<p class="ajuda">Nenhuma sondagem prevista. Edite o projeto para definir a quantidade.</p>`;

  const nomesEP = nomesEPProjeto(p);
  $("#pj-eps-sec").classList.toggle("oculto", !nomesEP.length);
  $("#pj-eps").innerHTML = nomesEP
    .map((nome) => {
      const r = ens.find((x) => x.idEnsaio === nome);
      if (!r) {
        return `<button type="button" class="nucleo pendente" data-acao="pj-ep" data-nome="${esc(nome)}" style="min-height:96px">
          <span class="nucleo-nome">${esc(nome)}</span><span class="nucleo-info">pendente</span></button>`;
      }
      const c = calcularEnsaio(r);
      return `<button type="button" class="nucleo" data-acao="pj-ep" data-nome="${esc(nome)}" style="min-height:96px">
        <span class="nucleo-nome">${esc(nome)}</span>
        <span class="nucleo-k">${c.ok ? "K " + fmtCientifico(c.K) : "salvo"}</span>
        <span class="nucleo-info">${c.ok ? "cm/s" : esc(c.aviso)}</span></button>`;
    })
    .join("");

  const dias = dia.slice().sort((a, b) => (b.data || "").localeCompare(a.data || "") || b.id - a.id);
  $("#pj-diarios").innerHTML = dias.length
    ? dias
        .map((r) => {
          const d = partesData(r.data);
          return `<button type="button" class="data-dia" data-acao="pj-diario" data-id="${r.id}">
            <b>${d ? pad2(d.dia) : "—"}</b><span>${d ? MESES[d.mes - 1] + " " + String(d.ano).slice(2) : "sem data"}</span></button>`;
        })
        .join("")
    : `<p class="ajuda">Nenhum diário ainda.</p>`;

  const res = resumoProjeto(p);
  $("#pj-resumo").innerHTML = `<dl>${res.linhas.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join("")}</dl>`;
}

async function vincularSoltos() {
  const p = projetoAtivo();
  if (!p) return;
  const s = soltosDoProjeto(p);
  const n = s.sondagem.length + s.diario.length + s.ensaios.length;
  const ok = await confirmar(
    "Os registros com o número " + p.numero + " passam a aparecer nesta pasta. Nada é apagado ou alterado além do vínculo.",
    { titulo: "Trazer " + n + " registro(s) para o projeto?", ok: "Trazer" }
  );
  if (!ok) return;
  [["sondagem", s.sondagem], ["diario", s.diario], ["ensaios", s.ensaios]].forEach(([tipo, regs]) => {
    if (!regs.length) return;
    const ids = new Set(regs.map((r) => r.id));
    Dados.gravar(tipo, Dados.lista(tipo).map((r) => (ids.has(r.id) ? Object.assign({}, r, { projetoId: p.id }) : r)));
  });
  renderProjeto();
  toast(n + " registro(s) trazidos para " + p.numero);
}

function excluirProjetoAtivo() {
  const p = projetoAtivo();
  if (!p) return;
  const inst = Dados.instantaneo(["projetos"]);
  Dados.remover("projetos", p.id);
  Nav.ir("inicio", {}, { raiz: true });
  toast("Projeto " + (p.numero || "") + " excluído. Os registros continuam salvos.", {
    acao: "Desfazer",
    icone: "trash-2",
    aoAgir: () => {
      Dados.restaurar(inst);
      Nav.ir("projeto", { id: p.id });
      toast("Projeto restaurado");
    },
  });
}

Object.assign(ACOES, {
  "pj-st": (el) => {
    const p = projetoAtivo();
    if (!p) return;
    const nome = el.dataset.nome;
    const r = sondagensDoProjeto(p.id).find((x) => x.idSond === nome);
    if (r) Nav.ir("sondagem", { id: r.id });
    else Nav.ir("sondagem", { novo: true, projetoId: p.id, idSond: nome });
  },
  "pj-ep": (el) => {
    const p = projetoAtivo();
    if (!p) return;
    const nome = el.dataset.nome;
    const r = ensaiosDoProjeto(p.id).find((x) => x.idEnsaio === nome);
    if (r) Nav.ir("ensaio", { id: r.id });
    else Nav.ir("ensaio", { novo: true, projetoId: p.id, idEnsaio: nome });
  },
  "pj-diario": (el) => Nav.ir("diario", { id: Number(el.dataset.id) }),
  "pj-diario-novo": () => {
    const p = projetoAtivo();
    if (p) Nav.ir("diario", { novo: true, projetoId: p.id });
  },
  "pj-editar": () => {
    const p = projetoAtivo();
    if (p) Nav.ir("projetoForm", { id: p.id });
  },
  "pj-excluir": () => excluirProjetoAtivo(),
  "pj-vincular": () => vincularSoltos(),
  "pj-copiar-resumo": async () => {
    const p = projetoAtivo();
    if (!p) return;
    const ok = await copiarTexto(resumoProjeto(p).texto);
    toast(ok ? "Resumo copiado. Cole no WhatsApp ou no e-mail." : "Não foi possível copiar neste navegador.", {
      icone: ok ? "clipboard-check" : "circle-alert",
    });
  },
  "pj-pdf": () => exportarProjetoPDF(projetoAtivoId),
});

// ---------------------------------------------------------------- Cadastro / edição

let editProjetoId = null;

TELAS.projetoForm = {
  id: "tela-projeto-form",
  titulo: (params) => ({ titulo: params.id ? "Editar projeto" : "Novo projeto" }),
  abrir(params, { voltando }) {
    if (voltando) return;
    editProjetoId = params.id || null;
    const f = $("#form-projeto");
    f.reset();
    $("#proj-gps-info").innerHTML = "";
    $("#pf-salvar-txt").textContent = editProjetoId ? "Salvar alterações" : "Salvar projeto";
    if (editProjetoId) {
      const p = projetoPorId(editProjetoId);
      if (!p) return;
      $("#proj-numero").value = projetoParaCampo(p.numero || "");
      $("#proj-cliente").value = p.cliente || "";
      $("#proj-local").value = p.local || "";
      $("#proj-empresa").value = p.empresa || "";
      $("#proj-qtd-sond").value = p.qtdSond || "";
      $("#proj-qtd-pocos").value = p.qtdPocos || "";
      $("#proj-qtd-ens").value = p.qtdEns || "";
      $("#proj-ini-st").value = p.iniST > 1 ? p.iniST : "";
      $("#proj-ini-pm").value = p.iniPM > 1 ? p.iniPM : "";
      $("#proj-ini-ep").value = p.iniEP > 1 ? p.iniEP : "";
    } else {
      setTimeout(() => $("#proj-numero").focus(), 80);
    }
  },
};

async function salvarProjeto() {
  const numero = projetoDeCampo($("#proj-numero").value);
  if (!numero) {
    $("#proj-numero").closest(".prefixo").classList.add("invalida");
    $("#proj-numero").focus();
    toast("Informe o número do projeto", { icone: "circle-alert" });
    return;
  }
  const inteiro = (id, padrao) => parseInt($(id).value, 10) || padrao;
  const anterior = editProjetoId ? projetoPorId(editProjetoId) : null;
  const reg = Object.assign({}, anterior || {}, {
    id: editProjetoId || Dados.novoId("projetos"),
    numero,
    cliente: $("#proj-cliente").value.trim(),
    local: $("#proj-local").value.trim(),
    empresa: $("#proj-empresa").value.trim(),
    qtdSond: inteiro("#proj-qtd-sond", 0),
    qtdPocos: inteiro("#proj-qtd-pocos", 0),
    qtdEns: inteiro("#proj-qtd-ens", 0),
    iniST: inteiro("#proj-ini-st", 1),
    iniPM: inteiro("#proj-ini-pm", 1),
    iniEP: inteiro("#proj-ini-ep", 1),
  });
  const duplicado = Dados.lista("projetos").find(
    (p) => p.id !== reg.id && String(p.numero).toUpperCase() === numero.toUpperCase()
  );
  if (duplicado && !(await confirmar("Já existe um projeto " + numero + (duplicado.cliente ? " (" + duplicado.cliente + ")" : "") + ".", {
    titulo: "Número repetido", ok: "Salvar mesmo assim",
  }))) {
    return;
  }
  Dados.salvar("projetos", reg);
  Dados.pedirPersistencia();
  toast("Projeto " + numero + " salvo");
  if (editProjetoId) Nav.voltarOu("projeto", { id: reg.id });
  else Nav.ir("projeto", { id: reg.id }, { substituir: true });
}

Object.assign(ACOES, {
  "pf-salvar": () => salvarProjeto(),
});

document.addEventListener("input", (e) => {
  if (e.target && e.target.id === "proj-numero") e.target.closest(".prefixo").classList.remove("invalida");
});
