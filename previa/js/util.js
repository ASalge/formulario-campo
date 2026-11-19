/* =========================================================================
   Utilidades gerais: formatação, DOM, ícones, avisos e folhas (diálogos)
   ========================================================================= */
"use strict";

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel));

// Ações disparadas por data-acao (registradas por cada módulo)
const ACOES = {};

function num(v) {
  if (v === null || v === undefined || v === "") return NaN;
  return parseFloat(String(v).replace(",", "."));
}

function esc(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function listaPt(arr) {
  if (!arr.length) return "";
  if (arr.length === 1) return arr[0];
  return arr.slice(0, -1).join(", ") + " e " + arr[arr.length - 1];
}

function hojeISO() {
  const d = new Date();
  return (
    d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function horaAgora() {
  const d = new Date();
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

function dataBR(iso) {
  return iso ? String(iso).split("-").reverse().join("/") : "";
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
  "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

function partesData(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!m) return null;
  return { ano: +m[1], mes: +m[2], dia: +m[3] };
}

function dataExtenso(d = new Date()) {
  return DIAS[d.getDay()] + ", " + d.getDate() + " de " + MESES_LONGOS[d.getMonth()];
}

// Número com vírgula decimal (para exibição). Mantém o texto se não for número.
function fmtDec(v, casas) {
  const n = num(v);
  if (isNaN(n)) return v == null ? "" : String(v);
  if (casas == null) {
    return n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
  }
  return n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

function fmtNumBR(v, max) {
  if (v === null || v === undefined || isNaN(v)) return "—";
  return Number(v).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: max == null ? 2 : max,
  });
}

function sanitizarNome(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function semAcento(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function debounce(fn, ms) {
  let t = null;
  const f = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
  f.agora = (...args) => {
    clearTimeout(t);
    fn(...args);
  };
  f.cancelar = () => clearTimeout(t);
  return f;
}

function clonar(o) {
  return o == null ? o : JSON.parse(JSON.stringify(o));
}

function tempoRelativo(ts) {
  if (!ts) return "";
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 50) return "agora há pouco";
  const m = Math.round(s / 60);
  if (m < 60) return "há " + m + " min";
  const h = Math.round(m / 60);
  if (h < 24) return "há " + h + " h";
  const d = Math.round(h / 24);
  if (d === 1) return "ontem";
  if (d < 30) return "há " + d + " dias";
  const dt = new Date(ts);
  return dt.getDate() + " " + MESES[dt.getMonth()] + " " + dt.getFullYear();
}

function ic(nome, cls = "") {
  return `<svg class="i ${cls}" aria-hidden="true"><use href="#i-${nome}"/></svg>`;
}

function vibrar(p) {
  try {
    if (navigator.vibrate) navigator.vibrate(p);
  } catch (e) {}
}

function baixarBlob(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// Menu de compartilhar do sistema (no iPhone: Arquivos, AirDrop, WhatsApp, e-mail).
// Precisa ser chamado direto do toque do usuário.
async function compartilharArquivo(file, titulo) {
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: titulo || file.name });
      return "ok";
    }
  } catch (e) {
    if (e && e.name === "AbortError") return "cancelado";
  }
  return "indisponivel";
}

async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = texto;
    ta.style.cssText = "position:fixed;top:-1000px;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (e2) {}
    ta.remove();
    return ok;
  }
}

// ---------------------------------------------------------------- Toast

let toastAtual = null;

function toast(msg, opcoes = {}) {
  if (toastAtual) {
    clearTimeout(toastAtual.timer);
    toastAtual.el.remove();
    if (toastAtual.aoExpirar) toastAtual.aoExpirar();
    toastAtual = null;
  }
  const el = document.createElement("div");
  el.className = "toast";
  if (document.querySelector(".tela:not([hidden]) .barra-acao")) el.classList.add("com-barra");
  if (document.querySelector(".tela:not([hidden]) .bulk-flutuante:not(.oculto)")) el.classList.add("acima-lote");
  el.setAttribute("role", "status");
  el.innerHTML =
    (opcoes.icone !== false ? ic(opcoes.icone || "circle-check") : "") +
    `<span>${esc(msg)}</span>` +
    (opcoes.acao ? `<button type="button">${esc(opcoes.acao)}</button>` : "");
  document.body.appendChild(el);
  const estado = { el, aoExpirar: opcoes.aoExpirar || null, timer: null };
  const fechar = (expirou) => {
    clearTimeout(estado.timer);
    el.remove();
    if (toastAtual === estado) toastAtual = null;
    if (expirou && estado.aoExpirar) estado.aoExpirar();
  };
  if (opcoes.acao) {
    el.querySelector("button").addEventListener("click", () => {
      estado.aoExpirar = null;
      fechar(false);
      if (opcoes.aoAgir) opcoes.aoAgir();
    });
  }
  estado.timer = setTimeout(() => fechar(true), opcoes.duracao || (opcoes.acao ? 6500 : 2800));
  toastAtual = estado;
}

