/* =========================================================================
   Tarefas, lembretes e assistente.
   Tarefas nascem no app ou de mensagens lidas pelo assistente (WhatsApp
   comercial, e-mails). Nesta prévia as mensagens são simuladas; as telas,
   os lembretes e os avisos são os que irão para o app.
   ========================================================================= */
"use strict";

const PESSOAS_PADRAO = [
  { id: "arthur", nome: "Arthur", cor: "#004F71" },
  { id: "amauri", nome: "Amauri", cor: "#1C3A63" },
  { id: "maira", nome: "Maíra", cor: "#3F6F84" },
  { id: "ralf", nome: "Ralf", cor: "#7A6450" },
  { id: "tiago", nome: "Tiago", cor: "#2F6B5E" },
];

const LEMBRETES_PADRAO = {
  novaTarefa: true,
  resumoDiario: true,
  horaResumo: "08:00",
  antes: 1, // dias antes do prazo (0 = não avisar antes)
  noDia: true,
  horaDia: "09:00",
  atrasadas: "diario", // diario | 2dias | semanal | nunca
  silencio: true,
  silencioIni: "20:00",
  silencioFim: "07:00",
  fimDeSemana: false,
  sistema: false,
};

const CANAIS = {
  whatsapp: { icone: "message-circle", nome: "WhatsApp" },
  email: { icone: "mail", nome: "E-mail" },
  app: { icone: "smartphone", nome: "App" },
};

const TF = { modo: "minhas", id: null, verConcluidas: false, velocidade: 1 };

// ---------------------------------------------------------------- Pessoas e configuração

function pessoasEquipe() {
  const l = Dados.config.pessoas;
  return Array.isArray(l) && l.length ? l : PESSOAS_PADRAO;
}

function pessoaPorId(id) {
  return pessoasEquipe().find((p) => p.id === id) || null;
}

function euId() {
  const id = Dados.config.eu;
  return pessoaPorId(id) ? id : pessoasEquipe()[0].id;
}

function nomePessoa(id) {
  const p = pessoaPorId(id);
  return p ? p.nome : id === "claude" ? "Assistente" : "—";
}

function lembretesCfg() {
  return Object.assign({}, LEMBRETES_PADRAO, Dados.config.lembretes || {});
}

function salvarLembretesCfg(mudancas) {
  Dados.config.lembretes = Object.assign(lembretesCfg(), mudancas);
  Dados.salvarConfig();
}

function avatarHTML(id, cls = "") {
  const p = pessoaPorId(id);
  if (!p) return "";
  return `<span class="avatar ${cls}" style="--cor:${esc(p.cor)}" title="${esc(p.nome)}" aria-hidden="true">${esc(
    p.nome.slice(0, 2)
  )}</span>`;
}

// ---------------------------------------------------------------- Datas

const DIAS_CURTOS = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];

function isoParaData(iso) {
  const p = partesData(iso);
  return p ? new Date(p.ano, p.mes - 1, p.dia) : null;
}

function dataParaISO(d) {
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

function hoje0() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function diasAte(iso) {
  const d = isoParaData(iso);
  return d ? Math.round((d - hoje0()) / 86400000) : null;
}

function somarDias(n) {
  const d = hoje0();
  d.setDate(d.getDate() + n);
  return dataParaISO(d);
}

// Próxima ocorrência do dia da semana (0 = domingo); hoje conta se incluirHoje
function proximoDiaSemana(dow, incluirHoje = false) {
  const d = hoje0();
  let n = (dow - d.getDay() + 7) % 7;
  if (n === 0 && !incluirHoje) n = 7;
  d.setDate(d.getDate() + n);
  return dataParaISO(d);
}

// Dias úteis à frente (sem feriados)
function diasUteis(n) {
  const d = hoje0();
  let k = 0;
  while (k < n) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) k++;
  }
  return dataParaISO(d);
}

function dataCurta(iso) {
  const d = isoParaData(iso);
  return d ? DIAS_CURTOS[d.getDay()] + ", " + pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1) : "";
}

function prazoTexto(t) {
  if (!t.prazo) return "sem prazo";
  if (t.status === "concluida") return dataCurta(t.prazo);
  const n = diasAte(t.prazo);
  if (n < -1) return "venceu há " + -n + " dias";
  if (n === -1) return "venceu ontem";
  if (n === 0) return "hoje";
  if (n === 1) return "amanhã";
  return dataCurta(t.prazo);
}

function minutos(hm) {
  const m = /^(\d{1,2}):(\d{2})/.exec(hm || "");
  return m ? +m[1] * 60 + +m[2] : 0;
}

// ---------------------------------------------------------------- Dados das tarefas

function listaTarefas() {
  return Dados.lista("tarefas");
}

function tarefasAbertas(resp) {
  return listaTarefas().filter((t) => t.status === "aberta" && (!resp || t.responsavel === resp));
}

function sugestoesPendentes() {
  return listaTarefas().filter((t) => t.status === "sugerida");
}

function tarefasDoProjeto(p) {
  return listaTarefas().filter(
    (t) => (t.status === "aberta" || t.status === "sugerida") && (t.projetoId === p.id || (!t.projetoId && p.numero && t.projeto === p.numero))
  );
}

function novaTarefaObj(dados) {
  const agora = Date.now();
  return Object.assign(
    {
      id: Dados.novoId("tarefas"),
      titulo: "",
      descricao: "",
      responsavel: euId(),
      criadoPor: euId(),
      prazo: "",
      status: "aberta",
      projeto: "",
      projetoId: null,
      origem: { canal: "app" },
      confianca: null,
      lembretes: null,
      avisos: {},
      historico: [],
      criadoEm: agora,
      atualizadoEm: agora,
    },
    dados
  );
}

function registrarHistorico(t, texto) {
  t.historico = t.historico || [];
  t.historico.push({ ts: Date.now(), texto });
}

function salvarTarefa(t) {
  t.atualizadoEm = Date.now();
  Dados.salvar("tarefas", t);
  atualizarSeloTarefas();
}

function ordemTarefa(a, b) {
  const pa = a.prazo || "9999";
  const pb = b.prazo || "9999";
  return pa.localeCompare(pb) || a.criadoEm - b.criadoEm;
}

function grupoPrazo(t) {
  if (!t.prazo) return "sem";
  const n = diasAte(t.prazo);
  if (n < 0) return "atrasadas";
  if (n === 0) return "hoje";
  if (n === 1) return "amanha";
  if (n <= 7) return "semana";
  return "depois";
}

const GRUPOS_PRAZO = [
  ["atrasadas", "Atrasadas"],
  ["hoje", "Hoje"],
  ["amanha", "Amanhã"],
  ["semana", "Próximos 7 dias"],
  ["depois", "Mais adiante"],
  ["sem", "Sem prazo"],
];

function atualizarSeloTarefas() {
  const el = document.getElementById("aba-selo-tarefas");
  if (!el) return;
  const eu = euId();
  const n =
    tarefasAbertas(eu).filter((t) => t.prazo && diasAte(t.prazo) <= 0).length +
    sugestoesPendentes().filter((t) => t.responsavel === eu).length;
  el.textContent = n > 9 ? "9+" : String(n);
  el.classList.toggle("oculto", !n);
}

// ---------------------------------------------------------------- Componentes

function origemHTML(t, curta) {
  const o = t.origem || {};
  if (!o.canal || o.canal === "app") return "";
  const c = CANAIS[o.canal] || CANAIS.app;
  return `<span class="tf-origem">${ic(c.icone)}${esc(curta ? o.conversa || c.nome : c.nome + (o.conversa ? " · " + o.conversa : ""))}</span>`;
}

function tarefaHTML(t, opcoes = {}) {
  const feita = t.status === "concluida";
  const n = t.prazo ? diasAte(t.prazo) : null;
  const atrasada = !feita && n != null && n < 0;
  const hoje = !feita && n === 0;
  return `<div class="tarefa${atrasada ? " atrasada" : ""}${feita ? " feita" : ""}" data-id="${t.id}">
    <button type="button" class="tf-check" data-acao="tf-alternar" data-id="${t.id}" aria-label="${feita ? "Reabrir" : "Concluir"} tarefa" aria-pressed="${feita}">${ic(
    "check"
  )}</button>
    <button type="button" class="tf-corpo" data-acao="tf-abrir" data-id="${t.id}">
      <span class="tf-titulo">${esc(t.titulo || "(sem título)")}</span>
      <span class="tf-meta">
        <span class="tf-prazo${atrasada ? " atrasada" : hoje ? " hoje" : ""}">${ic(atrasada ? "clock-alert" : "calendar")}${esc(prazoTexto(t))}</span>
        ${t.projeto ? `<span>${ic("folder")}${esc(t.projeto)}</span>` : ""}
        ${opcoes.semOrigem ? "" : origemHTML(t, true)}
      </span>
    </button>
    ${opcoes.comResponsavel ? avatarHTML(t.responsavel) : ""}
  </div>`;
}

