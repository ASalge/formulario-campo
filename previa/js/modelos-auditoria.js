/* =========================================================================
   Modelos de auditoria (checklists por tipo × referência)
   VERSÃO PRELIMINAR — conteúdo técnico a ser revisado pela equipe Archipel
   antes do uso com clientes.

   Tipos de item: texto, texto_longo, numero, data, selecao, multipla,
   sim_nao_na, gps, foto, documento.
   Seções podem ser repetíveis (ex.: cada tanque) e condicionais
   (mostrar_se: { item: "secao.item", igual: "sim" }).
   ========================================================================= */
"use strict";

const OPC_PISO = ["Impermeabilizado íntegro", "Impermeabilizado com fissuras", "Sem impermeabilização", "Solo exposto"];
const OPC_INDICIOS = ["Manchas no piso ou solo", "Odor", "Vegetação estressada", "Produto aflorando", "Corrosão", "Nenhum observado"];

const SECAO_TANQUES = {
  id: "tanques",
  titulo: "Tanques de armazenamento",
  descricao: "Um cartão para cada tanque (aéreo ou subterrâneo), inclusive desativados.",
  mostrar_se: { item: "uso_atual.possui_tanques", igual: "sim" },
  repetivel: { rotulo: "Tanque", adicionar: "Adicionar tanque", minimo: 1, titulo: ["identificacao", "produto"] },
  itens: [
    { id: "identificacao", tipo: "texto", pergunta: "Identificação do tanque", ajuda: "Ex.: TQ-01, tanque de diesel do gerador." },
    { id: "tipo", tipo: "selecao", pergunta: "Tipo", opcoes: ["Aéreo", "Subterrâneo"], obrigatorio: true },
    { id: "produto", tipo: "texto", pergunta: "Produto armazenado", obrigatorio: true },
    { id: "capacidade", tipo: "numero", pergunta: "Capacidade", unidade: "m³" },
    { id: "instalacao", tipo: "texto", pergunta: "Ano de instalação" },
    { id: "situacao", tipo: "selecao", pergunta: "Situação", opcoes: ["Em operação", "Desativado", "Removido"] },
    { id: "contencao", tipo: "sim_nao_na", pergunta: "Possui bacia de contenção ou parede dupla?" },
    { id: "estanqueidade", tipo: "documento", pergunta: "Teste de estanqueidade / laudo de integridade" },
    { id: "foto", tipo: "foto", pergunta: "Tanque e placa de identificação", minimo: 1, obrigatorio: true },
  ],
};

