/* =========================================================================
   Ensaio de permeabilidade em furo (nível variável / rebaixamento)
   ========================================================================= */
"use strict";

let editEnsId = null;
let ensTimer = null; // cronômetro do ensaio
let ensSat = null; // contagem regressiva da saturação

const autoEns = criarAutosalvar({
  tipo: "ensaio",
  coletar: () => coletarEnsaio(),
  rotulo: (d) => (d.idEnsaio || "Ensaio") + (d.projeto ? " · " + d.projeto : ""),
  estadoEl: "en-estado",
});

const PLANOS_DESC = {
  rapido: "Leituras em 30 s, 1 min e depois a cada minuto até 20 min.",
  dez: "Leituras a cada 10 min até 30 min.",
  pers: "Defina o intervalo e a duração das leituras.",
};

TELAS.ensaio = {
  id: "tela-ensaio",
  titulo: () => {
    const id = $("#ens-id").value.trim();
    const proj = projetoDeCampo($("#ens-projeto").value);
    return { titulo: id || "Novo ensaio", sub: [proj, "permeabilidade"].filter(Boolean).join(" · ") };
  },
  acoesBarra: () => [{ icone: "ellipsis", acao: "en-menu", rotulo: "Mais opções" }],
  abrir(params, { voltando }) {
    if (voltando) return;
    abrirEnsaio(params);
  },
  aoSair() {
    autoEns.encerrar();
  },
};

// ---------------------------------------------------------------- Coleta / preenchimento

function coletarEnsaio() {
  const leituras = $$("#ens-leituras .te-linha").map((row) => ({
    t: Number(row.dataset.t),
    dh: row.querySelector(".ens-dh").value.trim(),
  }));
  return {
    projetoId: Number($("#ens-projetoid").value) || null,
    projeto: projetoDeCampo($("#ens-projeto").value),
    idEnsaio: $("#ens-id").value.trim(),
    furo: $("#ens-furo").value.trim(),
    local: $("#ens-local").value.trim(),
    lat: $("#ens-lat").value || "",
    lon: $("#ens-lon").value || "",
    data: $("#ens-data").value,
    hora: $("#ens-hora").value,
    diametro: $("#ens-diam").value.trim(),
    diamUnid: $("#ens-diam-unid").value,
    profundidade: $("#ens-prof").value.trim(),
    trecho: $("#ens-trecho").value.trim(),
    posicao: $("#ens-posicao").value,
    plano: $("#ens-plano").value,
    persInt: $("#ens-pers-int").value,
    persTot: $("#ens-pers-tot").value,
    leituras,
    obs: $("#ens-obs").value.trim(),
    responsavel: $("#ens-resp").value.trim(),
    verificado: $("#ens-verif").value.trim(),
  };
}

function ensaioEmBranco(params) {
  const p = params.projetoId ? projetoPorId(params.projetoId) : null;
  return {
    projetoId: p ? p.id : null,
    projeto: p ? p.numero : "",
    idEnsaio: params.idEnsaio || "",
    furo: "",
    local: p ? p.local : "",
    lat: "",
    lon: "",
    data: hojeISO(),
    hora: "",
    diametro: "",
    diamUnid: "pol",
    profundidade: "",
    trecho: "",
    posicao: "acima",
    plano: "rapido",
    persInt: "5",
    persTot: "30",
    leituras: [],
    obs: "",
    responsavel: Dados.config.equipe.responsavel || "",
    verificado: "",
  };
}

