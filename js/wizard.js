/* =========================================================================
   Assistente de caracterização da camada: perguntas simples, uma por vez,
   que montam a descrição (para quem não é geólogo).
   ========================================================================= */
"use strict";

let wiz = null; // { i, stack: [], r: { extras: [] }, folha }

function abrirWizard(i) {
  if (!SD.camadas[i]) return;
  wiz = { i, stack: [], r: { extras: [] }, folha: null };
  wiz.folha = Folhas.abrir({
    titulo: "",
    classe: "alta",
    progresso: true,
    fecharNoVeu: false,
    rodape:
      `<button type="button" class="bt bt-sec" data-wiz="voltar">${ic("arrow-left", "i-p")}Voltar</button>` +
      `<button type="button" class="bt bt-fan" data-wiz="cancelar">Cancelar</button>`,
  });
  wiz.folha.aoVoltar = () => voltarStep();
  wiz.folha.aoFechar = () => {
    wiz = null;
  };
  wiz.folha.folha.querySelector('[data-wiz="voltar"]').addEventListener("click", () => voltarStep());
  wiz.folha.folha.querySelector('[data-wiz="cancelar"]').addEventListener("click", () => fecharWizard());
  irPara("prof");
}

function fecharWizard() {
  if (wiz && wiz.folha) wiz.folha.fechar(null);
  wiz = null;
}

function irPara(step) {
  wiz.stack.push(step);
  renderStep(step);
}

function voltarStep() {
  if (!wiz) return;
  if (wiz.stack.length > 1) {
    wiz.stack.pop();
    renderStep(wiz.stack[wiz.stack.length - 1]);
  } else {
    fecharWizard();
  }
}

function proxDepoisCor() {
  if (wiz.r.tipo === "pav" || wiz.r.tipo === "rocha") return "resumo";
  if (wiz.r.tipo === "residuo") return "extras";
  return "mosq";
}

function proxGranulometria() {
  // Areia dominante segue para formato/seleção dos grãos;
  // solo fino com fração arenosa volta para a consistência.
  return wiz.r.dominante === "areia" ? "arredondamento" : "consistencia";
}

function botaoContinuar(rotulo, aoClicar) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "bt bt-pri bt-largo";
  b.style.marginTop = "8px";
  b.innerHTML = esc(rotulo);
  b.addEventListener("click", aoClicar);
  return b;
}

function swatchGrid(cont, campo, nextFn) {
  const g = document.createElement("div");
  g.className = "amostras-cor";
  OPCOES_COR.forEach((nome) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "amostra-cor";
    b.innerHTML = `<i style="background:${COR_HEX[nome]}"></i><span>${esc(nome)}</span>`;
    b.addEventListener("click", () => {
      wiz.r[campo] = nome;
      irPara(nextFn());
    });
    g.appendChild(b);
  });
  cont.appendChild(g);
}