function sugestaoHTML(t, opcoes = {}) {
  const o = t.origem || {};
  const c = CANAIS[o.canal] || CANAIS.app;
  return `<article class="tf-sug" data-id="${t.id}">
    <div class="tf-sug-cab">${ic("sparkle")}<span>Tarefa identificada</span>${
    t.confianca ? `<span class="selo ${t.confianca === "alta" ? "ok" : "alerta"}">confiança ${esc(t.confianca)}</span>` : ""
  }</div>
    <div class="tf-sug-titulo">${esc(t.titulo)}</div>
    <dl class="tf-sug-campos">
      <div><dt>Quem</dt><dd>${avatarHTML(t.responsavel, "peq")}<span><b>${esc(nomePessoa(t.responsavel))}</b>${
    o.porque ? `<small>${esc(o.porque)}</small>` : ""
  }</span></dd></div>
      <div><dt>Prazo</dt><dd><span><b>${t.prazo ? esc(dataCurta(t.prazo)) : "sem prazo"}</b>${o.prazoTexto ? `<small>${esc(o.prazoTexto)}</small>` : ""}</span></dd></div>
      ${t.projeto ? `<div><dt>Projeto</dt><dd><span><b>${esc(t.projeto)}</b>${o.cliente ? `<small>${esc(o.cliente)}</small>` : ""}</span></dd></div>` : ""}
      ${opcoes.semOrigem ? "" : `<div><dt>Origem</dt><dd>${ic(c.icone, "i-p")}<span>${esc(c.nome + (o.conversa ? " · " + o.conversa : ""))}</span></dd></div>`}
    </dl>
    <div class="tf-sug-acoes">
      <button type="button" class="bt bt-fan bt-peq" data-acao="tf-sug-descartar" data-id="${t.id}">Descartar</button>
      <button type="button" class="bt bt-sec bt-peq" data-acao="tf-sug-ajustar" data-id="${t.id}">Ajustar</button>
      <button type="button" class="bt bt-pri bt-peq" data-acao="tf-sug-criar" data-id="${t.id}">${ic("check", "i-p")}Criar tarefa</button>
    </div>
  </article>`;
}

// ---------------------------------------------------------------- Tela: lista

TELAS.tarefas = {
  id: "tela-tarefas",
  abas: true,
  raiz: true,
  titulo: () => ({ titulo: "Tarefas", sub: "Você: " + nomePessoa(euId()) }),
  acoesBarra: () => [
    { icone: "user-round", acao: "tf-quem", rotulo: "Trocar a pessoa" },
    { icone: "plus", acao: "tf-nova", rotulo: "Nova tarefa" },
  ],
  abrir(params) {
    if (params.modo) TF.modo = params.modo;
    renderTarefas();
  },
};

