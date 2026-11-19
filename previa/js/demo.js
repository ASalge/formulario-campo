/* =========================================================================
   Prévia: dados de demonstração e situações simuladas para o assistente.
   Clientes, pessoas de contato e projetos são fictícios.
   ========================================================================= */
"use strict";

// Data (ISO) somando dias a outra data
function somarDiasA(iso, n) {
  const d = isoParaData(iso) || hoje0();
  d.setDate(d.getDate() + n);
  return dataParaISO(d);
}

// Próxima ocorrência do dia do mês (ex.: "dia 5"), a partir de amanhã
function proximoDiaDoMes(dia, aPartirDe) {
  const d = aPartirDe ? isoParaData(aPartirDe) : hoje0();
  d.setDate(d.getDate() + 1);
  while (d.getDate() !== dia) d.setDate(d.getDate() + 1);
  return dataParaISO(d);
}

function ddmm(iso) {
  const p = partesData(iso);
  return p ? pad2(p.dia) + "/" + pad2(p.mes) : "";
}

const CENARIOS_DEMO = [
  {
    id: "grupo-cliente",
    rotulo: "Cliente pede algo no grupo do projeto",
    detalhe: "WhatsApp · grupo P902 · Logística Beta",
    canal: "whatsapp",
    conversa: "P902 · Logística Beta",
    contexto: "Grupo do projeto · o número comercial participa",
    mensagens: [
      { autor: "Maíra", equipe: true, texto: "Pessoal, o laboratório liberou hoje os laudos do P902." },
      { autor: "Rodrigo (Logística Beta)", texto: "Ótimo! Conseguem me mandar o relatório preliminar até sexta?", destaque: "relatório preliminar até sexta" },
      { autor: "Arthur", equipe: true, texto: "Consigo sim, Rodrigo. Mando até sexta à tarde.", destaque: "Mando até sexta à tarde" },
    ],
    leitura: "O cliente pediu o relatório preliminar e o Arthur assumiu o envio até sexta.",
    tarefas: [
      {
        titulo: "Enviar o relatório preliminar do P902 ao cliente",
        responsavel: "arthur",
        prazo: () => proximoDiaSemana(5, true),
        prazoTexto: "“até sexta à tarde”",
        projeto: "P902",
        confianca: "alta",
        porque: "Se comprometeu na conversa",
      },
    ],
  },
  {
    id: "socios",
    rotulo: "Combinado entre sócios",
    detalhe: "WhatsApp · grupo Sócios Archipel",
    canal: "whatsapp",
    conversa: "Sócios Archipel",
    contexto: "Grupo interno · o número comercial participa",
    mensagens: [
      {
        autor: "Amauri",
        equipe: true,
        texto: "Tiago, consegue revisar a proposta de Fase II da Incorporadora Gama até quarta? Queria enviar na quinta cedo.",
        destaque: "revisar a proposta de Fase II da Incorporadora Gama até quarta",
      },
      { autor: "Tiago", equipe: true, texto: "Fechado, reviso até quarta.", destaque: "reviso até quarta" },
      { autor: "Amauri", equipe: true, texto: "Perfeito. Aí eu mando para o cliente na quinta.", destaque: "eu mando para o cliente na quinta" },
    ],
    leitura: "Dois compromissos: o Tiago revisa a proposta até quarta e o Amauri envia ao cliente na quinta.",
    tarefas: [
      {
        titulo: "Revisar a proposta de Fase II da Incorporadora Gama",
        responsavel: "tiago",
        prazo: () => proximoDiaSemana(3, true),
        prazoTexto: "“até quarta”",
        projeto: "P903",
        confianca: "alta",
        porque: "Confirmou na conversa",
      },
      {
        titulo: "Enviar a proposta de Fase II à Incorporadora Gama",
        responsavel: "amauri",
        prazo: () => somarDiasA(proximoDiaSemana(3, true), 1),
        prazoTexto: "“na quinta”, depois da revisão",
        projeto: "P903",
        confianca: "alta",
        porque: "Assumiu o envio na conversa",
      },
    ],
  },
  {
    id: "email-cliente",
    rotulo: "E-mail de cliente com pedidos e datas",
    detalhe: "E-mail · caixa de entrada do Ralf",
    canal: "email",
    conversa: "Indústria Alfa",
    contexto: "Caixa de entrada do Ralf",
    para: "Ralf (Archipel)",
    assunto: "Fase I da unidade Sorocaba",
    mensagens: [
      {
        autor: "Fernanda Lima · Indústria Alfa",
        texto:
          "Olá, Ralf.\n\nSeguem em anexo a matrícula e as plantas da unidade Sorocaba. As licenças de operação eu envio até o dia 5.\n\nVocês conseguem fazer a vistoria na semana do dia 8? Preciso confirmar a data com a portaria até segunda.\n\nAbraço,\nFernanda",
        destaque: ["licenças de operação eu envio até o dia 5", "vistoria na semana do dia 8", "confirmar a data com a portaria até segunda"],
      },
    ],
    leitura: "A cliente quer a vistoria na semana do dia 8 e precisa da data até segunda. As licenças chegam até o dia 5.",
    tarefas: [
      {
        titulo: "Confirmar com a Indústria Alfa a data da vistoria em Sorocaba",
        responsavel: "ralf",
        prazo: () => proximoDiaSemana(1),
        prazoTexto: "“até segunda”, para a semana do dia 8",
        confianca: "alta",
        porque: "E-mail dirigido a ele",
        cliente: "Indústria Alfa",
      },
      {
        titulo: "Cobrar as licenças de operação da Indústria Alfa, se não chegarem",
        responsavel: "ralf",
        prazo: () => somarDiasA(proximoDiaDoMes(5), 1),
        prazoTexto: "a cliente envia “até o dia 5”",
        confianca: "média",
        porque: "Acompanhamento sugerido",
        cliente: "Indústria Alfa",
      },
    ],
  },
  {
    id: "lead",
    rotulo: "Novo contato no WhatsApp comercial",
    detalhe: "WhatsApp · conversa privada",
    canal: "whatsapp",
    conversa: "Construtora Delta (novo contato)",
    contexto: "Conversa privada com o número comercial",
    mensagens: [
      {
        autor: "Paulo · Construtora Delta",
        texto: "Boa tarde! Precisamos de uma avaliação preliminar de um terreno em Osasco antes de fechar a compra. Vocês fazem? Qual seria o prazo?",
        destaque: ["avaliação preliminar de um terreno em Osasco", "Qual seria o prazo?"],
      },
    ],
    leitura: "Cliente novo pedindo proposta de Fase I. Pela regra da equipe, novos contatos vão para o Amauri, com resposta no mesmo dia.",
    tarefas: [
      {
        titulo: "Responder a Construtora Delta: Fase I de terreno em Osasco",
        responsavel: "amauri",
        prazo: () => somarDias(0),
        prazoTexto: "regra da equipe: responder novo contato no mesmo dia",
        confianca: "média",
        porque: "Regra: novos contatos vão para ele",
        cliente: "Construtora Delta",
      },
    ],
  },
];

