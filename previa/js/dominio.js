/* =========================================================================
   Domínio: listas de opções, projetos, sondagens, ensaio de permeabilidade,
   coordenadas, resumos e exportação CSV. Sem acesso direto à interface.
   ========================================================================= */
"use strict";

const OPCOES_GENESE = [
  "Pavimento", "Aterro", "Alúvio", "Colúvio", "Elúvio", "Talus", "Concreções",
  "Crosta laterítica", "Limonita", "SAR: Solo de alteração de rocha",
  "Rocha alterada", "Rocha fresca", "Resíduo industrial", "Resíduo doméstico",
  "Resíduo hospitalar", "Resíduo de construção civil", "Resíduos diversos",
  "Resíduo sanitário",
];

const OPCOES_MATERIAL = [
  "Asfalto", "Bloquete", "Cimento", "Concreto", "Paralelepípedo",
  "Argila", "Argila arenosa", "Argila areno siltosa", "Argila orgânica",
  "Argila silto arenosa", "Argila siltosa", "Silte", "Silte arenoso",
  "Silte areno argiloso", "Silte argilo arenoso", "Silte argiloso",
  "Areia", "Areia argilosa", "Areia argilo siltosa", "Areia silto argilosa",
  "Areia siltosa", "Cascalho", "Cascalho argiloso", "Cascalho arenoso",
  "Cascalho siltoso", "Conglomerado (clasto)", "Conglomerado (matriz)",
  "Argilito", "Siltito", "Arenito", "Basalto", "Diabásio", "Gabro",
  "Granito", "Gnaisse", "Xisto", "Turfa", "Areia de fundição",
  "Borra oleosa", "Brita", "Cerâmica", "Entulho",
];

const OPCOES_GRANULOMETRIA = [
  "Muito fina", "Fina", "Fina média", "Média", "Média grossa",
  "Grossa", "Muito grossa", "Cascalho", "Seixo", "Matacão",
  "Afanítica", "Fanerítica", "Porfirítica",
];

const OPCOES_CARACTERISTICAS = [
  "Angular", "Arredondado", "Bem arredondado", "Muito angular",
  "Sub arredondado", "Sub angular", "Bandada", "Xistosa",
  "Foliada", "Compacta",
];

const OPCOES_GRAU_SELECAO = [
  "Bem selecionados", "Mal selecionados",
  "Muito bem selecionados", "Muito mal selecionados",
];

const OPCOES_OBS_EXTRAS = [
  "Friável", "Plástico", "Pastilhado", "Impenetrável",
  "Sem recuperação", "Pastoso", "Líquido", "Sólido", "Inflamável",
];

const OPCOES_COR = [
  "Branca", "Cinza clara", "Cinza escura", "Amarela", "Amarelo-avermelhada",
  "Vermelha", "Avermelhada", "Marrom clara", "Marrom", "Marrom escura",
  "Preta", "Esverdeada", "Azulada",
];

// Cores aproximadas para a paleta visual e para o perfil gráfico
const COR_HEX = {
  "Branca": "#e9e7e1",
  "Cinza clara": "#b9b9b5",
  "Cinza escura": "#6b6b68",
  "Amarela": "#d4b14a",
  "Amarelo-avermelhada": "#c98a3d",
  "Vermelha": "#a13d2d",
  "Avermelhada": "#b65c43",
  "Marrom clara": "#b08968",
  "Marrom": "#8a6342",
  "Marrom escura": "#5e4426",
  "Preta": "#2b2722",
  "Esverdeada": "#7a8a6a",
  "Azulada": "#6e7f8d",
};
const COR_SEM_DADO = "#d8d4cc";

// Campos de seleção da camada (com opção "Outro")
const CAMPOS_CAMADA = [
  { campo: "cor", rotulo: "Cor", opcoes: OPCOES_COR },
  { campo: "genese", rotulo: "Gênese / tipo rochoso", opcoes: OPCOES_GENESE },
  { campo: "material", rotulo: "Material", opcoes: OPCOES_MATERIAL },
  { campo: "textura", rotulo: "Granulometria / textura", opcoes: OPCOES_GRANULOMETRIA },
  { campo: "caracteristicas", rotulo: "Características (arredondamento / estrutura)", opcoes: OPCOES_CARACTERISTICAS },
  { campo: "grauSelecao", rotulo: "Grau de seleção / fraturas", opcoes: OPCOES_GRAU_SELECAO },
  { campo: "obsExtras", rotulo: "Outras observações", opcoes: OPCOES_OBS_EXTRAS },
];