function definirPlano(plano) {
  $("#ens-plano").value = plano;
  $$("#ens-plano-seg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.valor === plano)));
  $("#ens-plano-pers").classList.toggle("oculto", plano !== "pers");
  $("#ens-plano-desc").textContent = PLANOS_DESC[plano] || "";
}

function preencherEnsaio(reg) {
  $("#ens-projetoid").value = reg.projetoId || "";
  $("#ens-projeto").value = projetoParaCampo(reg.projeto || "");
  $("#ens-id").value = reg.idEnsaio || "";
  $("#ens-furo").value = reg.furo || "";
  $("#ens-local").value = reg.local || "";
  $("#ens-lat").value = reg.lat || "";
  $("#ens-lon").value = reg.lon || "";
  mostrarCoordenadas("ens", reg.lat, reg.lon);
  $("#ens-data").value = reg.data || "";
  $("#ens-hora").value = reg.hora || "";
  $("#ens-diam").value = reg.diametro || "";
  $("#ens-diam-unid").value = reg.diamUnid || "pol";
  $("#ens-prof").value = reg.profundidade || "";
  $("#ens-trecho").value = reg.trecho || "";
  $("#ens-posicao").value = reg.posicao || "acima";
  $("#ens-pers-int").value = reg.persInt || "5";
  $("#ens-pers-tot").value = reg.persTot || "30";
  definirPlano(reg.plano || "rapido");
  $("#ens-obs").value = reg.obs || "";
  $("#ens-resp").value = reg.responsavel || "";
  $("#ens-verif").value = reg.verificado || "";
  const leit = reg.leituras || [];
  if (leit.length) {
    const valores = {};
    leit.forEach((l) => {
      if (l.dh !== "") valores[l.t] = l.dh;
    });
    renderLeiturasEnsaio(leit.map((l) => Number(l.t)).sort((a, b) => a - b), valores);
  } else {
    renderLeiturasEnsaio(temposDoPlanoAtual(), {});
  }
}

function temposDoPlanoAtual() {
  return temposDoPlano($("#ens-plano").value, $("#ens-pers-int").value, $("#ens-pers-tot").value);
}

function abrirEnsaio(params) {
  $("#en-rascunho").innerHTML = "";
  let rascunho = null;
  let chave;
  if (params.rascunho && Dados.rascunhos[params.rascunho]) {
    chave = params.rascunho;
    rascunho = Dados.rascunhos[chave];
    editEnsId = rascunho.editId || null;
  } else if (params.id) {
    editEnsId = params.id;
    chave = "ensaio:e:" + params.id;
    rascunho = Dados.rascunhos[chave] || null;
  } else {
    editEnsId = null;
    const pid = params.projetoId || null;
    const achado = params.idEnsaio
      ? Dados.listaRascunhos().find(
          (r) => r.tipo === "ensaio" && !r.editId && (r.projetoId || null) === pid && r.dados && r.dados.idEnsaio === params.idEnsaio
        )
      : null;
    chave = achado ? achado.chave : "ensaio:n:" + Date.now();
    rascunho = achado || null;
  }
  // O cronômetro continua se o usuário saiu e voltou ao mesmo ensaio
  const manter = (ensTimer && ensTimer.chave === chave) || (ensSat && ensSat.chave === chave);
  if (!manter) {
    pararSaturacao();
    if (ensTimer) pararCronometroEnsaio();
    $("#ens-relogio").textContent = "00:00";
    $("#ens-timer-msg").textContent =
      "Encha o furo até a boca e mantenha o nível por cerca de 10 min para saturar. Ao cortar a água, toque em Iniciar.";
  }
  const salvo = editEnsId ? Dados.achar("ensaios", editEnsId) : null;
  if (editEnsId && !salvo && !rascunho) {
    toast("Ensaio não encontrado", { icone: "circle-alert" });
    Nav.voltar();
    return;
  }
  const base = salvo || ensaioEmBranco(rascunho ? { projetoId: rascunho.projetoId } : params);
  preencherEnsaio(base);
  // Ensaio novo dentro do projeto: geometria e equipe do ensaio anterior
  if (!salvo && !rascunho && params.projetoId) {
    const anteriores = ensaiosDoProjeto(params.projetoId);
    if (anteriores.length) copiarGeometriaEnsaio(anteriores[anteriores.length - 1], false);
  }
  autoEns.iniciar(chave, { editId: editEnsId, projetoId: base.projetoId || null });
  if (rascunho) {
    preencherEnsaio(rascunho.dados);
    bannerRascunho("en-rascunho", rascunho, () => {
      autoEns.descartar();
      preencherEnsaio(salvo || ensaioEmBranco(params));
      autoEns.rebasear();
      atualizarResultadoEnsaio();
    });
    autoEns.mostrarEstado("Rascunho recuperado");
  }
  $("#en-salvar-txt").textContent = editEnsId ? "Salvar alterações" : "Salvar ensaio";
  if (manter && ensTimer) {
    $("#ens-btn-iniciar span").textContent = "Reiniciar (t0)";
    $("#ens-btn-parar").classList.remove("oculto");
    tickEnsaio();
  }
  atualizarResultadoEnsaio();
  Nav.atualizarBarra();
}

// ---------------------------------------------------------------- Leituras

function linhaLeituraHTML(t, dh) {
  return `
    <div class="te-linha" data-t="${t}">
      <span class="leit-t">${rotuloTempo(t)}</span>
      <span class="leit-h">—</span>
      <input class="entrada num ens-dh" type="number" step="0.1" inputmode="decimal" enterkeyhint="next"
             value="${dh === undefined || dh === null ? "" : esc(dh)}" placeholder="${t === 0 ? "0" : "cm"}"
             aria-label="Variação do NA em ${rotuloTempo(t)}" />
    </div>`;
}

function valoresLeiturasAtuais() {
  const mapa = {};
  $$("#ens-leituras .te-linha").forEach((row) => {
    const v = row.querySelector(".ens-dh").value;
    if (v !== "") mapa[row.dataset.t] = v;
  });
  return mapa;
}

function renderLeiturasEnsaio(tempos, valores) {
  $("#ens-leituras").innerHTML = tempos
    .map((t) => linhaLeituraHTML(t, valores[t] !== undefined ? valores[t] : t === 0 ? "0" : ""))
    .join("");
  renderHorasLeituras();
  atualizarResultadoEnsaio();
}

function aplicarPlanoEnsaio() {
  const valores = valoresLeiturasAtuais();
  const tempos = temposDoPlanoAtual();
  // Mantém leituras já anotadas em tempos fora do novo plano
  Object.keys(valores).forEach((t) => {
    if (!tempos.includes(Number(t))) tempos.push(Number(t));
  });
  tempos.sort((a, b) => a - b);
  renderLeiturasEnsaio(tempos, valores);
}

function adicionarLeituraEnsaio() {
  const ts = $$("#ens-leituras .te-linha").map((r) => Number(r.dataset.t));
  const ult = ts.length ? ts[ts.length - 1] : 0;
  const passo = ts.length >= 2 ? ult - ts[ts.length - 2] : 60;
  $("#ens-leituras").insertAdjacentHTML("beforeend", linhaLeituraHTML(ult + (passo > 0 ? passo : 60), ""));
  renderHorasLeituras();
  const linhas = $$("#ens-leituras .ens-dh");
  linhas[linhas.length - 1].focus();
  autoEns.agendar();
}

function renderHorasLeituras() {
  const h0 = $("#ens-hora").value;
  $$("#ens-leituras .te-linha").forEach((row) => {
    row.querySelector(".leit-h").textContent = horaMaisSegundos(h0, Number(row.dataset.t));
  });
}

// ---------------------------------------------------------------- Resultado

function graficoEnsaioSVG(c) {
  const W = 320;
  const H = 180;
  const m = { l: 42, r: 10, t: 10, b: 30 };
  const pw = W - m.l - m.r;
  const ph = H - m.t - m.b;
  const pts = c.leit.map((l) => ({ x: l.t / 60, y: l.dh - c.base }));
  const xmax = Math.max(1, ...pts.map((p) => p.x));
  const ymax = Math.max(0.1, ...pts.map((p) => p.y)) * 1.1;
  const X = (x) => m.l + (x / xmax) * pw;
  const Y = (y) => m.t + (y / ymax) * ph;
  const passo = (v) => {
    const p = Math.pow(10, Math.floor(Math.log10(v / 5)));
    return [1, 2, 5, 10].map((k) => k * p).find((k) => v / k <= 6);
  };
  const sx = passo(xmax);
  const sy = passo(ymax);
  let s = `<svg class="grafico-ensaio" viewBox="0 0 ${W} ${H}" role="img" aria-label="Rebaixamento do nível d'água ao longo do tempo" font-family="Inter, sans-serif">`;
  for (let x = 0; x <= xmax + 1e-9; x += sx) {
    s += `<line x1="${X(x)}" x2="${X(x)}" y1="${m.t}" y2="${m.t + ph}" stroke="#e1e8ed"/><text x="${X(x)}" y="${H - 14}" font-size="10" text-anchor="middle" fill="#5b6a79">${fmtNumBR(x, 1)}</text>`;
  }
  for (let y = 0; y <= ymax + 1e-9; y += sy) {
    s += `<line x1="${m.l}" x2="${m.l + pw}" y1="${Y(y)}" y2="${Y(y)}" stroke="#e1e8ed"/><text x="${m.l - 6}" y="${Y(y) + 3.5}" font-size="10" text-anchor="end" fill="#5b6a79">${fmtNumBR(y, 1)}</text>`;
  }
  s += `<rect x="${m.l}" y="${m.t}" width="${pw}" height="${ph}" fill="none" stroke="#13294b"/>`;
  s += `<text x="${m.l + pw / 2}" y="${H - 2}" font-size="10" text-anchor="middle" fill="#3c4a5a">tempo (min)</text>`;
  s += `<text transform="translate(10 ${m.t + ph / 2}) rotate(-90)" font-size="10" text-anchor="middle" fill="#3c4a5a">rebaixamento (cm)</text>`;
  s += `<line x1="${X(0)}" y1="${Y(0)}" x2="${X(c.dt / 60)}" y2="${Y(c.dh)}" stroke="#6399ae" stroke-width="1.5" stroke-dasharray="5 4"/>`;
  s += `<polyline fill="none" stroke="#004f71" stroke-width="2.2" points="${pts.map((p) => X(p.x) + "," + Y(p.y)).join(" ")}"/>`;
  s += pts.map((p) => `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="3.2" fill="#004f71"/>`).join("");
  return s + "</svg>";
}

function atualizarResultadoEnsaio() {
  const el = $("#ens-resultado");
  if (!el) return;
  const c = calcularEnsaio(coletarEnsaio());
  if (!c.ok) {
    el.innerHTML = `<div class="perfil-linha info">${ic("info")}<span>${esc(c.aviso)}</span></div>`;
    return;
  }
  el.innerHTML =
    `<div class="resultado-k">K = ${fmtCientifico(c.K)} cm/s</div>` +
    `<div class="resultado-classe">${esc(c.classe)}</div>` +
    `<div class="resultado-detalhe">Δh = ${fmtNumBR(c.dh)} cm em Δt = ${fmtNumBR(c.dt / 60)} min (${c.dt} s) · ` +
    `r = ${fmtNumBR(c.r, 2)} cm · h = ${fmtNumBR(c.h, 1)} cm · volume infiltrado ${fmtNumBR(c.volume, 3)} L</div>` +
    graficoEnsaioSVG(c);
}
const atualizarResultadoEnsaioDep = debounce(atualizarResultadoEnsaio, 120);

// ---------------------------------------------------------------- Cronômetro

function pararSaturacao() {
  if (ensSat) clearInterval(ensSat.int);
  ensSat = null;
}

function prepararAudioEnsaio() {
  // O iPhone só libera som se o contexto de áudio nascer de um toque
  try {
    const C = window.AudioContext || window.webkitAudioContext;
    if (C && !window.__ensAudio) window.__ensAudio = new C();
    if (window.__ensAudio && window.__ensAudio.state === "suspended") window.__ensAudio.resume();
  } catch (e) {}
}

function bipEnsaio(longo) {
  try {
    const c = window.__ensAudio;
    if (c) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.frequency.value = 880;
      g.gain.value = 0.25;
      o.connect(g);
      g.connect(c.destination);
      o.start();
      o.stop(c.currentTime + (longo ? 0.9 : 0.35));
    }
  } catch (e) {}
  vibrar(longo ? [400, 150, 400] : [200]);
}

