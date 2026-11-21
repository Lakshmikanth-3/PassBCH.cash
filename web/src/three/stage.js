// PassBCH.cash 3D game-show stages (three.js). One canvas, one scene per game:
//   rps    — TV studio: three people around a table (you, opponent, host), hands play, cameras cut to the winner
//   ai     — boxing ring: two robot agents fight while the AI codes; the winner celebrates, the loser drops
//   updown — dark studio with a live 3D candle chart and a big arrow
// A "director" moves the camera between named shots like a live TV broadcast and reports the shot name.
// Driven by window 'passbch:show' events ({ kind: 'duel' | 'price' | 'ai', ... }).
import * as THREE from 'three';

export const THEME = { bg: 0x0a0b1e, floor: 0x101233, cyan: 0x00e5ff, magenta: 0xff3df0, lime: 0xb6ff3b, red: 0xff4d6d, gold: 0xffc23d, white: 0xf4f6ff };
const MOVES = ['rock', 'paper', 'scissors'];
const lerp = (a, b, t) => a + (b - a) * t;
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1, ...extra });
const glow = (color, k = 2) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: k, roughness: 0.3 });

function label(text, { size = 60, fg = '#ffffff', bg = 'rgba(10,11,30,0.85)', border = '#00e5ff', scale = 1 } = {}) {
  const c = document.createElement('canvas'); const g = c.getContext('2d');
  const font = `700 ${size}px "Chakra Petch", Inter, system-ui, sans-serif`;
  g.font = font; const w = Math.ceil(g.measureText(text).width) + size * 1.1; const h = Math.ceil(size * 1.6);
  c.width = w; c.height = h; g.font = font;
  g.fillStyle = bg; g.strokeStyle = border; g.lineWidth = size / 9;
  g.beginPath(); g.roundRect(g.lineWidth, g.lineWidth, w - 2 * g.lineWidth, h - 2 * g.lineWidth, h / 2.6); g.fill(); g.stroke();
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + size * 0.05);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set((w / h) * 0.4 * scale, 0.4 * scale, 1);
  s.userData.set = (t, o = {}) => { const n = label(t, { size, fg, bg, border, scale, ...o }); s.material.map.dispose(); s.material.map = n.material.map; s.scale.copy(n.scale); };
  return s;
}

// ---------- shared studio ----------
function studio(scene, accent) {
  scene.background = new THREE.Color(THEME.bg); scene.fog = new THREE.Fog(THEME.bg, 10, 24);
  scene.add(new THREE.HemisphereLight(0x8890ff, 0x0a0b1e, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(3, 8, 5); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 }); scene.add(key);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 64), std(THEME.floor, { roughness: 0.25, metalness: 0.4 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  // neon floor rings
  for (const [r, c] of [[4.2, accent], [6.5, THEME.magenta], [9, THEME.cyan]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.025, 6, 128), glow(c, 1.6)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.01; scene.add(ring);
  }
  // LED wall behind
  const wall = new THREE.Group(); scene.add(wall);
  const tile = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.42, 0.05), new THREE.MeshBasicMaterial({ color: 0xffffff }), 26 * 9);
  const m = new THREE.Matrix4(); const col = new THREE.Color(); let i = 0;
  for (let x = 0; x < 26; x++) for (let y = 0; y < 9; y++) {
    m.makeTranslation(-5.4 + x * 0.44, 0.6 + y * 0.44, -6); tile.setMatrixAt(i, m);
    tile.setColorAt(i++, col.setHex([THEME.cyan, THEME.magenta, accent, 0x1a1d4a][(x * 7 + y * 3) % 4 === 3 ? 3 : (x + y) % 3]).multiplyScalar((x * 3 + y * 5) % 7 === 0 ? 0.55 : 0.16));
  }
  wall.add(tile); wall.userData.tile = tile;
  // TV cameras on tripods (props: the audience sees the cameras that "film" the show)
  const cams = [];
  for (const [x, z, ry] of [[-4.2, 3.2, -0.9], [4.2, 3.2, 0.9], [0, 5.4, 0]]) {
    const rig = new THREE.Group(); rig.position.set(x, 0, z); rig.rotation.y = ry + Math.PI; scene.add(rig);
    for (let k = 0; k < 3; k++) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.5), std(0x2a2d55)); leg.position.set(Math.sin(k * 2.1) * 0.25, 0.7, Math.cos(k * 2.1) * 0.25); leg.rotation.z = Math.sin(k * 2.1) * 0.25; leg.rotation.x = -Math.cos(k * 2.1) * 0.25; rig.add(leg); }
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.6), std(0x1b1e3f, { metalness: 0.6 })); body.position.y = 1.55; rig.add(body);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.25, 20), std(0x05060f, { metalness: 0.8, roughness: 0.2 })); lens.rotation.x = Math.PI / 2; lens.position.set(0, 1.55, 0.42); rig.add(lens);
    const rec = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 10), glow(THEME.red, 3)); rec.position.set(0.12, 1.74, 0.2); rig.add(rec);
    cams.push({ rig, rec });
  }
  return { wall, cams };
}