const STEPS = {
  prof: () => ({
    titulo: "Profundidade da camada",
    ajuda: "Informe o intervalo desta camada. Se ainda não souber o fim, deixe em branco e complete depois.",
    render(cont) {
      const c = SD.camadas[wiz.i];
      if (wiz.r.profDe === undefined) wiz.r.profDe = c.profDe || "";
      if (wiz.r.profAte === undefined) wiz.r.profAte = c.profAte || "";
      const grade = document.createElement("div");
      grade.className = "grade-2";
      const criar = (rotulo, chave) => {
        const d = document.createElement("div");
        d.className = "campo";
        d.innerHTML = `<label class="rotulo">${rotulo}</label>`;
        const inp = document.createElement("input");
        inp.className = "entrada num";
        inp.type = "number";
        inp.step = "0.01";
        inp.inputMode = "decimal";
        inp.value = wiz.r[chave] || "";
        inp.addEventListener("input", () => (wiz.r[chave] = inp.value));
        d.appendChild(inp);
        grade.appendChild(d);
        return inp;
      };
      criar("De (m)", "profDe");
      const ate = criar("Até (m)", "profAte");
      cont.appendChild(grade);
      cont.appendChild(botaoContinuar("Continuar", () => irPara("tipo")));
      if (wiz.r.profDe && !wiz.r.profAte) setTimeout(() => ate.focus(), 120);
    },
  }),

  tipo: () => ({
    titulo: "O que você está vendo?",
    ajuda: "Observe o material recuperado no liner ou trado e escolha a opção mais parecida.",
    opcoes: [
      { t: "Solo (natural ou aterro)", d: "Material terroso: argila, silte, areia ou mistura", set: { tipo: "solo" }, next: "genese" },
      { t: "Pavimento / piso", d: "Asfalto, concreto, bloquete, paralelepípedo", set: { tipo: "pav" }, next: "pavMaterial" },
      { t: "Rocha", d: "Material rochoso, alterado ou são", set: { tipo: "rocha" }, next: "rochaGrau" },
      { t: "Resíduo", d: "Entulho, resíduo industrial, doméstico ou misto", set: { tipo: "residuo" }, next: "residuoTipo" },
    ],
  }),

  pavMaterial: () => ({
    titulo: "Qual o tipo de pavimento?",
    opcoes: ["Asfalto", "Concreto", "Cimento", "Bloquete", "Paralelepípedo"].map((m) => ({
      t: m,
      set: { material: m, genese: "Pavimento" },
      next: "cor",
    })),
  }),

  rochaGrau: () => ({
    titulo: "Estado da rocha",
    opcoes: [
      { t: "Rocha alterada", d: "Quebradiça, descolorida, escava com dificuldade", set: { genese: "Rocha alterada" }, next: "rochaTipo" },
      { t: "Rocha fresca (sã)", d: "Dura, sem sinais de alteração", set: { genese: "Rocha fresca" }, next: "rochaTipo" },
    ],
  }),

  rochaTipo: () => ({
    titulo: "Se souber, qual o tipo rochoso?",
    ajuda: "Opcional — escolha “Não sei” sem problema; o geólogo revisa depois.",
    opcoes: [
      ...["Granito", "Gnaisse", "Basalto", "Diabásio", "Arenito", "Siltito", "Argilito"].map((m) => ({
        t: m,
        set: { material: m },
        next: "fraturas",
      })),
      { t: "Não sei", set: { material: "" }, next: "fraturas" },
    ],
  }),

  fraturas: () => ({
    titulo: "A rocha está fraturada?",
    opcoes: [
      { t: "Muito fraturada", d: "Sai em pedaços pequenos, cheia de trincas", set: { selecao: "Muito fraturada" }, next: "estruturaRocha" },
      { t: "Pouco fraturada", d: "Algumas trincas espaçadas", set: { selecao: "Pouco fraturada" }, next: "estruturaRocha" },
      { t: "Sem fraturas aparentes", set: { selecao: "Sem fraturas aparentes" }, next: "estruturaRocha" },
      { t: "Não sei", set: { selecao: "" }, next: "estruturaRocha" },
    ],
  }),

  estruturaRocha: () => ({
    titulo: "Como é a aparência interna da rocha?",
    opcoes: [
      { t: "Maciça / uniforme", d: "Sem faixas ou lâminas", set: { carac: "Compacta" }, next: "cor" },
      { t: "Com faixas / listras", d: "Bandas de cores ou minerais diferentes", set: { carac: "Bandada" }, next: "cor" },
      { t: "Em lâminas / folhas", d: "Se parte em placas finas", set: { carac: "Foliada" }, next: "cor" },
      { t: "Não sei", set: { carac: "" }, next: "cor" },
    ],
  }),

  residuoTipo: () => ({
    titulo: "Qual o tipo de resíduo?",
    opcoes: [
      { t: "Construção civil", d: "Entulho: tijolo, concreto, cerâmica, argamassa", set: { genese: "Resíduo de construção civil", material: "Entulho" }, next: "cor" },
      { t: "Industrial", d: "Borras, cinzas, escórias, material de processo", set: { genese: "Resíduo industrial", material: "" }, next: "cor" },
      { t: "Doméstico", d: "Lixo comum: plástico, papel, orgânicos", set: { genese: "Resíduo doméstico", material: "" }, next: "cor" },
      { t: "Diversos / misto", set: { genese: "Resíduos diversos", material: "" }, next: "cor" },
    ],
  }),

  genese: () => ({
    titulo: "Esse solo é natural ou aterro?",
    opcoes: [
      { t: "Aterro", d: "Material remexido: cores misturadas, restos de obra, lixo, plástico", set: { genese: "Aterro" }, next: "umidade" },
      { t: "Solo natural", d: "Aspecto homogêneo, sem material estranho", set: {}, next: "geneseNat" },
      { t: "Não sei", set: { genese: "" }, next: "umidade" },
    ],
  }),

  geneseNat: () => ({
    titulo: "Se souber, qual a origem do solo?",
    ajuda: "Opcional — escolha “Não sei” se tiver dúvida.",
    opcoes: [
      { t: "Alúvio", d: "Fundo de vale, margem de rio ou córrego", set: { genese: "Alúvio" }, next: "umidade" },
      { t: "Colúvio", d: "Sopé ou meia encosta; material transportado pela gravidade", set: { genese: "Colúvio" }, next: "umidade" },
      { t: "Solo de alteração de rocha", d: "Transição para a rocha; estrutura da rocha ainda visível", set: { genese: "SAR: Solo de alteração de rocha" }, next: "umidade" },
      { t: "Não sei", set: { genese: "" }, next: "umidade" },
    ],
  }),

  umidade: () => ({
    titulo: "Como está a umidade do material?",
    opcoes: [
      { t: "Seco", d: "Solto ou duro, sem sensação de umidade na mão", set: { umidade: "seco" }, next: "bola" },
      { t: "Úmido", d: "Sente umidade, mas não escorre água", set: { umidade: "umido" }, next: "bola" },
      { t: "Saturado", d: "Encharcado, com água livre visível", set: { umidade: "sat" }, next: "bola" },
    ],
  }),

  bola: () => ({
    titulo: "Teste da bolinha",
    ajuda: "Pegue um punhado do solo (umedeça um pouco se estiver seco) e aperte na mão tentando formar uma bola.",
    opcoes: [
      { t: "Forma uma bola firme", d: "O material dá liga e mantém a forma", set: { dominante: "fino" }, next: "rolinho" },
      { t: "Esfarela, não forma bola", d: "Os grãos se soltam, sem liga", set: { dominante: "areia" }, next: "finosAreia" },
    ],
  }),

  finosAreia: () => ({
    titulo: "Esfregue o material úmido entre os dedos",
    opcoes: [
      { t: "Limpa: grãos soltos", d: "Quase não suja os dedos", set: { material: "Areia" }, next: "granulometria" },
      { t: "Suja como farinha", d: "Deixa um pó fino, sensação sedosa", set: { material: "Areia siltosa" }, next: "granulometria" },
      { t: "Suja e gruda", d: "Forma uma pasta que adere aos dedos", set: { material: "Areia argilosa" }, next: "granulometria" },
    ],
  }),

  granulometria: () => ({
    titulo: wiz.r.dominante === "areia" ? "Qual o tamanho dos grãos?" : "Qual o tamanho dos grãos de areia que você sente?",
    ajuda: "Compare com referências do dia a dia.",
    opcoes: [
      { t: "Fina", d: "Como sal refinado; grãos quase invisíveis", set: { textura: "Fina" }, next: proxGranulometria },
      { t: "Média", d: "Como açúcar cristal", set: { textura: "Média" }, next: proxGranulometria },
      { t: "Grossa", d: "Grãos bem visíveis (1 a 2 mm)", set: { textura: "Grossa" }, next: proxGranulometria },
      { t: "Com pedrisco / cascalho", d: "Grãos maiores que 2 mm misturados", set: { textura: "Cascalho" }, next: proxGranulometria },
    ],
  }),

  arredondamento: () => ({
    titulo: "Formato dos grãos (se der pra ver)",
    ajuda: "Olhe de perto os grãos maiores.",
    opcoes: [
      { t: "Pontudos / quebrados", d: "Cantos vivos, como vidro moído", set: { carac: "Angular" }, next: "selecao" },
      { t: "Cantos um pouco gastos", set: { carac: "Sub angular" }, next: "selecao" },
      { t: "Quase redondos", set: { carac: "Sub arredondado" }, next: "selecao" },
      { t: "Bem redondinhos", d: "Lisos, como areia de praia", set: { carac: "Arredondado" }, next: "selecao" },
      { t: "Não dá pra ver", set: { carac: "" }, next: "selecao" },
    ],
  }),

  selecao: () => ({
    titulo: "Os grãos têm tamanhos parecidos?",
    opcoes: [
      { t: "Sim, bem uniformes", d: "Quase todos do mesmo tamanho", set: { selecao: "Bem selecionados" }, next: "compacidade" },
      { t: "Tamanhos variados", set: { selecao: "Mal selecionados" }, next: "compacidade" },
      { t: "Muito variados", d: "Do grão fino ao pedrisco, tudo misturado", set: { selecao: "Muito mal selecionados" }, next: "compacidade" },
      { t: "Não dá pra ver", set: { selecao: "" }, next: "compacidade" },
    ],
  }),

  compacidade: () => ({
    titulo: "Resistência à escavação / perfuração",
    opcoes: [
      { t: "Fofa", d: "Escava ou avança muito fácil", set: { estado: "fofa" }, next: "cor" },
      { t: "Medianamente compacta", d: "Resistência média", set: { estado: "medianamente compacta" }, next: "cor" },
      { t: "Compacta", d: "Difícil de escavar ou avançar", set: { estado: "compacta" }, next: "cor" },
    ],
  }),

  rolinho: () => ({
    titulo: "Teste do rolinho",
    ajuda:
      "Com o material úmido, role na palma da mão tentando formar um cilindro fino, de uns 3 mm (espessura de um palito de fósforo).",
    opcoes: [
      { t: "Rola fácil, sem quebrar", d: "Forma um cilindro fino e flexível", set: { plast: "alta" }, next: "tato" },
      { t: "Rola, mas trinca e quebra", d: "Forma o rolinho com dificuldade", set: { plast: "media" }, next: "tato" },
      { t: "Não consegue rolar", d: "Quebra antes de afinar", set: { plast: "baixa" }, next: "tato" },
    ],
  }),

  tato: () => ({
    titulo: "Esfregue entre os dedos: qual a sensação?",
    opcoes: [
      { t: "Áspero", d: "Sente grãos de areia raspando", set: { tato: "aspero" }, next: "granulometria" },
      { t: "Sedoso / farinhento", d: "Macio, como talco", set: { tato: "sedoso", textura: "Muito fina" }, next: "consistencia" },
      { t: "Liso e pegajoso", d: "Gruda nos dedos quando úmido", set: { tato: "liso", textura: "Muito fina" }, next: "consistencia" },
    ],
  }),

  consistencia: () => ({
    titulo: "Consistência (aperte com os dedos)",
    opcoes: [
      { t: "Muito mole", d: "Escorre entre os dedos ao apertar", set: { estado: "muito mole" }, next: "cor" },
      { t: "Mole", d: "Molda com leve pressão", set: { estado: "mole" }, next: "cor" },
      { t: "Média", d: "Molda com pressão firme", set: { estado: "média" }, next: "cor" },
      { t: "Rija", d: "Difícil de moldar; a unha deixa marca", set: { estado: "rija" }, next: "cor" },
      { t: "Dura", d: "Não molda com a mão", set: { estado: "dura" }, next: "cor" },
    ],
  }),

  cor: () => ({
    titulo: "Qual a cor predominante?",
    render(cont) {
      swatchGrid(cont, "cor", proxDepoisCor);
    },
  }),

  mosq: () => ({
    titulo: "Tem manchas / mosqueado de outra cor?",
    opcoes: [
      { t: "Não", set: { cor2: "" }, next: "extras" },
      { t: "Sim", set: {}, next: "cor2" },
    ],
  }),

  cor2: () => ({
    titulo: "Qual a cor das manchas?",
    render(cont) {
      swatchGrid(cont, "cor2", () => "extras");
    },
  }),

  extras: () => ({
    titulo: "Algum destes indícios?",
    ajuda: "Toque em tudo que se aplica — importante para indícios de contaminação.",
    render(cont) {
      const itens = ["Matéria orgânica", "Raízes", "Odor perceptível", "Oleosidade / brilho iridescente", "Fragmentos de entulho", "Concreções"];
      const wrap = document.createElement("div");
      wrap.className = "chips";
      itens.forEach((it) => {
        const c = document.createElement("button");
        c.type = "button";
        c.className = "chip";
        c.setAttribute("aria-pressed", String(wiz.r.extras.indexOf(it) >= 0));
        c.textContent = it;
        c.addEventListener("click", () => {
          const i = wiz.r.extras.indexOf(it);
          if (i >= 0) wiz.r.extras.splice(i, 1);
          else wiz.r.extras.push(it);
          c.setAttribute("aria-pressed", String(i < 0));
        });
        wrap.appendChild(c);
      });
      cont.appendChild(wrap);

      const t2 = document.createElement("div");
      t2.className = "subtitulo-folha";
      t2.textContent = "Condição da amostra ou do avanço (opcional)";
      cont.appendChild(t2);

      if (wiz.r.obsAmostra === undefined && wiz.r.plast === "alta") wiz.r.obsAmostra = "Plástico";
      let condItens = ["Friável", "Plástico", "Pastilhado", "Pastoso", "Sem recuperação", "Impenetrável"];
      if (wiz.r.tipo === "residuo") condItens = condItens.concat(["Líquido", "Sólido", "Inflamável"]);
      const wrap2 = document.createElement("div");
      wrap2.className = "chips";
      condItens.forEach((it) => {
        const c = document.createElement("button");
        c.type = "button";
        c.className = "chip";
        c.setAttribute("aria-pressed", String(wiz.r.obsAmostra === it));
        c.textContent = it;
        c.addEventListener("click", () => {
          wiz.r.obsAmostra = wiz.r.obsAmostra === it ? "" : it;
          wrap2.querySelectorAll(".chip").forEach((x) => x.setAttribute("aria-pressed", "false"));
          if (wiz.r.obsAmostra === it) c.setAttribute("aria-pressed", "true");
        });
        wrap2.appendChild(c);
      });
      cont.appendChild(wrap2);

      const ta = document.createElement("textarea");
      ta.className = "entrada";
      ta.style.marginTop = "16px";
      ta.rows = 3;
      ta.placeholder = "Outras observações (opcional)";
      ta.value = wiz.r.nota || "";
      ta.addEventListener("input", () => (wiz.r.nota = ta.value.trim()));
      cont.appendChild(ta);
      cont.appendChild(botaoContinuar("Continuar", () => irPara("resumo")));
    },
  }),

  resumo: () => {
    const res = montarResumo(wiz.r);
    return {
      titulo: "Confira a caracterização",
      ajuda: "Revise o texto gerado. Depois de aplicar, você ainda pode editar a descrição da camada.",
      render(cont) {
        const box = document.createElement("div");
        box.className = "resumo-wiz";
        const profTxt =
          wiz.r.profDe && wiz.r.profAte ? `<div class="mini texto-3">Prof.: ${esc(fmtDec(wiz.r.profDe))} – ${esc(fmtDec(wiz.r.profAte))} m</div>` : "";
        box.innerHTML = profTxt + (res.material ? `<strong>${esc(res.material)}</strong>` : "") + esc(res.desc);
        cont.appendChild(box);
        cont.appendChild(botaoContinuar("Aplicar à camada", aplicarWizard));
      },
    };
  },
};

