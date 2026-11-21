// PassBCH.cash 3D arena (three.js, no React). One white room with neon edges and three stages:
//   duel   — two hands play rock-paper-scissors (shake ×3, then reveal)
//   updown — 3D candlestick chart + big glowing arrow
//   ai     — two robot agents spar; the winner celebrates when the result lands
// The scene reacts to window 'passbch:show' events: { game, ... } sent by the game panels.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const NEON = { cyan: 0x22e1ff, pink: 0xff4fd8, lime: 0x9dff3a, amber: 0xffb43d, green: 0x13d18e, red: 0xff4d5e };
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

function std(color, extra = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...extra }); }
function glow(color, intensity = 2.2) { return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.3 }); }

/** Text on a canvas → sprite, for labels floating in the room. */
function label(text, { size = 64, color = '#0b0c0e', bg = 'rgba(255,255,255,0.92)', border = '#22e1ff', scale = 1 } = {}) {
  const c = document.createElement('canvas'); const g = c.getContext('2d');
  g.font = `700 ${size}px Inter, system-ui, sans-serif`;
  const w = Math.ceil(g.measureText(text).width) + size; const h = Math.ceil(size * 1.6);
  c.width = w; c.height = h;
  g.font = `700 ${size}px Inter, system-ui, sans-serif`;
  g.fillStyle = bg; g.strokeStyle = border; g.lineWidth = size / 8;
  const r = h / 2.4; g.beginPath(); g.roundRect(g.lineWidth, g.lineWidth, w - 2 * g.lineWidth, h - 2 * g.lineWidth, r); g.fill(); g.stroke();
  g.fillStyle = color; g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillText(text, w / 2, h / 2 + size * 0.04);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set((w / h) * 0.42 * scale, 0.42 * scale, 1);
  s.userData.set = (t) => { s.material.map.dispose(); const n = label(t, { size, color, bg, border, scale }); s.material.map = n.material.map; s.scale.copy(n.scale); };
  return s;
}

// ---------- room ----------
function buildRoom(scene) {
  const room = new THREE.Group();
  const wallMat = std(0xf4f6fb, { roughness: 0.9 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), std(0xeef1f7, { roughness: 0.8 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; room.add(floor);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), wallMat); back.position.set(0, 3, -4); back.receiveShadow = true; room.add(back);
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(10, 6), wallMat); side.position.set(7 * sx, 3, 1); side.rotation.y = -sx * Math.PI / 2; side.receiveShadow = true; room.add(side);
  }
  // neon trims (thin glowing bars along the room edges)
  const bar = (len, color, pos, rotZ = 0, rotY = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.045, 0.045), glow(color)); m.position.set(...pos); m.rotation.z = rotZ; m.rotation.y = rotY; room.add(m); return m; };
  bar(14, NEON.cyan, [0, 0.03, -3.97]); bar(14, NEON.pink, [0, 5.95, -3.97]);
  bar(6, NEON.lime, [-6.97, 3, -3.97], Math.PI / 2); bar(6, NEON.amber, [6.97, 3, -3.97], Math.PI / 2);
  bar(10, NEON.cyan, [-6.97, 0.03, 1], 0, Math.PI / 2); bar(10, NEON.pink, [6.97, 0.03, 1], 0, Math.PI / 2);
  // big screen frame on the back wall (title lives here)
  const frame = new THREE.Mesh(new THREE.BoxGeometry(6.4, 2.1, 0.06), std(0xffffff)); frame.position.set(0, 4.15, -3.93); room.add(frame);
  for (const [w, h, x, y, c] of [[6.5, 0.04, 0, 5.2, NEON.cyan], [6.5, 0.04, 0, 3.1, NEON.pink], [0.04, 2.1, -3.25, 4.15, NEON.lime], [0.04, 2.1, 3.25, 4.15, NEON.amber]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), glow(c, 1.6)); b.position.set(x, y, -3.89); room.add(b);
  }
  // pixel blocks in the corners (a playful nod to retro games)
  const pix = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), std(0xffffff), 40);
  const colors = [NEON.cyan, NEON.pink, NEON.lime, NEON.amber]; const m = new THREE.Matrix4(); const col = new THREE.Color();
  for (let i = 0; i < 40; i++) {
    const sx = i < 20 ? -1 : 1; const k = i % 20;
    m.makeTranslation(sx * (6.2 - (k % 4) * 0.24), 0.11 + Math.floor(k / 4) * 0.24 * (k % 3 === 0 ? 1 : 0), -3.6 + (k % 5) * 0.24);
    pix.setMatrixAt(i, m); pix.setColorAt(i, col.setHex(colors[i % 4]).lerp(new THREE.Color(0xffffff), 0.35));
  }
  pix.castShadow = true; room.add(pix);
  // stage disc
  const stage = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 0.18, 64), std(0xffffff)); stage.position.y = 0.09; stage.receiveShadow = true; stage.castShadow = true; room.add(stage);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.03, 8, 96), glow(NEON.cyan, 1.8)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.19; room.add(ring);
  scene.add(room);
  return { ring };
}

