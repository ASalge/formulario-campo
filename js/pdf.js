/* =========================================================================
   Documentos em PDF: perfil de sondagem, diário, ensaio e relatório do
   projeto. O app monta as páginas, ajusta o layout medindo o resultado
   (tabela de VOC, paginação, numeração) e gera o arquivo no próprio
   aparelho (html2canvas + jsPDF, locais e offline).
   ========================================================================= */
"use strict";

const MM = 96 / 25.4; // px por mm
const ALTURA_PAGINA = 277 * MM;
const LOGO_DOC = "img/logo-navy.svg";

// ---------------------------------------------------------------- Peças comuns

function cabecalhoDoc(titulo, sub) {
  return `
    <div class="pp-head">
      <div class="pp-title">${esc(titulo)}${sub ? `<span class="pp-sub">${esc(sub)}</span>` : ""}</div>
      <img class="pp-logo" src="${LOGO_DOC}" alt="Archipel" />
    </div>`;
}

function paginaDoc({ titulo, sub = "", ref = "", corpo, tipo = "", secao = "", doc = "", fontes = "" }) {
  return `
    <div class="pp-page" data-tipo="${tipo}" data-ref="${esc(ref)}" data-sub="${esc(sub)}"${secao ? ` data-secao="${secao}"` : ""}${
    doc ? ` data-doc="${esc(doc)}"` : ""
  }${fontes ? ` data-fontes="${fontes}"` : ""}>
      ${cabecalhoDoc(titulo, sub)}
      <div class="pp-conteudo">${corpo}</div>
      <div class="pp-foot"><span>${esc(ref)}</span><span class="pp-foot-marca">ARCHIPEL<b class="pp-pag"></b></span></div>
    </div>`;
}

function celInfo(rotulo, valor, colspan) {
  return `<td${colspan ? ` colspan="${colspan}"` : ""}><strong>${esc(rotulo)}</strong>${valor}</td>`;
}

function profTxt(v) {
  const n = num(v);
  return isNaN(n) ? (v ? esc(v) : "?") : fmtDec(n, 2);
}

// ---------------------------------------------------------------- Perfil de sondagem

function montarDescricaoDoc(c) {
  return montarDescricaoCamada(c);
}