function renderTarefas() {
  const eu = euId();
  $("#tf-n-minhas").textContent = tarefasAbertas(eu).length;
  const ns = sugestoesPendentes().length;
  $("#tf-n-assistente").textContent = ns;
  $("#tf-n-assistente").classList.toggle("oculto", !ns);
  $$("#tf-modos button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.valor === TF.modo)));
  const cont = $("#tf-conteudo");
  if (TF.modo === "equipe") cont.innerHTML = htmlEquipe();
  else if (TF.modo === "assistente") cont.innerHTML = htmlAssistente();
  else cont.innerHTML = htmlMinhas();
  atualizarSeloTarefas();
}

function htmlGrupos(lista, opcoes) {
  return GRUPOS_PRAZO.map(([k, rot]) => {
    const g = lista.filter((t) => grupoPrazo(t) === k).sort(ordemTarefa);
    if (!g.length) return "";
    return `<section class="tf-grupo${k === "atrasadas" ? " atrasadas" : ""}">
      <h3 class="tf-grupo-titulo">${esc(rot)} <span class="contador">${g.length}</span></h3>
      <div class="tf-lista">${g.map((t) => tarefaHTML(t, opcoes)).join("")}</div>
    </section>`;
  }).join("");
}

function htmlMinhas() {
  const eu = euId();
  const abertas = tarefasAbertas(eu);
  const sug = sugestoesPendentes().filter((t) => t.responsavel === eu);
  const nAtr = abertas.filter((t) => t.prazo && diasAte(t.prazo) < 0).length;
  const nHoje = abertas.filter((t) => t.prazo && diasAte(t.prazo) === 0).length;
  const nSem = abertas.filter((t) => t.prazo && diasAte(t.prazo) > 0 && diasAte(t.prazo) <= 7).length;
  const num = (n, rot, cls) => `<div class="tf-num${n && cls ? " " + cls : ""}"><b>${n}</b><span>${rot}</span></div>`;
  let html = `<div class="tf-resumo">${num(nAtr, nAtr === 1 ? "atrasada" : "atrasadas", "alerta")}${num(nHoje, "para hoje", "hoje")}${num(
    nSem,
    "nos próximos 7 dias"
  )}</div>`;
  if (sug.length) {
    html += `<button type="button" class="aviso tf-aviso-sug" data-acao="tf-modo" data-valor="assistente">${ic("sparkle")}
      <span class="aviso-corpo"><strong>${sug.length} ${sug.length === 1 ? "sugestão" : "sugestões"} do assistente</strong> para você confirmar</span>${ic(
      "chevron-right",
      "i-p"
    )}</button>`;
  }
  html += abertas.length
    ? htmlGrupos(abertas, {})
    : `<div class="vazio">${ic("circle-check")}<p><strong>Nada pendente.</strong></p><p class="ajuda">Tarefas novas chegam aqui, criadas por você, pela equipe ou pelo assistente.</p>
       <button type="button" class="bt bt-pri" data-acao="tf-nova">${ic("plus")}Nova tarefa</button></div>`;
  const feitas = listaTarefas()
    .filter((t) => t.status === "concluida" && t.responsavel === eu && Date.now() - (t.concluidoEm || 0) < 14 * 86400000)
    .sort((a, b) => (b.concluidoEm || 0) - (a.concluidoEm || 0));
  if (feitas.length) {
    html += `<button type="button" class="bt bt-fan bt-peq tf-ver-feitas" data-acao="tf-ver-feitas">${ic(TF.verConcluidas ? "chevron-up" : "chevron-down", "i-p")}${
      TF.verConcluidas ? "Ocultar concluídas" : "Concluídas recentemente (" + feitas.length + ")"
    }</button>`;
    if (TF.verConcluidas) html += `<div class="tf-lista">${feitas.map((t) => tarefaHTML(t)).join("")}</div>`;
  }
  return html;
}

function htmlEquipe() {
  const eu = euId();
  const ps = pessoasEquipe().slice().sort((a, b) => (a.id === eu ? -1 : b.id === eu ? 1 : 0));
  return ps
    .map((p) => {
      const ab = tarefasAbertas(p.id).sort(ordemTarefa);
      const atr = ab.filter((t) => t.prazo && diasAte(t.prazo) < 0).length;
      return `<section class="tf-pessoa">
        <div class="tf-pessoa-cab">${avatarHTML(p.id, "g")}
          <div class="txt"><strong>${esc(p.nome)}${p.id === eu ? " (você)" : ""}</strong>
          <small>${ab.length ? ab.length + (ab.length === 1 ? " aberta" : " abertas") : "Nenhuma tarefa aberta"}${
        atr ? ` · <b class="tf-atr">${atr} ${atr === 1 ? "atrasada" : "atrasadas"}</b>` : ""
      }</small></div>
          <button type="button" class="bt bt-icone" data-acao="tf-nova" data-resp="${esc(p.id)}" aria-label="Nova tarefa para ${esc(p.nome)}">${ic("plus")}</button>
        </div>
        ${ab.length ? `<div class="tf-lista">${ab.map((t) => tarefaHTML(t, {})).join("")}</div>` : ""}
      </section>`;
    })
    .join("");
}

function htmlAssistente() {
  const sug = sugestoesPendentes().sort((a, b) => b.criadoEm - a.criadoEm);
  const msgs = Dados.lista("mensagens")
    .slice()
    .sort((a, b) => b.recebidaEm - a.recebidaEm);
  const cenarios = typeof CENARIOS_DEMO !== "undefined" ? CENARIOS_DEMO : [];
  return `
    <div class="tf-assist">
      <div class="tf-assist-topo">
        <span class="tf-bot">${ic("sparkle")}</span>
        <div class="txt"><strong>Assistente da Archipel</strong>
        <small>Lê o WhatsApp comercial e os e-mails da equipe, identifica o que foi combinado e propõe a tarefa com responsável e prazo.</small></div>
      </div>
      <div class="tf-canais">
        <span class="tf-canal">${ic("message-circle")}WhatsApp comercial<b>simulado</b></span>
        <span class="tf-canal">${ic("mail")}E-mails da equipe<b>simulado</b></span>
      </div>
    </div>

    <section class="secao">
      <div class="secao-cab"><h2 class="titulo-secao">Para confirmar</h2>${sug.length ? `<span class="contador">${sug.length}</span>` : ""}</div>
      ${sug.length ? sug.map((t) => sugestaoHTML(t)).join("") : `<p class="ajuda">Nenhuma sugestão esperando confirmação.</p>`}
    </section>

    ${
      cenarios.length
        ? `<section class="secao">
      <div class="secao-cab"><h2 class="titulo-secao">Simular uma mensagem</h2></div>
      <p class="ajuda" style="margin-bottom:12px">Na versão final as mensagens chegam sozinhas. Aqui, escolha uma situação para ver o assistente trabalhando.</p>
      <div class="tf-cenarios">${cenarios
        .map(
          (c) => `<button type="button" class="opcao" data-acao="tf-simular" data-cenario="${esc(c.id)}">${ic(CANAIS[c.canal].icone)}
            <span class="txt"><strong>${esc(c.rotulo)}</strong><small>${esc(c.detalhe)}</small></span>${ic("circle-play", "i-p")}</button>`
        )
        .join("")}</div>
    </section>`
        : ""
    }

    <section class="secao">
      <div class="secao-cab"><h2 class="titulo-secao">Lidas pelo assistente</h2></div>
      ${msgs.length ? `<div class="tf-msgs">${msgs.map(mensagemHTML).join("")}</div>` : `<p class="ajuda">Nenhuma mensagem lida ainda.</p>`}
    </section>`;
}

function mensagemHTML(m) {
  const c = CANAIS[m.canal] || CANAIS.app;
  const ult = m.mensagens[m.mensagens.length - 1] || {};
  const tarefas = (m.tarefas || []).map((id) => Dados.achar("tarefas", id)).filter(Boolean);
  return `<article class="tf-msg">
    <div class="tf-msg-cab">${ic(c.icone)}<strong>${esc(m.conversa)}</strong><span>${esc(tempoRelativo(m.recebidaEm))}</span></div>
    <p class="tf-msg-texto">${m.assunto ? `<b>${esc(m.assunto)}</b> — ` : ""}${esc(ult.autor ? ult.autor + ": " : "")}${esc(ult.texto || "")}</p>
    ${
      tarefas.length
        ? `<div class="tf-msg-res">${tarefas
            .map(
              (t) =>
                `<button type="button" class="chip chip-peq" data-acao="tf-abrir" data-id="${t.id}">${ic(
                  t.status === "sugerida" ? "circle-dashed" : t.status === "descartada" ? "x" : "list-todo"
                )}${esc(t.titulo.length > 38 ? t.titulo.slice(0, 36) + "…" : t.titulo)}</button>`
            )
            .join("")}</div>`
        : `<div class="tf-msg-res"><span class="mini texto-3">${ic("info", "i-p")} ${esc(m.leitura || "Nenhuma tarefa identificada")}</span></div>`
    }
  </article>`;
}

// ---------------------------------------------------------------- Tela: tarefa

TELAS.tarefa = {
  id: "tela-tarefa",
  aba: "tarefas",
  titulo: (params) => {
    const t = Dados.achar("tarefas", params.id);
    if (!t) return { titulo: "Tarefa" };
    return {
      titulo: t.status === "sugerida" ? "Sugestão do assistente" : t.status === "concluida" ? "Tarefa concluída" : "Tarefa",
      sub: nomePessoa(t.responsavel) + (t.prazo ? " · " + dataCurta(t.prazo) : ""),
    };
  },
  acoesBarra: () => [{ icone: "ellipsis", acao: "tf-mais", rotulo: "Mais opções" }],
  abrir(params) {
    TF.id = params.id;
    renderTarefaDetalhe();
  },
  aoSair() {
    salvarDetalheDep.agora();
  },
};

function renderTarefaDetalhe() {
  const t = Dados.achar("tarefas", TF.id);
  if (!t) {
    Nav.voltarOu("tarefas");
    return;
  }
  const o = t.origem || {};
  const c = CANAIS[o.canal] || CANAIS.app;
  const projetos = Dados.lista("projetos")
    .slice()
    .sort((a, b) => atividadeProjeto(b) - atividadeProjeto(a))
    .slice(0, 6);
  const chipsPrazo = [
    ["Hoje", somarDias(0)],
    ["Amanhã", somarDias(1)],
    ["Sexta", proximoDiaSemana(5, true)],
    ["Próx. segunda", proximoDiaSemana(1)],
    ["Sem prazo", ""],
  ];
  const cfg = lembretesCfg();
  const lemb = t.lembretes ? Object.assign({}, cfg, t.lembretes) : cfg;
  const resumoLemb = textoLembretes(lemb);
  let selo = "";
  if (t.status === "sugerida") selo = `<span class="selo alerta">${ic("sparkle")}Sugerida pelo assistente</span>`;
  else if (t.status === "concluida")
    selo = `<span class="selo ok">${ic("check")}Concluída ${t.concluidoEm ? esc(tempoRelativo(t.concluidoEm)) : ""}</span>`;
  else if (t.status === "descartada") selo = `<span class="selo areia">Descartada</span>`;

  $("#tf-detalhe").innerHTML = `
    ${selo ? `<div style="margin-bottom:10px">${selo}</div>` : ""}
    <textarea class="tf-det-titulo" id="tf-d-titulo" rows="1" placeholder="O que precisa ser feito">${esc(t.titulo)}</textarea>
    ${
      o.canal && o.canal !== "app"
        ? `<section class="secao tf-det-origem">
      <h2 class="titulo-bloco">De onde veio</h2>
      <div class="tf-citacao">
        <div class="tf-citacao-cab">${ic(c.icone)}<strong>${esc(c.nome + (o.conversa ? " · " + o.conversa : ""))}</strong><span>${esc(
            o.data ? tempoRelativo(o.data) : ""
          )}</span></div>
        ${(o.trechos || [])
          .map((m) => `<p><b>${esc(m.autor)}:</b> ${esc(m.texto)}</p>`)
          .join("")}
        ${o.leitura ? `<div class="tf-leitura">${ic("sparkle", "i-p")}<span>${esc(o.leitura)}</span></div>` : ""}
      </div>
    </section>`
        : ""
    }


    <div class="campo">
      <span class="rotulo">Responsável</span>
      <div class="chips tf-pessoas">${pessoasEquipe()
        .map(
          (p) =>
            `<button type="button" class="chip tf-pessoa-chip" data-acao="tf-d-resp" data-v="${esc(p.id)}" aria-pressed="${t.responsavel === p.id}">${avatarHTML(
              p.id,
              "peq"
            )}${esc(p.nome)}</button>`
        )
        .join("")}</div>
    </div>

    <div class="campo">
      <label class="rotulo" for="tf-d-prazo">Prazo</label>
      <div class="chips" style="margin-bottom:10px">${chipsPrazo
        .map(
          ([rot, v]) =>
            `<button type="button" class="chip chip-peq" data-acao="tf-d-prazo" data-v="${v}" aria-pressed="${(t.prazo || "") === v}">${esc(rot)}</button>`
        )
        .join("")}</div>
      <input class="entrada" type="date" id="tf-d-prazo" value="${esc(t.prazo || "")}">
    </div>

    <div class="campo">
      <label class="rotulo" for="tf-d-projeto">Projeto</label>
      ${
        projetos.length
          ? `<div class="chips rolagem" style="margin-bottom:10px">${projetos
              .map(
                (p) =>
                  `<button type="button" class="chip chip-peq" data-acao="tf-d-proj" data-v="${esc(p.numero)}" aria-pressed="${t.projeto === p.numero}">${esc(
                    p.numero
                  )}</button>`
              )
              .join("")}</div>`
          : ""
      }
      <input class="entrada" type="text" id="tf-d-projeto" value="${esc(t.projeto || "")}" placeholder="Opcional" autocomplete="off">
    </div>

    <div class="campo">
      <label class="rotulo" for="tf-d-desc">Detalhes</label>
      <textarea class="entrada" id="tf-d-desc" rows="3" placeholder="Contexto, links, próximos passos">${esc(t.descricao || "")}</textarea>
    </div>

    <section class="secao">
      <div class="secao-cab"><h2 class="titulo-bloco">Lembretes</h2>
        <button type="button" class="bt bt-fan bt-peq" data-acao="tf-d-lembretes">${t.lembretes ? "Ajustar" : "Personalizar"}</button></div>
      <div class="tf-lembretes">${ic("bell")}<span>${esc(resumoLemb)}${t.lembretes ? "" : " <small>(padrão da equipe)</small>"}</span></div>
    </section>

    ${
      (t.historico || []).length
        ? `<section class="secao"><h2 class="titulo-bloco" style="margin-bottom:8px">Histórico</h2>
      <ol class="tf-hist">${t.historico
        .slice()
        .reverse()
        .map((h) => `<li><span>${esc(h.texto)}</span><small>${esc(tempoRelativo(h.ts))}</small></li>`)
        .join("")}</ol></section>`
        : ""
    }`;
  autoAlturaTitulo();
  const btn = $("#tf-det-concluir");
  const adiar = $("#tf-det-adiar");
  if (t.status === "sugerida") {
    btn.innerHTML = ic("check") + "Criar tarefa";
    btn.dataset.modo = "confirmar";
    adiar.innerHTML = ic("x") + "Descartar";
    adiar.dataset.acao = "tf-sug-descartar";
    adiar.dataset.id = t.id;
  } else {
    btn.innerHTML = t.status === "concluida" ? ic("rotate-ccw") + "Reabrir" : ic("check") + "Concluir";
    btn.dataset.modo = t.status === "concluida" ? "reabrir" : "concluir";
    adiar.innerHTML = ic("alarm-clock") + "Adiar";
    adiar.dataset.acao = "tf-adiar";
    adiar.classList.toggle("oculto", t.status === "concluida");
  }
}

function autoAlturaTitulo() {
  const el = document.getElementById("tf-d-titulo");
  if (!el) return;
  el.style.height = "auto";
  el.style.height = el.scrollHeight + 2 + "px";
}

function textoLembretes(c) {
  const partes = [];
  if (c.antes) partes.push(c.antes === 1 ? "1 dia antes" : c.antes + " dias antes");
  if (c.noDia) partes.push("no dia às " + c.horaDia);
  const atr = { diario: "todo dia se atrasar", "2dias": "a cada 2 dias se atrasar", semanal: "toda semana se atrasar" }[c.atrasadas];
  if (atr) partes.push(atr);
  return partes.length ? maiusculaInicial(listaPt(partes)) : "Sem lembretes";
}

const salvarDetalheDep = debounce(() => {
  const t = Dados.achar("tarefas", TF.id);
  if (!t || !document.getElementById("tf-d-titulo")) return;
  t.titulo = $("#tf-d-titulo").value.trim();
  t.descricao = $("#tf-d-desc").value;
  const proj = $("#tf-d-projeto").value.trim();
  if (proj !== t.projeto) {
    t.projeto = proj;
    const p = projetoPorNumero(projetoDeCampo(proj));
    t.projetoId = p ? p.id : null;
  }
  salvarTarefa(t);
}, 500);

function mudarPrazo(t, iso) {
  if ((t.prazo || "") === iso) return;
  t.prazo = iso;
  t.avisos = {};
  registrarHistorico(t, iso ? "Prazo alterado para " + dataCurta(iso) : "Prazo removido");
  salvarTarefa(t);
}

function concluirTarefa(id, reabrir) {
  const t = Dados.achar("tarefas", id);
  if (!t) return;
  if (reabrir || t.status === "concluida") {
    t.status = "aberta";
    t.concluidoEm = null;
    registrarHistorico(t, "Reaberta por " + nomePessoa(euId()));
    salvarTarefa(t);
    atualizarTelaAtual();
    return;
  }
  const antes = clonar(t);
  t.status = "concluida";
  t.concluidoEm = Date.now();
  registrarHistorico(t, "Concluída por " + nomePessoa(euId()));
  salvarTarefa(t);
  vibrar(12);
  toast("Tarefa concluída", {
    acao: "Desfazer",
    icone: "circle-check",
    aoAgir: () => {
      Dados.salvar("tarefas", antes);
      atualizarSeloTarefas();
      atualizarTelaAtual();
    },
  });
}

async function adiarTarefa(id) {
  const t = Dados.achar("tarefas", id);
  if (!t) return;
  const op = await escolher({
    titulo: "Adiar para…",
    itens: [
      { rotulo: "Amanhã", detalhe: dataCurta(somarDias(1)), valor: somarDias(1), icone: "sun" },
      { rotulo: "Próxima segunda", detalhe: dataCurta(proximoDiaSemana(1)), valor: proximoDiaSemana(1), icone: "calendar" },
      { rotulo: "Em uma semana", detalhe: dataCurta(somarDias(7)), valor: somarDias(7), icone: "calendar-clock" },
      { rotulo: "Escolher a data…", valor: "outra", icone: "calendar-plus" },
    ],
  });
  if (!op) return;
  let iso = op;
  if (op === "outra") {
    const v = await pedirValores({ titulo: "Novo prazo", campos: [{ id: "d", rotulo: "Data", tipo: "date", valor: t.prazo || somarDias(1) }], ok: "Adiar" });
    if (!v || !v.d) return;
    iso = v.d;
  }
  mudarPrazo(t, iso);
  toast("Prazo: " + dataCurta(iso), { icone: "alarm-clock" });
  atualizarTelaAtual();
}

async function lembretesDaTarefa(id) {
  const t = Dados.achar("tarefas", id);
  if (!t) return;
  const c = Object.assign({}, lembretesCfg(), t.lembretes || {});
  const v = await folhaLembretes("Lembretes desta tarefa", c, { porTarefa: true, personalizado: !!t.lembretes });
  if (!v) return;
  t.lembretes = v.padrao ? null : { antes: v.antes, noDia: v.noDia, horaDia: v.horaDia, atrasadas: v.atrasadas };
  t.avisos = {};
  salvarTarefa(t);
  renderTarefaDetalhe();
  toast("Lembretes atualizados", { icone: "bell" });
}

// Folha com as opções de lembrete (para a equipe ou para uma tarefa)
function folhaLembretes(titulo, c, opcoes = {}) {
  const seg = (nome, ops, atual) =>
    `<div class="segmento tf-seg" data-seg="${nome}">${ops
      .map(([v, rot]) => `<button type="button" data-v="${v}" aria-pressed="${String(atual) === String(v)}">${esc(rot)}</button>`)
      .join("")}</div>`;
  const f = Folhas.abrir({
    titulo,
    classe: "alta",
    html: `
      ${
        opcoes.porTarefa
          ? `<label class="interruptor" style="margin-bottom:16px"><span class="interruptor-texto">Seguir o padrão da equipe<small>${esc(
              textoLembretes(lembretesCfg())
            )}</small></span><input type="checkbox" data-c="padrao" ${opcoes.personalizado ? "" : "checked"}><span class="chave"></span></label>`
          : ""
      }
      <div class="tf-lemb-campos">
        <div class="campo"><span class="rotulo">Avisar antes do prazo</span>${seg("antes", [[0, "Não"], [1, "1 dia"], [2, "2 dias"], [3, "3 dias"]], c.antes)}</div>
        <label class="interruptor" style="margin-bottom:10px"><span class="interruptor-texto">No dia do prazo</span><input type="checkbox" data-c="noDia" ${
          c.noDia ? "checked" : ""
        }><span class="chave"></span></label>
        <div class="campo"><input class="entrada" type="time" data-c="horaDia" value="${esc(c.horaDia)}" aria-label="Horário do aviso no dia"></div>
        <div class="campo"><span class="rotulo">Se atrasar, lembrar</span>${seg(
          "atrasadas",
          [["diario", "Todo dia"], ["2dias", "A cada 2"], ["semanal", "Semanal"], ["nunca", "Não"]],
          c.atrasadas
        )}</div>
      </div>`,
    rodape: `<button type="button" class="bt bt-sec" data-r="0">Cancelar</button><button type="button" class="bt bt-pri" data-r="1">Salvar</button>`,
  });
  const campos = f.corpo.querySelector(".tf-lemb-campos");
  const chkPadrao = f.corpo.querySelector('[data-c="padrao"]');
  const sincronizar = () => {
    if (chkPadrao) campos.classList.toggle("desativado", chkPadrao.checked);
  };
  if (chkPadrao) chkPadrao.addEventListener("change", sincronizar);
  sincronizar();
  f.corpo.addEventListener("click", (e) => {
    const b = e.target.closest(".tf-seg button");
    if (!b) return;
    b.parentElement.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  });
  f.folha.querySelector('[data-r="0"]').addEventListener("click", () => f.fechar(null));
  f.folha.querySelector('[data-r="1"]').addEventListener("click", () => {
    const val = (nome) => {
      const b = f.corpo.querySelector(`[data-seg="${nome}"] [aria-pressed="true"]`);
      return b ? b.dataset.v : null;
    };
    f.fechar({
      padrao: chkPadrao ? chkPadrao.checked : false,
      antes: Number(val("antes")) || 0,
      noDia: f.corpo.querySelector('[data-c="noDia"]').checked,
      horaDia: f.corpo.querySelector('[data-c="horaDia"]').value || "09:00",
      atrasadas: val("atrasadas") || "diario",
    });
  });
  return f.promessa;
}

// ---------------------------------------------------------------- Nova tarefa

function novaTarefaFolha(pre = {}) {
  const projetos = Dados.lista("projetos")
    .slice()
    .sort((a, b) => atividadeProjeto(b) - atividadeProjeto(a))
    .slice(0, 6);
  let resp = pre.responsavel || euId();
  let prazo = pre.prazo != null ? pre.prazo : somarDias(1);
  let proj = pre.projeto || "";
  const chipsPrazo = [
    ["Hoje", somarDias(0)],
    ["Amanhã", somarDias(1)],
    ["Sexta", proximoDiaSemana(5, true)],
    ["Próx. semana", proximoDiaSemana(1)],
    ["Sem prazo", ""],
  ];
  const f = Folhas.abrir({
    titulo: pre.tituloFolha || "Nova tarefa",
    classe: "alta",
    html: `
      <div class="campo"><textarea class="entrada tf-nova-titulo" rows="2" data-n="titulo" placeholder="O que precisa ser feito">${esc(pre.titulo || "")}</textarea></div>
      <div class="campo"><span class="rotulo">Responsável</span>
        <div class="chips">${pessoasEquipe()
          .map(
            (p) =>
              `<button type="button" class="chip tf-pessoa-chip" data-resp="${esc(p.id)}" aria-pressed="${resp === p.id}">${avatarHTML(p.id, "peq")}${esc(
                p.nome
              )}</button>`
          )
          .join("")}</div></div>
      <div class="campo"><span class="rotulo">Prazo</span>
        <div class="chips" style="margin-bottom:10px">${chipsPrazo
          .map(([rot, v]) => `<button type="button" class="chip chip-peq" data-prazo="${v}" aria-pressed="${prazo === v}">${esc(rot)}</button>`)
          .join("")}</div>
        <input class="entrada" type="date" data-n="prazo" value="${esc(prazo)}"></div>
      ${
        projetos.length
          ? `<div class="campo"><span class="rotulo">Projeto</span><div class="chips rolagem">${projetos
              .map((p) => `<button type="button" class="chip chip-peq" data-proj="${esc(p.numero)}" aria-pressed="${proj === p.numero}">${esc(p.numero)}</button>`)
              .join("")}</div></div>`
          : ""
      }
      <p class="ajuda oculto" data-erro style="color:var(--erro)">Escreva o que precisa ser feito.</p>`,
    rodape: `<button type="button" class="bt bt-sec" data-r="0">Cancelar</button><button type="button" class="bt bt-pri" data-r="1">${esc(
      pre.ok || "Criar tarefa"
    )}</button>`,
  });
  const inpPrazo = f.corpo.querySelector('[data-n="prazo"]');
  f.corpo.addEventListener("click", (e) => {
    const r = e.target.closest("[data-resp]");
    const p = e.target.closest("[data-prazo]");
    const pj = e.target.closest("[data-proj]");
    if (r) {
      resp = r.dataset.resp;
      f.corpo.querySelectorAll("[data-resp]").forEach((x) => x.setAttribute("aria-pressed", String(x === r)));
    }
    if (p) {
      prazo = p.dataset.prazo;
      inpPrazo.value = prazo;
      f.corpo.querySelectorAll("[data-prazo]").forEach((x) => x.setAttribute("aria-pressed", String(x === p)));
    }
    if (pj) {
      proj = proj === pj.dataset.proj ? "" : pj.dataset.proj;
      f.corpo.querySelectorAll("[data-proj]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.proj === proj)));
    }
  });
  inpPrazo.addEventListener("input", () => {
    prazo = inpPrazo.value;
    f.corpo.querySelectorAll("[data-prazo]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.prazo === prazo)));
  });
  f.folha.querySelector('[data-r="0"]').addEventListener("click", () => f.fechar(null));
  f.folha.querySelector('[data-r="1"]').addEventListener("click", () => {
    const titulo = f.corpo.querySelector('[data-n="titulo"]').value.trim();
    if (!titulo) {
      f.corpo.querySelector("[data-erro]").classList.remove("oculto");
      vibrar(60);
      return;
    }
    f.fechar({ titulo, responsavel: resp, prazo, projeto: proj });
  });
  setTimeout(() => {
    const t = f.corpo.querySelector('[data-n="titulo"]');
    if (t && !pre.titulo) t.focus();
  }, 80);
  return f.promessa;
}

async function criarTarefaFluxo(pre = {}) {
  const v = await novaTarefaFolha(pre);
  if (!v) return;
  const p = v.projeto ? projetoPorNumero(v.projeto) : null;
  const t = novaTarefaObj({
    titulo: v.titulo,
    responsavel: v.responsavel,
    prazo: v.prazo,
    projeto: v.projeto,
    projetoId: p ? p.id : null,
  });
  registrarHistorico(t, "Criada por " + nomePessoa(euId()));
  salvarTarefa(t);
  if (t.responsavel === euId()) toast("Tarefa criada", { icone: "list-todo" });
  else toast("Tarefa criada para " + nomePessoa(t.responsavel) + ", que recebe o aviso no celular", { icone: "bell" });
  atualizarTelaAtual();
}

// ---------------------------------------------------------------- Sugestões do assistente

function confirmarSugestao(id) {
  const t = Dados.achar("tarefas", id);
  if (!t || t.status !== "sugerida") return null;
  t.status = "aberta";
  t.confirmadaEm = Date.now();
  registrarHistorico(t, "Confirmada por " + nomePessoa(euId()));
  salvarTarefa(t);
  avisarNovaTarefa(t);
  return t;
}

function descartarSugestao(id) {
  const t = Dados.achar("tarefas", id);
  if (!t) return;
  const antes = clonar(t);
  t.status = "descartada";
  registrarHistorico(t, "Descartada por " + nomePessoa(euId()));
  salvarTarefa(t);
  toast("Sugestão descartada", {
    acao: "Desfazer",
    icone: "x",
    aoAgir: () => {
      Dados.salvar("tarefas", antes);
      atualizarSeloTarefas();
      atualizarTelaAtual();
      atualizarCartaoSimulacao(antes.id);
    },
  });
}

function avisarNovaTarefa(t) {
  if (t.responsavel === euId()) {
    if (lembretesCfg().novaTarefa) {
      notificar({
        titulo: "Nova tarefa para você",
        texto: t.titulo + (t.prazo ? " · até " + dataCurta(t.prazo) : ""),
        aoTocar: () => Nav.ir("tarefa", { id: t.id }),
      });
    }
  } else {
    toast("Tarefa criada para " + nomePessoa(t.responsavel) + ", que recebe o aviso no celular", { icone: "bell" });
  }
}

async function ajustarSugestao(id) {
  const t = Dados.achar("tarefas", id);
  if (!t) return;
  const v = await novaTarefaFolha({
    titulo: t.titulo,
    responsavel: t.responsavel,
    prazo: t.prazo || "",
    projeto: t.projeto,
    tituloFolha: "Ajustar e criar",
    ok: "Criar tarefa",
  });
  if (!v) return;
  const p = v.projeto ? projetoPorNumero(v.projeto) : null;
  if (t.responsavel !== v.responsavel) registrarHistorico(t, "Responsável ajustado para " + nomePessoa(v.responsavel));
  if ((t.prazo || "") !== (v.prazo || "")) registrarHistorico(t, v.prazo ? "Prazo ajustado para " + dataCurta(v.prazo) : "Prazo removido");
  Object.assign(t, { titulo: v.titulo, responsavel: v.responsavel, prazo: v.prazo, projeto: v.projeto, projetoId: p ? p.id : t.projetoId });
  salvarTarefa(t);
  confirmarSugestao(t.id);
  atualizarTelaAtual();
  atualizarCartaoSimulacao(t.id);
}

// ---------------------------------------------------------------- Avisos (notificações)

const NOTIF = { fila: [], ativa: null };

function notificar(n) {
  NOTIF.fila.push(n);
  if (!NOTIF.ativa) proximaNotificacao();
  if (lembretesCfg().sistema) notificarSistema(n);
}

function proximaNotificacao() {
  const n = NOTIF.fila.shift();
  if (!n) {
    NOTIF.ativa = null;
    return;
  }
  const el = document.createElement("div");
  el.className = "notif";
  el.setAttribute("role", "status");
  el.innerHTML = `
    <div class="notif-app"><span class="notif-icone"><svg viewBox="0 0 187 170" aria-hidden="true"><use href="#simbolo-archipel"/></svg></span>Archipel<span class="notif-hora">agora</span></div>
    <div class="notif-titulo">${esc(n.titulo)}</div>
    <div class="notif-texto">${esc(n.texto)}</div>`;
  $("#notificacoes").appendChild(el);
  NOTIF.ativa = el;
  vibrar([18, 60, 18]);
  let fechado = false;
  const fechar = () => {
    if (fechado) return;
    fechado = true;
    el.classList.add("saindo");
    setTimeout(() => {
      el.remove();
      NOTIF.ativa = null;
      setTimeout(proximaNotificacao, 200);
    }, 260);
  };
  el.addEventListener("click", () => {
    fechar();
    if (n.aoTocar) n.aoTocar();
  });
  let y0 = null;
  el.addEventListener("touchstart", (e) => (y0 = e.touches[0].clientY), { passive: true });
  el.addEventListener(
    "touchmove",
    (e) => {
      if (y0 != null && e.touches[0].clientY - y0 < -24) {
        y0 = null;
        fechar();
      }
    },
    { passive: true }
  );
  setTimeout(fechar, n.duracao || 6500);
}

async function notificarSistema(n) {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const opcoes = { body: n.texto, icon: RAIZ + "icon-192.png", badge: RAIZ + "icon-192.png", tag: n.tag || undefined };
    const reg = navigator.serviceWorker ? await navigator.serviceWorker.getRegistration() : null;
    if (reg && reg.showNotification) await reg.showNotification(n.titulo, opcoes);
    else new Notification(n.titulo, opcoes);
  } catch (e) {}
}

async function pedirPermissaoNotificacao() {
  if (!("Notification" in window)) {
    alerta("Este navegador não mostra notificações do sistema. No iPhone, elas funcionam com o app adicionado à Tela de Início (iOS 16.4 ou mais novo).", {
      titulo: "Notificações",
    });
    return false;
  }
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") {
    alerta("As notificações deste app estão bloqueadas. Libere nos ajustes do navegador ou do celular.", { titulo: "Notificações" });
    return false;
  }
  try {
    return (await Notification.requestPermission()) === "granted";
  } catch (e) {
    return false;
  }
}

// ---------------------------------------------------------------- Lembretes

function emSilencio(c, agora = new Date()) {
  if (!c.silencio) return false;
  const m = agora.getHours() * 60 + agora.getMinutes();
  const a = minutos(c.silencioIni);
  const b = minutos(c.silencioFim);
  return a > b ? m >= a || m < b : m >= a && m < b;
}

function resumoDoDia(id) {
  const ab = tarefasAbertas(id);
  const atr = ab.filter((t) => t.prazo && diasAte(t.prazo) < 0).length;
  const hoje = ab.filter((t) => t.prazo && diasAte(t.prazo) === 0).length;
  const semana = ab.filter((t) => t.prazo && diasAte(t.prazo) > 0 && diasAte(t.prazo) <= 7).length;
  const partes = [];
  if (hoje) partes.push(hoje + (hoje === 1 ? " tarefa para hoje" : " tarefas para hoje"));
  if (atr) partes.push(atr + (atr === 1 ? " atrasada" : " atrasadas"));
  if (semana) partes.push(semana + " nos próximos 7 dias");
  const h = new Date().getHours();
  const saud = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  return {
    titulo: saud + ", " + nomePessoa(id),
    texto: partes.length ? maiusculaInicial(listaPt(partes)) + "." : "Nenhuma tarefa com prazo próximo.",
    aoTocar: () => Nav.ir("tarefas", { modo: "minhas" }, { raiz: true }),
    tag: "resumo",
  };
}

function lembreteDaTarefa(t, tipo) {
  const n = diasAte(t.prazo);
  const textos = {
    antes: n === 1 ? "Vence amanhã" : "Vence em " + n + " dias",
    dia: "Vence hoje",
    atraso: n === -1 ? "Venceu ontem" : "Atrasada há " + -n + " dias",
  };
  return {
    titulo: textos[tipo],
    texto: t.titulo + (t.projeto ? " · " + t.projeto : ""),
    aoTocar: () => Nav.ir("tarefa", { id: t.id }),
    tag: "t" + t.id,
  };
}

// Confere o que deve ser avisado agora (ao abrir o app e a cada minuto)
function verificarLembretes() {
  if (!window.__pronto) return;
  const cfg = lembretesCfg();
  const agora = new Date();
  if (!cfg.fimDeSemana && (agora.getDay() === 0 || agora.getDay() === 6)) return;
  if (emSilencio(cfg, agora)) return;
  const hojeIso = hojeISO();
  const m = agora.getHours() * 60 + agora.getMinutes();
  const eu = euId();
  const avisos = [];
  let resumo = false;
  if (cfg.resumoDiario && m >= minutos(cfg.horaResumo) && Dados.config.ultimoResumo !== hojeIso) {
    Dados.config.ultimoResumo = hojeIso;
    Dados.salvarConfig();
    avisos.push(resumoDoDia(eu));
    resumo = true;
  }
  let mudou = false;
  tarefasAbertas(eu).forEach((t) => {
    if (!t.prazo) return;
    const c = Object.assign({}, cfg, t.lembretes || {});
    const n = diasAte(t.prazo);
    t.avisos = t.avisos || {};
    let tipo = null;
    if (c.antes && n === c.antes && t.avisos.antes !== hojeIso) tipo = "antes";
    else if (n === 0 && c.noDia && m >= minutos(c.horaDia) && t.avisos.dia !== hojeIso) tipo = "dia";
    else if (n < 0 && c.atrasadas !== "nunca") {
      const intervalo = { diario: 1, "2dias": 2, semanal: 7 }[c.atrasadas] || 1;
      const ult = t.avisos.atraso ? -diasAte(t.avisos.atraso) : Infinity;
      if (ult >= intervalo) tipo = "atraso";
    }
    if (!tipo) return;
    t.avisos[tipo] = hojeIso;
    mudou = true;
    // O resumo do dia já reúne os vencidos e os de hoje
    if (!(resumo && (tipo === "dia" || tipo === "atraso"))) avisos.push(lembreteDaTarefa(t, tipo));
  });
  if (mudou) Dados.gravar("tarefas", Dados.lista("tarefas"));
  avisos.slice(0, 4).forEach(notificar);
}

function testarLembrete() {
  const eu = euId();
  const ab = tarefasAbertas(eu).filter((t) => t.prazo).sort(ordemTarefa);
  if (!ab.length) {
    notificar({ titulo: "Lembrete de teste", texto: "Assim chegam os avisos de prazo das suas tarefas." });
    return;
  }
  const t = ab[0];
  const n = diasAte(t.prazo);
  notificar(lembreteDaTarefa(t, n < 0 ? "atraso" : n === 0 ? "dia" : "antes"));
}

// ---------------------------------------------------------------- Simulação do assistente

function espera(ms) {
  return new Promise((r) => setTimeout(r, ms * TF.velocidade));
}

// Destaca no texto as frases que o assistente usou
function marcarTrechos(texto, trechos) {
  let html = esc(texto);
  (trechos || []).forEach((tr) => {
    const alvo = esc(tr);
    const i = html.indexOf(alvo);
    if (i >= 0) html = html.slice(0, i) + `<mark>${alvo}</mark>` + html.slice(i + alvo.length);
  });
  return html;
}

function bolhaHTML(msg, c) {
  if (c.canal === "email") {
    return `<div class="sim-email">
      <div class="sim-email-cab"><b>${esc(msg.autor)}</b><span>${esc(msg.endereco || "")}</span></div>
      <div class="sim-email-para">Para: ${esc(c.para || "")}</div>
      <div class="sim-email-assunto">${esc(c.assunto || "")}</div>
      <div class="sim-texto" data-texto>${esc(msg.texto).replace(/\n/g, "<br>")}</div>
    </div>`;
  }
  return `<div class="sim-bolha${msg.equipe ? " equipe" : ""}">
    <div class="sim-autor">${esc(msg.autor)}</div>
    <div class="sim-texto" data-texto>${esc(msg.texto)}</div>
    <div class="sim-hora">${esc(msg.hora || horaAgora())}</div>
  </div>`;
}

function atualizarCartaoSimulacao(id) {
  const card = document.querySelector(`.sim-resultado .tf-sug[data-id="${id}"]`);
  if (!card) return;
  const t = Dados.achar("tarefas", id);
  if (!t) return;
  if (t.status === "sugerida") {
    card.outerHTML = sugestaoHTML(t, { semOrigem: true });
    return;
  }
  const criada = t.status === "aberta";
  card.outerHTML = `<div class="tf-sug-feita${criada ? "" : " descartada"}" data-id="${t.id}">${ic(criada ? "circle-check" : "x")}<span>${
    criada ? "Tarefa criada para <b>" + esc(nomePessoa(t.responsavel)) + "</b>" + (t.prazo ? " · " + esc(dataCurta(t.prazo)) : "") : "Sugestão descartada"
  }</span>${criada ? `<button type="button" class="bt bt-fan bt-peq" data-acao="tf-abrir" data-id="${t.id}">Abrir</button>` : ""}</div>`;
}

async function simularCenario(id) {
  const c = (typeof CENARIOS_DEMO !== "undefined" ? CENARIOS_DEMO : []).find((x) => x.id === id);
  if (!c) return;
  const canal = CANAIS[c.canal];
  const f = Folhas.abrir({
    titulo: c.canal === "email" ? "E-mail recebido" : "Mensagem no WhatsApp",
    classe: "alta sim-folha",
    html: `
      <div class="sim-cab">${ic(canal.icone)}<div class="txt"><strong>${esc(c.conversa)}</strong><small>${esc(c.contexto)}</small></div></div>
      <div class="sim-chat"></div>
      <div class="sim-leitura"></div>
      <div class="sim-resultado"></div>`,
  });
  f.corpo.addEventListener("click", (e) => {
    const b = e.target.closest('[data-acao="tf-abrir"]');
    if (b) f.fechar();
  });
  const chat = f.corpo.querySelector(".sim-chat");
  const leitura = f.corpo.querySelector(".sim-leitura");
  const resultado = f.corpo.querySelector(".sim-resultado");
  const rolar = () => f.corpo.scrollTo({ top: f.corpo.scrollHeight, behavior: "smooth" });
  const agora = Date.now();
  const msgs = c.mensagens.map((mm, i) => Object.assign({}, mm, { hora: mm.hora || horaMenos(c.mensagens.length - 1 - i) }));

  await espera(350);
  for (const msg of msgs) {
    if (f.fechado) return;
    if (c.canal !== "email") {
      chat.insertAdjacentHTML("beforeend", `<div class="sim-digitando${msg.equipe ? " equipe" : ""}"><i></i><i></i><i></i></div>`);
      rolar();
      await espera(650 + Math.min(900, msg.texto.length * 9));
      const d = chat.querySelector(".sim-digitando");
      if (d) d.remove();
    }
    chat.insertAdjacentHTML("beforeend", bolhaHTML(msg, c));
    rolar();
    await espera(c.canal === "email" ? 1400 : 700);
  }
  if (f.fechado) return;
  leitura.innerHTML = `<div class="sim-lendo">${ic("sparkle")}<span>Claude está lendo a conversa</span><i></i><i></i><i></i></div>`;
  rolar();
  await espera(1600);
  if (f.fechado) return;
  // Destaca as frases usadas
  $$(".sim-texto", chat).forEach((el, i) => {
    const msg = msgs[i];
    if (msg && msg.destaque) el.innerHTML = marcarTrechos(msg.texto, [].concat(msg.destaque)).replace(/\n/g, "<br>");
  });
  await espera(700);
  leitura.innerHTML = `<div class="sim-entendi">${ic("sparkle")}<span>${esc(c.leitura)}</span></div>`;
  rolar();
  await espera(600);

  // Registra a mensagem e cria as sugestões
  const ids = [];
  const trechos = msgs.map((mm) => ({ autor: mm.autor, texto: mm.texto }));
  (c.tarefas || []).forEach((def) => {
    const prazo = typeof def.prazo === "function" ? def.prazo() : def.prazo || "";
    const p = def.projeto ? projetoPorNumero(def.projeto) : null;
    const t = novaTarefaObj({
      titulo: def.titulo,
      descricao: def.descricao || "",
      responsavel: def.responsavel,
      criadoPor: "claude",
      prazo,
      status: "sugerida",
      projeto: def.projeto || "",
      projetoId: p ? p.id : null,
      confianca: def.confianca || "alta",
      origem: {
        canal: c.canal,
        conversa: c.conversa,
        data: agora,
        trechos,
        leitura: def.leitura || c.leitura,
        porque: def.porque || "",
        prazoTexto: def.prazoTexto || "",
        cliente: def.cliente || (p ? p.cliente : ""),
      },
    });
    registrarHistorico(t, "Sugerida pelo assistente a partir de " + canal.nome + " · " + c.conversa);
    Dados.salvar("tarefas", t);
    ids.push(t.id);
  });
  const lista = Dados.lista("mensagens").slice();
  lista.push({
    id: Dados.novoId("mensagens"),
    canal: c.canal,
    conversa: c.conversa,
    assunto: c.assunto || "",
    recebidaEm: agora,
    mensagens: trechos,
    leitura: c.leitura,
    tarefas: ids,
  });
  Dados.gravar("mensagens", lista);
  atualizarSeloTarefas();

  for (const id2 of ids) {
    if (f.fechado) break;
    const t = Dados.achar("tarefas", id2);
    resultado.insertAdjacentHTML("beforeend", sugestaoHTML(t, { semOrigem: true }));
    const card = resultado.lastElementChild;
    card.classList.add("chegando");
    rolar();
    await espera(900);
  }
  if (!ids.length) {
    resultado.innerHTML = `<div class="tf-sug-feita descartada">${ic("info")}<span>Nenhuma tarefa nesta conversa. O assistente só registra a leitura.</span></div>`;
  }
  f.aoFechar = () => {
    if (Nav.topo() && Nav.topo().tela === "tarefas") renderTarefas();
  };
}

function horaMenos(min) {
  const d = new Date(Date.now() - min * 60000);
  return pad2(d.getHours()) + ":" + pad2(d.getMinutes());
}

// ---------------------------------------------------------------- Ações

Object.assign(ACOES, {
  "tf-modo": (el) => {
    TF.modo = el.dataset.valor;
    if (Nav.topo() && Nav.topo().tela !== "tarefas") Nav.ir("tarefas", { modo: TF.modo }, { raiz: true });
    else renderTarefas();
  },
  "tf-abrir": (el) => Nav.ir("tarefa", { id: Number(el.dataset.id) }),
  "tf-alternar": (el) => {
    const id = Number(el.dataset.id);
    const t = Dados.achar("tarefas", id);
    if (!t) return;
    if (t.status === "concluida") {
      concluirTarefa(id, true);
      return;
    }
    const linha = el.closest(".tarefa");
    if (linha) linha.classList.add("concluindo");
    el.setAttribute("aria-pressed", "true");
    setTimeout(() => {
      concluirTarefa(id);
      atualizarTelaAtual();
    }, 420);
  },
  "tf-nova": (el) => criarTarefaFluxo({ responsavel: el.dataset.resp || undefined, projeto: el.dataset.projeto || "" }),
  "tf-quem": async () => {
    const v = await escolher({
      titulo: "Quem está usando o app?",
      texto: "Na versão final, cada pessoa entra com a própria conta. Na prévia, troque para ver o app como cada sócio.",
      itens: pessoasEquipe().map((p) => ({ rotulo: p.nome, detalhe: tarefasAbertas(p.id).length + " tarefas abertas", valor: p.id, icone: "user-round" })),
    });
    if (!v) return;
    Dados.config.eu = v;
    Dados.salvarConfig();
    atualizarTelaAtual();
    atualizarSeloTarefas();
    toast("Vendo o app como " + nomePessoa(v), { icone: "user-round" });
  },
  "tf-ver-feitas": () => {
    TF.verConcluidas = !TF.verConcluidas;
    renderTarefas();
  },
  "tf-simular": (el) => simularCenario(el.dataset.cenario),
  "tf-sug-criar": (el) => {
    const t = confirmarSugestao(Number(el.dataset.id));
    if (!t) return;
    atualizarCartaoSimulacao(t.id);
    const topo = Nav.topo();
    if (topo && (topo.tela === "tarefas" || topo.tela === "inicio" || topo.tela === "projeto")) atualizarTelaAtual();
    else if (topo && topo.tela === "tarefa") renderTarefaDetalhe();
  },
  "tf-sug-ajustar": (el) => ajustarSugestao(Number(el.dataset.id)),
  "tf-sug-descartar": (el) => {
    const id = Number(el.dataset.id);
    descartarSugestao(id);
    atualizarCartaoSimulacao(id);
    const topo = Nav.topo();
    if (topo && topo.tela === "tarefa") Nav.voltarOu("tarefas");
    else atualizarTelaAtual();
  },
  "tf-det-concluir": (el) => {
    const t = Dados.achar("tarefas", TF.id);
    if (!t) return;
    salvarDetalheDep.agora();
    if (el.dataset.modo === "confirmar") {
      confirmarSugestao(t.id);
      renderTarefaDetalhe();
      Nav.atualizarBarra();
      return;
    }
    if (el.dataset.modo === "reabrir") {
      concluirTarefa(t.id, true);
      return;
    }
    concluirTarefa(t.id);
    Nav.voltarOu("tarefas");
  },
  "tf-adiar": () => adiarTarefa(TF.id),
  "tf-d-resp": (el) => {
    const t = Dados.achar("tarefas", TF.id);
    if (!t || t.responsavel === el.dataset.v) return;
    t.responsavel = el.dataset.v;
    t.avisos = {};
    registrarHistorico(t, "Responsável: " + nomePessoa(t.responsavel));
    salvarTarefa(t);
    renderTarefaDetalhe();
    Nav.atualizarBarra();
    if (t.status === "aberta" && t.responsavel !== euId()) toast(nomePessoa(t.responsavel) + " recebe o aviso no celular", { icone: "bell" });
  },
  "tf-d-prazo": (el) => {
    const t = Dados.achar("tarefas", TF.id);
    if (!t) return;
    mudarPrazo(t, el.dataset.v);
    renderTarefaDetalhe();
    Nav.atualizarBarra();
  },
  "tf-d-proj": (el) => {
    const t = Dados.achar("tarefas", TF.id);
    if (!t) return;
    const v = t.projeto === el.dataset.v ? "" : el.dataset.v;
    t.projeto = v;
    const p = v ? projetoPorNumero(v) : null;
    t.projetoId = p ? p.id : null;
    salvarTarefa(t);
    renderTarefaDetalhe();
  },
  "tf-d-lembretes": () => lembretesDaTarefa(TF.id),
  "tf-mais": async () => {
    const t = Dados.achar("tarefas", TF.id);
    if (!t) return;
    const itens = [];
    const p = t.projetoId ? projetoPorId(t.projetoId) : t.projeto ? projetoPorNumero(t.projeto) : null;
    if (p) itens.push({ rotulo: "Abrir o projeto " + p.numero, valor: "projeto", icone: "folder-open" });
    itens.push({ rotulo: "Lembretes desta tarefa", valor: "lembretes", icone: "bell" });
    itens.push({ rotulo: "Excluir tarefa", valor: "excluir", icone: "trash-2" });
    const op = await menuAcoes(t.titulo || "Tarefa", itens);
    if (op === "projeto") Nav.ir("projeto", { id: p.id });
    else if (op === "lembretes") lembretesDaTarefa(t.id);
    else if (op === "excluir") {
      Nav.voltarOu("tarefas");
      excluirComDesfazer("tarefas", t.id, "Tarefa excluída");
      atualizarSeloTarefas();
    }
  },
  "pj-tarefa-nova": () => {
    const p = projetoAtivo();
    criarTarefaFluxo({ projeto: p ? p.numero : "" });
  },
  "aj-lembrete-testar": () => testarLembrete(),
  "aj-lembrete-op": (el) => {
    const v = el.dataset.v;
    const campo = el.dataset.campo;
    salvarLembretesCfg({ [campo]: campo === "antes" ? Number(v) : v });
    renderAjustesTarefas();
  },
  "aj-eu": (el) => {
    Dados.config.eu = el.dataset.v;
    Dados.salvarConfig();
    renderAjustesTarefas();
    atualizarSeloTarefas();
  },
});

document.addEventListener("input", (e) => {
  const t = e.target;
  if (!t || !t.closest) return;
  if (t.closest("#tela-tarefa")) {
    if (t.id === "tf-d-titulo") autoAlturaTitulo();
    if (t.id === "tf-d-prazo") {
      const tf = Dados.achar("tarefas", TF.id);
      if (tf) {
        mudarPrazo(tf, t.value);
        Nav.atualizarBarra();
        $$('[data-acao="tf-d-prazo"]').forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === t.value)));
      }
      return;
    }
    salvarDetalheDep();
  }
});

