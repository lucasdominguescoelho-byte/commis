/* Commis — la cuisine 3D de l'accueil : la vraie cuisine de Lucas, en maquette.
   Pièce en coupe construite uniquement avec des formes arrondies (Three.js, gratuit, chargé depuis jsDelivr
   la première fois), d'après ses photos. Chaque objet ouvre une page : frigo → Frigo, livre → Recettes,
   tableau de la semaine → Planning, cabas → Courses, prospectus sur la table → Promotions, tirelire → Budget, casserole → le repas du soir.
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
     Vue depuis le côté ouvert (le séjour), comme une maison de poupée à trois murs :
     au fond la porte d'entrée bleue ; à droite la cuisine en ligne (frigo sous plan, évier, four + plaque,
     tiroirs, crédence métro taupe, meubles hauts vert d'eau, hotte éclairée) ; à gauche le portemanteau et le
     banc dans l'angle, puis les rideaux, la table contre le mur sous le miroir rond, et ses quatre chaises.
     Au sol : carrelage rosé posé en diagonale. */
  const W = { wall: '#F5F2EE', mint: '#BFD3CB', mintDoor: '#C6D9D1', marble: '#F4F2EF', blue: '#1D8DCB', frame: '#A3A8AB', oak: '#C9B195', oakDark: '#B89E82', floor: '#E6CBBE', curtain: '#2C2724' };

  function build() {
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.className = 'k3-canvas';

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(30, 1, 0.05, 60);

    // La lumière entre par le côté ouvert (le séjour) pour que les trois murs restent éclairés.
    scene.add(new T.HemisphereLight('#FFEBD6', '#C89B80', 1.2));
    const sun = new T.DirectionalLight('#FFD2A0', 2.3); // soleil doré qui entre par le séjour
    sun.position.set(6.5, 4.6, 1.8);
    sun.castShadow = true;
    const sm = window.innerWidth < 760 ? 1024 : 2048;
    sun.shadow.mapSize.set(sm, sm);
    Object.assign(sun.shadow.camera, { left: -4.5, right: 4.5, top: 4.5, bottom: -4.5, near: 0.5, far: 18 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.015;
    scene.add(sun);
    const fill = new T.DirectionalLight('#FFF1E4', 0.35);
    fill.position.set(4, 3, -3);
    const ceiling = new T.PointLight('#FFD7AE', 1.6, 6, 1.2); // le plafonnier de la pièce
    ceiling.position.set(-0.4, 2.35, 0);
    scene.add(ceiling);
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
    const steel = (o) => mat('#C8CDD0', { roughness: 0.3, metalness: 0.6, ...(o || {}) });

    /* Sol : socle + carrelage rosé posé en diagonale */
    room.add(at(rbox(4.66, 0.2, 4.38, 0.06, '#D8BFB2'), -0.06, -0.1, 0));
    const floorTex = paint(1024, 932, (g, w, h) => {
      g.fillStyle = '#A99189';
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
    });
    const floor = plane(4.4, 4.0, mat('#ffffff', { map: floorTex.tex, roughness: 0.55 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0.002, 0);
    room.add(floor);

    /* Trois murs : cuisine (nord, z = -2), porte d'entrée (ouest, x = -2.2), table (sud, z = 2) */
    room.add(at(rbox(4.52, 2.5, 0.12, 0.03, W.wall), -0.06, 1.25, -2.06));
    room.add(at(rbox(0.12, 2.5, 4.24, 0.03, W.wall), -2.26, 1.25, 0));
    room.add(at(rbox(4.52, 2.5, 0.12, 0.03, W.wall), -0.06, 1.25, 2.06));
    const skirt = '#D7B9AB';
    room.add(at(rbox(0.55, 0.07, 0.012, 0.004, skirt), 1.925, 0.035, -1.994));
    room.add(at(rbox(0.012, 0.07, 3.98, 0.004, skirt), -2.194, 0.035, 0));
    room.add(at(rbox(4.38, 0.07, 0.012, 0.004, skirt), 0, 0.035, 1.994));

    /* Cuisine en ligne, de l'angle (x = -2.2) jusqu'à x = 1.65 (vers le séjour) */
    const K0 = -2.2;
    const K1 = 1.65;
    const KW = K1 - K0;
    const KX = (K0 + K1) / 2;
    const subway = paint(1024, 172, (g, w, h) => {
      g.fillStyle = '#E2DBD5';
      g.fillRect(0, 0, w, h);
      const tw = 47;
      const th = 23.5;
      for (let r = 0; r * th < h; r++)
        for (let x = r % 2 ? -tw / 2 : 0; x < w; x += tw) {
          g.fillStyle = `hsl(20, 6%, ${50 + ((r * 3 + Math.round(x / tw)) % 4)}%)`;
          g.fillRect(x + 1.2, r * th + 1.2, tw - 2.4, th - 2.4);
        }
    });
    room.add(at(plane(KW, 0.55, mat('#ffffff', { map: subway.tex, roughness: 0.5 })), KX, 1.175, -1.994));

    const low = (x0, x1) => room.add(at(rbox(x1 - x0, 0.84, 0.56, 0.02, W.mint), (x0 + x1) / 2, 0.44, -1.72));
    low(-1.6, -1.0);
    low(-1.0, -0.4);
    low(-0.4, 0.42);
    low(0.42, 1.02);
    low(1.02, 1.62);
    room.add(at(rbox(0.03, 0.86, 0.6, 0.01, '#FBFBFA'), K1 - 0.015, 0.43, -1.7)); // joue de fin
    const marble = paint(1024, 256, (g, w, h) => {
      g.fillStyle = W.marble;
      g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(150,150,155,0.18)';
      for (let i = 0; i < 30; i++) {
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

    const door = (w, h, x, y, color) => room.add(at(rbox(w, h, 0.02, 0.008, color || W.mintDoor), x, y, -1.43));
    const knob = (x, y) => room.add(at(ball(0.018, '#1E1D1C', { roughness: 0.4 }), x, y, -1.41));
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
    // Colonne de tiroirs, puis un dernier meuble à porte
    [
      [0.765, 0.18],
      [0.5, 0.31],
      [0.185, 0.3],
    ].forEach(([y, h]) => {
      door(0.8, h, 0.01, y);
      knob(0.01, y + h / 2 - 0.05);
    });
    door(0.58, 0.8, 0.72, 0.44);
    knob(0.48, 0.74);
    door(0.58, 0.8, 1.32, 0.44);
    knob(1.56, 0.74);

    // Évier inox et robinet (rien autour), cafetière et bouilloire dans l'angle
    room.add(at(rbox(0.5, 0.012, 0.42, 0.04, '#C9CFD2', { roughness: 0.35, metalness: 0.4 }), -1.3, 0.906, -1.72));
    room.add(at(rbox(0.4, 0.006, 0.32, 0.04, '#9EA7AB', { roughness: 0.3, metalness: 0.4 }), -1.3, 0.912, -1.72));
    room.add(at(cyl(0.02, 0.022, 0.26, steel(), 16), -1.3, 1.03, -1.95));
    const spout = at(cyl(0.015, 0.015, 0.2, steel(), 12), -1.3, 1.15, -1.86);
    spout.rotation.x = Math.PI / 2.4;
    room.add(spout);
    room.add(at(rbox(0.2, 0.32, 0.24, 0.03, '#1E1E1F', { roughness: 0.4 }), -2.06, 1.06, -1.86)); // cafetière
    const kettle = group(at(cyl(0.075, 0.085, 0.2, steel(), 24), 0, 0.1, 0), at(mesh(new T.TorusGeometry(0.06, 0.012, 8, 20, Math.PI), mat('#222')), 0, 0.2, 0));
    room.add(at(kettle, -2.08, 0.9, -1.56));

    // Plan de droite, sobre : un pot à cuillères en bois près de la plaque, une planche à découper
    const crock = group(at(cyl(0.055, 0.05, 0.15, '#F2EEE6', 24, { roughness: 0.45 }), 0, 0.075, 0));
    [
      [-0.018, 0.2, 0.012],
      [0.02, -0.15, -0.01],
      [0.0, 0.05, 0.02],
    ].forEach(([dx, tilt, dz]) => {
      const spoon = group(at(cyl(0.007, 0.007, 0.26, W.oakDark, 8), 0, 0.13, 0), at(ball(0.022, W.oakDark), 0, 0.27, 0));
      spoon.children[1].scale.set(1, 1.5, 0.45);
      spoon.rotation.z = tilt;
      crock.add(at(spoon, dx, 0.02, dz));
    });
    room.add(at(crock, -0.25, 0.906, -1.86));
    const boardCut = group(rbox(0.3, 0.4, 0.022, 0.03, W.oak), at(rbox(0.07, 0.1, 0.022, 0.03, W.oak), 0, 0.23, 0));
    boardCut.rotation.x = -0.12;
    room.add(at(boardCut, 1.36, 1.11, -1.95));
    // Rouleau d'essuie-tout sous le meuble haut (comme sur la photo)
    const roll = at(cyl(0.05, 0.05, 0.24, '#FBFBFA', 20), 0.6, 1.36, -1.9);
    roll.rotation.z = Math.PI / 2;
    room.add(roll);

    // Meubles hauts vert d'eau, hotte blanche éclairée
    const high = (x0, x1, y0) => room.add(at(rbox(x1 - x0, 2.2 - y0, 0.34, 0.015, W.mint), (x0 + x1) / 2, (2.2 + y0) / 2, -1.83));
    high(K0, -0.95, 1.45);
    high(-0.95, -0.35, 1.76);
    high(-0.35, K1, 1.45);
    const hdoor = (x0, x1, y0, kx) => {
      room.add(at(rbox(x1 - x0 - 0.012, 2.2 - y0 - 0.012, 0.02, 0.008, W.mintDoor), (x0 + x1) / 2, (2.2 + y0) / 2, -1.65));
      room.add(at(ball(0.017, '#1E1D1C', { roughness: 0.4 }), kx, y0 + 0.07, -1.635));
    };
    hdoor(K0, -1.575, 1.45, -1.63);
    hdoor(-1.575, -0.95, 1.45, -1.52);
    hdoor(-0.95, -0.35, 1.76, -0.65);
    hdoor(-0.35, 0.35, 1.45, -0.29);
    hdoor(0.35, 1.0, 1.45, 0.41);
    hdoor(1.0, K1, 1.45, 1.59);
    room.add(at(rbox(0.6, 0.11, 0.44, 0.02, '#F6F6F4'), -0.65, 1.7, -1.78));
    const glow = at(plane(0.34, 0.1, new T.MeshBasicMaterial({ color: '#FFE9C9' })), -0.65, 1.643, -1.72);
    glow.rotation.x = Math.PI / 2;
    room.add(glow);
    const hoodLight = new T.SpotLight('#FFD9A8', 5, 2.4, 0.95, 0.7, 1.4);
    hoodLight.position.set(-0.65, 1.62, -1.75);
    hoodLight.target.position.set(-0.65, 0.9, -1.65);
    room.add(hoodLight, hoodLight.target);
    // Affiche encadrée sur la joue du meuble haut, côté séjour : une tomate, dessin simple
    const posterTex = paint(320, 480, (g, w, h) => {
      g.fillStyle = '#F7F0E6';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#DDE7D6';
      g.fillRect(0, h * 0.64, w, h * 0.36);
      g.fillStyle = COL.tomato;
      g.beginPath();
      g.ellipse(w / 2, h * 0.45, 92, 84, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.28)';
      g.beginPath();
      g.ellipse(w / 2 - 34, h * 0.4, 22, 34, -0.5, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#4E8A55';
      [-0.9, -0.3, 0.3, 0.9].forEach((a) => {
        g.save();
        g.translate(w / 2, h * 0.45 - 80);
        g.rotate(a);
        g.beginPath();
        g.ellipse(0, -16, 8, 22, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      });
      g.fillRect(w / 2 - 3, h * 0.45 - 112, 6, 26);
      g.fillStyle = COL.ink;
      g.textAlign = 'center';
      g.font = `italic 40px ${SERIF}`;
      g.fillText('Tomate', w / 2, h * 0.83);
      g.font = `600 13px ${SANS}`;
      g.fillText('MARCHÉ  ·  SAISON', w / 2, h * 0.9);
    });
    const poster = group(rbox(0.014, 0.52, 0.36, 0.006, W.oakDark), at(plane(0.3, 0.46, mat('#ffffff', { map: posterTex.tex, roughness: 0.8 })), 0.0075, 0, 0).rotateY(Math.PI / 2));
    room.add(at(poster, K1 + 0.008, 1.84, -1.82));

    /* Porte d'entrée bleue : vantail plein dans un huisserie grise, paumelles, poignée, clé */
    const DZ = -0.85; // centre de la porte sur le mur ouest
    const DH = 2.02;
    const doorG = group(
      at(rbox(0.04, DH, 0.86, 0.008, W.blue, { roughness: 0.5 }), 0.012, DH / 2 + 0.005, 0), // vantail
      at(rbox(0.05, DH + 0.07, 0.07, 0.012, W.frame), 0.02, (DH + 0.07) / 2, -0.465), // montant côté paumelles
      at(rbox(0.05, DH + 0.07, 0.07, 0.012, W.frame), 0.02, (DH + 0.07) / 2, 0.465), // montant côté poignée
      at(rbox(0.05, 0.07, 1.0, 0.012, W.frame), 0.02, DH + 0.04, 0), // traverse haute, posée sur le vantail
      at(rbox(0.04, 0.012, 0.86, 0.004, '#8C9093'), 0.03, 0.006, 0) // seuil
    );
    [0.25, 1.05, 1.8].forEach((y) => doorG.add(at(cyl(0.011, 0.011, 0.09, '#9EA2A5', 10), 0.04, y, -0.425)));
    const handle = group(
      at(rbox(0.012, 0.21, 0.045, 0.01, '#C9CDD0', { metalness: 0.55, roughness: 0.3 }), 0, 0, 0),
      at(cyl(0.011, 0.011, 0.05, '#C9CDD0', 12, { metalness: 0.55, roughness: 0.3 }), 0.025, 0.06, 0),
      at(rbox(0.02, 0.022, 0.13, 0.01, '#C9CDD0', { metalness: 0.55, roughness: 0.3 }), 0.05, 0.06, -0.055),
      at(rbox(0.006, 0.05, 0.012, 0.003, '#B6B9BB', { metalness: 0.6, roughness: 0.3 }), 0.012, -0.05, 0),
      at(rbox(0.004, 0.045, 0.03, 0.008, '#F5F5F3'), 0.016, -0.1, 0.008)
    );
    handle.children[1].rotation.z = Math.PI / 2;
    doorG.add(at(handle, 0.038, 1.0, 0.36));
    room.add(at(doorG, -2.2, 0, DZ));
    room.add(at(rbox(0.025, 0.28, 0.2, 0.01, '#FAFAF8'), -2.19, 2.05, -1.52)); // tableau électrique
    [0.25, 0.4, 0.55].forEach((z) => room.add(at(rbox(0.015, 0.07, 0.07, 0.008, '#FAFAF8'), -2.192, 0.3, z))); // prises

    /* Mur sud (à gauche) : portemanteau et banc dans l'angle, rideaux, miroir rond, table */
    const SZ = 2.0; // face intérieure du mur sud
    // Planche à patères (lattes verticales) et miroir étroit
    for (let i = 0; i < 4; i++) {
      room.add(at(rbox(0.12, 0.72, 0.025, 0.008, '#FBFBFA'), -2.02 + i * 0.13, 1.42, SZ - 0.014));
      const hook = at(cyl(0.008, 0.008, 0.06, '#9A9A9A', 8), -2.02 + i * 0.13, 1.62, SZ - 0.05);
      hook.rotation.x = Math.PI / 2;
      room.add(hook);
    }
    room.add(at(rbox(0.2, 0.78, 0.02, 0.01, '#FBFBFA'), -1.42, 1.42, SZ - 0.012));
    room.add(at(plane(0.16, 0.7, mat('#C7D2D8', { roughness: 0.05, metalness: 0.6 })), -1.42, 1.42, SZ - 0.024).rotateY(Math.PI));
    // Étagère : tableau koï, diffuseur, et la tirelire (objet cliquable plus bas)
    room.add(at(rbox(0.82, 0.025, 0.2, 0.01, '#FBFBFA'), -1.8, 1.87, SZ - 0.1));
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
    const painting = group(rbox(0.3, 0.34, 0.025, 0.008, '#0F3557'), at(plane(0.28, 0.32, mat('#ffffff', { map: koi.tex })), 0, 0, -0.014).rotateY(Math.PI));
    painting.rotation.x = 0.08;
    room.add(at(painting, -1.95, 2.06, SZ - 0.04));
    room.add(at(cyl(0.025, 0.025, 0.07, '#1C1C1C', 12), -1.62, 1.92, SZ - 0.1));
    for (let i = 0; i < 3; i++) {
      const stick = at(cyl(0.003, 0.003, 0.18, '#3A2C22', 6), -1.62 + (i - 1) * 0.01, 2.02, SZ - 0.1);
      stick.rotation.x = (i - 1) * 0.2;
      room.add(stick);
    }
    // Manteaux sur les patères
    [
      [-2.0, '#1E1F22', 1.0],
      [-1.86, '#26272B', 1.1],
      [-1.74, '#A11F31', 0.95],
      [-1.63, '#18191B', 1.05],
    ].forEach(([x, c, s]) => {
      const coat = at(mesh(new T.CapsuleGeometry(0.12, 0.42, 8, 16), mat(c, { roughness: 0.95 })), x, 1.3, SZ - 0.13);
      coat.scale.set(0.85, s, 0.8);
      room.add(coat);
    });
    // Banc à chaussures blanc à coussin gris, sous les patères
    room.add(at(rbox(0.72, 0.45, 0.36, 0.02, '#FAFAF8'), -1.82, 0.225, SZ - 0.18));
    room.add(at(rbox(0.72, 0.04, 0.36, 0.015, '#6F7375'), -1.82, 0.47, SZ - 0.18));
    [0.32, 0.12].forEach((y) => room.add(at(rbox(0.62, 0.012, 0.004, 0.002, '#222'), -1.82, y, SZ - 0.362)));

    // Rideaux sombres de part et d'autre du mur de la table, sur une tringle
    const curtain = (x0, x1) => {
      const n = 7;
      const w = (x1 - x0) / n;
      for (let i = 0; i < n; i++) {
        const fold = at(cyl(w * 0.62, w * 0.62, 2.28, mat(W.curtain, { roughness: 1 }), 14), x0 + w * (i + 0.5), 1.19, SZ - 0.07);
        fold.scale.set(1, 1, 0.55);
        room.add(fold);
      }
    };
    curtain(-1.25, -0.5);
    curtain(0.9, 1.65);
    const rod = at(cyl(0.012, 0.012, 3.1, steel(), 10), 0.2, 2.36, SZ - 0.08);
    rod.rotation.z = Math.PI / 2;
    room.add(rod);
    // Miroir rond à bord festonné vert
    const MX = 0.2;
    const mirrorG = group(at(mesh(new T.CircleGeometry(0.32, 48), mat('#CBD6DC', { roughness: 0.06, metalness: 0.65 })), 0, 0, -0.012), at(mesh(new T.TorusGeometry(0.335, 0.014, 8, 64), mat('#2F5D4A')), 0, 0, -0.008));
    mirrorG.children[0].rotation.y = Math.PI;
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      mirrorG.add(at(ball(0.026, '#2F5D4A'), Math.cos(a) * 0.35, Math.sin(a) * 0.35, -0.008));
    }
    room.add(at(mirrorG, MX, 1.72, SZ));
    // Tableau « forêt de nuit » posé contre le mur, au bout de la table
    const forest = paint(320, 256, (g, w, h) => {
      const grd = g.createRadialGradient(w / 2, h * 0.6, 8, w / 2, h * 0.6, w * 0.6);
      grd.addColorStop(0, '#D9F1FF');
      grd.addColorStop(0.25, '#3F8FD0');
      grd.addColorStop(1, '#0B2347');
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(5,15,35,0.85)';
      [20, 60, 95, 220, 255, 295].forEach((x, i) => g.fillRect(x, 0, 12 + (i % 2) * 6, h));
      g.fillStyle = 'rgba(255,255,255,0.7)';
      for (let i = 0; i < 40; i++) g.fillRect(Math.random() * w, Math.random() * h * 0.6, 2, 2);
    });
    const canvasArt = group(rbox(0.46, 0.36, 0.025, 0.006, '#0B2347'), at(plane(0.44, 0.34, mat('#ffffff', { map: forest.tex })), 0, 0, -0.014).rotateY(Math.PI));
    canvasArt.rotation.x = 0.16;
    room.add(at(canvasArt, MX + 0.04, 0.95, SZ - 0.05));

    /* Table en chêne clair, le petit côté contre le mur, quatre chaises identiques */
    const TX = MX;
    const TL = 1.25; // longueur (vers le centre de la pièce)
    const TZ = SZ - TL / 2 - 0.01;
    const tableTop = 0.75;
    room.add(at(rbox(0.8, 0.035, TL, 0.01, W.oak), TX, tableTop - 0.0175, TZ));
    room.add(at(rbox(0.72, 0.075, TL - 0.1, 0.008, W.oakDark), TX, tableTop - 0.072, TZ));
    [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ].forEach(([sx, sz]) => room.add(at(rbox(0.065, tableTop - 0.035, 0.065, 0.008, W.oak), TX + sx * 0.36, (tableTop - 0.035) / 2, TZ + sz * (TL / 2 - 0.05))));
    // Chaise coque blanche, pieds chromés : un seul modèle, quatre fois
    const chair = () => {
      const c = group(
        at(rbox(0.43, 0.022, 0.42, 0.04, '#FBFBFA'), 0, 0.46, 0), // assise
        at(rbox(0.43, 0.06, 0.06, 0.025, '#FBFBFA'), 0, 0.49, -0.2), // galbe arrière de l'assise
        at(rbox(0.43, 0.42, 0.022, 0.04, '#FBFBFA'), 0, 0.73, -0.215) // dossier
      );
      c.children[2].rotation.x = -0.12;
      [
        [-0.18, -0.17],
        [0.18, -0.17],
        [-0.18, 0.17],
        [0.18, 0.17],
      ].forEach(([dx, dz]) => c.add(at(cyl(0.011, 0.011, 0.45, steel(), 8), dx, 0.225, dz)));
      [-0.17, 0.17].forEach((dz) => {
        const bar = at(cyl(0.009, 0.009, 0.36, steel(), 8), 0, 0.1, dz);
        bar.rotation.z = Math.PI / 2;
        c.add(bar);
      });
      return c;
    };
    // Deux chaises de chaque côté, face à la table
    [TZ + 0.3, TZ - 0.32].forEach((z) => {
      const w = chair();
      w.rotation.y = Math.PI / 2; // côté ouest, regarde vers +x
      room.add(at(w, TX - 0.62, 0, z));
      const e = chair();
      e.rotation.y = -Math.PI / 2; // côté est, regarde vers -x
      room.add(at(e, TX + 0.62, 0, z));
    });
    // Sur la table : un sous-verre et un verre devant chaque chaise, la lampe au milieu, le prospectus au coin avant droit
    [
      [-1, TZ + 0.3, '#D2343A'],
      [1, TZ + 0.3, '#3E9B55'],
      [-1, TZ - 0.29, '#3E9B55'],
      [1, TZ - 0.29, '#D2343A'],
    ].forEach(([side, z, c]) => {
      const x = TX + side * 0.25;
      room.add(at(cyl(0.065, 0.065, 0.008, '#8A776B', 40, { roughness: 0.95 }), x, tableTop + 0.004, z));
      const glass = group(
        at(cyl(0.034, 0.03, 0.1, mat(c, { transparent: true, opacity: 0.55, roughness: 0.08 }), 24), 0, 0.05, 0),
        at(cyl(0.029, 0.027, 0.055, mat('#EAF6FA', { transparent: true, opacity: 0.6, roughness: 0.05 }), 20), 0, 0.03, 0)
      );
      room.add(at(glass, x, tableTop + 0.008, z));
    });
    const lamp = group(at(cyl(0.065, 0.075, 0.018, '#FAFAF8', 24), 0, 0.009, 0), at(cyl(0.011, 0.015, 0.2, '#FAFAF8', 12), 0, 0.115, 0));
    const shade = at(mesh(new T.SphereGeometry(0.115, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat('#FFFFFF', { emissive: '#FFC27A', emissiveIntensity: 0.85 })), 0, 0.2, 0);
    shade.scale.set(1, 0.55, 1);
    lamp.add(shade);
    room.add(at(lamp, TX, tableTop, TZ));
    const lampLight = new T.PointLight('#FFAE5E', 3.2, 2.8, 1.4);
    lampLight.position.set(TX, tableTop + 0.2, TZ);
    room.add(lampLight);

    /* Tapis vert au milieu de la pièce */
    const rr = (g, x, y, w, h, r) => {
      g.beginPath();
      g.moveTo(x + r, y);
      g.arcTo(x + w, y, x + w, y + h, r);
      g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r);
      g.arcTo(x, y, x + w, y, r);
      g.closePath();
    };
    const rugTex = paint(768, 512, (g, w, h) => {
      g.fillStyle = '#365F47';
      rr(g, 0, 0, w, h, 36);
      g.fill();
      g.fillStyle = '#4C7C5F';
      rr(g, 30, 30, w - 60, h - 60, 24);
      g.fill();
      g.strokeStyle = '#A9C79F';
      g.lineWidth = 5;
      rr(g, 52, 52, w - 104, h - 104, 18);
      g.stroke();
      g.strokeStyle = 'rgba(169,199,159,0.45)';
      g.lineWidth = 3;
      for (let i = -6; i <= 6; i++) {
        g.beginPath();
        g.moveTo(w / 2 + i * 52, 80);
        g.lineTo(w / 2 + i * 52 + 110, h / 2);
        g.lineTo(w / 2 + i * 52, h - 80);
        g.stroke();
      }
      for (let i = 0; i < 2600; i++) {
        g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
        g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
    });
    const rug = plane(1.9, 1.26, mat('#ffffff', { map: rugTex.tex, roughness: 1, transparent: true }));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(-0.1, 0.006, -0.25);
    room.add(rug);
    [-1, 1].forEach((sd) => {
      for (let i = 0; i < 16; i++) room.add(at(rbox(0.012, 0.004, 0.06, 0.002, '#EDE6D6'), -0.1 + sd * 0.975, 0.007, -0.25 - 0.55 + i * 0.073).rotateY(Math.PI / 2));
    });

    // Ombres douces au pied des murs (donnent du relief sans calcul coûteux)
    const aoTex = paint(32, 128, (g, w, h) => {
      const grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, 'rgba(70,40,25,0.3)');
      grd.addColorStop(1, 'rgba(70,40,25,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
    });
    const aoMat = new T.MeshBasicMaterial({ map: aoTex.tex, transparent: true, depthWrite: false });
    const ao = (w, x, z, turn) => {
      const m = new T.Mesh(new T.PlaneGeometry(w, 0.32), aoMat);
      m.rotateX(-Math.PI / 2);
      m.rotateZ(turn);
      m.position.set(x, 0.004, z);
      room.add(m);
    };
    ao(0.55, 1.925, -1.84, 0); // mur de la cuisine, à droite des meubles
    ao(4.0, -2.04, 0, Math.PI / 2); // mur du fond
    ao(4.4, 0, 1.84, Math.PI); // mur de la table


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
    add('frigo', 'Frigo', '#/frigo', at(fridge, -1.89, 0.42, -1.71), [-1.89, 0.38, -1.4]);

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
    add('cuisiner', 'Ce soir', '#/planning', at(stove, -0.7, 0.906, -1.7), [-0.78, 1.64, -1.72]);
    const steam = [];
    for (let i = 0; i < 4; i++) {
      const s = new T.Mesh(new T.SphereGeometry(0.035, 14, 10), new T.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0, depthWrite: false }));
      room.add(s);
      steam.push(s);
    }

    /* Livre de recettes posé à plat sur le plan de travail */
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
    const book = new T.Mesh(new T.BoxGeometry(0.22, 0.3, 0.035), [mat(COL.tomatoDark), mat(COL.tomatoDark), mat('#F3E9DD'), mat('#F3E9DD'), mat('#ffffff', { map: cover.tex }), mat(COL.tomato)]);
    book.castShadow = book.receiveShadow = true;
    book.rotation.x = -Math.PI / 2; // couverture vers le haut
    const bookG = group(at(book, 0, 0.018, 0));
    bookG.rotation.y = Math.PI / 2 - 0.18; // le haut du livre vers le mur, lisible depuis le séjour
    add('recettes', 'Recettes', '#/recettes', at(bookG, 1.3, 0.906, -1.62), [1.3, 1.12, -1.62]);

    /* Prospectus des promotions, posés sur la table (lisibles depuis le séjour) */
    const flyer = paint(384, 512, () => {});
    const flyerMesh = plane(0.2, 0.27, mat('#ffffff', { map: flyer.tex, roughness: 0.9 }));
    flyerMesh.rotation.x = -Math.PI / 2;
    const flyers = group(at(rbox(0.2, 0.006, 0.27, 0.003, '#FFF1C2'), 0.015, 0, 0.02), at(flyerMesh, 0, 0.0045, 0));
    flyers.rotation.y = Math.PI / 2 + 0.12;
    add('promotions', 'Promotions', '#/promotions', at(flyers, TX + 0.25, tableTop + 0.003, TZ - TL / 2 + 0.13), [TX + 0.25, tableTop + 0.24, TZ - TL / 2 + 0.13]);

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
    pig.rotation.y = 0.8; // le groin vers la pièce et le séjour, pas vers le mur
    add('budget', 'Budget', '#/budget', at(pig, -1.5, 1.883, SZ - 0.1), [-1.5, 2.12, SZ - 0.1]);

    /* Le planning de la semaine : un tableau blanc sur le mur du fond, à gauche de la porte d'entrée */
    const board = paint(640, 512, () => {});
    const planBoard = group(
      rbox(0.03, 0.78, 0.98, 0.015, W.oakDark),
      at(plane(0.92, 0.72, mat('#ffffff', { map: board.tex, roughness: 0.55 })), 0.016, 0, 0).rotateY(Math.PI / 2),
      at(rbox(0.05, 0.02, 0.36, 0.008, W.oakDark), 0.035, -0.4, 0.2),
      at(rbox(0.015, 0.015, 0.11, 0.006, COL.tomato), 0.05, -0.385, 0.12)
    );
    add('planning', 'Planning', '#/planning', at(planBoard, -2.185, 1.48, 0.72), [-2.15, 1.95, 0.72]);

    /* Cabas à feuillage vert, au sol contre le mur du fond : les courses */
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
    bag.rotation.y = Math.PI / 2 - 0.35; // le grand côté vers le séjour
    add('courses', 'Courses', '#/courses', at(bag, -1.92, 0, 0.32), [-1.92, 0.62, 0.32]);

    K = { renderer, scene, camera, room, items, steam, textures: { postit, board, flyer }, el: null, info: null, ray: new T.Raycaster(), pointer: new T.Vector2(), hover: null, off: { az: 0, el: 0 }, offT: { az: 0, el: 0 }, anim: null, raf: 0, t0: performance.now(), size: { w: 1, h: 1 } };
  }

  /* ---------- Textures en direct ---------- */
  function drawLive(info) {
    const { postit, board, flyer } = K.textures;
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
    const clip = (g, t, max) => {
      let x = String(t);
      if (g.measureText(x).width <= max) return x;
      while (x.length > 1 && g.measureText(x + '…').width > max) x = x.slice(0, -1);
      return x + '…';
    };
    board.redraw((g, w, h) => {
      g.fillStyle = '#FDFDFB';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#2B2622';
      g.font = `italic 48px ${SERIF}`;
      g.fillText('Cette semaine', 28, 58);
      g.fillStyle = '#8A7E76';
      g.font = `600 18px ${SANS}`;
      g.fillText('MIDI', 190, 92);
      g.fillText('SOIR', 415, 92);
      const rowH = (h - 108) / 7;
      (info.week || []).forEach((d, i) => {
        const y = 102 + i * rowH;
        if (d.today) {
          g.fillStyle = 'rgba(228,87,46,0.13)';
          g.fillRect(14, y, w - 28, rowH - 4);
        }
        const base = y + rowH * 0.62;
        g.fillStyle = d.today ? COL.tomato : d.past ? '#B9AFA8' : '#2B2622';
        g.font = `600 22px ${SANS}`;
        g.fillText(d.label, 28, base);
        g.fillStyle = d.past ? '#B9AFA8' : '#3A322C';
        g.font = `21px ${SANS}`;
        g.fillText(clip(g, d.midi || '—', 205), 190, base);
        g.fillText(clip(g, d.soir || '—', 205), 415, base);
      });
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
    K.camera.fov = 46; // grand angle, comme une photo prise depuis le séjour : les deux murs latéraux restent visibles
    // Cadrage : toute la pièce visible, plus serrée en portrait (téléphone)
    const portrait = w / h < 0.9;
    // Ordinateur : la pièce se place en bas à droite, le titre garde le coin supérieur gauche.
    // Vue depuis le côté ouvert (est), légèrement décalée vers le sud pour mieux voir la cuisine
    K.base = portrait ? { az: Math.PI / 2, el: 0.5 } : { az: Math.PI / 2, el: 0.34 };
    K.look = portrait ? new T.Vector3(-0.7, 1.4, 0.0) : new T.Vector3(-0.7, 1.22, 0.05);
    const vf = (K.camera.fov * Math.PI) / 180;
    const hf = 2 * Math.atan(Math.tan(vf / 2) * K.camera.aspect);
    const wide = (portrait ? 2.3 : 3.75) / Math.tan(hf / 2);
    K.R = Math.max(2.85 / Math.tan(vf / 2), wide);
    K.camera.updateProjectionMatrix();
    // Plein écran (arrivée sur le site) : la pièce seule, aussi grande que possible et centrée
    if (document.documentElement.classList.contains('k3-full')) {
      K.R = wide;
      // téléphone : vue un peu plus plongeante pour remplir la hauteur, la pièce prend toute la largeur
      if (portrait) K.base = { az: Math.PI / 2, el: 0.62 };
      fitRoom(portrait ? 30 : 40, h - (portrait ? 76 : 30), portrait ? -Infinity : Math.max(16, w * 0.035));
    }
    // Ordinateur : le bord avant du sol se cale en bas de l'écran, la pièce remonte sous le menu
    else if (portrait) fitBottom(h - 92); // téléphone : la pièce, un peu plus grande, remonte vers le titre
    else {
      fitBottom(h - 26);
      // …sans passer sous le titre : si le haut du mur de gauche touche le texte, on redescend d'autant
      const head = K.el.closest('.k3')?.querySelector('.k3-head');
      const hr = head && head.getBoundingClientRect();
      if (hr && hr.height) {
        const er = K.el.getBoundingClientRect();
        const gap = wallTopUnder(hr.right - er.left + 16) - (hr.bottom - er.top + 14);
        if (gap < 0) fitBottom(h - 26 - gap);
      }
    }
  }

  // Point de la scène → position à l'écran (px), avec la caméra déjà placée
  const toScreen = (x, y, z) => {
    const v = new T.Vector3(x, y, z).project(K.camera);
    return { x: ((v.x + 1) / 2) * K.size.w, y: ((1 - v.y) / 2) * K.size.h };
  };

  // La plus grande pièce qui tient entre topMin et bottomMax (px), centrée dans cette bande
  function fitRoom(topMin, bottomMax, sideMin) {
    for (let k = 0; k < 16; k++) {
      fitBottom(bottomMax);
      const top = Math.min(...[-2.12, 2.12].map((z) => toScreen(-2.32, 2.5, z).y), ...[-2.12, 2.12].map((z) => toScreen(2.2, 2.5, z).y));
      // les deux murs latéraux restent entiers, avec une petite marge
      const side = Math.min(...[0, 2.5].map((y) => Math.min(toScreen(2.26, y, 2.12).x, K.size.w - toScreen(2.26, y, -2.12).x)));
      if (top >= topMin && side >= sideMin) return fitBottom(bottomMax - (top - topMin) / 2);
      K.R *= 1.04;
    }
  }

  // Hauteur à l'écran (px) du haut du mur de gauche à l'abscisse x ; Infinity s'il n'y arrive pas
  function wallTopUnder(x) {
    const back = toScreen(-2.32, 2.5, 2.12);
    const front = toScreen(2.2, 2.5, 2.12);
    if (x < front.x) return Infinity;
    if (x >= back.x) return back.y;
    return front.y + ((x - front.x) / (back.x - front.x)) * (back.y - front.y);
  }

  // Monte ou descend le point visé jusqu'à ce que le bord avant du sol tombe sur la ligne voulue (en px)
  function fitBottom(target) {
    const cam = K.camera;
    const edge = new T.Vector3();
    const { az, el } = K.base;
    const unitPx = K.size.h / (2 * Math.tan((cam.fov * Math.PI) / 360));
    const place = () => {
      cam.position.set(K.look.x + K.R * Math.cos(el) * Math.sin(az), K.look.y + K.R * Math.sin(el), K.look.z + K.R * Math.cos(el) * Math.cos(az));
      cam.lookAt(K.look);
      cam.updateMatrixWorld();
    };
    for (let i = 0; i < 5; i++) {
      place();
      edge.set(2.2, 0, 0);
      const depth = edge.clone().applyMatrix4(cam.matrixWorldInverse).z * -1;
      edge.project(cam);
      const y = ((1 - edge.y) / 2) * K.size.h;
      K.look.y -= ((y - target) * depth) / unitPx / Math.cos(el);
    }
    place();
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