// Lançador de eventos do diário ("07h00: Chegada ao site")
const EVENTOS_PADRAO = [
  { t: "Chegada ao site" },
  { t: "Integração / DDS" },
  { t: "Início dos trabalhos" },
  { t: "Parada para almoço" },
  { t: "Retorno do almoço" },
  { t: "Início da sondagem", id: true },
  { t: "Fim da sondagem", id: true },
  { t: "Instalação do poço", id: true },
  { t: "Coleta de amostras", id: true },
  { t: "Saída do site" },
];

function eventosDiario() {
  return Array.isArray(Dados.config.eventos) && Dados.config.eventos.length
    ? Dados.config.eventos
    : EVENTOS_PADRAO;
}

// ---------------------------------------------------------------- Cores

function hexParaRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbParaHex(rgb) {
  return "#" + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}
function misturar(a, b, t) {
  const x = hexParaRgb(a);
  const y = hexParaRgb(b);
  return rgbParaHex(x.map((v, i) => v + (y[i] - v) * t));
}

// Cor do perfil a partir do nome — inclusive cores digitadas em "Outro"
// (ex.: "Marrom avermelhado", "Cinza amarelada").
function corParaHex(nome) {
  if (!nome) return null;
  if (COR_HEX[nome]) return COR_HEX[nome];
  const n = semAcento(nome);
  const bases = [
    ["pret", "#2b2722"], ["negr", "#2b2722"], ["branc", "#e9e7e1"], ["cinz", "#9a9a96"],
    ["marrom", "#8a6342"], ["castanh", "#7d5a3c"], ["vermelh", "#a13d2d"], ["amarel", "#d4b14a"],
    ["ocre", "#c69a3b"], ["bege", "#cbb894"], ["verde", "#7a8a6a"], ["esverdead", "#7a8a6a"],
    ["azul", "#6e7f8d"], ["roxo", "#6d4c64"], ["rox", "#6d4c64"], ["violet", "#6d4c64"],
    ["laranj", "#c87533"], ["rosad", "#c08a83"], ["rosa", "#c08a83"], ["variegad", "#a88a6a"],
    ["mosquead", "#a88a6a"], ["avermelhad", "#b65c43"],
  ];
  let base = null;
  let pos = Infinity;
  bases.forEach(([k, cor]) => {
    const p = n.indexOf(k);
    if (p >= 0 && p < pos) {
      pos = p;
      base = cor;
    }
  });
  if (!base) return null;
  const tons = [
    ["avermelhad", "#a13d2d"], ["amarelad", "#d4b14a"], ["acinzentad", "#9a9a96"],
    ["esverdead", "#7a8a6a"], ["azulad", "#6e7f8d"], ["amarronzad", "#8a6342"],
    ["arroxead", "#6d4c64"], ["alaranjad", "#c87533"],
  ];
  tons.forEach(([k, cor]) => {
    const p = n.indexOf(k);
    if (p > pos) base = misturar(base, cor, 0.35);
  });
  if (/clar/.test(n)) base = misturar(base, "#ffffff", 0.32);
  if (/escur/.test(n)) base = misturar(base, "#000000", 0.32);
  return base;
}

// ---------------------------------------------------------------- Projetos

// Projetos seguem o padrão "P" + número; o P fica fixo na interface.
function projetoDeCampo(raw) {
  raw = String(raw || "").trim();
  if (!raw) return "";
  return /^\d/.test(raw) ? "P" + raw : raw; // formatos antigos passam intactos
}
function projetoParaCampo(valor) {
  if (!valor) return "";
  return /^P\d/i.test(valor) ? valor.replace(/^P/i, "") : valor;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}
function nomeST(i) {
  return "ST-" + pad2(i);
}
function nomeEP(i) {
  return "EP-" + pad2(i);
}

function projetoPorId(id) {
  return Dados.lista("projetos").find((p) => p.id === id) || null;
}

function ordemNatural(a, b) {
  return String(a || "").localeCompare(String(b || ""), "pt", { numeric: true });
}

// Nomes da grade: os previstos (a partir da numeração inicial) mais
// qualquer registro já salvo no projeto com outro nome (ex.: renomeado).
function nomesGrade(prefixo, inicio, qtd, salvos) {
  const nomes = [];
  for (let i = 0; i < (qtd || 0); i++) nomes.push(prefixo + "-" + pad2((inicio || 1) + i));
  salvos.forEach((n) => {
    if (n && !nomes.includes(n)) nomes.push(n);
  });
  return nomes.sort(ordemNatural);
}

