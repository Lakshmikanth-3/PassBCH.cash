// PassBCH.cash 3D game-show stages (three.js). One canvas, one scene per game:
//   rps    — colourful TV studio: you, your opponent and the host around a table; real jointed hands
//   pf     — Prompt Fight arena: two AI agents, a giant live counter, every move is a punch
//   updown — studio with a live 3D candle chart and a big arrow
// Nothing plays on its own: the stage idles (breathing, slow camera) and only performs REAL results
// sent as window 'passbch:show' events. A director cuts between named TV shots during a performance.
import * as THREE from 'three';

export const THEME = { cyan: 0x00e5ff, magenta: 0xff3df0, lime: 0xb6ff3b, red: 0xff4d6d, gold: 0xffc23d, violet: 0x7b5cff };
const MOVES = ['rock', 'paper', 'scissors'];
const lerp = (a, b, t) => a + (b - a) * t;
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.05, ...extra });
const glow = (color, k = 2) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: k, roughness: 0.3 });
const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;

function label(text, { size = 60, fg = '#1a1340', bg = 'rgba(255,255,255,0.94)', border = '#00e5ff', scale = 1 } = {}) {
  const c = document.createElement('canvas'); const g = c.getContext('2d');
  const font = `700 ${size}px "Chakra Petch", Inter, system-ui, sans-serif`;
  g.font = font; const w = Math.ceil(g.measureText(text).width) + size * 1.1; const h = Math.ceil(size * 1.6);
  c.width = w; c.height = h; g.font = font;
  g.fillStyle = bg; g.strokeStyle = border; g.lineWidth = size / 8;
  g.beginPath(); g.roundRect(g.lineWidth, g.lineWidth, w - 2 * g.lineWidth, h - 2 * g.lineWidth, h / 2.6); g.fill(); g.stroke();
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + size * 0.05);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set((w / h) * 0.4 * scale, 0.4 * scale, 1);
  s.userData.set = (t, o = {}) => { const n = label(t, { size, fg, bg, border, scale, ...o }); s.material.map.dispose(); s.material.map = n.material.map; s.scale.copy(n.scale); };
  return s;
}

/** Vertical gradient used as the studio sky: colourful, never black. */
function gradientTexture(stops) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256); stops.forEach(([o, col]) => grd.addColorStop(o, col));
  g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- shared studio ----------
function studio(scene, accent, sky) {
  scene.background = gradientTexture(sky);
  scene.fog = new THREE.Fog(0x3a2a8a, 14, 30);
  scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x5a3b9a, 1.25));
  const key = new THREE.DirectionalLight(0xffffff, 1.9); key.position.set(3, 8, 6); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 }); scene.add(key);
  const fill = new THREE.DirectionalLight(0xff9ee8, 0.6); fill.position.set(-5, 4, 2); scene.add(fill);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 72), std(0x3b2f96, { roughness: 0.35, metalness: 0.25 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const inner = new THREE.Mesh(new THREE.CircleGeometry(4.2, 72), std(0x4b3ec0, { roughness: 0.3, metalness: 0.3 }));
  inner.rotation.x = -Math.PI / 2; inner.position.y = 0.005; inner.receiveShadow = true; scene.add(inner);
  for (const [r, c] of [[4.2, accent], [6.4, THEME.magenta], [8.8, THEME.cyan]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.03, 6, 128), glow(c, 1.4)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.012; scene.add(ring);
  }
  const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(0.46, 0.46, 0.05), new THREE.MeshBasicMaterial({ color: 0xffffff }), 22 * 8);
  const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const col = new THREE.Color(); let i = 0;
  const palette = [THEME.cyan, THEME.magenta, accent, THEME.violet];
  for (let x = 0; x < 22; x++) for (let y = 0; y < 8; y++) {
    const a = -0.9 + (x / 21) * 1.8; const p = new THREE.Vector3(Math.sin(a) * 7.5, 0.7 + y * 0.5, -Math.cos(a) * 7.5);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a); m.compose(p, q, new THREE.Vector3(1, 1, 1)); tiles.setMatrixAt(i, m);
    tiles.setColorAt(i++, col.setHex(palette[(x * 5 + y * 3) % 4]).lerp(new THREE.Color(0xffffff), 0.25).multiplyScalar((x + y) % 5 === 0 ? 0.95 : 0.55));
  }
  scene.add(tiles);
  const cams = [];
  for (const [x, z, ry] of [[-4.4, 3.4, -0.9], [4.4, 3.4, 0.9], [-2.6, -4.6, 2.6]]) {
    const rig = new THREE.Group(); rig.position.set(x, 0, z); rig.rotation.y = ry + Math.PI; scene.add(rig);
    for (let k = 0; k < 3; k++) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.5), std(0x2a2d55)); leg.position.set(Math.sin(k * 2.1) * 0.25, 0.7, Math.cos(k * 2.1) * 0.25); leg.rotation.z = Math.sin(k * 2.1) * 0.25; leg.rotation.x = -Math.cos(k * 2.1) * 0.25; rig.add(leg); }
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.6), std(0x23264d, { metalness: 0.6 })); body.position.y = 1.55; rig.add(body);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.25, 20), std(0x05060f, { metalness: 0.8, roughness: 0.2 })); lens.rotation.x = Math.PI / 2; lens.position.set(0, 1.55, 0.42); rig.add(lens);
    const rec = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 10), glow(THEME.red, 3)); rec.position.set(0.12, 1.74, 0.2); rig.add(rec);
    cams.push({ rig, rec });
  }
  return { tiles, cams };
}