async function manterTelaLigada(ligar) {
  try {
    if (ligar && navigator.wakeLock && !window.__ensWake) {
      window.__ensWake = await navigator.wakeLock.request("screen");
    } else if (!ligar && window.__ensWake) {
      await window.__ensWake.release();
      window.__ensWake = null;
    }
  } catch (e) {}
}

function fmtRelogio(seg) {
  const s = Math.max(0, Math.floor(seg));
  return pad2(Math.floor(s / 60)) + ":" + pad2(s % 60);
}

function iniciarSaturacao() {
  prepararAudioEnsaio();
  pararSaturacao();
  manterTelaLigada(true);
  const fim = Date.now() + 600000;
  const msg = $("#ens-timer-msg");
  const rel = $("#ens-relogio");
  ensSat = {
    chave: autoEns.chave,
    int: setInterval(() => {
      const falta = (fim - Date.now()) / 1000;
      rel.textContent = fmtRelogio(falta);
      msg.textContent = "Saturando o solo — mantenha o furo cheio até a boca.";
      if (falta <= 0) {
        pararSaturacao();
        bipEnsaio(true);
        rel.textContent = "00:00";
        msg.textContent = "Saturação concluída. Corte a água e toque em Iniciar (t0).";
      }
    }, 250),
  };
}