function sondagensDoProjeto(pid) {
  return Dados.lista("sondagem").filter((r) => r.projetoId === pid);
}
function ensaiosDoProjeto(pid) {
  return Dados.lista("ensaios").filter((r) => r.projetoId === pid);
}
function diariosDoProjeto(pid) {
  return Dados.lista("diario").filter((r) => r.projetoId === pid);
}
function nomesSTProjeto(p) {
  return nomesGrade("ST", p.iniST, p.qtdSond, sondagensDoProjeto(p.id).map((r) => r.idSond));
}
function nomesEPProjeto(p) {
  return nomesGrade("EP", p.iniEP, p.qtdEns, ensaiosDoProjeto(p.id).map((r) => r.idEnsaio));
}

// Próximo PM livre do projeto, respeitando a numeração inicial
function proximoPM(pid, ignorarId) {
  const proj = projetoPorId(pid);
  const usados = new Set(
    sondagensDoProjeto(pid)
      .filter((r) => r.poco && r.id !== ignorarId)
      .map((r) => r.poco.id)
  );
  let n = (proj && proj.iniPM) || 1;
  while (usados.has("PM-" + pad2(n))) n++;
  return "PM-" + pad2(n);
}

// Projeto com o mesmo número (para vincular registros digitados à mão)
function projetoPorNumero(numero) {
  if (!numero) return null;
  const alvo = String(numero).trim().toUpperCase();
  const achados = Dados.lista("projetos").filter((p) => String(p.numero || "").trim().toUpperCase() === alvo);
  return achados.length === 1 ? achados[0] : null;
}

// Registros com o número do projeto mas sem vínculo (feitos fora da pasta)
function soltosDoProjeto(p) {
  const ids = new Set(Dados.lista("projetos").map((x) => x.id));
  const alvo = String(p.numero || "").trim().toUpperCase();
  const solto = (r) => (!r.projetoId || !ids.has(r.projetoId)) && String(r.projeto || "").trim().toUpperCase() === alvo;
  return {
    sondagem: Dados.lista("sondagem").filter(solto),
    diario: Dados.lista("diario").filter(solto),
    ensaios: Dados.lista("ensaios").filter(solto),
  };
}

// "ST-05, ST-06, ST-07, ST-08" → "ST-05 a ST-08"
function compactarNomes(nomes) {
  const lista = nomes.filter(Boolean).slice().sort(ordemNatural);
  const out = [];
  let i = 0;
  while (i < lista.length) {
    const m = /^(.*?)(\d+)$/.exec(lista[i]);
    if (!m) {
      out.push(lista[i]);
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < lista.length) {
      const m2 = /^(.*?)(\d+)$/.exec(lista[j + 1]);
      const mj = /^(.*?)(\d+)$/.exec(lista[j]);
      if (m2 && mj && m2[1] === m[1] && +m2[2] === +mj[2] + 1) j++;
      else break;
    }
    if (j - i >= 2) out.push(lista[i] + " a " + lista[j]);
    else for (let k = i; k <= j; k++) out.push(lista[k]);
    i = j + 1;
  }
  return out.join(", ");
}

// ---------------------------------------------------------------- Coordenadas

function fmt0(v) {
  return Math.round(v).toLocaleString("pt-BR");
}

