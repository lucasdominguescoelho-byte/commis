/* Commis — dictée vocale, gratuite et sans clé.

   Deux moteurs :
     - « intégrée » : Whisper (modèle libre d'OpenAI) qui tourne sur l'appareil grâce à Transformers.js,
       dans un fil séparé (Web Worker) pour que la page et l'écoute ne se figent jamais. L'audio ne quitte
       jamais l'appareil ; le modèle se télécharge une seule fois puis reste en cache.
         · avec la carte graphique (WebGPU : Chrome, Safari récent…) : Whisper « large-v3-turbo », le plus
           juste, y compris avec un accent, du bruit ou un micro moyen (~620 Mo, ≈ 2-3 s par phrase) ;
         · sinon : Whisper « small » (~250 Mo, plus lent).
       Il se télécharge en arrière-plan dès l'ouverture de « Préparer ma semaine ».
       On lui donne aussi le vocabulaire de Commis (jours, midi/soir, plats) : il les reconnaît beaucoup mieux.
       C'est le moteur par défaut sur ordinateur, où la dictée des navigateurs est souvent bloquée.
     - « navigateur » : la reconnaissance vocale du téléphone (Siri, Google), instantanée. Si elle
       échoue, Commis passe à la dictée intégrée et s'en souvient.
   Le son est capté directement (Web Audio), sans MediaRecorder : même comportement partout, et arrêt
   automatique quand on se tait. */
