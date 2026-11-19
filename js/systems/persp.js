/* ============================================================
   Aventurs — Segunda a tercera persona (v3.0)

   En grupo, el narrador cuenta cada cosa "de vos" para el que la hizo:
     "Te corrés a tiempo y el cuervo no te alcanza."
   Al compañero le llega la misma frase contada sobre vos:
     "Fabri se corre a tiempo y el cuervo no lo alcanza."

   A.Persp.third(texto, nombre) hace ese pase:
     - verbos de vos a él: esquivás -> esquiva, perdés -> pierde,
       atacaste -> atacó, caíste -> cayó, podés -> puede...
     - te: "te corrés" -> "se corre"; "te muerde" -> "muerde a Fabri"
       (la primera vez) o "lo muerde"; "te clava" -> "le clava"
     - alcanzarte -> alcanzar a Fabri / alcanzarlo; defenderte -> defenderse
     - tu/tus -> su/sus · tuyo -> suyo · vos -> Fabri (o él)
     - el nombre aparece una vez, donde mejor queda
   Devuelve el texto nuevo. A.Persp.named(texto, nombre) dice si el
   nombre quedó en la frase (si no, la pantalla lo pone adelante).
   ============================================================ */

(function (A) {
  'use strict';

  // ---------- Verbos irregulares (vos -> él) ----------
  const IRREG = {
    // presente
    sos: 'es', estás: 'está', das: 'da', vas: 'va', ves: 've', estés: 'esté',
    perdés: 'pierde', podés: 'puede', tenés: 'tiene', volvés: 'vuelve', defendés: 'defiende', entendés: 'entiende',
    querés: 'quiere', movés: 'mueve', mordés: 'muerde', encendés: 'enciende', contenés: 'contiene', mantenés: 'mantiene',
    detenés: 'detiene', obtenés: 'obtiene', retenés: 'retiene', sostenés: 'sostiene', devolvés: 'devuelve', envolvés: 'envuelve',
    resolvés: 'resuelve', tendés: 'tiende', atendés: 'atiende', extendés: 'extiende', descendés: 'desciende', olés: 'huele', dolés: 'duele',
    despertás: 'despierta', encontrás: 'encuentra', empezás: 'empieza', cerrás: 'cierra', soltás: 'suelta', contás: 'cuenta',
    tropezás: 'tropieza', soñás: 'sueña', apretás: 'aprieta', acertás: 'acierta', mostrás: 'muestra', pensás: 'piensa',
    recordás: 'recuerda', probás: 'prueba', sentás: 'sienta', jugás: 'juega', atravesás: 'atraviesa', colgás: 'cuelga',
    calentás: 'calienta', comenzás: 'comienza', negás: 'niega', temblás: 'tiembla', volás: 'vuela', sonás: 'suena',
    acostás: 'acuesta', almorzás: 'almuerza', rogás: 'ruega', forzás: 'fuerza', esforzás: 'esfuerza', demostrás: 'demuestra',
    regás: 'riega', sembrás: 'siembra', tentás: 'tienta', despertas: 'despierta', costás: 'cuesta', reforzás: 'refuerza',
    sentís: 'siente', seguís: 'sigue', dormís: 'duerme', venís: 'viene', decís: 'dice', pedís: 'pide', servís: 'sirve',
    repetís: 'repite', elegís: 'elige', conseguís: 'consigue', perseguís: 'persigue', morís: 'muere', oís: 'oye', huís: 'huye',
    reís: 'ríe', sonreís: 'sonríe', construís: 'construye', destruís: 'destruye', incluís: 'incluye', mentís: 'miente',
    preferís: 'prefiere', herís: 'hiere', advertís: 'advierte', divertís: 'divierte', convertís: 'convierte', sugerís: 'sugiere',
    competís: 'compite', medís: 'mide', vestís: 'viste', impedís: 'impide', despedís: 'despide', corregís: 'corrige',
    prevenís: 'previene', intervenís: 'interviene', contradecís: 'contradice', distribuís: 'distribuye', concluís: 'concluye',
    desviás: 'desvía', enviás: 'envía', confiás: 'confía', enfriás: 'enfría', espiás: 'espía', guiás: 'guía', vaciás: 'vacía',
    variás: 'varía', ampliás: 'amplía', criás: 'cría', rociás: 'rocía', actuás: 'actúa', continuás: 'continúa', evaluás: 'evalúa',
    reunís: 'reúne', prohibís: 'prohíbe',
    // pasado
    fuiste: 'fue', diste: 'dio', viste: 'vio', tuviste: 'tuvo', pudiste: 'pudo', pusiste: 'puso', hiciste: 'hizo',
    dijiste: 'dijo', trajiste: 'trajo', quisiste: 'quiso', supiste: 'supo', viniste: 'vino', estuviste: 'estuvo',
    anduviste: 'anduvo', caíste: 'cayó', leíste: 'leyó', oíste: 'oyó', creíste: 'creyó', sentiste: 'sintió', pediste: 'pidió',
    seguiste: 'siguió', conseguiste: 'consiguió', dormiste: 'durmió', moriste: 'murió', preferiste: 'prefirió',
    elegiste: 'eligió', mentiste: 'mintió', huiste: 'huyó', destruiste: 'destruyó', sonreíste: 'sonrió', repetiste: 'repitió',
    serviste: 'sirvió', mediste: 'midió', vestiste: 'vistió', obtuviste: 'obtuvo', mantuviste: 'mantuvo', detuviste: 'detuvo',
    contuviste: 'contuvo', sostuviste: 'sostuvo', distrajiste: 'distrajo', propusiste: 'propuso', supusiste: 'supuso',
    // imperfecto e irregulares sueltos
    ibas: 'iba', eras: 'era', tenías: 'tenía', sabías: 'sabía', podías: 'podía', querías: 'quería', hacías: 'hacía',
    seguías: 'seguía', decías: 'decía', venías: 'venía', creías: 'creía', veías: 'veía', oías: 'oía', sentías: 'sentía',
    dormías: 'dormía', pedías: 'pedía', comías: 'comía', bebías: 'bebía', vivías: 'vivía', salías: 'salía', conocías: 'conocía',
    parecías: 'parecía', debías: 'debía',
    // futuro (casi siempre se dice "vas a...")
    podrás: 'podrá', tendrás: 'tendrá', harás: 'hará', sabrás: 'sabrá', saldrás: 'saldrá', vendrás: 'vendrá', querrás: 'querrá',
    dirás: 'dirá', serás: 'será', estarás: 'estará', irás: 'irá', verás: 'verá', darás: 'dará', pondrás: 'pondrá',
    // subjuntivo (antes de que puedas...)
    puedas: 'pueda', tengas: 'tenga', quieras: 'quiera', sepas: 'sepa', vayas: 'vaya', hagas: 'haga', digas: 'diga',
    veas: 'vea', seas: 'sea', caigas: 'caiga', vuelvas: 'vuelva', sigas: 'siga', encuentres: 'encuentre', mueras: 'muera',
    pierdas: 'pierda', logres: 'logre', llegues: 'llegue', escapes: 'escape', uses: 'use', mires: 'mire', toques: 'toque',
    termines: 'termine', ganes: 'gane', vengas: 'venga', salgas: 'salga', pongas: 'ponga', traigas: 'traiga', oigas: 'oiga',
    duermas: 'duerma', sientas: 'sienta', pidas: 'pida', consigas: 'consiga', abras: 'abra', subas: 'suba', bajes: 'baje',
    entres: 'entre', tomes: 'tome', comas: 'coma', corras: 'corra', huyas: 'huya', aciertes: 'acierte', falles: 'falle',
    descanses: 'descanse', muevas: 'mueva', defiendas: 'defienda', reacciones: 'reaccione', des: 'dé', alejes: 'aleje',
  };

  // Palabras que terminan como verbo de vos pero no lo son
  const NOT_VERB = new Set([
    'más', 'atrás', 'detrás', 'demás', 'jamás', 'además', 'quizás', 'compás', 'satanás', 'barrabás', 'ananás',
    'través', 'después', 'revés', 'interés', 'inglés', 'francés', 'cortés', 'marqués', 'japonés', 'portugués', 'escocés',
    'holandés', 'burgués', 'envés', 'ciprés', 'estrés', 'país', 'anís', 'parís', 'maíz', 'jesús', 'inés', 'moisés',
    'nicolás', 'matías', 'andrés', 'tobías', 'elías', 'lucas', 'tomás_n',
    // -iste / -aste de presente o sustantivos
    'resiste', 'insiste', 'existe', 'asiste', 'consiste', 'desiste', 'persiste', 'embiste', 'reviste', 'triste', 'chiste',
    'alpiste', 'quiste', 'contraste', 'desgaste', 'traste', 'baste', 'engaste', 'viste_n',
    // -ías sustantivos
    'días', 'tías', 'guías', 'arpías', 'energías', 'sandías', 'porquerías', 'tonterías',
  ]);

  // Después de "te", estos verbos piden "lo" (lo muerde); el resto, "le" (le clava los colmillos)
  const DO_VERBS = new Set([
    'hiere', 'alcanza', 'alcanzan', 'alcance', 'alcancen', 'ataca', 'atacan', 'muerde', 'muerden', 'golpea', 'golpean', 'embiste',
    'envuelve', 'envuelven', 'atrapa', 'atrapan', 'aprieta', 'atraviesa', 'pica', 'desgarra', 'araña', 'picotea', 'roza', 'rozan',
    'ven', 've', 'vio', 'vieron', 'sacude', 'delata', 'delatan', 'mira', 'miran', 'azota', 'acierta', 'recibe', 'reciben', 'mantiene',
    'salpica', 'aplasta', 'señala', 'quema', 'queman', 'toca', 'tocan', 'enrosca', 'congela', 'encuentra', 'encuentran', 'encuentre',
    'lleva', 'llevan', 'ciega', 'cubre', 'pincha', 'sigue', 'siguen', 'acompaña', 'desorienta', 'tumba', 'arrastra', 'rodea', 'rodean',
    'escuchen', 'escucha', 'tira', 'tiran', 'frena', 'tenía', 'tiene', 'estaba', 'está', 'iba', 'va', 'van', 'mata', 'matan', 'sostiene',
    'deja', 'dejan', 'salva', 'protege', 'cura', 'despierta', 'derriba', 'voltea', 'empuja', 'levanta', 'persigue', 'espera',
    'esperan', 'asusta', 'aturde', 'paraliza', 'encanta', 'hechiza', 'maldice', 'envenena', 'marea', 'confunde', 'detecta',
    'descubre', 'llama', 'llaman', 'saluda', 'busca', 'buscan', 'arrastran', 'sujeta', 'agarran', 'hunde',
    // v3.3: el dado de rescate y la hierba de la vida ("te encontró", "te levanta")
    'encontró', 'encontraron', 'llevó', 'llevaron', 'cargó', 'cargaron', 'levantó', 'levantaron', 'curó', 'curaron',
    'levantan', 'cargan', 'revive', 'reviven', 'revivió',
  ]);

  // -te pegado al verbo
  const REFLEXIVE_INF = new Set([
    'defenderte', 'moverte', 'levantarte', 'escaparte', 'curarte', 'esconderte', 'protegerte', 'acercarte', 'alejarte', 'despertarte',
    'sentarte', 'quedarte', 'irte', 'ponerte', 'tirarte', 'cubrirte', 'agacharte', 'apartarte', 'recuperarte', 'salvarte', 'soltarte',
    'zafarte', 'liberarte', 'mantenerte', 'sostenerte', 'calmarte', 'concentrarte', 'prepararte', 'vestirte', 'dormirte', 'perderte',
    'meterte', 'subirte', 'bajarte', 'darte_vuelta',
  ]);
  const IO_INF = new Set([
    'hacerte', 'darte', 'decirte', 'mostrarte', 'quitarte', 'sacarte', 'robarte', 'pagarte', 'venderte', 'contarte', 'manotearte',
    'clavarte', 'lanzarte', 'tirarte_io', 'pedirte', 'ofrecerte', 'regalarte', 'avisarte', 'explicarte', 'enseñarte',
  ]);
  const NOT_ENCLITIC = new Set(['fuerte', 'suerte', 'muerte', 'parte', 'aparte', 'arte', 'baluarte', 'estandarte', 'comparte', 'reparte',
    'inerte', 'norte', 'corte', 'porte', 'deporte', 'transporte', 'soporte', 'resorte', 'pasaporte', 'consorte', 'alerte', 'despierte']);

  const CLITICS = new Set(['se', 'me', 'lo', 'la', 'le', 'los', 'las', 'les', 'no', 'ya', 'nunca', 'también', 'tampoco', 'todavía',
    'apenas', 'solo', 'casi', 'te', 'enseguida', 'recién']);
  const BOUNDARY = /[.!?¡¿:;,()\n]/;
  const BOUNDARY_WORDS = new Set(['y', 'pero', 'que', 'e', 'o', 'mientras', 'cuando', 'si', 'porque', 'aunque', 'hasta', 'antes', 'después']);

  const WORD_RE = /([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)|([^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)/g;

  function lower(s) { return s.toLowerCase(); }
  function isCap(s) { return s && s[0] !== s[0].toLowerCase(); }
  function capLike(src, out) { return isCap(src) ? out.charAt(0).toUpperCase() + out.slice(1) : out; }

  /** Si la palabra es un verbo de vos, devuelve su forma de él (o null). */
  function verb3(word) {
    const w = lower(word);
    if (NOT_VERB.has(w)) return null;
    if (IRREG[w]) return IRREG[w];
    if (w.length < 4) return null;
    let m;
    if ((m = /^(.+)aste$/.exec(w))) return `${m[1]}ó`;
    if ((m = /^(.+)iste$/.exec(w))) {
      // pasado de -er/-ir (venciste -> venció). Si la raíz termina en vocal: leíste -> leyó (ya en IRREG)
      return `${m[1]}ió`;
    }
    if ((m = /^(.+)abas$/.exec(w))) return `${m[1]}aba`;
    if ((m = /^(.+)rías$/.exec(w))) return `${m[1]}ría`;
    if ((m = /^(.+)ás$/.exec(w))) return `${m[1]}a`;
    if ((m = /^(.+)és$/.exec(w))) return `${m[1]}e`;
    if ((m = /^(.+)ís$/.exec(w))) return `${m[1]}e`;
    return null;
  }

  /** -te pegado: { base, kind: 'refl'|'io'|'do' } o null. */
  function enclitic(word) {
    const w = lower(word);
    for (const x of NOT_ENCLITIC) if (w.endsWith(x)) return null; // también "Alamuerte" o "baluarte"
    let m = /^(.+(?:ar|er|ir|ír))te$/.exec(w);
    if (!m) m = /^(.+(?:ando|iendo|ándo|iéndo|yendo))te$/.exec(w);
    if (!m) return null;
    const base = m[1];
    if (REFLEXIVE_INF.has(w)) return { base, kind: 'refl' };
    if (IO_INF.has(w)) return { base, kind: 'io' };
    return { base, kind: 'do' };
  }

  const POSS = { tu: 'su', tus: 'sus', tuyo: 'suyo', tuya: 'suya', tuyos: 'suyos', tuyas: 'suyas' };

  /**
   * Pasa una frase de "vos" a "él/ella" (el que se llama `name`).
   * opts.noName: no meter el nombre (solo cambiar verbos y pronombres).
   */
  function third(text, name, opts = {}) {
    if (!text || typeof text !== 'string') return text;
    const who = name || 'tu compañero';
    const toks = [];
    let m;
    WORD_RE.lastIndex = 0;
    while ((m = WORD_RE.exec(text))) toks.push({ s: m[0], word: !!m[1] });

    // marcar: inicio de oración, verbos, pronombres
    let sentenceStart = true;
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      // después de dos puntos se sigue en minúscula: no es una oración nueva
      if (!t.word) { if (/[.!?¡¿]/.test(t.s)) sentenceStart = true; continue; }
      t.start = sentenceStart;
      sentenceStart = false;
      const w = lower(t.s);
      // en el medio de la oración, una palabra con mayúscula es un nombre (Nicolás, Tomás)
      if (!t.start && isCap(t.s)) continue;
      const v = verb3(t.s);
      if (v) { t.v2 = v; continue; }
      if (w === 'te') { t.te = true; continue; }
      if (POSS[w]) { t.poss = POSS[w]; continue; }
      if (w === 'vos') { t.vos = true; continue; }
      if (w === 'contigo') { t.contigo = true; continue; }
      const enc = enclitic(t.s);
      if (enc) {
        // "al darte vuelta" -> "al darse vuelta"
        const nx = toks.slice(i + 1).find((x) => x.word);
        if (w === 'darte' && nx && lower(nx.s) === 'vuelta') enc.kind = 'refl';
        t.enc = enc;
        continue;
      }
    }
    const nextWord = (i) => { for (let j = i + 1; j < toks.length; j++) if (toks[j].word) return j; return -1; };
    const prevWord = (i) => { for (let j = i - 1; j >= 0; j--) { if (toks[j].word) return j; if (BOUNDARY.test(toks[j].s)) return -1; } return -1; };

    let named = !!opts.noName || (name && text.includes(name));
    const insertBefore = []; // [tokenIndex, text]

    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (!t.word) continue;
      if (t.v2) {
        if (!named) {
          // el nombre va antes del verbo y de sus pronombres ("Fabri no se da cuenta")
          let at = i;
          let j = prevWord(i);
          while (j >= 0 && CLITICS.has(lower(toks[j].s)) && !toks[j].poss) { at = j; j = prevWord(j); }
          insertBefore.push([at, who]);
          named = true;
        }
        t.out = capLike(t.s, t.v2);
        continue;
      }
      if (t.te) {
        const n = nextWord(i);
        const nt = n >= 0 ? toks[n] : null;
        const prev = prevWord(i);
        const afterSe = prev >= 0 && lower(toks[prev].s) === 'se';
        // te + verbo de vos: "te corrés" -> "se corre"
        if (nt && (nt.v2 || (['lo', 'la', 'los', 'las'].includes(lower(nt.s)) && toks[nextWord(n)] && toks[nextWord(n)].v2))) {
          t.out = capLike(t.s, 'se');
          continue;
        }
        // te + lo/la + verbo: "te lo tira" -> "se lo tira"
        if (nt && ['lo', 'la', 'los', 'las'].includes(lower(nt.s))) {
          t.out = capLike(t.s, 'se');
          const vi = nextWord(n);
          if (!named && vi >= 0) { toks[vi].after = ` a ${who}`; named = true; }
          continue;
        }
        const verb = nt ? lower(nt.s) : '';
        const isDO = !afterSe && DO_VERBS.has(verb);
        if (!named && nt) {
          if (isDO) {
            t.out = '';
            t.dropSpace = true;
            nt.after = ` a ${who}`;
            if (t.start) nt.capNext = true;
          } else {
            t.out = capLike(t.s, 'le');
            nt.after = ` a ${who}`;
          }
          named = true;
        } else {
          t.out = capLike(t.s, isDO ? 'lo' : 'le');
        }
        continue;
      }
      if (t.enc) {
        const { base, kind } = t.enc;
        if (kind === 'refl') t.out = `${base}se`;
        else if (kind === 'io') t.out = `${base}le`;
        else if (!named) { t.out = `${base} a ${who}`; named = true; }
        else t.out = `${base}lo`;
        t.out = capLike(t.s, t.out);
        continue;
      }
      if (t.poss) { t.out = capLike(t.s, t.poss); continue; }
      if (t.vos) {
        if (!named) { t.out = who; named = true; } else t.out = 'él';
        continue;
      }
      if (t.contigo) { t.out = named ? 'con él' : `con ${who}`; named = true; continue; }
    }

    // armar
    const ins = new Map(insertBefore.map(([i, s]) => [i, s]));
    let out = '';
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      let s = t.out != null ? t.out : t.s;
      if (ins.has(i)) {
        const name0 = ins.get(i);
        // "Esquivás" -> "Fabri esquiva" (la palabra que seguía pierde la mayúscula)
        if (t.start && s) s = s.charAt(0).toLowerCase() + s.slice(1);
        s = `${t.start ? name0.charAt(0).toUpperCase() + name0.slice(1) : name0} ${s}`;
      }
      if (t.dropSpace) {
        // "te muerde" -> "muerde a Fabri": se borra "te" y el espacio que le sigue
        if (toks[i + 1] && !toks[i + 1].word && /^ +$/.test(toks[i + 1].s)) toks[i + 1].s = '';
        s = '';
      }
      if (t.capNext && s) s = s.charAt(0).toUpperCase() + s.slice(1);
      out += s;
      if (t.after) out += t.after;
    }
    // si el "te" borrado estaba al principio de la oración, la palabra que sigue va con mayúscula
    out = out.replace(/(^|[.!?¡¿]\s*)([a-záéíóúñ])/g, (all, pre, ch) => pre + ch.toUpperCase());
    return out;
  }

  /** ¿La frase ya nombra al héroe? (si no, la pantalla pone el nombre adelante) */
  function named(text, name) { return !!(text && name && text.includes(name)); }

  A.Persp = { third, named, verb3 };
})(window.Aventurs);