const MODELOS_AUDITORIA = [
  // ---------------------------------------------------------------- AP CETESB
  {
    id: "ap-cetesb",
    tipo: "Avaliação Preliminar (Fase I)",
    referencia: "CETESB · ABNT NBR 15515-1",
    referencias: [
      "CETESB DD 038/2017/C (partes vigentes)",
      "CETESB DD 056/2024/E",
      "Manual de Gerenciamento de Áreas Contaminadas (CETESB)",
      "ABNT NBR 15515-1",
      "Resolução CONAMA 420/2009",
    ],
    versao: "0.1 preliminar",
    estrutura_relatorio: [
      "Introdução e objetivos",
      "Caracterização do empreendimento e da área",
      "Histórico de ocupação",
      "Caracterização do meio físico",
      "Fontes potenciais e áreas de interesse",
      "Caracterização do entorno",
      "Modelo conceitual inicial",
      "Conclusões e recomendações",
      "Anexos: registro fotográfico, documentos e entrevistas",
    ],
    secoes: [
      {
        id: "identificacao",
        titulo: "Identificação da área",
        itens: [
          { id: "endereco", tipo: "texto", pergunta: "Endereço completo", obrigatorio: true },
          { id: "matricula", tipo: "texto", pergunta: "Matrícula / cartório" },
          { id: "area_terreno", tipo: "numero", pergunta: "Área do terreno", unidade: "m²" },
          { id: "area_construida", tipo: "numero", pergunta: "Área construída", unidade: "m²" },
          { id: "coord", tipo: "gps", pergunta: "Coordenadas do acesso principal", obrigatorio: true },
          { id: "foto_acesso", tipo: "foto", pergunta: "Fachada / acesso principal", minimo: 1, obrigatorio: true },
          { id: "foto_geral", tipo: "foto", pergunta: "Vistas gerais da área", minimo: 2, obrigatorio: true, ajuda: "Ao menos duas vistas que mostrem a ocupação do terreno." },
        ],
      },
      {
        id: "vistoria",
        titulo: "Vistoria e entrevistas",
        itens: [
          { id: "data", tipo: "data", pergunta: "Data da vistoria", obrigatorio: true },
          { id: "acompanhante", tipo: "texto", pergunta: "Quem acompanhou a vistoria (nome e função)", obrigatorio: true },
          { id: "entrevistas", tipo: "texto_longo", pergunta: "Entrevistados e principais informações", ajuda: "Nome, função, tempo de vínculo com a área e o que informaram sobre usos, acidentes e produtos." },
          { id: "restricoes", tipo: "texto_longo", pergunta: "Restrições de acesso ou áreas não vistoriadas" },
        ],
      },
      {
        id: "uso_atual",
        titulo: "Uso atual",
        itens: [
          { id: "atividade", tipo: "texto", pergunta: "Atividade desenvolvida / CNAE", obrigatorio: true },
          { id: "ocupacao", tipo: "selecao", pergunta: "Tipo de ocupação", opcoes: ["Industrial", "Comercial", "Serviços", "Residencial", "Rural", "Sem uso", "Misto"], obrigatorio: true },
          { id: "funcionarios", tipo: "numero", pergunta: "Número de funcionários" },
          { id: "insumos", tipo: "texto_longo", pergunta: "Matérias-primas, insumos e produtos químicos utilizados" },
          { id: "possui_tanques", tipo: "sim_nao_na", pergunta: "Há tanques de armazenamento (aéreos ou subterrâneos)?", obrigatorio: true },
          { id: "possui_fontes", tipo: "sim_nao_na", pergunta: "Foram identificadas outras fontes potenciais (armazenamento de produtos, resíduos, oficinas, ETE)?", obrigatorio: true },
        ],
      },
      {
        id: "historico",
        titulo: "Histórico de ocupação",
        itens: [
          { id: "usos_anteriores", tipo: "texto_longo", pergunta: "Usos anteriores conhecidos", obrigatorio: true, ajuda: "Atividade, período e fonte da informação (entrevista, imagem, documento)." },
          { id: "inicio", tipo: "texto", pergunta: "Ano aproximado de início da ocupação" },
          { id: "imagens", tipo: "documento", pergunta: "Imagens aéreas históricas" },
          { id: "aterros", tipo: "sim_nao_na", pergunta: "Houve demolições, aterros ou movimentação de terra?" },
          { id: "acidentes", tipo: "sim_nao_na", pergunta: "Há registro de vazamentos, acidentes ou incêndios?" },
          { id: "autuacoes", tipo: "sim_nao_na", pergunta: "Há autuações ou exigências de órgãos ambientais?" },
          { id: "estudos", tipo: "documento", pergunta: "Estudos ambientais anteriores (AP, IC, monitoramentos)" },
        ],
      },
      {
        id: "meio_fisico",
        titulo: "Meio físico",
        itens: [
          { id: "topografia", tipo: "selecao", pergunta: "Topografia", opcoes: ["Plana", "Suave ondulada", "Ondulada", "Encosta", "Fundo de vale"] },
          { id: "drenagem", tipo: "texto", pergunta: "Drenagem superficial e destino das águas pluviais" },
          { id: "corpos_agua", tipo: "texto", pergunta: "Corpos d'água próximos (nome, distância, direção)" },
          { id: "pocos", tipo: "sim_nao_na", pergunta: "Há poços de captação ou de monitoramento no imóvel?" },
          { id: "na", tipo: "numero", pergunta: "Profundidade do nível d'água conhecida", unidade: "m" },
          { id: "solo", tipo: "texto", pergunta: "Solo observado / afloramentos" },
        ],
      },
      {
        id: "fontes",
        titulo: "Fontes potenciais de contaminação",
        descricao: "Um cartão para cada área ou fonte com potencial de contaminação.",
        mostrar_se: { item: "uso_atual.possui_fontes", igual: "sim" },
        repetivel: { rotulo: "Área", adicionar: "Adicionar área ou fonte", minimo: 1, titulo: ["tipo", "descricao"] },
        itens: [
          {
            id: "tipo",
            tipo: "selecao",
            pergunta: "Tipo de área",
            obrigatorio: true,
            opcoes: [
              "Armazenamento de produtos químicos",
              "Armazenamento de resíduos",
              "Estação de tratamento / caixa separadora",
              "Oficina / manutenção / lavagem",
              "Transformadores / subestação",
              "Linha de produção",
              "Área de descarte / bota-fora",
              "Outro",
            ],
          },
          { id: "descricao", tipo: "texto", pergunta: "Identificação e descrição", obrigatorio: true },
          { id: "substancias", tipo: "texto", pergunta: "Substâncias de interesse" },
          { id: "piso", tipo: "selecao", pergunta: "Piso", opcoes: OPC_PISO },
          { id: "contencao", tipo: "sim_nao_na", pergunta: "Possui contenção secundária?" },
          { id: "indicios", tipo: "multipla", pergunta: "Indícios observados", opcoes: OPC_INDICIOS },
          { id: "coord", tipo: "gps", pergunta: "Coordenadas" },
          { id: "fotos", tipo: "foto", pergunta: "Fotos da área (geral e detalhe)", minimo: 2, obrigatorio: true },
        ],
      },
      SECAO_TANQUES,
      {
        id: "residuos",
        titulo: "Resíduos e efluentes",
        itens: [
          { id: "residuos", tipo: "texto_longo", pergunta: "Resíduos gerados, armazenamento e destinação" },
          { id: "comprovantes", tipo: "documento", pergunta: "MTR / CADRI / comprovantes de destinação" },
          { id: "efluentes", tipo: "texto_longo", pergunta: "Efluentes sanitários e industriais: tratamento e lançamento" },
          { id: "fossas", tipo: "sim_nao_na", pergunta: "Há fossas, sumidouros ou infiltração no solo?" },
        ],
      },
      {
        id: "entorno",
        titulo: "Entorno",
        itens: [
          { id: "usos", tipo: "texto_longo", pergunta: "Usos do entorno com potencial de contaminação", obrigatorio: true, ajuda: "Raio aproximado de 500 m: postos, indústrias, oficinas, depósitos." },
          { id: "lista_cetesb", tipo: "documento", pergunta: "Consulta à relação de áreas contaminadas da CETESB" },
          { id: "receptores", tipo: "texto", pergunta: "Receptores sensíveis próximos (residências, escolas, captações)" },
          { id: "fotos", tipo: "foto", pergunta: "Fotos do entorno", minimo: 2 },
        ],
      },
      {
        id: "documentos",
        titulo: "Documentos solicitados ao cliente",
        itens: [
          { id: "matricula", tipo: "documento", pergunta: "Matrícula atualizada do imóvel" },
          { id: "plantas", tipo: "documento", pergunta: "Plantas / layout das instalações" },
          { id: "licencas", tipo: "documento", pergunta: "Licenças ambientais e condicionantes" },
          { id: "fispq", tipo: "documento", pergunta: "FISPQs dos produtos armazenados" },
          { id: "outorgas", tipo: "documento", pergunta: "Outorgas de uso de recursos hídricos" },
        ],
      },
      {
        id: "conclusoes",
        titulo: "Conclusões de campo",
        itens: [
          { id: "areas_interesse", tipo: "texto_longo", pergunta: "Áreas de interesse identificadas", obrigatorio: true },
          {
            id: "recomendacao",
            tipo: "selecao",
            pergunta: "Recomendação preliminar",
            obrigatorio: true,
            opcoes: ["Recomendar Investigação Confirmatória", "Encerrar na Avaliação Preliminar", "Complementar informações"],
          },
          { id: "observacoes", tipo: "texto_longo", pergunta: "Observações para o relatório" },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- Phase I ASTM
  {
    id: "phase1-astm",
    tipo: "Avaliação Preliminar (Fase I)",
    referencia: "ASTM E1527-21 · EPA AAI",
    referencias: ["ASTM E1527-21", "EPA All Appropriate Inquiries (40 CFR Part 312)"],
    versao: "0.1 preliminar",
    estrutura_relatorio: [
      "Summary / Resumo executivo",
      "Introduction / Introdução (escopo, limitações, user's responsibilities)",
      "Site description / Descrição do imóvel",
      "User-provided information / Informações do usuário",
      "Records review / Revisão de registros",
      "Site reconnaissance / Vistoria",
      "Interviews / Entrevistas",
      "Findings, opinions and conclusions (RECs, CRECs, HRECs, de minimis)",
      "Data gaps / Lacunas de dados",
      "Appendices / Anexos",
    ],
    secoes: [
      {
        id: "site",
        titulo: "Descrição do imóvel (Site description)",
        itens: [
          { id: "endereco", tipo: "texto", pergunta: "Endereço completo", obrigatorio: true },
          { id: "area", tipo: "numero", pergunta: "Área do terreno", unidade: "m²" },
          { id: "uso_atual", tipo: "texto", pergunta: "Uso atual (current use)", obrigatorio: true },
          { id: "coord", tipo: "gps", pergunta: "Coordenadas", obrigatorio: true },
          { id: "foto_acesso", tipo: "foto", pergunta: "Acesso / fachada", minimo: 1, obrigatorio: true },
        ],
      },
      {
        id: "user",
        titulo: "Informações do usuário (User-provided information)",
        itens: [
          { id: "motivo", tipo: "texto", pergunta: "Motivo da avaliação (transação, financiamento, desinvestimento)", obrigatorio: true },
          { id: "titulo", tipo: "documento", pergunta: "Registros de título / matrícula (title records)" },
          { id: "aul", tipo: "sim_nao_na", pergunta: "Há ônus ambientais ou restrições de uso (environmental liens / AULs)?", obrigatorio: true },
          { id: "conhecimento", tipo: "texto_longo", pergunta: "Conhecimento especializado do usuário (specialized knowledge)" },
          { id: "valor", tipo: "sim_nao_na", pergunta: "O preço reflete redução de valor por questão ambiental?" },
        ],
      },
      {
        id: "records",
        titulo: "Revisão de registros (Records review)",
        itens: [
          { id: "bases", tipo: "documento", pergunta: "Consulta a bases públicas (federal, estadual, municipal)", obrigatorio: true },
          { id: "aerofotos", tipo: "documento", pergunta: "Fotos aéreas históricas" },
          { id: "mapas", tipo: "documento", pergunta: "Mapas topográficos e históricos" },
          { id: "fontes_hist", tipo: "texto_longo", pergunta: "Outras fontes históricas consultadas" },
          { id: "periodo", tipo: "texto", pergunta: "Uso mais antigo identificado e período coberto", obrigatorio: true, ajuda: "A norma pede histórico desde o primeiro uso desenvolvido (ou 1940, o que vier antes)." },
        ],
      },
      {
        id: "recon",
        titulo: "Vistoria (Site reconnaissance)",
        itens: [
          { id: "metodo", tipo: "texto_longo", pergunta: "Método e limitações da vistoria", obrigatorio: true },
          { id: "substancias", tipo: "sim_nao_na", pergunta: "Substâncias perigosas ou derivados de petróleo em uso ou armazenados?", obrigatorio: true },
          { id: "possui_tanques", tipo: "sim_nao_na", pergunta: "Tanques (UST/AST)?", obrigatorio: true },
          { id: "tambores", tipo: "sim_nao_na", pergunta: "Tambores ou recipientes não identificados?" },
          { id: "odores", tipo: "sim_nao_na", pergunta: "Odores fortes ou anormais?" },
          { id: "manchas", tipo: "sim_nao_na", pergunta: "Poças de líquido, manchas ou corrosão?" },
          { id: "pcb", tipo: "sim_nao_na", pergunta: "Equipamentos com possível PCB (transformadores, capacitores)?" },
          { id: "ralos", tipo: "sim_nao_na", pergunta: "Ralos, caixas, poços de visita ou fossas?" },
          { id: "lagoas", tipo: "sim_nao_na", pergunta: "Lagoas, valas ou áreas de disposição?" },
          { id: "vegetacao", tipo: "sim_nao_na", pergunta: "Vegetação estressada?" },
          { id: "pocos", tipo: "sim_nao_na", pergunta: "Poços (abastecimento, monitoramento, desativados)?" },
          { id: "fotos", tipo: "foto", pergunta: "Fotos da vistoria", minimo: 4, obrigatorio: true },
        ],
      },
      Object.assign({}, SECAO_TANQUES, { mostrar_se: { item: "recon.possui_tanques", igual: "sim" } }),
      {
        id: "interviews",
        titulo: "Entrevistas (Interviews)",
        itens: [
          { id: "proprietario", tipo: "texto_longo", pergunta: "Proprietário / gestor do imóvel", obrigatorio: true },
          { id: "ocupantes", tipo: "texto_longo", pergunta: "Ocupantes e funcionários-chave" },
          { id: "orgaos", tipo: "texto_longo", pergunta: "Órgãos públicos consultados" },
        ],
      },
      {
        id: "adjacent",
        titulo: "Imóveis vizinhos (Adjoining properties)",
        itens: [
          { id: "vizinhos", tipo: "texto_longo", pergunta: "Usos dos imóveis vizinhos e potencial de impacto", obrigatorio: true },
          { id: "fotos", tipo: "foto", pergunta: "Fotos dos vizinhos", minimo: 2 },
        ],
      },
      {
        id: "findings",
        titulo: "Constatações (Findings)",
        itens: [
          { id: "rec", tipo: "texto_longo", pergunta: "RECs — condições ambientais reconhecidas", obrigatorio: true },
          { id: "crec", tipo: "texto_longo", pergunta: "CRECs — condições controladas" },
          { id: "hrec", tipo: "texto_longo", pergunta: "HRECs — condições históricas" },
          { id: "de_minimis", tipo: "texto_longo", pergunta: "Condições de minimis" },
          { id: "lacunas", tipo: "texto_longo", pergunta: "Lacunas de dados (data gaps) e relevância" },
          { id: "recomendacao", tipo: "selecao", pergunta: "Recomendação", obrigatorio: true, opcoes: ["Recomendar Fase II", "Sem necessidade de Fase II", "Complementar informações"] },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- Licenciamento CETESB
  {
    id: "lic-cetesb",
    tipo: "Licenciamento ambiental",
    referencia: "CETESB (SP)",
    referencias: ["Lei Estadual 997/1976", "Regulamento aprovado pelo Decreto Estadual 8.468/1976 e alterações", "Procedimentos de licenciamento da CETESB"],
    versao: "0.1 preliminar",
    estrutura_relatorio: [
      "Caracterização do empreendimento",
      "Processo produtivo",
      "Matérias-primas e produtos",
      "Emissões atmosféricas",
      "Efluentes líquidos",
      "Resíduos sólidos",
      "Ruído",
      "Abastecimento de água",
      "Documentação e pendências para o protocolo",
    ],
    secoes: [
      {
        id: "empreendimento",
        titulo: "Empreendimento",
        itens: [
          { id: "razao", tipo: "texto", pergunta: "Razão social", obrigatorio: true },
          { id: "cnpj", tipo: "texto", pergunta: "CNPJ" },
          { id: "endereco", tipo: "texto", pergunta: "Endereço", obrigatorio: true },
          { id: "coord", tipo: "gps", pergunta: "Coordenadas", obrigatorio: true },
          { id: "atividade", tipo: "texto", pergunta: "Atividade / CNAE", obrigatorio: true },
          { id: "licenca", tipo: "selecao", pergunta: "Licença pretendida", obrigatorio: true, opcoes: ["LP", "LI", "LO", "Renovação de LO", "LP + LI + LO", "Alteração"] },
          { id: "area_construida", tipo: "numero", pergunta: "Área construída", unidade: "m²" },
          { id: "funcionarios", tipo: "numero", pergunta: "Funcionários" },
          { id: "horario", tipo: "texto", pergunta: "Horário de funcionamento" },
          { id: "foto_fachada", tipo: "foto", pergunta: "Fachada", minimo: 1, obrigatorio: true },
        ],
      },
      {
        id: "processo",
        titulo: "Processo produtivo",
        itens: [
          { id: "descricao", tipo: "texto_longo", pergunta: "Descrição do processo", obrigatorio: true },
          { id: "fluxograma", tipo: "documento", pergunta: "Fluxograma do processo" },
          { id: "capacidade", tipo: "texto", pergunta: "Capacidade de produção" },
          { id: "equipamentos", tipo: "texto_longo", pergunta: "Principais equipamentos" },
          { id: "fotos", tipo: "foto", pergunta: "Fotos do processo", minimo: 3, obrigatorio: true },
        ],
      },
      {
        id: "materiais",
        titulo: "Matérias-primas e produtos químicos",
        repetivel: { rotulo: "Produto", adicionar: "Adicionar produto", minimo: 1, titulo: ["nome"] },
        itens: [
          { id: "nome", tipo: "texto", pergunta: "Produto", obrigatorio: true },
          { id: "consumo", tipo: "texto", pergunta: "Consumo mensal" },
          { id: "armazenamento", tipo: "texto", pergunta: "Forma e local de armazenamento" },
          { id: "fispq", tipo: "documento", pergunta: "FISPQ" },
          { id: "foto", tipo: "foto", pergunta: "Local de armazenamento", minimo: 1 },
        ],
      },
      {
        id: "emissoes",
        titulo: "Emissões atmosféricas",
        itens: [
          { id: "possui", tipo: "sim_nao_na", pergunta: "Há fontes de emissão atmosférica?", obrigatorio: true },
          { id: "fontes", tipo: "texto_longo", pergunta: "Fontes, poluentes e sistemas de controle" },
          { id: "fotos", tipo: "foto", pergunta: "Fontes e sistemas de controle", minimo: 1 },
        ],
      },
      {
        id: "efluentes",
        titulo: "Efluentes líquidos",
        itens: [
          { id: "sanitario", tipo: "selecao", pergunta: "Efluente sanitário", opcoes: ["Rede pública", "Fossa séptica", "ETE própria"], obrigatorio: true },
          { id: "industrial", tipo: "sim_nao_na", pergunta: "Há efluente industrial?", obrigatorio: true },
          { id: "tratamento", tipo: "texto_longo", pergunta: "Tratamento e lançamento" },
        ],
      },
      {
        id: "residuos",
        titulo: "Resíduos sólidos",
        itens: [
          { id: "lista", tipo: "texto_longo", pergunta: "Resíduos gerados (tipo, classe, quantidade)", obrigatorio: true },
          { id: "armazenamento", tipo: "texto", pergunta: "Armazenamento temporário" },
          { id: "destinacao", tipo: "texto", pergunta: "Destinação" },
          { id: "cadri", tipo: "documento", pergunta: "CADRI / MTR" },
          { id: "foto", tipo: "foto", pergunta: "Área de resíduos", minimo: 1 },
        ],
      },
      {
        id: "ruido",
        titulo: "Ruído",
        itens: [
          { id: "fontes", tipo: "texto_longo", pergunta: "Fontes de ruído e período de operação" },
          { id: "receptores", tipo: "texto", pergunta: "Receptores próximos" },
        ],
      },
      {
        id: "agua",
        titulo: "Abastecimento de água",
        itens: [
          { id: "fonte", tipo: "selecao", pergunta: "Fonte de abastecimento", opcoes: ["Rede pública", "Poço", "Captação superficial", "Misto"], obrigatorio: true },
          { id: "outorga", tipo: "documento", pergunta: "Outorga / dispensa" },
        ],
      },
      {
        id: "documentos",
        titulo: "Documentos para o protocolo",
        itens: [
          { id: "matricula", tipo: "documento", pergunta: "Matrícula ou contrato de locação" },
          { id: "uso_solo", tipo: "documento", pergunta: "Certidão de uso e ocupação do solo (prefeitura)" },
          { id: "planta", tipo: "documento", pergunta: "Planta de layout" },
          { id: "licencas_ant", tipo: "documento", pergunta: "Licenças anteriores" },
        ],
      },
      {
        id: "conclusoes",
        titulo: "Pendências e observações",
        itens: [
          { id: "pendencias", tipo: "texto_longo", pergunta: "Pendências para o protocolo", obrigatorio: true },
          { id: "observacoes", tipo: "texto_longo", pergunta: "Observações para o relatório" },
        ],
      },
    ],
  },
];

// Due diligence: escopo da Fase I (ASTM) + conformidade legal
(function () {
  const p1 = MODELOS_AUDITORIA.find((m) => m.id === "phase1-astm");
  const conformidade = {
    id: "conformidade",
    titulo: "Conformidade legal",
    descricao: "Situação das licenças, outorgas e obrigações ambientais da empresa-alvo.",
    itens: [
      { id: "licencas", tipo: "documento", pergunta: "Licenças ambientais vigentes", obrigatorio: true },
      { id: "condicionantes", tipo: "sim_nao_na", pergunta: "Condicionantes atendidas?", obrigatorio: true },
      { id: "outorgas", tipo: "documento", pergunta: "Outorgas de recursos hídricos" },
      { id: "cadri", tipo: "documento", pergunta: "CADRI / MTR / destinação de resíduos" },
      { id: "ctf", tipo: "documento", pergunta: "CTF/IBAMA e relatórios anuais" },
      { id: "autos", tipo: "sim_nao_na", pergunta: "Autos de infração, TACs ou processos ambientais?", obrigatorio: true },
      { id: "detalhes", tipo: "texto_longo", pergunta: "Detalhes, valores e prazos" },
    ],
  };
  const secoes = p1.secoes.slice(0, -1).concat([conformidade, p1.secoes[p1.secoes.length - 1]]);
  // Fica antes do licenciamento na lista de escolha
  MODELOS_AUDITORIA.splice(MODELOS_AUDITORIA.findIndex((m) => m.id === "lic-cetesb"), 0, {
    id: "edd",
    tipo: "Due Diligence Ambiental (EDD)",
    referencia: "ASTM E1527-21 + conformidade legal",
    referencias: ["ASTM E1527-21", "ISO 14015 (diretrizes de due diligence ambiental)", "Legislação ambiental aplicável"],
    versao: "0.1 preliminar",
    estrutura_relatorio: p1.estrutura_relatorio.slice(0, 7).concat(["Conformidade legal", "Riscos e passivos para a transação", "Conclusões e recomendações", "Anexos"]),
    secoes,
  });
})();

function modeloAuditoria(id) {
  return MODELOS_AUDITORIA.find((m) => m.id === id) || null;
}

function tiposAuditoria() {
  const tipos = [];
  MODELOS_AUDITORIA.forEach((m) => {
    if (!tipos.includes(m.tipo)) tipos.push(m.tipo);
  });
  return tipos;
}
