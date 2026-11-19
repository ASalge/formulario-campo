/* =========================================================================
   Sondagem / instalação de poço: identificação, poço, camadas (com perfil
   vivo e assistente), liners, VOC e fotos.
   ========================================================================= */
"use strict";

let editSondId = null;
let ultimoIntervaloVOC = "0,20";

// Modelo das listas dinâmicas do formulário
const SD = {
  camadas: [],
  vocs: [],
  liners: [],
  fotos: [], // { id, legenda, url }
  fotosNovas: [], // ids gravados no banco só por este formulário (ainda sem registro)
  abertas: new Set(),
  vocSel: new Set(),
  linerSel: new Set(),
};

const autoSond = criarAutosalvar({
  tipo: "sondagem",
  coletar: () => coletarSondagem(),
  rotulo: (d) => (d.idSond || "Sondagem") + (d.projeto ? " · " + d.projeto : ""),
  estadoEl: "sd-estado",
});

TELAS.sondagem = {
  id: "tela-sondagem",
  titulo: () => {
    const id = $("#sond-id").value.trim();
    const proj = projetoDeCampo($("#sond-projeto").value);
    return {
      titulo: id || "Nova sondagem",
      sub: [proj, editSondId ? "boletim salvo" : "novo boletim"].filter(Boolean).join(" · "),
    };
  },
  acoesBarra: () => [{ icone: "ellipsis", acao: "sd-menu", rotulo: "Mais opções" }],
  abrir(params, { voltando }) {
    if (voltando) return;
    abrirSondagem(params);
  },
  aoSair() {
    autoSond.encerrar();
  },
};

// ---------------------------------------------------------------- Coleta / preenchimento

function coletarSondagem() {
  const poco = $("#sond-poco").checked
    ? {
        id: $("#poco-id").value.trim(),
        prof: $("#poco-prof").value.trim(),
        filtro: $("#poco-filtro").value.trim(),
        prefiltro: $("#poco-prefiltro").value.trim(),
        naInst: $("#poco-na-inst").value.trim(),
        naEstab: $("#poco-na-estab").value.trim(),
      }
    : null;
  const liner = $("#sond-liner").checked
    ? {
        tamanho: $("#liner-tamanho").value.trim(),
        inicio: $("#liner-inicio").value.trim(),
        fim: $("#liner-fim").value.trim(),
        amostras: SD.liners.map((l) => Object.assign({}, l)),
      }
    : null;
  return {
    projetoId: Number($("#sond-projetoid").value) || null,
    projeto: projetoDeCampo($("#sond-projeto").value),
    empresa: $("#sond-empresa").value.trim(),
    local: $("#sond-local").value.trim(),
    lat: $("#sond-lat").value || "",
    lon: $("#sond-lon").value || "",
    idSond: $("#sond-id").value.trim(),
    data: $("#sond-data").value,
    profFinal: $("#sond-prof-final").value.trim(),
    nivelAgua: $("#sond-nivel-agua").value.trim(),
    obs: $("#sond-obs").value.trim(),
    poco,
    liner,
    camadas: SD.camadas.map((c) => Object.assign({}, c)),
    vocs: SD.vocs.map((v) => Object.assign({}, v)),
    fotos: SD.fotos.map((f) => ({ id: f.id, legenda: f.legenda || "" })),
    fotosNovas: SD.fotosNovas.slice(),
  };
}

function sondagemEmBranco(params) {
  const p = params.projetoId ? projetoPorId(params.projetoId) : null;
  return {
    projetoId: p ? p.id : null,
    projeto: p ? p.numero : "",
    empresa: p ? p.empresa : "",
    local: p ? p.local : "",
    lat: "",
    lon: "",
    idSond: params.idSond || "",
    data: hojeISO(),
    profFinal: "",
    nivelAgua: "",
    obs: "",
    poco: null,
    liner: null,
    camadas: [camadaVazia()],
    vocs: [],
    fotos: [],
    fotosNovas: [],
  };
}

async function preencherSondagem(d) {
  $("#sond-projetoid").value = d.projetoId || "";
  $("#sond-projeto").value = projetoParaCampo(d.projeto || "");
  $("#sond-empresa").value = d.empresa || "";
  $("#sond-local").value = d.local || "";
  $("#sond-lat").value = d.lat || "";
  $("#sond-lon").value = d.lon || "";
  mostrarCoordenadas("sond", d.lat, d.lon);
  $("#sond-id").value = d.idSond || "";
  $("#sond-data").value = d.data || "";
  $("#sond-prof-final").value = d.profFinal || "";
  $("#sond-nivel-agua").value = d.nivelAgua || "";
  $("#sond-obs").value = d.obs || "";

  const po = d.poco;
  $("#sond-poco").checked = !!po;
  $("#campos-poco").classList.toggle("oculto", !po);
  $("#poco-id").value = (po && po.id) || "";
  $("#poco-prof").value = (po && po.prof) || "";
  $("#poco-filtro").value = (po && po.filtro) || "";
  $("#poco-prefiltro").value = (po && po.prefiltro) || "";
  $("#poco-na-inst").value = (po && po.naInst) || "";
  $("#poco-na-estab").value = (po && po.naEstab) || "";

  const li = d.liner;
  $("#sond-liner").checked = !!li;
  $("#campos-liner").classList.toggle("oculto", !li);
  $("#liner-tamanho").value = (li && li.tamanho) || "";
  $("#liner-inicio").value = (li && li.inicio) || "";
  $("#liner-fim").value = (li && li.fim) || "";
  SD.liners = ((li && li.amostras) || []).map((a) => ({
    de: a.de || "",
    ate: a.ate || "",
    recuperacao: a.recuperacao || "",
    tamanho: a.tamanho || (li && li.tamanho) || "",
    obs: a.obs || "",
  }));

  SD.camadas = (d.camadas || []).map((c) => Object.assign(camadaVazia(), c));
  if (!SD.camadas.length) SD.camadas.push(camadaVazia());
  SD.vocs = (d.vocs || []).map((v) => ({ profundidade: v.profundidade || "", valor: v.valor || "" }));
  SD.vocSel.clear();
  SD.linerSel.clear();
  SD.abertas.clear();
  // Camada nova/vazia já abre para preencher
  SD.camadas.forEach((c, i) => {
    if (!camadaTemAlgo(c)) SD.abertas.add(i);
  });
  SD.fotosNovas = (d.fotosNovas || []).slice();

  revogarFotos();
  SD.fotos = [];
  for (const ref of d.fotos || []) {
    const blob = await Dados.fotoObter(ref.id);
    if (blob) SD.fotos.push({ id: ref.id, legenda: ref.legenda || "", url: URL.createObjectURL(blob) });
  }
  renderTudoSondagem();
}

function revogarFotos() {
  SD.fotos.forEach((f) => {
    try {
      if (f.url) URL.revokeObjectURL(f.url);
    } catch (e) {}
    f.url = "";
  });
}

function renderTudoSondagem() {
  renderCamadas();
  renderLiners();
  renderVOCs();
  renderFotos();
  atualizarPerfilVivo();
  atualizarSugestaoProf();
  Nav.atualizarBarra();
}