async function montarHTMLPerfil(reg) {
  const camadas = ordenarCamadas(reg.camadas || []);
  const profsAte = camadas.map((c) => num(c.profAte)).filter((v) => !isNaN(v));
  let profMax = num(reg.profFinal);
  if (isNaN(profMax)) profMax = 0;
  if (profsAte.length) profMax = Math.max(profMax, Math.max.apply(null, profsAte));
  const temPoco = !!reg.poco;
  const profPoco = temPoco ? (!isNaN(num(reg.poco.prof)) ? num(reg.poco.prof) : profMax) : NaN;
  if (!isNaN(profPoco)) profMax = Math.max(profMax, profPoco);
  if (!profMax || profMax <= 0) profMax = 1;

  // Altura fixa da coluna (mm): o perfil cabe sempre em uma página,
  // qualquer que seja a profundidade (a escala é que muda).
  const H = 148;
  const mm = (v) => v.toFixed(2) + "mm";
  const yDe = (p) => (p / profMax) * H;

  // Coluna litológica
  let bands = "";
  camadas.forEach((c, i) => {
    const de = num(c.profDe);
    const ate = num(c.profAte);
    if (isNaN(de) || isNaN(ate) || ate <= de) return;
    const top = yDe(de);
    const h = yDe(ate) - yDe(de);
    const cor = corParaHex(c.cor) || COR_SEM_DADO;
    const rotulo = h >= 4 ? `<span class="pp-band-n">${i + 1}</span>` : "";
    bands += `<div class="pp-band" style="top:${mm(top)};height:${mm(h)};background:${cor};">${rotulo}</div>`;
  });

  // Régua de profundidade (passo adaptativo)
  const passos = [0.5, 1, 2, 2.5, 5, 10, 20, 25, 50];
  const passo = passos.find((p) => profMax / p <= 14) || 100;
  let ticks = "";
  for (let m = 0; m <= profMax + 0.0001; m = Math.round((m + passo) * 100) / 100) {
    ticks += `<div class="pp-tick" style="top:${mm(yDe(m) - 1.3)};">${Number.isInteger(m) ? m : fmtDec(m, 1)} —</div>`;
  }

  // Nível d'água do furo (rótulo acima da linha)
  const na = num(reg.nivelAgua);
  let naHtml = "";
  if (!isNaN(na) && na >= 0 && na <= profMax) {
    naHtml = `<div class="pp-na" style="top:${mm(yDe(na))};"><span>▽ NA ${fmtDec(na, 2)} m</span></div>`;
  }

  // Poço de monitoramento, sobreposto à coluna (faixa central)
  let wellHtml = "";
  let legendaHtml = "";
  const larguraCol = 28;
  const larguraPoco = 11;
  const espacoRegua = 9;
  if (temPoco) {
    const po = reg.poco;
    const fundo = !isNaN(profPoco) ? profPoco : profMax;
    const lFiltro = num(po.filtro);
    const lPre = num(po.prefiltro);
    const topoFiltro = !isNaN(lFiltro) ? Math.max(0, fundo - lFiltro) : fundo;
    const topoPre = !isNaN(lPre) ? Math.max(0, fundo - lPre) : topoFiltro;
    let segs = "";
    if (!isNaN(lPre) && lPre > 0) {
      segs += `<div class="pp-w-seg pp-w-prefiltro" style="top:${mm(yDe(topoPre))};height:${mm(yDe(fundo) - yDe(topoPre))};"></div>`;
    }
    if (topoFiltro > 0) {
      segs += `<div class="pp-w-seg pp-w-tubo" style="top:0;height:${mm(yDe(topoFiltro))};left:28%;right:28%;"></div>`;
    }
    if (!isNaN(lFiltro) && lFiltro > 0) {
      segs += `<div class="pp-w-seg pp-w-filtro" style="top:${mm(yDe(topoFiltro))};height:${mm(yDe(fundo) - yDe(topoFiltro))};left:28%;right:28%;"></div>`;
    }
    segs += `<div class="pp-w-seg pp-w-fundo" style="top:${mm(yDe(fundo))};height:0.8mm;left:28%;right:28%;"></div>`;
    // Níveis do poço: rótulos abaixo das linhas (o do furo fica acima),
    // sem repetir o valor quando coincide com o NA do furo e sem sobrepor.
    const naI = num(po.naInst);
    const naE = num(po.naEstab);
    let yLivre = -Infinity;
    if (!isNaN(naI) && naI >= 0 && naI <= profMax) {
      segs += `<div class="pp-w-seg" style="top:${mm(yDe(naI))};border-top:1.2px dashed #004f71;"></div>`;
      if (isNaN(na) || Math.abs(naI - na) > 0.009) {
        const y = yDe(naI) + 0.3;
        segs += `<div class="pp-w-na" style="top:${mm(y)};left:1px;">▽ ${fmtDec(naI, 2)}</div>`;
        yLivre = y + 2.9;
      }
    }
    if (!isNaN(naE) && naE >= 0 && naE <= profMax) {
      const y = Math.max(yDe(naE) + 0.3, yLivre);
      segs +=
        `<div class="pp-w-seg" style="top:${mm(yDe(naE))};border-top:1.6px solid #004f71;"></div>` +
        `<div class="pp-w-na" style="top:${mm(y)};left:1px;">▼ ${fmtDec(naE, 2)}</div>`;
    }
    wellHtml = `<div class="pp-well" style="width:${mm(larguraPoco)};">${segs}</div>`;
    legendaHtml = `
      <div class="pp-legend">
        <div><i class="pp-w-filtro"></i>Filtro ${po.filtro ? fmtDec(po.filtro, 2) : "—"} m &nbsp;
             <i class="pp-w-prefiltro"></i>Pré-filtro ${po.prefiltro ? fmtDec(po.prefiltro, 2) : "—"} m</div>
        <div><i class="pp-w-tubo"></i>Tubo liso &nbsp; ▽ NA instalação ${po.naInst ? fmtDec(po.naInst, 2) : "—"} m</div>
        <div>▼ NA estabilizado ${po.naEstab ? fmtDec(po.naEstab, 2) : "—"} m · Fundo ${fmtDec(fundo, 2)} m</div>
      </div>`;
  }
  // O contêiner soma a régua + a coluna (senão a coluna invade a tabela)
  const larguraWrap = larguraCol + espacoRegua;

  // Tabela de camadas (fonte adaptativa ao número de linhas)
  const fonteTab = camadas.length > 22 ? 7.2 : camadas.length > 15 ? 8 : camadas.length > 10 ? 8.5 : 9;
  const rows = camadas
    .map(
      (c, i) =>
        `<tr><td style="text-align:center;">${i + 1}</td>` +
        `<td style="white-space:nowrap;">${profTxt(c.profDe)} – ${profTxt(c.profAte)}</td>` +
        `<td>${esc(montarDescricaoDoc(c))}</td>` +
        `<td>${c.houveAmostra ? esc(c.intervaloAmostra || "Sim") : "–"}</td></tr>`
    )
    .join("");
  const tabelaCamadas = `
    <table class="pp-table" style="font-size:${fonteTab}px;">
      <thead><tr>
        <th style="width:5mm;">#</th><th style="width:18mm;">Prof. (m)</th><th>Descrição</th><th style="width:18mm;">Amostra</th>
      </tr></thead>
      <tbody>${rows || '<tr><td colspan="4">Nenhuma camada descrita.</td></tr>'}</tbody>
    </table>`;

  const obsHtml = reg.obs
    ? `<div class="pp-section-label">Observações gerais / instalação</div><div class="pp-caixa" style="font-size:9px;">${esc(reg.obs)}</div>`
    : "";

  const dataFmt = reg.data ? dataBR(reg.data) : "—";
  const linhasInfo = [];
  let coordRow = "";
  if (reg.lat && reg.lon) {
    const u = latLonParaUTM(num(reg.lat), num(reg.lon));
    coordRow = `<tr>${celInfo(
      "Coordenadas (SIRGAS 2000 / UTM " + u.zone + u.hemi + ")",
      `E ${fmt0(u.e)} m · N ${fmt0(u.n)} m &nbsp;·&nbsp; Lat/Lon: ${esc(reg.lat)}, ${esc(reg.lon)}`,
      3
    )}</tr>`;
  }
  let pocoRow = "";
  if (temPoco) {
    const po = reg.poco;
    pocoRow = `<tr>${celInfo(
      "Poço de monitoramento " + (po.id || ""),
      `Prof.: ${po.prof ? fmtDec(po.prof, 2) : fmtDec(profPoco, 2)} m · Filtro: ${po.filtro ? fmtDec(po.filtro, 2) : "—"} m · Pré-filtro: ${
        po.prefiltro ? fmtDec(po.prefiltro, 2) : "—"
      } m · NA instalação: ${po.naInst ? fmtDec(po.naInst, 2) : "—"} m · NA estabilizado: ${po.naEstab ? fmtDec(po.naEstab, 2) : "—"} m`,
      3
    )}</tr>`;
  }
  let linerRow = "";
  const liners = (reg.liner && reg.liner.amostras) || [];
  if (reg.liner) {
    const comRec = liners.filter((a) => a.recuperacao !== "" && a.recuperacao != null);
    let recMedia = "—";
    const tamCm = num(reg.liner.tamanho);
    if (comRec.length && !isNaN(tamCm) && tamCm > 0) {
      const soma = comRec.reduce((acc, a) => acc + (num(a.recuperacao) || 0), 0);
      recMedia = Math.round((soma / comRec.length / tamCm) * 100) + "%";
    }
    linerRow = `<tr>${celInfo(
      "Amostragem com liner",
      `Liner de ${esc(reg.liner.tamanho || "—")} cm · Trecho ${profTxt(reg.liner.inicio)} – ${profTxt(reg.liner.fim)} m · ${liners.length} liners · Recuperação média: ${recMedia}`,
      3
    )}</tr>`;
  }
  linhasInfo.push(
    `<tr>${celInfo("Projeto", esc(reg.projeto || "—"))}${celInfo(
      "Sondagem / poço",
      esc(reg.idSond || "—") + (reg.poco && reg.poco.id ? " / " + esc(reg.poco.id) : "")
    )}${celInfo("Data", esc(dataFmt))}</tr>`,
    `<tr>${celInfo("Local", esc(reg.local || "—"))}${celInfo("Empresa de sondagem", esc(reg.empresa || "—"))}${celInfo(
      "Prof. final / NA",
      (reg.profFinal ? fmtDec(reg.profFinal, 2) : "—") + " m / " + (reg.nivelAgua ? fmtDec(reg.nivelAgua, 2) + " m" : "seco")
    )}</tr>`
  );

  const titulo = temPoco ? "Perfil de sondagem e poço de monitoramento" : "Perfil de sondagem";
  const sub = [reg.projeto, reg.idSond + (reg.poco && reg.poco.id ? " / " + reg.poco.id : "")].filter(Boolean).join(" · ");
  const ref = [reg.projeto, reg.idSond, dataFmt !== "—" ? dataFmt : ""].filter(Boolean).join(" · ");
  const vocs = (reg.vocs || []).filter((v) => v.profundidade || v.valor);

  const corpo = `
    <table class="pp-info">${linhasInfo.join("")}${pocoRow}${linerRow}${coordRow}</table>
    <div class="pp-body">
      <div class="pp-colwrap" style="width:${mm(larguraWrap)};">
        <div class="pp-col" style="height:${mm(H)};width:${mm(larguraCol)};">${bands}${wellHtml}${ticks}${naHtml}</div>
        ${legendaHtml}
      </div>
      <div class="pp-direita">
        ${tabelaCamadas}
        ${obsHtml}
        <div class="pp-voc-lateral" data-vocs="${esc(JSON.stringify(vocs))}"></div>
      </div>
    </div>
    <div class="pp-voc-abaixo"></div>`;

  const paginas = [paginaDoc({ titulo, sub, ref, corpo, tipo: "perfil", secao: "sondagens", doc: reg.idSond || "" })];

  // Anexo: recuperação dos liners
  if (liners.length) {
    const tamCm = num(reg.liner.tamanho);
    const porLinha = liners.length > 40 ? 4 : liners.length > 20 ? 3 : 2;
    let cels = "";
    liners.forEach((a, i) => {
      if (i % porLinha === 0) cels += "<tr>";
      const rec = num(a.recuperacao);
      const tam = num(a.tamanho) || tamCm;
      const pct = !isNaN(rec) && tam > 0 ? Math.round((rec / tam) * 100) + "%" : "—";
      const cls = i % porLinha ? ' class="pp-par-ini"' : "";
      cels +=
        `<td${cls}><strong>L${pad2(a.n || i + 1)}</strong></td>` +
        `<td>${profTxt(a.de)}–${profTxt(a.ate)}</td><td>${esc(a.recuperacao || "—")}</td><td>${pct}</td>`;
      if (i % porLinha === porLinha - 1 || i === liners.length - 1) {
        for (let k = (i % porLinha) + 1; k < porLinha && i === liners.length - 1; k++) cels += `<td class="pp-par-ini"></td><td></td><td></td><td></td>`;
        cels += "</tr>";
      }
    });
    let cabec = "";
    for (let k = 0; k < porLinha; k++) {
      cabec += `<th${k ? ' class="pp-par-ini"' : ""}>Liner</th><th>Prof. (m)</th><th>Rec. (cm)</th><th>%</th>`;
    }
    paginas.push(
      paginaDoc({
        titulo: "Recuperação dos liners",
        sub,
        ref,
        tipo: "anexo",
        corpo: `<table class="pp-table pp-table-dense pp-paginavel"><thead><tr>${cabec}</tr></thead><tbody>${cels}</tbody></table>`,
      })
    );
  }

  // Anexo: registro fotográfico (6 fotos por folha)
  const itens = [];
  for (const ref2 of reg.fotos || []) {
    const blob = await Dados.fotoObter(ref2.id);
    if (blob) {
      const dataUrl = await blobParaDataURL(blob);
      itens.push(`<div class="pp-foto"><img src="${dataUrl}" alt="" /><div>${esc(ref2.legenda || "")}</div></div>`);
    }
  }
  for (let i = 0; i < itens.length; i += 6) {
    paginas.push(
      paginaDoc({
        titulo: "Registro fotográfico",
        sub,
        ref,
        tipo: "anexo",
        corpo: `<div class="pp-fotos">${itens.slice(i, i + 6).join("")}</div>`,
      })
    );
  }
  return paginas.join("");
}