function confetti(scene) {
  const N = 180; const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.08, 0.14), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), N);
  const parts = Array.from({ length: N }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: Math.random() * 6 }));
  const cols = [THEME.cyan, THEME.magenta, THEME.lime, THEME.gold, 0xffffff]; const c = new THREE.Color();
  for (let i = 0; i < N; i++) mesh.setColorAt(i, c.setHex(cols[i % cols.length]));
  mesh.visible = false; scene.add(mesh);
  const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const one = new THREE.Vector3(1, 1, 1); let t = 99;
  return {
    burst(at) { t = 0; mesh.visible = true; parts.forEach((o) => { o.p.copy(at); o.v.set((Math.random() - 0.5) * 5, 3 + Math.random() * 4, (Math.random() - 0.5) * 5); }); },
    update(dt) {
      if (!mesh.visible) return; t += dt; if (t > 4.5) { mesh.visible = false; return; }
      parts.forEach((o, i) => { o.v.y -= 6 * dt; o.v.multiplyScalar(0.99); o.p.addScaledVector(o.v, dt); if (o.p.y < 0.03) { o.p.y = 0.03; o.v.set(0, 0, 0); } o.r.set(o.r.x + o.w * dt, o.r.y + o.w * dt * 0.7, 0); q.setFromEuler(o.r); m.compose(o.p, q, one); mesh.setMatrixAt(i, m); });
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

// ---------- realistic jointed hand ----------
// Built along +X (fingers point +X, palm faces -Y). Each finger has 3 phalanges that curl joint by joint.
const POSES = { rock: [1, 1, 1, 1, 1], paper: [0, 0, 0, 0, 0], scissors: [1, 0, 0, 1, 1] }; // [thumb, index, middle, ring, pinky]
function buildHand(skinHex) {
  const skin = std(skinHex, { roughness: 0.62 }); const nail = std(0xf6d9d2, { roughness: 0.3 });
  const hand = new THREE.Group();
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), skin); palm.scale.set(0.42, 0.13, 0.36); palm.castShadow = true; hand.add(palm);
  const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.32, 18), skin); wrist.rotation.z = Math.PI / 2; wrist.position.x = -0.27; hand.add(wrist);
  const fingers = [];
  [[0.135, 0.95, 0.07], [0.05, 1.05, 0.02], [-0.035, 0.92, -0.02], [-0.11, 0.74, -0.06]].forEach(([z, s, spread]) => {
    const base = new THREE.Group(); base.position.set(0.19, 0, z); base.rotation.y = -spread; hand.add(base);
    const segs = []; let parent = base; const lens = [0.15, 0.1, 0.08].map((l) => l * s);
    lens.forEach((len, k) => {
      const joint = new THREE.Group(); if (k) joint.position.x = lens[k - 1]; parent.add(joint);
      const r = 0.036 - k * 0.004;
      const seg = new THREE.Mesh(new THREE.CapsuleGeometry(r, len - r, 4, 10), skin); seg.rotation.z = -Math.PI / 2; seg.position.x = len / 2; seg.castShadow = true; joint.add(seg);
      if (k === 2) { const n = new THREE.Mesh(new THREE.SphereGeometry(r * 0.9, 10, 8), nail); n.scale.set(1.1, 0.35, 0.8); n.position.set(len * 0.7, r * 0.75, 0); joint.add(n); }
      segs.push(joint); parent = joint;
    });
    fingers.push({ base, segs });
  });
  const tb = new THREE.Group(); tb.position.set(0.02, -0.03, 0.17); tb.rotation.set(0.5, -0.9, 0); hand.add(tb);
  const t1 = new THREE.Group(); tb.add(t1); const t2 = new THREE.Group(); t2.position.x = 0.13; t1.add(t2);
  for (const [j, len, r] of [[t1, 0.13, 0.045], [t2, 0.1, 0.04]]) { const seg = new THREE.Mesh(new THREE.CapsuleGeometry(r, len - r, 4, 10), skin); seg.rotation.z = -Math.PI / 2; seg.position.x = len / 2; seg.castShadow = true; j.add(seg); }
  hand.userData = { fingers, thumb: [t1, t2], curl: [1, 1, 1, 1, 1], target: POSES.rock, spread: 0 };
  return hand;
}
function poseHand(h, dt) {
  const u = h.userData;
  for (let i = 0; i < 5; i++) u.curl[i] = lerp(u.curl[i], u.target[i], Math.min(1, dt * 12));
  u.fingers.forEach((f, i) => {
    const c = u.curl[i + 1];
    f.segs[0].rotation.z = -c * 1.45; f.segs[1].rotation.z = -c * 1.6; f.segs[2].rotation.z = -c * 1.0;
    f.base.rotation.y = (i === 0 ? -1 : i === 1 ? 1 : 0) * u.spread * 0.28 + [-0.07, -0.02, 0.02, 0.06][i] * (1 - u.spread);
  });
  const ct = u.curl[0];
  u.thumb[0].rotation.z = -ct * 0.6; u.thumb[0].rotation.y = ct * 0.9; u.thumb[1].rotation.z = -ct * 0.9;
}

