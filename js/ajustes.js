/* =========================================================================
   Ajustes: backup, equipe padrão, eventos do diário, armazenamento, sobre
   ========================================================================= */
"use strict";

TELAS.ajustes = {
  id: "tela-ajustes",
  abas: true,
  raiz: true,
  titulo: () => ({ titulo: "Ajustes" }),
  abrir() {
    renderAjustes();
  },
};

const salvarConfigDep = debounce(() => Dados.salvarConfig(), 400);

function fmtBytes(b) {
  if (b == null || isNaN(b)) return "—";
  if (b < 1024 * 1024) return fmtNumBR(b / 1024, 0) + " KB";
  if (b < 1024 * 1024 * 1024) return fmtNumBR(b / 1024 / 1024, 1) + " MB";
  return fmtNumBR(b / 1024 / 1024 / 1024, 1) + " GB";
}

function renderAjustes() {
  const ult = Dados.config.ultimoBackup ? Date.parse(Dados.config.ultimoBackup) : 0;
  const novos = ultimaAtividadeGeral() > ult;
  $("#aj-backup-estado").innerHTML = ult
    ? `<div class="aviso ${novos ? "alerta" : "ok"}">${ic(novos ? "triangle-alert" : "shield-check")}<div class="aviso-corpo">Último backup ${esc(
        tempoRelativo(ult)
      )} (${esc(new Date(ult).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }))}).${novos ? " Há registros novos depois dele." : ""}</div></div>`
    : `<div class="aviso alerta">${ic("triangle-alert")}<div class="aviso-corpo">Nenhum backup feito neste aparelho ainda.</div></div>`;

  if (document.activeElement !== $("#aj-responsavel")) $("#aj-responsavel").value = Dados.config.equipe.responsavel || "";
  if (document.activeElement !== $("#aj-auxiliares")) $("#aj-auxiliares").value = Dados.config.equipe.auxiliares || "";
  renderEventosAjustes();
  renderArmazenamento();
  $("#aj-versao").textContent = APP_VERSAO;
}

function renderEventosAjustes() {
  const evs = eventosDiario();
  $("#aj-eventos").innerHTML = evs
    .map(
      (ev, i) => `
    <div class="evento-cfg">
      <input class="entrada" type="text" data-ev="${i}" value="${esc(ev.t)}" placeholder="Nome do evento" aria-label="Evento ${i + 1}">
      <button type="button" class="chip chip-peq" data-acao="aj-evento-ponto" data-i="${i}" aria-pressed="${!!ev.id}">${ic(ev.id ? "check" : "map-pin", "i-p")}Pergunta o ponto (ST, PM, EP)</button>
      <button type="button" class="bt bt-icone perigo" data-acao="aj-evento-remover" data-i="${i}" aria-label="Remover evento">${ic("x")}</button>
    </div>`
    )
    .join("");
}

async function renderArmazenamento() {
  const el = $("#aj-armazenamento");
  const n = (t) => Dados.lista(t).length;
  const nFotos = Dados.lista("sondagem").reduce((a, r) => a + (r.fotos || []).length, 0);
  const est = await Dados.estadoArmazenamento();
  el.innerHTML = `
    <div class="cfg-linha">
      ${ic("database", "")}
      <div class="txt">Registros neste aparelho<small>${n("projetos")} projetos · ${n("sondagem")} sondagens · ${n("diario")} diários · ${n("ensaios")} ensaios · ${nFotos} fotos</small></div>
    </div>
    <div class="cfg-linha">
      ${ic("hard-drive")}
      <div class="txt">Espaço usado<small>${est.uso != null ? fmtBytes(est.uso) + (est.cota ? " de " + fmtBytes(est.cota) + " disponíveis" : "") : "Não informado por este navegador"}</small></div>
    </div>
    <div class="cfg-linha">
      ${ic(est.persistido ? "shield-check" : "shield-check")}
      <div class="txt">Proteção contra limpeza automática<small>${
        est.persistido === true
          ? "Ativa: o navegador não apaga os dados para liberar espaço."
          : est.persistido === false
          ? "Inativa: com pouco espaço, o navegador pode apagar dados de sites. Faça backups."
          : "Não disponível neste navegador."
      }</small></div>
      ${est.persistido === false ? `<button type="button" class="bt bt-sec bt-peq" data-acao="aj-persistir">Ativar</button>` : ""}
    </div>`;
}

// ---------------------------------------------------------------- Backup