// ---------- hands (rock / paper / scissors) ----------
const POSES = { // curl per finger [thumb, index, middle, ring, pinky]: 0 = straight, 1 = fully curled
  rock: [1, 1, 1, 1, 1], paper: [0, 0, 0, 0, 0], scissors: [1, 0, 0, 1, 1],
};
function buildHand(skin, sleeve, mirror) {
  const hand = new THREE.Group();
  const skinMat = std(skin, { roughness: 0.65 });
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.38, 1.6, 24), std(sleeve)); arm.rotation.z = Math.PI / 2; arm.position.x = -1.05; arm.castShadow = true; hand.add(arm);
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.05, 8, 32), glow(sleeve === 0x1d2333 ? NEON.cyan : NEON.pink, 1.5)); cuff.rotation.y = Math.PI / 2; cuff.position.x = -0.26; hand.add(cuff);
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.28, 2, 2, 2), skinMat); palm.castShadow = true; hand.add(palm);
  const fingers = [];
  const spec = [ // [length, y offset, z offset, base angle] thumb first
    [0.36, -0.2, 0.2, 0.9], [0.44, 0.22, 0, 0], [0.48, 0.07, 0, 0], [0.45, -0.08, 0, 0], [0.36, -0.22, 0, 0],
  ];
  spec.forEach(([len, y, z, base], i) => {
    const pivot = new THREE.Group(); pivot.position.set(0.3, y, z); hand.add(pivot);
    const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, len, 4, 10), skinMat); f.rotation.z = -Math.PI / 2; f.position.x = len / 2 + 0.05; f.castShadow = true; pivot.add(f);
    pivot.userData = { base, i }; if (i === 0) pivot.rotation.y = -0.6;
    fingers.push(pivot);
  });
  hand.userData = { fingers, curl: [1, 1, 1, 1, 1], target: [1, 1, 1, 1, 1] };
  if (mirror) hand.scale.x = -1;
  return hand;
}
function poseHand(hand, dt) {
  const { fingers, curl, target } = hand.userData;
  fingers.forEach((p, i) => {
    curl[i] = lerp(curl[i], target[i], Math.min(1, dt * 12));
    if (i === 0) p.rotation.z = -curl[i] * 1.2; // thumb folds across
    else p.rotation.y = curl[i] * 2.3 * (i === 2 && target === POSES.scissors ? 1 : 1); // fingers fold into the palm
    if (i === 1 || i === 2) p.rotation.z = (hand.userData.spread ?? 0) * (i === 1 ? 0.18 : -0.18);
  });
}