function buildPerson({ shirt, skin, hair, name, accent, host = false }) {
  const g = new THREE.Group();
  const chair = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.08, 0.7), std(0x2c2f66)); chair.position.y = 0.55; g.add(chair);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.85, 0.08), std(0x2c2f66)); back.position.set(0, 0.98, -0.33); g.add(back);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.04, 0.09), glow(accent, 1.2)); trim.position.set(0, 1.4, -0.33); g.add(trim);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.55), std(0x55588a)); leg.position.y = 0.27; g.add(leg);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.42, 6, 18), std(shirt, { roughness: 0.7 })); torso.position.set(0, 1.12, -0.05); torso.castShadow = true; g.add(torso);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.12, 12), std(skin)); neck.position.set(0, 1.53, -0.04); g.add(neck);
  const head = new THREE.Group(); head.position.set(0, 1.76, -0.03); g.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.21, 28, 24), std(skin, { roughness: 0.65 })); skull.scale.set(1, 1.08, 1); skull.castShadow = true; head.add(skull);
  const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.218, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2.05), std(hair, { roughness: 0.9 })); hairM.rotation.x = -0.3; hairM.scale.set(1, 1.08, 1); head.add(hairM);
  for (const x of [-0.07, 0.07]) {
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 12), std(0xffffff)); white.position.set(x, 0.03, 0.185); head.add(white);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.017, 10, 10), std(0x1a1030)); pupil.position.set(x, 0.03, 0.212); head.add(pupil);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.01), std(hair)); brow.position.set(x, 0.085, 0.2); head.add(brow);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 10), std(skin)); nose.position.set(0, -0.01, 0.215); head.add(nose);
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.011, 6, 16, Math.PI), std(0x8a2a3a)); mouth.rotation.z = Math.PI; mouth.position.set(0, -0.075, 0.195); head.add(mouth);
  for (const x of [-0.2, 0.2]) { const ear = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 10), std(skin)); ear.scale.set(0.5, 1, 0.8); ear.position.set(x, 0, 0); head.add(ear); }
  const shoulder = new THREE.Group(); shoulder.position.set(0.26, 1.36, 0.02); g.add(shoulder);
  const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.42, 4, 12), std(shirt, { roughness: 0.7 })); upper.rotation.x = Math.PI / 2.3; upper.position.set(-0.02, -0.08, 0.22); upper.castShadow = true; shoulder.add(upper);
  const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.4, 4, 12), std(skin)); fore.rotation.x = Math.PI / 2.05; fore.position.set(-0.05, -0.15, 0.62); fore.castShadow = true; shoulder.add(fore);
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.022, 6, 18), glow(accent, 1.3)); cuff.position.set(-0.04, -0.13, 0.45); shoulder.add(cuff);
  const hand = buildHand(skin); hand.rotation.set(0, -Math.PI / 2, 0); hand.position.set(-0.07, -0.13, 0.95); hand.scale.setScalar(1.35); shoulder.add(hand);
  const other = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.42, 4, 10), std(shirt, { roughness: 0.7 })); other.position.set(-0.31, 1.1, 0.05); other.rotation.z = 0.15; g.add(other);
  if (host) { shoulder.visible = false; const bow = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.025, 6, 12), glow(THEME.gold, 1.4)); bow.position.set(0, 1.47, 0.2); g.add(bow); }
  const tag = label(name, { size: 44, border: hex(accent), scale: 0.8 }); tag.position.y = 2.25; g.add(tag);
  g.userData = { head, shoulder, hand, tag };
  return g;
}