function confetti(scene) {
  const N = 160; const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.08, 0.14), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), N);
  const parts = Array.from({ length: N }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: Math.random() * 6 }));
  const cols = [THEME.cyan, THEME.magenta, THEME.lime, THEME.gold, 0xffffff]; const c = new THREE.Color();
  for (let i = 0; i < N; i++) mesh.setColorAt(i, c.setHex(cols[i % cols.length]));
  mesh.visible = false; scene.add(mesh);
  const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const one = new THREE.Vector3(1, 1, 1);
  let t = 99;
  return {
    burst(at) { t = 0; mesh.visible = true; parts.forEach((o) => { o.p.copy(at); o.v.set((Math.random() - 0.5) * 5, 3 + Math.random() * 4, (Math.random() - 0.5) * 5); }); },
    update(dt) {
      if (!mesh.visible) return; t += dt; if (t > 4) { mesh.visible = false; return; }
      parts.forEach((o, i) => { o.v.y -= 6 * dt; o.v.multiplyScalar(0.99); o.p.addScaledVector(o.v, dt); if (o.p.y < 0.02) { o.p.y = 0.02; o.v.set(0, 0, 0); } o.r.set(o.r.x + o.w * dt, o.r.y + o.w * dt * 0.7, 0); q.setFromEuler(o.r); m.compose(o.p, q, one); mesh.setMatrixAt(i, m); });
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

// ---------- people + hands ----------
const POSES = { rock: [1, 1, 1, 1, 1], paper: [0, 0, 0, 0, 0], scissors: [1, 0, 0, 1, 1] };
function buildHand(skin) {
  const hand = new THREE.Group(); const mat = std(skin, { roughness: 0.7 });
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.14), mat); palm.castShadow = true; hand.add(palm);
  const fingers = [];
  [[0.17, -0.1, 0.1], [0.21, 0.11, 0], [0.23, 0.035, 0], [0.21, -0.04, 0], [0.17, -0.11, 0]].forEach(([len, y, z], i) => {
    const p = new THREE.Group(); p.position.set(0.15, y, z); hand.add(p);
    const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, len, 4, 8), mat); f.rotation.z = -Math.PI / 2; f.position.x = len / 2 + 0.03; f.castShadow = true; p.add(f);
    if (i === 0) p.rotation.y = -0.6; fingers.push(p);
  });
  hand.userData = { fingers, curl: [1, 1, 1, 1, 1], target: POSES.rock, spread: 0 };
  return hand;
}
function poseHand(h, dt) {
  const { fingers, curl, target, spread } = h.userData;
  fingers.forEach((p, i) => { curl[i] = lerp(curl[i], target[i], Math.min(1, dt * 14)); if (i === 0) p.rotation.z = -curl[i] * 1.2; else { p.rotation.y = curl[i] * 2.3; if (i <= 2) p.rotation.z = spread * (i === 1 ? 0.2 : -0.2); } });
}
function buildPerson({ shirt, skin, hair, name, accent }) {
  const g = new THREE.Group();
  const chair = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.7), std(0x1b1e3f)); chair.position.y = 0.55; g.add(chair);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.08), std(0x1b1e3f)); back.position.set(0, 0.95, -0.33); g.add(back);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.55), std(0x2a2d55)); leg.position.y = 0.27; g.add(leg);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.45, 6, 16), std(shirt)); torso.position.set(0, 1.12, -0.05); torso.castShadow = true; g.add(torso);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.025, 6, 24), glow(accent, 1.4)); collar.rotation.x = Math.PI / 2; collar.position.set(0, 1.47, -0.05); g.add(collar);
  const head = new THREE.Group(); head.position.set(0, 1.72, -0.03); g.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 24), std(skin, { roughness: 0.7 })); skull.castShadow = true; head.add(skull);
  const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.225, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.1), std(hair, { roughness: 0.9 })); hairM.rotation.x = -0.25; head.add(hairM);
  for (const x of [-0.075, 0.075]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 10), std(0x0a0b1e)); e.position.set(x, 0.02, 0.2); head.add(e); }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 16, Math.PI), std(0x5a1f2a)); mouth.rotation.z = Math.PI; mouth.position.set(0, -0.07, 0.2); head.add(mouth);
  // arm reaching toward the table centre (+z), ending in a playable hand
  const shoulder = new THREE.Group(); shoulder.position.set(0.25, 1.35, 0.05); g.add(shoulder);
  const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.55, 4, 10), std(shirt)); arm.rotation.x = Math.PI / 2.3; arm.position.set(0, -0.12, 0.3); arm.castShadow = true; shoulder.add(arm);
  const hand = buildHand(skin); hand.rotation.y = -Math.PI / 2; hand.position.set(-0.02, -0.25, 0.68); shoulder.add(hand);
  const other = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.45, 4, 10), std(shirt)); other.position.set(-0.3, 1.1, 0.05); other.rotation.z = 0.15; g.add(other);
  const tag = label(name, { size: 44, border: `#${accent.toString(16).padStart(6, '0')}`, scale: 0.8 }); tag.position.y = 2.25; g.add(tag);
  g.userData = { head, shoulder, hand, mouth, tag };
  return g;
}