function renderStep(id) {
  const def = STEPS[id]();
  const f = wiz.folha;
  f.definirTitulo(def.titulo);
  const barra = f.folha.querySelector(".wiz-progresso i");
  if (barra) barra.style.width = Math.min(100, (wiz.stack.length / 10) * 100) + "%";
  const cont = f.corpo;
  cont.innerHTML = def.ajuda ? `<p class="wiz-ajuda">${esc(def.ajuda)}</p>` : "";
  if (def.opcoes) {
    def.opcoes.forEach((o) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "wiz-opcao";
      b.innerHTML = `<strong>${esc(o.t)}</strong>` + (o.d ? `<span>${esc(o.d)}</span>` : "");
      b.addEventListener("click", () => {
        // Evita estado "fantasma" ao voltar e trocar de caminho
        if (id === "tipo") {
          wiz.r = { extras: [], profDe: wiz.r.profDe, profAte: wiz.r.profAte };
        } else if (id === "bola") {
          wiz.r.material = "";
          wiz.r.textura = "";
          wiz.r.carac = "";
          wiz.r.selecao = "";
          wiz.r.plast = "";
          wiz.r.tato = "";
          wiz.r.estado = "";
        }
        Object.assign(wiz.r, o.set || {});
        irPara(typeof o.next === "function" ? o.next() : o.next);
      });
      cont.appendChild(b);
    });
  }
  if (def.render) def.render(cont);
  cont.scrollTop = 0;
  const voltar = f.folha.querySelector('[data-wiz="voltar"]');
  if (voltar) voltar.innerHTML = ic(wiz.stack.length > 1 ? "arrow-left" : "x", "i-p") + (wiz.stack.length > 1 ? "Voltar" : "Fechar");
}