function buildRobot(color, name) {
  const r = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.95, 0.55), std(0xf2f4ff, { metalness: 0.4, roughness: 0.3 })); body.position.y = 1.05; body.castShadow = true; r.add(body);
  const core = new THREE.Mesh(new THREE.CircleGeometry(0.15, 24), glow(color, 2.5)); core.position.set(0, 1.12, 0.28); r.add(core);
  const head = new THREE.Group(); head.position.y = 1.85; r.add(head);
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.55), std(0xf2f4ff, { metalness: 0.4, roughness: 0.3 })); skull.castShadow = true; head.add(skull);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.26, 0.02), std(0x120c2e, { roughness: 0.1 })); visor.position.z = 0.28; head.add(visor);
  const eyes = glow(color, 3); for (const x of [-0.13, 0.13]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.02), eyes); e.position.set(x, 0.01, 0.295); head.add(e); }
  const arms = [];
  for (const sx of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(0.52 * sx, 1.38, 0); r.add(sh);
    const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.5, 4, 10), std(0xd6dbff, { metalness: 0.4 })); a.position.y = -0.3; a.castShadow = true; sh.add(a);
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 16), glow(color, 0.9)); glove.position.y = -0.66; glove.castShadow = true; sh.add(glove);
    arms.push(sh);
  }
  for (const sx of [-1, 1]) { const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.42, 4, 10), std(0xd6dbff, { metalness: 0.4 })); l.position.set(0.2 * sx, 0.35, 0); l.castShadow = true; r.add(l); }
  const tag = label(name, { size: 44, border: hex(color), scale: 0.85 }); tag.position.y = 2.55; r.add(tag);
  r.userData = { arms, head, tag };
  return r;
}

const SKY_WARM = [[0, '#5b2bd1'], [0.45, '#b03ccf'], [0.75, '#ff7ab8'], [1, '#ffb36b']];
const SKY_COOL = [[0, '#1e3cff'], [0.5, '#4c2bd1'], [0.8, '#a43ccf'], [1, '#ff6fb1']];
const SKY_GREEN = [[0, '#1b2fb8'], [0.5, '#1aa0c8'], [0.85, '#4fdc9a'], [1, '#c8ff8a']];