// ---------------------------------------------------------------- Dados de demonstração

function camadaDemo(de, ate, material, cor, genese, textura, extra = {}) {
  return Object.assign(
    {
      profDe: String(de),
      profAte: String(ate),
      material,
      cor,
      genese,
      textura,
      caracteristicas: "",
      grauSelecao: "",
      obsExtras: "",
      descricao: "",
      houveAmostra: false,
      intervaloAmostra: "",
    },
    extra
  );
}

function vocsDemo(prof, base, pico) {
  const out = [];
  for (let p = 0.5; p <= prof + 0.001; p += 0.5) {
    const v = pico && Math.abs(p - pico.prof) < 0.8 ? pico.valor * (1 - Math.abs(p - pico.prof) / 1.2) : base * (0.5 + Math.random());
    out.push({ profundidade: p.toFixed(1), valor: v.toFixed(1) });
  }
  return out;
}

function carregarDemo() {
  const agora = Date.now();
  const dia = 86400000;
  let seq = 0;
  const id = (t) => Math.round(t) + seq++;

  const pj = (numero, cliente, local, extra) =>
    Object.assign({ id: id(agora - 20 * dia), numero, cliente, local, empresa: "", qtdSond: 0, qtdPocos: 0, qtdEns: 0 }, extra);
  const p1 = pj("P901", "Indústria Alfa", "Jundiaí – SP", { empresa: "Sondagens Exemplo", qtdSond: 6, qtdPocos: 3, qtdEns: 2 });
  const p2 = pj("P902", "Logística Beta", "Cajamar – SP", { empresa: "Sondagens Exemplo", qtdSond: 4, qtdPocos: 2 });
  const p3 = pj("P903", "Incorporadora Gama", "Rua das Palmeiras, 1200 · São Paulo – SP");
  const projetos = [p1, p2, p3];

  // Sondagens
  const sond = [];
  const st = (p, nome, data, prof, na, camadas, extra = {}) =>
    sond.push(
      Object.assign(
        {
          id: id(isoParaData(data).getTime() + 9 * 3600000),
          projetoId: p.id,
          projeto: p.numero,
          empresa: p.empresa,
          local: p.local,
          lat: "",
          lon: "",
          idSond: nome,
          data,
          profFinal: String(prof),
          nivelAgua: na ? String(na) : "",
          obs: "",
          camadas,
          vocs: vocsDemo(prof, 0.3, extra.pico),
          poco: null,
          liner: null,
          fotos: [],
        },
        extra.reg || {}
      )
    );
  const d1 = somarDias(-6);
  const d2 = somarDias(-5);
  st(p1, "ST-01", d1, 6, 4.2, [
    camadaDemo(0, 0.15, "Concreto", "Cinza clara", "Pavimento", ""),
    camadaDemo(0.15, 1.2, "Areia argilosa", "Marrom", "Aterro", "Média", { obsExtras: "Friável", houveAmostra: true, intervaloAmostra: "0,5-0,8 m" }),
    camadaDemo(1.2, 3.8, "Argila siltosa", "Avermelhada", "Elúvio", "Muito fina"),
    camadaDemo(3.8, 6, "Silte argiloso", "Amarela", "SAR: Solo de alteração de rocha", "Fina", { houveAmostra: true, intervaloAmostra: "4,0-4,3 m" }),
  ], { reg: { poco: { id: "PM-01", prof: "6.0", filtro: "3.0", prefiltro: "3.5", naInst: "4.2", naEstab: "4.1" } } });
  st(p1, "ST-02", d1, 5, 3.9, [
    camadaDemo(0, 0.1, "Asfalto", "Preta", "Pavimento", ""),
    camadaDemo(0.1, 1.6, "Areia siltosa", "Marrom escura", "Aterro", "Fina", { obsExtras: "Plástico" }),
    camadaDemo(1.6, 5, "Argila arenosa", "Marrom clara", "Colúvio", "Fina média", { houveAmostra: true, intervaloAmostra: "3,5-3,8 m" }),
  ], { pico: { prof: 2, valor: 38.5 } });
  st(p1, "ST-03", d2, 7, 4.6, [
    camadaDemo(0, 0.2, "Concreto", "Cinza clara", "Pavimento", ""),
    camadaDemo(0.2, 2.4, "Entulho", "Cinza escura", "Resíduo de construção civil", "", { caracteristicas: "Angular" }),
    camadaDemo(2.4, 4.9, "Argila siltosa", "Avermelhada", "Elúvio", "Muito fina"),
    camadaDemo(4.9, 7, "Silte arenoso", "Amarelo-avermelhada", "SAR: Solo de alteração de rocha", "Média", { houveAmostra: true, intervaloAmostra: "5,0-5,3 m" }),
  ], { reg: { poco: { id: "PM-02", prof: "7.0", filtro: "3.0", prefiltro: "3.5", naInst: "4.6", naEstab: "4.5" } } });
  st(p1, "ST-04", d2, 4, "", [
    camadaDemo(0, 0.6, "Areia argilosa", "Marrom", "Aterro", "Média"),
    camadaDemo(0.6, 4, "Argila", "Vermelha", "Elúvio", "Muito fina", { obsExtras: "Plástico" }),
  ]);
  const d3 = somarDias(-15);
  ["ST-01", "ST-02", "ST-03", "ST-04"].forEach((nome, i) =>
    st(p2, nome, d3, 5 + (i % 2), 3.5 + i * 0.2, [
      camadaDemo(0, 0.3, "Brita", "Cinza clara", "Aterro", "Grossa"),
      camadaDemo(0.3, 2.2, "Silte argiloso", "Marrom", "Colúvio", "Fina"),
      camadaDemo(2.2, 5 + (i % 2), "Argila siltosa", "Amarela", "Elúvio", "Muito fina", { houveAmostra: true, intervaloAmostra: "3,0-3,3 m" }),
    ], i < 2 ? { reg: { poco: { id: "PM-0" + (i + 1), prof: String(5 + (i % 2)), filtro: "3.0", prefiltro: "3.5", naInst: "", naEstab: "" } } } : {})
  );

  // Diários
  const diarios = [d1, d2].map((data, i) => ({
    id: id(isoParaData(data).getTime() + 17 * 3600000),
    projetoId: p1.id,
    projeto: p1.numero,
    cliente: p1.cliente,
    local: p1.local,
    data,
    horario: "07:40 - 16:50",
    clima: i ? "Nublado" : "Ensolarado",
    atividades:
      i === 0
        ? "07h40: Chegada ao site\n08h05: Início da sondagem ST-01\n10h20: Instalação do PM-01\n11h50: Parada para almoço\n13h00: Início da sondagem ST-02\n15h30: Fim da sondagem ST-02\n16h50: Saída do site"
        : "07h45: Chegada ao site\n08h10: Início da sondagem ST-03\n11h15: Instalação do PM-02\n13h05: Início da sondagem ST-04\n15h40: Coleta e organização das amostras\n16h40: Saída do site",
    observacoes: "",
    responsavel: "Arthur",
    auxiliares: "Sondagens Exemplo",
  }));

  // Auditoria em andamento (Fase I · CETESB)
  if (!Dados.config.equipe.responsavel) Dados.config.equipe = { responsavel: "Arthur", auxiliares: "" };
  const aud = criarAuditoriaDemo(p3, agora - 2 * dia);

  // Tarefas
  const t = (dados, criadoHa) => {
    const tf = novaTarefaObj(Object.assign({ id: id(agora - criadoHa * dia) }, dados));
    tf.criadoEm = agora - criadoHa * dia;
    tf.atualizadoEm = tf.criadoEm;
    const p = projetos.find((x) => x.numero === tf.projeto);
    tf.projetoId = p ? p.id : null;
    if (tf.origem.canal !== "app") registrarHistorico(tf, "Sugerida pelo assistente a partir de " + CANAIS[tf.origem.canal].nome + " · " + tf.origem.conversa);
    else registrarHistorico(tf, "Criada por " + nomePessoa(tf.criadoPor));
    tf.historico[0].ts = tf.criadoEm;
    if (tf.origem.canal !== "app") tf.historico.push({ ts: tf.criadoEm + 600000, texto: "Confirmada por " + nomePessoa(tf.responsavel) });
    return tf;
  };
  const wa = (conversa, trechos, leitura, extra = {}) =>
    Object.assign({ canal: "whatsapp", conversa, trechos, leitura, data: agora - 2 * dia }, extra);
  const tarefas = [
    t({ titulo: "Revisar os boletins de sondagem do P901", responsavel: "arthur", prazo: somarDias(0), projeto: "P901" }, 3),
    t(
      {
        titulo: "Enviar a cadeia de custódia das amostras do P901 ao laboratório",
        responsavel: "arthur",
        criadoPor: "claude",
        prazo: somarDias(-1),
        projeto: "P901",
        confianca: "alta",
        origem: wa(
          "P901 · Indústria Alfa",
          [
            { autor: "Maíra", texto: "Arthur, o laboratório pediu a cadeia de custódia das amostras do P901." },
            { autor: "Arthur", texto: "Mando amanhã cedo." },
          ],
          "O Arthur assumiu o envio da cadeia de custódia para o dia seguinte.",
          { porque: "Se comprometeu na conversa", prazoTexto: "“amanhã cedo”" }
        ),
      },
      2
    ),
    t({ titulo: "Preparar a apresentação da reunião anual", responsavel: "arthur", prazo: proximoDiaSemana(2, true) }, 6),
    t(
      {
        titulo: "Renovar a calibração do PID antes do próximo campo",
        responsavel: "arthur",
        criadoPor: "claude",
        prazo: somarDias(6),
        confianca: "alta",
        origem: {
          canal: "email",
          conversa: "EquipaLoc (locação de equipamentos)",
          assunto: "Calibração do PID",
          data: agora - dia,
          trechos: [{ autor: "EquipaLoc", texto: "O certificado de calibração do PID vence no dia " + ddmm(somarDias(7)) + ". Podemos agendar a recalibração?" }],
          leitura: "Prazo de calibração do equipamento; o PID fica com quem coordena o campo.",
          porque: "Responsável pelos equipamentos de campo",
          prazoTexto: "um dia antes do vencimento",
        },
      },
      1
    ),
    t({ titulo: "Conferir os laudos do laboratório do P902", responsavel: "maira", prazo: somarDias(1), projeto: "P902" }, 2),
    t({ titulo: "Atualizar o modelo conceitual do P902", responsavel: "maira", prazo: somarDias(5), projeto: "P902" }, 4),
    t(
      {
        titulo: "Enviar a proposta de monitoramento à Logística Beta",
        responsavel: "amauri",
        criadoPor: "claude",
        prazo: somarDias(3),
        projeto: "P902",
        confianca: "alta",
        origem: {
          canal: "email",
          conversa: "Logística Beta",
          assunto: "Proposta de monitoramento",
          data: agora - 3 * dia,
          trechos: [{ autor: "Rodrigo (Logística Beta)", texto: "Amauri, pode nos enviar a proposta de monitoramento trimestral até o fim da semana que vem?" }],
          leitura: "O cliente pediu a proposta ao Amauri.",
          porque: "Pedido dirigido a ele",
          prazoTexto: "“até o fim da semana que vem”",
        },
      },
      3
    ),
    t({ titulo: "Agendar a sondagem complementar do P901", responsavel: "ralf", prazo: somarDias(2), projeto: "P901" }, 2),
    t({ titulo: "Revisar o roteiro de Fase I (modelo CETESB) do app", responsavel: "tiago", prazo: somarDias(4) }, 1),
  ];
  const feita = t({ titulo: "Mobilizar a equipe de sondagem do P901", responsavel: "arthur", prazo: somarDias(-7), projeto: "P901" }, 9);
  feita.status = "concluida";
  feita.concluidoEm = agora - 7 * dia;
  feita.historico.push({ ts: feita.concluidoEm, texto: "Concluída por Arthur" });
  tarefas.push(feita);

  // Mensagens já lidas pelo assistente
  const mensagens = tarefas
    .filter((x) => x.origem && x.origem.canal !== "app")
    .map((x, i) => ({
      id: id(x.criadoEm - 60000),
      canal: x.origem.canal,
      conversa: x.origem.conversa,
      assunto: x.origem.assunto || "",
      recebidaEm: x.criadoEm - 60000,
      mensagens: x.origem.trechos,
      leitura: x.origem.leitura,
      tarefas: [x.id],
    }));
  mensagens.push({
    id: id(agora - 4 * dia),
    canal: "whatsapp",
    conversa: "P903 · Incorporadora Gama",
    recebidaEm: agora - 4 * dia,
    mensagens: [{ autor: "Carla (Incorporadora Gama)", texto: "Obrigada pela visita de ontem! Qualquer dúvida estou à disposição." }],
    leitura: "Agradecimento, sem pedido ou prazo. Nenhuma tarefa.",
    tarefas: [],
  });

  Dados.gravar("projetos", projetos);
  Dados.gravar("sondagem", sond);
  Dados.gravar("diario", diarios);
  Dados.gravar("ensaios", []);
  Dados.gravar("auditorias", [aud]);
  Dados.gravar("tarefas", tarefas);
  Dados.gravar("mensagens", mensagens);
  Dados.config.pessoas = clonar(PESSOAS_PADRAO);
  Dados.config.eu = "arthur";
  Dados.config.ultimoResumo = null;
  if (!Dados.config.equipe.responsavel) Dados.config.equipe = { responsavel: "Arthur", auxiliares: "" };
  Dados.salvarConfig();
}

