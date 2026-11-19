/* =========================================================================
   Auditorias: roteiros de campo por tipo e referência (Fase I, due
   diligence, licenciamento). Cada item pede uma resposta, um documento ou
   fotos; o app acompanha o progresso e as pendências e exporta o anexo em
   PDF e um arquivo .md para o Claude redigir o relatório técnico.
   ========================================================================= */
"use strict";

const AU = {
  id: null,
  secao: null,
  fotoAlvo: null,
  blocoAberto: null,
  urls: {},
};

const AU_CURTO = {
  "ap-cetesb": "Fase I · CETESB",
  "phase1-astm": "Fase I · ASTM",
  edd: "Due diligence",
  "lic-cetesb": "Licenciamento",
};

const AU_SNN = [["sim", "Sim"], ["nao", "Não"], ["na", "N/A"]];
const AU_DOC = [["obtido", "Obtido"], ["solicitado", "Solicitado"], ["inexistente", "Não existe"], ["na", "N/A"]];

function nomeCurtoAuditoria(reg) {
  return AU_CURTO[reg && reg.modeloId] || (reg && reg.tipo) || "Auditoria";
}

function auReg() {
  return Dados.achar("auditorias", AU.id);
}

function auditoriasDoProjeto(pid) {
  return Dados.lista("auditorias").filter((r) => r.projetoId === pid);
}

// ---------------------------------------------------------------- Chaves e valores
// "secao.item" para itens comuns e "secao#bloco.item" nas seções repetíveis

function auChave(secaoId, itemId, blocoId) {
  return blocoId ? secaoId + "#" + blocoId + "." + itemId : secaoId + "." + itemId;
}