function rpsScene() {
  const scene = new THREE.Scene(); const set = studio(scene, THEME.gold, SKY_WARM);
  const table = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.1, 64), std(0xffffff, { roughness: 0.25, metalness: 0.1 })); table.position.y = 0.92; table.castShadow = table.receiveShadow = true; scene.add(table);
  const felt = new THREE.Mesh(new THREE.CircleGeometry(1.2, 64), std(0x1f8a6a, { roughness: 0.9 })); felt.rotation.x = -Math.PI / 2; felt.position.y = 0.976; felt.receiveShadow = true; scene.add(felt);
  const edge = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.035, 8, 96), glow(THEME.gold, 1.6)); edge.rotation.x = Math.PI / 2; edge.position.y = 0.97; scene.add(edge);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.45, 0.9), std(0xffffff, { roughness: 0.3 })); stem.position.y = 0.45; scene.add(stem);
  const seat = (deg, p) => { const a = (deg * Math.PI) / 180; p.position.set(Math.sin(a) * 2.05, 0, Math.cos(a) * 2.05); p.rotation.y = a + Math.PI; scene.add(p); return p; };
  const you = seat(-55, buildPerson({ shirt: 0x2f7bff, skin: 0xf2c6a0, hair: 0x3a2416, name: 'You', accent: THEME.cyan }));
  const opp = seat(55, buildPerson({ shirt: 0xe23a9a, skin: 0x9a6342, hair: 0x15100c, name: 'Opponent', accent: THEME.magenta }));
  const host = seat(180, buildPerson({ shirt: 0x24264f, skin: 0xd9a27c, hair: 0x6b4a2b, name: 'Host', accent: THEME.gold, host: true }));
  const sign = label('Pick your move to start', { size: 56, border: '#ffc23d', scale: 1.05 }); sign.position.set(0, 3.05, 0); scene.add(sign);
  const spot = new THREE.SpotLight(0xfff2c0, 0, 9, 0.38, 0.5, 1); spot.position.set(0, 6, 0); scene.add(spot); scene.add(spot.target);
  const fx = confetti(scene);
  scene.updateMatrixWorld(true);
  const face = (p, dist = 1.85, h = 1.95) => { const toC = new THREE.Vector3(-p.position.x, 0, -p.position.z).normalize(); const pos = p.position.clone().addScaledVector(toC, dist); return { pos: [pos.x, h, pos.z], look: [p.position.x, 1.55, p.position.z] }; };
  const a = new THREE.Vector3(), b = new THREE.Vector3(); you.userData.hand.getWorldPosition(a); opp.userData.hand.getWorldPosition(b); const mid = a.add(b).multiplyScalar(0.5);
  const shots = {
    WIDE: { pos: [0, 3.3, 5.9], look: [0, 1.25, 0], orbit: true },
    HOST: face(host, 2.0, 2.0), 'CAM YOU': face(you), 'CAM OPPONENT': face(opp),
    HANDS: { pos: [mid.x, 2.05, mid.z + 2.4], look: [mid.x, mid.y - 0.05, mid.z - 0.1] },
  };
  const st = { phase: 'idle', t: 0, a: 'rock', b: 'rock', res: null };
  return {
    scene, shots, set, idle: 'WIDE',
    onEvent(d, dir) {
      if (d.kind !== 'duel') return;
      if (d.waiting) { sign.userData.set(d.waiting, { border: '#00e5ff' }); return; }
      Object.assign(st, { phase: 'shake', t: 0, a: d.aMove, b: d.bMove, res: d.result, burst: false });
      if (d.names) { you.userData.tag.userData.set(d.names[0], { border: '#00e5ff' }); opp.userData.tag.userData.set(d.names[1], { border: '#ff3df0' }); }
      dir.sequence([['HOST', 1.1], ['HANDS', 1.5]]); sign.userData.set('Rock…', { border: '#ffc23d' });
    },
    update(dt, time) {
      st.t += dt;
      [you, opp, host].forEach((p, i) => { p.userData.head.rotation.y = Math.sin(time * 0.7 + i * 2) * 0.12; });
      if (st.phase === 'idle') [you, opp].forEach((p) => { p.userData.hand.userData.target = POSES.rock; p.userData.hand.userData.spread = 0; p.userData.shoulder.rotation.x = lerp(p.userData.shoulder.rotation.x, 0, dt * 4); });
      if (st.phase === 'shake') {
        const k = Math.max(0, st.t - 1.1) / 0.45; const beat = Math.floor(k);
        [you, opp].forEach((p) => { p.userData.shoulder.rotation.x = -Math.abs(Math.sin(k * Math.PI)) * 0.45; p.userData.hand.userData.target = POSES.rock; });
        if (st.t > 1.1 && beat !== st.beat && beat < 3) { st.beat = beat; sign.userData.set(['Rock…', 'Paper…', 'Scissors…'][beat], { border: '#ffc23d' }); }
        if (st.t > 1.1 + 1.35) {
          st.phase = 'reveal'; st.t = 0; st.beat = -1;
          you.userData.hand.userData.target = POSES[st.a]; you.userData.hand.userData.spread = st.a === 'scissors' ? 1 : 0;
          opp.userData.hand.userData.target = POSES[st.b]; opp.userData.hand.userData.spread = st.b === 'scissors' ? 1 : 0;
          st.win = st.res ?? (st.a === st.b ? 0 : (MOVES.indexOf(st.a) - MOVES.indexOf(st.b) + 3) % 3 === 1 ? 1 : 2);
          const cap = (s) => s[0].toUpperCase() + s.slice(1);
          sign.userData.set(st.win === 0 ? `${cap(st.a)} vs ${st.b} · Draw` : st.win === 1 ? `${cap(st.a)} beats ${st.b} · You win!` : `${cap(st.b)} beats ${st.a} · Opponent wins`, { border: st.win === 0 ? '#ffc23d' : st.win === 1 ? '#7ad61c' : '#ff4d6d' });
          this._dir.sequence([['HANDS', 1.4], [st.win === 2 ? 'CAM OPPONENT' : st.win === 1 ? 'CAM YOU' : 'HOST', 3.4], ['WIDE', Infinity]]);
        }
      }
      if (st.phase === 'reveal') {
        [you, opp].forEach((p) => { p.userData.shoulder.rotation.x = lerp(p.userData.shoulder.rotation.x, 0, dt * 8); });
        if (st.t > 1.3 && !st.burst) { st.burst = true; if (st.win) { const w = st.win === 1 ? you : opp; spot.intensity = 45; spot.target.position.copy(w.position); spot.position.set(w.position.x * 0.4, 6, w.position.z * 0.4); fx.burst(new THREE.Vector3(w.position.x, 2.3, w.position.z)); } }
        const w = st.win === 1 ? you : st.win === 2 ? opp : null; if (w) w.userData.head.position.y = 1.76 + Math.abs(Math.sin(st.t * 6)) * 0.05;
        if (st.t > 9) { st.phase = 'idle'; spot.intensity = 0; you.userData.head.position.y = opp.userData.head.position.y = 1.76; }
      }
      poseHand(you.userData.hand, dt); poseHand(opp.userData.hand, dt);
      fx.update(dt);
    },
  };
}