// Tabela de VOC com "por" pares (Prof. + ppm) por linha
function tabelaVOC(vocs, por, fonte) {
  let cels = "";
  for (let i = 0; i < vocs.length; i += por) {
    cels += "<tr>";
    for (let k = 0; k < por; k++) {
      const v = vocs[i + k];
      const cls = k ? ' class="pp-par-ini"' : "";
      cels += v
        ? `<td${cls}>${v.profundidade ? profTxt(v.profundidade) : "?"}</td><td><strong>${v.valor !== "" && v.valor != null ? esc(fmtDec(v.valor)) : "?"}</strong></td>`
        : `<td${cls}></td><td></td>`;
    }
    cels += "</tr>";
  }
  let cabec = "";
  let cols = "";
  for (let k = 0; k < por; k++) {
    cabec += `<th${k ? ' class="pp-par-ini"' : ""}>Prof. (m)</th><th>ppm</th>`;
    cols += `<col style="width:${(58 / por).toFixed(3)}%"><col style="width:${(42 / por).toFixed(3)}%">`;
  }
  return (
    `<table class="pp-table pp-table-dense pp-paginavel" style="font-size:${fonte}px;">` +
    `<colgroup>${cols}</colgroup><thead><tr>${cabec}</tr></thead><tbody>${cels}</tbody></table>`
  );
}

// ---------------------------------------------------------------- Diário