// ---------- robots (AI agents) ----------
function buildRobot(color, name) {
  const r = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.0, 0.6, 2, 2, 2), std(0xffffff, { roughness: 0.35 })); body.position.y = 1.0; body.castShadow = true; r.add(body);
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.02), glow(color, 1.3)); chest.position.set(0, 1.08, 0.31); r.add(chest);
  const head = new THREE.Group(); head.position.y = 1.85; r.add(head);
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.6, 0.6, 2, 2, 2), std(0xffffff, { roughness: 0.3 })); skull.castShadow = true; head.add(skull);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.32, 0.02), std(0x0b0c0e, { roughness: 0.2 })); visor.position.z = 0.31; head.add(visor);
  const eyeMat = glow(color, 2.6);
  for (const x of [-0.14, 0.14]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.02), eyeMat); e.position.set(x, 0.02, 0.325); head.add(e); }
  const ant = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), glow(color, 2)); ant.position.y = 0.45; head.add(ant);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.16), std(0xcfd5e2)); stick.position.y = 0.36; head.add(stick);
  const arms = [];
  for (const sx of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(0.55 * sx, 1.35, 0); r.add(sh);
    const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.55, 4, 10), std(0xffffff)); a.position.y = -0.35; a.castShadow = true; sh.add(a);
    const fist = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), glow(color, 0.9)); fist.position.y = -0.72; sh.add(fist);
    arms.push(sh);
  }
  for (const sx of [-1, 1]) { const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.35, 4, 10), std(0xe9edf5)); l.position.set(0.22 * sx, 0.32, 0); l.castShadow = true; r.add(l); }
  const tag = label(name, { size: 48, border: `#${color.toString(16).padStart(6, '0')}`, scale: 0.9 }); tag.position.y = 2.6; r.add(tag);
  r.userData = { arms, head, eyeMat, chest, tag, color };
  return r;
}

// ---------- candles + arrow ----------
function buildChart() {
  const g = new THREE.Group();
  const grid = new THREE.GridHelper(5, 10, 0xb9c3d6, 0xdde3ee); grid.position.y = 0.2; g.add(grid);
  const candles = [];
  for (let i = 0; i < 12; i++) {
    const c = new THREE.Group(); c.position.set(-2.2 + i * 0.4, 0.2, 0);
    const bodyM = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1, 0.22), glow(NEON.green, 0.6)); bodyM.castShadow = true; c.add(bodyM);
    const wick = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1, 0.03), std(0x6b7385)); c.add(wick);
    c.userData = { body: bodyM, wick, open: 0, close: 0 };
    g.add(c); candles.push(c);
  }
  const arrow = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.8, 20), glow(NEON.green, 1.4)); arrow.add(shaft);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.55, 24), glow(NEON.green, 1.6)); tip.position.y = 0.65; arrow.add(tip);
  arrow.position.set(2.55, 1.9, 0.2); g.add(arrow);
  const price = label('$—', { size: 64, border: '#13d18e', scale: 1.2 }); price.position.set(0, 2.95, 0.4); g.add(price);
  g.userData = { candles, arrow, shaft, tip, price };
  return g;
}

