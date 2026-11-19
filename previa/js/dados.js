/* =========================================================================
   Dados: IndexedDB (principal) + espelho no localStorage.
   Compatível com a versão anterior: mesmo banco ("formularios-campo",
   versão 1), mesmas chaves e mesmo formato de registro.
   ========================================================================= */
"use strict";

// Prévia (/previa/): banco e chaves próprios, sem tocar nos dados do app oficial
const PREVIA = !!window.MODO_PREVIA;
const PREFIXO_DADOS = PREVIA ? "previa_" : "";
const NOME_BANCO = PREVIA ? "formularios-campo-previa" : "formularios-campo";

const CHAVES = {
  diario: PREFIXO_DADOS + "form_diario_registros_v1",
  sondagem: PREFIXO_DADOS + "form_sondagem_registros_v2",
  projetos: PREFIXO_DADOS + "form_projetos_v1",
  ensaios: PREFIXO_DADOS + "form_ensaios_v1",
  auditorias: PREFIXO_DADOS + "form_auditorias_v1",
  tarefas: PREFIXO_DADOS + "form_tarefas_v1",
  mensagens: PREFIXO_DADOS + "form_mensagens_v1",
};
const CHAVE_CONFIG = PREFIXO_DADOS + "form_config_v1";
const CHAVE_RASCUNHOS = PREFIXO_DADOS + "form_rascunhos_v1";

const CONFIG_PADRAO = {
  equipe: { responsavel: "", auxiliares: "" },
  eventos: null, // null = lista padrão (EVENTOS_PADRAO)
  ultimoBackup: null, // ISO
  personalizada: false,
};