function montarHTMLDiario(reg) {
  const dataFmt = reg.data ? dataBR(reg.data) : "—";
  const linhasAtiv = (reg.atividades || "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length);
  let ativHtml;
  if (linhasAtiv.length) {
    const temHora = linhasAtiv.every((l) => /^\d{1,2}h[0-5]\d\b/.test(l));
    if (temHora) {
      const trs = linhasAtiv
        .map((l) => {
          const m = l.match(/^(\d{1,2}h[0-5]\d)\s*[:\-–]?\s*(.*)$/);
          return `<tr><td style="white-space:nowrap;">${esc(m ? m[1] : "")}</td><td>${esc(m ? m[2] : l)}</td></tr>`;
        })
        .join("");
      ativHtml = `<table class="pp-table pp-paginavel" data-fonte-var><thead><tr><th style="width:16mm;">Hora</th><th>Atividade</th></tr></thead><tbody>${trs}</tbody></table>`;
    } else {
      ativHtml = `<div class="pp-caixa" data-fonte-var>${esc(reg.atividades)}</div>`;
    }
  } else {
    ativHtml = `<div style="font-size:10px;color:#6b7b8a;">Sem atividades registradas.</div>`;
  }
  const obsHtml = reg.observacoes
    ? `<div data-so-ultima><div class="pp-section-label">Observações</div><div class="pp-caixa" data-fonte-var>${esc(reg.observacoes)}</div></div>`
    : "";
  const corpo = `
    <table class="pp-info" data-so-primeira>
      <tr>${celInfo("Projeto", esc(reg.projeto || "—"))}${celInfo("Cliente", esc(reg.cliente || "—"))}${celInfo("Data", esc(dataFmt))}</tr>
      <tr>${celInfo("Local", esc(reg.local || "—"))}${celInfo("Horário de trabalho", esc(reg.horario || "—"))}${celInfo("Condições climáticas", esc(reg.clima || "—"))}</tr>
      <tr>${celInfo("Responsável", esc(reg.responsavel || "—"), 2)}${celInfo("Equipe / auxiliares", esc(reg.auxiliares || "—"))}</tr>
    </table>
    <div class="pp-section-label pp-rotulo-tab">Atividades desenvolvidas</div>
    ${ativHtml}
    ${obsHtml}`;
  return paginaDoc({
    titulo: "Diário de atividades",
    sub: [reg.projeto, dataFmt !== "—" ? dataFmt : ""].filter(Boolean).join(" · "),
    ref: ["Diário", reg.projeto, dataFmt !== "—" ? dataFmt : ""].filter(Boolean).join(" · "),
    corpo,
    tipo: "diario",
    secao: "diarios",
    doc: dataFmt,
    fontes: "10,9.4,8.8,8.2",
  });
}

// ---------------------------------------------------------------- Ensaio

// Gráfico rebaixamento × tempo em canvas (imagem igual na tela, no PDF e na impressão)
function graficoEnsaio(c) {
  try {
    const W = 900;
    const H = 540;
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const g = cv.getContext("2d");
    if (!g) return "";
    const m = { l: 92, r: 24, t: 24, b: 70 };
    const pw = W - m.l - m.r;
    const ph = H - m.t - m.b;
    const pts = c.leit.map((l) => ({ x: l.t / 60, y: l.dh - c.base }));
    const xmax = Math.max(1, ...pts.map((p) => p.x));
    const ymax = Math.max(0.1, ...pts.map((p) => p.y)) * 1.1;
    const X = (x) => m.l + (x / xmax) * pw;
    const Y = (y) => m.t + (y / ymax) * ph; // rebaixamento cresce para baixo
    const fonte = (peso, tam) => `${peso} ${tam}px Inter, Arial, sans-serif`;
    g.fillStyle = "#fff";
    g.fillRect(0, 0, W, H);
    g.font = fonte(400, 22);
    g.fillStyle = "#3c4a5a";
    g.strokeStyle = "#dfe6eb";
    g.lineWidth = 1.5;
    const passo = (v) => {
      const p = Math.pow(10, Math.floor(Math.log10(v / 5)));
      return [1, 2, 5, 10].map((k) => k * p).find((k) => v / k <= 6);
    };
    const sx = passo(xmax);
    const sy = passo(ymax);
    g.textAlign = "center";
    for (let x = 0; x <= xmax + 1e-9; x += sx) {
      g.beginPath();
      g.moveTo(X(x), m.t);
      g.lineTo(X(x), m.t + ph);
      g.stroke();
      g.fillText(fmtNumBR(x, 1), X(x), m.t + ph + 30);
    }
    g.textAlign = "right";
    for (let y = 0; y <= ymax + 1e-9; y += sy) {
      g.beginPath();
      g.moveTo(m.l, Y(y));
      g.lineTo(m.l + pw, Y(y));
      g.stroke();
      g.fillText(fmtNumBR(y, 1), m.l - 10, Y(y) + 8);
    }
    g.strokeStyle = "#13294b";
    g.lineWidth = 2;
    g.strokeRect(m.l, m.t, pw, ph);
    g.textAlign = "center";
    g.font = fonte(600, 22);
    g.fillStyle = "#13294b";
    g.fillText("Tempo acumulado (min)", m.l + pw / 2, H - 12);
    g.save();
    g.translate(26, m.t + ph / 2);
    g.rotate(-Math.PI / 2);
    g.fillText("Rebaixamento do NA (cm)", 0, 0);
    g.restore();
    g.setLineDash([10, 8]);
    g.strokeStyle = "#6399ae";
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(X(0), Y(0));
    g.lineTo(X(c.dt / 60), Y(c.dh));
    g.stroke();
    g.setLineDash([]);
    g.strokeStyle = "#004f71";
    g.lineWidth = 3.5;
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(X(p.x), Y(p.y)) : g.moveTo(X(p.x), Y(p.y))));
    g.stroke();
    g.fillStyle = "#004f71";
    pts.forEach((p) => {
      g.beginPath();
      g.arc(X(p.x), Y(p.y), 6, 0, Math.PI * 2);
      g.fill();
    });
    return cv.toDataURL("image/png");
  } catch (e) {
    return "";
  }
}

// Régua de Mello e Teixeira (1967) com a posição do K obtido
function reguaClassificacao(K, rotulo) {
  const lmax = 2;
  const lmin = -9;
  const span = lmax - lmin;
  const pos = (l) => ((lmax - l) / span) * 100;
  const faixas = [
    [2, 0, "pedregulhos"],
    [0, -3, "areias"],
    [-3, -7, "areias finas siltosas e argilosas, siltes argilosos"],
    [-7, -9, "argilas"],
  ];
  const ticks = [[2, "10²"], [0, "1"], [-2, "10⁻²"], [-4, "10⁻⁴"], [-6, "10⁻⁶"], [-8, "10⁻⁸"]];
  const lk = Math.max(lmin, Math.min(lmax, Math.log10(K)));
  return `
    <div class="ens-regua">
      <div class="ens-regua-esc">
        ${ticks.map(([l, t]) => `<span style="left:${pos(l)}%">${t}</span>`).join("")}
        ${isFinite(K) && K > 0 ? `<b class="ens-regua-mk" style="left:${pos(lk)}%">▼ ${esc(rotulo)}</b>` : ""}
      </div>
      <div class="ens-regua-faixas">
        ${faixas.map(([a, b, n]) => `<div style="left:${pos(a)}%;width:${pos(b) - pos(a)}%">${n}</div>`).join("")}
      </div>
      <div class="ens-regua-legenda">K (cm/s) · Mello e Teixeira (1967)</div>
    </div>`;
}