function iniciarEnsaio() {
  prepararAudioEnsaio();
  pararSaturacao();
  if (ensTimer) pararCronometroEnsaio();
  const agora = new Date();
  // hora com segundos: os horários de cada leitura batem com o cronômetro
  $("#ens-hora").value = pad2(agora.getHours()) + ":" + pad2(agora.getMinutes()) + ":" + pad2(agora.getSeconds());
  renderHorasLeituras();
  const inicial = $('#ens-leituras .te-linha[data-t="0"] .ens-dh');
  if (inicial && inicial.value === "") inicial.value = "0";
  manterTelaLigada(true);
  ensTimer = { inicio: agora.getTime(), avisados: new Set(), chave: autoEns.chave, int: setInterval(tickEnsaio, 250) };
  $("#ens-btn-iniciar span").textContent = "Reiniciar (t0)";
  $("#ens-btn-parar").classList.remove("oculto");
  autoEns.agora();
  tickEnsaio();
}

function tickEnsaio() {
  if (!ensTimer) return;
  const dec = (Date.now() - ensTimer.inicio) / 1000;
  $("#ens-relogio").textContent = fmtRelogio(dec);
  const rows = $$("#ens-leituras .te-linha");
  let proxima = null;
  rows.forEach((row) => {
    const t = Number(row.dataset.t);
    row.classList.remove("proxima");
    if (t > 0 && dec >= t && !ensTimer.avisados.has(t)) {
      ensTimer.avisados.add(t);
      bipEnsaio(false);
      row.classList.add("agora");
      setTimeout(() => row.classList.remove("agora"), 4000);
      if (!$("#tela-ensaio").hidden) {
        try {
          row.scrollIntoView({ block: "center", behavior: "smooth" });
        } catch (e) {}
      }
    }
    if (!proxima && t > dec) proxima = row;
  });
  const msg = $("#ens-timer-msg");
  if (proxima) {
    proxima.classList.add("proxima");
    const t = Number(proxima.dataset.t);
    msg.textContent = "Próxima leitura: " + rotuloTempo(t) + " em " + fmtRelogio(t - dec);
  } else {
    msg.textContent = "Plano de leituras concluído. Confira os valores e salve.";
    pararCronometroEnsaio(true);
  }
}