document.addEventListener("change", async (e) => {
  const t = e.target;
  if (!t || !t.dataset || !t.dataset.lemb) return;
  const campo = t.dataset.lemb;
  if (t.type === "checkbox") {
    if (campo === "sistema" && t.checked) {
      const ok = await pedirPermissaoNotificacao();
      if (!ok) {
        t.checked = false;
        return;
      }
    }
    salvarLembretesCfg({ [campo]: t.checked });
  } else {
    salvarLembretesCfg({ [campo]: t.value });
  }
  renderAjustesTarefas();
});

// ---------------------------------------------------------------- Ajustes

function renderAjustesTarefas() {
  const el = document.getElementById("aj-tarefas");
  if (!el) return;
  const c = lembretesCfg();
  const eu = euId();
  const seg = (campo, ops) =>
    `<div class="segmento tf-seg">${ops
      .map(([v, rot]) => `<button type="button" data-acao="aj-lembrete-op" data-campo="${campo}" data-v="${v}" aria-pressed="${String(c[campo]) === String(v)}">${esc(rot)}</button>`)
      .join("")}</div>`;
  const chave = (campo, rotulo, ajuda) =>
    `<label class="interruptor"><span class="interruptor-texto">${esc(rotulo)}${ajuda ? `<small>${esc(ajuda)}</small>` : ""}</span><input type="checkbox" data-lemb="${campo}" ${
      c[campo] ? "checked" : ""
    }><span class="chave"></span></label>`;
  el.innerHTML = `
    <section class="secao">
      <h2 class="titulo-secao" style="margin-bottom:6px">Tarefas e lembretes</h2>
      <p class="ajuda" style="margin-bottom:12px">Quando e como o app avisa sobre as suas tarefas. Cada tarefa pode ter lembretes próprios.</p>
      <div class="campo"><span class="rotulo">Quem usa este aparelho</span>
        <div class="chips">${pessoasEquipe()
          .map((p) => `<button type="button" class="chip tf-pessoa-chip" data-acao="aj-eu" data-v="${esc(p.id)}" aria-pressed="${p.id === eu}">${avatarHTML(p.id, "peq")}${esc(p.nome)}</button>`)
          .join("")}</div></div>
      <div class="painel tf-aj">
        ${chave("novaTarefa", "Avisar quando chegar tarefa nova", "Inclusive as criadas pelo assistente")}
        ${chave("resumoDiario", "Resumo do dia", "Tarefas de hoje, atrasadas e da semana")}
        <div class="tf-aj-linha${c.resumoDiario ? "" : " desativado"}"><span>Horário do resumo</span><input class="entrada" type="time" data-lemb="horaResumo" value="${esc(c.horaResumo)}"></div>
        <div class="tf-aj-bloco"><span class="rotulo">Avisar antes do prazo</span>${seg("antes", [[0, "Não"], [1, "1 dia"], [2, "2 dias"], [3, "3 dias"]])}</div>
        ${chave("noDia", "Avisar no dia do prazo")}
        <div class="tf-aj-linha${c.noDia ? "" : " desativado"}"><span>Horário do aviso</span><input class="entrada" type="time" data-lemb="horaDia" value="${esc(c.horaDia)}"></div>
        <div class="tf-aj-bloco"><span class="rotulo">Se atrasar, lembrar</span>${seg("atrasadas", [["diario", "Todo dia"], ["2dias", "A cada 2"], ["semanal", "Semanal"], ["nunca", "Não"]])}</div>
        ${chave("silencio", "Silenciar à noite")}
        <div class="tf-aj-linha${c.silencio ? "" : " desativado"}"><span>Das</span><input class="entrada" type="time" data-lemb="silencioIni" value="${esc(
    c.silencioIni
  )}"><span>às</span><input class="entrada" type="time" data-lemb="silencioFim" value="${esc(c.silencioFim)}"></div>
        ${chave("fimDeSemana", "Avisar nos fins de semana")}
        ${chave("sistema", "Também como notificação do celular", "Pede permissão. No iPhone, com o app na Tela de Início")}
      </div>
      <button type="button" class="bt bt-sec bt-peq" data-acao="aj-lembrete-testar" style="margin-top:12px">${ic("bell-ring", "i-p")}Testar um lembrete</button>
    </section>

    <section class="secao">
      <h2 class="titulo-secao" style="margin-bottom:6px">Assistente e conexões</h2>
      <p class="ajuda" style="margin-bottom:12px">De onde o assistente lê as conversas e para onde leva as informações.</p>
      <div class="lista-config">
        ${[
          ["message-circle", "WhatsApp comercial", "Conversas com clientes e grupos de projeto", "Simulado"],
          ["mail", "E-mails da equipe", "Cada sócio autoriza a própria caixa", "Simulado"],
          ["briefcase", "CRM", "Clientes, propostas e funil", "A definir"],
          ["folder", "Dropbox", "Pastas de projeto e arquivos do campo", "A definir"],
        ]
          .map(
            ([i, t, d, s]) => `<div class="cfg-linha">${ic(i)}<div class="txt">${esc(t)}<small>${esc(d)}</small></div><span class="selo areia">${esc(s)}</span></div>`
          )
          .join("")}
      </div>
    </section>`;
}

