/* Commis — la cuisine 3D de l'accueil : la vraie cuisine de Lucas, en maquette.
   Pièce en coupe construite uniquement avec des formes arrondies (Three.js, gratuit, chargé depuis jsDelivr
   la première fois), d'après ses photos. Chaque objet ouvre une page : frigo → Frigo, livre → Recettes,
   table → Planning, cabas → Courses, courrier → Promotions, tirelire → Budget, casserole → le repas du soir.
   Les objets affichent des informations en direct (plat du soir sur l'ardoise, post-it du frigo, meilleure promo).
   Sans WebGL ou sans réseau, l'accueil revient tout seul à la vue résumé. */
(function () {
  'use strict';
  const C = window.C;
  let T = null; // THREE
  let RB = null; // RoundedBoxGeometry
  let loading = null;
  let K = null; // état de la scène (créée une seule fois, réattachée à chaque affichage de l'accueil)
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  C.k3d = {
    supported() {
      try {
        const c = document.createElement('canvas');
        return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
      } catch (e) {
        return false;
      }
    },
    mount(el, info) {
      loading =
        loading ||
        Promise.all([import('three'), import('three/addons/geometries/RoundedBoxGeometry.js')]).then(([t, rb]) => {
          T = t;
          RB = rb.RoundedBoxGeometry;
        });
      return loading
        .then(() => (document.fonts && document.fonts.load ? Promise.all([document.fonts.load('48px "Instrument Serif"'), document.fonts.load('600 24px "Instrument Sans"')]) : null))
        .then(() => {
          if (!el.isConnected) return;
          if (!K) build();
          attach(el, info);
        })
        .catch((e) => {
          console.warn('Cuisine 3D indisponible :', e);
          C.k3dFailed = true;
          if (C.route().view === 'accueil') C.render();
        });
    },
  };

  /* ---------- Palette (couleurs « Cuisine ») ---------- */
  const COL = {
    floor: '#EFD8BC', wallBack: '#F8E8DA', wallLeft: '#F1DBC9', base: '#FFF9F3', cab: '#CBDBBF', cabLine: '#B4C7A6',
    top: '#FBF6EF', wood: '#C99467', woodDark: '#A9764E', tomato: '#E4572E', tomatoDark: '#C4431D', cream: '#FFF8EF',
    steel: '#CFD4D6', ink: '#3A322C', sage: '#9DBA8A', sageDark: '#7C9C6A', butter: '#F4D98B', ciel: '#AFC8DD',
    peche: '#F6C6AB', pink: '#F3A99A', chalk: '#2F3B34', glass: '#DCEBF4',
  };

  /* ---------- Petites usines à formes ---------- */
  const mat = (color, o) => new T.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0, ...(o || {}) });
  const mesh = (geo, m, shadow = true) => {
    const x = new T.Mesh(geo, typeof m === 'string' ? mat(m) : m);
    x.castShadow = shadow;
    x.receiveShadow = true;
    return x;
  };
  const at = (o, x, y, z) => (o.position.set(x, y, z), o);
  const rbox = (w, h, d, r, color, o) => mesh(new RB(w, h, d, 4, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)), typeof color === 'string' ? mat(color, o) : color);
  const cyl = (rt, rb, h, color, seg = 40, o) => mesh(new T.CylinderGeometry(rt, rb, h, seg), typeof color === 'string' ? mat(color, o) : color);
  const ball = (r, color, o) => mesh(new T.SphereGeometry(r, 32, 18), typeof color === 'string' ? mat(color, o) : color);
  const group = (...kids) => {
    const g = new T.Group();
    kids.forEach((k) => k && g.add(k));
    return g;
  };

  // Texture dessinée sur un canvas (ardoise, post-it, prospectus, tranche du livre, parquet…)
  function paint(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = 8;
    const redraw = (fn) => {
      g.clearRect(0, 0, w, h);
      (fn || draw)(g, w, h);
      tex.needsUpdate = true;
    };
    redraw(draw);
    return { tex, redraw };
  }
  const wrap = (g, text, maxW) => {
    const words = String(text).split(' ');
    const lines = [];
    let line = '';
    words.forEach((w) => {
      const t = line ? line + ' ' + w : w;
      if (g.measureText(t).width > maxW && line) {
        lines.push(line);
        line = w;
      } else line = t;
    });
    if (line) lines.push(line);
    return lines;
  };
  const SERIF = '"Instrument Serif", Georgia, serif';
  const SANS = '"Instrument Sans", system-ui, sans-serif';

  /* ---------- Construction de la pièce (d'après les photos de la vraie cuisine, en mètres) ----------
     Mur du fond : la cuisine en ligne depuis l'angle (frigo sous plan, évier, four + plaque, tiroirs),
     crédence en carrelage métro taupe, meubles hauts vert d'eau, hotte blanche éclairée, porte de la salle de bain.
     Mur de gauche : la porte d'entrée bleue, le portemanteau avec son étagère, le banc à chaussures.
     Au sol : carrelage rosé posé en diagonale. Devant : la table en chêne clair et ses chaises blanches. */
  const W = { wall: '#F5F2EE', mint: '#BFD3CB', mintDoor: '#C6D9D1', marble: '#F4F2EF', tile: '#8E827C', blue: '#1D8DCB', frame: '#A3A8AB', oak: '#C6AE92', floor: '#E6CBBE' };

  function build() {
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.className = 'k3-canvas';

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(30, 1, 0.05, 60);

    scene.add(new T.HemisphereLight('#FFF6EC', '#D9C0B2', 1.3));
    const sun = new T.DirectionalLight('#FFEFE0', 1.9);
    sun.position.set(3.2, 6.5, 5);
    sun.castShadow = true;
    const sm = window.innerWidth < 760 ? 1024 : 2048;
    sun.shadow.mapSize.set(sm, sm);
    Object.assign(sun.shadow.camera, { left: -4.5, right: 4.5, top: 4.5, bottom: -4.5, near: 0.5, far: 16 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.015;
    scene.add(sun);
    const fill = new T.DirectionalLight('#F3F6FF', 0.45);
    fill.position.set(-3, 3, 4);
    scene.add(fill);

    const room = new T.Group();
    scene.add(room);

    const catcher = new T.Mesh(new T.PlaneGeometry(16, 16), new T.ShadowMaterial({ opacity: 0.12 }));
    catcher.rotation.x = -Math.PI / 2;
    catcher.position.y = -0.21;
    catcher.receiveShadow = true;
    room.add(catcher);
    const plane = (w, h, m) => {
      const p = new T.Mesh(new T.PlaneGeometry(w, h), m);
      p.receiveShadow = true;
      return p;
    };

    /* Sol : socle + carrelage rosé posé en diagonale */
    room.add(at(rbox(4.66, 0.2, 4.26, 0.06, '#D8BFB2'), -0.06, -0.1, -0.06));
    const floorTex = paint(1024, 932, (g, w, h) => {
      g.fillStyle = W.floor;
      g.fillRect(0, 0, w, h);
      const step = 74; // ≈ 32 cm par carreau
      g.save();
      g.translate(w / 2, h / 2);
      g.rotate(Math.PI / 4);
      for (let i = -12; i <= 12; i++)
        for (let j = -12; j <= 12; j++) {
          g.fillStyle = `hsl(18, ${30 + ((i * 7 + j * 3) & 3) * 2}%, ${84 + ((i * 5 + j * 11) & 3)}%)`;
          g.fillRect(i * step + 2, j * step + 2, step - 4, step - 4);
        }
      g.restore();
      g.globalCompositeOperation = 'destination-over';
      g.fillStyle = '#A99189';
      g.fillRect(0, 0, w, h);
    });
    const floor = plane(4.4, 4.0, mat('#ffffff', { map: floorTex.tex, roughness: 0.55 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0.002, 0);
    room.add(floor);

    /* Murs : fond (avec la porte de la salle de bain) et gauche (porte d'entrée) */
    room.add(at(rbox(3.42, 2.5, 0.12, 0.03, W.wall), -0.61, 1.25, -2.06));
    room.add(at(rbox(0.35, 2.5, 0.12, 0.03, W.wall), 2.025, 1.25, -2.06));
    room.add(at(rbox(0.75, 0.4, 0.12, 0.02, W.wall), 1.475, 2.3, -2.06));
    room.add(at(rbox(0.12, 2.5, 4.12, 0.03, W.wall), -2.26, 1.25, -0.06));
    // Plinthes en carrelage
    room.add(at(rbox(2.2, 0.07, 0.012, 0.004, '#D7B9AB'), 0, 0.035, -1.994)); // à droite de la cuisine (la cuisine couvre le reste)
    room.add(at(rbox(0.012, 0.07, 3.98, 0.004, '#D7B9AB'), -2.194, 0.035, 0.01));
    // Salle de bain : encadrement gris et pièce dans la pénombre
    room.add(at(rbox(0.75, 2.1, 0.02, 0.01, '#55615F'), 1.475, 1.05, -2.11));
    room.add(at(rbox(0.06, 2.13, 0.16, 0.02, W.frame), 1.08, 1.065, -2.0));
    room.add(at(rbox(0.06, 2.13, 0.16, 0.02, W.frame), 1.87, 1.065, -2.0));
    room.add(at(rbox(0.85, 0.06, 0.16, 0.02, W.frame), 1.475, 2.13, -2.0));

    /* Cuisine en ligne, de l'angle (x = -2.2) jusqu'à x = 0.45 */
    const K0 = -2.2;
    const K1 = 0.45;
    const KW = K1 - K0;
    const KX = (K0 + K1) / 2;
    // Crédence : carrelage métro taupe, joints clairs
    const subway = paint(1024, 212, (g, w, h) => {
      g.fillStyle = '#E2DBD5';
      g.fillRect(0, 0, w, h);
      const tw = 58;
      const th = 29;
      for (let r = 0; r * th < h; r++)
        for (let x = r % 2 ? -tw / 2 : 0; x < w; x += tw) {
          g.fillStyle = `hsl(20, 6%, ${50 + ((r * 3 + Math.round(x / tw)) % 4)}%)`;
          g.fillRect(x + 1.5, r * th + 1.5, tw - 3, th - 3);
        }
    });
    room.add(at(plane(KW, 0.55, mat('#ffffff', { map: subway.tex, roughness: 0.5 })), KX, 1.175, -1.994));

    // Meubles bas (vert d'eau), plan de travail en marbre blanc
    const low = (x0, x1) => room.add(at(rbox(x1 - x0, 0.84, 0.56, 0.02, W.mint), (x0 + x1) / 2, 0.44, -1.72));
    low(-1.6, -1.0);
    low(-1.0, -0.4);
    low(-0.4, 0.42);
    room.add(at(rbox(0.03, 0.86, 0.6, 0.01, '#FBFBFA'), 0.435, 0.43, -1.7)); // joue de fin
    const marble = paint(1024, 256, (g, w, h) => {
      g.fillStyle = W.marble;
      g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(150,150,155,0.18)';
      for (let i = 0; i < 26; i++) {
        g.lineWidth = 0.8 + Math.random() * 1.6;
        g.beginPath();
        let x = Math.random() * w;
        let y = Math.random() * h;
        g.moveTo(x, y);
        for (let k = 0; k < 4; k++) {
          x += 60 + Math.random() * 120;
          y += (Math.random() - 0.5) * 70;
          g.quadraticCurveTo(x - 40, y + (Math.random() - 0.5) * 50, x, y);
        }
        g.stroke();
      }
    });
    room.add(at(rbox(KW, 0.04, 0.63, 0.012, W.marble), KX, 0.88, -1.69));
    const top = plane(KW, 0.63, mat('#ffffff', { map: marble.tex, roughness: 0.35 }));
    top.rotation.x = -Math.PI / 2;
    top.position.set(KX, 0.9015, -1.69);
    room.add(top);

    // Façades
    const door = (w, h, x, y, color) => room.add(at(rbox(w, h, 0.02, 0.008, color || W.mintDoor), x, y, -1.43));
    const knob = (x, y, z) => room.add(at(ball(0.018, '#1E1D1C', { roughness: 0.4 }), x, y, z || -1.41));
    // Évier : façade avec bandeau à deux boutons ronds
    door(0.58, 0.62, -1.3, 0.34);
    door(0.58, 0.18, -1.3, 0.76);
    knob(-1.52, 0.6);
    [-1.36, -1.24].forEach((x) => {
      const ring = at(cyl(0.028, 0.028, 0.012, '#2A2A2A', 24), x, 0.76, -1.415);
      ring.rotation.x = Math.PI / 2;
      room.add(ring);
    });
    // Four encastré sous la plaque
    door(0.58, 0.12, -0.7, 0.06);
    room.add(at(rbox(0.58, 0.6, 0.02, 0.01, '#F1F1EF'), -0.7, 0.44, -1.43));
    room.add(at(rbox(0.46, 0.42, 0.012, 0.01, '#1B1A1A', { roughness: 0.25 }), -0.7, 0.4, -1.418));
    room.add(at(rbox(0.58, 0.12, 0.02, 0.01, '#F6F6F4'), -0.7, 0.8, -1.43));
    for (let i = 0; i < 5; i++) {
      const k = at(cyl(0.014, 0.014, 0.012, '#D7D7D5', 16), -0.9 + i * 0.1, 0.8, -1.415);
      k.rotation.x = Math.PI / 2;
      room.add(k);
    }
    room.add(at(rbox(0.46, 0.022, 0.03, 0.01, '#E9E9E7', { roughness: 0.3, metalness: 0.2 }), -0.7, 0.66, -1.4));
    room.add(at(rbox(0.15, 0.42, 0.012, 0.006, '#4A4644'), -0.62, 0.46, -1.385)); // torchon
    // Colonne de tiroirs
    [
      [0.765, 0.18],
      [0.5, 0.31],
      [0.185, 0.3],
    ].forEach(([y, h]) => {
      door(0.8, h, 0.01, y);
      knob(0.01, y + h / 2 - 0.05);
    });

    // Évier inox, robinet, égouttoir, cafetière et bouilloire
    room.add(at(rbox(0.5, 0.012, 0.42, 0.04, '#C9CFD2', { roughness: 0.35, metalness: 0.4 }), -1.3, 0.906, -1.72));
    room.add(at(rbox(0.4, 0.006, 0.32, 0.04, '#9EA7AB', { roughness: 0.3, metalness: 0.4 }), -1.3, 0.912, -1.72));
    const steel = (o) => mat('#C8CDD0', { roughness: 0.3, metalness: 0.6, ...(o || {}) });
    room.add(at(cyl(0.02, 0.022, 0.26, steel(), 16), -1.3, 1.03, -1.95));
    const spout = at(cyl(0.015, 0.015, 0.2, steel(), 12), -1.3, 1.15, -1.86);
    spout.rotation.x = Math.PI / 2.4;
    room.add(spout);
    room.add(at(rbox(0.36, 0.014, 0.4, 0.01, '#2B2B2B'), -1.78, 0.907, -1.72));
    const pan = at(cyl(0.13, 0.11, 0.06, '#222222', 28), -1.8, 0.99, -1.8);
    pan.rotation.x = -0.9;
    room.add(pan);
    const lid = at(cyl(0.12, 0.12, 0.008, mat('#CFE0E6', { transparent: true, opacity: 0.5, roughness: 0.1 }), 28), -1.72, 0.96, -1.6);
    lid.rotation.z = 0.5;
    room.add(lid);
    room.add(at(rbox(0.07, 0.11, 0.05, 0.01, '#E8603F'), -1.58, 0.97, -1.95)); // éponge et liquide vaisselle
    room.add(at(rbox(0.2, 0.32, 0.24, 0.03, '#1E1E1F', { roughness: 0.4 }), -2.06, 1.06, -1.86)); // cafetière
    const kettle = group(at(cyl(0.075, 0.085, 0.2, steel(), 24), 0, 0.1, 0), at(mesh(new T.TorusGeometry(0.06, 0.012, 8, 20, Math.PI), mat('#222')), 0, 0.2, 0));
    room.add(at(kettle, -2.04, 0.9, -1.58));

    // Plan de droite : huile d'olive, bloc à couteaux, cloche en verre, bougie
    const oil = group(at(cyl(0.035, 0.035, 0.2, mat('#5E6A2A', { transparent: true, opacity: 0.85, roughness: 0.15 }), 18), 0, 0.1, 0), at(cyl(0.016, 0.02, 0.07, mat('#3F4520'), 12), 0, 0.235, 0));
    room.add(at(oil, -0.28, 0.9, -1.9));
    const block = at(rbox(0.11, 0.2, 0.15, 0.015, '#3B2F28'), -0.12, 1.0, -1.9);
    block.rotation.x = -0.25;
    room.add(block);
    for (let i = 0; i < 4; i++) room.add(at(rbox(0.018, 0.09, 0.03, 0.006, '#151414'), -0.155 + i * 0.024, 1.14, -1.93));
    room.add(at(cyl(0.11, 0.11, 0.025, '#2A2827', 28), 0.12, 0.915, -1.86));
    const dome = mesh(new T.CapsuleGeometry(0.1, 0.12, 8, 24), new T.MeshStandardMaterial({ color: '#EAF3F5', transparent: true, opacity: 0.28, roughness: 0.05 }), false);
    room.add(at(dome, 0.12, 1.06, -1.86));
    room.add(at(ball(0.05, '#6E8B5A'), 0.12, 0.96, -1.86));
    room.add(at(cyl(0.035, 0.035, 0.07, mat('#F5D3DA', { transparent: true, opacity: 0.85 }), 18), 0.0, 0.935, -1.6));

    // Meubles hauts vert d'eau, hotte blanche éclairée
    const highY0 = 1.45;
    const high = (x0, x1, y0) => room.add(at(rbox(x1 - x0, 2.2 - y0, 0.34, 0.015, W.mint), (x0 + x1) / 2, (2.2 + y0) / 2, -1.83));
    high(K0, -0.95, highY0);
    high(-0.95, -0.35, 1.76);
    high(-0.35, K1, highY0);
    const hdoor = (x0, x1, y0, kx) => {
      room.add(at(rbox(x1 - x0 - 0.012, 2.2 - y0 - 0.012, 0.02, 0.008, W.mintDoor), (x0 + x1) / 2, (2.2 + y0) / 2, -1.65));
      room.add(at(ball(0.017, '#1E1D1C', { roughness: 0.4 }), kx, y0 + 0.07, -1.635));
    };
    hdoor(K0, -1.575, highY0, -1.63);
    hdoor(-1.575, -0.95, highY0, -1.52);
    hdoor(-0.95, -0.35, 1.76, -0.65);
    hdoor(-0.35, K1, highY0, -0.29);
    room.add(at(rbox(0.6, 0.11, 0.44, 0.02, '#F6F6F4'), -0.65, 1.7, -1.78));
    const glow = at(plane(0.34, 0.1, new T.MeshBasicMaterial({ color: '#FFE9C9' })), -0.65, 1.643, -1.72);
    glow.rotation.x = Math.PI / 2;
    room.add(glow);
    const hoodLight = new T.SpotLight('#FFD9A8', 5, 2.4, 0.95, 0.7, 1.4);
    hoodLight.position.set(-0.65, 1.62, -1.75);
    hoodLight.target.position.set(-0.65, 0.9, -1.65);
    room.add(hoodLight, hoodLight.target);
    // Affiche (abstraite) sur la joue du meuble haut
    const posterTex = paint(256, 384, (g, w, h) => {
      const grd = g.createLinearGradient(0, 0, w, h);
      grd.addColorStop(0, '#E0507A');
      grd.addColorStop(1, '#8E1D3D');
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(20,10,15,0.75)';
      [[80, 210, 46], [150, 190, 40], [118, 270, 52], [190, 260, 34]].forEach(([x, y, r]) => {
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      });
      g.fillStyle = '#FFE4EC';
      g.fillRect(22, 22, w - 44, 30);
      g.fillStyle = '#8E1D3D';
      g.fillRect(30, 30, w - 60, 14);
    });
    const poster = at(plane(0.32, 0.48, mat('#ffffff', { map: posterTex.tex })), K1 + 0.004, 1.84, -1.82);
    poster.rotation.y = Math.PI / 2;
    room.add(poster);

    /* Mur de gauche : porte d'entrée bleue, tableau électrique, prises */
    const blueDoor = group(
      at(rbox(0.045, 2.04, 0.9, 0.01, W.blue, { roughness: 0.55 }), 0, 1.02, 0),
      at(rbox(0.05, 2.1, 0.055, 0.015, W.frame), -0.005, 1.05, -0.475),
      at(rbox(0.05, 2.1, 0.055, 0.015, W.frame), -0.005, 1.05, 0.475),
      at(rbox(0.05, 0.055, 1.0, 0.015, W.frame), -0.005, 2.1, 0),
      at(rbox(0.012, 0.18, 0.04, 0.006, '#C9CDD0', { metalness: 0.5, roughness: 0.3 }), 0.03, 1.02, 0.36),
      at(rbox(0.06, 0.02, 0.13, 0.008, '#C9CDD0', { metalness: 0.5, roughness: 0.3 }), 0.055, 1.07, 0.31)
    );
    room.add(at(blueDoor, -2.178, 0, -0.85));
    room.add(at(rbox(0.025, 0.28, 0.2, 0.01, '#FAFAF8'), -2.19, 2.05, -1.52)); // tableau électrique
    [-0.15, 0.0, 0.15].forEach((z) => room.add(at(rbox(0.015, 0.07, 0.07, 0.008, '#FAFAF8'), -2.192, 0.3, z)));

    /* Portemanteau : planche à patères, miroir étroit, étagère avec le tableau koï */
    for (let i = 0; i < 4; i++) {
      room.add(at(rbox(0.025, 0.72, 0.12, 0.008, '#FBFBFA'), -2.186, 1.42, 0.62 + i * 0.13));
      const hook = at(cyl(0.008, 0.008, 0.06, '#9A9A9A', 8), -2.15, 1.62, 0.62 + i * 0.13);
      hook.rotation.z = Math.PI / 2;
      room.add(hook);
    }
    room.add(at(rbox(0.02, 0.78, 0.2, 0.01, '#FBFBFA'), -2.188, 1.42, 1.22));
    const mir = at(plane(0.16, 0.7, mat('#C7D2D8', { roughness: 0.05, metalness: 0.6 })), -2.176, 1.42, 1.22);
    mir.rotation.y = Math.PI / 2;
    room.add(mir);
    room.add(at(rbox(0.2, 0.025, 0.8, 0.01, '#FBFBFA'), -2.1, 1.87, 0.86));
    const koi = paint(256, 256, (g, w, h) => {
      const grd = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.7);
      grd.addColorStop(0, '#2F7FB8');
      grd.addColorStop(1, '#0F3557');
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#F4EFE6';
      g.beginPath();
      g.ellipse(w / 2, h / 2, 34, 82, 0.15, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#D9482F';
      [[118, 100, 18], [140, 150, 14], [124, 178, 12]].forEach(([x, y, r]) => {
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      });
    });
    const painting = group(rbox(0.025, 0.34, 0.3, 0.008, '#0F3557'), at(plane(0.28, 0.32, mat('#ffffff', { map: koi.tex })), 0.014, 0, 0));
    painting.children[1].rotation.y = Math.PI / 2;
    painting.rotation.z = 0.08;
    room.add(at(painting, -2.17, 2.06, 0.72));
    room.add(at(cyl(0.025, 0.025, 0.07, '#1C1C1C', 12), -2.1, 1.92, 0.5)); // diffuseur
    for (let i = 0; i < 3; i++) {
      const stick = at(cyl(0.003, 0.003, 0.18, '#3A2C22', 6), -2.1 + (i - 1) * 0.01, 2.02, 0.5);
      stick.rotation.z = (i - 1) * 0.2;
      room.add(stick);
    }
    room.add(at(cyl(0.03, 0.03, 0.2, '#F2F2F0', 12), -2.1, 1.98, 1.18));
    // Manteaux sur les patères
    [
      [0.66, '#1E1F22', 1.0],
      [0.8, '#26272B', 1.1],
      [0.93, '#A11F31', 0.95],
      [1.03, '#18191B', 1.05],
    ].forEach(([z, c, s]) => {
      const coat = at(mesh(new T.CapsuleGeometry(0.12, 0.42, 8, 16), mat(c, { roughness: 0.95 })), -2.07, 1.3, z);
      coat.scale.set(0.8, s, 0.85);
      room.add(coat);
    });
    // Banc à chaussures blanc, coussin gris
    room.add(at(rbox(0.36, 0.45, 0.72, 0.02, '#FAFAF8'), -2.02, 0.225, 0.86));
    room.add(at(rbox(0.36, 0.04, 0.72, 0.015, '#6F7375'), -2.02, 0.47, 0.86));
    [0.32, 0.12].forEach((y) => room.add(at(rbox(0.004, 0.012, 0.62, 0.002, '#222'), -1.838, y, 0.86)));
    room.add(at(rbox(0.22, 0.34, 0.16, 0.06, '#1F2022'), -1.96, 0.17, 1.42)); // sac à dos
    room.add(at(rbox(0.12, 0.07, 0.26, 0.03, '#222'), -1.72, 0.035, 0.45)); // chaussures
    room.add(at(rbox(0.12, 0.07, 0.26, 0.03, '#222'), -1.58, 0.035, 0.48));

    /* Table en chêne clair, sets de table, tasses, lampe champignon, chaises blanches */
    const TX = 0.95;
    const TZ = 0.92;
    room.add(at(rbox(0.82, 0.04, 1.22, 0.012, W.oak), TX, 0.75, TZ));
    room.add(at(rbox(0.74, 0.08, 1.14, 0.01, '#B79E83'), TX, 0.69, TZ));
    [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ].forEach(([sx, sz]) => room.add(at(rbox(0.06, 0.73, 0.06, 0.01, W.oak), TX + sx * 0.37, 0.365, TZ + sz * 0.57)));
    [TZ - 0.27, TZ + 0.2].forEach((z) => {
      const mat0 = at(cyl(0.16, 0.16, 0.006, '#7D6F68', 40), TX, 0.773, z);
      mat0.scale.set(1.0, 1, 1.4);
      room.add(mat0);
    });
    room.add(at(cyl(0.045, 0.04, 0.1, '#D2343A', 20), TX + 0.02, 0.82, TZ + 0.2));
    room.add(at(cyl(0.04, 0.035, 0.08, '#3E9B55', 20), TX + 0.2, 0.81, TZ - 0.45));
    const lamp = group(at(cyl(0.07, 0.08, 0.02, '#FAFAF8', 24), 0, 0.01, 0), at(cyl(0.012, 0.016, 0.2, '#FAFAF8', 12), 0, 0.12, 0));
    const shade = at(mesh(new T.SphereGeometry(0.12, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat('#FFFFFF', { emissive: '#FFE6C4', emissiveIntensity: 0.55 })), 0, 0.2, 0);
    shade.scale.set(1, 0.55, 1);
    lamp.add(shade);
    room.add(at(lamp, TX - 0.22, 0.77, TZ + 0.46));
    const lampLight = new T.PointLight('#FFD8A6', 1.4, 2.2, 1.6);
    lampLight.position.set(TX - 0.22, 1.02, TZ + 0.46);
    room.add(lampLight);
    const chair = (x, z, face) => {
      const c = group(
        at(rbox(0.42, 0.025, 0.42, 0.012, '#FBFBFA'), 0, 0.46, 0),
        at(rbox(0.025, 0.42, 0.42, 0.012, '#FBFBFA'), -0.22, 0.72, 0)
      );
      c.children[1].rotation.z = -0.12;
      [
        [-0.17, -0.17],
        [0.17, -0.17],
        [-0.17, 0.17],
        [0.17, 0.17],
      ].forEach(([dx, dz]) => c.add(at(cyl(0.011, 0.011, 0.46, steel(), 8), dx, 0.23, dz)));
      c.rotation.y = face;
      room.add(at(c, x, 0, z));
      return c;
    };
    const left = chair(TX - 0.62, TZ, 0);
    chair(TX + 0.62, TZ - 0.28, Math.PI);
    chair(TX + 0.62, TZ + 0.3, Math.PI);
    const jacket = at(rbox(0.12, 0.5, 0.46, 0.05, '#23262B', { roughness: 0.95 }), -0.25, 0.62, 0);
    jacket.rotation.z = -0.1;
    left.add(jacket);

    const items = [];
    const add = (key, name, route, obj, anchor) => {
      obj.userData = { key, base: obj.position.clone() };
      obj.traverse((m) => (m.isMesh ? (m.userData.key = key) : null));
      room.add(obj);
      items.push({ key, name, route, obj, anchor: new T.Vector3(...anchor), h: 0, target: 0 });
    };

    /* Frigo sous plan, blanc, avec ses magnets et le post-it */
    const postit = paint(256, 256, () => {});
    const fridge = group(
      rbox(0.58, 0.84, 0.58, 0.02, '#FAFAF9'),
      at(rbox(0.5, 0.02, 0.012, 0.005, '#E4E4E2'), 0, 0.37, 0.292),
      at(plane(0.17, 0.17, mat('#ffffff', { map: postit.tex })), 0.12, 0.12, 0.292),
      at(rbox(0.06, 0.07, 0.008, 0.003, '#9B6F57'), -0.17, 0.2, 0.293),
      at(rbox(0.055, 0.07, 0.008, 0.003, '#7AA0C2'), -0.08, 0.2, 0.293)
    );
    fridge.children[2].castShadow = false;
    add('frigo', 'Frigo', '#/frigo', at(fridge, -1.89, 0.42, -1.71), [-1.89, 0.86, -1.4]);

    /* Plaque à induction et casserole : le repas du soir */
    const stove = group(
      at(rbox(0.6, 0.008, 0.52, 0.01, '#B9BEC0', { metalness: 0.4, roughness: 0.3 }), 0, 0.0, 0),
      at(rbox(0.57, 0.012, 0.49, 0.01, '#141313', { roughness: 0.15 }), 0, 0.006, 0),
      at(cyl(0.135, 0.12, 0.15, '#3A3C3F', 32, { roughness: 0.35, metalness: 0.3 }), -0.08, 0.087, -0.02),
      at(cyl(0.14, 0.14, 0.012, '#2F3133', 32, { roughness: 0.35, metalness: 0.3 }), -0.08, 0.168, -0.02),
      at(ball(0.018, '#151515'), -0.08, 0.18, -0.02),
      at(rbox(0.05, 0.02, 0.03, 0.008, '#1D1E20'), -0.235, 0.14, -0.02),
      at(rbox(0.05, 0.02, 0.03, 0.008, '#1D1E20'), 0.075, 0.14, -0.02)
    );
    [
      [0.14, 0.12],
      [0.14, -0.12],
      [-0.14, 0.13],
    ].forEach(([dx, dz]) => {
      const r = at(mesh(new T.TorusGeometry(0.075, 0.004, 6, 32), mat('#3B3A39')), dx, 0.013, dz);
      r.rotation.x = Math.PI / 2;
      stove.add(r);
    });
    add('cuisiner', 'Ce soir', '#/planning', at(stove, -0.7, 0.906, -1.7), [-0.78, 1.25, -1.72]);
    const steam = [];
    for (let i = 0; i < 4; i++) {
      const s = new T.Mesh(new T.SphereGeometry(0.035, 14, 10), new T.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0, depthWrite: false }));
      room.add(s);
      steam.push(s);
    }

    /* Livre de recettes debout contre la crédence */
    const cover = paint(256, 352, (g, w, h) => {
      g.fillStyle = COL.tomato;
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#FFE9DF';
      g.fillRect(20, 20, w - 40, 4);
      g.fillRect(20, h - 24, w - 40, 4);
      g.fillStyle = '#FFFFFF';
      g.font = `italic 64px ${SERIF}`;
      g.textAlign = 'center';
      g.fillText('Recettes', w / 2, h / 2);
      g.font = `600 20px ${SANS}`;
      g.fillText('COMMIS', w / 2, h / 2 + 46);
    });
    const bookMats = [mat(COL.tomatoDark), mat(COL.tomatoDark), mat('#F3E9DD'), mat('#F3E9DD'), mat('#ffffff', { map: cover.tex }), mat(COL.tomato)];
    const book = new T.Mesh(new T.BoxGeometry(0.22, 0.3, 0.035), bookMats);
    book.castShadow = book.receiveShadow = true;
    const bookG = group(at(book, 0, 0.15, 0));
    bookG.rotation.x = -0.16;
    add('recettes', 'Recettes', '#/recettes', at(bookG, 0.3, 0.9, -1.93), [0.3, 1.3, -1.9]);

    /* Courrier sur le banc : les prospectus des promotions */
    const flyer = paint(384, 512, () => {});
    const flyerMesh = plane(0.2, 0.27, mat('#ffffff', { map: flyer.tex, roughness: 0.9 }));
    flyerMesh.rotation.x = -Math.PI / 2;
    const flyers = group(at(rbox(0.2, 0.006, 0.27, 0.003, '#FFF1C2'), 0.015, 0, 0.02), at(flyerMesh, 0, 0.0045, 0));
    flyers.rotation.y = Math.PI / 2 + 0.15;
    add('promotions', 'Promotions', '#/promotions', at(flyers, -2.0, 0.493, 0.72), [-2.0, 0.66, 0.72]);

    /* Tirelire sur l'étagère du portemanteau */
    const pig = group();
    const body = at(ball(0.075, COL.pink, { roughness: 0.55 }), 0, 0.07, 0);
    body.scale.set(1.15, 0.95, 0.9);
    pig.add(body);
    const snout = at(cyl(0.024, 0.026, 0.025, '#F19484', 16), 0.09, 0.07, 0);
    snout.rotation.z = Math.PI / 2;
    pig.add(snout);
    [-1, 1].forEach((s) => {
      pig.add(at(mesh(new T.ConeGeometry(0.018, 0.03, 10), mat('#F19484')), 0.045, 0.135, 0.03 * s));
      pig.add(at(cyl(0.013, 0.013, 0.025, '#F19484', 8), 0.045, 0.012, 0.04 * s));
      pig.add(at(cyl(0.013, 0.013, 0.025, '#F19484', 8), -0.045, 0.012, 0.04 * s));
      pig.add(at(ball(0.007, COL.ink), 0.075, 0.095, 0.025 * s));
    });
    pig.rotation.y = -0.2;
    add('budget', 'Budget', '#/budget', at(pig, -2.08, 1.883, 1.0), [-2.08, 2.12, 1.0]);

    /* Le planning sur la table : un chevalet « Ce soir » */
    const card = paint(512, 320, () => {});
    const tent = group();
    [-1, 1].forEach((s) => {
      const p = plane(0.22, 0.14, s > 0 ? mat('#ffffff', { map: card.tex, side: T.FrontSide }) : mat('#F6F1EA'));
      p.position.set(0, 0.065, s * 0.03);
      p.rotation.x = s * -0.38;
      if (s < 0) p.rotation.y = Math.PI;
      tent.add(p);
    });
    tent.rotation.y = 0.55;
    const tableObj = group(at(tent, 0, 0, 0));
    add('planning', 'Planning', '#/planning', at(tableObj, TX + 0.12, 0.772, TZ - 0.02), [TX, 1.05, TZ - 0.02]);

    /* Cabas à feuillage vert, au sol près du banc : les courses */
    const leaves = paint(256, 256, (g, w, h) => {
      g.fillStyle = '#FBFBF7';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) {
        g.save();
        g.translate(Math.random() * w, Math.random() * h);
        g.rotate(Math.random() * Math.PI);
        g.fillStyle = i % 3 ? '#2F7A45' : '#5DA36A';
        g.beginPath();
        g.ellipse(0, 0, 9, 24, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    });
    const leafMat = mat('#ffffff', { map: leaves.tex, roughness: 0.9 });
    const bag = group(at(rbox(0.38, 0.34, 0.16, 0.03, leafMat), 0, 0.17, 0), at(mesh(new T.TorusGeometry(0.09, 0.012, 8, 24, Math.PI), mat('#2F7A45')), -0.08, 0.34, 0), at(mesh(new T.TorusGeometry(0.09, 0.012, 8, 24, Math.PI), mat('#2F7A45')), 0.08, 0.34, 0));
    const bread = at(mesh(new T.CapsuleGeometry(0.03, 0.34, 6, 12), mat('#E2B172')), 0.08, 0.44, 0.0);
    bread.rotation.z = -0.3;
    const leek = group(at(cyl(0.022, 0.022, 0.18, '#F4F1E4', 12), 0, 0, 0), at(cyl(0.028, 0.012, 0.16, COL.sage, 12), 0, 0.17, 0));
    leek.rotation.z = 0.35;
    bag.add(bread, at(leek, -0.08, 0.42, 0.02));
    bag.rotation.y = 0.5;
    add('courses', 'Courses', '#/courses', at(bag, -1.55, 0, 1.55), [-1.55, 0.72, 1.55]);

    K = { renderer, scene, camera, room, items, steam, textures: { postit, card, flyer }, el: null, info: null, ray: new T.Raycaster(), pointer: new T.Vector2(), hover: null, off: { az: 0, el: 0 }, offT: { az: 0, el: 0 }, anim: null, raf: 0, t0: performance.now(), size: { w: 1, h: 1 } };
  }

  /* ---------- Textures en direct ---------- */
  function drawLive(info) {
    const { postit, card, flyer } = K.textures;
    postit.redraw((g, w, h) => {
      g.fillStyle = '#FBEFC4';
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(0,0,0,0.06)';
      g.fillRect(0, 0, w, 26);
      g.fillStyle = '#3A322C';
      g.font = `600 24px ${SANS}`;
      g.fillText(info.soon.length ? 'À manger vite' : 'Au frigo', 18, 62);
      g.font = `34px ${SERIF}`;
      const list = info.soon.length ? info.soon.slice(0, 3) : [`${info.fridge} aliment${info.fridge > 1 ? 's' : ''}`];
      list.forEach((t, i) => g.fillText(String(t).slice(0, 16), 18, 110 + i * 42));
    });
    card.redraw((g, w, h) => {
      g.fillStyle = '#FFFDF9';
      g.fillRect(0, 0, w, h);
      g.fillStyle = COL.tomato;
      g.fillRect(0, 0, w, 14);
      g.fillStyle = '#8A7E76';
      g.font = `600 30px ${SANS}`;
      g.fillText(info.next ? info.next.when.toUpperCase() : 'CETTE SEMAINE', 34, 70);
      g.fillStyle = '#2B2622';
      g.font = `italic 58px ${SERIF}`;
      wrap(g, info.next ? info.next.name : 'Rien de prévu', w - 68)
        .slice(0, 3)
        .forEach((l, i) => g.fillText(l, 34, 140 + i * 58));
    });
    flyer.redraw((g, w, h) => {
      g.fillStyle = '#FFFFFF';
      g.fillRect(0, 0, w, h);
      g.fillStyle = COL.tomato;
      g.fillRect(0, 0, w, 96);
      g.fillStyle = '#FFFFFF';
      g.font = `700 44px ${SANS}`;
      g.fillText('ACTIONS', 28, 64);
      g.fillStyle = COL.tomato;
      g.font = `italic 120px ${SERIF}`;
      g.fillText(info.best ? `−${info.best.pct}%` : `${info.promos}`, 26, 250);
      g.fillStyle = '#3A322C';
      g.font = `30px ${SERIF}`;
      wrap(g, info.best ? `${info.best.name}, ${info.best.store}` : 'promotions cette semaine', w - 56)
        .slice(0, 3)
        .forEach((l, i) => g.fillText(l, 28, 316 + i * 38));
      g.fillStyle = '#F4D98B';
      g.fillRect(28, h - 70, w - 56, 34);
    });
  }

  const infoLine = (key, i) =>
    ({
      frigo: i.soon.length ? `${i.soon.length} à consommer bientôt` : `${i.fridge} aliment${i.fridge > 1 ? 's' : ''}`,
      recettes: `${i.recipes} recettes${i.toTest ? ` · ${i.toTest} à tester` : ''}`,
      planning: `${i.meals} repas sur 14`,
      courses: i.shopLeft ? `${i.shopLeft} produit${i.shopLeft > 1 ? 's' : ''} à acheter` : 'Liste à jour',
      promotions: i.best ? `jusqu’à −${i.best.pct} % · ${i.promos} offres` : `${i.promos} offres`,
      budget: `${C.chf(i.savings)} économisés`,
      cuisiner: i.next ? i.next.name : 'Rien de prévu',
    })[key];

  /* ---------- Affichage dans la page ---------- */
  function attach(el, info) {
    K.el = el;
    K.info = info;
    const cook = K.items.find((x) => x.key === 'cuisiner');
    cook.route = info.next ? `#/recettes/${info.next.id}` : '#/planning';
    cook.name = info.next ? (info.next.when.startsWith('Aujourd') ? 'Ce soir' : 'Prochain repas') : 'Cuisinière';
    drawLive(info);
    el.appendChild(K.renderer.domElement);
    // Étiquettes
    const labels = el.parentNode.querySelector('.k3-labels');
    labels.innerHTML = K.items.map((x) => `<button class="k3-pin" data-k="${x.key}" type="button"><b>${C.esc(x.name)}</b><small>${C.esc(infoLine(x.key, info))}</small></button>`).join('');
    K.pins = Object.fromEntries([...labels.querySelectorAll('.k3-pin')].map((b) => [b.dataset.k, b]));
    labels.onclick = (e) => {
      const b = e.target.closest('.k3-pin');
      if (b) open(b.dataset.k);
    };
    labels.onmouseover = (e) => {
      const b = e.target.closest('.k3-pin');
      setHover(b ? b.dataset.k : null);
    };
    labels.addEventListener('focusin', (e) => setHover(e.target.closest('.k3-pin')?.dataset.k || null));
    labels.onmouseleave = () => setHover(null);
    // Souris / doigt
    const cv = K.renderer.domElement;
    let down = null;
    cv.onpointermove = (e) => {
      const r = cv.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
      if (e.pointerType === 'mouse') {
        K.offT.az = -nx * 0.07;
        K.offT.el = ny * 0.035;
        setHover(pick(nx, ny));
      }
    };
    cv.onpointerleave = () => {
      K.offT.az = K.offT.el = 0;
      setHover(null);
    };
    cv.onpointerdown = (e) => (down = { x: e.clientX, y: e.clientY });
    cv.onpointerup = (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) return;
      const r = cv.getBoundingClientRect();
      const key = pick(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
      if (key) open(key);
    };
    if (!K.ro) {
      K.ro = new ResizeObserver(() => K.el && resize());
    }
    K.ro.disconnect();
    K.ro.observe(el);
    resize();
    K.anim = null;
    K.hover = null;
    K.items.forEach((x) => (x.h = x.target = 0));
    el.parentNode.classList.add('is-ready');
    start();
  }

  function pick(nx, ny) {
    K.pointer.set(nx, -ny);
    K.ray.setFromCamera(K.pointer, K.camera);
    const hit = K.ray.intersectObjects(K.items.map((x) => x.obj), true)[0];
    return hit ? hit.object.userData.key || null : null;
  }

  function setHover(key) {
    if (K.hover === key) return;
    K.hover = key;
    K.items.forEach((x) => (x.target = x.key === key ? 1 : 0));
    Object.entries(K.pins || {}).forEach(([k, b]) => b.classList.toggle('is-on', k === key));
    K.renderer.domElement.style.cursor = key ? 'pointer' : '';
  }

  // Clic : la caméra s'approche de l'objet, puis la page s'ouvre
  function open(key) {
    const it = K.items.find((x) => x.key === key);
    if (!it || K.anim) return;
    if (reduced()) return C.go(it.route);
    const from = K.camera.position.clone();
    const look = K.look.clone();
    const to = it.anchor.clone().add(from.clone().sub(it.anchor).normalize().multiplyScalar(2.0));
    K.anim = { t: performance.now(), from, to, look0: look, look1: it.anchor.clone().add(new T.Vector3(0, -0.2, 0)), route: it.route };
    setHover(key);
  }

  function resize() {
    const w = K.el.clientWidth || 1;
    const h = K.el.clientHeight || 1;
    K.size = { w, h };
    K.renderer.setSize(w, h, false);
    K.camera.aspect = w / h;
    // Cadrage : toute la pièce visible, plus serrée en portrait (téléphone)
    const portrait = w / h < 0.9;
    // Ordinateur : la pièce se place en bas à droite, le titre garde le coin supérieur gauche.
    K.base = portrait ? { az: 0.62, el: 0.5 } : { az: 0.7, el: 0.42 };
    K.look = portrait ? new T.Vector3(-0.3, 1.25, -0.05) : new T.Vector3(-0.55, 0.92, 0.0);
    const vf = (K.camera.fov * Math.PI) / 180;
    const hf = 2 * Math.atan(Math.tan(vf / 2) * K.camera.aspect);
    K.R = Math.max((portrait ? 2.4 : 2.62) / Math.tan(vf / 2), (portrait ? 2.85 : 4.0) / Math.tan(hf / 2));
    K.camera.updateProjectionMatrix();
  }

  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function frame(now) {
    if (!K.el || !K.el.isConnected) return stop();
    K.raf = requestAnimationFrame(frame);
    if (document.hidden) return;
    const t = (now - K.t0) / 1000;
    const calm = reduced();
    // Léger balancement sur écran tactile (pas de souris)
    if (!finePointer() && !calm) {
      K.offT.az = Math.sin(t * 0.35) * 0.035;
      K.offT.el = Math.sin(t * 0.27) * 0.012;
    }
    K.off.az += (K.offT.az - K.off.az) * 0.06;
    K.off.el += (K.offT.el - K.off.el) * 0.06;
    const az = K.base.az + K.off.az;
    const el = K.base.el + K.off.el;
    const cam = K.camera;
    if (K.anim) {
      const p = Math.min(1, (now - K.anim.t) / 700);
      const e = ease(p);
      cam.position.lerpVectors(K.anim.from, K.anim.to, e);
      cam.lookAt(new T.Vector3().lerpVectors(K.anim.look0, K.anim.look1, e));
      if (p >= 1) {
        const route = K.anim.route;
        K.anim = null;
        C.go(route);
        return;
      }
    } else {
      cam.position.set(K.look.x + K.R * Math.cos(el) * Math.sin(az), K.look.y + K.R * Math.sin(el), K.look.z + K.R * Math.cos(el) * Math.cos(az));
      cam.lookAt(K.look);
    }
    // Survol : l'objet se soulève un peu et se réchauffe
    K.items.forEach((x) => {
      x.h += (x.target - x.h) * 0.18;
      const o = x.obj;
      o.position.y = o.userData.base.y + 0.03 * x.h;
      o.scale.setScalar(1 + 0.035 * x.h);
      if (Math.abs(x.target - x.h) > 0.002 || x.h > 0.002)
        o.traverse((m) => {
          if (m.isMesh && m.material && m.material.emissive) {
            m.material.emissive.set('#E4572E');
            m.material.emissiveIntensity = 0.1 * x.h;
          }
        });
    });
    // Vapeur
    K.steam.forEach((s, i) => {
      const p = calm ? 0.4 : (t * 0.35 + i / K.steam.length) % 1;
      s.position.set(-0.78 + Math.sin(p * 6 + i) * 0.025, 1.1 + p * 0.42, -1.72);
      s.scale.setScalar(0.6 + p * 1.3);
      s.material.opacity = calm ? 0 : Math.sin(p * Math.PI) * 0.32;
    });
    K.renderer.render(K.scene, cam);
    placePins();
  }

  function placePins() {
    if (!K.pins) return;
    const v = new T.Vector3();
    K.items.forEach((x) => {
      const b = K.pins[x.key];
      if (!b) return;
      v.copy(x.anchor);
      v.y += 0.03 * x.h;
      v.project(K.camera);
      // Les étiquettes restent dans le cadre (petits écrans)
      const half = (b.offsetWidth || 80) / 2 + 8;
      const px = Math.min(K.size.w - half, Math.max(half, ((v.x + 1) / 2) * K.size.w));
      const py = Math.max((b.offsetHeight || 30) + 8, ((1 - v.y) / 2) * K.size.h);
      b.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) translate(-50%, -100%)`;
      b.style.opacity = K.anim ? '0' : '';
    });
  }

  function start() {
    cancelAnimationFrame(K.raf);
    K.raf = requestAnimationFrame(frame);
  }
  function stop() {
    cancelAnimationFrame(K.raf);
    if (K.ro) K.ro.disconnect();
    K.el = null;
    K.pins = null;
  }
})();