function montarHTMLEnsaio(reg) {
  const c = calcularEnsaio(reg);
  const dataFmt = reg.data ? dataBR(reg.data) : "—";
  const lidas = (reg.leituras || []).filter((l) => l.dh !== "" && !isNaN(num(l.dh)));
  const naDepois = c.ok ? c.dh : NaN;
  const linhas = lidas
    .map((l) => {
      const dh = num(l.dh) - c.base;
      const vol = c.area > 0 ? (c.area * dh) / 1000 : NaN;
      return (
        `<tr><td>${esc(horaMaisSegundos(reg.hora, Number(l.t)))}</td><td>${rotuloTempo(Number(l.t))}</td>` +
        `<td>${fmtNumBR(num(l.dh), 2)}</td><td>${fmtNumBR(vol, 3)}</td></tr>`
      );
    })
    .join("");
  let coordRow = "";
  if (reg.lat && reg.lon) {
    const u = latLonParaUTM(num(reg.lat), num(reg.lon));
    coordRow = `<tr>${celInfo("Coordenadas (SIRGAS 2000 / UTM " + u.zone + u.hemi + ")", `E ${fmt0(u.e)} m · N ${fmt0(u.n)} m`, 3)}</tr>`;
  }
  const grafico = c.ok ? graficoEnsaio(c) : "";
  const rotulo = reg.idEnsaio || "EP";
  const memoria = c.ok
    ? `<div class="ens-memo">
         <div>K = (Δh / Δt) × 1 / [ i · (2h / r + 1) ]</div>
         <div>K = (${fmtNumBR(c.dh)} / ${c.dt}) × 1 / [ ${ENS_I} · (${fmtNumBR(2 * c.h, 1)} / ${fmtNumBR(c.r, 2)} + 1) ]</div>
         <div class="ens-memo-res">K = ${fmtCientifico(c.K)} cm/s &nbsp;(${fmtCientifico(c.K / 100)} m/s)</div>
         <div class="ens-memo-leg">Δh = rebaixamento total (cm) · Δt = tempo total (s) · h = trecho ensaiado (cm) · r = raio do furo (cm) · i = constante geométrica do cilindro</div>
       </div>`
    : `<div class="ens-memo">${esc(c.aviso)}</div>`;
  const corpo = `
    <table class="pp-info">
      <tr>${celInfo("Projeto", esc(reg.projeto || "—"))}${celInfo("Obra / local", esc(reg.local || "—"))}${celInfo("Data", esc(dataFmt))}</tr>
      <tr>${celInfo("Ensaio / furo nº", esc(reg.idEnsaio || "—") + " / " + esc(reg.furo || reg.idEnsaio || "—"))}${celInfo(
        "Tipo de ensaio",
        "Rebaixamento · " + (reg.posicao === "abaixo" ? "abaixo do NA" : "acima do NA")
      )}${celInfo("Hora inicial", esc(reg.hora || "—"))}</tr>
      <tr>${celInfo("Diâmetro do furo", esc(rotuloDiametro(reg)) + (c.r > 0 ? " (r = " + fmtNumBR(c.r, 2) + " cm)" : ""))}${celInfo(
        "Profundidade do furo / trecho ensaiado",
        fmtNumBR(num(reg.profundidade)) + " m / " + fmtNumBR(c.trechoM) + " m"
      )}${celInfo("Variação do NA — antes / depois", fmtNumBR(0, 2) + " cm / " + fmtNumBR(naDepois, 2) + " cm")}</tr>
      ${coordRow}
      <tr>${celInfo("Responsável", esc(reg.responsavel || "—"), 2)}${celInfo("Verificado", esc(reg.verificado || "—"))}</tr>
    </table>
    <div class="ens-corpo">
      <div class="ens-col-tab">
        <table class="pp-table ens-tab">
          <thead><tr><th>Hora</th><th>Tempo acum.</th><th>Variação do NA (cm)</th><th>Volume acum. (L)</th></tr></thead>
          <tbody>${linhas || '<tr><td colspan="4">Sem leituras.</td></tr>'}</tbody>
        </table>
      </div>
      <div class="ens-col-res">
        <div class="ens-res-box">
          <div class="ens-res-k">K = ${c.ok ? fmtCientifico(c.K) : "—"} cm/s</div>
          <div class="ens-res-cls">${esc(c.ok ? c.classe : "")}</div>
          <div class="ens-res-num">Δh/Δt = ${c.ok ? fmtCientifico(c.dh / c.dt) : "—"} cm/s · Volume infiltrado ${c.ok ? fmtNumBR(c.volume, 3) : "—"} L · Vazão média ${
    c.ok ? fmtNumBR(c.vazao, 4) : "—"
  } L/min</div>
        </div>
        ${
          grafico
            ? `<img class="ens-grafico" src="${grafico}" alt="" />
               <div class="ens-graf-leg"><span style="color:#004f71">●—</span> leituras &nbsp; <span style="color:#6399ae">- - -</span> taxa média adotada no cálculo</div>`
            : ""
        }
        <div class="pp-section-label">Memória de cálculo</div>
        ${memoria}
        ${c.ok ? reguaClassificacao(c.K, rotulo) : ""}
      </div>
    </div>
    ${reg.obs ? `<div class="pp-section-label">Observação</div><div class="pp-caixa" style="font-size:9.4px;">${esc(reg.obs)}</div>` : ""}`;
  return paginaDoc({
    titulo: "Ensaio de permeabilidade em solo",
    sub: [reg.projeto, reg.idEnsaio, "nível variável (rebaixamento)"].filter(Boolean).join(" · "),
    ref: [reg.projeto, reg.idEnsaio, dataFmt !== "—" ? dataFmt : ""].filter(Boolean).join(" · "),
    corpo,
    tipo: "ensaio",
    secao: "ensaios",
    doc: reg.idEnsaio || "",
  });
}

// ---------------------------------------------------------------- Capa do relatório