function pararCronometroEnsaio(concluido) {
  if (ensTimer) clearInterval(ensTimer.int);
  ensTimer = null;
  $$("#ens-leituras .te-linha").forEach((r) => r.classList.remove("proxima"));
  $("#ens-btn-iniciar span").textContent = "Iniciar (t0)";
  $("#ens-btn-parar").classList.add("oculto");
  if (concluido) bipEnsaio(true);
  manterTelaLigada(false);
}

// ---------------------------------------------------------------- Salvar e afins

// Copia o que normalmente se repete entre ensaios de um mesmo campo
function copiarGeometriaEnsaio(ant, incluirIdent) {
  if (incluirIdent) {
    if (!$("#ens-projeto").value) {
      $("#ens-projeto").value = projetoParaCampo(ant.projeto || "");
      if (!$("#ens-projetoid").value && ant.projetoId) $("#ens-projetoid").value = ant.projetoId;
    }
    preencherSeVazio("ens-local", ant.local);
  }
  preencherSeVazio("ens-diam", ant.diametro);
  if (ant.diamUnid) $("#ens-diam-unid").value = ant.diamUnid;
  preencherSeVazio("ens-prof", ant.profundidade);
  preencherSeVazio("ens-trecho", ant.trecho);
  if (ant.posicao) $("#ens-posicao").value = ant.posicao;
  preencherSeVazio("ens-resp", ant.responsavel);
  preencherSeVazio("ens-verif", ant.verificado);
  if (ant.plano) {
    if (ant.persInt) $("#ens-pers-int").value = ant.persInt;
    if (ant.persTot) $("#ens-pers-tot").value = ant.persTot;
    definirPlano(ant.plano);
    aplicarPlanoEnsaio();
  }
  atualizarResultadoEnsaio();
}