const Dados = {
  idb: null,
  cache: {},
  config: clonar(CONFIG_PADRAO),
  rascunhos: {},

  // ---------------------------------------------------------- IndexedDB
  abrirBanco() {
    return new Promise((resolve) => {
      if (!window.indexedDB) return resolve(null);
      try {
        // Versão 1, como no app anterior: subir a versão quebraria a versão anterior.
        const req = indexedDB.open(NOME_BANCO, 1);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains("registros")) db.createObjectStore("registros");
          if (!db.objectStoreNames.contains("fotos")) db.createObjectStore("fotos", { keyPath: "id" });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  },

  idbGet(store, chave) {
    return new Promise((resolve) => {
      if (!Dados.idb) return resolve(undefined);
      try {
        const r = Dados.idb.transaction(store).objectStore(store).get(chave);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => resolve(undefined);
      } catch (e) {
        resolve(undefined);
      }
    });
  },

  idbPut(store, valor, chave) {
    return new Promise((resolve) => {
      if (!Dados.idb) return resolve(false);
      try {
        const os = Dados.idb.transaction(store, "readwrite").objectStore(store);
        const r = chave !== undefined ? os.put(valor, chave) : os.put(valor);
        r.onsuccess = () => resolve(true);
        r.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  },

  idbDelete(store, chave) {
    return new Promise((resolve) => {
      if (!Dados.idb) return resolve(false);
      try {
        const r = Dados.idb.transaction(store, "readwrite").objectStore(store).delete(chave);
        r.onsuccess = () => resolve(true);
        r.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  },

  lerLocal(chave) {
    try {
      return JSON.parse(localStorage.getItem(chave));
    } catch (e) {
      return null;
    }
  },

  gravarLocal(chave, valor) {
    try {
      localStorage.setItem(chave, JSON.stringify(valor));
    } catch (e) {
      // cheio ou indisponível: o IndexedDB segue como principal
    }
  },

  async iniciar() {
    Dados.idb = await Dados.abrirBanco();
    for (const chave of Object.values(CHAVES)) {
      let lista = await Dados.idbGet("registros", chave);
      if (!Array.isArray(lista)) {
        // Migração: o que existir no localStorage
        lista = Dados.lerLocal(chave);
        if (!Array.isArray(lista)) lista = [];
        if (lista.length) await Dados.idbPut("registros", lista, chave);
      }
      Dados.cache[chave] = lista;
    }
    const cfg = (await Dados.idbGet("registros", CHAVE_CONFIG)) || Dados.lerLocal(CHAVE_CONFIG);
    Dados.config = Object.assign(clonar(CONFIG_PADRAO), cfg || {});
    Dados.config.equipe = Object.assign({ responsavel: "", auxiliares: "" }, Dados.config.equipe || {});

    // Rascunhos: junta IndexedDB e localStorage, ficando com o mais recente de cada
    const r1 = (await Dados.idbGet("registros", CHAVE_RASCUNHOS)) || {};
    const r2 = Dados.lerLocal(CHAVE_RASCUNHOS) || {};
    const todos = {};
    [r1, r2].forEach((mapa) => {
      Object.keys(mapa || {}).forEach((k) => {
        const v = mapa[k];
        if (v && (!todos[k] || (v.ts || 0) > (todos[k].ts || 0))) todos[k] = v;
      });
    });
    Dados.rascunhos = todos;
  },

  // ---------------------------------------------------------- Registros
  lista(tipo) {
    return Dados.cache[CHAVES[tipo]] || [];
  },

  gravar(tipo, lista) {
    const chave = CHAVES[tipo];
    Dados.cache[chave] = lista;
    Dados.idbPut("registros", lista, chave);
    Dados.gravarLocal(chave, lista);
  },

  achar(tipo, id) {
    return Dados.lista(tipo).find((r) => r.id === id) || null;
  },

  salvar(tipo, reg) {
    const lista = Dados.lista(tipo).slice();
    const i = lista.findIndex((r) => r.id === reg.id);
    if (i === -1) lista.push(reg);
    else lista[i] = reg;
    Dados.gravar(tipo, lista);
    return reg;
  },

  remover(tipo, id) {
    const lista = Dados.lista(tipo);
    const reg = lista.find((r) => r.id === id) || null;
    Dados.gravar(tipo, lista.filter((r) => r.id !== id));
    return reg;
  },

  // Cópia de segurança em memória (para "Desfazer")
  instantaneo(tipos) {
    const out = {};
    tipos.forEach((t) => (out[t] = clonar(Dados.lista(t))));
    return out;
  },

  restaurar(inst) {
    Object.keys(inst).forEach((t) => Dados.gravar(t, inst[t]));
  },

  // Gera um id novo e único (o app anterior usa Date.now())
  novoId(tipo) {
    let id = Date.now();
    const usados = new Set(Dados.lista(tipo).map((r) => r.id));
    while (usados.has(id)) id++;
    return id;
  },

  // ---------------------------------------------------------- Fotos
  async fotoSalvar(id, blob) {
    return Dados.idbPut("fotos", { id, blob });
  },
  async fotoObter(id) {
    const f = await Dados.idbGet("fotos", id);
    return f && f.blob ? f.blob : null;
  },
  async fotoRemover(id) {
    return Dados.idbDelete("fotos", id);
  },

  // ---------------------------------------------------------- Configuração
  salvarConfig() {
    Dados.idbPut("registros", Dados.config, CHAVE_CONFIG);
    Dados.gravarLocal(CHAVE_CONFIG, Dados.config);
  },

  // ---------------------------------------------------------- Rascunhos
  salvarRascunho(chave, dados) {
    Dados.rascunhos[chave] = Object.assign({}, dados, { ts: Date.now() });
    Dados.persistirRascunhos();
  },

  removerRascunho(chave) {
    if (!Dados.rascunhos[chave]) return;
    delete Dados.rascunhos[chave];
    Dados.persistirRascunhos();
  },

  persistirRascunhos() {
    // Limita a 12 rascunhos (os mais recentes)
    const ks = Object.keys(Dados.rascunhos).sort((a, b) => Dados.rascunhos[b].ts - Dados.rascunhos[a].ts);
    ks.slice(12).forEach((k) => delete Dados.rascunhos[k]);
    Dados.idbPut("registros", Dados.rascunhos, CHAVE_RASCUNHOS);
    Dados.gravarLocal(CHAVE_RASCUNHOS, Dados.rascunhos);
  },

  listaRascunhos() {
    return Object.keys(Dados.rascunhos)
      .map((k) => Object.assign({ chave: k }, Dados.rascunhos[k]))
      .sort((a, b) => b.ts - a.ts);
  },

  // ---------------------------------------------------------- Armazenamento
  async pedirPersistencia() {
    try {
      if (navigator.storage && navigator.storage.persist) {
        if (await navigator.storage.persisted()) return true;
        return await navigator.storage.persist();
      }
    } catch (e) {}
    return false;
  },

  async estadoArmazenamento() {
    const out = { persistido: null, uso: null, cota: null };
    try {
      if (navigator.storage && navigator.storage.persisted) out.persistido = await navigator.storage.persisted();
      if (navigator.storage && navigator.storage.estimate) {
        const e = await navigator.storage.estimate();
        out.uso = e.usage;
        out.cota = e.quota;
      }
    } catch (e) {}
    return out;
  },
};

// ---------------------------------------------------------------- Backup

function blobParaDataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function dataURLParaBlob(d) {
  const partes = d.split(",");
  const mime = (partes[0].match(/data:(.*?);/) || [])[1] || "image/jpeg";
  const bin = atob(partes[1]);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// Mesmo formato do app anterior (versão 2), com a configuração junto
async function montarBackup() {
  const dados = {
    app: "formularios-campo",
    versao: 2,
    geradoEm: new Date().toISOString(),
    projetos: Dados.lista("projetos"),
    diario: Dados.lista("diario"),
    sondagem: Dados.lista("sondagem"),
    ensaios: Dados.lista("ensaios"),
    auditorias: Dados.lista("auditorias"),
    tarefas: Dados.lista("tarefas"),
    mensagens: Dados.lista("mensagens"),
    fotos: [],
    config: {
      equipe: Dados.config.equipe,
      eventos: Dados.config.eventos,
      pessoas: Dados.config.pessoas,
      lembretes: Dados.config.lembretes,
    },
  };
  const ids = [];
  dados.sondagem.forEach((reg) => (reg.fotos || []).forEach((ref) => ids.push(ref.id)));
  dados.auditorias.forEach((reg) =>
    Object.values(reg.fotos || {}).forEach((l) => (l || []).forEach((ref) => ids.push(ref.id)))
  );
  for (const id of ids) {
    const blob = await Dados.fotoObter(id);
    if (blob) dados.fotos.push({ id, base64: await blobParaDataURL(blob) });
  }
  return dados;
}

function nomeArquivoBackup() {
  const h = new Date();
  return (
    "backup_campo_" + h.getFullYear() + String(h.getMonth() + 1).padStart(2, "0") +
    String(h.getDate()).padStart(2, "0") + "_" + String(h.getHours()).padStart(2, "0") +
    String(h.getMinutes()).padStart(2, "0") + ".json"
  );
}

// Lê o arquivo e mescla. Devolve um resumo ou lança erro.
async function importarBackupArquivo(file) {
  const texto = await file.text();
  let dados;
  try {
    dados = JSON.parse(texto);
  } catch (e) {
    throw new Error("O arquivo não é um backup válido (JSON ilegível).");
  }
  if (!dados || typeof dados !== "object") throw new Error("O arquivo não é um backup do app.");
  const conjuntos = [
    ["projetos", Array.isArray(dados.projetos) ? dados.projetos : []],
    ["diario", Array.isArray(dados.diario) ? dados.diario : []],
    ["sondagem", Array.isArray(dados.sondagem) ? dados.sondagem : []],
    ["ensaios", Array.isArray(dados.ensaios) ? dados.ensaios : []],
    ["auditorias", Array.isArray(dados.auditorias) ? dados.auditorias : []],
    ["tarefas", Array.isArray(dados.tarefas) ? dados.tarefas : []],
    ["mensagens", Array.isArray(dados.mensagens) ? dados.mensagens : []],
  ];
  if (!conjuntos.some(([, l]) => l.length)) throw new Error("O arquivo não tem registros para importar.");

  // Registros que já existem aqui com conteúdo diferente
  const diferentes = [];
  conjuntos.forEach(([tipo, novos]) => {
    const atual = Dados.lista(tipo);
    novos.forEach((r) => {
      const ex = r && atual.find((a) => a.id === r.id);
      if (ex && JSON.stringify(ex) !== JSON.stringify(r)) {
        diferentes.push(r.idSond || r.idEnsaio || r.numero || r.titulo || dataBR(r.data) || "registro");
      }
    });
  });
  let substituir = false;
  if (diferentes.length) {
    substituir = await confirmar(
      "O arquivo traz " + diferentes.length + " registro(s) que já existem neste aparelho com conteúdo diferente: " +
        diferentes.slice(0, 8).join(", ") + (diferentes.length > 8 ? "…" : "") + ".",
      { titulo: "Registros em conflito", ok: "Usar os do arquivo", cancelar: "Manter os deste aparelho" }
    );
  }
  const resumo = { novos: 0, atualizados: 0, fotos: 0 };
  conjuntos.forEach(([tipo, novos]) => {
    const atual = Dados.lista(tipo).slice();
    novos.forEach((r) => {
      if (!r || !r.id) return;
      const i = atual.findIndex((a) => a.id === r.id);
      if (i === -1) {
        atual.push(r);
        resumo.novos++;
      } else if (substituir && JSON.stringify(atual[i]) !== JSON.stringify(r)) {
        atual[i] = r;
        resumo.atualizados++;
      }
    });
    Dados.gravar(tipo, atual);
  });
  for (const f of dados.fotos || []) {
    if (f && f.id && f.base64) {
      const existe = await Dados.fotoObter(f.id);
      if (!existe) {
        await Dados.fotoSalvar(f.id, dataURLParaBlob(f.base64));
        resumo.fotos++;
      }
    }
  }
  // Configuração vem junto só se este aparelho nunca foi personalizado
  if (dados.config && !Dados.config.personalizada) {
    if (dados.config.equipe) Dados.config.equipe = Object.assign({ responsavel: "", auxiliares: "" }, dados.config.equipe);
    if (Array.isArray(dados.config.eventos)) Dados.config.eventos = dados.config.eventos;
    if (Array.isArray(dados.config.pessoas)) Dados.config.pessoas = dados.config.pessoas;
    if (dados.config.lembretes) Dados.config.lembretes = dados.config.lembretes;
    Dados.salvarConfig();
  }
  return resumo;
}