async function abrirSondagem(params) {
  $("#sd-rascunho").innerHTML = "";
  let rascunho = null;
  let chave;
  if (params.rascunho && Dados.rascunhos[params.rascunho]) {
    chave = params.rascunho;
    rascunho = Dados.rascunhos[chave];
    editSondId = rascunho.editId || null;
  } else if (params.id) {
    editSondId = params.id;
    chave = "sondagem:e:" + params.id;
    rascunho = Dados.rascunhos[chave] || null;
  } else {
    editSondId = null;
    const pid = params.projetoId || null;
    const achado = params.idSond
      ? Dados.listaRascunhos().find(
          (r) => r.tipo === "sondagem" && !r.editId && (r.projetoId || null) === pid && r.dados && r.dados.idSond === params.idSond
        )
      : null;
    chave = achado ? achado.chave : "sondagem:n:" + Date.now();
    rascunho = achado || null;
  }
  const salvo = editSondId ? Dados.achar("sondagem", editSondId) : null;
  if (editSondId && !salvo && !rascunho) {
    toast("Sondagem não encontrada", { icone: "circle-alert" });
    Nav.voltar();
    return;
  }
  const base = salvo ? Object.assign({ fotosNovas: [] }, clonar(salvo)) : sondagemEmBranco(rascunho ? { projetoId: rascunho.projetoId } : params);
  await preencherSondagem(base);
  autoSond.iniciar(chave, {
    editId: editSondId,
    projetoId: base.projetoId || null,
  });
  if (rascunho) {
    await preencherSondagem(rascunho.dados);
    bannerRascunho("sd-rascunho", rascunho, async () => {
      const novas = SD.fotosNovas.slice();
      autoSond.descartar();
      novas.forEach((id) => Dados.fotoRemover(id));
      await preencherSondagem(salvo ? Object.assign({ fotosNovas: [] }, clonar(salvo)) : sondagemEmBranco(params));
      autoSond.rebasear();
    });
    autoSond.mostrarEstado("Rascunho recuperado");
  }
  $("#sd-salvar-txt").textContent = editSondId ? "Salvar alterações" : "Salvar sondagem";
  marcarSecaoAtual();
}

// ---------------------------------------------------------------- Camadas

function faixaCamadaTexto(c) {
  const de = num(c.profDe);
  const ate = num(c.profAte);
  if (isNaN(de) && isNaN(ate)) return "Profundidade a definir";
  return (isNaN(de) ? "?" : fmtDec(de, 2)) + " – " + (isNaN(ate) ? "?" : fmtDec(ate, 2)) + " m";
}

function resumoCamadaTexto(c) {
  const d = montarDescricaoCamada(c);
  return d === "—" ? "Sem descrição ainda" : d;
}

function opcoesSelect(opcoes, valor) {
  const temValor = valor && opcoes.includes(valor);
  return (
    `<option value="">Selecione</option>` +
    opcoes.map((o) => `<option value="${esc(o)}"${o === valor ? " selected" : ""}>${esc(o)}</option>`).join("") +
    `<option value="__outro__"${valor && !temValor ? " selected" : ""}>Outro (digitar)</option>`
  );
}

function campoSelectCamada(i, def, c) {
  const valor = c[def.campo] || "";
  const outro = valor && !def.opcoes.includes(valor);
  const previa =
    def.campo === "cor"
      ? `<i class="cor-previa" data-previa="${i}" style="background:${corParaHex(valor) || "transparent"};${valor ? "" : "display:none"}"></i>`
      : "";
  return `
    <div class="campo">
      <label class="rotulo" for="sd-c${i}-${def.campo}">${esc(def.rotulo)}${previa}</label>
      <select class="entrada" id="sd-c${i}-${def.campo}" data-c="${i}" data-sel="${def.campo}">${opcoesSelect(def.opcoes, valor)}</select>
      <input class="entrada outro${outro ? "" : " oculto"}" type="text" data-c="${i}" data-outro="${def.campo}"
             placeholder="Digite: ${esc(def.rotulo.toLowerCase())}" value="${outro ? esc(valor) : ""}" />
    </div>`;
}

function camadaHTML(c, i) {
  const aberta = SD.abertas.has(i);
  const cor = corParaHex(c.cor);
  const corpo = aberta
    ? `
    <div class="camada-corpo">
      <button type="button" class="bt bt-teal bt-largo bt-assistente" data-acao="cam-wizard" data-c="${i}">
        ${ic("sparkles")}Caracterizar com o assistente
      </button>
      <div class="grade-2">
        <div class="campo">
          <label class="rotulo" for="sd-c${i}-de">De (m)</label>
          <input class="entrada num" id="sd-c${i}-de" type="number" step="0.01" inputmode="decimal" data-c="${i}" data-k="profDe" value="${esc(c.profDe || "")}" />
        </div>
        <div class="campo">
          <label class="rotulo" for="sd-c${i}-ate">Até (m)</label>
          <input class="entrada num" id="sd-c${i}-ate" type="number" step="0.01" inputmode="decimal" data-c="${i}" data-k="profAte" value="${esc(c.profAte || "")}" />
        </div>
      </div>
      ${campoSelectCamada(i, CAMPOS_CAMADA[0], c)}
      <div class="campo">
        <label class="rotulo" for="sd-c${i}-desc">Descrição <span class="opcional">· texto livre</span></label>
        <textarea class="entrada" id="sd-c${i}-desc" rows="3" data-c="${i}" data-k="descricao" placeholder="Características observadas.">${esc(c.descricao || "")}</textarea>
      </div>
      ${CAMPOS_CAMADA.slice(1).map((def) => campoSelectCamada(i, def, c)).join("")}
      <label class="interruptor mini-interruptor">
        <span class="interruptor-texto">Houve amostragem nesta camada</span>
        <input type="checkbox" data-c="${i}" data-k="houveAmostra" ${c.houveAmostra ? "checked" : ""} />
        <span class="chave" aria-hidden="true"></span>
      </label>
      <div class="campo${c.houveAmostra ? "" : " oculto"}" data-intervalo="${i}">
        <label class="rotulo" for="sd-c${i}-int">Intervalo amostrado (m)</label>
        <input class="entrada num" id="sd-c${i}-int" type="text" data-c="${i}" data-k="intervaloAmostra" placeholder="Ex.: 1,50–2,00" value="${esc(c.intervaloAmostra || "")}" />
      </div>
      <div class="camada-rodape">
        <button type="button" class="bt bt-perigo bt-peq" data-acao="cam-remover" data-c="${i}">${ic("trash-2", "i-p")}Remover camada</button>
        <button type="button" class="bt bt-fan bt-peq" data-acao="cam-alternar" data-c="${i}">${ic("chevron-up", "i-p")}Recolher</button>
      </div>
    </div>`
    : "";
  return `
    <article class="camada${aberta ? " aberta" : ""}" id="sd-cam-${i}" data-c="${i}">
      <button type="button" class="camada-cab" data-acao="cam-alternar" data-c="${i}" aria-expanded="${aberta}">
        <span class="camada-n">${pad2(i + 1)}</span>
        <span class="camada-cor" data-cor="${i}" style="background:${cor || "#e3e9ed"}"></span>
        <span class="camada-resumo">
          <strong data-faixa="${i}">${esc(faixaCamadaTexto(c))}</strong>
          <span data-resumo="${i}">${esc(resumoCamadaTexto(c))}</span>
        </span>
        ${c.houveAmostra ? `<span class="selo">${ic("flask-conical")}amostra</span>` : ""}
        ${ic("chevron-down", "camada-seta")}
      </button>
      ${corpo}
    </article>`;
}

function renderCamadas() {
  $("#sd-camadas").innerHTML = SD.camadas.map(camadaHTML).join("");
  $("#sd-n-camadas").textContent = SD.camadas.filter(camadaTemAlgo).length;
}

function renderCamada(i) {
  const el = document.getElementById("sd-cam-" + i);
  if (!el) return renderCamadas();
  el.outerHTML = camadaHTML(SD.camadas[i], i);
}

function atualizarCabecalhoCamada(i) {
  const c = SD.camadas[i];
  const f = $(`[data-faixa="${i}"]`);
  const r = $(`[data-resumo="${i}"]`);
  const cor = $(`[data-cor="${i}"]`);
  if (f) f.textContent = faixaCamadaTexto(c);
  if (r) r.textContent = resumoCamadaTexto(c);
  if (cor) cor.style.background = corParaHex(c.cor) || "#e3e9ed";
  const prev = $(`[data-previa="${i}"]`);
  if (prev) {
    const h = corParaHex(c.cor);
    prev.style.background = h || "transparent";
    prev.style.display = c.cor ? "" : "none";
  }
  $("#sd-n-camadas").textContent = SD.camadas.filter(camadaTemAlgo).length;
}