async function salvarEnsaio() {
  const d = coletarEnsaio();
  if (!d.projeto) {
    toast("Informe o número do projeto", { icone: "circle-alert" });
    $("#ens-projeto").focus();
    return;
  }
  if (!d.idEnsaio) {
    toast("Informe a identificação do ensaio", { icone: "circle-alert" });
    $("#ens-id").focus();
    return;
  }
  // Remove leituras vazias no fim do plano (mantém o histórico limpo)
  while (d.leituras.length > 1 && d.leituras[d.leituras.length - 1].dh === "") d.leituras.pop();
  if (!d.furo) d.furo = d.idEnsaio;
  const c = calcularEnsaio(d);
  if (!c.ok && !(await confirmar(c.aviso, { titulo: "Ensaio incompleto", ok: "Salvar mesmo assim", cancelar: "Revisar" }))) return;
  let vinculo = "";
  if (!d.projetoId) {
    const p = projetoPorNumero(d.projeto);
    if (p) {
      d.projetoId = p.id;
      vinculo = " na pasta " + p.numero;
    }
  }
  const anterior = editEnsId ? Dados.achar("ensaios", editEnsId) : null;
  const reg = Object.assign({ id: editEnsId || Dados.novoId("ensaios") }, d);
  if (anterior) reg.atualizadoEm = Date.now();
  Dados.salvar("ensaios", reg);
  Dados.pedirPersistencia();
  if (ensTimer) pararCronometroEnsaio();
  pararSaturacao();
  autoEns.descartar();
  autoEns.ativo = false;
  Nav.voltarOu("inicio");
  toast("Ensaio " + reg.idEnsaio + " salvo" + (c.ok ? " · K = " + fmtCientifico(c.K) + " cm/s" : "") + vinculo, {
    acao: "PDF",
    aoAgir: () => gerarPDFEnsaio(reg.id),
  });
}