function montarCapaProjeto(p, sondagens, ensaios, diarios) {
  const pocos = sondagens.filter((r) => r.poco).length;
  const datas = [...sondagens, ...ensaios, ...diarios].map((r) => r.data).filter(Boolean).sort();
  const periodo = datas.length
    ? datas[0] === datas[datas.length - 1]
      ? dataBR(datas[0])
      : dataBR(datas[0]) + " a " + dataBR(datas[datas.length - 1])
    : "—";
  const secao = (id, nome, itens) =>
    itens.length
      ? `<tr><td><strong>${esc(nome)}</strong><small>${esc(itens.join(", "))}</small></td><td data-pags="${id}"></td></tr>`
      : "";
  const corpo = `
    <div class="pp-capa-faixa">
      <img class="pp-capa-estratos" src="img/simbolo-tom.svg" alt="" />
      <img class="pp-capa-logo" src="img/logo-areia.svg" alt="Archipel" />
      <div class="pp-capa-titulo">Relatório de campo</div>
      <div class="pp-capa-sub">${esc(p.numero || "")}${p.cliente ? " · " + esc(p.cliente) : ""}</div>
    </div>
    <div class="pp-capa-dados">
      <div><strong>Local</strong>${esc(p.local || "—")}</div>
      <div><strong>Empresa de sondagem</strong>${esc(p.empresa || "—")}</div>
      <div><strong>Período de campo</strong>${esc(periodo)}</div>
      <div><strong>Projeto</strong>${esc(p.numero || "—")}</div>
    </div>
    <div class="pp-capa-numeros">
      <div><b>${sondagens.length}<small style="font-size:12px;font-weight:500;color:#5b6a79"> / ${p.qtdSond || 0}</small></b>sondagens</div>
      <div><b>${pocos}<small style="font-size:12px;font-weight:500;color:#5b6a79"> / ${p.qtdPocos || 0}</small></b>poços instalados</div>
      <div><b>${ensaios.length}<small style="font-size:12px;font-weight:500;color:#5b6a79"> / ${p.qtdEns || ensaios.length}</small></b>ensaios de permeabilidade</div>
      <div><b>${diarios.length}</b>diários de atividades</div>
    </div>
    <div class="pp-section-label">Conteúdo</div>
    <table class="pp-sumario">
      ${secao("sondagens", "Perfis de sondagem", sondagens.map((r) => r.idSond || "?"))}
      ${secao(
        "ensaios",
        "Ensaios de permeabilidade",
        ensaios.map((r) => {
          const c = calcularEnsaio(r);
          return (r.idEnsaio || "?") + (c.ok ? " (K = " + fmtCientifico(c.K) + " cm/s)" : "");
        })
      )}
      ${secao("diarios", "Diários de atividades", diarios.map((r) => (r.data ? dataBR(r.data) : "?")))}
    </table>`;
  return `
    <div class="pp-page" data-tipo="capa" data-ref="${esc(p.numero || "")}">
      <div class="pp-conteudo">${corpo}</div>
      <div class="pp-foot"><span>${esc((p.numero || "") + (p.cliente ? " · " + p.cliente : "") + " · Relatório de campo")}</span><span class="pp-foot-marca">ARCHIPEL<b class="pp-pag"></b></span></div>
    </div>`;
}

// ---------------------------------------------------------------- Layout medido

async function carregarFontesDoc() {
  try {
    await Promise.all([
      document.fonts.load('400 10px "Inter"'),
      document.fonts.load('600 10px "Inter"'),
      document.fonts.load('700 10px "Inter"'),
      document.fonts.load('400 10px "Inter"', "Δ"),
    ]);
    await document.fonts.ready;
  } catch (e) {}
}

function esperarImagens(raiz) {
  return Promise.all(
    $$("img", raiz).map((img) =>
      img.complete && img.naturalWidth
        ? null
        : new Promise((r) => {
            img.onload = img.onerror = r;
            setTimeout(r, 4000);
          })
    )
  );
}

function cabeNaLargura(cont) {
  const t = cont.querySelector("table");
  if (!t) return true;
  if (t.scrollWidth > cont.clientWidth + 0.5) return false;
  for (const c of t.querySelectorAll("th, td")) {
    if (c.scrollWidth > c.clientWidth + 0.5) return false;
  }
  return true;
}

// Maior número de pares por linha que cabe na largura (sem cortar texto)
function maxPares(cont, vocs, fonte, rotulo) {
  for (let por = Math.min(14, vocs.length); por >= 1; por--) {
    cont.innerHTML = rotulo + tabelaVOC(vocs, por, fonte);
    if (cabeNaLargura(cont)) return por;
  }
  cont.innerHTML = "";
  return 0;
}

const FONTES_VOC = [8, 7.5, 7, 6.5, 6.2, 5.8];

// Tabela de VOC: 1º ao lado da coluna (sob a litologia), 2º abaixo do
// perfil, 3º em folha anexa.
function encaixarVOC(pg) {
  const slot = pg.querySelector(".pp-voc-lateral");
  if (!slot) return null;
  let vocs = [];
  try {
    vocs = JSON.parse(slot.getAttribute("data-vocs") || "[]");
  } catch (e) {}
  slot.removeAttribute("data-vocs");
  if (!vocs.length) return null;
  const rotulo = `<div class="pp-section-label">Medições de VOC (PID)</div>`;
  const limite = pg.querySelector(".pp-colwrap").getBoundingClientRect().bottom;
  for (const f of FONTES_VOC) {
    if (!maxPares(slot, vocs, f, rotulo)) continue;
    if (slot.getBoundingClientRect().bottom <= limite + 0.5 && pg.scrollHeight <= ALTURA_PAGINA + 1) return "lateral";
  }
  slot.innerHTML = "";
  const abaixo = pg.querySelector(".pp-voc-abaixo");
  for (const f of FONTES_VOC) {
    if (!maxPares(abaixo, vocs, f, rotulo)) continue;
    if (pg.scrollHeight <= ALTURA_PAGINA + 1) return "abaixo";
  }
  abaixo.innerHTML = "";
  const tmp = document.createElement("div");
  tmp.innerHTML = paginaDoc({
    titulo: "Medições de VOC (PID)",
    sub: pg.dataset.sub,
    ref: pg.dataset.ref,
    tipo: "anexo",
    corpo: `<div class="pp-voc-anexo"></div>`,
  }).trim();
  const anexo = tmp.firstElementChild;
  pg.after(anexo);
  const cont = anexo.querySelector(".pp-voc-anexo");
  for (const f of FONTES_VOC) {
    if (maxPares(cont, vocs, f, "") && anexo.scrollHeight <= ALTURA_PAGINA + 1) return "anexo";
  }
  maxPares(cont, vocs, FONTES_VOC[FONTES_VOC.length - 1], "");
  paginarTabela(anexo);
  return "anexo";
}

// Diário: maior fonte que mantém a folha inteira
function ajustarFonte(pg) {
  const fontes = (pg.dataset.fontes || "").split(",").map(Number).filter(Boolean);
  const alvos = $$("[data-fonte-var]", pg);
  if (!fontes.length || !alvos.length) return;
  for (const f of fontes) {
    alvos.forEach((el) => (el.style.fontSize = f + "px"));
    $$("[data-fonte-var] th, [data-fonte-var] td", pg).forEach((el) => (el.style.fontSize = f + "px"));
    if (pg.scrollHeight <= ALTURA_PAGINA + 1) return;
  }
  paginarTabela(pg);
}

