/* Commis — dictée vocale, gratuite et sans clé.

   Deux moteurs :
     - « intégrée » : Whisper (modèle libre d'OpenAI) qui tourne sur l'appareil grâce à Transformers.js.
       Le modèle (~100 Mo avec le moteur) se télécharge une seule fois puis reste en cache ; l'audio ne
       quitte jamais l'appareil. C'est le moteur par défaut sur ordinateur, où la dictée des navigateurs
       est souvent bloquée (Safari sans dictée macOS, Brave, Arc, Firefox…).
     - « navigateur » : la reconnaissance vocale du téléphone (Siri, Google), instantanée. Si elle
       échoue, Commis passe tout seul à la dictée intégrée et s'en souvient.
   Le son est capté directement (Web Audio), sans MediaRecorder : même comportement partout, et arrêt
   automatique quand on se tait. */
(function () {
  'use strict';
  const C = window.C;

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const CLE = 'commis-dictee'; // 'integree' ou 'navigateur' quand un moteur a été retenu pour cet appareil
  const LIB = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';
  const MODELE = 'Xenova/whisper-base';
  const TAILLE = '100 Mo';

  const lire = () => {
    try {
      return localStorage.getItem(CLE);
    } catch (e) {
      return null;
    }
  };
  const ecrire = (v) => {
    try {
      if (v) localStorage.setItem(CLE, v);
      else localStorage.removeItem(CLE);
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

  /* ---------- Modèle Whisper (chargé à la demande, une seule fois) ----------
     Il tourne dans un fil séparé (Web Worker) : la page et l'écoute ne se figent jamais pendant
     le téléchargement ni la transcription. À défaut de worker, il tourne dans la page. */
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
      const c = await caches.open('transformers-cache');
      modeleEnCache = (await c.keys()).some((r) => r.url.includes('whisper-base') && r.url.includes('decoder_model_merged'));
    } catch (e) {
      modeleEnCache = false;
    }
    return modeleEnCache;
  }
  const OPTIONS = { language: 'french', task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 };
  const CHARGEMENT = `async (pipeline, progres) => {
    const fichiers = {};
    const p = await pipeline('automatic-speech-recognition', '${MODELE}', {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: (x) => {
        if (x.status !== 'progress' || !x.total) return;
        fichiers[x.file] = [x.loaded, x.total];
        const v = Object.values(fichiers);
        const total = v.reduce((n, y) => n + y[1], 0);
        if (total > 2e7) progres(Math.min(99, Math.round((v.reduce((n, y) => n + y[0], 0) / total) * 100)));
      },
    });
    await p(new Float32Array(8000), { language: 'french', task: 'transcribe' }).catch(() => {}); // échauffement
    return p;
  }`;
  const WORKER = `import { pipeline, env } from '${LIB}';
    env.allowLocalModels = false;
    const charger = ${CHARGEMENT};
    let modele = null;
    self.onmessage = async (e) => {
      const m = e.data;
      try {
        modele = modele || charger(pipeline, (pct) => self.postMessage({ type: 'progres', pct }));
        const asr = await modele;
        if (m.type === 'init') return self.postMessage({ type: 'pret' });
        const out = await asr(m.audio, ${JSON.stringify(OPTIONS)});
        self.postMessage({ type: 'texte', id: m.id, texte: (out && out.text) || '' });
      } catch (err) {
        modele = null;
        self.postMessage({ type: 'erreur', id: m.id, message: String((err && err.message) || err) });
      }
    };`;

  let moteurPret = null; // promesse d'une fonction transcrire(audio) → texte
  function charger() {
    if (moteurPret) return moteurPret;
    moteurPret = viaWorker()
      .catch(() => dansLaPage())
      .then((f) => {
        pret = true;
        modeleEnCache = true;
        return f;
      })
      .catch((e) => {
        moteurPret = null;
        throw e;
      });
    return moteurPret;
  }
  function viaWorker() {
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
          ok((audio) =>
            new Promise((ok2, ko2) => {
              const id = ++n;
              attente.set(id, { ok2, ko2 });
              w.postMessage({ type: 'texte', id, audio }, [audio.buffer]);
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
      w.postMessage({ type: 'init' });
    });
  }
  async function dansLaPage() {
    const { pipeline, env } = await import(LIB);
    env.allowLocalModels = false;
    const p = await new Function(`return ${CHARGEMENT}`)()(pipeline, progres);
    return async (audio) => {
      await new Promise((r) => setTimeout(r, 30)); // laisse l'écran se mettre à jour avant le calcul
      const out = await p(audio, OPTIONS);
      return (out && out.text) || '';
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
      if (!(parle || (manuel && total > rate * 0.6))) {
        abonnes.delete(suivi);
        return cb.etat({ etape: 'erreur', message: MESSAGES.rien });
      }
      const brut = new Float32Array(total);
      let o = 0;
      morceaux.forEach((m) => {
        brut.set(m, o);
        o += m.length;
      });
      try {
        if (!pret) cb.etat({ etape: 'telechargement', pct: dernierPct, enregistre: false });
        const transcrire = await moteur16;
        abonnes.delete(suivi);
        cb.etat({ etape: 'transcription' });
        const t = propre(await transcrire(en16k(brut, rate)));
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
            if (duree >= 0.3) seuil = Math.min(0.05, Math.max(0.012, (calib.reduce((a, b) => a + b, 0) / calib.length) * 2.5));
          }
          const s0 = seuil == null ? 0.02 : seuil;
          if (cb.niveau) cb.niveau(Math.min(1, rms / (s0 * 4)));
          if (rms > s0) {
            parle = true;
            silence = 0;
          } else if (parle) {
            silence += dt;
            if (silence > 1.6) terminer(false); // on s'est tu : fin automatique
          }
          if (!parle && duree > 9) terminer(false);
          if (duree > 40) terminer(false);
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

  C.dictee = {
    possible: () => !!moteur(),
    moteur,
    taille: TAILLE,
    demarrer,
    pret: () => pret,
    dejaTelecharge,
    _charger: charger, // pour les essais
    _en16k: en16k,
  };
})();