// ---------- robots ----------
function buildRobot(color, name) {
  const r = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.95, 0.55), std(0xe8ebff, { metalness: 0.5, roughness: 0.3 })); body.position.y = 1.05; body.castShadow = true; r.add(body);
  const core = new THREE.Mesh(new THREE.CircleGeometry(0.15, 24), glow(color, 2.5)); core.position.set(0, 1.12, 0.28); r.add(core);
  const head = new THREE.Group(); head.position.y = 1.85; r.add(head);
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.55), std(0xe8ebff, { metalness: 0.5, roughness: 0.3 })); skull.castShadow = true; head.add(skull);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.26, 0.02), std(0x05060f, { roughness: 0.1 })); visor.position.z = 0.28; head.add(visor);
  const eyes = glow(color, 3); for (const x of [-0.13, 0.13]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.02), eyes); e.position.set(x, 0.01, 0.295); head.add(e); }
  const arms = [];
  for (const sx of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(0.52 * sx, 1.38, 0); r.add(sh);
    const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.5, 4, 10), std(0xc9cff5, { metalness: 0.5 })); a.position.y = -0.3; a.castShadow = true; sh.add(a);
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 16), glow(color, 1)); glove.position.y = -0.66; glove.castShadow = true; sh.add(glove);
    arms.push(sh);
  }
  for (const sx of [-1, 1]) { const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.42, 4, 10), std(0xc9cff5, { metalness: 0.5 })); l.position.set(0.2 * sx, 0.35, 0); l.castShadow = true; r.add(l); }
  const tag = label(name, { size: 44, border: `#${color.toString(16).padStart(6, '0')}`, scale: 0.85 }); tag.position.y = 2.55; r.add(tag);
  r.userData = { arms, head, body, tag, color, eyes };
  return r;
}