// ---------------------------------------------------------------- Folhas (diálogos)

const Folhas = {
  pilha: [],

  abrir({ titulo = "", html = "", rodape = "", classe = "", aoMontar, fecharNoVeu = true, progresso = false }) {
    const veu = document.createElement("div");
    veu.className = "veu";
    veu.innerHTML = `
      <div class="folha ${classe}" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
        <div class="folha-alca"></div>
        ${progresso ? '<div class="wiz-progresso"><i style="width:0"></i></div>' : ""}
        <div class="folha-cab">
          <div class="folha-titulo">${esc(titulo)}</div>
          <button type="button" class="bt bt-icone" data-fechar aria-label="Fechar">${ic("x")}</button>
        </div>
        <div class="folha-corpo">${html}</div>
        ${rodape ? `<div class="folha-rodape">${rodape}</div>` : ""}
      </div>`;
    document.getElementById("folhas").appendChild(veu);
    const folha = veu.querySelector(".folha");
    let resolver;
    const promessa = new Promise((r) => (resolver = r));
    const item = {
      veu,
      folha,
      corpo: folha.querySelector(".folha-corpo"),
      promessa,
      fechado: false,
      fechar(valor) {
        if (item.fechado) return;
        item.fechado = true;
        veu.remove();
        Folhas.pilha = Folhas.pilha.filter((x) => x !== item);
        resolver(valor === undefined ? null : valor);
        if (item.aoFechar) item.aoFechar(valor);
      },
      definirTitulo(t) {
        folha.querySelector(".folha-titulo").textContent = t;
      },
    };
    veu.addEventListener("click", (e) => {
      if (e.target === veu && fecharNoVeu) item.fechar(null);
      if (e.target.closest("[data-fechar]")) item.fechar(null);
    });
    Folhas.pilha.push(item);
    if (aoMontar) aoMontar(item);
    return item;
  },

  topo() {
    return Folhas.pilha[Folhas.pilha.length - 1] || null;
  },

  // Gesto/botão voltar: fecha a folha do topo (o assistente trata o próprio voltar)
  voltar() {
    const t = Folhas.topo();
    if (!t) return false;
    if (t.aoVoltar) t.aoVoltar();
    else t.fechar(null);
    return true;
  },
};

function confirmar(texto, opcoes = {}) {
  const f = Folhas.abrir({
    titulo: opcoes.titulo || "Confirmar",
    html: `<p class="texto-2" style="font-size:16px;line-height:1.5;white-space:pre-line">${esc(texto)}</p>` +
      (opcoes.lista && opcoes.lista.length
        ? `<ul style="margin:12px 0 0;padding-left:20px;color:var(--alerta);line-height:1.5">${opcoes.lista
            .map((l) => `<li>${esc(l)}</li>`)
            .join("")}</ul>`
        : ""),
    rodape:
      `<button type="button" class="bt bt-sec" data-r="0">${esc(opcoes.cancelar || "Cancelar")}</button>` +
      `<button type="button" class="bt ${opcoes.perigo ? "bt-perigo" : "bt-pri"}" data-r="1">${esc(opcoes.ok || "Confirmar")}</button>`,
  });
  f.folha.querySelectorAll("[data-r]").forEach((b) =>
    b.addEventListener("click", () => f.fechar(b.dataset.r === "1"))
  );
  return f.promessa.then((v) => v === true);
}

function alerta(texto, opcoes = {}) {
  const f = Folhas.abrir({
    titulo: opcoes.titulo || "Aviso",
    html: `<p class="texto-2" style="font-size:16px;line-height:1.5;white-space:pre-line">${esc(texto)}</p>`,
    rodape: `<button type="button" class="bt bt-pri" data-r="1">${esc(opcoes.ok || "Entendi")}</button>`,
  });
  f.folha.querySelector("[data-r]").addEventListener("click", () => f.fechar(true));
  return f.promessa;
}