function criarAuditoriaDemo(p, quando) {
  const reg = criarAuditoria("ap-cetesb", p);
  const r = reg.respostas;
  Object.assign(r, {
    "identificacao.endereco": "Rua das Palmeiras, 1200 · Vila Exemplo · São Paulo – SP",
    "identificacao.matricula": "Matrícula 00.000 · 9º Registro de Imóveis (fictício)",
    "identificacao.area_terreno": "4850",
    "identificacao.area_construida": "2100",
    "identificacao.coord": { lat: -23.52731, lon: -46.68412, prec: 6 },
    "vistoria.data": somarDias(-5),
    "vistoria.acompanhante": "Carla Souza · gerente de projetos da Incorporadora Gama",
    "vistoria.entrevistas":
      "Sr. João (zelador, 12 anos no local): a área foi uma gráfica até 2015; depois, depósito de materiais de construção até 2023. Não se lembra de vazamentos.",
    "uso_atual.atividade": "Galpão desocupado; uso anterior como depósito (CNAE 4744-0)",
    "uso_atual.ocupacao": "Sem uso",
    "uso_atual.insumos": "Nenhum produto armazenado no momento da vistoria. Restos de tintas e solventes em latas no fundo do galpão.",
    "uso_atual.possui_tanques": { v: "sim", obs: "Um tanque aéreo de diesel, desativado, junto ao antigo gerador." },
    "uso_atual.possui_fontes": { v: "sim" },
    "historico.usos_anteriores":
      "Gráfica (c. 1985–2015, segundo entrevista e imagens aéreas); depósito de materiais de construção (2016–2023).",
    "historico.inicio": "c. 1985",
    "historico.imagens": { v: "solicitado", obs: "Pedido de imagens históricas feito em " + dataBR(somarDias(-4)) },
    "historico.aterros": { v: "nao" },
    "historico.acidentes": { v: "nao", obs: "Segundo o zelador" },
  });
  reg.blocos.fontes = [
    {
      _id: "b1",
      r: {
        tipo: "Oficina / manutenção / lavagem",
        descricao: "Antiga área de impressão e limpeza de chapas",
        substancias: "Solventes (tolueno, xileno), tintas",
        piso: "Impermeabilizado com fissuras",
        contencao: { v: "nao" },
        indicios: ["Manchas no piso ou solo", "Odor"],
      },
    },
    {
      _id: "b2",
      r: {
        tipo: "Armazenamento de resíduos",
        descricao: "Fundo do galpão, latas de tinta e solventes",
        substancias: "Restos de tintas e solventes",
        piso: "Impermeabilizado íntegro",
        contencao: { v: "nao" },
        indicios: ["Manchas no piso ou solo"],
      },
    },
  ];
  reg.blocos.tanques = [
    {
      _id: "b3",
      r: { identificacao: "TQ-01 · gerador", tipo: "Aéreo", produto: "Óleo diesel", capacidade: "1", instalacao: "c. 2005", situacao: "Desativado", contencao: { v: "nao" } },
    },
  ];
  reg.data = somarDias(-5);
  reg.equipe = "Arthur, Ralf";
  reg.criadoEm = quando;
  reg.atualizadoEm = quando;
  return reg;
}