// ---------- scenes ----------
function rpsScene() {
  const scene = new THREE.Scene(); const set = studio(scene, THEME.gold);
  const table = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.1, 64), std(0x15183f, { metalness: 0.6, roughness: 0.25 })); table.position.y = 0.92; table.castShadow = table.receiveShadow = true; scene.add(table);
  const edge = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.03, 8, 96), glow(THEME.gold, 1.8)); edge.rotation.x = Math.PI / 2; edge.position.y = 0.97; scene.add(edge);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.4, 0.9), std(0x1b1e3f)); stem.position.y = 0.45; scene.add(stem);
  const logo = label('PassBCH', { size: 50, border: '#ffc23d', scale: 0.7 }); logo.position.set(0, 1.05, 0); logo.material.rotation = 0; scene.add(logo); logo.visible = false;
  const seat = (deg, p) => { const a = (deg * Math.PI) / 180; p.position.set(Math.sin(a) * 2.05, 0, Math.cos(a) * 2.05); p.rotation.y = a + Math.PI; scene.add(p); return p; };
  const you = seat(-55, buildPerson({ shirt: 0x1f6bff, skin: 0xf0c19c, hair: 0x2a1a12, name: 'You', accent: THEME.cyan }));
  const opp = seat(55, buildPerson({ shirt: 0xd42a8a, skin: 0x8d5a3b, hair: 0x111111, name: 'Opponent', accent: THEME.magenta }));
  const host = seat(180, buildPerson({ shirt: 0x15183f, skin: 0xd9a27c, hair: 0x6b4a2b, name: 'Host', accent: THEME.gold }));
  host.userData.shoulder.visible = false; // the host doesn't play
  const bowtie = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.03, 6, 12), glow(THEME.gold, 1.5)); bowtie.position.set(0, 1.42, 0.2); host.add(bowtie);
  const sign = label('rock · paper · scissors', { size: 56, border: '#ffc23d', scale: 1.1 }); sign.position.set(0, 2.9, 0); scene.add(sign);
  const spot = new THREE.SpotLight(0xffffff, 0, 9, 0.35, 0.5, 1); spot.position.set(0, 6, 0); spot.castShadow = false; scene.add(spot); scene.add(spot.target);
  const fx = confetti(scene);
  const shots = {
    WIDE: { pos: [0, 3.4, 5.6], look: [0, 1.2, 0] },
    HOST: { pos: [0, 1.9, 1.0], look: [0, 1.7, -2.05] },
    'CAM YOU': { pos: [1.6, 1.8, 0.4], look: [-1.5, 1.4, 1.2] },
    'CAM OPP': { pos: [-1.6, 1.8, 0.4], look: [1.5, 1.4, 1.2] },
    TABLE: { pos: [0, 4.2, 0.6], look: [0, 1, 0] },
    HANDS: { pos: [0, 1.55, 2.6], look: [0, 1.15, 0.6] },
  };
  const st = { phase: 'idle', t: 0, idle: 0, a: 'rock', b: 'rock', res: null };
  return {
    scene, shots, set, idleShots: [['WIDE', 4], ['HOST', 2.5], ['CAM YOU', 2.5], ['CAM OPP', 2.5], ['TABLE', 3]],
    onEvent(d, dir) { if (d.kind === 'duel') { Object.assign(st, { phase: 'shake', t: 0, a: d.aMove, b: d.bMove, res: d.result }); dir.cut('HANDS'); sign.userData.set('rock…'); } },
    update(dt, time, dir, reduced) {
      st.t += dt;
      const people = [you, opp];
      people.forEach((p) => { p.userData.head.rotation.y = Math.sin(time * 0.8 + p.position.x) * 0.15; });
      host.userData.head.rotation.y = Math.sin(time * 0.6) * 0.35;
      if (st.phase === 'idle') {
        st.idle += dt; people.forEach((p) => { p.userData.hand.userData.target = POSES.rock; });
        if (st.idle > 7 && !reduced) { st.idle = 0; Object.assign(st, { phase: 'shake', t: 0, a: MOVES[(Math.random() * 3) | 0], b: MOVES[(Math.random() * 3) | 0], res: null }); dir.cut('HANDS'); }
      }
      if (st.phase === 'shake') {
        const k = st.t / 0.45; const beat = Math.floor(k);
        people.forEach((p) => { p.userData.shoulder.rotation.x = -Math.abs(Math.sin(k * Math.PI)) * 0.5; p.userData.hand.userData.target = POSES.rock; p.userData.hand.userData.spread = 0; });
        if (beat !== st.beat && beat < 3) { st.beat = beat; sign.userData.set(['rock…', 'paper…', 'scissors…'][beat]); }
        if (st.t > 1.35) {
          st.phase = 'reveal'; st.t = 0; st.beat = -1;
          you.userData.hand.userData.target = POSES[st.a]; you.userData.hand.userData.spread = st.a === 'scissors' ? 1 : 0;
          opp.userData.hand.userData.target = POSES[st.b]; opp.userData.hand.userData.spread = st.b === 'scissors' ? 1 : 0;
          st.win = st.res ?? (st.a === st.b ? 0 : (MOVES.indexOf(st.a) - MOVES.indexOf(st.b) + 3) % 3 === 1 ? 1 : 2);
          sign.userData.set(st.win === 0 ? `${st.a} = ${st.b} · DRAW` : st.win === 1 ? `${st.a} beats ${st.b} · YOU WIN` : `${st.b} beats ${st.a} · OPPONENT WINS`, { border: st.win === 0 ? '#ffc23d' : st.win === 1 ? '#b6ff3b' : '#ff4d6d' });
          dir.sequence([['TABLE', 1.3], [st.win === 2 ? 'CAM OPP' : 'CAM YOU', 3.2], ['HOST', 2], ['WIDE', 2]]);
        }
      }
      if (st.phase === 'reveal') {
        people.forEach((p) => { p.userData.shoulder.rotation.x = lerp(p.userData.shoulder.rotation.x, 0, dt * 8); });
        if (st.t > 1.2 && !st.burst) {
          st.burst = true;
          if (st.win) { const w = st.win === 1 ? you : opp; spot.intensity = 40; spot.target.position.copy(w.position); spot.position.set(w.position.x * 0.5, 6, w.position.z * 0.5); fx.burst(new THREE.Vector3(w.position.x, 2.2, w.position.z)); }
        }
        const w = st.win === 1 ? you : st.win === 2 ? opp : null;
        if (w) { w.userData.head.position.y = 1.72 + Math.abs(Math.sin(st.t * 6)) * 0.06; }
        if (st.t > 8.5) { st.phase = 'idle'; st.idle = 0; st.burst = false; spot.intensity = 0; you.userData.head.position.y = opp.userData.head.position.y = 1.72; sign.userData.set('rock · paper · scissors', { border: '#ffc23d' }); }
      }
      poseHand(you.userData.hand, dt); poseHand(opp.userData.hand, dt);
      fx.update(dt);
    },
  };
}