(function () {
  'use strict';
  const C = window.C;

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const CLE = 'commis-dictee'; // 'integree' ou 'navigateur' quand un moteur a été retenu pour cet appareil
  const CLE_GPU = 'commis-dictee-gpu'; // 'non' si la carte graphique a échoué ici
  const LIB = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';
  // (l'encodeur en fp16 boucle avec cette version : on reste en q4)
  const GPU = { modele: 'onnx-community/whisper-large-v3-turbo', dtype: { encoder_model: 'q4', decoder_model_merged: 'q4f16' }, device: 'webgpu', fichier: 'whisper-large-v3-turbo/resolve/main/onnx/decoder_model_merged_q4f16', taille: '620 Mo' };
  const GPU32 = { ...GPU, dtype: { encoder_model: 'q4', decoder_model_merged: 'q4' }, fichier: 'whisper-large-v3-turbo/resolve/main/onnx/decoder_model_merged_q4.', taille: '760 Mo' }; // cartes sans fp16
  const CPU = { modele: 'onnx-community/whisper-small', dtype: 'q8', device: 'wasm', fichier: 'whisper-small/resolve/main/onnx/decoder_model_merged_quantized', taille: '250 Mo' };

  const lire = (k = CLE) => {
    try {
      return localStorage.getItem(k);
    } catch (e) {
      return null;
    }
  };
  const ecrire = (v, k = CLE) => {
    try {
      if (v) localStorage.setItem(k, v);
      else localStorage.removeItem(k);
    } catch (e) {
      /* stockage indisponible : tant pis */
    }
  };
  const micro = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && Ctx);
  const telephone = /iphone|ipad|ipod|android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /macintosh/i.test(navigator.userAgent) && Math.min(screen.width, screen.height) < 1100);
  const moteur = () => {
    const choix = lire();
    if (choix === 'integree' && micro) return 'integree';
    if (choix === 'navigateur' && SR) return 'navigateur';
    if (!telephone && micro) return 'integree';
    return SR ? 'navigateur' : micro ? 'integree' : null;
  };

  /* ---------- Modèle Whisper (chargé à la demande, une seule fois) ---------- */
  let config = null;
  const choisirConfig = () =>
    config ||
    (config = (async () => {
      if (lire(CLE_GPU) === 'non' || !navigator.gpu) return CPU;
      try {
        const a = await navigator.gpu.requestAdapter();
        return !a ? CPU : a.features.has('shader-f16') ? GPU : GPU32;
      } catch (e) {
        return CPU;
      }
    })());
  let modeleEnCache = null;
  let dernierPct = null;
  let pret = false;
  const abonnes = new Set(); // qui veut suivre le téléchargement
  const progres = (pct) => {
    dernierPct = pct;
    abonnes.forEach((f) => f(pct));
  };
  async function dejaTelecharge() {
    if (pret) return true;
    if (modeleEnCache != null) return modeleEnCache;
    try {
      const conf = await choisirConfig();
      const c = await caches.open('transformers-cache');
      modeleEnCache = (await c.keys()).some((r) => r.url.includes(conf.fichier));
    } catch (e) {
      modeleEnCache = false;
    }
    return modeleEnCache;
  }

  // Code commun (worker ou page) : charge le modèle et rend transcrire(audio, { vocabulaire, max_new_tokens })
  const MOTEUR = `async (pipeline, conf, progres) => {
    const fichiers = {};
    const asr = await pipeline('automatic-speech-recognition', conf.modele, {
      dtype: conf.dtype,
      device: conf.device,
      progress_callback: (x) => {
        if (x.status !== 'progress' || !x.total) return;
        fichiers[x.file] = [x.loaded, x.total];
        const v = Object.values(fichiers);
        const total = v.reduce((n, y) => n + y[1], 0);
        if (total > 2e7) progres(Math.min(99, Math.round((v.reduce((n, y) => n + y[0], 0) / total) * 100)));
      },
    });
    const tok = asr.tokenizer;
    const id = (t) => tok.model.tokens_to_ids.get(t);
    const debut = [id('<|startoftranscript|>'), id('<|fr|>'), id('<|transcribe|>'), id('<|notimestamps|>')];
    const transcrire = async (audio, o) => {
      o = o || {};
      // le vocabulaire de Commis, donné à Whisper comme « texte précédent » : il oriente la reconnaissance
      const avant = o.vocabulaire && id('<|startofprev|>') != null ? [id('<|startofprev|>'), ...tok.encode(' ' + o.vocabulaire, { add_special_tokens: false }).slice(-180)] : [];
      const prefixe = [...avant, ...debut];
      if (prefixe.some((x) => x == null)) {
        const out = await asr(audio, { language: 'french', task: 'transcribe', max_new_tokens: o.max_new_tokens || 128 });
        return (out && out.text) || '';
      }
      const feats = (await asr.processor(audio)).input_features;
      const data = await asr.model.generate({ inputs: feats, decoder_input_ids: prefixe, max_new_tokens: o.max_new_tokens || 128 });
      return tok.decode(data[0].tolist().map(Number).slice(prefixe.length), { skip_special_tokens: true });
    };
    await transcrire(new Float32Array(16000)).catch(() => {}); // échauffement : le vrai passage sera rapide
    return transcrire;
  }`;
  const WORKER = `import { pipeline, env } from '${LIB}';
    env.allowLocalModels = false;
    const charger = ${MOTEUR};
    let moteur = null;
    self.onmessage = async (e) => {
      const m = e.data;
      try {
        moteur = moteur || charger(pipeline, m.conf, (pct) => self.postMessage({ type: 'progres', pct }));
        const transcrire = await moteur;
        if (m.type === 'init') return self.postMessage({ type: 'pret' });
        self.postMessage({ type: 'texte', id: m.id, texte: await transcrire(m.audio, m.opts) });
      } catch (err) {
        if (m.type === 'init') moteur = null;
        self.postMessage({ type: 'erreur', id: m.id, message: String((err && err.message) || err) });
      }
    };`;

  let moteurPret = null; // promesse d'une fonction transcrire(audio, opts) → texte
  function charger() {
    if (moteurPret) return moteurPret;
    moteurPret = (async () => {
      const conf = await choisirConfig();
      let f;
      try {
        f = await viaWorker(conf);
      } catch (e) {
        if (conf.device === 'webgpu') {
          // la carte graphique ne suit pas : moteur classique, retenu pour cet appareil
          ecrire('non', CLE_GPU);
          config = Promise.resolve(CPU);
          modeleEnCache = null;
          f = await viaWorker(CPU).catch(() => dansLaPage(CPU));
        } else f = await dansLaPage(CPU);
      }
      pret = true;
      modeleEnCache = true;
      oublier((await choisirConfig()).modele); // les autres modèles ne servent plus : on libère la place
      return f;
    })().catch((e) => {
      moteurPret = null;
      throw e;
    });
    return moteurPret;
  }
  async function oublier(garde) {
    try {
      const c = await caches.open('transformers-cache');
      const vieux = (await c.keys()).filter((r) => /whisper/.test(r.url) && !r.url.includes(garde));
      await Promise.all(vieux.map((r) => c.delete(r)));
    } catch (e) {
      /* sans importance */
    }
  }
  function viaWorker(conf) {
    return new Promise((ok, ko) => {
      let w;
      try {
        w = new Worker(URL.createObjectURL(new Blob([WORKER], { type: 'text/javascript' })), { type: 'module' });
      } catch (e) {
        return ko(e);
      }
      const attente = new Map();
      let n = 0;
      let demarre = false;
      w.onmessage = (e) => {
        const m = e.data;
        if (m.type === 'progres') progres(m.pct);
        else if (m.type === 'pret') {
          demarre = true;
          ok((audio, opts) =>
            new Promise((ok2, ko2) => {
              const id = ++n;
              const copie = audio.slice();
              attente.set(id, { ok2, ko2 });
              w.postMessage({ type: 'texte', id, audio: copie, opts, conf }, [copie.buffer]);
            })
          );
        } else if (m.type === 'texte' || m.type === 'erreur') {
          const a = attente.get(m.id);
          attente.delete(m.id);
          if (a) m.type === 'texte' ? a.ok2(m.texte) : a.ko2(new Error(m.message));
          else if (!demarre) {
            w.terminate();
            ko(new Error(m.message));
          }
        }
      };
      w.onerror = (e) => {
        if (!demarre) {
          w.terminate();
          ko(new Error((e && e.message) || 'worker'));
        }
      };
      w.postMessage({ type: 'init', conf });
    });
  }
  async function dansLaPage(conf) {
    const { pipeline, env } = await import(LIB);
    env.allowLocalModels = false;
    const transcrire = await new Function(`return ${MOTEUR}`)()(pipeline, conf, progres);
    return async (audio, opts) => {
      await new Promise((r) => setTimeout(r, 30)); // laisse l'écran se mettre à jour avant le calcul
      return transcrire(audio, opts);
    };
  }

  /* ---------- Messages ---------- */
  const SAFARI = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);
  const MESSAGES = {
    micro: SAFARI
      ? 'Micro refusé. Dans Safari : Réglages › Sites web › Microphone › autoriser ce site. Sur Mac, vérifiez aussi Réglages Système › Confidentialité et sécurité › Micro.'
      : 'Micro refusé. Autorisez-le pour ce site (icône à gauche de l’adresse) et, sur Mac, dans Réglages Système › Confidentialité et sécurité › Micro.',
    'audio-capture': 'Aucun micro trouvé. Branchez-en un ou choisissez-le dans les réglages Son de l’ordinateur.',
    rien: 'Je n’ai rien entendu. Parlez un peu plus près du micro.',
    telechargement: 'La dictée n’a pas pu se télécharger. Vérifiez la connexion et réessayez.',
    transcription: 'La transcription a échoué. Réessayez.',
  };
  // Phrases que Whisper « entend » parfois dans le silence
  const FANTOME = /amara|sous-?titr|merci d.avoir regard|abonnez-vous|^\W*$|^\[.*\]$|♪/i;
  const propre = (t) => String(t || '').replace(/\s+/g, ' ').trim();
  // Coupe les boucles (« … que vous avez une question qui vous… » répété) : dès qu'un bout de 3 mots revient une 3e fois
  const sansBoucle = (t) => {
    const mots = t.split(' ');
    const vus = new Map();
    for (let i = 0; i + 3 <= mots.length; i++) {
      const k = mots.slice(i, i + 3).join(' ').toLowerCase();
      const n = (vus.get(k) || 0) + 1;
      vus.set(k, n);
      if (n >= 3) return mots.slice(0, i).join(' ').replace(/[,;]?\s*$/, '');
    }
    return t;
  };

  /* ---------- Dictée ----------
     demarrer({ texte(t), etat(e), niveau(x) }) — e = { etape: 'ecoute' | 'telechargement' | 'transcription' |
     'fini' | 'erreur' | 'info', message, pct, enregistre } ; renvoie { arreter() }. */
  function demarrer(cb) {
    const m = moteur();
    const ctl = {
      courant: null,
      arreter() {
        if (this.courant) this.courant.arreter();
      },
    };
    if (!m) {
      cb.etat({ etape: 'erreur', message: 'Ce navigateur ne permet pas d’enregistrer la voix. Utilisez la dictée du clavier.' });
      return ctl;
    }
    if (m === 'navigateur')
      ctl.courant = navigateur(cb, () => {
        // la dictée du navigateur ne répond pas : on passe à la dictée intégrée, pour de bon sur cet appareil
        if (!micro) return cb.etat({ etape: 'erreur', message: 'La dictée de ce navigateur ne répond pas. Utilisez la dictée du clavier.' });
        ecrire('integree');
        cb.etat({ etape: 'info', message: 'La dictée du navigateur ne répond pas : Commis prend la sienne. Touchez le micro et parlez à nouveau.' });
      });
    else ctl.courant = integree(cb);
    return ctl;
  }

  function navigateur(cb, repli) {
    let rec;
    try {
      rec = new SR();
    } catch (e) {
      repli();
      return { arreter() {} };
    }
    let recu = false;
    let erreur = null;
    rec.lang = 'fr-CH';
    rec.interimResults = true;
    rec.continuous = false; // s'arrête de lui-même après une pause
    rec.onresult = (e) => {
      recu = true;
      let t = '';
      for (let k = 0; k < e.results.length; k++) t += e.results[k][0].transcript;
      cb.texte(propre(t));
    };
    rec.onerror = (e) => {
      erreur = e.error;
    };
    rec.onend = () => {
      if (recu) return cb.etat({ etape: 'fini' });
      if (erreur === 'no-speech' || erreur === 'aborted') return cb.etat({ etape: 'erreur', message: MESSAGES.rien });
      if (erreur === 'audio-capture') return cb.etat({ etape: 'erreur', message: MESSAGES['audio-capture'] });
      repli(); // refus, service absent, réseau, rien reçu…
    };
    try {
      rec.start();
    } catch (e) {
      repli();
      return { arreter() {} };
    }
    cb.etat({ etape: 'ecoute' });
    return {
      arreter() {
        try {
          rec.stop();
        } catch (e) {
          /* déjà arrêté */
        }
      },
    };
  }

  // Ramène l'audio à 16 kHz (ce qu'attend Whisper) en moyennant les échantillons
  function en16k(x, rate) {
    if (rate === 16000) return x;
    const k = rate / 16000;
    const n = Math.floor(x.length / k);
    const y = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = Math.floor(i * k);
      const b = Math.min(x.length, Math.max(a + 1, Math.floor((i + 1) * k)));
      let s = 0;
      for (let j = a; j < b; j++) s += x[j];
      y[i] = s / (b - a);
    }
    return y;
  }

  function integree(cb) {
    let ctx;
    try {
      ctx = new Ctx(); // créé pendant le toucher : Safari l'exige pour capter le son
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) {
      cb.etat({ etape: 'erreur', message: 'Ce navigateur ne permet pas d’enregistrer la voix. Utilisez la dictée du clavier.' });
      return { arreter() {} };
    }
    let flux = null;
    let source = null;
    let noeud = null;
    let fini = false;
    let parle = false;
    let silence = 0;
    let duree = 0;
    let seuil = null;
    let debutParole = null;
    let finParole = 0;
    const calib = [];
    const morceaux = [];
    let total = 0;
    // le modèle se prépare pendant qu'on parle
    const suivi = (pct) => cb.etat({ etape: 'telechargement', pct, enregistre: !fini });
    dejaTelecharge().then((ok) => {
      if (!ok) abonnes.add(suivi);
    });
    const moteur16 = charger();
    moteur16.catch(() => {});

    async function terminer(manuel) {
      if (fini) return;
      fini = true;
      try {
        if (noeud) noeud.disconnect();
        if (source) source.disconnect();
      } catch (e) {
        /* déjà débranché */
      }
      if (flux) flux.getTracks().forEach((t) => t.stop());
      const rate = ctx.sampleRate;
      if (ctx.close) ctx.close().catch(() => {});
      if (cb.niveau) cb.niveau(0);
      if (!parle) {
        abonnes.delete(suivi);
        return cb.etat({ etape: 'erreur', message: MESSAGES.rien });
      }
      const tout = new Float32Array(total);
      let o = 0;
      morceaux.forEach((m) => {
        tout.set(m, o);
        o += m.length;
      });
      // seulement le passage parlé (avec un peu de marge) : le silence fait « halluciner » Whisper
      const brut = tout.slice(Math.max(0, debutParole - Math.round(rate * 0.6)), Math.min(total, finParole + Math.round(rate * 0.8)));
      const secondes = brut.length / rate;
      try {
        if (!pret) cb.etat({ etape: 'telechargement', pct: dernierPct, enregistre: false });
        const transcrire = await moteur16;
        abonnes.delete(suivi);
        cb.etat({ etape: 'transcription' });
        const audio16 = en16k(brut, rate).slice(0, 16000 * 30);
        const t = sansBoucle(propre(await transcrire(audio16, { max_new_tokens: Math.min(200, Math.round(secondes * 7) + 12), vocabulaire: cb.vocabulaire || '' })));
        if (!t || FANTOME.test(t)) return cb.etat({ etape: 'erreur', message: MESSAGES.rien });
        cb.texte(t);
        cb.etat({ etape: 'fini' });
      } catch (e) {
        abonnes.delete(suivi);
        cb.etat({ etape: 'erreur', message: /fetch|network|load|import|failed/i.test(String(e && e.message)) ? MESSAGES.telechargement : MESSAGES.transcription });
      }
    }

    navigator.mediaDevices
      .getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      .then((s) => {
        flux = s;
        if (fini) return s.getTracks().forEach((t) => t.stop());
        if (ctx.state === 'suspended') ctx.resume();
        source = ctx.createMediaStreamSource(s);
        noeud = ctx.createScriptProcessor(4096, 1, 1);
        noeud.onaudioprocess = (e) => {
          if (fini) return;
          const d = e.inputBuffer.getChannelData(0);
          morceaux.push(new Float32Array(d));
          total += d.length;
          let s2 = 0;
          for (let k = 0; k < d.length; k++) s2 += d[k] * d[k];
          const rms = Math.sqrt(s2 / d.length);
          const dt = d.length / ctx.sampleRate;
          duree += dt;
          // seuil de parole : d'après le bruit de fond des 0,3 premières secondes
          if (seuil == null) {
            calib.push(rms);
            if (duree >= 0.3) seuil = Math.min(0.03, Math.max(0.01, (calib.reduce((a, b) => a + b, 0) / calib.length) * 2.5));
          }
          const s0 = seuil == null ? 0.02 : seuil;
          if (cb.niveau) cb.niveau(Math.min(1, rms / (s0 * 4)));
          if (rms > s0) {
            parle = true;
            silence = 0;
            if (debutParole == null) debutParole = total - d.length;
            finParole = total;
          } else if (parle) {
            silence += dt;
            if (silence > 2.2) terminer(false); // on s'est tu : fin automatique (une pause pour réfléchir passe)
          }
          if (!parle && duree > 9) terminer(false);
          if (duree > 30) terminer(false);
        };
        source.connect(noeud);
        noeud.connect(ctx.destination); // nécessaire pour que le traitement tourne (sortie silencieuse)
        cb.etat({ etape: 'ecoute', enregistre: true });
      })
      .catch((e) => {
        fini = true;
        abonnes.delete(suivi);
        if (ctx.close) ctx.close().catch(() => {});
        cb.etat({ etape: 'erreur', message: e && e.name === 'NotFoundError' ? MESSAGES['audio-capture'] : MESSAGES.micro });
      });
    return {
      arreter() {
        terminer(true);
      },
    };
  }

  // Prépare la dictée en arrière-plan (ordinateur, dictée intégrée) : elle sera prête quand on parlera
  function prechauffer() {
    if (moteur() !== 'integree' || telephone) return;
    charger().catch(() => {});
  }

  C.dictee = {
    prechauffer,
    possible: () => !!moteur(),
    moteur,
    taille: () => choisirConfig().then((c) => c.taille),
    demarrer,
    pret: () => pret,
    dejaTelecharge,
    _charger: charger, // pour les essais
    _en16k: en16k,
  };
})();