async function exportarBackup() {
  const total = Dados.lista("sondagem").length + Dados.lista("diario").length + Dados.lista("ensaios").length + Dados.lista("projetos").length;
  if (!total) {
    toast("Ainda não há registros para guardar", { icone: "info" });
    return;
  }
  const f = Folhas.abrir({
    titulo: "Preparando o backup…",
    html: `<p class="ajuda">Reunindo registros e fotos.</p><div class="barra-progresso"><i style="width:35%"></i></div>`,
  });
  let file;
  try {
    const dados = await montarBackup();
    const nome = nomeArquivoBackup();
    file = new File([JSON.stringify(dados)], nome, { type: "application/json" });
  } catch (e) {
    f.fechar();
    throw e;
  }
  if (f.fechado) return;
  const podeCompartilhar = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  f.definirTitulo("Backup pronto");
  f.corpo.innerHTML = `
    <div class="aviso ok" style="margin-bottom:14px">${ic("shield-check")}<div class="aviso-corpo"><strong>${esc(file.name)}</strong><br>${esc(fmtBytes(file.size))} · ${Dados.lista("sondagem").length} sondagens, ${Dados.lista("diario").length} diários, ${Dados.lista("ensaios").length} ensaios</div></div>
    <p class="ajuda" style="margin-bottom:14px">Guarde fora do celular: no iPhone, “Salvar em Arquivos” (iCloud Drive) ou envie para o seu e-mail.</p>
    <div class="botoes-col">
      ${podeCompartilhar ? `<button type="button" class="bt bt-pri bt-largo" data-b="share">${ic("share-2")}Salvar ou enviar…</button>` : ""}
      <button type="button" class="bt ${podeCompartilhar ? "bt-sec" : "bt-pri"} bt-largo" data-b="baixar">${ic("download")}Baixar o arquivo</button>
    </div>`;
  const marcar = () => {
    Dados.config.ultimoBackup = new Date().toISOString();
    Dados.salvarConfig();
    if (Nav.topo()) atualizarTelaAtual();
  };
  f.corpo.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-b]");
    if (!b) return;
    if (b.dataset.b === "share") {
      const r = await compartilharArquivo(file, file.name);
      if (r === "ok") {
        marcar();
        f.fechar();
        toast("Backup salvo");
      } else if (r === "indisponivel") {
        baixarBlob(file, file.name);
        marcar();
        f.fechar();
      }
    } else {
      baixarBlob(file, file.name);
      marcar();
      f.fechar();
      toast("Backup baixado");
    }
  });
}

async function importarBackup(input) {
  const file = input.files && input.files[0];
  input.value = "";
  if (!file) return;
  try {
    const r = await importarBackupArquivo(file);
    atualizarTelaAtual();
    await alerta(
      (r.novos ? r.novos + " registro(s) novo(s) incluído(s). " : "Nenhum registro novo. ") +
        (r.atualizados ? r.atualizados + " atualizado(s). " : "") +
        (r.fotos ? r.fotos + " foto(s) restaurada(s). " : "") +
        "\nNada foi duplicado.",
      { titulo: "Backup restaurado" }
    );
  } catch (e) {
    alerta((e && e.message) || "Arquivo de backup inválido.", { titulo: "Não foi possível restaurar" });
  }
}

Object.assign(ACOES, {
  "backup-exportar": () => exportarBackup(),
  "backup-importar": () => $("#arquivo-backup").click(),
  "aj-persistir": async () => {
    const ok = await Dados.pedirPersistencia();
    toast(ok ? "Proteção ativada" : "O navegador não permitiu agora; ela costuma ser liberada com o app instalado na tela inicial.", {
      icone: ok ? "shield-check" : "info",
      duracao: 4500,
    });
    renderArmazenamento();
  },
  "aj-evento-ponto": (el) => {
    const evs = clonar(eventosDiario());
    const i = +el.dataset.i;
    evs[i].id = !evs[i].id;
    if (!evs[i].id) delete evs[i].id;
    Dados.config.eventos = evs;
    Dados.config.personalizada = true;
    Dados.salvarConfig();
    renderEventosAjustes();
  },
  "aj-evento-remover": (el) => {
    const evs = clonar(eventosDiario());
    evs.splice(+el.dataset.i, 1);
    Dados.config.eventos = evs;
    Dados.config.personalizada = true;
    Dados.salvarConfig();
    renderEventosAjustes();
  },
  "aj-evento-novo": () => {
    const evs = clonar(eventosDiario());
    evs.push({ t: "" });
    Dados.config.eventos = evs;
    Dados.config.personalizada = true;
    renderEventosAjustes();
    const ins = $$("#aj-eventos [data-ev]");
    ins[ins.length - 1].focus();
  },
  "aj-eventos-padrao": async () => {
    if (!(await confirmar("Os atalhos de eventos voltam à lista original.", { titulo: "Restaurar eventos?", ok: "Restaurar" }))) return;
    Dados.config.eventos = null;
    Dados.salvarConfig();
    renderEventosAjustes();
  },
});

document.addEventListener("change", (e) => {
  if (e.target && e.target.id === "arquivo-backup") importarBackup(e.target);
});

document.addEventListener("input", (e) => {
  const t = e.target;
  if (!t || !t.closest || !t.closest("#tela-ajustes")) return;
  if (t.id === "aj-responsavel" || t.id === "aj-auxiliares") {
    Dados.config.equipe = {
      responsavel: $("#aj-responsavel").value.trim(),
      auxiliares: $("#aj-auxiliares").value.trim(),
    };
    Dados.config.personalizada = true;
    salvarConfigDep();
  } else if (t.dataset.ev != null) {
    const evs = clonar(eventosDiario());
    evs[+t.dataset.ev].t = t.value;
    Dados.config.eventos = evs;
    Dados.config.personalizada = true;
    salvarConfigDep();
  }
});

// Eventos sem nome não ficam na lista
document.addEventListener("focusout", (e) => {
  const t = e.target;
  if (!t || !t.dataset || t.dataset.ev == null) return;
  setTimeout(() => {
    const evs = eventosDiario().filter((ev) => String(ev.t || "").trim());
    if (evs.length !== eventosDiario().length && !(document.activeElement && document.activeElement.dataset && document.activeElement.dataset.ev != null)) {
      Dados.config.eventos = evs.length ? evs.map((ev) => Object.assign({}, ev, { t: ev.t.trim() })) : null;
      Dados.salvarConfig();
      renderEventosAjustes();
    }
  }, 150);
});