// Folha que transborda: as linhas finais da tabela passam para folhas de continuação
function paginarTabela(pg) {
  let atual = pg;
  let guarda = 0;
  while (atual.scrollHeight > ALTURA_PAGINA + 1 && guarda++ < 60) {
    const tab = atual.querySelector("table.pp-paginavel");
    if (!tab || !tab.tBodies[0] || tab.tBodies[0].rows.length <= 1) return;
    const nova = atual.cloneNode(true);
    $$("[data-so-primeira]", nova).forEach((e) => e.remove());
    const rot = nova.querySelector(".pp-rotulo-tab");
    if (rot && !/continuação/.test(rot.textContent)) rot.textContent += " (continuação)";
    const corpoNovo = nova.querySelector("table.pp-paginavel").tBodies[0];
    corpoNovo.innerHTML = "";
    // O que vem depois da tabela fica só na última folha
    $$("[data-so-ultima]", atual).forEach((e) => e.remove());
    atual.after(nova);
    const corpo = tab.tBodies[0];
    while (atual.scrollHeight > ALTURA_PAGINA + 1 && corpo.rows.length > 1) {
      corpoNovo.insertBefore(corpo.rows[corpo.rows.length - 1], corpoNovo.firstChild);
    }
    if (!corpoNovo.rows.length) {
      nova.remove();
      return;
    }
    atual = nova;
  }
}

function numerarPaginas(palco) {
  const pags = $$(".pp-page", palco);
  pags.forEach((pg, i) => {
    const el = pg.querySelector(".pp-pag");
    if (el) el.textContent = i + 1 + "/" + pags.length;
  });
  // Sumário da capa: intervalo de páginas de cada seção
  const capa = palco.querySelector('.pp-page[data-tipo="capa"]');
  if (capa) {
    const faixas = {};
    let secaoAtual = null;
    pags.forEach((pg, i) => {
      if (pg.dataset.secao) secaoAtual = pg.dataset.secao;
      if (pg.dataset.tipo === "capa" || !secaoAtual) return;
      const f = faixas[secaoAtual] || (faixas[secaoAtual] = [i + 1, i + 1]);
      f[1] = i + 1;
    });
    $$("[data-pags]", capa).forEach((td) => {
      const f = faixas[td.dataset.pags];
      td.textContent = f ? (f[0] === f[1] ? "p. " + f[0] : "p. " + f[0] + "–" + f[1]) : "";
    });
  }
}

async function prepararDocumento(html) {
  await carregarFontesDoc();
  const antigo = document.getElementById("pdf-palco");
  if (antigo) antigo.remove();
  const palco = document.createElement("div");
  palco.id = "pdf-palco";
  palco.innerHTML = html;
  document.body.appendChild(palco);
  await esperarImagens(palco);
  $$('.pp-page[data-tipo="perfil"]', palco).forEach(encaixarVOC);
  $$(".pp-page[data-fontes]", palco).forEach(ajustarFonte);
  $$(".pp-page", palco).forEach((pg) => {
    if (pg.scrollHeight > ALTURA_PAGINA + 1 && pg.querySelector("table.pp-paginavel")) paginarTabela(pg);
  });
  numerarPaginas(palco);
  return palco;
}

// ---------------------------------------------------------------- Geração do arquivo

function carregarScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => res();
    s.onerror = () => rej(new Error("Não foi possível carregar " + src + ". Abra o app uma vez com internet para baixá-lo."));
    document.head.appendChild(s);
  });
}

async function carregarLibsPDF() {
  if (!window.html2canvas) await carregarScript("vendor/html2canvas.min.js");
  if (!(window.jspdf && window.jspdf.jsPDF)) await carregarScript("vendor/jspdf.umd.min.js");
}

async function rasterizar(palco, nome, aoProgredir, cancelado) {
  await carregarLibsPDF();
  const { jsPDF } = window.jspdf;
  const paginas = $$(".pp-page", palco);
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  let previa = "";
  for (let i = 0; i < paginas.length; i++) {
    if (cancelado && cancelado()) throw new Error("cancelado");
    if (aoProgredir) aoProgredir(i + 1, paginas.length);
    const pg = paginas[i];
    const canvas = await window.html2canvas(pg, {
      scale: 2.5,
      backgroundColor: "#ffffff",
      logging: false,
      useCORS: true,
      ignoreElements: (el) =>
        el.id === "app" || el.id === "folhas" || el.id === "print-area" ||
        (el.classList && el.classList.contains("pp-page") && el !== pg),
      onclone: async (doc) => {
        try {
          await Promise.all([doc.fonts.load('400 10px "Inter"'), doc.fonts.load('600 10px "Inter"'), doc.fonts.load('700 10px "Inter"')]);
          await doc.fonts.ready;
        } catch (e) {}
      },
    });
    // Ajusta à área útil da A4 (190 × 277 mm), sem distorcer
    let w = 190;
    let h = (canvas.height * w) / canvas.width;
    if (h > 277) {
      h = 277;
      w = (canvas.width * h) / canvas.height;
    }
    if (i > 0) pdf.addPage();
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 10 + (190 - w) / 2, 10, w, h);
    if (i === 0) {
      const mini = document.createElement("canvas");
      mini.width = 360;
      mini.height = Math.round((canvas.height * 360) / canvas.width);
      mini.getContext("2d").drawImage(canvas, 0, 0, mini.width, mini.height);
      previa = mini.toDataURL("image/jpeg", 0.8);
    }
    canvas.width = canvas.height = 0; // libera memória no celular
  }
  const blob = pdf.output("blob");
  return { file: new File([blob], nome + ".pdf", { type: "application/pdf" }), paginas: paginas.length, previa };
}

// Texturas do poço como pequenas imagens repetidas (o gerador de PDF não
// desenha degradês CSS, mas desenha imagens).
function instalarTexturasPoco() {
  try {
    const ranhura = document.createElement("canvas");
    ranhura.width = 8;
    ranhura.height = 10;
    let c = ranhura.getContext("2d");
    c.fillStyle = "#111";
    c.fillRect(0, 0, 8, 3);
    const pontos = document.createElement("canvas");
    pontos.width = 10;
    pontos.height = 10;
    c = pontos.getContext("2d");
    c.fillStyle = "#6b5c34";
    c.beginPath();
    c.arc(5, 5, 2.4, 0, Math.PI * 2);
    c.fill();
    const st = document.createElement("style");
    st.id = "pp-texturas";
    st.textContent =
      ".pp-w-filtro{background-image:url(" + ranhura.toDataURL() + ")!important;" +
      "background-size:4px 2.6px!important;background-repeat:repeat!important;}" +
      ".pp-w-prefiltro{background-image:url(" + pontos.toDataURL() + ")!important;" +
      "background-size:2.6px 2.6px!important;background-repeat:repeat!important;}";
    document.head.appendChild(st);
  } catch (e) {
    // sem canvas: mantém as texturas em CSS
  }
}