// ---------------------------------------------------------------- Início e projeto

function renderTarefasInicio() {
  const el = document.getElementById("ini-tarefas");
  if (!el) return;
  const eu = euId();
  const ab = tarefasAbertas(eu).sort(ordemTarefa);
  const sug = sugestoesPendentes().filter((t) => t.responsavel === eu);
  if (!ab.length && !sug.length) {
    el.innerHTML = "";
    return;
  }
  const mostrar = ab.slice(0, 4);
  el.innerHTML = `
    <div class="secao-cab">
      <h2 class="titulo-secao">Minhas tarefas</h2>
      <button type="button" class="bt bt-fan bt-peq" data-acao="aba" data-tela="tarefas">Ver todas</button>
    </div>
    ${
      sug.length
        ? `<button type="button" class="aviso tf-aviso-sug" data-acao="tf-modo" data-valor="assistente">${ic("sparkle")}
            <span class="aviso-corpo"><strong>${sug.length} ${sug.length === 1 ? "sugestão" : "sugestões"} do assistente</strong> para confirmar</span>${ic("chevron-right", "i-p")}</button>`
        : ""
    }
    ${mostrar.length ? `<div class="tf-lista">${mostrar.map((t) => tarefaHTML(t)).join("")}</div>` : ""}
    ${ab.length > mostrar.length ? `<p class="mini texto-3" style="margin-top:8px">e mais ${ab.length - mostrar.length}</p>` : ""}`;
}

function renderTarefasProjeto(p) {
  const el = document.getElementById("pj-tarefas");
  if (!el) return;
  const l = tarefasDoProjeto(p).sort(ordemTarefa);
  el.innerHTML = l.length
    ? `<div class="tf-lista">${l.map((t) => tarefaHTML(t, { comResponsavel: true })).join("")}</div>`
    : `<p class="ajuda">Nenhuma tarefa aberta neste projeto.</p>`;
}

// ---------------------------------------------------------------- Início

function iniciarTarefas() {
  atualizarSeloTarefas();
  renderAjustesTarefas();
  setTimeout(verificarLembretes, 1200);
  setInterval(verificarLembretes, 60000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") setTimeout(verificarLembretes, 600);
  });
}