function aiScene() {
  const scene = new THREE.Scene(); const set = studio(scene, THEME.lime);
  const ring = new THREE.Group(); scene.add(ring);
  const mat = new THREE.Mesh(new THREE.BoxGeometry(5, 0.35, 5), std(0x1b1e3f)); mat.position.y = 0.175; mat.receiveShadow = mat.castShadow = true; ring.add(mat);
  const canvasTop = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.02, 4.8), std(0x22265a, { roughness: 0.8 })); canvasTop.position.y = 0.36; canvasTop.receiveShadow = true; ring.add(canvasTop);
  const postCols = [THEME.cyan, THEME.magenta, THEME.cyan, THEME.magenta];
  [[-2.3, -2.3], [2.3, -2.3], [2.3, 2.3], [-2.3, 2.3]].forEach(([x, z], i) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.4), glow(postCols[i], 1.2)); post.position.set(x, 1.05, z); ring.add(post);
  });
  for (const h of [0.75, 1.05, 1.35]) for (const [ax, az, len, rot] of [[0, -2.3, 4.6, 0], [0, 2.3, 4.6, 0], [-2.3, 0, 4.6, Math.PI / 2], [2.3, 0, 4.6, Math.PI / 2]]) {
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, len), std(0xf4f6ff, { emissive: 0x333366 })); rope.rotation.z = Math.PI / 2; rope.rotation.y = rot; rope.position.set(ax, h, az); ring.add(rope);
  }
  const A = buildRobot(THEME.cyan, 'AI agent'); A.position.set(-0.9, 0.36, 0); A.rotation.y = 0.95; scene.add(A);
  const B = buildRobot(THEME.magenta, 'Unit tests'); B.position.set(0.9, 0.36, 0); B.rotation.y = -0.95; scene.add(B);
  const board = label('next exam loading…', { size: 54, border: '#b6ff3b', scale: 1.1 }); board.position.set(0, 3.4, 0); scene.add(board);
  const spots = [THEME.cyan, THEME.magenta].map((c, i) => { const s = new THREE.SpotLight(c, 30, 12, 0.4, 0.6, 1); s.position.set(i ? 3 : -3, 6, 2); s.target = i ? B : A; scene.add(s); return s; });
  const sparks = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(120), 3)), new THREE.PointsMaterial({ color: THEME.gold, size: 0.06 })); scene.add(sparks);
  const fx = confetti(scene);
  const shots = {
    WIDE: { pos: [0, 3.6, 7.2], look: [0, 1.3, 0] },
    'RINGSIDE': { pos: [0, 1.35, 3.6], look: [0, 1.5, 0] },
    'CAM AI': { pos: [1.6, 1.9, 2.0], look: [-0.9, 1.7, 0] },
    'CAM TESTS': { pos: [-1.6, 1.9, 2.0], look: [0.9, 1.7, 0] },
    OVERHEAD: { pos: [0, 6.5, 1.2], look: [0, 0.5, 0] },
  };
  const st = { status: 'idle', pass: null, t: 0, hitA: 0, hitB: 0 };
  return {
    scene, shots, set, idleShots: [['WIDE', 3.5], ['RINGSIDE', 2.5], ['CAM AI', 2.2], ['CAM TESTS', 2.2], ['OVERHEAD', 2.5]],
    onEvent(d, dir) {
      if (d.kind !== 'ai') return;
      if (d.status === 'open') board.userData.set(`${d.model} vs "${d.slug}" · BETS OPEN`, { border: '#ffc23d' });
      if (d.status === 'running') board.userData.set(`${d.model} is coding "${d.slug}"`, { border: '#00e5ff' });
      if (d.status === 'done' && st.status !== 'done') {
        board.userData.set(d.pass ? `PASS ${d.passed}/${d.total} · THE AI WINS` : `FAIL ${d.passed}/${d.total} · THE TESTS WIN`, { border: d.pass ? '#b6ff3b' : '#ff4d6d' });
        st.t = 0; const w = d.pass ? A : B; fx.burst(new THREE.Vector3(w.position.x, 2.5, 0));
        dir.sequence([[d.pass ? 'CAM AI' : 'CAM TESTS', 3.5], ['OVERHEAD', 2], ['WIDE', 3]]);
      }
      if (d.status === 'void') board.userData.set('round void · stakes refunded', { border: '#ffc23d' });
      st.status = d.status; st.pass = d.pass ?? null;
    },
    update(dt, time, dir, reduced) {
      st.t += dt;
      const fighting = st.status !== 'done' && !reduced;
      const tempo = st.status === 'running' ? 8 : 4;
      const s = time * tempo;
      for (const [bot, other, phase, base] of [[A, B, 0, -0.9], [B, A, Math.PI, 0.9]]) {
        const [l, r] = bot.userData.arms;
        if (fighting) {
          const jab = Math.max(0, Math.sin(s + phase)); const cross = Math.max(0, Math.sin(s + phase + Math.PI));
          r.rotation.x = -jab * 1.6; l.rotation.x = -cross * 1.6; r.rotation.z = l.rotation.z = 0;
          bot.position.x = base + Math.sin(s * 0.35 + phase) * 0.15 * Math.sign(base) * -1;
          bot.position.y = 0.36 + Math.abs(Math.sin(s * 0.5)) * 0.05;
          bot.userData.head.rotation.z = Math.sin(s + phase + 1.6) > 0.85 ? 0.25 * Math.sign(base) : lerp(bot.userData.head.rotation.z, 0, dt * 6); // gets hit
          bot.rotation.x = 0;
        }
      }
      if (st.status === 'done') {
        const w = st.pass ? A : B, lo = st.pass ? B : A;
        w.position.y = 0.36 + Math.abs(Math.sin(st.t * 5)) * 0.4;
        w.userData.arms.forEach((a, i) => { a.rotation.x = lerp(a.rotation.x, -2.9, dt * 5); a.rotation.z = (i ? -1 : 1) * 0.3; });
        lo.rotation.x = lerp(lo.rotation.x, lo === A ? -1.45 : -1.45, dt * 3); lo.position.y = lerp(lo.position.y, 0.62, dt * 3);
        lo.userData.arms.forEach((a) => { a.rotation.x = lerp(a.rotation.x, 0.3, dt * 4); });
        if (st.t > 9) { st.status = 'idle'; A.rotation.x = B.rotation.x = 0; A.position.y = B.position.y = 0.36; }
      }
      const pos = sparks.geometry.attributes.position; sparks.visible = fighting && st.status === 'running';
      if (sparks.visible) { for (let i = 0; i < 40; i++) { const r = (time * 3 + i * 0.29) % 1; pos.setXYZ(i, Math.sin(i * 7.1) * r * 0.7, 1.6 + Math.cos(i * 3.3) * r * 0.6, Math.sin(i) * 0.3); } pos.needsUpdate = true; }
      spots.forEach((sp, i) => { sp.intensity = 25 + Math.sin(time * 2 + i) * 8; });
      fx.update(dt);
    },
  };
}