// Monta, ajusta e gera o PDF; entrega pelo menu de compartilhar ou download
async function exportarDocumento(html, nome) {
  let cancelou = false;
  const f = Folhas.abrir({
    titulo: "Gerando o PDF…",
    html: `<p class="ajuda" data-info>Preparando as páginas…</p><div class="barra-progresso"><i data-barra></i></div>`,
  });
  f.aoFechar = () => (cancelou = true);
  let res;
  try {
    const palco = await prepararDocumento(html);
    if (cancelou) {
      palco.remove();
      return;
    }
    res = await rasterizar(
      palco,
      nome,
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
    f.definirTitulo("Não foi possível gerar o PDF");
    f.corpo.innerHTML = `<div class="aviso erro">${ic("circle-alert")}<div class="aviso-corpo">${esc((e && e.message) || String(e))}</div></div>`;
    return;
  }
  if (cancelou) return;
  const podeCompartilhar = !!(navigator.canShare && navigator.canShare({ files: [res.file] }));
  f.definirTitulo("PDF pronto");
  f.corpo.innerHTML = `
    ${res.previa ? `<div class="export-previa"><img src="${res.previa}" alt="Primeira página"></div>` : ""}
    <p class="peq texto-2" style="text-align:center;margin-bottom:16px">${esc(res.file.name)} · ${res.paginas} ${res.paginas === 1 ? "página" : "páginas"}</p>
    <div class="botoes-col">
      ${podeCompartilhar ? `<button type="button" class="bt bt-pri bt-largo" data-b="share">${ic("share-2")}Salvar ou enviar…</button>` : ""}
      <button type="button" class="bt ${podeCompartilhar ? "bt-sec" : "bt-pri"} bt-largo" data-b="baixar">${ic("download")}Baixar o PDF</button>
      <button type="button" class="bt bt-fan" data-b="imprimir">${ic("printer", "i-p")}Imprimir pelo navegador</button>
    </div>
    ${podeCompartilhar ? `<p class="ajuda" style="margin-top:12px;text-align:center">No iPhone, “Salvar ou enviar” abre o menu do sistema: Arquivos, AirDrop, WhatsApp ou e-mail.</p>` : ""}`;
  f.corpo.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-b]");
    if (!b) return;
    if (b.dataset.b === "share") {
      const r = await compartilharArquivo(res.file, res.file.name);
      if (r === "indisponivel") baixarBlob(res.file, res.file.name);
    } else if (b.dataset.b === "baixar") {
      baixarBlob(res.file, res.file.name);
    } else if (b.dataset.b === "imprimir") {
      f.fechar();
      imprimirPeloNavegador(nome);
    }
  });
}

function imprimirPeloNavegador(nome) {
  const original = document.title;
  document.title = nome;
  const restaura = () => {
    document.title = original;
    window.removeEventListener("afterprint", restaura);
  };
  window.addEventListener("afterprint", restaura);
  try {
    window.print();
  } catch (e) {}
  setTimeout(restaura, 1500);
}

// ---------------------------------------------------------------- Pontos de entrada

async function gerarPDFSondagem(id) {
  const reg = Dados.achar("sondagem", id);
  if (!reg) return;
  await exportarDocumento(await montarHTMLPerfil(reg), nomeArquivoSondagem(reg));
}

async function gerarPDFDiario(id) {
  const reg = Dados.achar("diario", id);
  if (!reg) return;
  await exportarDocumento(montarHTMLDiario(reg), nomeArquivoDiario(reg));
}

async function gerarPDFEnsaio(id) {
  const reg = Dados.achar("ensaios", id);
  if (!reg) return;
  await exportarDocumento(montarHTMLEnsaio(reg), nomeArquivoEnsaio(reg));
}

// Vários documentos num único PDF (cada um em suas páginas)
async function exportarPDFLote(tipo, ids) {
  const set = new Set(ids);
  if (!set.size) {
    toast("Selecione ao menos um registro", { icone: "info" });
    return;
  }
  const projetosDe = (sels) => [...new Set(sels.map((r) => r.projeto).filter(Boolean))];
  if (tipo === "sondagem") {
    const sels = Dados.lista("sondagem").filter((r) => set.has(r.id)).sort((a, b) => a.id - b.id);
    const partes = [];
    for (const r of sels) partes.push(await montarHTMLPerfil(r));
    const pj = projetosDe(sels);
    const base = pj.length === 1 ? sanitizarNome(pj[0]) + "_Sondagens" : "Sondagens";
    return exportarDocumento(partes.join(""), base + "_" + sels.length + "-boletins");
  }
  if (tipo === "diario") {
    const sels = Dados.lista("diario")
      .filter((r) => set.has(r.id))
      .sort((a, b) => (a.data || "").localeCompare(b.data || "") || a.id - b.id);
    const pj = projetosDe(sels);
    const base = pj.length === 1 ? "Diarios_" + sanitizarNome(pj[0]) : "Diarios";
    return exportarDocumento(sels.map(montarHTMLDiario).join(""), base + "_" + sels.length + "-dias");
  }
  const sels = Dados.lista("ensaios").filter((r) => set.has(r.id)).sort((a, b) => ordemNatural(a.idEnsaio, b.idEnsaio));
  const pj = projetosDe(sels);
  const base = pj.length === 1 ? sanitizarNome(pj[0]) + "_Ensaios" : "Ensaios";
  return exportarDocumento(sels.map(montarHTMLEnsaio).join(""), base + "_" + sels.length + "-permeabilidade");
}

async function exportarProjetoPDF(pid) {
  const p = projetoPorId(pid);
  if (!p) return;
  const sondagens = sondagensDoProjeto(p.id).sort((a, b) => ordemNatural(a.idSond, b.idSond));
  const diarios = diariosDoProjeto(p.id).sort((a, b) => (a.data || "").localeCompare(b.data || "") || a.id - b.id);
  const ensaios = ensaiosDoProjeto(p.id).sort((a, b) => ordemNatural(a.idEnsaio, b.idEnsaio));
  if (!sondagens.length && !diarios.length && !ensaios.length) {
    alerta("Este projeto ainda não tem boletins, ensaios nem diários para exportar.");
    return;
  }
  const partes = [montarCapaProjeto(p, sondagens, ensaios, diarios)];
  for (const r of sondagens) partes.push(await montarHTMLPerfil(r));
  ensaios.forEach((r) => partes.push(montarHTMLEnsaio(r)));
  diarios.forEach((r) => partes.push(montarHTMLDiario(r)));
  await exportarDocumento(partes.join(""), sanitizarNome(p.numero) + "_Relatorio-de-Campo");
}