async function menuEnsaio() {
  const salvo = editEnsId ? Dados.achar("ensaios", editEnsId) : null;
  const itens = [];
  if (salvo) itens.push({ rotulo: "Exportar PDF", detalhe: "Versão salva deste ensaio", valor: "pdf", icone: "file-down" });
  itens.push({
    rotulo: salvo ? "Descartar alterações" : "Limpar formulário",
    detalhe: salvo ? "Volta ao que está salvo" : "Começa em branco",
    valor: "limpar",
    icone: "eraser",
  });
  if (salvo) itens.push({ rotulo: "Excluir ensaio", valor: "excluir", icone: "trash-2" });
  const op = await menuAcoes(($("#ens-id").value || "Ensaio").trim(), itens);
  if (op === "pdf") gerarPDFEnsaio(salvo.id);
  else if (op === "limpar") {
    pararSaturacao();
    if (ensTimer) pararCronometroEnsaio();
    autoEns.descartar();
    preencherEnsaio(salvo || ensaioEmBranco(Nav.topo().params || {}));
    $("#en-rascunho").innerHTML = "";
    $("#ens-relogio").textContent = "00:00";
    autoEns.rebasear();
    atualizarResultadoEnsaio();
    toast(salvo ? "Alterações descartadas" : "Formulário limpo");
  } else if (op === "excluir") {
    pararSaturacao();
    if (ensTimer) pararCronometroEnsaio();
    autoEns.descartar();
    autoEns.ativo = false;
    excluirComDesfazer("ensaios", salvo.id, "Ensaio " + (salvo.idEnsaio || "") + " excluído");
    Nav.voltarOu("inicio");
  }
}

Object.assign(ACOES, {
  "en-plano": (el) => {
    definirPlano(el.dataset.valor);
    aplicarPlanoEnsaio();
    autoEns.agendar();
  },
  "en-saturar": () => iniciarSaturacao(),
  "en-iniciar": () => iniciarEnsaio(),
  "en-parar": () => pararCronometroEnsaio(),
  "en-leitura": () => adicionarLeituraEnsaio(),
  "en-salvar": () => salvarEnsaio(),
  "en-menu": () => menuEnsaio(),
  "en-usar-ultimo": () => {
    const lista = Dados.lista("ensaios").filter((r) => r.id !== editEnsId);
    if (!lista.length) {
      toast("Nenhum ensaio anterior para copiar", { icone: "info" });
      return;
    }
    copiarGeometriaEnsaio(lista[lista.length - 1], true);
    autoEns.agendar();
    Nav.atualizarBarra();
    toast("Dados de " + (lista[lista.length - 1].idEnsaio || "ensaio anterior") + " aplicados");
  },
});

document.addEventListener("input", (e) => {
  const t = e.target;
  if (!t.closest || !t.closest("#form-ensaio")) return;
  if (t.id === "ens-hora") renderHorasLeituras();
  if (t.id === "ens-id" || t.id === "ens-projeto") Nav.atualizarBarra();
  atualizarResultadoEnsaioDep();
  autoEns.agendar();
});
document.addEventListener("change", (e) => {
  const t = e.target;
  if (!t.closest || !t.closest("#form-ensaio")) return;
  if (t.id === "ens-pers-int" || t.id === "ens-pers-tot") aplicarPlanoEnsaio();
  if (t.id === "ens-hora") renderHorasLeituras();
  atualizarResultadoEnsaio();
  autoEns.agendar();
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || !e.target.classList || !e.target.classList.contains("ens-dh")) return;
  e.preventDefault();
  const todos = $$("#ens-leituras .ens-dh");
  const prox = todos[todos.indexOf(e.target) + 1];
  if (prox) prox.focus();
  else e.target.blur();
});
document.addEventListener("focusout", (e) => {
  if (e.target && e.target.id === "ens-projeto") {
    const p = projetoDigitado("ens-projeto");
    if (p) {
      if (!$("#ens-projetoid").value) $("#ens-projetoid").value = p.id;
      preencherSeVazio("ens-local", p.local);
      autoEns.agendar();
    }
  }
});