function apagarDadosPrevia() {
  const ids = [];
  Dados.lista("sondagem").forEach((r) => (r.fotos || []).forEach((f) => ids.push(f.id)));
  Dados.lista("auditorias").forEach((r) => Object.values(r.fotos || {}).forEach((l) => (l || []).forEach((f) => ids.push(f.id))));
  ids.forEach((id) => Dados.fotoRemover(id));
  Object.keys(CHAVES).forEach((tipo) => Dados.gravar(tipo, []));
  Dados.rascunhos = {};
  Dados.persistirRascunhos();
  Dados.config = clonar(CONFIG_PADRAO);
  Dados.salvarConfig();
}

// ---------------------------------------------------------------- Interface da prévia

function renderPreviaInicio() {
  const el = document.getElementById("ini-previa");
  if (!el) return;
  const vazio = !Dados.lista("projetos").length && !Dados.lista("tarefas").length && !Dados.lista("auditorias").length;
  el.innerHTML = vazio
    ? `<div class="painel previa-cartao">
        <div class="previa-topo">${ic("sparkle")}<strong>Prévia do novo app da Archipel</strong></div>
        <p class="ajuda">Auditorias com roteiro por norma, tarefas com lembretes e o assistente que lê o WhatsApp e os e-mails. Os dados desta prévia ficam separados do app de campo.</p>
        <div class="botoes">
          <button type="button" class="bt bt-pri" data-acao="demo-carregar">${ic("database")}Carregar a demonstração</button>
          <button type="button" class="bt bt-fan" data-acao="aba" data-tela="ajustes">Sobre a prévia</button>
        </div>
      </div>`
    : "";
}

