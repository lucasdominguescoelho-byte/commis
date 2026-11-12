/* Commis — la cuisine 3D de l'accueil.
   Une pièce en coupe, façon maquette, construite uniquement avec des formes arrondies (Three.js, gratuit,
   chargé depuis jsDelivr la première fois). Chaque objet ouvre une page : frigo → Frigo, livre → Recettes,
   ardoise → Planning, cabas → Courses, prospectus → Promotions, tirelire → Budget, cuisinière → le repas du soir.
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

  /* ---------- Construction de la pièce ---------- */
  function build() {
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.className = 'k3-canvas';

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(30, 1, 0.1, 100);

    // Lumière chaude de fin d'après-midi
    scene.add(new T.HemisphereLight('#FFF3E4', '#E2C3A8', 1.25));
    const sun = new T.DirectionalLight('#FFEBD6', 2.1);
    sun.position.set(6, 10, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(window.innerWidth < 760 ? 1024 : 2048, window.innerWidth < 760 ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.025;
    scene.add(sun);
    const fill = new T.DirectionalLight('#FFF6EE', 0.55);
    fill.position.set(-6, 5, 6);
    scene.add(fill);

    const room = new T.Group();
    scene.add(room);

    // Ombre portée de la maquette sur la page
    const catcher = new T.Mesh(new T.PlaneGeometry(30, 30), new T.ShadowMaterial({ opacity: 0.12 }));
    catcher.rotation.x = -Math.PI / 2;
    catcher.position.y = -0.32;
    catcher.receiveShadow = true;
    room.add(catcher);

    // Sol : socle arrondi + parquet dessiné
    room.add(at(rbox(8.6, 0.3, 6.6, 0.12, '#E2C29F'), 0, -0.15, 0));
    const parquet = paint(1024, 768, (g, w, h) => {
      g.fillStyle = COL.floor;
      g.fillRect(0, 0, w, h);
      const rows = 12;
      for (let r = 0; r < rows; r++) {
        const y = (r * h) / rows;
        let x = -((r * 137) % 260);
        while (x < w) {
          const len = 220 + ((r * 53 + x) % 140);
          g.fillStyle = `hsl(32, ${42 + ((r + Math.round(x)) % 3) * 4}%, ${80 + ((r * 7 + Math.round(x / 10)) % 5)}%)`;
          g.fillRect(x + 2, y + 2, len - 4, h / rows - 4);
          x += len;
        }
      }
    });
    const floorTop = new T.Mesh(new T.PlaneGeometry(8.4, 6.4), mat('#ffffff', { map: parquet.tex }));
    floorTop.rotation.x = -Math.PI / 2;
    floorTop.position.y = 0.002;
    floorTop.receiveShadow = true;
    room.add(floorTop);

    // Murs (fond et gauche), plinthes
    room.add(at(rbox(8.6, 4.4, 0.3, 0.1, COL.wallBack), 0, 2.2, -3.15));
    room.add(at(rbox(0.3, 4.4, 6.6, 0.1, COL.wallLeft), -4.15, 2.2, 0));
    room.add(at(rbox(8.3, 0.16, 0.06, 0.03, '#FFFFFF'), 0.15, 0.08, -2.98));
    room.add(at(rbox(0.06, 0.16, 6.3, 0.03, '#FFFFFF'), -3.98, 0.08, 0.15));

    // Crédence carrelée derrière le plan de travail
    const tiles = paint(1024, 256, (g, w, h) => {
      g.fillStyle = '#E8EFE1';
      g.fillRect(0, 0, w, h);
      const s = 64;
      for (let y = 0; y < h; y += s / 2)
        for (let x = (y / (s / 2)) % 2 ? -s / 2 : 0; x < w; x += s) {
          g.fillStyle = (x / s + y / s) % 2 ? '#F7FAF3' : '#FFFFFF';
          g.fillRect(x + 2, y + 2, s - 4, s / 2 - 4);
        }
    });
    const splash = new T.Mesh(new T.PlaneGeometry(6.6, 0.85), mat('#ffffff', { map: tiles.tex }));
    splash.position.set(0.65, 1.42, -2.995);
    splash.receiveShadow = true;
    room.add(splash);

    // Meubles bas + plan de travail
    room.add(at(rbox(6.6, 0.88, 0.92, 0.06, COL.cab), 0.65, 0.48, -2.52));
    for (let i = 0; i < 7; i++) {
      if (i === 2) continue; // le four occupe cette porte
      const x = -2.65 + 0.06 + i * 0.94 + 0.43;
      room.add(at(rbox(0.86, 0.74, 0.04, 0.03, '#D6E3CB'), x, 0.5, -2.05));
      room.add(at(ball(0.035, COL.ink), x + 0.3, 0.72, -2.01));
    }
    room.add(at(rbox(6.75, 0.08, 1.02, 0.035, COL.top), 0.65, 0.96, -2.5));

    // Évier
    room.add(at(rbox(0.9, 0.03, 0.56, 0.06, '#BFC6C9', { roughness: 0.4, metalness: 0.3 }), 2.75, 1.0, -2.55));
    const tap = group(at(cyl(0.035, 0.035, 0.42, COL.steel, 16, { roughness: 0.3, metalness: 0.6 }), 0, 0.21, 0), at(cyl(0.03, 0.03, 0.32, COL.steel, 16, { roughness: 0.3, metalness: 0.6 }), 0, 0.42, 0.13));
    tap.children[1].rotation.x = Math.PI / 2;
    room.add(at(tap, 2.75, 1.0, -2.88));

    // Fenêtre (lumière douce) et plante sur le rebord
    const sky = paint(256, 256, (g, w, h) => {
      const grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, '#CFE4F2');
      grd.addColorStop(1, '#FBE9D8');
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
    });
    const win = group(
      rbox(1.8, 1.55, 0.12, 0.05, '#FFFFFF'),
      at(new T.Mesh(new T.PlaneGeometry(1.56, 1.31), new T.MeshBasicMaterial({ map: sky.tex })), 0, 0, 0.065),
      at(rbox(0.05, 1.31, 0.05, 0.02, '#FFFFFF'), 0, 0, 0.08),
      at(rbox(1.56, 0.05, 0.05, 0.02, '#FFFFFF'), 0, 0.1, 0.08),
      at(rbox(1.95, 0.07, 0.24, 0.03, '#FFFFFF'), 0, -0.8, 0.1)
    );
    room.add(at(win, 0.25, 2.75, -2.96));
    const plant = group(at(cyl(0.13, 0.1, 0.22, COL.tomato), 0, 0.11, 0));
    for (let i = 0; i < 6; i++) {
      const leaf = at(ball(0.11, i % 2 ? COL.sage : COL.sageDark), Math.cos(i) * 0.09, 0.3 + (i % 3) * 0.07, Math.sin(i) * 0.08);
      leaf.scale.set(0.8, 1.4, 0.8);
      plant.add(leaf);
    }
    room.add(at(plant, 0.8, 1.99, -2.74));

    const items = [];
    const add = (key, name, route, obj, anchor) => {
      obj.userData = { key, base: obj.position.clone() };
      obj.traverse((m) => (m.isMesh ? (m.userData.key = key) : null));
      room.add(obj);
      items.push({ key, name, route, obj, anchor: new T.Vector3(...anchor), h: 0, target: 0 });
    };

    /* Frigo */
    const postit = paint(256, 256, () => {});
    const fridge = group(
      rbox(1.15, 2.4, 1.0, 0.12, COL.cream),
      at(rbox(1.12, 0.025, 0.02, 0.01, '#E6DCD0'), 0, 0.42, 0.505),
      at(rbox(0.05, 0.62, 0.06, 0.025, '#D2C8BE', { roughness: 0.4 }), 0.42, 0.85, 0.53),
      at(rbox(0.05, 0.9, 0.06, 0.025, '#D2C8BE', { roughness: 0.4 }), 0.42, -0.2, 0.53),
      at(new T.Mesh(new T.PlaneGeometry(0.42, 0.42), mat('#ffffff', { map: postit.tex })), -0.12, 0.82, 0.506),
      at(cyl(0.045, 0.045, 0.03, COL.tomato), -0.12, 1.05, 0.52),
      at(cyl(0.04, 0.04, 0.03, COL.sage), 0.18, 0.2, 0.52),
      at(cyl(0.04, 0.04, 0.03, COL.ciel), -0.25, 0.05, 0.52)
    );
    fridge.children.slice(5).forEach((m) => (m.rotation.x = Math.PI / 2));
    fridge.children[4].castShadow = false;
    add('frigo', 'Frigo', '#/frigo', at(fridge, -3.3, 1.2, -2.38), [-3.3, 2.65, -2.2]);

    /* Étagère : livre de recettes + tirelire */
    room.add(at(rbox(2.6, 0.08, 0.46, 0.03, COL.wood), 2.6, 2.62, -2.78));
    room.add(at(rbox(0.06, 0.26, 0.3, 0.02, COL.woodDark), 1.5, 2.48, -2.84));
    room.add(at(rbox(0.06, 0.26, 0.3, 0.02, COL.woodDark), 3.7, 2.48, -2.84));
    const spine = paint(96, 512, (g, w, h) => {
      g.fillStyle = COL.tomato;
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#FFE9DF';
      g.fillRect(0, 40, w, 6);
      g.fillRect(0, h - 46, w, 6);
      g.save();
      g.translate(w / 2 + 12, h / 2);
      g.rotate(-Math.PI / 2);
      g.fillStyle = '#FFFFFF';
      g.font = `italic 64px ${SERIF}`;
      g.textAlign = 'center';
      g.fillText('Recettes', 0, 0);
      g.restore();
    });
    const bookMats = [mat('#F2E6D8'), mat('#F2E6D8'), mat(COL.tomato), mat(COL.tomato), mat('#ffffff', { map: spine.tex }), mat(COL.tomato)];
    const bigBook = new T.Mesh(new T.BoxGeometry(0.18, 0.7, 0.44), bookMats);
    bigBook.castShadow = bigBook.receiveShadow = true;
    const books = group(
      at(bigBook, 0, 0.35, 0),
      at(rbox(0.12, 0.58, 0.38, 0.02, COL.sage), 0.17, 0.29, 0.02),
      at(rbox(0.1, 0.52, 0.36, 0.02, COL.butter), 0.29, 0.26, 0.03),
      at(rbox(0.14, 0.62, 0.4, 0.02, COL.ciel), 0.42, 0.31, 0.01)
    );
    books.children[3].rotation.z = -0.18;
    books.children[3].position.x += 0.06;
    add('recettes', 'Recettes', '#/recettes', at(books, 1.85, 2.66, -2.76), [1.95, 3.55, -2.7]);

    const pig = group();
    const body = at(ball(0.3, COL.pink, { roughness: 0.55 }), 0, 0.27, 0);
    body.scale.set(1.15, 0.95, 0.9);
    pig.add(body);
    const snout = at(cyl(0.09, 0.1, 0.1, '#F19484', 24), 0.36, 0.27, 0);
    snout.rotation.z = Math.PI / 2;
    pig.add(snout);
    [-1, 1].forEach((s) => {
      const ear = at(mesh(new T.ConeGeometry(0.07, 0.12, 16), mat('#F19484')), 0.18, 0.52, 0.12 * s);
      ear.rotation.z = -0.4;
      pig.add(ear);
      pig.add(at(cyl(0.05, 0.05, 0.1, '#F19484', 12), 0.18, 0.05, 0.15 * s));
      pig.add(at(cyl(0.05, 0.05, 0.1, '#F19484', 12), -0.18, 0.05, 0.15 * s));
      pig.add(at(ball(0.025, COL.ink), 0.3, 0.36, 0.1 * s));
    });
    pig.add(at(rbox(0.14, 0.02, 0.04, 0.008, COL.ink), -0.02, 0.535, 0));
    pig.rotation.y = 0.5;
    add('budget', 'Budget', '#/budget', at(pig, 3.2, 2.66, -2.72), [3.35, 3.4, -2.7]);

    /* Ardoise du planning, sur le mur de gauche */
    const board = paint(640, 448, () => {});
    const slate = group(
      rbox(0.1, 1.35, 1.9, 0.05, COL.wood),
      at(new T.Mesh(new T.PlaneGeometry(1.72, 1.17), mat('#ffffff', { map: board.tex, roughness: 0.95 })), 0.055, 0, 0),
      at(rbox(0.14, 0.05, 1.5, 0.02, COL.woodDark), 0.07, -0.72, 0)
    );
    slate.children[1].rotation.y = Math.PI / 2;
    add('planning', 'Planning', '#/planning', at(slate, -3.95, 2.55, -0.3), [-3.85, 3.45, 0.25]);

    /* Cuisinière + casserole (le repas du soir) */
    const stove = group(
      at(rbox(1.25, 0.03, 0.72, 0.04, '#2E2824', { roughness: 0.35 }), 0, 0.02, 0),
      at(mesh(new T.TorusGeometry(0.17, 0.018, 8, 40), mat('#55504B')), -0.3, 0.04, 0.05),
      at(mesh(new T.TorusGeometry(0.13, 0.018, 8, 40), mat('#55504B')), 0.32, 0.04, -0.08),
      at(cyl(0.27, 0.25, 0.3, COL.tomato, 40, { roughness: 0.45 }), -0.3, 0.19, 0.05),
      at(cyl(0.285, 0.285, 0.03, COL.tomatoDark, 40, { roughness: 0.45 }), -0.3, 0.355, 0.05),
      at(ball(0.04, COL.ink), -0.3, 0.39, 0.05),
      at(rbox(0.86, 0.6, 0.04, 0.04, '#3A332E', { roughness: 0.3 }), -0.02, -0.5, 0.48),
      at(rbox(0.6, 0.3, 0.02, 0.03, '#6E625A', { roughness: 0.2 }), -0.02, -0.52, 0.505),
      at(rbox(0.56, 0.04, 0.05, 0.02, COL.steel), -0.02, -0.24, 0.53)
    );
    stove.children[1].rotation.x = Math.PI / 2;
    stove.children[2].rotation.x = Math.PI / 2;
    add('cuisiner', 'Ce soir', '#/planning', at(stove, -0.22, 0.99, -2.5), [-0.5, 1.95, -2.4]);
    // Vapeur au-dessus de la casserole
    const steam = [];
    for (let i = 0; i < 4; i++) {
      const s = new T.Mesh(new T.SphereGeometry(0.07, 16, 10), new T.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0, depthWrite: false }));
      room.add(s);
      steam.push(s);
    }

    /* Prospectus des promotions, posés sur le plan de travail */
    const flyer = paint(384, 512, () => {});
    const flyerMesh = new T.Mesh(new T.PlaneGeometry(0.5, 0.66), mat('#ffffff', { map: flyer.tex, roughness: 0.9 }));
    flyerMesh.rotation.x = -Math.PI / 2;
    flyerMesh.receiveShadow = true;
    const under = at(rbox(0.5, 0.012, 0.66, 0.006, '#FFF3C9'), 0.04, 0.0, -0.03);
    under.rotation.y = 0.18;
    const flyers = group(under, at(flyerMesh, 0, 0.012, 0));
    flyers.rotation.y = -0.22;
    add('promotions', 'Promotions', '#/promotions', at(flyers, 1.35, 1.005, -2.35), [1.35, 1.45, -2.3]);

    /* Cabas des courses (le logo de Commis), posé au sol */
    const bag = group(
      at(cyl(0.48, 0.36, 0.62, COL.tomato, 40), 0, 0.31, 0),
      at(mesh(new T.TorusGeometry(0.44, 0.03, 10, 48), mat(COL.ink)), 0, 0.42, 0),
      at(mesh(new T.TorusGeometry(0.41, 0.03, 10, 48), mat(COL.ink)), 0, 0.24, 0),
      at(mesh(new T.TorusGeometry(0.28, 0.035, 12, 40, Math.PI), mat(COL.tomatoDark)), 0, 0.62, 0)
    );
    bag.children[1].rotation.x = Math.PI / 2;
    bag.children[2].rotation.x = Math.PI / 2;
    const bread = at(mesh(new T.CapsuleGeometry(0.07, 0.62, 8, 16), mat('#E5B474')), 0.12, 0.78, -0.08);
    bread.rotation.z = -0.35;
    const leek = group(at(cyl(0.05, 0.05, 0.4, '#F4F1E4', 16), 0, 0, 0), at(cyl(0.06, 0.03, 0.34, COL.sage, 16), 0, 0.36, 0));
    leek.rotation.z = 0.3;
    bag.add(bread, at(leek, -0.18, 0.72, 0.05), at(ball(0.11, '#E4572E'), 0.05, 0.62, 0.18), at(ball(0.1, '#A9C46B'), -0.12, 0.62, -0.12));
    add('courses', 'Courses', '#/courses', at(bag, 2.6, 0, -0.75), [2.6, 1.55, -0.75]);

    // Décor : tapis à bordure, grande plante dans l'angle
    const rr = (g, x, y, w, h, r) => {
      g.beginPath();
      g.moveTo(x + r, y);
      g.arcTo(x + w, y, x + w, y + h, r);
      g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r);
      g.arcTo(x, y, x + w, y, r);
      g.closePath();
    };
    const rug = paint(768, 512, (g, w, h) => {
      g.fillStyle = '#F2B89A';
      rr(g, 0, 0, w, h, 70);
      g.fill();
      g.fillStyle = '#FCE3D3';
      rr(g, 26, 26, w - 52, h - 52, 52);
      g.fill();
      g.strokeStyle = '#F2B89A';
      g.lineWidth = 6;
      g.setLineDash([18, 14]);
      rr(g, 58, 58, w - 116, h - 116, 34);
      g.stroke();
    });
    const rugM = new T.Mesh(new T.PlaneGeometry(3.3, 2.2), mat('#ffffff', { map: rug.tex, roughness: 1, transparent: true }));
    rugM.rotation.x = -Math.PI / 2;
    rugM.position.set(0.3, 0.01, 0.55);
    rugM.receiveShadow = true;
    room.add(rugM);
    const tall = group(at(cyl(0.3, 0.24, 0.5, '#F2E6D8'), 0, 0.25, 0));
    for (let i = 0; i < 9; i++) {
      const l = at(ball(0.2, i % 2 ? COL.sage : COL.sageDark), Math.cos(i * 0.9) * 0.18, 0.75 + (i % 4) * 0.17, Math.sin(i * 0.9) * 0.16);
      l.scale.set(0.7, 1.5, 0.7);
      tall.add(l);
    }
    room.add(at(tall, -3.4, 0, 1.9));

    // Étiquettes HTML (accessibles au clavier) au-dessus des objets
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
      g.font = `600 22px ${SANS}`;
      g.fillText(info.soon.length ? 'À manger vite' : 'Au frigo', 18, 58);
      g.font = `30px ${SERIF}`;
      const list = info.soon.length ? info.soon.slice(0, 3) : [`${info.fridge} aliment${info.fridge > 1 ? 's' : ''}`];
      list.forEach((t, i) => g.fillText(String(t).slice(0, 18), 18, 104 + i * 40));
    });
    board.redraw((g, w, h) => {
      g.fillStyle = COL.chalk;
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) {
        g.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`;
        g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
      g.fillStyle = 'rgba(255,255,255,0.72)';
      g.font = `600 26px ${SANS}`;
      g.fillText(info.next ? info.next.when.toUpperCase() : 'CETTE SEMAINE', 40, 64);
      g.fillStyle = '#FFFFFF';
      g.font = `italic 54px ${SERIF}`;
      const lines = wrap(g, info.next ? info.next.name : 'Rien de prévu', w - 80).slice(0, 3);
      lines.forEach((l, i) => g.fillText(l, 40, 140 + i * 58));
      g.fillStyle = '#F6C6AB';
      g.font = `600 26px ${SANS}`;
      g.fillText(`${info.meals} repas sur 14 prévus`, 40, h - 44);
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
      wrap(g, info.best ? `${info.best.name}, ${info.best.store}` : 'promotions cette semaine', w - 56).slice(0, 3).forEach((l, i) => g.fillText(l, 28, 316 + i * 38));
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
    const to = it.anchor.clone().add(from.clone().sub(it.anchor).normalize().multiplyScalar(4.2));
    K.anim = { t: performance.now(), from, to, look0: look, look1: it.anchor.clone().add(new T.Vector3(0, -0.4, 0)), route: it.route };
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
    K.base = portrait ? { az: 0.6, el: 0.5 } : { az: 0.68, el: 0.42 };
    K.look = portrait ? new T.Vector3(-0.2, 2.25, -0.55) : new T.Vector3(-1.35, 1.95, -0.35);
    const vf = (K.camera.fov * Math.PI) / 180;
    const hf = 2 * Math.atan(Math.tan(vf / 2) * K.camera.aspect);
    K.R = Math.max((portrait ? 4.2 : 4.9) / Math.tan(vf / 2), (portrait ? 4.75 : 7.6) / Math.tan(hf / 2));
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
      o.position.y = o.userData.base.y + 0.06 * x.h;
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
      s.position.set(-0.52 + Math.sin(p * 6 + i) * 0.05, 1.42 + p * 0.75, -2.45);
      s.scale.setScalar(0.6 + p * 1.2);
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
      v.y += 0.06 * x.h;
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