function montarResumo(r) {
  let material = r.material || "";

  // Solo coesivo: combina plasticidade (rolinho) + sensação ao tato
  if (r.tipo === "solo" && !material && r.plast && r.tato) {
    const matriz = {
      alta: { aspero: "Argila arenosa", sedoso: "Argila siltosa", liso: "Argila" },
      media: { aspero: "Argila arenosa", sedoso: "Silte argiloso", liso: "Argila siltosa" },
      baixa: { aspero: "Silte arenoso", sedoso: "Silte", liso: "Silte argiloso" },
    };
    material = matriz[r.plast][r.tato];
  }

  const lead = material || (r.tipo === "rocha" || r.tipo === "residuo" ? r.genese : "");

  const masc = /^(Silte|Cascalho|Asfalto|Concreto|Cimento|Bloquete|Paralelepípedo|Entulho|Granito|Gnaisse|Basalto|Diabásio|Arenito|Siltito|Argilito|Resíduo)/.test(
    lead || ""
  );

  const parts = [];
  if (lead) {
    let l = lead;
    if (r.textura && r.dominante === "areia") l += " " + r.textura.toLowerCase();
    parts.push(l);
  }

  if (r.tipo === "solo") {
    if (r.dominante !== "areia" && r.tato === "aspero" && r.textura) parts.push("com areia " + r.textura.toLowerCase());
    const g = [];
    if (r.carac) {
      const plural = {
        "Angular": "angulares",
        "Sub angular": "sub angulares",
        "Sub arredondado": "sub arredondados",
        "Arredondado": "arredondados",
        "Bem arredondado": "bem arredondados",
      };
      g.push(plural[r.carac] || r.carac.toLowerCase());
    }
    if (r.selecao) g.push(r.selecao.toLowerCase());
    if (g.length) parts.push("grãos " + g.join(", "));
  }

  if (r.tipo === "rocha") {
    if (r.carac) parts.push("estrutura " + r.carac.toLowerCase());
    const f = {
      "Muito fraturada": "com muitas fraturas",
      "Pouco fraturada": "com poucas fraturas",
      "Sem fraturas aparentes": "sem fraturas aparentes",
    };
    if (r.selecao && f[r.selecao]) parts.push(f[r.selecao]);
  }

  let corTxt = r.cor ? r.cor.toLowerCase() : "";
  if (corTxt && r.cor2) corTxt += " com manchas na cor " + r.cor2.toLowerCase();
  if (corTxt) parts.push(corTxt);

  if (r.plast) parts.push("plasticidade " + { alta: "alta", media: "média", baixa: "baixa" }[r.plast]);

  if (r.estado) {
    if (r.dominante === "areia") parts.push(r.estado); // fofa / medianamente compacta / compacta
    else parts.push("consistência " + r.estado);
  }

  if (r.umidade) {
    const u = {
      seco: masc ? "seco" : "seca",
      umido: masc ? "úmido" : "úmida",
      sat: masc ? "saturado" : "saturada",
    };
    parts.push(u[r.umidade]);
  }

  let desc = parts.join(", ");
  const ex = r.extras || [];
  if (ex.length) desc += (desc ? ", " : "") + "com " + listaPt(ex.map((e) => e.toLowerCase()));
  if (desc) desc += ".";
  if (r.obsAmostra && r.obsAmostra !== "Plástico") desc += (desc ? " " : "") + "Amostra: " + r.obsAmostra.toLowerCase() + ".";
  if (r.nota) desc += (desc ? " " : "") + r.nota;

  return { material, desc };
}

function aplicarWizard() {
  const res = montarResumo(wiz.r);
  const r = wiz.r;
  const i = wiz.i;
  const c = SD.camadas[i];
  if (!c) return fecharWizard();
  if (r.profDe !== undefined && r.profDe !== "") c.profDe = r.profDe;
  if (r.profAte !== undefined && r.profAte !== "") c.profAte = r.profAte;
  if (res.material) c.material = res.material;
  if (r.cor) c.cor = r.cor;
  if (r.genese) c.genese = r.genese;
  if (r.textura) c.textura = r.textura;
  if (r.carac) c.caracteristicas = r.carac;
  if (r.selecao) c.grauSelecao = r.selecao;
  if (r.obsAmostra) c.obsExtras = r.obsAmostra;
  c.descricao = res.desc;
  fecharWizard();
  SD.abertas.add(i);
  renderCamada(i);
  atualizarCabecalhoCamada(i);
  atualizarPerfilVivo();
  atualizarSugestaoProf();
  autoSond.agendar();
  toast("Camada " + (i + 1) + " caracterizada");
}