function updownScene() {
  const scene = new THREE.Scene(); const set = studio(scene, THEME.cyan);
  const g = new THREE.Group(); scene.add(g);
  const base = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.12, 2), std(0x15183f, { metalness: 0.5, roughness: 0.3 })); base.position.y = 0.06; base.receiveShadow = true; g.add(base);
  const grid = new THREE.GridHelper(6, 12, 0x2f3470, 0x1d2150); grid.position.y = 0.13; g.add(grid);
  const candles = Array.from({ length: 14 }, (_, i) => {
    const c = new THREE.Group(); c.position.set(-2.8 + i * 0.42, 0.13, 0);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1, 0.24), glow(THEME.lime, 0.9)); body.castShadow = true; c.add(body);
    const wick = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1, 0.03), std(0x8a90c0)); c.add(wick);
    c.userData = { body, wick }; g.add(c); return c;
  });
  const arrow = new THREE.Group(); const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.9, 24), glow(THEME.lime, 1.6)); arrow.add(shaft);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.6, 32), glow(THEME.lime, 1.8)); tip.position.y = 0.72; arrow.add(tip); arrow.position.set(3.6, 2.2, 0); scene.add(arrow);
  const price = label('BCH $—', { size: 80, border: '#00e5ff', scale: 1.5 }); price.position.set(0, 3.35, 0); scene.add(price);
  const shots = { WIDE: { pos: [0, 2.8, 7.4], look: [0, 1.5, 0] }, 'CLOSE': { pos: [2.2, 1.9, 3.6], look: [1.4, 1.4, 0] }, 'LOW': { pos: [-2.6, 0.9, 4.2], look: [0, 1.4, 0] } };
  const st = { hist: [], price: null, dir: 0 };
  return {
    scene, shots, set, idleShots: [['WIDE', 6], ['CLOSE', 3], ['LOW', 3]],
    onEvent(d) {
      if (d.kind !== 'price') return;
      if (d.history?.length) st.hist = [...d.history];
      if (d.price) { if (st.price) st.dir = Math.sign(d.price - st.price) || st.dir; st.price = d.price; st.hist.push(d.price); if (st.hist.length > 15) st.hist.shift(); price.userData.set(`BCH $${d.price.toFixed(2)}`, { border: st.dir < 0 ? '#ff4d6d' : '#b6ff3b' }); }
    },
    update(dt, time) {
      const h = st.hist.length ? st.hist : [1]; const lo = Math.min(...h), hi = Math.max(...h), span = Math.max(0.05, hi - lo);
      candles.forEach((c, i) => {
        const a = h[i] ?? h[h.length - 1], b = h[i + 1] ?? a; const live = i === Math.min(h.length - 2, 13);
        const y0 = 0.25 + ((a - lo) / span) * 2.2, y1 = 0.25 + ((b - lo) / span) * 2.2 + (live ? Math.sin(time * 6) * 0.04 : 0);
        const top = Math.max(y0, y1), bot = Math.min(y0, y1), hh = Math.max(0.06, top - bot);
        c.userData.body.scale.y = lerp(c.userData.body.scale.y, hh, dt * 6); c.userData.body.position.y = lerp(c.userData.body.position.y, bot + hh / 2, dt * 6);
        c.userData.wick.scale.y = hh + 0.3; c.userData.wick.position.y = c.userData.body.position.y;
        const col = b >= a ? THEME.lime : THEME.red; c.userData.body.material.color.setHex(col); c.userData.body.material.emissive.setHex(col);
        c.visible = i < Math.max(1, h.length - 1);
      });
      const up = st.dir >= 0, col = up ? THEME.lime : THEME.red;
      arrow.rotation.z = lerp(arrow.rotation.z, up ? 0 : Math.PI, dt * 6); arrow.position.y = 2.2 + Math.sin(time * 3) * 0.15; arrow.rotation.y += dt * 1.4;
      for (const m of [shaft, tip]) { m.material.color.setHex(col); m.material.emissive.setHex(col); }
    },
  };
}