function pfScene() {
  const scene = new THREE.Scene(); const set = studio(scene, THEME.lime, SKY_COOL);
  const ring = new THREE.Group(); scene.add(ring);
  const mat = new THREE.Mesh(new THREE.BoxGeometry(5, 0.35, 5), std(0xffffff, { roughness: 0.4 })); mat.position.y = 0.175; mat.receiveShadow = mat.castShadow = true; ring.add(mat);
  const top = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.02, 4.8), std(0x5d4bff, { roughness: 0.7 })); top.position.y = 0.36; top.receiveShadow = true; ring.add(top);
  [[-2.3, -2.3, THEME.cyan], [2.3, -2.3, THEME.magenta], [2.3, 2.3, THEME.magenta], [-2.3, 2.3, THEME.cyan]].forEach(([x, z, c]) => { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.4), glow(c, 1.1)); post.position.set(x, 1.05, z); ring.add(post); });
  for (const hgt of [0.75, 1.05, 1.35]) for (const [ax, az, rot] of [[0, -2.3, 0], [0, 2.3, 0], [-2.3, 0, Math.PI / 2], [2.3, 0, Math.PI / 2]]) {
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 4.6), std(0xffffff)); rope.rotation.z = Math.PI / 2; rope.rotation.y = rot; rope.position.set(ax, hgt, az); ring.add(rope);
  }
  const A = buildRobot(THEME.cyan, 'Agent A'); A.position.set(-1.0, 0.36, 0); A.rotation.y = 0.95; scene.add(A);
  const B = buildRobot(THEME.magenta, 'Agent B'); B.position.set(1.0, 0.36, 0); B.rotation.y = -0.95; scene.add(B);
  const board = label('Write a prompt to start a fight', { size: 54, border: '#b6ff3b', scale: 1.05 }); board.position.set(0, 3.45, 0); scene.add(board);
  const counter = label('0', { size: 110, border: '#ffc23d', scale: 1.3 }); counter.position.set(0, 2.85, 0.2); counter.visible = false; scene.add(counter);
  const pop = label('+1', { size: 90, border: '#00e5ff', scale: 0.9 }); pop.visible = false; scene.add(pop);
  const fx = confetti(scene);
  const shots = {
    WIDE: { pos: [0, 3.4, 7.2], look: [0, 1.6, 0], orbit: true },
    RINGSIDE: { pos: [0, 1.6, 4.0], look: [0, 1.9, 0] },
    'CAM A': { pos: [1.3, 2.0, 2.3], look: [-1.0, 1.8, 0] },
    'CAM B': { pos: [-1.3, 2.0, 2.3], look: [1.0, 1.8, 0] },
    SCORE: { pos: [0, 2.9, 3.0], look: [0, 2.8, 0] },
  };
  const st = { turns: [], i: -1, t: 0, phase: 'idle', winner: null, setup: null, who: null };
  const punch = (bot, k) => { const [l, r] = bot.userData.arms; r.rotation.x = -Math.max(0, Math.sin(k * Math.PI)) * 1.7; l.rotation.x = lerp(l.rotation.x, -0.3, 0.2); };
  return {
    scene, shots, set, idle: 'WIDE',
    onEvent(d, dir) {
      if (d.kind !== 'pf') return;
      if (d.waiting) { board.userData.set(d.waiting, { border: '#00e5ff' }); return; }
      Object.assign(st, { turns: d.turns, setup: d, i: -1, t: 0, phase: 'intro', winner: d.winner, who: null });
      A.userData.tag.userData.set(d.aName ?? 'Agent A', { border: '#00e5ff' }); B.userData.tag.userData.set(d.bName ?? 'Agent B', { border: '#ff3df0' });
      [A, B].forEach((bot) => { bot.rotation.x = 0; bot.rotation.z = 0; bot.position.y = 0.36; bot.userData.arms.forEach((a) => { a.rotation.x = 0; }); });
      board.userData.set(`Race to ${d.target} · add 1 to ${d.maxStep}`, { border: '#b6ff3b' }); counter.visible = true; counter.userData.set(`0 / ${d.target}`);
      dir.sequence([['SCORE', 1.6], ['RINGSIDE', Infinity]]);
    },
    update(dt, time) {
      st.t += dt;
      [A, B].forEach((bot, k) => { bot.userData.head.rotation.y = Math.sin(time * 1.2 + k) * 0.15; if (st.phase === 'idle') bot.position.y = 0.36 + Math.sin(time * 2 + k) * 0.02; });
      if (st.phase === 'intro' && st.t > 1.6) { st.phase = 'turns'; st.t = 0; }
      if (st.phase === 'turns') {
        const per = Math.max(0.6, Math.min(1.3, 24 / Math.max(1, st.turns.length)));
        const i = Math.floor(st.t / per);
        if (i !== st.i && i < st.turns.length) {
          st.i = i; const tn = st.turns[i]; const bot = tn.side === 'a' ? A : B;
          counter.userData.set(`${tn.total} / ${st.setup.target}`);
          pop.userData.set(`+${tn.add}`, { border: tn.side === 'a' ? '#00e5ff' : '#ff3df0' }); pop.visible = true; pop.position.set(bot.position.x * 0.6, 2.3, 0.4);
          st.who = bot;
        }
        if (st.who) { const k = (st.t % per) / per; punch(st.who, k); const other = st.who === A ? B : A; other.rotation.z = Math.sin(k * Math.PI) * 0.12 * (other === A ? 1 : -1); pop.position.y += dt * 0.5; }
        if (st.t > per * st.turns.length + 0.4) {
          st.phase = 'end'; st.t = 0; pop.visible = false; A.rotation.z = B.rotation.z = 0;
          const w = st.winner === 'a' ? A : B; fx.burst(new THREE.Vector3(w.position.x, 2.6, 0));
          board.userData.set(`${(st.winner === 'a' ? st.setup.aName : st.setup.bName) ?? 'Winner'} wins the pot!`, { border: '#b6ff3b' });
          this._dir.sequence([[st.winner === 'a' ? 'CAM A' : 'CAM B', 3.6], ['WIDE', Infinity]]);
        }
      }
      if (st.phase === 'end') {
        const w = st.winner === 'a' ? A : B, lo = st.winner === 'a' ? B : A;
        w.position.y = 0.36 + Math.abs(Math.sin(st.t * 5)) * 0.35; w.userData.arms.forEach((a) => { a.rotation.x = lerp(a.rotation.x, -2.9, dt * 5); });
        lo.rotation.x = lerp(lo.rotation.x, -1.4, dt * 3); lo.position.y = lerp(lo.position.y, 0.62, dt * 3); lo.userData.arms.forEach((a) => { a.rotation.x = lerp(a.rotation.x, 0.3, dt * 4); });
        if (st.t > 10) { st.phase = 'idle'; [A, B].forEach((bot) => { bot.rotation.x = 0; bot.position.y = 0.36; bot.userData.arms.forEach((a) => { a.rotation.x = 0; }); }); }
      }
      fx.update(dt);
    },
  };
}