function abrirCamada(i, rolar = true) {
  SD.abertas.add(i);
  renderCamada(i);
  if (rolar) {
    const el = document.getElementById("sd-cam-" + i);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function adicionarCamada(base) {
  const ant = SD.camadas[SD.camadas.length - 1];
  const nova = Object.assign(camadaVazia(), base || {});
  // Continuidade: a nova camada começa onde a anterior terminou
  if (ant && ant.profAte) nova.profDe = ant.profAte;
  SD.camadas.push(nova);
  const i = SD.camadas.length - 1;
  SD.abertas.add(i);
  renderCamadas();
  atualizarPerfilVivo();
  autoSond.agendar();
  const el = document.getElementById("sd-cam-" + i);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    const alvo = el.querySelector(nova.profDe ? '[data-k="profAte"]' : '[data-k="profDe"]');
    if (alvo) setTimeout(() => alvo.focus({ preventScroll: true }), 250);
  }
}

function repetirUltimaCamada() {
  const ant = SD.camadas[SD.camadas.length - 1];
  if (!ant) return adicionarCamada();
  const copia = {};
  ["cor", "genese", "material", "textura", "caracteristicas", "grauSelecao", "obsExtras", "descricao"].forEach(
    (k) => (copia[k] = ant[k] || "")
  );
  adicionarCamada(copia);
}

async function removerCamada(i) {
  const antes = SD.camadas.map((c) => Object.assign({}, c));
  SD.camadas.splice(i, 1);
  const abertas = [...SD.abertas].filter((x) => x !== i).map((x) => (x > i ? x - 1 : x));
  SD.abertas = new Set(abertas);
  if (!SD.camadas.length) {
    SD.camadas.push(camadaVazia());
    SD.abertas.add(0);
  }
  renderCamadas();
  atualizarPerfilVivo();
  autoSond.agendar();
  toast("Camada " + (i + 1) + " removida", {
    acao: "Desfazer",
    icone: "trash-2",
    aoAgir: () => {
      SD.camadas = antes;
      renderCamadas();
      atualizarPerfilVivo();
      autoSond.agendar();
    },
  });
}

function ordenarCamadasForm() {
  const ord = ordenarCamadas(SD.camadas);
  SD.camadas = ord;
  SD.abertas.clear();
  renderCamadas();
  atualizarPerfilVivo();
  autoSond.agendar();
  toast("Camadas em ordem de profundidade");
}

function camadasForaDeOrdem() {
  let ult = -Infinity;
  for (const c of SD.camadas) {
    const de = num(c.profDe);
    if (isNaN(de)) continue;
    if (de < ult - 0.0001) return true;
    ult = de;
  }
  return false;
}

async function copiarDeOutraSondagem() {
  const todas = Dados.lista("sondagem")
    .filter((r) => r.id !== editSondId && (r.camadas || []).length)
    .slice()
    .reverse();
  if (!todas.length) {
    alerta("Não há outra sondagem com camadas para copiar.");
    return;
  }
  const pidAtual = Number($("#sond-projetoid").value) || null;
  // As do mesmo projeto primeiro
  todas.sort((a, b) => (b.projetoId === pidAtual) - (a.projetoId === pidAtual));
  const escolhida = await escolher({
    titulo: "Copiar camadas de…",
    texto: "As camadas entram neste boletim; você ajusta o que mudar.",
    busca: true,
    itens: todas.map((r) => ({
      rotulo: (r.projeto ? r.projeto + " · " : "") + (r.idSond || "sem ID"),
      detalhe:
        (r.camadas || []).length + " camadas" +
        ((r.vocs || []).length ? " · " + r.vocs.length + " VOC" : "") +
        (r.data ? " · " + dataBR(r.data) : ""),
      valor: r.id,
      icone: "layers",
    })),
  });
  if (!escolhida) return;
  const origem = todas.find((r) => r.id === escolhida);
  const incluirVOC =
    (origem.vocs || []).length > 0 &&
    (await confirmar(
      "As profundidades vêm junto; os valores ficam em branco para você preencher com as leituras deste furo.",
      { titulo: "Copiar também as " + origem.vocs.length + " profundidades de VOC?", ok: "Copiar profundidades", cancelar: "Só as camadas" }
    ));
  // Se o formulário só tem a camada inicial vazia, substitui; senão, acrescenta
  const soVazia = SD.camadas.length === 1 && !SD.camadas[0].profDe && !SD.camadas[0].profAte && !SD.camadas[0].descricao;
  if (soVazia) SD.camadas = [];
  (origem.camadas || []).forEach((c) => SD.camadas.push(Object.assign(camadaVazia(), clonar(c))));
  SD.abertas.clear();
  if (incluirVOC) {
    const vazias = SD.vocs.every((v) => !v.profundidade && !v.valor);
    if (vazias) SD.vocs = [];
    // Valor deliberadamente em branco: cada furo tem leituras próprias
    origem.vocs.forEach((v) => SD.vocs.push({ profundidade: v.profundidade || "", valor: "" }));
    renderVOCs();
  }
  renderCamadas();
  atualizarPerfilVivo();
  autoSond.agendar();
  toast("Camadas copiadas de " + (origem.idSond || "sondagem"));
}

// ---------------------------------------------------------------- Perfil vivo

function perfilVivoSVG(d) {
  const W = 96;
  const H = 250;
  const xC = 30; // início da coluna
  const wC = 60;
  const camadas = d.camadas
    .map((c, i) => ({ i, de: num(c.profDe), ate: num(c.profAte), cor: corParaHex(c.cor) || COR_SEM_DADO }))
    .filter((c) => !isNaN(c.de) && !isNaN(c.ate) && c.ate > c.de);
  const pf = num(d.profFinal);
  const na = num(d.nivelAgua);
  let pmax = Math.max(0, ...camadas.map((c) => c.ate), isNaN(pf) ? 0 : pf, isNaN(na) ? 0 : na);
  const po = d.poco;
  const pPoco = po ? num(po.prof) : NaN;
  if (!isNaN(pPoco)) pmax = Math.max(pmax, pPoco);
  if (!(pmax > 0)) pmax = 1;
  const y = (p) => 4 + (p / pmax) * (H - 8);
  const passos = [0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50];
  const passo = passos.find((s) => pmax / s <= 7) || 100;
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Perfil da sondagem">
    <defs>
      <pattern id="pv-vazio" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="6" height="6" fill="#fdecea"/><line x1="0" y1="0" x2="0" y2="6" stroke="#b3261e" stroke-width="2"/>
      </pattern>
      <pattern id="pv-fundo" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="6" height="6" fill="#f3f5f7"/><line x1="0" y1="0" x2="0" y2="6" stroke="#c4ced6" stroke-width="1.5"/>
      </pattern>
      <pattern id="pv-filtro" width="4" height="3" patternUnits="userSpaceOnUse">
        <rect width="4" height="3" fill="#fff"/><rect width="4" height="1" fill="#13294b"/>
      </pattern>
    </defs>
    <rect x="${xC}" y="4" width="${wC}" height="${H - 8}" fill="#f3f5f7" stroke="#c4ced6"/>`;
  for (let m = 0; m <= pmax + 1e-9; m = Math.round((m + passo) * 1000) / 1000) {
    svg += `<line x1="${xC - 4}" x2="${xC}" y1="${y(m)}" y2="${y(m)}" stroke="#5b6a79"/>
      <text x="${xC - 6}" y="${y(m) + 3.5}" font-size="10" text-anchor="end" fill="#5b6a79" font-family="Inter, sans-serif">${fmtDec(m)}</text>`;
  }
  const ord = camadas.slice().sort((a, b) => a.de - b.de);
  ord.forEach((c) => {
    svg += `<rect class="camada-faixa" data-acao="cam-ir" data-c="${c.i}" x="${xC}" y="${y(c.de)}" width="${wC}" height="${Math.max(1, y(c.ate) - y(c.de))}" fill="${c.cor}" stroke="#13294b" stroke-width="0.8"/>`;
    if (y(c.ate) - y(c.de) >= 13) {
      svg += `<text x="${xC + 4}" y="${y(c.de) + 11}" font-size="9.5" font-weight="600" fill="#13294b" font-family="Inter, sans-serif" style="pointer-events:none" paint-order="stroke" stroke="#fff" stroke-width="2.5">${c.i + 1}</text>`;
    }
  });
  for (let k = 1; k < ord.length; k++) {
    const a = ord[k - 1];
    const b = ord[k];
    if (b.de - a.ate > 0.001) {
      svg += `<rect x="${xC}" y="${y(a.ate)}" width="${wC}" height="${y(b.de) - y(a.ate)}" fill="url(#pv-vazio)" stroke="#b3261e"/>`;
    } else if (a.ate - b.de > 0.001) {
      svg += `<rect x="${xC + 1}" y="${y(b.de)}" width="${wC - 2}" height="${y(a.ate) - y(b.de)}" fill="none" stroke="#b3261e" stroke-width="2.2" stroke-dasharray="3 2"/>`;
    }
  }
  const ult = ord[ord.length - 1];
  if (ult && !isNaN(pf) && pf - ult.ate > 0.001) {
    svg += `<rect x="${xC}" y="${y(ult.ate)}" width="${wC}" height="${y(pf) - y(ult.ate)}" fill="url(#pv-fundo)" stroke="#c4ced6"/>`;
  }
  if (po) {
    const fundo = !isNaN(pPoco) ? pPoco : !isNaN(pf) ? pf : ult ? ult.ate : 0;
    const lF = num(po.filtro);
    const lP = num(po.prefiltro);
    const topoF = !isNaN(lF) ? Math.max(0, fundo - lF) : fundo;
    const topoP = !isNaN(lP) ? Math.max(0, fundo - lP) : topoF;
    const xm = xC + wC / 2;
    if (!isNaN(lP) && lP > 0) {
      svg += `<rect x="${xm - 10}" y="${y(topoP)}" width="20" height="${y(fundo) - y(topoP)}" fill="#fff8e6" fill-opacity="0.75" stroke="#8a6d2a" stroke-width="0.8"/>`;
    }
    if (topoF > 0) svg += `<rect x="${xm - 5}" y="${y(0)}" width="10" height="${y(topoF) - y(0)}" fill="#fff" fill-opacity="0.8" stroke="#13294b" stroke-width="1.2"/>`;
    if (!isNaN(lF) && lF > 0) svg += `<rect x="${xm - 5}" y="${y(topoF)}" width="10" height="${y(fundo) - y(topoF)}" fill="url(#pv-filtro)" stroke="#13294b" stroke-width="1.2"/>`;
  }
  if (!isNaN(na) && na >= 0) {
    svg += `<line x1="${xC - 2}" x2="${xC + wC + 2}" y1="${y(na)}" y2="${y(na)}" stroke="#004f71" stroke-width="2" stroke-dasharray="5 3"/>
      <path d="M ${xC + wC - 9} ${y(na) - 8} h 10 l -5 7 z" fill="#004f71"/>`;
  }
  return svg + "</svg>";
}

function atualizarPerfilVivo() {
  const el = $("#sd-perfil");
  if (!el) return;
  const d = coletarSondagem();
  const validas = d.camadas.filter((c) => !isNaN(num(c.profDe)) && !isNaN(num(c.profAte)));
  const avisos = avisosProfundidade(d.camadas.filter(camadaTemAlgo), d.profFinal);
  const linhas = [];
  if (!validas.length) {
    linhas.push(`<div class="perfil-linha info">${ic("info")}<span>Preencha “de” e “até” das camadas para ver o perfil e conferir vazios e sobreposições.</span></div>`);
  } else if (!avisos.length) {
    const ord = ordenarCamadas(validas);
    linhas.push(
      `<div class="perfil-linha ok">${ic("circle-check")}<span>Profundidades consistentes, de ${fmtDec(num(ord[0].profDe), 2)} a ${fmtDec(
        Math.max(...validas.map((c) => num(c.profAte))),
        2
      )} m.</span></div>`
    );
  }
  avisos.forEach((a) => linhas.push(`<div class="perfil-linha alerta">${ic("triangle-alert")}<span>${esc(a)}</span></div>`));
  if (camadasForaDeOrdem()) {
    linhas.push(
      `<div class="perfil-linha info">${ic("arrow-up-down")}<span>Camadas fora da ordem de profundidade. <button type="button" class="bt bt-fan bt-peq" data-acao="cam-ordenar" style="margin-left:-10px">Ordenar</button></span></div>`
    );
  }
  const extras = [];
  if (d.nivelAgua) extras.push("NA " + fmtDec(d.nivelAgua, 2) + " m");
  if (d.poco) extras.push((d.poco.id || "poço") + (d.poco.filtro ? ", filtro " + fmtDec(d.poco.filtro, 2) + " m" : ""));
  const nAm = d.camadas.filter((c) => c.houveAmostra).length;
  if (nAm) extras.push(nAm + (nAm === 1 ? " camada amostrada" : " camadas amostradas"));
  if (extras.length) linhas.push(`<div class="perfil-linha info">${ic("droplet")}<span>${esc(extras.join(" · "))}</span></div>`);
  el.innerHTML = `<div class="perfil-vivo">${perfilVivoSVG(d)}<div class="perfil-lista">${linhas.join("")}</div></div>`;
}
const atualizarPerfilVivoDep = debounce(atualizarPerfilVivo, 150);

function atualizarSugestaoProf() {
  const el = $("#sd-sugestao-prof");
  if (!el) return;
  const pf = $("#sond-prof-final").value.trim();
  const ates = SD.camadas.map((c) => num(c.profAte)).filter((v) => !isNaN(v));
  if (pf || !ates.length) {
    el.innerHTML = "";
    return;
  }
  const m = Math.max(...ates);
  el.innerHTML = `<button type="button" class="sugestao" data-acao="sd-usar-prof" data-v="${m}">${ic("ruler", "i-p")}Usar ${fmtDec(m, 2)} m (fim da última camada)</button>`;
}

// ---------------------------------------------------------------- VOC

function renderVOCs() {
  const cont = $("#sd-vocs");
  $("#sd-n-voc").textContent = SD.vocs.filter((v) => v.profundidade || v.valor).length;
  if (!SD.vocs.length) {
    cont.innerHTML = `<div class="vazio" style="margin-bottom:12px">${ic("gauge")}<p class="ajuda">Nenhuma medição. Use “Gerar série” para criar as profundidades no intervalo do PID, ou adicione uma a uma.</p></div>`;
    renderLoteVOC();
    return;
  }
  cont.innerHTML = `
    <div class="tabela-entrada voc-grade">
      <div class="te-cab"><span></span><span>Prof. (m)</span><span>VOC (ppm)</span><span></span></div>
      ${SD.vocs
        .map(
          (v, i) => `
        <div class="te-linha${v.profundidade && !v.valor ? " voc-sem-valor" : ""}" data-v="${i}">
          <label class="marca"><input type="checkbox" data-vsel="${i}" ${SD.vocSel.has(i) ? "checked" : ""} aria-label="Selecionar medição ${i + 1}"></label>
          <input class="entrada num voc-prof" type="number" step="0.01" inputmode="decimal" data-v="${i}" data-k="profundidade" value="${esc(v.profundidade)}" placeholder="0,00" aria-label="Profundidade">
          <input class="entrada num voc-valor" type="number" step="0.01" inputmode="decimal" enterkeyhint="next" data-v="${i}" data-k="valor" value="${esc(v.valor)}" placeholder="ppm" aria-label="VOC em ppm">
          <button type="button" class="bt bt-icone perigo" data-acao="voc-remover" data-v="${i}" aria-label="Remover medição">${ic("x")}</button>
        </div>`
        )
        .join("")}
    </div>`;
  renderLoteVOC();
}

function renderLoteVOC() {
  const n = SD.vocSel.size;
  $("#sd-voc-lote").innerHTML = n
    ? `<div class="barra-lote"><span class="txt">${n} ${n === 1 ? "selecionada" : "selecionadas"}</span>
        <button type="button" class="bt bt-sec bt-peq" data-acao="voc-limpar-sel">Limpar</button>
        <button type="button" class="bt bt-perigo bt-peq" data-acao="voc-excluir">${ic("trash-2", "i-p")}Excluir</button></div>`
    : "";
}

function adicionarVOC() {
  const n = SD.vocs.length;
  let prof = "";
  if (n >= 2) {
    const a = num(SD.vocs[n - 2].profundidade);
    const b = num(SD.vocs[n - 1].profundidade);
    if (!isNaN(a) && !isNaN(b) && b > a) {
      const casas = (String(SD.vocs[n - 1].profundidade).split(/[.,]/)[1] || "").length || 2;
      prof = (b + (b - a)).toFixed(Math.min(3, casas));
    }
  }
  SD.vocs.push({ profundidade: prof, valor: "" });
  renderVOCs();
  autoSond.agendar();
  const linhas = $$("#sd-vocs .te-linha");
  const ult = linhas[linhas.length - 1];
  if (ult) {
    const alvo = ult.querySelector(prof ? ".voc-valor" : ".voc-prof");
    alvo.focus();
  }
}

async function gerarSerieVOC() {
  const ultimaProf = (() => {
    for (let i = SD.vocs.length - 1; i >= 0; i--) {
      const p = num(SD.vocs[i].profundidade);
      if (!isNaN(p)) return p;
    }
    return NaN;
  })();
  const pf = $("#sond-prof-final").value.trim();
  const ates = SD.camadas.map((c) => num(c.profAte)).filter((v) => !isNaN(v));
  const ateSug = pf || (ates.length ? String(Math.max(...ates)) : "");
  const v = await pedirValores({
    titulo: "Gerar série de VOC",
    texto: "Cria as profundidades de medição; você só digita os valores do PID.",
    campos: [
      { id: "passo", rotulo: "Intervalo entre medições (m)", valor: ultimoIntervaloVOC, chips: ["0,10", "0,20", "0,30", "0,50", "1,00"], decimal: true, semFoco: true },
      { id: "de", rotulo: "Primeira profundidade (m)", valor: "", placeholder: "Automático", decimal: true, ajuda: !isNaN(ultimaProf) ? "Em branco: continua após " + fmtDec(ultimaProf, 2) + " m." : "Em branco: começa no primeiro intervalo." },
      { id: "ate", rotulo: "Até a profundidade (m)", valor: ateSug ? fmtDec(ateSug) : "", decimal: true },
    ],
    ok: "Gerar",
    validar: (x) => {
      const passo = num(x.passo);
      if (isNaN(passo) || passo <= 0) return "Intervalo inválido.";
      const ate = num(x.ate);
      if (isNaN(ate) || ate <= 0) return "Informe até qual profundidade gerar.";
      return "";
    },
  });
  if (!v) return;
  const passo = num(v.passo);
  ultimoIntervaloVOC = v.passo;
  const arred = (x) => Math.round(x * 1000) / 1000;
  let inicio = num(v.de);
  if (isNaN(inicio)) inicio = !isNaN(ultimaProf) ? arred(ultimaProf + passo) : passo;
  const ate = num(v.ate);
  if (ate < inicio) {
    alerta("A profundidade final é menor que a inicial (" + fmtDec(inicio, 2) + " m).");
    return;
  }
  // Remove linhas vazias para não deixar lacunas
  SD.vocs = SD.vocs.filter((x) => x.profundidade || x.valor);
  const casas = (String(v.passo).split(/[.,]/)[1] || "").length || 2;
  const primeiraNova = SD.vocs.length;
  let n = 0;
  for (let p = inicio; p <= ate + 0.0001 && n < 600; p = arred(p + passo)) {
    SD.vocs.push({ profundidade: p.toFixed(casas), valor: "" });
    n++;
  }
  SD.vocSel.clear();
  renderVOCs();
  autoSond.agendar();
  toast(n + " profundidades criadas, de " + fmtDec(inicio, 2) + " a " + fmtDec(arred(inicio + passo * (n - 1)), 2) + " m");
  const alvo = $$("#sd-vocs .voc-valor")[primeiraNova];
  if (alvo) {
    alvo.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => alvo.focus({ preventScroll: true }), 300);
  }
}

function zerarVOCsVazios() {
  const antes = SD.vocs.map((v) => Object.assign({}, v));
  let n = 0;
  SD.vocs.forEach((v) => {
    if (v.profundidade && v.valor === "") {
      v.valor = "0";
      n++;
    }
  });
  if (!n) {
    toast("Nenhuma medição sem valor", { icone: "info" });
    return;
  }
  renderVOCs();
  autoSond.agendar();
  toast(n + (n === 1 ? " medição preenchida" : " medições preenchidas") + " com 0 ppm", {
    acao: "Desfazer",
    aoAgir: () => {
      SD.vocs = antes;
      renderVOCs();
      autoSond.agendar();
    },
  });
}

function excluirVOCsSelecionadas() {
  const n = SD.vocSel.size;
  if (!n) return;
  const antes = SD.vocs.map((v) => Object.assign({}, v));
  SD.vocs = SD.vocs.filter((_, i) => !SD.vocSel.has(i));
  SD.vocSel.clear();
  renderVOCs();
  autoSond.agendar();
  toast(n + (n === 1 ? " medição excluída" : " medições excluídas"), {
    acao: "Desfazer",
    icone: "trash-2",
    aoAgir: () => {
      SD.vocs = antes;
      renderVOCs();
      autoSond.agendar();
    },
  });
}

// ---------------------------------------------------------------- Liners

function pctLiner(l) {
  const tam = num(l.tamanho || $("#liner-tamanho").value);
  const rec = num(l.recuperacao);
  if (isNaN(tam) || tam <= 0 || isNaN(rec)) return null;
  return Math.round((rec / tam) * 100);
}

function classePct(p) {
  return p == null ? "" : p >= 70 ? "bom" : p >= 40 ? "medio" : "ruim";
}

function renderLiners() {
  const cont = $("#sd-liners");
  if (!SD.liners.length) {
    cont.innerHTML = "";
    renderLoteLiner();
    return;
  }
  cont.innerHTML = `
    <div class="tabela-entrada liner-grade">
      <div class="te-cab"><span></span><span>Liner</span><span>De (m)</span><span>Até (m)</span><span>Rec. (cm)</span><span></span></div>
      ${SD.liners
        .map((l, i) => {
          const p = pctLiner(l);
          return `
        <div class="te-linha" data-l="${i}">
          <label class="marca"><input type="checkbox" data-lsel="${i}" ${SD.linerSel.has(i) ? "checked" : ""} aria-label="Selecionar liner ${i + 1}"></label>
          <div class="liner-tag"><b>L${pad2(i + 1)}</b><span class="${classePct(p)}" data-pct="${i}">${p == null ? "—" : p + "%"}</span></div>
          <input class="entrada num" type="number" step="0.01" inputmode="decimal" data-l="${i}" data-k="de" value="${esc(l.de)}" aria-label="De">
          <input class="entrada num" type="number" step="0.01" inputmode="decimal" data-l="${i}" data-k="ate" value="${esc(l.ate)}" aria-label="Até">
          <input class="entrada num" type="number" step="1" inputmode="decimal" enterkeyhint="next" data-l="${i}" data-k="recuperacao" value="${esc(l.recuperacao)}" placeholder="cm" aria-label="Recuperação em cm">
          <button type="button" class="bt bt-icone perigo" data-acao="liner-remover" data-l="${i}" aria-label="Remover liner">${ic("x")}</button>
          <div class="liner-obs"><input class="entrada" type="text" data-l="${i}" data-k="obs" value="${esc(l.obs)}" placeholder="Observação (opcional)"></div>
        </div>`;
        })
        .join("")}
    </div>`;
  renderLoteLiner();
}

function renderLoteLiner() {
  const n = SD.linerSel.size;
  $("#sd-liner-lote").innerHTML = n
    ? `<div class="barra-lote"><span class="txt">${n} ${n === 1 ? "selecionado" : "selecionados"}</span>
        <button type="button" class="bt bt-sec bt-peq" data-acao="liner-limpar-sel">Limpar</button>
        <button type="button" class="bt bt-perigo bt-peq" data-acao="liner-excluir">${ic("trash-2", "i-p")}Excluir</button></div>`
    : "";
}

async function gerarListaLiners() {
  const tamCm = num($("#liner-tamanho").value);
  const inicio = num($("#liner-inicio").value);
  const fim = num($("#liner-fim").value);
  if (isNaN(tamCm) || tamCm <= 0) {
    alerta("Informe o tamanho do liner em centímetros.");
    return;
  }
  if (isNaN(inicio) || isNaN(fim) || fim <= inicio) {
    alerta("Informe o início e o fim do trecho amostrado com liner.");
    return;
  }
  const passo = tamCm / 100;
  const qtd = Math.ceil((fim - inicio) / passo - 0.0001);
  if (qtd > 200) {
    alerta("Isso geraria " + qtd + " liners. Verifique os valores informados.");
    return;
  }
  const temDados = SD.liners.some((l) => l.recuperacao || l.obs);
  if (temDados && !(await confirmar("Gerar a lista substitui os liners já preenchidos.", { titulo: "Substituir os liners?", ok: "Substituir", perigo: true }))) {
    return;
  }
  SD.liners = [];
  for (let p = inicio; p < fim - 0.0001; p = Math.round((p + passo) * 1000) / 1000) {
    const ate = Math.min(Math.round((p + passo) * 1000) / 1000, fim);
    SD.liners.push({ de: p.toFixed(2), ate: ate.toFixed(2), recuperacao: "", tamanho: String(tamCm), obs: "" });
  }
  SD.linerSel.clear();
  renderLiners();
  autoSond.agendar();
  toast(qtd + " liners gerados");
}

function adicionarLiner() {
  const tamCm = $("#liner-tamanho").value.trim();
  const passo = num(tamCm) / 100;
  let de = num($("#liner-inicio").value);
  const ult = SD.liners[SD.liners.length - 1];
  if (ult && !isNaN(num(ult.ate))) de = num(ult.ate);
  if (isNaN(de)) de = 0;
  const ate = !isNaN(passo) && passo > 0 ? Math.round((de + passo) * 100) / 100 : NaN;
  SD.liners.push({ de: de.toFixed(2), ate: isNaN(ate) ? "" : ate.toFixed(2), recuperacao: "", tamanho: tamCm, obs: "" });
  renderLiners();
  autoSond.agendar();
  const linhas = $$("#sd-liners .te-linha");
  const alvo = linhas[linhas.length - 1] && linhas[linhas.length - 1].querySelector('[data-k="recuperacao"]');
  if (alvo) alvo.focus();
}

function excluirLinersSelecionados() {
  const n = SD.linerSel.size;
  if (!n) return;
  const antes = SD.liners.map((l) => Object.assign({}, l));
  SD.liners = SD.liners.filter((_, i) => !SD.linerSel.has(i));
  SD.linerSel.clear();
  renderLiners();
  autoSond.agendar();
  toast(n + (n === 1 ? " liner excluído" : " liners excluídos"), {
    acao: "Desfazer",
    icone: "trash-2",
    aoAgir: () => {
      SD.liners = antes;
      renderLiners();
      autoSond.agendar();
    },
  });
}

// ---------------------------------------------------------------- Fotos

// Reduz fotos de câmera (3–12 MB) para ~300–500 KB sem perda visível
function redimensionarImagem(file, maxDim = 1600, qualidade = 0.8) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      const escala = Math.min(1, maxDim / Math.max(w, h));
      w = Math.round(w * escala);
      h = Math.round(h * escala);
      const cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      cv.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      cv.toBlob((b) => resolve(b || file), "image/jpeg", qualidade);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

async function adicionarFotos(input) {
  const files = Array.from(input.files || []);
  input.value = "";
  if (!files.length) return;
  toast("Processando " + files.length + (files.length === 1 ? " foto…" : " fotos…"), { icone: "image" });
  for (const f of files) {
    const blob = await redimensionarImagem(f);
    const id = "f" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
    await Dados.fotoSalvar(id, blob);
    SD.fotos.push({ id, legenda: "", url: URL.createObjectURL(blob) });
    SD.fotosNovas.push(id);
  }
  renderFotos();
  autoSond.agendar();
}

function renderFotos() {
  $("#sd-n-fotos").textContent = SD.fotos.length;
  $("#sd-fotos").innerHTML = SD.fotos
    .map(
      (f, i) => `
    <div class="foto">
      <img src="${f.url}" alt="Foto ${i + 1}">
      <button type="button" class="foto-x" data-acao="foto-remover" data-f="${i}" aria-label="Remover foto">${ic("x")}</button>
      <input class="entrada" type="text" data-f="${i}" value="${esc(f.legenda)}" placeholder="Legenda (ex.: liner 1,0–2,0 m)">
    </div>`
    )
    .join("");
}

function removerFoto(i) {
  const f = SD.fotos[i];
  if (!f) return;
  SD.fotos.splice(i, 1);
  try {
    URL.revokeObjectURL(f.url);
  } catch (e) {}
  // Foto que só existia neste formulário sai do banco na hora;
  // foto de registro salvo só sai quando o boletim for salvo.
  const k = SD.fotosNovas.indexOf(f.id);
  if (k >= 0) {
    SD.fotosNovas.splice(k, 1);
    Dados.fotoRemover(f.id);
  }
  renderFotos();
  autoSond.agendar();
}

// ---------------------------------------------------------------- Poço

function alternarPoco() {
  const on = $("#sond-poco").checked;
  $("#campos-poco").classList.toggle("oculto", !on);
  if (on && !$("#poco-id").value) {
    const p = projetoPorId(Number($("#sond-projetoid").value)) || projetoDigitado("sond-projeto");
    if (p) $("#poco-id").value = proximoPM(p.id, editSondId);
    $("#poco-id").focus();
    try {
      $("#poco-id").select();
    } catch (e) {}
  }
  atualizarPerfilVivo();
  autoSond.agendar();
}

function alternarLiner() {
  const on = $("#sond-liner").checked;
  $("#campos-liner").classList.toggle("oculto", !on);
  if (on && !SD.liners.length) {
    const tam = $("#liner-tamanho");
    if (!tam.value) tam.value = "60";
    tam.focus();
  }
  autoSond.agendar();
}

// ---------------------------------------------------------------- Salvar

async function salvarSondagem() {
  const d = coletarSondagem();
  if (!d.projeto) {
    toast("Informe o número do projeto", { icone: "circle-alert" });
    $("#sond-projeto").focus();
    return;
  }
  if (!d.idSond) {
    toast("Informe a identificação da sondagem", { icone: "circle-alert" });
    $("#sond-id").focus();
    return;
  }
  const camadas = d.camadas
    .map((c) =>
      Object.assign({}, c, {
        profDe: String(c.profDe == null ? "" : c.profDe).trim() || null,
        profAte: String(c.profAte == null ? "" : c.profAte).trim() || null,
        descricao: (c.descricao || "").trim(),
        intervaloAmostra: (c.intervaloAmostra || "").trim(),
      })
    )
    .filter(camadaTemAlgo);
  const vocs = d.vocs
    .map((v) => ({ profundidade: String(v.profundidade || "").trim(), valor: String(v.valor || "").trim() }))
    .filter((v) => v.profundidade || v.valor);

  const avisos = avisosProfundidade(camadas, d.profFinal);
  if (avisos.length) {
    const ok = await confirmar("Confira as profundidades antes de salvar:", {
      titulo: "Atenção às profundidades",
      lista: avisos,
      ok: "Salvar mesmo assim",
      cancelar: "Revisar",
    });
    if (!ok) {
      document.getElementById("sd-sec-camadas").scrollIntoView({ behavior: "smooth" });
      return;
    }
  }

  let projetoId = d.projetoId;
  let vinculo = "";
  if (!projetoId) {
    const p = projetoPorNumero(d.projeto);
    if (p) {
      projetoId = p.id;
      vinculo = " na pasta " + p.numero;
    }
  }
  const repetida = Dados.lista("sondagem").find(
    (r) => r.id !== editSondId && r.idSond === d.idSond && ((projetoId && r.projetoId === projetoId) || (!projetoId && r.projeto === d.projeto))
  );
  if (repetida && !(await confirmar("Já existe um boletim " + d.idSond + " em " + d.projeto + ". Salvar outro com o mesmo nome?", {
    titulo: "Sondagem repetida", ok: "Salvar mesmo assim", cancelar: "Revisar",
  }))) {
    return;
  }

  const liner = d.liner
    ? {
        tamanho: d.liner.tamanho,
        inicio: d.liner.inicio,
        fim: d.liner.fim,
        amostras: d.liner.amostras
          .map((a, i) => ({
            n: i + 1,
            de: String(a.de || "").trim(),
            ate: String(a.ate || "").trim(),
            recuperacao: String(a.recuperacao || "").trim(),
            tamanho: a.tamanho || d.liner.tamanho || "",
            obs: String(a.obs || "").trim(),
          }))
          .filter((a) => a.de || a.ate || a.recuperacao || a.obs),
      }
    : null;

  const anterior = editSondId ? Dados.achar("sondagem", editSondId) : null;
  const reg = {
    id: editSondId || Dados.novoId("sondagem"),
    projetoId: projetoId || null,
    projeto: d.projeto,
    empresa: d.empresa,
    local: d.local,
    lat: d.lat,
    lon: d.lon,
    idSond: d.idSond,
    data: d.data,
    profFinal: d.profFinal,
    nivelAgua: d.nivelAgua,
    obs: d.obs,
    poco: d.poco,
    liner,
    camadas: ordenarCamadas(camadas),
    vocs,
    fotos: d.fotos.map((f) => ({ id: f.id, legenda: (f.legenda || "").trim() })),
  };
  if (anterior) reg.atualizadoEm = Date.now();
  // Fotos removidas durante a edição saem do banco
  if (anterior) {
    const novas = new Set(reg.fotos.map((f) => f.id));
    (anterior.fotos || []).filter((f) => !novas.has(f.id)).forEach((f) => Dados.fotoRemover(f.id));
  }
  Dados.salvar("sondagem", reg);
  Dados.pedirPersistencia();
  SD.fotosNovas = [];
  autoSond.descartar();
  autoSond.ativo = false;
  Nav.voltarOu("inicio");
  toast("Sondagem " + reg.idSond + " salva" + vinculo, { acao: "PDF", aoAgir: () => gerarPDFSondagem(reg.id) });
}

async function menuSondagem() {
  const salvo = editSondId ? Dados.achar("sondagem", editSondId) : null;
  const itens = [];
  if (salvo) itens.push({ rotulo: "Exportar perfil (PDF)", detalhe: "Versão salva deste boletim", valor: "pdf", icone: "file-down" });
  itens.push({
    rotulo: salvo ? "Descartar alterações" : "Limpar formulário",
    detalhe: salvo ? "Volta ao que está salvo" : "Começa em branco",
    valor: "limpar",
    icone: "eraser",
  });
  if (salvo) itens.push({ rotulo: "Excluir sondagem", detalhe: "Remove o boletim e as fotos", valor: "excluir", icone: "trash-2" });
  const op = await menuAcoes(($("#sond-id").value || "Sondagem").trim(), itens);
  if (op === "pdf") gerarPDFSondagem(salvo.id);
  else if (op === "limpar") {
    const novas = SD.fotosNovas.slice();
    autoSond.descartar();
    novas.forEach((id) => Dados.fotoRemover(id));
    const params = Nav.topo().params || {};
    await preencherSondagem(salvo ? Object.assign({ fotosNovas: [] }, clonar(salvo)) : sondagemEmBranco(params));
    $("#sd-rascunho").innerHTML = "";
    autoSond.rebasear();
    toast(salvo ? "Alterações descartadas" : "Formulário limpo");
  } else if (op === "excluir") {
    const novas = SD.fotosNovas.slice();
    autoSond.descartar();
    autoSond.ativo = false;
    novas.forEach((id) => Dados.fotoRemover(id));
    excluirSondagem(salvo.id);
    Nav.voltarOu("inicio");
  }
}

function excluirSondagem(id) {
  const reg = Dados.achar("sondagem", id);
  if (!reg) return;
  const fotos = (reg.fotos || []).map((f) => f.id);
  excluirComDesfazer("sondagem", id, "Sondagem " + (reg.idSond || "") + " excluída", {
    // As fotos só saem do banco quando não dá mais para desfazer
    aoExpirar: () => {
      if (!Dados.achar("sondagem", id)) fotos.forEach((fid) => Dados.fotoRemover(fid));
    },
  });
}

// ---------------------------------------------------------------- Navegação entre seções

function marcarSecaoAtual() {
  const secoes = ["sd-sec-ident", "sd-sec-poco", "sd-sec-camadas", "sd-sec-liner", "sd-sec-voc", "sd-sec-fotos"];
  let atual = secoes[0];
  const limite = 150;
  secoes.forEach((id) => {
    const el = document.getElementById(id);
    if (el && el.getBoundingClientRect().top <= limite) atual = id;
  });
  $$("#sd-nav .chip").forEach((c) => {
    const sel = c.dataset.alvo === atual;
    if (sel && c.getAttribute("aria-pressed") !== "true") {
      try {
        c.scrollIntoView({ block: "nearest", inline: "center" });
      } catch (e) {}
    }
    c.setAttribute("aria-pressed", String(sel));
  });
}

let rolagemPendente = false;
window.addEventListener(
  "scroll",
  () => {
    if (rolagemPendente || $("#tela-sondagem").hidden) return;
    rolagemPendente = true;
    requestAnimationFrame(() => {
      rolagemPendente = false;
      marcarSecaoAtual();
    });
  },
  { passive: true }
);

// ---------------------------------------------------------------- Eventos

Object.assign(ACOES, {
  "sd-ir": (el) => {
    const alvo = document.getElementById(el.dataset.alvo);
    if (alvo) alvo.scrollIntoView({ behavior: "smooth", block: "start" });
  },
  "sd-salvar": () => salvarSondagem(),
  "sd-menu": () => menuSondagem(),
  "sd-usar-prof": (el) => {
    $("#sond-prof-final").value = el.dataset.v;
    atualizarSugestaoProf();
    atualizarPerfilVivo();
    autoSond.agendar();
  },
  "sd-usar-ultima": () => {
    const lista = Dados.lista("sondagem").filter((r) => r.id !== editSondId);
    if (!lista.length) {
      toast("Nenhuma sondagem anterior para copiar", { icone: "info" });
      return;
    }
    const reg = lista[lista.length - 1];
    if (!$("#sond-projeto").value) {
      $("#sond-projeto").value = projetoParaCampo(reg.projeto || "");
      if (!$("#sond-projetoid").value && reg.projetoId) $("#sond-projetoid").value = reg.projetoId;
    }
    preencherSeVazio("sond-empresa", reg.empresa);
    preencherSeVazio("sond-local", reg.local);
    autoSond.agendar();
    Nav.atualizarBarra();
    toast("Dados de " + (reg.idSond || "sondagem anterior") + " aplicados");
  },
  "cam-alternar": (el) => {
    const i = +el.dataset.c;
    if (SD.abertas.has(i)) SD.abertas.delete(i);
    else SD.abertas.add(i);
    renderCamada(i);
    if (SD.abertas.has(i)) {
      const card = document.getElementById("sd-cam-" + i);
      if (card && card.getBoundingClientRect().top < 120) card.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  },
  "cam-ir": (el) => abrirCamada(+el.dataset.c),
  "cam-nova": () => adicionarCamada(),
  "cam-repetir": () => repetirUltimaCamada(),
  "cam-copiar": () => copiarDeOutraSondagem(),
  "cam-remover": (el) => removerCamada(+el.dataset.c),
  "cam-ordenar": () => ordenarCamadasForm(),
  "cam-wizard": (el) => abrirWizard(+el.dataset.c),
  "voc-nova": () => adicionarVOC(),
  "voc-serie": () => gerarSerieVOC(),
  "voc-zerar": () => zerarVOCsVazios(),
  "voc-todas": () => {
    const todas = SD.vocs.length && SD.vocSel.size === SD.vocs.length;
    SD.vocSel = todas ? new Set() : new Set(SD.vocs.map((_, i) => i));
    renderVOCs();
  },
  "voc-limpar-sel": () => {
    SD.vocSel.clear();
    renderVOCs();
  },
  "voc-excluir": () => excluirVOCsSelecionadas(),
  "voc-remover": (el) => {
    const i = +el.dataset.v;
    const antes = SD.vocs.map((v) => Object.assign({}, v));
    SD.vocs.splice(i, 1);
    SD.vocSel.clear();
    renderVOCs();
    autoSond.agendar();
    toast("Medição removida", {
      acao: "Desfazer",
      icone: "trash-2",
      aoAgir: () => {
        SD.vocs = antes;
        renderVOCs();
        autoSond.agendar();
      },
    });
  },
  "liner-gerar": () => gerarListaLiners(),
  "liner-novo": () => adicionarLiner(),
  "liner-remover": (el) => {
    const i = +el.dataset.l;
    const antes = SD.liners.map((l) => Object.assign({}, l));
    SD.liners.splice(i, 1);
    SD.linerSel.clear();
    renderLiners();
    autoSond.agendar();
    toast("Liner removido", {
      acao: "Desfazer",
      icone: "trash-2",
      aoAgir: () => {
        SD.liners = antes;
        renderLiners();
        autoSond.agendar();
      },
    });
  },
  "liner-limpar-sel": () => {
    SD.linerSel.clear();
    renderLiners();
  },
  "liner-excluir": () => excluirLinersSelecionados(),
  "foto-camera": () => $("#input-foto-camera").click(),
  "foto-galeria": () => $("#input-foto").click(),
  "foto-remover": (el) => removerFoto(+el.dataset.f),
});

function aoEditarSondagem(e) {
  const t = e.target;
  if (!t.closest || !t.closest("#form-sondagem")) return;
  // Campos das camadas
  if (t.dataset.c != null && (t.dataset.k || t.dataset.sel || t.dataset.outro)) {
    const i = +t.dataset.c;
    const c = SD.camadas[i];
    if (!c) return;
    if (t.dataset.k === "houveAmostra") {
      if (e.type !== "change") return;
      c.houveAmostra = t.checked;
      if (!t.checked) c.intervaloAmostra = "";
      SD.abertas.add(i);
      renderCamada(i);
      if (t.checked) {
        const box = $(`[data-intervalo="${i}"] input`);
        if (box) box.focus();
      }
    } else if (t.dataset.k) {
      c[t.dataset.k] = t.value;
    } else if (t.dataset.sel) {
      const campo = t.dataset.sel;
      const outro = $(`[data-c="${i}"][data-outro="${campo}"]`);
      if (t.value === "__outro__") {
        outro.classList.remove("oculto");
        if (e.type === "change") outro.focus();
        c[campo] = outro.value.trim();
      } else {
        outro.classList.add("oculto");
        outro.value = "";
        c[campo] = t.value;
      }
    } else if (t.dataset.outro) {
      c[t.dataset.outro] = t.value.trim();
    }
    atualizarCabecalhoCamada(i);
    atualizarPerfilVivoDep();
    atualizarSugestaoProf();
    autoSond.agendar();
    return;
  }
  // VOC
  if (t.dataset.vsel != null) {
    const i = +t.dataset.vsel;
    if (t.checked) SD.vocSel.add(i);
    else SD.vocSel.delete(i);
    renderLoteVOC();
    return;
  }
  if (t.dataset.v != null && t.dataset.k) {
    const v = SD.vocs[+t.dataset.v];
    if (!v) return;
    v[t.dataset.k] = t.value;
    const linha = t.closest(".te-linha");
    if (linha) linha.classList.toggle("voc-sem-valor", !!v.profundidade && !v.valor);
    $("#sd-n-voc").textContent = SD.vocs.filter((x) => x.profundidade || x.valor).length;
    autoSond.agendar();
    return;
  }
  // Liners
  if (t.dataset.lsel != null) {
    const i = +t.dataset.lsel;
    if (t.checked) SD.linerSel.add(i);
    else SD.linerSel.delete(i);
    renderLoteLiner();
    return;
  }
  if (t.dataset.l != null && t.dataset.k) {
    const i = +t.dataset.l;
    const l = SD.liners[i];
    if (!l) return;
    l[t.dataset.k] = t.value;
    if (t.dataset.k === "recuperacao") {
      const p = pctLiner(l);
      const el = $(`[data-pct="${i}"]`);
      if (el) {
        el.textContent = p == null ? "—" : p + "%";
        el.className = classePct(p);
      }
    }
    autoSond.agendar();
    return;
  }
  // Legendas das fotos
  if (t.dataset.f != null && t.tagName === "INPUT") {
    const f = SD.fotos[+t.dataset.f];
    if (f) f.legenda = t.value;
    autoSond.agendar();
    return;
  }
  // Campos gerais
  if (t.id === "sond-poco") {
    if (e.type === "change") alternarPoco();
    return;
  }
  if (t.id === "sond-liner") {
    if (e.type === "change") alternarLiner();
    return;
  }
  if (t.id === "liner-tamanho") {
    // O tamanho vale para os liners sem tamanho próprio
    SD.liners.forEach((l) => {
      if (!l.tamanho || l.tamanho === t.dataset.ant) l.tamanho = t.value;
    });
    t.dataset.ant = t.value;
    renderLiners();
  }
  if (["sond-prof-final", "sond-nivel-agua"].includes(t.id) || (t.id && t.id.startsWith("poco-"))) {
    atualizarPerfilVivoDep();
    atualizarSugestaoProf();
  }
  if (t.id === "sond-id" || t.id === "sond-projeto") Nav.atualizarBarra();
  autoSond.agendar();
}

document.addEventListener("input", aoEditarSondagem);
document.addEventListener("change", (e) => {
  if (e.target.id === "input-foto" || e.target.id === "input-foto-camera") {
    adicionarFotos(e.target).catch(mostrarErro);
    return;
  }
  aoEditarSondagem(e);
});

// Enter no valor de VOC (ou na recuperação do liner) vai para a próxima linha
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const t = e.target;
  if (t.classList && t.classList.contains("voc-valor")) {
    e.preventDefault();
    const todos = $$("#sd-vocs .voc-valor");
    const prox = todos[todos.indexOf(t) + 1];
    if (prox) prox.focus();
    else t.blur();
  } else if (t.dataset && t.dataset.k === "recuperacao" && t.dataset.l != null) {
    e.preventDefault();
    const todos = $$('#sd-liners [data-k="recuperacao"]');
    const prox = todos[todos.indexOf(t) + 1];
    if (prox) prox.focus();
    else t.blur();
  }
});

// Ao sair do campo Projeto: completa empresa e local pelo cadastro
document.addEventListener("focusout", (e) => {
  if (e.target && e.target.id === "sond-projeto") {
    const p = projetoDigitado("sond-projeto");
    if (p) {
      if (!$("#sond-projetoid").value) $("#sond-projetoid").value = p.id;
      preencherSeVazio("sond-empresa", p.empresa);
      preencherSeVazio("sond-local", p.local);
      autoSond.agendar();
    }
  }
});