// ---------- director + renderer ----------
export function createStage(canvas, { game = 'rps', reducedMotion = false, onShot } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  const camera = new THREE.PerspectiveCamera(45, 2, 0.1, 80);
  const world = { rps: rpsScene, ai: aiScene, updown: updownScene }[game]();
  const look = new THREE.Vector3(); const wantPos = new THREE.Vector3(); const wantLook = new THREE.Vector3();
  const director = {
    queue: [], current: null, t: 0, idleIdx: 0,
    go(name, hold) { const s = world.shots[name]; if (!s) return; this.current = name; this.t = 0; this.hold = hold; wantPos.set(...s.pos); wantLook.set(...s.look); onShot?.(name); },
    cut(name, hold = 3) { this.queue = []; this.go(name, hold); },
    sequence(list) { this.queue = [...list]; const [n, h] = this.queue.shift(); this.go(n, h); },
    update(dt) {
      this.t += dt;
      if (this.t > this.hold) {
        if (this.queue.length) { const [n, h] = this.queue.shift(); this.go(n, h); }
        else if (!reducedMotion) { const [n, h] = world.idleShots[this.idleIdx++ % world.idleShots.length]; this.go(n, h); }
      }
      const k = Math.min(1, dt * 2.4);
      camera.position.lerp(wantPos, k); look.lerp(wantLook, k);
      // gentle handheld drift, like a real camera operator
      camera.position.x += Math.sin(clock * 0.7) * 0.0015; camera.position.y += Math.cos(clock * 0.9) * 0.0012;
      camera.lookAt(look);
    },
  };
  const first = world.idleShots[0][0]; director.go(first, world.idleShots[0][1]);
  camera.position.copy(wantPos); look.copy(wantLook); camera.lookAt(look);

  const onShow = (e) => world.onEvent?.(e.detail ?? {}, director);
  window.addEventListener('passbch:show', onShow);

  let clock = 0, prev = performance.now(), raf = 0, running = true;
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight; const pr = renderer.getPixelRatio();
    if (canvas.width !== Math.floor(w * pr) || canvas.height !== Math.floor(h * pr)) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < 640 ? 58 : 45; camera.updateProjectionMatrix(); }
  };
  const tick = (now) => {
    raf = requestAnimationFrame(tick); if (!running) return;
    const dt = Math.min(0.05, (now - prev) / 1000); prev = now; clock += dt;
    resize(); director.update(dt); world.update(dt, clock, director, reducedMotion);
    const tile = world.set.wall.userData.tile; if (tile && !reducedMotion) tile.material.color.setScalar(0.85 + Math.sin(clock * 2) * 0.15);
    world.set.cams.forEach((c, i) => { c.rec.visible = Math.sin(clock * 4 + i) > -0.3; });
    renderer.render(world.scene, camera);
  };
  raf = requestAnimationFrame(tick);
  const io = new IntersectionObserver(([e]) => { running = e.isIntersecting; prev = performance.now(); }, { threshold: 0.01 }); io.observe(canvas);
  return {
    dispose() {
      cancelAnimationFrame(raf); io.disconnect(); window.removeEventListener('passbch:show', onShow);
      world.scene.traverse((o) => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach((x) => { x.map?.dispose?.(); x.dispose(); }); });
      renderer.dispose();
    },
  };
}