function updownScene() {
  const scene = new THREE.Scene(); const set = studio(scene, THEME.cyan, SKY_GREEN);
  const g = new THREE.Group(); scene.add(g);
  const base = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.14, 2.2), std(0xffffff, { roughness: 0.3 })); base.position.y = 0.07; base.receiveShadow = true; g.add(base);
  const grid = new THREE.GridHelper(6, 12, 0x6a72d8, 0xb8bff5); grid.position.y = 0.15; g.add(grid);
  const candles = Array.from({ length: 14 }, (_, i) => {
    const c = new THREE.Group(); c.position.set(-2.8 + i * 0.42, 0.15, 0);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1, 0.24), glow(THEME.lime, 0.7)); body.castShadow = true; c.add(body);
    const wick = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1, 0.03), std(0x3a3f7a)); c.add(wick);
    c.userData = { body, wick }; g.add(c); return c;
  });
  const arrow = new THREE.Group(); const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.9, 24), glow(THEME.lime, 1.4)); arrow.add(shaft);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.6, 32), glow(THEME.lime, 1.6)); tip.position.y = 0.72; arrow.add(tip); arrow.position.set(3.7, 2.2, 0); scene.add(arrow);
  const shots = { WIDE: { pos: [0, 2.7, 7.2], look: [0, 1.5, 0], orbit: true } };
  const st = { hist: [], price: null, dir: 0 };
  return {
    scene, shots, set, idle: 'WIDE',
    onEvent(d) {
      if (d.kind !== 'price') return;
      if (d.history?.length) st.hist = [...d.history];
      if (d.price) { if (st.price) st.dir = Math.sign(d.price - st.price) || st.dir; st.price = d.price; st.hist.push(d.price); if (st.hist.length > 15) st.hist.shift(); }
    },
    update(dt, time) {
      const h = st.hist.length ? st.hist : [1]; const lo = Math.min(...h), hi = Math.max(...h), span = Math.max(0.05, hi - lo);
      candles.forEach((c, i) => {
        const a = h[i] ?? h[h.length - 1], b = h[i + 1] ?? a; const live = i === Math.min(h.length - 2, 13);
        const y0 = 0.3 + ((a - lo) / span) * 2.2, y1 = 0.3 + ((b - lo) / span) * 2.2 + (live ? Math.sin(time * 6) * 0.04 : 0);
        const top = Math.max(y0, y1), bot = Math.min(y0, y1), hh = Math.max(0.06, top - bot);
        c.userData.body.scale.y = lerp(c.userData.body.scale.y, hh, dt * 6); c.userData.body.position.y = lerp(c.userData.body.position.y, bot + hh / 2, dt * 6);
        c.userData.wick.scale.y = hh + 0.3; c.userData.wick.position.y = c.userData.body.position.y;
        const col = b >= a ? 0x2bd16f : THEME.red; c.userData.body.material.color.setHex(col); c.userData.body.material.emissive.setHex(col);
        c.visible = i < Math.max(1, h.length - 1);
      });
      const up = st.dir >= 0, col = up ? 0x2bd16f : THEME.red;
      arrow.rotation.z = lerp(arrow.rotation.z, up ? 0 : Math.PI, dt * 6); arrow.position.y = 2.2 + Math.sin(time * 3) * 0.15; arrow.rotation.y += dt * 1.4;
      for (const m of [shaft, tip]) { m.material.color.setHex(col); m.material.emissive.setHex(col); }
    },
  };
}

