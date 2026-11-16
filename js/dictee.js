/* Commis — dictée vocale, gratuite et sans clé.

   Deux moteurs :
     - « navigateur » : la reconnaissance vocale intégrée (Chrome, Safari, Edge) quand elle répond ;
     - « intégrée »   : Whisper (OpenAI, modèle libre) qui tourne directement sur l'appareil grâce à
       Transformers.js. Le modèle (~100 Mo avec le moteur) se télécharge une seule fois puis reste en cache ;
       l'audio ne quitte jamais l'appareil.
   Si la dictée du navigateur échoue (Safari sans dictée macOS, Brave, Arc, Firefox…), Commis propose
   la dictée intégrée et s'en souvient pour cet appareil. */
(function () {
  'use strict';
  const C = window.C;

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const CLE = 'commis-dictee'; // 'integree' quand la dictée du navigateur ne marche pas ici
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
  const micro = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  const moteur = () => (lire() === 'integree' || !SR ? (micro ? 'integree' : null) : 'navigateur');

  /* ---------- Modèle Whisper (chargé à la demande, une seule fois) ---------- */
  let asr = null;
  let chargement = null;
  let modeleEnCache = null;
  async function dejaTelecharge() {
    if (modeleEnCache != null) return modeleEnCache;
    try {
      const c = await caches.open('transformers-cache');
      modeleEnCache = (await c.keys()).some((r) => r.url.includes('whisper-base') && r.url.includes('decoder_model_merged'));
    } catch (e) {
      modeleEnCache = false;
    }
    return modeleEnCache;
  }
  function charger(progres) {
    if (asr) return Promise.resolve(asr);
    if (chargement) return chargement;
    const fichiers = {};
    chargement = import(LIB)
      .then(({ pipeline, env }) => {
        env.allowLocalModels = false;
        return pipeline('automatic-speech-recognition', MODELE, {
          dtype: 'q8',
          device: 'wasm',
          progress_callback: (p) => {
            if (p.status !== 'progress' || !p.total) return;
            fichiers[p.file] = [p.loaded, p.total];
            const v = Object.values(fichiers);
            const charge = v.reduce((n, x) => n + x[0], 0);
            const total = v.reduce((n, x) => n + x[1], 0);
            if (progres && total > 2e6) progres(Math.min(99, Math.round((charge / total) * 100)));
          },
        });
      })
      .then(async (p) => {
        // premier passage à vide : le vrai sera ensuite rapide (≈ 2 s pour une phrase)
        await p(new Float32Array(8000), { language: 'french', task: 'transcribe' }).catch(() => {});
        asr = p;
        modeleEnCache = true;
        return p;
      })
      .catch((e) => {
        chargement = null;
        throw e;
      });
    return chargement;
  }

  // Audio enregistré → échantillons 16 kHz mono, comme Whisper les attend
  async function echantillons(blob) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx({ sampleRate: 16000 });
    try {
      const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
      if (buf.numberOfChannels === 1) return buf.getChannelData(0);
      const a = buf.getChannelData(0);
      const b = buf.getChannelData(1);
      const m = new Float32Array(a.length);
      for (let k = 0; k < a.length; k++) m[k] = (a[k] + b[k]) / 2;
      return m;
    } finally {
      ctx.close && ctx.close();
    }
  }

  /* ---------- Messages ---------- */
  const SAFARI = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);
  const MESSAGES = {
    'not-allowed': 'La dictée du navigateur est refusée (micro ou service de dictée).',
    micro: 'Micro refusé. Autorisez-le pour ce site (icône à gauche de l’adresse), et sur Mac dans Réglages Système › Confidentialité et sécurité › Micro.',
    'service-not-allowed': SAFARI ? 'La dictée de Safari est désactivée sur ce Mac (Réglages Système › Clavier › Dictée).' : 'Ce navigateur n’a pas accès à son service de dictée.',
    network: 'Ce navigateur n’a pas accès à son service de dictée (c’est le cas de Brave, Arc, Opera…).',
    'language-not-supported': 'La dictée de ce navigateur ne gère pas le français.',
    'audio-capture': 'Aucun micro trouvé. Branchez-en un ou vérifiez celui choisi dans les réglages du Mac.',
    'no-speech': 'Je n’ai rien entendu. Parlez près du micro, puis touchez-le pour arrêter.',
    vide: 'La dictée du navigateur n’a rien renvoyé.',
  };
  const PROPOSER = new Set(['not-allowed', 'service-not-allowed', 'network', 'language-not-supported', 'vide']);

  /* ---------- Dictée ----------
     demarrer({ texte(t, final), etat(e) }) — e = { etape: 'ecoute' | 'telechargement' | 'transcription' | 'fini' | 'erreur',
     message, pct, proposer } ; renvoie { arreter() }. */
  function demarrer(cb) {
    const m = moteur();
    if (!m) {
      cb.etat({ etape: 'erreur', message: 'Ce navigateur ne permet pas d’enregistrer la voix. Utilisez la dictée du clavier (touche micro).' });
      return { arreter() {} };
    }
    return m === 'navigateur' ? navigateur(cb) : integree(cb);
  }

  function navigateur(cb, langue = 'fr-CH') {
    let rec;
    try {
      rec = new SR();
    } catch (e) {
      return integreeOuErreur(cb, 'vide');
    }
    let recu = false;
    let erreur = null;
    let stop = false;
    rec.lang = langue;
    rec.interimResults = true;
    rec.continuous = !SAFARI; // Safari s'arrête mal en continu
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      recu = true;
      let t = '';
      for (let k = 0; k < e.results.length; k++) t += e.results[k][0].transcript;
      cb.texte(t.trim(), false);
    };
    rec.onerror = (e) => {
      erreur = e.error;
    };
    rec.onend = () => {
      if (erreur === 'language-not-supported' && langue !== 'fr-FR') return navigateur(cb, 'fr-FR');
      if (erreur && erreur !== 'aborted' && erreur !== 'no-speech') return integreeOuErreur(cb, erreur);
      if (!recu && !stop && !erreur) return integreeOuErreur(cb, 'vide');
      if (!recu && erreur === 'no-speech') return cb.etat({ etape: 'erreur', message: MESSAGES['no-speech'] });
      cb.etat({ etape: 'fini' });
    };
    try {
      rec.start();
    } catch (e) {
      return integreeOuErreur(cb, 'vide');
    }
    cb.etat({ etape: 'ecoute', moteur: 'navigateur' });
    return {
      arreter() {
        stop = true;
        try {
          rec.stop();
        } catch (e) {
          /* déjà arrêté */
        }
      },
    };
  }

  function integreeOuErreur(cb, code) {
    const message = MESSAGES[code] || 'La dictée du navigateur s’est arrêtée.';
    if (PROPOSER.has(code) && micro) cb.etat({ etape: 'erreur', message: `${message} Commis a sa propre dictée, qui marche partout :`, proposer: true });
    else cb.etat({ etape: 'erreur', message });
    return { arreter() {} };
  }

  function integree(cb) {
    let mr = null;
    let flux = null;
    let fini = false;
    let minuterie = null;
    const morceaux = [];
    // le modèle se prépare pendant qu'on parle
    const pret = dejaTelecharge().then((ok) => charger(ok ? null : (pct) => cb.etat({ etape: 'telechargement', pct, enregistre: !!mr && mr.state === 'recording' })));
    pret.catch(() => {});
    navigator.mediaDevices
      .getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
      .then((s) => {
        flux = s;
        if (fini) return s.getTracks().forEach((t) => t.stop());
        mr = new MediaRecorder(s);
        mr.ondataavailable = (e) => e.data && e.data.size && morceaux.push(e.data);
        mr.onstop = async () => {
          flux.getTracks().forEach((t) => t.stop());
          clearTimeout(minuterie);
          if (!morceaux.length) return cb.etat({ etape: 'erreur', message: MESSAGES['no-speech'] });
          try {
            const audio = await echantillons(new Blob(morceaux, { type: mr.mimeType || 'audio/webm' }));
            if (audio.length < 16000 * 0.4) return cb.etat({ etape: 'erreur', message: MESSAGES['no-speech'] });
            if (!asr) cb.etat({ etape: 'telechargement', pct: null });
            const p = await pret;
            cb.etat({ etape: 'transcription' });
            const out = await p(audio, { language: 'french', task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 });
            const t = String((out && out.text) || '').replace(/\s+/g, ' ').trim();
            if (!t || /^\[.*\]$|^(sous-titr|merci d'avoir regard)/i.test(t)) return cb.etat({ etape: 'erreur', message: MESSAGES['no-speech'] });
            cb.texte(t, true);
            cb.etat({ etape: 'fini' });
          } catch (e) {
            cb.etat({ etape: 'erreur', message: /fetch|network|load/i.test(String(e && e.message)) ? 'Le modèle de dictée n’a pas pu être téléchargé. Vérifiez la connexion et réessayez.' : 'La transcription a échoué. Réessayez.' });
          }
        };
        mr.start(250);
        minuterie = setTimeout(() => mr && mr.state === 'recording' && mr.stop(), 45000); // 45 s au plus
        cb.etat({ etape: 'ecoute', moteur: 'integree' });
      })
      .catch((e) => {
        fini = true;
        cb.etat({ etape: 'erreur', message: e && e.name === 'NotFoundError' ? MESSAGES['audio-capture'] : MESSAGES.micro });
      });
    return {
      arreter() {
        fini = true;
        if (mr && mr.state === 'recording') mr.stop();
      },
    };
  }

  C.dictee = {
    possible: () => !!moteur(),
    moteur,
    taille: TAILLE,
    demarrer,
    utiliserIntegree() {
      ecrire('integree');
    },
    revenirNavigateur() {
      ecrire(null);
    },
    dejaTelecharge,
    _charger: charger, // pour les essais
    _echantillons: echantillons,
  };
})();