function renderAjustesPrevia() {
  const el = document.getElementById("aj-previa");
  if (!el) return;
  el.innerHTML = `
    <section class="secao">
      <h2 class="titulo-secao" style="margin-bottom:6px">Prévia</h2>
      <p class="ajuda" style="margin-bottom:12px">Este endereço tem banco de dados próprio. Nada do que é feito aqui altera o app de campo, e os clientes da demonstração são fictícios.</p>
      <div class="botoes-col">
        <button type="button" class="bt bt-sec bt-largo" data-acao="demo-carregar">${ic("database")}Carregar os dados de demonstração</button>
        <button type="button" class="bt bt-sec bt-largo" data-acao="demo-apagar">${ic("eraser")}Apagar os dados da prévia</button>
      </div>
    </section>`;
}

Object.assign(ACOES, {
  "demo-carregar": async () => {
    const tem = Dados.lista("projetos").length || Dados.lista("tarefas").length || Dados.lista("auditorias").length;
    if (tem) {
      const ok = await confirmar("Os dados atuais da prévia serão substituídos pela demonstração.", { titulo: "Carregar a demonstração?", ok: "Carregar" });
      if (!ok) return;
      apagarDadosPrevia();
    }
    carregarDemo();
    atualizarSeloTarefas();
    renderAjustesTarefas();
    Nav.ir("inicio", {}, { raiz: true });
    toast("Demonstração carregada", { icone: "database" });
    setTimeout(verificarLembretes, 1500);
  },
  "demo-apagar": async () => {
    const ok = await confirmar("Projetos, registros, auditorias, tarefas e mensagens da prévia serão apagados. O app de campo não é afetado.", {
      titulo: "Apagar os dados da prévia?",
      ok: "Apagar",
      perigo: true,
    });
    if (!ok) return;
    apagarDadosPrevia();
    atualizarSeloTarefas();
    renderAjustesTarefas();
    Nav.ir("inicio", {}, { raiz: true });
    toast("Dados da prévia apagados", { icone: "eraser" });
  },
});