// Lista de opções; devolve o valor escolhido (ou null)
function escolher({ titulo, texto, itens, busca = false, vazio = "Nada para mostrar." }) {
  const linha = (it, i) =>
    `<button type="button" class="opcao" data-i="${i}">` +
    (it.icone ? ic(it.icone) : "") +
    `<span class="txt"><strong>${esc(it.rotulo)}</strong>${it.detalhe ? `<small>${esc(it.detalhe)}</small>` : ""}</span>` +
    ic("chevron-right", "i-p") +
    `</button>`;
  const f = Folhas.abrir({
    titulo,
    classe: itens.length > 6 ? "alta" : "",
    html:
      (texto ? `<p class="ajuda" style="margin-bottom:12px">${esc(texto)}</p>` : "") +
      (busca
        ? `<div class="busca" style="margin-bottom:12px">${ic("search")}<input type="search" class="entrada" placeholder="Buscar" autocomplete="off"></div>`
        : "") +
      `<div class="opcoes-lista">${itens.length ? itens.map(linha).join("") : `<p class="ajuda">${esc(vazio)}</p>`}</div>`,
  });
  f.corpo.addEventListener("click", (e) => {
    const b = e.target.closest(".opcao");
    if (b) f.fechar(itens[+b.dataset.i].valor);
  });
  if (busca) {
    const inp = f.corpo.querySelector("input[type=search]");
    inp.addEventListener("input", () => {
      const q = semAcento(inp.value.trim());
      f.corpo.querySelectorAll(".opcao").forEach((b) => {
        const it = itens[+b.dataset.i];
        const alvo = semAcento(it.rotulo + " " + (it.detalhe || ""));
        b.classList.toggle("oculto", !!q && !alvo.includes(q));
      });
    });
  }
  return f.promessa;
}

// Pequeno formulário numa folha. campos: [{id, rotulo, tipo, valor, ajuda, chips:[...], decimal}]
function pedirValores({ titulo, texto, campos, ok = "Confirmar", validar }) {
  const html =
    (texto ? `<p class="ajuda" style="margin-bottom:14px">${esc(texto)}</p>` : "") +
    campos
      .map((c) => {
        if (c.tipo === "check") {
          return `<label class="interruptor" style="margin-bottom:14px"><span class="interruptor-texto">${esc(c.rotulo)}${
            c.ajuda ? `<small>${esc(c.ajuda)}</small>` : ""
          }</span><input type="checkbox" data-campo="${c.id}" ${c.valor ? "checked" : ""}><span class="chave"></span></label>`;
        }
        const chips = c.chips
          ? `<div class="chips" style="margin-bottom:10px">${c.chips
              .map((v) => `<button type="button" class="chip chip-peq${String(v) === String(c.valor) ? " sel" : ""}" data-chip="${c.id}" data-v="${esc(v)}">${esc(v)}</button>`)
              .join("")}</div>`
          : "";
        const tipo = c.tipo || "text";
        const modo = c.decimal ? 'inputmode="decimal"' : "";
        return `<div class="campo"><label class="rotulo">${esc(c.rotulo)}</label>${chips}<input class="entrada num" type="${tipo === "number" ? "text" : tipo}" ${modo} data-campo="${c.id}" value="${esc(
          c.valor == null ? "" : c.valor
        )}" placeholder="${esc(c.placeholder || "")}">${c.ajuda ? `<p class="ajuda" style="margin-top:6px">${esc(c.ajuda)}</p>` : ""}</div>`;
      })
      .join("") +
    `<p class="ajuda oculto" data-erro style="color:var(--erro)"></p>`;
  const f = Folhas.abrir({
    titulo,
    html,
    rodape:
      `<button type="button" class="bt bt-sec" data-r="0">Cancelar</button>` +
      `<button type="button" class="bt bt-pri" data-r="1">${esc(ok)}</button>`,
  });
  f.corpo.addEventListener("click", (e) => {
    const ch = e.target.closest("[data-chip]");
    if (!ch) return;
    const inp = f.corpo.querySelector(`[data-campo="${ch.dataset.chip}"]`);
    inp.value = ch.dataset.v;
    f.corpo.querySelectorAll(`[data-chip="${ch.dataset.chip}"]`).forEach((x) => x.classList.toggle("sel", x === ch));
  });
  const ler = () => {
    const out = {};
    f.corpo.querySelectorAll("[data-campo]").forEach((el) => {
      out[el.dataset.campo] = el.type === "checkbox" ? el.checked : el.value.trim();
    });
    return out;
  };
  f.folha.querySelector('[data-r="0"]').addEventListener("click", () => f.fechar(null));
  f.folha.querySelector('[data-r="1"]').addEventListener("click", () => {
    const v = ler();
    const erro = validar ? validar(v) : "";
    if (erro) {
      const el = f.corpo.querySelector("[data-erro]");
      el.textContent = erro;
      el.classList.remove("oculto");
      vibrar(60);
      return;
    }
    f.fechar(v);
  });
  setTimeout(() => {
    const primeiro = f.corpo.querySelector("input.entrada");
    if (primeiro && !campos[0].semFoco) primeiro.focus();
  }, 60);
  return f.promessa;
}

// Menu de ações (ex.: botão ⋯ da barra)
function menuAcoes(titulo, itens) {
  return escolher({ titulo, itens });
}