// Conversão geodésica → UTM no elipsoide GRS80 (SIRGAS 2000).
// Precisão métrica, suficiente para posicionamento por GPS de celular.
function latLonParaUTM(lat, lon) {
  const a = 6378137.0;
  const f = 1 / 298.257222101; // GRS80
  const k0 = 0.9996;
  const zone = Math.floor((lon + 180) / 6) + 1;
  const lon0 = (zone - 1) * 6 - 180 + 3;
  const e2 = f * (2 - f);
  const ep2 = e2 / (1 - e2);
  const rl = (lat * Math.PI) / 180;
  const dl = ((lon - lon0) * Math.PI) / 180;
  const sinl = Math.sin(rl);
  const cosl = Math.cos(rl);
  const N = a / Math.sqrt(1 - e2 * sinl * sinl);
  const T = Math.tan(rl) * Math.tan(rl);
  const C = ep2 * cosl * cosl;
  const A = cosl * dl;
  const M =
    a *
    ((1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 * e2 * e2) / 256) * rl -
      ((3 * e2) / 8 + (3 * e2 * e2) / 32 + (45 * e2 * e2 * e2) / 1024) * Math.sin(2 * rl) +
      ((15 * e2 * e2) / 256 + (45 * e2 * e2 * e2) / 1024) * Math.sin(4 * rl) -
      ((35 * e2 * e2 * e2) / 3072) * Math.sin(6 * rl));
  const E =
    k0 * N * (A + ((1 - T + C) * A * A * A) / 6 +
      ((5 - 18 * T + T * T + 72 * C - 58 * ep2) * A * A * A * A * A) / 120) +
    500000;
  let Nn =
    k0 *
    (M +
      N * Math.tan(rl) *
        ((A * A) / 2 +
          ((5 - T + 9 * C + 4 * C * C) * A * A * A * A) / 24 +
          ((61 - 58 * T + T * T + 600 * C - 330 * ep2) * A * A * A * A * A * A) / 720));
  if (lat < 0) Nn += 10000000;
  return { zone, hemi: lat < 0 ? "S" : "N", e: E, n: Nn };
}

function utmTexto(lat, lon) {
  const u = latLonParaUTM(lat, lon);
  return "UTM " + u.zone + u.hemi + " · E " + fmt0(u.e) + " m · N " + fmt0(u.n) + " m";
}

async function enderecoPorCoordenadas(lat, lon) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 7000);
  try {
    const resp = await fetch(
      "https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=pt-BR&lat=" + lat + "&lon=" + lon,
      { signal: ctrl.signal }
    );
    if (!resp.ok) return "";
    const j = await resp.json();
    const ad = j.address || {};
    const partes = [];
    const rua = ad.road || ad.pedestrian || ad.footway || "";
    if (rua) partes.push(rua + (ad.house_number ? ", " + ad.house_number : ""));
    const bairro = ad.suburb || ad.neighbourhood || ad.quarter || "";
    if (bairro) partes.push(bairro);
    const cidade = ad.city || ad.town || ad.village || ad.municipality || "";
    const uf = (ad["ISO3166-2-lvl4"] || "").replace("BR-", "");
    if (cidade) partes.push(cidade + (uf ? "/" + uf : ""));
    return partes.join(" – ");
  } finally {
    clearTimeout(t);
  }
}

// ---------------------------------------------------------------- Sondagem

function camadaVazia() {
  return {
    profDe: null, profAte: null, cor: "", descricao: "", genese: "", material: "",
    textura: "", caracteristicas: "", grauSelecao: "", obsExtras: "",
    houveAmostra: false, intervaloAmostra: "",
  };
}

function camadaTemAlgo(c) {
  return !!(
    c.profDe || c.profAte || c.cor || c.descricao || c.genese || c.material || c.textura ||
    c.caracteristicas || c.grauSelecao || c.obsExtras || c.houveAmostra || c.intervaloAmostra
  );
}

function montarDescricaoCamada(c) {
  if (c.descricao) {
    let d = c.descricao;
    if (c.genese && d.toLowerCase().indexOf(c.genese.toLowerCase()) < 0) d += " (" + c.genese + ")";
    return d;
  }
  const p = [];
  if (c.material) p.push(c.material + (c.textura ? " " + c.textura.toLowerCase() : ""));
  if (c.cor) p.push(c.cor.toLowerCase());
  if (c.caracteristicas) p.push(c.caracteristicas.toLowerCase());
  if (c.grauSelecao) p.push(c.grauSelecao.toLowerCase());
  if (c.obsExtras) p.push(c.obsExtras.toLowerCase());
  let d = p.join(", ");
  if (c.genese) d += (d ? " " : "") + "(" + c.genese + ")";
  return d || "—";
}

// Ordena por profundidade de início; camadas sem profundidade ficam no fim
function ordenarCamadas(camadas) {
  return camadas
    .map((c, i) => ({ c, i }))
    .sort((a, b) => {
      const da = num(a.c.profDe);
      const db = num(b.c.profDe);
      if (isNaN(da) && isNaN(db)) return a.i - b.i;
      if (isNaN(da)) return 1;
      if (isNaN(db)) return -1;
      return da - db || a.i - b.i;
    })
    .map((x) => x.c);
}