export function createArena(canvas, { reducedMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xf6f8fc); scene.fog = new THREE.Fog(0xf6f8fc, 12, 22);
  const camera = new THREE.PerspectiveCamera(42, 2, 0.1, 60); camera.position.set(0, 2.6, 8.2);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 1.6, 0); controls.enableZoom = false; controls.enablePan = false; controls.enableDamping = true;
  controls.minAzimuthAngle = -0.6; controls.maxAzimuthAngle = 0.6; controls.minPolarAngle = 1.05; controls.maxPolarAngle = 1.5;
  controls.autoRotate = !reducedMotion; controls.autoRotateSpeed = 0.35;

  scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe6f3, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(3, 7, 5); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -2 }); scene.add(sun);
  const accent = new THREE.PointLight(NEON.cyan, 6, 8); accent.position.set(0, 3, 1); scene.add(accent);

  const { ring } = buildRoom(scene);
  const title = label('PassBCH.cash', { size: 96, border: '#22e1ff', scale: 2.0 }); title.position.set(0, 4.5, -3.2); scene.add(title);
  const subtitle = label('play while your AI thinks', { size: 54, border: '#ff4fd8', color: '#33384a', scale: 1.0 }); subtitle.position.set(0, 3.85, -3.2); scene.add(subtitle);

  // stages
  const duel = new THREE.Group(); scene.add(duel);
  const handL = buildHand(0xf0c19c, 0x1d2333, false); handL.position.set(-1.25, 1.35, 0); duel.add(handL);
  const handR = buildHand(0x8d5a3b, 0xffffff, true); handR.position.set(1.25, 1.35, 0); duel.add(handR);
  const duelText = label('rock · paper · scissors', { size: 56, border: '#ffb43d', scale: 1.1 }); duelText.position.set(0, 2.8, 0.4); duel.add(duelText);

  const updown = buildChart(); scene.add(updown);
  const ai = new THREE.Group(); scene.add(ai);
  const botA = buildRobot(NEON.cyan, 'AI agent'); botA.position.set(-1.1, 0.18, 0); botA.rotation.y = 0.5; ai.add(botA);
  const botB = buildRobot(NEON.pink, 'unit tests'); botB.position.set(1.1, 0.18, 0); botB.rotation.y = -0.5; ai.add(botB);
  const holo = label('waiting for the next exam', { size: 52, border: '#9dff3a', scale: 1.1 }); holo.position.set(0, 3.05, 0.4); ai.add(holo);
  const sparks = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(90), 3)), new THREE.PointsMaterial({ color: NEON.amber, size: 0.07 }));
  ai.add(sparks);

  // state driven by events
  const st = {
    game: 'duel', t: 0,
    duel: { phase: 'idle', phaseT: 0, a: 'rock', b: 'rock', result: null },
    ud: { dir: 0, price: null, last: null, history: [] },
    ai: { status: 'idle', pass: null, winT: 0 },
  };
  const stages = { duel, updown, ai };
  const setGame = (g) => { st.game = g; for (const [k, v] of Object.entries(stages)) v.visible = k === g; ring.material.color.setHex(g === 'duel' ? NEON.amber : g === 'updown' ? NEON.green : NEON.lime); ring.material.emissive.copy(ring.material.color); };
  setGame('duel');

  const playDuel = (a, b, result) => { Object.assign(st.duel, { phase: 'shake', phaseT: 0, a, b, result }); duelText.userData.set('rock…'); };
  const onShow = (e) => {
    const d = e.detail ?? {};
    if (d.game && d.game !== st.game) setGame(d.game);
    if (d.kind === 'duel') playDuel(d.aMove, d.bMove, d.result);
    if (d.kind === 'price' && d.history?.length) st.ud.history = [...d.history];
    if (d.kind === 'price' && d.price) {
      if (st.ud.price) st.ud.dir = Math.sign(d.price - st.ud.price) || st.ud.dir;
      st.ud.price = d.price; st.ud.history.push(d.price); if (st.ud.history.length > 13) st.ud.history.shift();
      updown.userData.price.userData.set(`BCH $${d.price.toFixed(2)}`);
    }
    if (d.kind === 'ai') {
      if (d.status === 'open') holo.userData.set(`${d.model} vs "${d.slug}" · place your bets`);
      else if (d.status === 'running') holo.userData.set(`${d.model} is coding "${d.slug}"…`);
      else if (d.status === 'done') holo.userData.set(d.pass ? `PASS ${d.passed}/${d.total} — the AI wins` : `FAIL ${d.passed}/${d.total} — the tests win`);
      if (d.status !== st.ai.status || d.status === 'done') { st.ai.status = d.status; st.ai.pass = d.pass ?? null; st.ai.winT = 0; }
    }
  };
  window.addEventListener('passbch:show', onShow);

  // idle demo: hands play a random round every few seconds so the room is always alive
  const MOVES = ['rock', 'paper', 'scissors'];
  let idleTimer = 0;

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < 640 ? 55 : 42; camera.updateProjectionMatrix();
    }
  };

  let running = true, raf = 0, prev = performance.now();
  const tick = (now) => {
    raf = requestAnimationFrame(tick);
    if (!running) return;
    const dt = Math.min(0.05, (now - prev) / 1000); prev = now; st.t += dt;
    resize(); controls.update();
    ring.rotation.z += dt * 0.3;

    if (st.game === 'duel') {
      const D = st.duel; D.phaseT += dt;
      if (D.phase === 'idle') {
        idleTimer += dt;
        handL.position.y = 1.35 + Math.sin(st.t * 2) * 0.03; handR.position.y = 1.35 + Math.sin(st.t * 2 + 1) * 0.03;
        if (idleTimer > 4 && !reducedMotion) { idleTimer = 0; playDuel(MOVES[(Math.random() * 3) | 0], MOVES[(Math.random() * 3) | 0], null); }
      }
      if (D.phase === 'shake') {
        handL.userData.target = POSES.rock; handR.userData.target = POSES.rock; handL.userData.spread = handR.userData.spread = 0;
        const k = D.phaseT / 0.42; const bob = Math.abs(Math.sin(k * Math.PI)) * 0.45;
        handL.position.y = 1.35 + bob; handR.position.y = 1.35 + bob;
        const beat = Math.floor(k); duelText.userData.beat ??= -1;
        if (beat !== duelText.userData.beat && beat < 3) { duelText.userData.beat = beat; duelText.userData.set(['rock…', 'paper…', 'scissors…'][beat]); }
        if (D.phaseT > 0.42 * 3) { D.phase = 'reveal'; D.phaseT = 0; duelText.userData.beat = -1;
          handL.userData.target = POSES[D.a]; handR.userData.target = POSES[D.b];
          handL.userData.spread = D.a === 'scissors' ? 1 : 0; handR.userData.spread = D.b === 'scissors' ? 1 : 0;
          const res = D.result ?? (D.a === D.b ? 0 : (MOVES.indexOf(D.a) - MOVES.indexOf(D.b) + 3) % 3 === 1 ? 1 : 2);
          duelText.userData.set(res === 0 ? `${D.a} = ${D.b} · draw` : res === 1 ? `${D.a} beats ${D.b}` : `${D.b} beats ${D.a}`);
          D.winner = res;
        }
      }
      if (D.phase === 'reveal') {
        handL.position.y = lerp(handL.position.y, 1.35, dt * 8); handR.position.y = lerp(handR.position.y, 1.35, dt * 8);
        const pop = D.phaseT < 0.6 ? Math.sin((D.phaseT / 0.6) * Math.PI) * 0.12 : 0;
        if (D.winner === 1) handL.position.y += pop; if (D.winner === 2) handR.position.y += pop;
        if (D.phaseT > 2.6) { D.phase = 'idle'; D.phaseT = 0; idleTimer = 0; }
      }
      poseHand(handL, dt); poseHand(handR, dt);
    }

    if (st.game === 'updown') {
      const U = updown.userData; const hist = st.ud.history.length ? st.ud.history : [1];
      const lo = Math.min(...hist), hi = Math.max(...hist), span = Math.max(0.05, hi - lo);
      U.candles.forEach((c, i) => {
        const a = hist[i] ?? hist[hist.length - 1], b = hist[i + 1] ?? a;
        const live = i === Math.min(hist.length - 1, 11);
        const wob = live ? Math.sin(st.t * 6) * 0.04 : 0;
        const y0 = 0.3 + ((a - lo) / span) * 1.9, y1 = 0.3 + ((b - lo) / span) * 1.9 + wob;
        const top = Math.max(y0, y1), bot = Math.min(y0, y1), h = Math.max(0.06, top - bot);
        c.userData.body.scale.y = lerp(c.userData.body.scale.y, h, dt * 6); c.userData.body.position.y = lerp(c.userData.body.position.y, bot + h / 2, dt * 6);
        c.userData.wick.scale.y = h + 0.25; c.userData.wick.position.y = c.userData.body.position.y;
        const up = b >= a; c.userData.body.material.color.setHex(up ? NEON.green : NEON.red); c.userData.body.material.emissive.setHex(up ? NEON.green : NEON.red);
        c.visible = i < Math.max(hist.length, 1);
      });
      const up = st.ud.dir >= 0; const col = up ? NEON.green : NEON.red;
      U.arrow.rotation.z = lerp(U.arrow.rotation.z, up ? 0 : Math.PI, dt * 6);
      U.arrow.position.y = 1.9 + Math.sin(st.t * 3) * 0.15; U.arrow.rotation.y += dt * 1.5;
      for (const m of [U.shaft, U.tip]) { m.material.color.setHex(col); m.material.emissive.setHex(col); }
    }

    if (st.game === 'ai') {
      const A = st.ai; A.winT += dt;
      const fighting = A.status === 'running' || A.status === 'open' || A.status === 'idle';
      const [aL, aR] = botA.userData.arms, [bL, bR] = botB.userData.arms;
      if (fighting && !reducedMotion) {
        const s = st.t * (A.status === 'running' ? 7 : 3);
        aR.rotation.x = -Math.max(0, Math.sin(s)) * 1.6; aL.rotation.x = -Math.max(0, Math.sin(s + Math.PI)) * 1.6;
        bR.rotation.x = -Math.max(0, Math.sin(s + 1.3)) * 1.6; bL.rotation.x = -Math.max(0, Math.sin(s + 1.3 + Math.PI)) * 1.6;
        botA.position.x = -1.1 + Math.sin(s * 0.5) * 0.08; botB.position.x = 1.1 - Math.sin(s * 0.5 + 1) * 0.08;
        botA.position.y = botB.position.y = 0.18;
        const pos = sparks.geometry.attributes.position;
        for (let i = 0; i < 30; i++) { const r = ((st.t * 3 + i * 0.37) % 1); pos.setXYZ(i, Math.sin(i * 7.1) * r * 0.6, 1.5 + Math.cos(i * 3.3) * r * 0.6, 0.4 + Math.sin(i) * 0.2); }
        pos.needsUpdate = true; sparks.visible = A.status === 'running';
      } else if (A.status === 'done') {
        sparks.visible = false;
        const win = A.pass ? botA : botB, lose = A.pass ? botB : botA;
        const j = Math.abs(Math.sin(A.winT * 5)) * 0.35;
        win.position.y = 0.18 + j; win.userData.arms.forEach((a) => { a.rotation.x = lerp(a.rotation.x, -2.9, dt * 6); });
        lose.position.y = 0.18; lose.userData.arms.forEach((a) => { a.rotation.x = lerp(a.rotation.x, 0.2, dt * 4); });
        lose.userData.head.rotation.x = lerp(lose.userData.head.rotation.x, 0.45, dt * 3); win.userData.head.rotation.x = lerp(win.userData.head.rotation.x, -0.15, dt * 3);
        if (A.winT > 8) { A.status = 'idle'; botA.userData.head.rotation.x = botB.userData.head.rotation.x = 0; }
      }
      botA.userData.head.rotation.y = Math.sin(st.t * 1.3) * 0.15; botB.userData.head.rotation.y = -Math.sin(st.t * 1.1) * 0.15;
    }
    title.position.y = 4.5 + Math.sin(st.t * 1.2) * 0.03;
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(tick);

  // pause when off-screen (saves battery)
  const io = new IntersectionObserver(([e]) => { running = e.isIntersecting; prev = performance.now(); }, { threshold: 0.01 });
  io.observe(canvas);

  return {
    setGame,
    dispose() {
      cancelAnimationFrame(raf); io.disconnect(); window.removeEventListener('passbch:show', onShow); controls.dispose();
      scene.traverse((o) => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach((x) => { x.map?.dispose?.(); x.dispose(); }); });
      renderer.dispose();
    },
  };
}

/** Helper for game panels: tell the arena what just happened. */
export const show = (detail) => window.dispatchEvent(new CustomEvent('passbch:show', { detail }));