function auParse(chave) {
  const m = /^([^.#]+)(?:#([^.]+))?\.(.+)$/.exec(chave || "");
  return m ? { secao: m[1], bloco: m[2] || null, item: m[3] } : null;
}

function auBloco(reg, secaoId, blocoId) {
  return ((reg.blocos || {})[secaoId] || []).find((b) => b._id === blocoId) || null;
}

function auLer(reg, chave) {
  const p = auParse(chave);
  if (!p) return undefined;
  if (p.bloco) {
    const b = auBloco(reg, p.secao, p.bloco);
    return b ? b.r[p.item] : undefined;
  }
  return (reg.respostas || {})[p.secao + "." + p.item];
}

function auVazio(v) {
  if (v == null) return true;
  if (Array.isArray(v)) return !v.length;
  if (typeof v === "object") return !Object.keys(v).some((k) => v[k] != null && v[k] !== "");
  return String(v).trim() === "";
}

function auGravar(reg, chave, valor) {
  const p = auParse(chave);
  if (!p) return;
  let alvo;
  let k;
  if (p.bloco) {
    const b = auBloco(reg, p.secao, p.bloco);
    if (!b) return;
    alvo = b.r;
    k = p.item;
  } else {
    reg.respostas = reg.respostas || {};
    alvo = reg.respostas;
    k = p.secao + "." + p.item;
  }
  if (auVazio(valor)) delete alvo[k];
  else alvo[k] = valor;
}

function auFotos(reg, chave) {
  return (reg.fotos || {})[chave] || [];
}

function auDef(m, chave) {
  const p = auParse(chave);
  const s = p && m.secoes.find((x) => x.id === p.secao);
  const it = s && s.itens.find((x) => x.id === p.item);
  return it ? { secao: s, item: it, bloco: p.bloco } : null;
}

function auRespondido(item, valor, nFotos) {
  if (item.tipo === "foto") return nFotos >= (item.minimo || 1);
  if (item.tipo === "multipla") return Array.isArray(valor) && valor.length > 0;
  if (item.tipo === "sim_nao_na" || item.tipo === "documento") return !!(valor && valor.v);
  if (item.tipo === "gps") return !!(valor && valor.lat != null && valor.lat !== "");
  return valor != null && String(valor).trim() !== "";
}

function auRotuloOpcao(item, v) {
  const lista = item && item.tipo === "documento" ? AU_DOC : AU_SNN;
  const achado = lista.find((o) => o[0] === v);
  return achado ? (item && item.tipo === "documento" && v === "na" ? "Não se aplica" : achado[1]) : v;
}

// Seção condicional: aparece conforme a resposta de outro item
function auCondicao(m, reg, secao) {
  const c = secao.mostrar_se;
  if (!c) return { ok: true };
  const v = (reg.respostas || {})[c.item];
  const val = v && typeof v === "object" ? v.v : v;
  const def = auDef(m, c.item);
  const perg = def ? def.item.pergunta : c.item;
  if (!val) return { ok: false, pendente: true, perg, secaoOrigem: def && def.secao };
  if (val === c.igual) return { ok: true };
  return { ok: false, perg, resposta: auRotuloOpcao(def && def.item, val), secaoOrigem: def && def.secao };
}

function auTituloBloco(s, b, bi) {
  const partes = (s.repetivel.titulo || [])
    .map((id) => {
      const v = b.r[id];
      return v && typeof v === "object" ? "" : v;
    })
    .filter((v) => v && String(v).trim());
  return { nome: s.repetivel.rotulo + " " + (bi + 1), detalhe: partes.join(" · ") };
}

// ---------------------------------------------------------------- Progresso

function auProgresso(reg, m) {
  const out = { obrig: 0, feitos: 0, pend: [], secoes: {}, fotos: 0, total: 0, respondidos: 0 };
  m.secoes.forEach((s) => {
    const cond = auCondicao(m, reg, s);
    const ps = { obrig: 0, feitos: 0, total: 0, respondidos: 0, cond, pend: [], blocos: [] };
    out.secoes[s.id] = ps;
    if (!cond.ok) return;
    const blocos = s.repetivel ? (reg.blocos || {})[s.id] || [] : [null];
    if (s.repetivel && s.repetivel.minimo) {
      ps.obrig++;
      if (blocos.length >= s.repetivel.minimo) ps.feitos++;
      else ps.pend.push({ secao: s, tipo: "bloco", texto: s.repetivel.adicionar });
    }
    blocos.forEach((b, bi) => {
      const pb = { obrig: 0, feitos: 0 };
      s.itens.forEach((it) => {
        const chave = auChave(s.id, it.id, b && b._id);
        const v = b ? b.r[it.id] : (reg.respostas || {})[chave];
        const nf = auFotos(reg, chave).length;
        if (it.tipo === "foto") out.fotos += nf;
        const ok = auRespondido(it, v, nf);
        ps.total++;
        if (ok) ps.respondidos++;
        if (!it.obrigatorio) return;
        ps.obrig++;
        pb.obrig++;
        if (ok) {
          ps.feitos++;
          pb.feitos++;
        } else {
          const faltam = it.tipo === "foto" ? (it.minimo || 1) - nf : 0;
          ps.pend.push({ secao: s, item: it, chave, bloco: b, bi, faltam });
        }
      });
      if (b) ps.blocos.push(pb);
    });
    out.obrig += ps.obrig;
    out.feitos += ps.feitos;
    out.total += ps.total;
    out.respondidos += ps.respondidos;
    out.pend.push(...ps.pend);
  });
  out.pct = out.obrig ? Math.round((out.feitos / out.obrig) * 100) : 0;
  return out;
}

function auTextoPendencia(p) {
  if (p.tipo === "bloco") return p.texto;
  const prefixo = p.bloco ? p.secao.repetivel.rotulo + " " + (p.bi + 1) + " · " : "";
  if (p.item.tipo === "foto") {
    return prefixo + p.item.pergunta + " — " + (p.faltam === 1 ? "falta 1 foto" : "faltam " + p.faltam + " fotos");
  }
  return prefixo + p.item.pergunta;
}

// ---------------------------------------------------------------- Criação

function contagemModelo(m) {
  let itens = 0;
  let fotos = 0;
  m.secoes.forEach((s) =>
    s.itens.forEach((it) => {
      itens++;
      if (it.tipo === "foto" && it.obrigatorio) fotos += it.minimo || 1;
    })
  );
  return { secoes: m.secoes.length, itens, fotos };
}

function escolherModeloAuditoria() {
  const icones = {
    "Avaliação Preliminar (Fase I)": "scan-search",
    "Due Diligence Ambiental (EDD)": "briefcase",
    "Licenciamento ambiental": "file-check-2",
  };
  const grupos = tiposAuditoria()
    .map((tipo) => {
      const ms = MODELOS_AUDITORIA.filter((m) => m.tipo === tipo);
      return `
        <div class="au-tipo">
          <div class="au-tipo-nome">${ic(icones[tipo] || "clipboard-check")}${esc(tipo)}</div>
          ${ms
            .map((m) => {
              const c = contagemModelo(m);
              return `<button type="button" class="opcao" data-modelo="${m.id}">
                <span class="txt"><strong>${esc(m.referencia)}</strong>
                <small>${c.secoes} seções · ${c.itens} itens · ${c.fotos} fotos obrigatórias</small></span>
                ${ic("chevron-right", "i-p")}</button>`;
            })
            .join("")}
        </div>`;
    })
    .join("");
  const f = Folhas.abrir({
    titulo: "Nova auditoria",
    classe: "alta",
    html: `<p class="ajuda" style="margin-bottom:16px">Escolha o tipo de estudo e a referência. O roteiro mostra as perguntas, os documentos e as fotos de cada etapa da vistoria.</p>
      ${grupos}
      <p class="ajuda au-nota">${ic("info", "i-p")}<span>Roteiros preliminares, para revisão da equipe técnica. Um roteiro novo entra como uma lista de perguntas, sem mudar o app.</span></p>`,
  });
  f.corpo.addEventListener("click", (e) => {
    const b = e.target.closest("[data-modelo]");
    if (b) f.fechar(b.dataset.modelo);
  });
  return f.promessa;
}

function criarAuditoria(modeloId, p) {
  const m = modeloAuditoria(modeloId);
  const eq = Dados.config.equipe || {};
  const agora = Date.now();
  const reg = {
    id: Dados.novoId("auditorias"),
    modeloId: m.id,
    modeloVersao: m.versao,
    tipo: m.tipo,
    referencia: m.referencia,
    projetoId: p ? p.id : null,
    projeto: p ? p.numero || "" : "",
    cliente: p ? p.cliente || "" : "",
    local: p ? p.local || "" : "",
    data: hojeISO(),
    equipe: [eq.responsavel, eq.auxiliares].filter(Boolean).join(", "),
    respostas: {},
    blocos: {},
    fotos: {},
    criadoEm: agora,
    atualizadoEm: agora,
  };
  // Pré-preenche o que o projeto já informa
  const s0 = m.secoes[0];
  if (reg.local && s0.itens.some((it) => it.id === "endereco")) reg.respostas[s0.id + ".endereco"] = reg.local;
  if (reg.cliente && s0.itens.some((it) => it.id === "razao")) reg.respostas[s0.id + ".razao"] = reg.cliente;
  m.secoes.forEach((s) => {
    if (s.repetivel) return;
    s.itens.forEach((it) => {
      if (it.tipo === "data" && /vistoria/i.test(it.pergunta)) reg.respostas[s.id + "." + it.id] = reg.data;
    });
  });
  Dados.salvar("auditorias", reg);
  return reg;
}

async function novaAuditoriaFluxo(projetoId) {
  const modeloId = await escolherModeloAuditoria();
  if (!modeloId) return;
  let p = projetoId ? projetoPorId(projetoId) : null;
  if (!projetoId) {
    const projetos = Dados.lista("projetos")
      .slice()
      .sort((a, b) => atividadeProjeto(b) - atividadeProjeto(a));
    if (projetos.length) {
      const v = await escolher({
        titulo: "Projeto da auditoria",
        texto: "A auditoria fica na pasta do projeto, junto com os demais registros.",
        busca: projetos.length > 6,
        itens: projetos
          .map((x) => ({
            rotulo: x.numero || "(sem nº)",
            detalhe: [x.cliente, x.local].filter(Boolean).join(" · "),
            valor: x.id,
            icone: "folder",
          }))
          .concat([{ rotulo: "Sem projeto", detalhe: "Vincular depois", valor: "sem", icone: "file-text" }]),
      });
      if (v == null) return;
      p = v === "sem" ? null : projetoPorId(v);
    }
  }
  const reg = criarAuditoria(modeloId, p);
  Nav.ir("auditoria", { id: reg.id });
}

// ---------------------------------------------------------------- Visão geral

TELAS.auditoria = {
  id: "tela-auditoria",
  titulo: (params) => {
    const r = Dados.achar("auditorias", params.id);
    return { titulo: r ? nomeCurtoAuditoria(r) : "Auditoria", sub: r ? [r.projeto, r.cliente].filter(Boolean).join(" · ") : "" };
  },
  acoesBarra: () => [
    { icone: "pencil", acao: "au-dados", rotulo: "Dados da auditoria" },
    { icone: "ellipsis", acao: "au-mais", rotulo: "Mais opções" },
  ],
  abrir(params) {
    AU.id = params.id;
    renderAuditoria();
  },
};

// Faixa de estratos: cada seção é uma camada; a largura acompanha o número
// de itens obrigatórios e o preenchimento mostra o quanto foi registrado.
function auEstratosHTML(m, pr) {
  return `<div class="au-estratos" aria-hidden="true">${m.secoes
    .map((s) => {
      const ps = pr.secoes[s.id];
      if (!ps.cond.ok) return `<span class="au-estrato na" style="flex-grow:1" title="${esc(s.titulo)}"></span>`;
      const peso = Math.max(1, ps.obrig);
      const fr = ps.obrig ? ps.feitos / ps.obrig : ps.respondidos ? 1 : 0;
      return `<span class="au-estrato${fr >= 1 ? " ok" : ""}" style="flex-grow:${peso}" title="${esc(s.titulo)}"><i style="width:${Math.round(
        fr * 100
      )}%"></i></span>`;
    })
    .join("")}</div>`;
}

function auPrimeiraPendente(m, reg, pr) {
  const s = m.secoes.find((x) => {
    const ps = pr.secoes[x.id];
    return ps.cond.ok && ps.pend.length;
  });
  return s || null;
}

function renderAuditoria() {
  const reg = auReg();
  if (!reg) {
    Nav.voltarOu("inicio");
    return;
  }
  const m = modeloAuditoria(reg.modeloId);
  const pr = auProgresso(reg, m);
  $("#au-cab").innerHTML = `
    <div class="au-cab">
      <h1 class="titulo-secao">${esc(m.tipo)}</h1>
      <div class="au-refs"><span class="selo">${esc(m.referencia)}</span><span class="selo areia">Roteiro ${esc(m.versao)}</span></div>
      <div class="meta">
        ${reg.local ? `<span>${ic("map-pin")}${esc(reg.local)}</span>` : ""}
        <span>${ic("calendar")}${esc(dataBR(reg.data) || "sem data")}</span>
        ${reg.equipe ? `<span>${ic("users")}${esc(reg.equipe)}</span>` : ""}
      </div>
      ${auEstratosHTML(m, pr)}
      <div class="au-prog"><b>${pr.pct}%</b><span>${pr.feitos} de ${pr.obrig} itens obrigatórios · ${pr.fotos} ${pr.fotos === 1 ? "foto" : "fotos"}</span></div>
    </div>`;

  $("#au-pendencias").innerHTML = pr.pend.length
    ? `<div class="aviso alerta au-aviso">${ic("clipboard-list")}
        <div class="aviso-corpo"><strong>${pr.pend.length} ${pr.pend.length === 1 ? "pendência" : "pendências"}</strong> para o registro ficar completo.
          <div class="aviso-acoes"><button type="button" class="bt bt-sec bt-peq" data-acao="au-pendencias">Ver pendências</button></div>
        </div></div>`
    : `<div class="aviso ok au-aviso">${ic("circle-check")}<div class="aviso-corpo"><strong>Registro completo.</strong> Todos os itens obrigatórios foram preenchidos.</div></div>`;

  $("#au-secoes").innerHTML = m.secoes
    .map((s, i) => {
      const ps = pr.secoes[s.id];
      if (!ps.cond.ok) {
        const motivo = ps.cond.pendente
          ? "Depende da resposta a “" + ps.cond.perg + "”"
          : "Não se aplica: “" + ps.cond.perg + "” = " + ps.cond.resposta;
        return `<div class="au-sec na"><span class="au-sec-n">${i + 1}</span>
          <span class="txt"><strong>${esc(s.titulo)}</strong><small>${esc(motivo)}</small></span></div>`;
      }
      const completo = ps.obrig ? ps.feitos === ps.obrig : ps.respondidos > 0;
      let detalhe;
      if (s.repetivel) {
        const n = ((reg.blocos || {})[s.id] || []).length;
        const nome = s.repetivel.rotulo.toLowerCase();
        detalhe = n ? n + " " + (n === 1 ? nome : nome + "s") : "Nenhum registro";
        if (ps.pend.length) detalhe += " · " + ps.pend.length + (ps.pend.length === 1 ? " pendência" : " pendências");
      } else if (completo) {
        detalhe = ps.respondidos + " de " + ps.total + " itens respondidos";
      } else if (ps.pend.length) {
        detalhe = ps.pend.length + (ps.pend.length === 1 ? " pendência: " : " pendências: ") + ps.pend.map((p) => p.item ? p.item.pergunta : p.texto).slice(0, 2).join("; ") + (ps.pend.length > 2 ? "…" : "");
      } else {
        detalhe = ps.respondidos + " de " + ps.total + " itens respondidos";
      }
      return `<button type="button" class="au-sec${completo ? " ok" : ps.respondidos ? " parcial" : ""}" data-acao="au-secao" data-secao="${s.id}">
        <span class="au-sec-n">${completo ? ic("check") : i + 1}</span>
        <span class="txt"><strong>${esc(s.titulo)}</strong><small>${esc(detalhe)}</small></span>
        ${ic("chevron-right", "i-p")}
      </button>`;
    })
    .join("");

  const prox = auPrimeiraPendente(m, reg, pr);
  $("#au-continuar").innerHTML = prox
    ? ic("arrow-right") + "<span>" + (pr.feitos ? "Continuar: " : "Começar: ") + esc(prox.titulo) + "</span>"
    : ic("share-2") + "<span>Exportar</span>";
  $("#au-continuar").dataset.secao = prox ? prox.id : "";
  $("#au-exportar-sec").classList.toggle("oculto", !prox);
  auMostrarEstado(reg);
}

function auMostrarEstado(reg) {
  let txt = "";
  // Só confirma o salvamento das alterações recentes (desta sessão)
  if (reg && reg.atualizadoEm && Date.now() - reg.atualizadoEm < 10 * 60000) txt = "Salvo";
  ["au-estado", "as-estado"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = txt ? ic("save", "i-p") + esc(txt) : "";
  });
}

async function verPendenciasAuditoria() {
  const reg = auReg();
  if (!reg) return;
  const m = modeloAuditoria(reg.modeloId);
  const pr = auProgresso(reg, m);
  const itens = pr.pend.map((p, i) => ({
    rotulo: auTextoPendencia(p),
    detalhe: p.secao.titulo,
    valor: i,
    icone: p.item && p.item.tipo === "foto" ? "camera" : p.item && p.item.tipo === "documento" ? "file-text" : p.tipo === "bloco" ? "list-plus" : "circle-dashed",
  }));
  const i = await escolher({ titulo: pr.pend.length + (pr.pend.length === 1 ? " pendência" : " pendências"), itens, busca: itens.length > 8 });
  if (i == null) return;
  const p = pr.pend[i];
  if (p.bloco) AU.blocoAberto = p.bloco._id;
  Nav.ir("audSecao", { id: reg.id, secao: p.secao.id, foco: p.chave || "" });
}

async function editarDadosAuditoria() {
  const reg = auReg();
  if (!reg) return;
  const v = await pedirValores({
    titulo: "Dados da auditoria",
    campos: [
      { id: "projeto", rotulo: "Projeto", valor: reg.projeto, placeholder: "P000" },
      { id: "cliente", rotulo: "Cliente", valor: reg.cliente },
      { id: "local", rotulo: "Local", valor: reg.local, placeholder: "Município – UF" },
      { id: "data", rotulo: "Data da vistoria", tipo: "date", valor: reg.data },
      { id: "equipe", rotulo: "Equipe", valor: reg.equipe },
    ],
    ok: "Salvar",
  });
  if (!v) return;
  const numero = projetoDeCampo(v.projeto);
  const p = projetoPorNumero(numero);
  Object.assign(reg, {
    projeto: numero,
    projetoId: p ? p.id : reg.projeto === numero ? reg.projetoId : null,
    cliente: v.cliente || (p && p.cliente) || "",
    local: v.local || (p && p.local) || "",
    data: v.data || reg.data,
    equipe: v.equipe,
    atualizadoEm: Date.now(),
  });
  Dados.salvar("auditorias", reg);
  atualizarTelaAtual();
  toast("Dados da auditoria salvos");
}

async function maisAuditoria(id) {
  const reg = Dados.achar("auditorias", id || AU.id);
  if (!reg) return;
  const p = reg.projetoId ? projetoPorId(reg.projetoId) : null;
  const itens = [
    { rotulo: "Exportar anexo e arquivo para o Claude", detalhe: "PDF + .md", valor: "exportar", icone: "share-2" },
    { rotulo: "Copiar texto para o Claude", detalhe: "Para colar direto numa conversa", valor: "copiar", icone: "clipboard-copy" },
  ];
  if (p) itens.push({ rotulo: "Abrir o projeto " + p.numero, valor: "projeto", icone: "folder-open" });
  itens.push({ rotulo: "Excluir auditoria", valor: "excluir", icone: "trash-2" });
  const op = await menuAcoes(nomeCurtoAuditoria(reg) + (reg.projeto ? " · " + reg.projeto : ""), itens);
  if (op === "exportar") exportarAuditoria(reg.id);
  else if (op === "copiar") copiarMDAuditoria(reg.id);
  else if (op === "projeto") Nav.ir("projeto", { id: p.id });
  else if (op === "excluir") excluirAuditoria(reg.id);
}

function excluirAuditoria(id) {
  const reg = Dados.achar("auditorias", id);
  if (!reg) return;
  const ids = [];
  Object.values(reg.fotos || {}).forEach((l) => (l || []).forEach((f) => ids.push(f.id)));
  const naTela = Nav.topo() && (Nav.topo().tela === "auditoria" || Nav.topo().tela === "audSecao");
  if (naTela) Nav.voltarOu("inicio");
  excluirComDesfazer("auditorias", id, nomeCurtoAuditoria(reg) + " excluída", {
    aoExpirar: () => ids.forEach((fid) => Dados.fotoRemover(fid)),
  });
}

// ---------------------------------------------------------------- Seção

TELAS.audSecao = {
  id: "tela-aud-secao",
  titulo: (params) => {
    const r = Dados.achar("auditorias", params.id);
    if (!r) return { titulo: "Auditoria" };
    const m = modeloAuditoria(r.modeloId);
    const i = m.secoes.findIndex((s) => s.id === params.secao);
    const s = m.secoes[i] || m.secoes[0];
    return { titulo: s.titulo, sub: "Seção " + (Math.max(i, 0) + 1) + " de " + m.secoes.length + " · " + nomeCurtoAuditoria(r) };
  },
  abrir(params, opcoes) {
    AU.id = params.id;
    AU.secao = params.secao;
    renderSecaoAud(opcoes && opcoes.voltando ? "" : params.foco);
  },
  aoSair() {
    auSalvarDep.agora();
    Object.values(AU.urls).forEach((u) => {
      try {
        URL.revokeObjectURL(u);
      } catch (e) {}
    });
    AU.urls = {};
  },
};

function auFmtCoord(v) {
  if (!v || v.lat == null) return "";
  const lat = Number(v.lat);
  const lon = Number(v.lon);
  return fmtDec(lat, 5) + ", " + fmtDec(lon, 5) + (v.prec ? " (±" + v.prec + " m)" : "") + " · " + utmTexto(lat, lon);
}

function auControleHTML(it, chave, v, fotos, idEl) {
  const val = v == null ? "" : v;
  switch (it.tipo) {
    case "texto_longo":
      return `<textarea class="entrada au-longo" id="${idEl}-c" data-au="${esc(chave)}" rows="3">${esc(val)}</textarea>`;
    case "numero":
      return `<div class="au-unid"><input class="entrada num" type="text" inputmode="decimal" id="${idEl}-c" data-au="${esc(chave)}" value="${esc(val)}" autocomplete="off">${
        it.unidade ? `<span>${esc(it.unidade)}</span>` : ""
      }</div>`;
    case "data":
      return `<input class="entrada" type="date" id="${idEl}-c" data-au="${esc(chave)}" value="${esc(val)}">`;
    case "selecao":
    case "multipla": {
      const sel = it.tipo === "multipla" ? (Array.isArray(v) ? v : []) : [v];
      return `<div class="chips au-chips" role="${it.tipo === "multipla" ? "group" : "radiogroup"}">${it.opcoes
        .map(
          (o) =>
            `<button type="button" class="chip" data-acao="as-op" data-chave="${esc(chave)}" data-v="${esc(o)}" aria-pressed="${sel.includes(o)}">${
              sel.includes(o) ? ic("check", "i-p") : ""
            }${esc(o)}</button>`
        )
        .join("")}</div>`;
    }
    case "sim_nao_na":
    case "documento": {
      const lista = it.tipo === "documento" ? AU_DOC : AU_SNN;
      const atual = (v && v.v) || "";
      const ph =
        it.tipo === "documento"
          ? atual === "solicitado"
            ? "A quem foi pedido e quando"
            : "Nº, data, observações"
          : atual === "sim"
            ? "Descreva: onde, o quê, desde quando"
            : "Observação (opcional)";
      return `<div class="segmento au-seg">${lista
        .map(
          ([k, rot]) =>
            `<button type="button" data-acao="as-op" data-chave="${esc(chave)}" data-v="${k}" aria-pressed="${atual === k}">${esc(rot)}</button>`
        )
        .join("")}</div>${
        atual
          ? `<textarea class="entrada au-obs" data-au-obs="${esc(chave)}" rows="1" placeholder="${esc(ph)}">${esc((v && v.obs) || "")}</textarea>`
          : ""
      }`;
    }
    case "gps":
      return `<div class="au-gps">
        ${v && v.lat != null ? `<div class="gps-info">${ic("map-pin", "i-p")}<span>${esc(auFmtCoord(v))}</span></div>` : ""}
        <div class="botoes">
          <button type="button" class="bt bt-sec bt-peq" data-acao="as-gps" data-chave="${esc(chave)}">${ic("locate-fixed", "i-p")}${
            v && v.lat != null ? "Capturar de novo" : "Capturar coordenadas"
          }</button>
          ${v && v.lat != null ? `<button type="button" class="bt bt-fan bt-peq" data-acao="as-gps-limpar" data-chave="${esc(chave)}">Limpar</button>` : ""}
        </div></div>`;
    case "foto": {
      const min = it.minimo || 1;
      return `<div class="fotos au-fotos">${fotos
        .map(
          (f, i) => `<div class="foto">
            <img data-fid="${esc(f.id)}" alt="Foto ${i + 1}">
            <button type="button" class="foto-x" data-acao="as-foto-remover" data-chave="${esc(chave)}" data-fid="${esc(f.id)}" aria-label="Remover foto">${ic("x")}</button>
            <input class="entrada" type="text" data-au-leg="${esc(chave)}" data-fid="${esc(f.id)}" value="${esc(f.legenda || "")}" placeholder="Legenda">
          </div>`
        )
        .join("")}</div>
        <div class="au-foto-acoes">
          <button type="button" class="bt bt-sec bt-peq" data-acao="as-foto-camera" data-chave="${esc(chave)}">${ic("camera", "i-p")}Tirar foto</button>
          <button type="button" class="bt bt-sec bt-peq" data-acao="as-foto-galeria" data-chave="${esc(chave)}">${ic("images", "i-p")}Da galeria</button>
          <span class="mini texto-3">${fotos.length} de ${min} ${min === 1 ? "mínima" : "mínimas"}</span>
        </div>`;
    }
    default:
      return `<input class="entrada" type="text" id="${idEl}-c" data-au="${esc(chave)}" value="${esc(val)}" autocomplete="off">`;
  }
}

function auMarcaHTML(it, ok) {
  if (ok) return `<span class="au-ok" title="Respondido">${ic("check")}</span>`;
  return it.obrigatorio ? `<span class="au-obrig">Obrigatório</span>` : "";
}

function auItemHTML(reg, s, it, bloco) {
  const chave = auChave(s.id, it.id, bloco && bloco._id);
  const v = auLer(reg, chave);
  const fotos = auFotos(reg, chave);
  const ok = auRespondido(it, v, fotos.length);
  const idEl = "au-" + chave.replace(/[^\w-]/g, "_");
  return `<div class="au-item${ok ? " ok" : ""}" data-chave="${esc(chave)}" id="${idEl}">
    <div class="au-perg"><label class="rotulo" ${["texto", "texto_longo", "numero", "data"].includes(it.tipo) ? `for="${idEl}-c"` : ""}>${esc(it.pergunta)}</label>${auMarcaHTML(it, ok)}</div>
    ${it.ajuda ? `<p class="ajuda au-ajuda">${esc(it.ajuda)}</p>` : ""}
    ${auControleHTML(it, chave, v, fotos, idEl)}
  </div>`;
}

function auBlocoHTML(reg, s, b, bi, aberto) {
  const t = auTituloBloco(s, b, bi);
  let obrig = 0;
  let feitos = 0;
  s.itens.forEach((it) => {
    if (!it.obrigatorio) return;
    obrig++;
    const chave = auChave(s.id, it.id, b._id);
    if (auRespondido(it, b.r[it.id], auFotos(reg, chave).length)) feitos++;
  });
  return `<article class="au-bloco${aberto ? " aberto" : ""}" data-bloco="${esc(b._id)}">
    <button type="button" class="au-bloco-cab" data-acao="as-bloco-alternar" aria-expanded="${aberto}">
      <span class="au-bloco-n">${bi + 1}</span>
      <span class="txt"><strong>${esc(t.nome)}</strong>${t.detalhe ? `<small>${esc(t.detalhe)}</small>` : ""}</span>
      <span class="selo${feitos === obrig ? " ok" : ""}">${feitos}/${obrig}</span>
      ${ic("chevron-down", "au-bloco-seta")}
    </button>
    <div class="au-bloco-corpo">
      ${s.itens.map((it) => auItemHTML(reg, s, it, b)).join("")}
      <button type="button" class="bt bt-fan bt-peq au-remover" data-acao="as-bloco-remover" data-bloco="${esc(b._id)}">${ic("trash-2", "i-p")}Remover ${esc(
    s.repetivel.rotulo.toLowerCase()
  )} ${bi + 1}</button>
    </div>
  </article>`;
}

function auSecaoAtual(reg) {
  const m = modeloAuditoria(reg.modeloId);
  return { m, s: m.secoes.find((x) => x.id === AU.secao) || m.secoes[0] };
}

function renderSecaoAud(foco) {
  const reg = auReg();
  if (!reg) {
    Nav.voltarOu("inicio");
    return;
  }
  const { m, s } = auSecaoAtual(reg);
  AU.secao = s.id;
  let html = s.descricao ? `<p class="ajuda au-desc">${esc(s.descricao)}</p>` : "";
  html += `<div class="au-sec-prog" id="as-prog"></div>`;
  if (s.repetivel) {
    const blocos = (reg.blocos || {})[s.id] || [];
    if (!blocos.some((b) => b._id === AU.blocoAberto)) AU.blocoAberto = blocos.length ? blocos[blocos.length - 1]._id : null;
    html += blocos.length
      ? `<div class="au-blocos">${blocos.map((b, bi) => auBlocoHTML(reg, s, b, bi, b._id === AU.blocoAberto)).join("")}</div>`
      : `<div class="vazio au-vazio">${ic("list-plus")}<p>Nenhum registro nesta seção ainda.</p></div>`;
    html += `<button type="button" class="bt bt-sec bt-largo" data-acao="as-bloco-novo">${ic("plus")}${esc(s.repetivel.adicionar)}</button>`;
  } else {
    html += s.itens.map((it) => auItemHTML(reg, s, it, null)).join("");
  }
  $("#as-itens").innerHTML = html;
  auAtualizarProgSecao();
  auCarregarMiniaturas($("#as-itens"));
  $$("#as-itens textarea").forEach(autoAlturaAu);

  // Navegação entre seções aplicáveis
  const nav = m.secoes.filter((x) => x.id === s.id || auCondicao(m, reg, x).ok);
  const i = nav.findIndex((x) => x.id === s.id);
  const ant = nav[i - 1];
  const prox = nav[i + 1];
  $("#as-anterior").dataset.secao = ant ? ant.id : "";
  $("#as-anterior").classList.toggle("oculto", !ant);
  $("#as-proxima").dataset.secao = prox ? prox.id : "";
  $("#as-proxima").innerHTML = prox
    ? `<span>${esc(prox.titulo)}</span>${ic("chevron-right")}`
    : `${ic("check")}<span>Concluir roteiro</span>`;
  auMostrarEstado(reg);

  if (foco) {
    requestAnimationFrame(() => {
      const el = document.querySelector(`.au-item[data-chave="${CSS.escape(foco)}"]`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("destaque");
      setTimeout(() => el.classList.remove("destaque"), 1800);
    });
  }
}

function auAtualizarProgSecao() {
  const reg = auReg();
  const el = document.getElementById("as-prog");
  if (!reg || !el) return;
  const { m, s } = auSecaoAtual(reg);
  const ps = auProgresso(reg, m).secoes[s.id];
  const fr = ps.obrig ? ps.feitos / ps.obrig : ps.total ? ps.respondidos / ps.total : 0;
  el.innerHTML = `<div class="au-mini-barra"><i style="width:${Math.round(fr * 100)}%"></i></div>
    <span>${ps.obrig ? ps.feitos + " de " + ps.obrig + " obrigatórios" : ps.respondidos + " de " + ps.total + " respondidos"}${
    ps.total > ps.obrig ? " · " + ps.respondidos + " de " + ps.total + " no total" : ""
  }</span>`;
}

function autoAlturaAu(t) {
  t.style.height = "auto";
  t.style.height = Math.max(t.classList.contains("au-obs") ? 52 : 92, t.scrollHeight + 3) + "px";
}

async function auCarregarMiniaturas(raiz) {
  for (const img of $$("img[data-fid]", raiz)) {
    const id = img.dataset.fid;
    if (!AU.urls[id]) {
      const blob = await Dados.fotoObter(id);
      if (blob) AU.urls[id] = URL.createObjectURL(blob);
    }
    if (AU.urls[id]) img.src = AU.urls[id];
  }
}

function auRenderItem(chave) {
  const reg = auReg();
  const el = document.querySelector(`.au-item[data-chave="${CSS.escape(chave)}"]`);
  if (!reg || !el) return;
  const m = modeloAuditoria(reg.modeloId);
  const d = auDef(m, chave);
  if (!d) return;
  const b = d.bloco ? auBloco(reg, d.secao.id, d.bloco) : null;
  el.outerHTML = auItemHTML(reg, d.secao, d.item, b);
  const novo = document.querySelector(`.au-item[data-chave="${CSS.escape(chave)}"]`);
  if (novo) {
    auCarregarMiniaturas(novo);
    $$("textarea", novo).forEach(autoAlturaAu);
  }
}

// Depois de qualquer resposta: marca do item, progresso, título do bloco e salvamento
function auAposMudar(chave) {
  const reg = auReg();
  if (!reg) return;
  const m = modeloAuditoria(reg.modeloId);
  const d = auDef(m, chave);
  const el = document.querySelector(`.au-item[data-chave="${CSS.escape(chave)}"]`);
  if (d && el) {
    const ok = auRespondido(d.item, auLer(reg, chave), auFotos(reg, chave).length);
    el.classList.toggle("ok", ok);
    const perg = el.querySelector(".au-perg");
    const marca = perg.querySelector(".au-ok, .au-obrig");
    if (marca) marca.remove();
    perg.insertAdjacentHTML("beforeend", auMarcaHTML(d.item, ok));
  }
  if (d && d.bloco) {
    const art = document.querySelector(`.au-bloco[data-bloco="${CSS.escape(d.bloco)}"]`);
    const b = auBloco(reg, d.secao.id, d.bloco);
    if (art && b) {
      const bi = ((reg.blocos || {})[d.secao.id] || []).indexOf(b);
      const t = auTituloBloco(d.secao, b, bi);
      const txt = art.querySelector(".au-bloco-cab .txt");
      txt.innerHTML = `<strong>${esc(t.nome)}</strong>${t.detalhe ? `<small>${esc(t.detalhe)}</small>` : ""}`;
      let obrig = 0;
      let feitos = 0;
      d.secao.itens.forEach((it) => {
        if (!it.obrigatorio) return;
        obrig++;
        if (auRespondido(it, b.r[it.id], auFotos(reg, auChave(d.secao.id, it.id, b._id)).length)) feitos++;
      });
      const selo = art.querySelector(".au-bloco-cab .selo");
      selo.textContent = feitos + "/" + obrig;
      selo.classList.toggle("ok", feitos === obrig);
    }
  }
  auAtualizarProgSecao();
  auSalvarDep();
}

const auSalvarDep = debounce(() => {
  const reg = auReg();
  if (!reg) return;
  reg.atualizadoEm = Date.now();
  Dados.salvar("auditorias", reg);
  auMostrarEstado(reg);
}, 450);

window.addEventListener("pagehide", () => auSalvarDep.agora());
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") auSalvarDep.agora();
});

// Avisa quando uma resposta inclui ou tira uma seção do roteiro
function auAvisarCondicao(chave, antes) {
  const reg = auReg();
  if (!reg) return;
  const m = modeloAuditoria(reg.modeloId);
  m.secoes.forEach((s) => {
    if (!s.mostrar_se || s.mostrar_se.item !== chave) return;
    const agora = auCondicao(m, reg, s).ok;
    if (agora && !antes[s.id]) toast("Seção “" + s.titulo + "” incluída no roteiro", { icone: "list-plus" });
    else if (!agora && antes[s.id]) toast("Seção “" + s.titulo + "” fora do roteiro", { icone: "info" });
  });
}

function auCapturarGPS(chave, btn) {
  if (!navigator.geolocation) {
    alerta("GPS não disponível neste aparelho ou navegador.");
    return;
  }
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = ic("locate-fixed", "i-p") + "Buscando…";
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const reg = auReg();
      if (!reg) return;
      auGravar(reg, chave, {
        lat: Number(pos.coords.latitude.toFixed(6)),
        lon: Number(pos.coords.longitude.toFixed(6)),
        prec: Math.round(pos.coords.accuracy || 0),
      });
      auRenderItem(chave);
      auAposMudar(chave);
    },
    (err) => {
      btn.disabled = false;
      btn.innerHTML = original;
      alerta("Não foi possível obter a posição (" + err.message + "). Verifique a permissão de localização do navegador.", { titulo: "GPS" });
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

async function auAdicionarFotos(input) {
  const files = Array.from(input.files || []);
  input.value = "";
  const chave = AU.fotoAlvo;
  const reg = auReg();
  if (!files.length || !chave || !reg) return;
  toast("Processando " + files.length + (files.length === 1 ? " foto…" : " fotos…"), { icone: "image" });
  reg.fotos = reg.fotos || {};
  const lista = reg.fotos[chave] || (reg.fotos[chave] = []);
  for (const f of files) {
    const blob = await redimensionarImagem(f);
    const id = "f" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
    await Dados.fotoSalvar(id, blob);
    AU.urls[id] = URL.createObjectURL(blob);
    lista.push({ id, legenda: "" });
  }
  auRenderItem(chave);
  auAposMudar(chave);
  auSalvarDep.agora();
}

Object.assign(ACOES, {
  "nova-auditoria": (el) => novaAuditoriaFluxo(el.dataset.projeto ? Number(el.dataset.projeto) : null),
  "abrir-auditoria": (el) => Nav.ir("auditoria", { id: Number(el.dataset.id) }),
  "au-secao": (el) => Nav.ir("audSecao", { id: AU.id, secao: el.dataset.secao }),
  "au-continuar": (el) => {
    if (el.dataset.secao) Nav.ir("audSecao", { id: AU.id, secao: el.dataset.secao });
    else exportarAuditoria(AU.id);
  },
  "au-exportar": () => exportarAuditoria(AU.id),
  "au-copiar": () => copiarMDAuditoria(AU.id),
  "au-pendencias": () => verPendenciasAuditoria(),
  "au-dados": () => editarDadosAuditoria(),
  "au-mais": () => maisAuditoria(AU.id),
  "au-excluir": () => excluirAuditoria(AU.id),
  "as-anterior": (el) => {
    if (el.dataset.secao) Nav.ir("audSecao", { id: AU.id, secao: el.dataset.secao }, { substituir: true });
  },
  "as-proxima": (el) => {
    auSalvarDep.agora();
    if (el.dataset.secao) Nav.ir("audSecao", { id: AU.id, secao: el.dataset.secao }, { substituir: true });
    else Nav.voltarOu("auditoria", { id: AU.id });
  },
  "as-op": (el) => {
    const reg = auReg();
    if (!reg) return;
    const m = modeloAuditoria(reg.modeloId);
    const chave = el.dataset.chave;
    const d = auDef(m, chave);
    if (!d) return;
    const antes = {};
    m.secoes.forEach((s) => (antes[s.id] = auCondicao(m, reg, s).ok));
    const v = el.dataset.v;
    const atual = auLer(reg, chave);
    if (d.item.tipo === "multipla") {
      const arr = Array.isArray(atual) ? atual.slice() : [];
      const i = arr.indexOf(v);
      if (i >= 0) arr.splice(i, 1);
      else arr.push(v);
      auGravar(reg, chave, arr);
    } else if (d.item.tipo === "selecao") {
      auGravar(reg, chave, atual === v ? "" : v);
    } else {
      const obj = Object.assign({}, atual || {});
      if (obj.v === v) delete obj.v;
      else obj.v = v;
      auGravar(reg, chave, obj);
    }
    vibrar(8);
    auRenderItem(chave);
    auAposMudar(chave);
    if (!d.bloco) auAvisarCondicao(chave, antes);
  },
  "as-gps": (el) => auCapturarGPS(el.dataset.chave, el),
  "as-gps-limpar": (el) => {
    const reg = auReg();
    if (!reg) return;
    auGravar(reg, el.dataset.chave, null);
    auRenderItem(el.dataset.chave);
    auAposMudar(el.dataset.chave);
  },
  "as-foto-camera": (el) => {
    AU.fotoAlvo = el.dataset.chave;
    $("#au-foto-camera").click();
  },
  "as-foto-galeria": (el) => {
    AU.fotoAlvo = el.dataset.chave;
    $("#au-foto-galeria").click();
  },
  "as-foto-remover": (el) => {
    const reg = auReg();
    if (!reg) return;
    const chave = el.dataset.chave;
    const lista = auFotos(reg, chave);
    const i = lista.findIndex((f) => f.id === el.dataset.fid);
    if (i < 0) return;
    const foto = lista.splice(i, 1)[0];
    auRenderItem(chave);
    auAposMudar(chave);
    toast("Foto removida", {
      acao: "Desfazer",
      icone: "trash-2",
      aoAgir: () => {
        const r = Dados.achar("auditorias", reg.id);
        if (!r) return;
        r.fotos = r.fotos || {};
        (r.fotos[chave] = r.fotos[chave] || []).splice(i, 0, foto);
        auRenderItem(chave);
        auAposMudar(chave);
      },
      aoExpirar: () => Dados.fotoRemover(foto.id),
    });
  },
  "as-bloco-novo": () => {
    const reg = auReg();
    if (!reg) return;
    const { s } = auSecaoAtual(reg);
    reg.blocos = reg.blocos || {};
    const lista = reg.blocos[s.id] || (reg.blocos[s.id] = []);
    const b = { _id: "b" + Date.now().toString(36), r: {} };
    lista.push(b);
    AU.blocoAberto = b._id;
    auSalvarDep.agora();
    renderSecaoAud();
    requestAnimationFrame(() => {
      const art = document.querySelector(`.au-bloco[data-bloco="${b._id}"]`);
      if (art) art.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  },
  "as-bloco-alternar": (el) => {
    const art = el.closest(".au-bloco");
    const aberto = !art.classList.contains("aberto");
    art.classList.toggle("aberto", aberto);
    el.setAttribute("aria-expanded", String(aberto));
    if (aberto) AU.blocoAberto = art.dataset.bloco;
  },
  "as-bloco-remover": async (el) => {
    const reg = auReg();
    if (!reg) return;
    const { s } = auSecaoAtual(reg);
    const lista = (reg.blocos || {})[s.id] || [];
    const i = lista.findIndex((b) => b._id === el.dataset.bloco);
    if (i < 0) return;
    const t = auTituloBloco(s, lista[i], i);
    const ok = await confirmar("As respostas e as fotos deste registro serão apagadas.", {
      titulo: "Remover " + t.nome.toLowerCase() + (t.detalhe ? " (" + t.detalhe + ")" : "") + "?",
      ok: "Remover",
      perigo: true,
    });
    if (!ok) return;
    const b = lista.splice(i, 1)[0];
    const prefixo = s.id + "#" + b._id + ".";
    const fotos = {};
    Object.keys(reg.fotos || {}).forEach((k) => {
      if (k.startsWith(prefixo)) {
        fotos[k] = reg.fotos[k];
        delete reg.fotos[k];
      }
    });
    auSalvarDep.agora();
    renderSecaoAud();
    toast(t.nome + " removido", {
      acao: "Desfazer",
      icone: "trash-2",
      aoAgir: () => {
        const r = Dados.achar("auditorias", reg.id);
        if (!r) return;
        r.blocos[s.id].splice(i, 0, b);
        Object.assign((r.fotos = r.fotos || {}), fotos);
        auSalvarDep.agora();
        if (Nav.topo() && Nav.topo().tela === "audSecao") renderSecaoAud();
      },
      aoExpirar: () => Object.values(fotos).forEach((l) => l.forEach((f) => Dados.fotoRemover(f.id))),
    });
  },
});

document.addEventListener("input", (e) => {
  const t = e.target;
  if (!t || !t.closest || !t.closest("#tela-aud-secao")) return;
  const reg = auReg();
  if (!reg) return;
  if (t.dataset.au) {
    auGravar(reg, t.dataset.au, t.value);
    auAposMudar(t.dataset.au);
  } else if (t.dataset.auObs) {
    const v = Object.assign({}, auLer(reg, t.dataset.auObs) || {});
    v.obs = t.value;
    auGravar(reg, t.dataset.auObs, v);
    auSalvarDep();
  } else if (t.dataset.auLeg) {
    const f = auFotos(reg, t.dataset.auLeg).find((x) => x.id === t.dataset.fid);
    if (f) {
      f.legenda = t.value;
      auSalvarDep();
    }
  }
  if (t.tagName === "TEXTAREA") autoAlturaAu(t);
});

document.addEventListener("change", (e) => {
  const t = e.target;
  if (t && (t.id === "au-foto-camera" || t.id === "au-foto-galeria")) auAdicionarFotos(t);
});

// ---------------------------------------------------------------- Exportação

// Numeração única das fotos (a mesma no PDF e no .md)
function auNumerarFotos(reg, m) {
  const out = [];
  m.secoes.forEach((s) => {
    if (!auCondicao(m, reg, s).ok) return;
    const blocos = s.repetivel ? (reg.blocos || {})[s.id] || [] : [null];
    blocos.forEach((b, bi) => {
      s.itens.forEach((it) => {
        if (it.tipo !== "foto") return;
        const chave = auChave(s.id, it.id, b && b._id);
        auFotos(reg, chave).forEach((f) =>
          out.push({
            n: out.length + 1,
            id: f.id,
            chave,
            legenda: f.legenda || "",
            secao: s.titulo,
            item: (b ? s.repetivel.rotulo + " " + (bi + 1) + " · " : "") + it.pergunta,
          })
        );
      });
    });
  });
  return out;
}

function auFaixaFotos(fotosNum, chave) {
  const ns = fotosNum.filter((f) => f.chave === chave).map((f) => f.n);
  if (!ns.length) return "";
  if (ns.length === 1) return "Foto " + ns[0];
  const seguidas = ns.every((n, i) => !i || n === ns[i - 1] + 1);
  return "Fotos " + (seguidas ? ns[0] + "–" + ns[ns.length - 1] : ns.join(", "));
}

// Resposta em texto simples (para o .md); vazio = sem resposta
function auRespostaTexto(it, v, chave, fotosNum) {
  switch (it.tipo) {
    case "foto":
      return auFaixaFotos(fotosNum, chave);
    case "multipla":
      return Array.isArray(v) ? v.join("; ") : "";
    case "sim_nao_na":
    case "documento":
      if (!v || !v.v) return v && v.obs ? v.obs : "";
      return auRotuloOpcao(it, v.v) + (v.obs ? " — " + v.obs : "");
    case "gps":
      return v && v.lat != null ? auFmtCoord(v) : "";
    case "numero":
      return v != null && v !== "" ? fmtDec(v) + (it.unidade ? " " + it.unidade : "") : "";
    case "data":
      return v ? dataBR(v) : "";
    default:
      return v == null ? "" : String(v).trim();
  }
}

function auCoordenadasPrincipais(reg, m) {
  for (const s of m.secoes) {
    if (s.repetivel) continue;
    for (const it of s.itens) {
      if (it.tipo !== "gps") continue;
      const v = (reg.respostas || {})[s.id + "." + it.id];
      if (v && v.lat != null) return v;
    }
  }
  return null;
}

function nomeArquivoAuditoria(reg) {
  return [reg.projeto, nomeCurtoAuditoria(reg).replace(/ · /g, "-")].filter(Boolean).map(sanitizarNome).join("_") || "Auditoria";
}

async function montarHTMLAuditoria(reg, m, pr, fotosNum) {
  const sub = [reg.projeto, reg.cliente].filter(Boolean).join(" · ") || m.referencia;
  const ref = [reg.projeto, nomeCurtoAuditoria(reg), "Registro de campo"].filter(Boolean).join(" · ");
  const coord = auCoordenadasPrincipais(reg, m);
  const nFotos = fotosNum.length;
  const info = `
    <table class="pp-info">
      <tr>${celInfo("Cliente", esc(reg.cliente || "—"))}${celInfo("Projeto", esc(reg.projeto || "—"))}${celInfo("Data da vistoria", esc(dataBR(reg.data) || "—"))}</tr>
      <tr>${celInfo("Local", esc(reg.local || "—"), 2)}${celInfo("Coordenadas", coord ? esc(fmtDec(coord.lat, 5) + ", " + fmtDec(coord.lon, 5)) : "—")}</tr>
      <tr>${celInfo("Estudo", esc(m.tipo))}${celInfo("Referências", esc(m.referencias.join("; ")), 2)}</tr>
      <tr>${celInfo("Equipe", esc(reg.equipe || "—"), 2)}${celInfo("Roteiro", esc(m.id + " · " + m.versao))}</tr>
    </table>
    <div class="pp-au-resumo">
      <div><b>${pr.feitos}/${pr.obrig}</b><span>itens obrigatórios</span></div>
      <div><b>${pr.respondidos}/${pr.total}</b><span>itens respondidos</span></div>
      <div><b>${nFotos}</b><span>${nFotos === 1 ? "foto" : "fotos"}</span></div>
      <div class="${pr.pend.length ? "pend" : ""}"><b>${pr.pend.length}</b><span>${pr.pend.length === 1 ? "pendência" : "pendências"}</span></div>
    </div>`;

  const celula = (it, v, chave) => {
    const t = auRespostaTexto(it, v, chave, fotosNum);
    if (t) return esc(t);
    return it.obrigatorio ? `<span class="pp-au-pend">Pendente</span>` : `<span class="pp-au-nd">—</span>`;
  };
  const tabela = (s, b, rotulo) =>
    `<table class="pp-table pp-au-tab pp-paginavel" data-rotulo="${esc(rotulo)}"><colgroup><col style="width:44%"><col></colgroup><tbody>${s.itens
      .map((it) => {
        const chave = auChave(s.id, it.id, b && b._id);
        const v = b ? b.r[it.id] : (reg.respostas || {})[chave];
        return `<tr><td class="pp-au-perg">${esc(it.pergunta)}</td><td class="pp-au-resp">${celula(it, v, chave)}</td></tr>`;
      })
      .join("")}</tbody></table>`;

  const partes = [];
  const naoAplic = [];
  m.secoes.forEach((s, si) => {
    const cond = auCondicao(m, reg, s);
    const titulo = si + 1 + ". " + s.titulo;
    if (!cond.ok) {
      naoAplic.push([s.titulo, cond.pendente ? "sem resposta a “" + cond.perg + "”" : "“" + cond.perg + "” = " + cond.resposta]);
      return;
    }
    partes.push(`<div class="pp-section-label" data-com-proximo>${esc(titulo)}</div>`);
    if (s.repetivel) {
      const blocos = (reg.blocos || {})[s.id] || [];
      if (!blocos.length) partes.push(`<p class="pp-au-vazio">Nenhum registro nesta seção.</p>`);
      blocos.forEach((b, bi) => {
        const t = auTituloBloco(s, b, bi);
        const rot = t.nome + (t.detalhe ? " — " + t.detalhe : "");
        partes.push(`<div class="pp-au-sub" data-com-proximo>${esc(rot)}</div>`);
        partes.push(tabela(s, b, titulo + " · " + rot));
      });
    } else {
      partes.push(tabela(s, null, titulo));
    }
  });
  if (naoAplic.length) {
    partes.push(`<div class="pp-section-label" data-com-proximo>Seções que não se aplicam</div>`);
    partes.push(
      `<table class="pp-table pp-au-tab pp-paginavel" data-rotulo="Seções que não se aplicam"><colgroup><col style="width:44%"><col></colgroup><tbody>${naoAplic
        .map(([a, b]) => `<tr><td class="pp-au-perg">${esc(a)}</td><td>${esc(b)}</td></tr>`)
        .join("")}</tbody></table>`
    );
  }
  if (pr.pend.length) {
    partes.push(`<div class="pp-section-label" data-com-proximo>Pendências do registro</div>`);
    partes.push(
      `<table class="pp-table pp-au-tab pp-paginavel" data-rotulo="Pendências do registro"><colgroup><col style="width:44%"><col></colgroup><tbody>${pr.pend
        .map((p) => `<tr><td class="pp-au-perg">${esc(p.secao.titulo)}</td><td><span class="pp-au-pend">${esc(auTextoPendencia(p))}</span></td></tr>`)
        .join("")}</tbody></table>`
    );
  }

  const paginas = [
    paginaDoc({
      titulo: "Registro de campo · " + m.tipo,
      sub,
      ref,
      tipo: "auditoria",
      fluir: true,
      corpo: info + partes.join(""),
    }),
  ];

  if (fotosNum.length) {
    const itens = [];
    for (const f of fotosNum) {
      const blob = await Dados.fotoObter(f.id);
      if (!blob) continue;
      const url = await blobParaDataURL(blob);
      itens.push(
        `<div class="pp-foto"><img src="${url}" alt="" /><div><b>Foto ${f.n}</b> · ${esc(f.secao)} · ${esc(f.item)}${
          f.legenda ? "<br>" + esc(f.legenda) : ""
        }</div></div>`
      );
    }
    paginas.push(
      paginaDoc({
        titulo: "Registro fotográfico",
        sub,
        ref,
        tipo: "anexo",
        fluir: true,
        corpo: `<div class="pp-fotos pp-au-fotos">${itens.join("")}</div>`,
      })
    );
  }
  return paginas.join("");
}

function auMDValor(t) {
  return String(t).replace(/\r?\n/g, "\n  ");
}

function montarMDAuditoria(reg, m, pr, fotosNum, nomePDF) {
  const L = [];
  const coord = auCoordenadasPrincipais(reg, m);
  const yaml = (v) => '"' + String(v == null ? "" : v).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
  L.push("---");
  L.push("documento: " + yaml("Registro de campo para relatório técnico"));
  L.push("estudo: " + yaml(m.tipo));
  L.push("referencia: " + yaml(m.referencia));
  L.push("roteiro: " + yaml(m.id + " (" + m.versao + ")"));
  L.push("projeto: " + yaml(reg.projeto || ""));
  L.push("cliente: " + yaml(reg.cliente || ""));
  L.push("local: " + yaml(reg.local || ""));
  if (coord) L.push("coordenadas: " + yaml(coord.lat + ", " + coord.lon));
  L.push("data_da_vistoria: " + yaml(reg.data || ""));
  L.push("equipe: " + yaml(reg.equipe || ""));
  L.push("gerado_em: " + yaml(hojeISO() + " " + horaAgora()));
  L.push("itens_obrigatorios: " + yaml(pr.feitos + " de " + pr.obrig));
  L.push("pendencias: " + pr.pend.length);
  L.push("fotos: " + fotosNum.length);
  if (nomePDF) L.push("anexo_pdf: " + yaml(nomePDF));
  L.push("---", "");
  L.push("# Registro de campo — " + m.tipo + (reg.projeto ? " · " + reg.projeto : ""), "");
  L.push(
    "Gerado pelo app de campo da Archipel. Traz o que a equipe levantou na vistoria, no formato usado pelo Claude para redigir o relatório técnico. Envie junto o anexo em PDF, que contém as fotos numeradas.",
    ""
  );
  L.push("## Instruções para o Claude", "");
  L.push("Você é o redator técnico da Archipel. Redija o relatório de **" + m.tipo + "** da área descrita neste registro.", "");
  [
    "Use somente as informações deste registro e dos documentos que o usuário anexar. Não invente dados, datas, nomes, resultados nem conclusões sem base.",
    "Onde faltar informação, escreva **[PENDENTE: o que falta]** no ponto do texto e reúna esses itens em uma seção final de lacunas de informação.",
    "Siga a estrutura de capítulos e as referências indicadas abaixo.",
    "Cite as fotos pelo número do anexo (ex.: “Foto 4”) ao descrever o que foi observado.",
    "Escreva em português do Brasil, em linguagem técnica e impessoal, com frases objetivas.",
    "Separe o que foi observado em campo do que foi informado por entrevistados ou documentos.",
    "Antes do texto completo, apresente um resumo das constatações e das recomendações para revisão do responsável técnico.",
  ].forEach((t, i) => L.push(i + 1 + ". " + t));
  L.push("", "### Estrutura do relatório", "");
  (m.estrutura_relatorio || []).forEach((t, i) => L.push(i + 1 + ". " + t));
  L.push("", "### Referências", "");
  m.referencias.forEach((r) => L.push("- " + r));
  L.push("", "## Dados de campo", "");
  const naoAplic = [];
  m.secoes.forEach((s, si) => {
    const cond = auCondicao(m, reg, s);
    if (!cond.ok) {
      naoAplic.push("- " + s.titulo + " — " + (cond.pendente ? "sem resposta a “" + cond.perg + "”" : "“" + cond.perg + "” = " + cond.resposta));
      return;
    }
    L.push("### " + (si + 1) + ". " + s.titulo, "");
    const itens = (b) =>
      s.itens.forEach((it) => {
        const chave = auChave(s.id, it.id, b && b._id);
        const v = b ? b.r[it.id] : (reg.respostas || {})[chave];
        const t = auRespostaTexto(it, v, chave, fotosNum);
        L.push("- **" + it.pergunta + ":** " + (t ? auMDValor(t) : it.obrigatorio ? "**[PENDENTE]**" : "*(não informado)*"));
      });
    if (s.repetivel) {
      const blocos = (reg.blocos || {})[s.id] || [];
      if (!blocos.length) L.push("*(nenhum registro nesta seção)*");
      blocos.forEach((b, bi) => {
        const t = auTituloBloco(s, b, bi);
        L.push("#### " + t.nome + (t.detalhe ? " — " + t.detalhe : ""), "");
        itens(b);
        L.push("");
      });
    } else {
      itens(null);
      L.push("");
    }
  });
  if (naoAplic.length) {
    L.push("### Seções que não se aplicam", "");
    L.push(...naoAplic, "");
  }
  L.push("## Registro fotográfico (anexo PDF)", "");
  if (fotosNum.length) {
    L.push("| Foto | Seção | Item | Legenda |", "|---|---|---|---|");
    fotosNum.forEach((f) =>
      L.push("| " + f.n + " | " + f.secao + " | " + f.item.replace(/\|/g, "/") + " | " + (f.legenda || "").replace(/\|/g, "/") + " |")
    );
  } else {
    L.push("*(nenhuma foto registrada)*");
  }
  L.push("", "## Pendências do registro de campo", "");
  if (pr.pend.length) pr.pend.forEach((p) => L.push("- " + p.secao.titulo + " — " + auTextoPendencia(p)));
  else L.push("Nenhuma: todos os itens obrigatórios foram preenchidos.");
  L.push("");
  return L.join("\n");
}

async function copiarMDAuditoria(id) {
  const reg = Dados.achar("auditorias", id);
  if (!reg) return;
  const m = modeloAuditoria(reg.modeloId);
  const pr = auProgresso(reg, m);
  const md = montarMDAuditoria(reg, m, pr, auNumerarFotos(reg, m), nomeArquivoAuditoria(reg) + "_Anexo-campo.pdf");
  const ok = await copiarTexto(md);
  toast(ok ? "Texto copiado. Cole numa conversa com o Claude" : "Não foi possível copiar", { icone: ok ? "clipboard-copy" : "circle-alert" });
}

async function compartilharArquivos(files, titulo) {
  try {
    if (navigator.canShare && navigator.canShare({ files })) {
      await navigator.share({ files, title: titulo });
      return "ok";
    }
  } catch (e) {
    if (e && e.name === "AbortError") return "cancelado";
  }
  return "indisponivel";
}

async function exportarAuditoria(id) {
  auSalvarDep.agora();
  const reg = Dados.achar("auditorias", id);
  if (!reg) return;
  const m = modeloAuditoria(reg.modeloId);
  const pr = auProgresso(reg, m);
  if (pr.pend.length) {
    const ok = await confirmar(
      "Há " + pr.pend.length + (pr.pend.length === 1 ? " pendência" : " pendências") +
        ". Elas saem marcadas no anexo e listadas no arquivo para o Claude, que as trata como lacunas de informação.",
      { titulo: "Exportar com pendências?", ok: "Exportar assim mesmo", cancelar: "Voltar" }
    );
    if (!ok) return;
  }
  const base = nomeArquivoAuditoria(reg);
  const nomePDF = base + "_Anexo-campo";
  const fotosNum = auNumerarFotos(reg, m);
  let cancelou = false;
  const f = Folhas.abrir({
    titulo: "Gerando os arquivos…",
    html: `<p class="ajuda" data-info>Preparando as páginas…</p><div class="barra-progresso"><i data-barra></i></div>`,
  });
  f.aoFechar = () => (cancelou = true);
  let res;
  try {
    const palco = await prepararDocumento(await montarHTMLAuditoria(reg, m, pr, fotosNum));
    if (cancelou) {
      palco.remove();
      return;
    }
    res = await rasterizar(
      palco,
      nomePDF,
      (i, n) => {
        const info = f.corpo.querySelector("[data-info]");
        const barra = f.corpo.querySelector("[data-barra]");
        if (info) info.textContent = "Página " + i + " de " + n + "…";
        if (barra) barra.style.width = Math.round((i / n) * 100) + "%";
      },
      () => cancelou
    );
    $("#print-area").innerHTML = palco.innerHTML;
    palco.remove();
  } catch (e) {
    const p = document.getElementById("pdf-palco");
    if (p) p.remove();
    if (cancelou || (e && e.message === "cancelado")) return;
    console.error(e);
    f.definirTitulo("Não foi possível gerar os arquivos");
    f.corpo.innerHTML = `<div class="aviso erro">${ic("circle-alert")}<div class="aviso-corpo">${esc((e && e.message) || String(e))}</div></div>`;
    return;
  }
  if (cancelou) return;
  const md = montarMDAuditoria(reg, m, pr, fotosNum, res.file.name);
  const arqMD = new File([md], base + "_para-Claude.md", { type: "text/markdown" });
  const arqTXT = new File([md], base + "_para-Claude.txt", { type: "text/plain" });
  const podeMD = !!(navigator.canShare && navigator.canShare({ files: [res.file, arqMD] }));
  const podeTXT = !podeMD && !!(navigator.canShare && navigator.canShare({ files: [res.file, arqTXT] }));
  const pacote = podeMD ? [res.file, arqMD] : podeTXT ? [res.file, arqTXT] : null;
  f.definirTitulo("Arquivos prontos");
  f.corpo.innerHTML = `
    ${res.previa ? `<div class="export-previa"><img src="${res.previa}" alt="Primeira página do anexo"></div>` : ""}
    <div class="au-arquivos">
      <div class="au-arq">${ic("file-down")}<span class="txt"><strong>${esc(res.file.name)}</strong><small>Anexo do relatório · ${res.paginas} ${
    res.paginas === 1 ? "página" : "páginas"
  } · ${fotosNum.length} ${fotosNum.length === 1 ? "foto" : "fotos"}</small></span></div>
      <div class="au-arq">${ic("sparkle")}<span class="txt"><strong>${esc(arqMD.name)}</strong><small>Dados e instruções para o Claude redigir o relatório</small></span></div>
    </div>
    <div class="botoes-col">
      ${pacote ? `<button type="button" class="bt bt-pri bt-largo" data-b="share">${ic("share-2")}Enviar os dois…</button>` : ""}
      <button type="button" class="bt ${pacote ? "bt-sec" : "bt-pri"} bt-largo" data-b="copiar">${ic("clipboard-copy")}Copiar texto para o Claude</button>
      <div class="botoes au-baixar">
        <button type="button" class="bt bt-fan" data-b="pdf">${ic("download", "i-p")}PDF</button>
        <button type="button" class="bt bt-fan" data-b="md">${ic("download", "i-p")}.md</button>
      </div>
    </div>
    <p class="ajuda" style="margin-top:10px;text-align:center">No Claude, anexe os dois arquivos (ou cole o texto) e peça: “Redija o relatório”.</p>`;
  f.corpo.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-b]");
    if (!b) return;
    if (b.dataset.b === "share") {
      const r = await compartilharArquivos(pacote, base);
      if (r === "indisponivel") {
        baixarBlob(res.file, res.file.name);
        baixarBlob(arqMD, arqMD.name);
      }
    } else if (b.dataset.b === "copiar") {
      const ok = await copiarTexto(md);
      toast(ok ? "Texto copiado. Cole numa conversa com o Claude" : "Não foi possível copiar", { icone: ok ? "clipboard-copy" : "circle-alert" });
    } else if (b.dataset.b === "pdf") {
      baixarBlob(res.file, res.file.name);
    } else if (b.dataset.b === "md") {
      baixarBlob(arqMD, arqMD.name);
    }
  });
}

// ---------------------------------------------------------------- Cartões (início e projeto)

function cartaoAuditoriaHTML(reg) {
  const m = modeloAuditoria(reg.modeloId);
  if (!m) return "";
  const pr = auProgresso(reg, m);
  return `<button type="button" class="au-cartao" data-acao="abrir-auditoria" data-id="${reg.id}">
    <span class="au-cartao-topo"><strong>${esc(nomeCurtoAuditoria(reg))}</strong><span>${esc([reg.projeto, reg.cliente].filter(Boolean).join(" · ") || "Sem projeto")}</span></span>
    ${auEstratosHTML(m, pr)}
    <span class="au-cartao-rodape"><b>${pr.pct}%</b> · ${
    pr.pend.length ? pr.pend.length + (pr.pend.length === 1 ? " pendência" : " pendências") : "completa"
  } · ${pr.fotos} ${pr.fotos === 1 ? "foto" : "fotos"} · ${esc(tempoRelativo(reg.atualizadoEm || reg.criadoEm))}</span>
  </button>`;
}

function renderAuditoriasInicio() {
  const el = document.getElementById("ini-auditorias");
  if (!el) return;
  const lim = Date.now() - 30 * 86400000;
  const lista = Dados.lista("auditorias")
    .filter((r) => (r.atualizadoEm || r.criadoEm || 0) > lim)
    .filter((r) => {
      const m = modeloAuditoria(r.modeloId);
      return m && auProgresso(r, m).pend.length;
    })
    .sort((a, b) => (b.atualizadoEm || 0) - (a.atualizadoEm || 0))
    .slice(0, 3);
  el.innerHTML = lista.length
    ? `<div class="secao-cab"><h2 class="titulo-secao">Auditorias em andamento</h2></div>${lista.map(cartaoAuditoriaHTML).join("")}`
    : "";
}

function renderAuditoriasProjeto(p) {
  const el = document.getElementById("pj-auditorias");
  if (!el) return;
  const lista = auditoriasDoProjeto(p.id).sort((a, b) => (b.atualizadoEm || 0) - (a.atualizadoEm || 0));
  el.innerHTML = lista.length ? lista.map(cartaoAuditoriaHTML).join("") : `<p class="ajuda">Nenhuma auditoria neste projeto.</p>`;
}

Object.assign(ACOES, {
  "pj-auditoria-nova": () => {
    const p = projetoAtivo();
    novaAuditoriaFluxo(p ? p.id : null);
  },
});