// Verificação de consistência das profundidades (mesmas regras do app anterior)
function avisosProfundidade(camadas, profFinal) {
  const avisos = [];
  const comProf = camadas
    .map((c, i) => ({ i: i + 1, de: num(c.profDe), ate: num(c.profAte) }))
    .filter((c) => !isNaN(c.de) && !isNaN(c.ate));
  comProf.forEach((c) => {
    if (c.ate <= c.de) {
      avisos.push("Camada " + c.i + ": 'até' (" + fmtDec(c.ate) + " m) não é maior que 'de' (" + fmtDec(c.de) + " m).");
    }
  });
  const ord = comProf.slice().sort((a, b) => a.de - b.de);
  for (let i = 1; i < ord.length; i++) {
    const ant = ord[i - 1];
    const cur = ord[i];
    if (cur.de - ant.ate > 0.001) {
      avisos.push("Vazio sem descrição entre " + fmtDec(ant.ate) + " m e " + fmtDec(cur.de) + " m.");
    } else if (ant.ate - cur.de > 0.001) {
      avisos.push("Sobreposição entre as camadas " + ant.i + " e " + cur.i + " (" + fmtDec(cur.de) + "–" + fmtDec(ant.ate) + " m).");
    }
  }
  const pf = num(profFinal);
  if (!isNaN(pf) && ord.length && ord[ord.length - 1].ate - pf > 0.001) {
    avisos.push(
      "Prof. final (" + fmtDec(pf) + " m) é menor que o fim da última camada (" + fmtDec(ord[ord.length - 1].ate) + " m)."
    );
  }
  return avisos;
}

// Maior profundidade relevante do furo (camadas, prof. final e poço)
function profundidadeMaxima(reg) {
  let pmax = num(reg.profFinal);
  if (isNaN(pmax)) pmax = 0;
  (reg.camadas || []).forEach((c) => {
    const a = num(c.profAte);
    if (!isNaN(a)) pmax = Math.max(pmax, a);
  });
  if (reg.poco) {
    const pp = num(reg.poco.prof);
    if (!isNaN(pp)) pmax = Math.max(pmax, pp);
  }
  return pmax;
}

// Faixas para as colunas em miniatura (núcleos, listas)
function faixasColuna(reg) {
  const pmax = profundidadeMaxima(reg) || 1;
  const out = [];
  ordenarCamadas(reg.camadas || []).forEach((c) => {
    const de = num(c.profDe);
    const ate = num(c.profAte);
    if (isNaN(de) || isNaN(ate) || ate <= de) return;
    out.push({ top: (de / pmax) * 100, alt: ((ate - de) / pmax) * 100, cor: corParaHex(c.cor) || COR_SEM_DADO });
  });
  const na = num(reg.nivelAgua);
  return { faixas: out, na: !isNaN(na) && na <= pmax ? (na / pmax) * 100 : null };
}

function colunaMiniHTML(reg, classe = "coluna") {
  const { faixas, na } = faixasColuna(reg);
  return (
    `<span class="${classe}" aria-hidden="true">` +
    faixas.map((f) => `<i style="top:${f.top.toFixed(2)}%;height:${f.alt.toFixed(2)}%;background:${f.cor}"></i>`).join("") +
    (na != null ? `<i class="na" style="top:${na.toFixed(2)}%"></i>` : "") +
    `</span>`
  );
}

// ---------------------------------------------------------------- Diário

// Horário de trabalho automático: primeira e última hora lançadas
function horarioDasAtividades(texto) {
  const matches = [...String(texto || "").matchAll(/\b(\d{1,2})h([0-5]\d)\b/g)];
  if (matches.length < 2) return "";
  const f = matches[0];
  const l = matches[matches.length - 1];
  return f[1].padStart(2, "0") + ":" + f[2] + " - " + l[1].padStart(2, "0") + ":" + l[2];
}

// ---------------------------------------------------------------- Ensaio de permeabilidade
// Ensaio em furo de sondagem, nível variável (rebaixamento):
//   K = (Δh / Δt) × 1 / [ i · (2h / r + 1) ]
// Δh = rebaixamento total (cm), Δt = tempo total (s), h = trecho ensaiado
// (cm), r = raio do furo (cm), i = constante geométrica do cilindro (5).

const ENS_I = 5;

function rotuloTempo(s) {
  if (s === 0) return "Inicial";
  if (s < 60) return s + '"';
  if (s % 60 === 0) return s / 60 + "'";
  return Math.floor(s / 60) + "'" + (s % 60) + '"';
}