export function createStage(canvas, { game = 'rps', reducedMotion = false, onShot } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  const camera = new THREE.PerspectiveCamera(45, 2, 0.1, 80);
  const world = { rps: rpsScene, pf: pfScene, ai: pfScene, updown: updownScene }[game]();
  const look = new THREE.Vector3(); const wantPos = new THREE.Vector3(); const wantLook = new THREE.Vector3();
  let clock = 0;
  const director = {
    queue: [], current: null, t: 0, hold: Infinity, orbit: false, base: new THREE.Vector3(),
    go(name, hold = Infinity) { const s = world.shots[name]; if (!s) return; this.current = name; this.t = 0; this.hold = hold; this.orbit = !!s.orbit && !reducedMotion; this.base.set(...s.pos); wantPos.set(...s.pos); wantLook.set(...s.look); onShot?.(name); },
    sequence(list) { this.queue = [...list]; const [n, h] = this.queue.shift(); this.go(n, h); },
    update(dt) {
      this.t += dt;
      if (this.t > this.hold) { if (this.queue.length) { const [n, h] = this.queue.shift(); this.go(n, h); } else this.go(world.idle); }
      if (this.orbit) { const a = Math.sin(clock * 0.12) * 0.32; const r = Math.hypot(this.base.x, this.base.z); wantPos.set(Math.sin(a) * r, this.base.y, Math.cos(a) * r); }
      const k = Math.min(1, dt * 2.2);
      camera.position.lerp(wantPos, k); look.lerp(wantLook, k); camera.lookAt(look);
    },
  };
  world._dir = director;
  director.go(world.idle); camera.position.copy(wantPos); look.copy(wantLook); camera.lookAt(look);

  const onShow = (e) => world.onEvent?.(e.detail ?? {}, director);
  window.addEventListener('passbch:show', onShow);

  let prev = performance.now(), raf = 0, running = true;
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight; const pr = renderer.getPixelRatio();
    if (canvas.width !== Math.floor(w * pr) || canvas.height !== Math.floor(h * pr)) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < 640 ? 58 : 45; camera.updateProjectionMatrix(); }
  };
  const tick = (now) => {
    raf = requestAnimationFrame(tick); if (!running) return;
    const dt = Math.min(0.05, (now - prev) / 1000); prev = now; clock += dt;
    resize(); director.update(dt); world.update(dt, clock);
    world.set.cams.forEach((c, i) => { c.rec.visible = Math.sin(clock * 4 + i) > -0.3; });
    renderer.render(world.scene, camera);
  };
  raf = requestAnimationFrame(tick);
  const io = new IntersectionObserver(([e]) => { running = e.isIntersecting; prev = performance.now(); }, { threshold: 0.01 }); io.observe(canvas);
  return {
    dispose() {
      cancelAnimationFrame(raf); io.disconnect(); window.removeEventListener('passbch:show', onShow);
      world.scene.traverse((o) => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach((x) => { x.map?.dispose?.(); x.dispose(); }); });
      world.scene.background?.dispose?.(); renderer.dispose();
    },
  };
}