// 1.714e-5 -> "1,71 × 10⁻⁵"
function fmtCientifico(v) {
  if (!isFinite(v) || v <= 0) return "—";
  let exp = Math.floor(Math.log10(v));
  let mant = v / Math.pow(10, exp);
  if (Number(mant.toFixed(2)) >= 10) {
    mant /= 10;
    exp += 1;
  }
  const sup = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
  const e = String(exp).split("").map((c) => sup[c]).join("");
  return mant.toFixed(2).replace(".", ",") + " × 10" + e;
}

// Mello e Teixeira (1967)
function classificarK(K) {
  if (!isFinite(K) || K <= 0) return "—";
  if (K >= 1) return "Pedregulhos";
  if (K >= 1e-3) return "Areias";
  if (K >= 1e-7) return "Areias finas siltosas e argilosas, siltes argilosos";
  return "Argilas";
}

function temposDoPlano(plano, persInt, persTot) {
  if (plano === "dez") return [0, 600, 1200, 1800];
  if (plano === "pers") {
    const int = num(persInt);
    const tot = num(persTot);
    if (!(int > 0) || !(tot > 0)) return [0];
    const out = [0];
    for (let t = int * 60; t <= tot * 60 + 0.001; t += int * 60) out.push(Math.round(t));
    return out.slice(0, 241);
  }
  const out = [0, 30];
  for (let m = 1; m <= 20; m++) out.push(m * 60);
  return out;
}

function horaMaisSegundos(hhmm, s) {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(hhmm || "");
  if (!m) return "—";
  const tot = (Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3] || 0) + s) % 86400;
  return (
    pad2(Math.floor(tot / 3600)) + ":" + pad2(Math.floor((tot % 3600) / 60)) +
    (tot % 60 ? ":" + pad2(tot % 60) : "")
  );
}

// Cálculo do ensaio a partir do registro (mesma função para tela, PDF e CSV)
function calcularEnsaio(reg) {
  const v = num(reg.diametro);
  const D = reg.diamUnid === "cm" ? v : v * 2.54;
  const r = D / 2;
  const trechoM = !isNaN(num(reg.trecho)) ? num(reg.trecho) : num(reg.profundidade);
  const h = trechoM * 100;
  const leit = (reg.leituras || [])
    .filter((l) => l.dh !== "" && l.dh !== null && l.dh !== undefined && !isNaN(num(l.dh)))
    .map((l) => ({ t: Number(l.t), dh: num(l.dh) }))
    .sort((a, b) => a.t - b.t);
  const ini = leit.find((l) => l.t === 0);
  const base = ini ? ini.dh : 0;
  const finais = leit.filter((l) => l.t > 0);
  const ult = finais[finais.length - 1];
  const area = Math.PI * r * r; // cm²
  const res = { D, r, h, trechoM, leit, base, area, ok: false, aviso: "" };
  if (!(r > 0)) { res.aviso = "Informe o diâmetro do furo."; return res; }
  if (!(h > 0)) { res.aviso = "Informe a profundidade do furo (ou o trecho ensaiado)."; return res; }
  if (!ult) { res.aviso = "Anote ao menos uma leitura após o tempo inicial."; return res; }
  res.dh = ult.dh - base;
  res.dt = ult.t;
  if (!(res.dh > 0)) { res.aviso = "Não houve rebaixamento registrado (Δh = 0)."; return res; }
  res.K = res.dh / res.dt / (ENS_I * ((2 * h) / r + 1));
  res.volume = (area * res.dh) / 1000; // litros
  res.vazao = res.volume / (res.dt / 60); // L/min
  res.classe = classificarK(res.K);
  res.ok = true;
  return res;
}

function rotuloDiametro(reg) {
  if (!reg.diametro) return "—";
  return fmtNumBR(num(reg.diametro), 2) + (reg.diamUnid === "cm" ? " cm" : '"');
}

// ---------------------------------------------------------------- Resumo de campo

function resumoProjeto(p) {
  const sond = sondagensDoProjeto(p.id).slice().sort((a, b) => ordemNatural(a.idSond, b.idSond));
  const ens = ensaiosDoProjeto(p.id);
  const dia = diariosDoProjeto(p.id);
  const pocos = sond.filter((r) => r.poco);
  const faixa = (vals, sufixo) => {
    const v = vals.filter((x) => !isNaN(x));
    if (!v.length) return "—";
    const mi = Math.min(...v);
    const ma = Math.max(...v);
    return mi === ma ? fmtDec(mi, 2) + sufixo : fmtDec(mi, 2) + " a " + fmtDec(ma, 2) + sufixo;
  };
  let vocMax = null;
  sond.forEach((r) =>
    (r.vocs || []).forEach((v) => {
      const x = num(v.valor);
      if (!isNaN(x) && (!vocMax || x > vocMax.v)) vocMax = { v: x, st: r.idSond, prof: v.profundidade };
    })
  );
  const amostras = sond.reduce((acc, r) => acc + (r.camadas || []).filter((c) => c.houveAmostra).length, 0);
  const liners = sond.reduce((acc, r) => acc + ((r.liner && r.liner.amostras) || []).length, 0);
  const datas = [...sond, ...ens, ...dia].map((r) => r.data).filter(Boolean).sort();
  const periodo = datas.length
    ? datas[0] === datas[datas.length - 1]
      ? dataBR(datas[0])
      : dataBR(datas[0]) + " a " + dataBR(datas[datas.length - 1])
    : "—";
  const ks = ens.map((r) => calcularEnsaio(r)).filter((c) => c.ok).map((c) => c.K);
  const linhas = [
    ["Sondagens", sond.length + " de " + (p.qtdSond || 0) + (sond.length ? " (" + compactarNomes(sond.map((r) => r.idSond)) + ")" : "")],
    ["Poços instalados", pocos.length + " de " + (p.qtdPocos || 0) + (pocos.length ? " (" + compactarNomes(pocos.map((r) => r.poco.id)) + ")" : "")],
    ["Profundidade final", faixa(sond.map((r) => num(r.profFinal)), " m")],
    ["Nível d'água", sond.some((r) => !isNaN(num(r.nivelAgua))) ? faixa(sond.map((r) => num(r.nivelAgua)), " m") : sond.length ? "não atingido (furos secos)" : "—"],
    ["VOC (PID)", vocMax ? "máx. " + fmtDec(vocMax.v) + " ppm" + (vocMax.v > 0 ? " (" + vocMax.st + ", " + fmtDec(vocMax.prof) + " m)" : "") : "sem medições"],
    ["Amostras", amostras ? amostras + (amostras === 1 ? " camada amostrada" : " camadas amostradas") : "nenhuma registrada"],
  ];
  if (liners) linhas.push(["Liners", String(liners)]);
  if (p.qtdEns || ens.length) {
    linhas.push([
      "Ensaios",
      ens.length + " de " + (p.qtdEns || ens.length) +
        (ks.length ? " (K " + (ks.length > 1 ? fmtCientifico(Math.min(...ks)) + " a " + fmtCientifico(Math.max(...ks)) : fmtCientifico(ks[0])) + " cm/s)" : ""),
    ]);
  }
  linhas.push(["Diários", String(dia.length)]);
  linhas.push(["Período", periodo]);
  const titulo = (p.numero || "") + (p.cliente ? " – " + p.cliente : "");
  const texto =
    titulo + "\nResumo de campo · " + dataBR(hojeISO()) + "\n\n" + linhas.map(([a, b]) => a + ": " + b).join("\n");
  return { linhas, texto };
}

// ---------------------------------------------------------------- Nomes de arquivo

function nomeArquivoSondagem(reg) {
  const partes = [sanitizarNome(reg.projeto) || "Sondagem", sanitizarNome(reg.idSond) || "ST"];
  if (reg.data) partes.push(reg.data);
  return partes.join("_");
}
function nomeArquivoDiario(reg) {
  const partes = ["Diario", sanitizarNome(reg.projeto) || "Projeto"];
  if (reg.data) partes.push(reg.data);
  return partes.join("_");
}
function nomeArquivoEnsaio(reg) {
  const partes = [sanitizarNome(reg.projeto) || "Ensaio", sanitizarNome(reg.idEnsaio) || "EP"];
  if (reg.data) partes.push(reg.data);
  return partes.join("_");
}

// ---------------------------------------------------------------- CSV

function celulaCSV(v) {
  v = String(v == null ? "" : v).replace(/"/g, '""');
  return /[;\n"]/.test(v) ? `"${v}"` : v;
}

function csvDiario(lista) {
  const cab = ["projeto", "cliente", "local", "data", "horario", "clima", "atividades", "observacoes", "responsavel", "auxiliares"];
  return "﻿" + [cab.join(";")].concat(lista.map((r) => cab.map((c) => celulaCSV(r[c] || "")).join(";"))).join("\n");
}

function csvSondagem(lista) {
  const cab = [
    "projeto", "empresa", "local", "lat", "lon", "idSond", "data", "profFinal", "nivelAgua", "pocoId", "filtro",
    "preFiltro", "naInstalacao", "naEstabilizado", "liners", "obs", "camadas", "vocs",
  ];
  const linhas = lista.map((reg) => {
    const camadasStr = (reg.camadas || [])
      .map((c, i) => {
        const profStr = (c.profDe ? c.profDe : "?") + "-" + (c.profAte ? c.profAte : "?") + "m";
        const partes = [];
        if (c.cor) partes.push("Cor: " + c.cor);
        if (c.descricao) partes.push("Desc: " + c.descricao);
        if (c.genese) partes.push("Gênese: " + c.genese);
        if (c.material) partes.push("Material: " + c.material);
        if (c.textura) partes.push("Textura: " + c.textura);
        if (c.caracteristicas) partes.push("Caract.: " + c.caracteristicas);
        if (c.grauSelecao) partes.push("Sel./Frat.: " + c.grauSelecao);
        if (c.obsExtras) partes.push("Obs. ext.: " + c.obsExtras);
        if (c.houveAmostra) partes.push("Amostra: " + (c.intervaloAmostra || "intervalo não informado"));
        return "Camada " + (i + 1) + " [" + profStr + "] - " + partes.join(" | ");
      })
      .join(" || ");
    const vocStr = (reg.vocs || [])
      .map((v, i) => "VOC " + (i + 1) + " [" + (v.profundidade || "?") + " m] = " + (v.valor || "?") + " ppm")
      .join(" | ");
    const obj = {
      projeto: reg.projeto || "", empresa: reg.empresa || "", local: reg.local || "",
      lat: reg.lat || "", lon: reg.lon || "", idSond: reg.idSond || "", data: reg.data || "",
      profFinal: reg.profFinal || "", nivelAgua: reg.nivelAgua || "",
      pocoId: reg.poco ? reg.poco.id || "" : "", filtro: reg.poco ? reg.poco.filtro || "" : "",
      preFiltro: reg.poco ? reg.poco.prefiltro || "" : "", naInstalacao: reg.poco ? reg.poco.naInst || "" : "",
      naEstabilizado: reg.poco ? reg.poco.naEstab || "" : "",
      liners: reg.liner
        ? (reg.liner.amostras || [])
            .map((a) => "L" + pad2(a.n) + " [" + (a.de || "?") + "-" + (a.ate || "?") + "m] rec: " + (a.recuperacao || "?") + "cm" + (a.obs ? " (" + a.obs + ")" : ""))
            .join(" | ")
        : "",
      obs: reg.obs || "", camadas: camadasStr, vocs: vocStr,
    };
    return cab.map((c) => celulaCSV(obj[c])).join(";");
  });
  return "﻿" + [cab.join(";")].concat(linhas).join("\n");
}

function csvEnsaio(lista) {
  const cab = ["projeto", "ensaio", "furo", "local", "lat", "lon", "data", "hora_inicial",
    "diametro", "profundidade_m", "trecho_m", "posicao", "delta_h_cm", "delta_t_s",
    "K_cm_s", "classificacao", "volume_L", "vazao_L_min", "leituras", "observacao",
    "responsavel", "verificado"];
  const linhas = lista.map((r) => {
    const c = calcularEnsaio(r);
    return [
      r.projeto, r.idEnsaio, r.furo, r.local, r.lat, r.lon, r.data, r.hora,
      rotuloDiametro(r), r.profundidade, c.trechoM, r.posicao === "abaixo" ? "abaixo do NA" : "acima do NA",
      c.ok ? c.dh : "", c.ok ? c.dt : "", c.ok ? c.K.toExponential(3) : "", c.ok ? c.classe : "",
      c.ok ? c.volume.toFixed(4) : "", c.ok ? c.vazao.toFixed(5) : "",
      (r.leituras || []).filter((l) => l.dh !== "").map((l) => rotuloTempo(l.t) + "=" + l.dh + "cm").join(" | "),
      r.obs, r.responsavel, r.verificado,
    ].map(celulaCSV).join(";");
  });
  return "﻿" + [cab.join(";")].concat(linhas).join("\n");
}
