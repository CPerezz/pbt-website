// PBT 3D scene: radial layout of the real EIP-8297 tree, instanced nodes, camera flights,
// follow/ghost filters, merkleization wave, sub-index fan, reference links, projected labels.
(function (G) {
  const BG = 0x0a0d14;
  const ZC = { 0: 0x0072b2, 1: 0xe69f00, 255: 0x009e73, mix: 0x9aa39a, res: 0x8a8a8a };
  const REHASH = 0xB57BFF; const GREEN = 0x33ff33, VERM = 0xd55e00, DISP = 0xc9a0dc; // DISP: dispatcher-chunk outline (not path green)
  // fixed compass sectors (deg; 0 = north/-Z, 90 = east/+X)
  const SECT = { 0: [-94, -10], 1: [-4, 94], 255: [104, 256] };
  const LVL = 1.05, CB = 0.5, LEAF = 0.95, DROP = 0.2;
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const lerp = (a, b, t) => a + (b - a) * t;

  class PBTScene {
    constructor(host, core) {
      this.C = core; this.host = host; const T = THREE;
      this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.r = new T.WebGLRenderer({ antialias: true }); this.r.setPixelRatio(Math.min(devicePixelRatio, 2)); this.r.setClearColor(BG);
      host.appendChild(this.r.domElement); Object.assign(this.r.domElement.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', outline: 'none' });
      this.r.domElement.tabIndex = 0; this.r.domElement.setAttribute('aria-label', '3D view of the state tree. Arrow keys or WASD orbit.');
      this.labelHost = document.createElement('div'); Object.assign(this.labelHost.style, { position: 'absolute', inset: '0', pointerEvents: 'none', overflow: 'hidden' }); host.appendChild(this.labelHost);
      this.leaderSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); Object.assign(this.leaderSvg.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: 4 });
      this.leaderSvg.innerHTML = '<path fill="none" stroke="#33FF33" stroke-opacity=".25" stroke-width="6" stroke-linecap="round"></path><path fill="none" stroke="#33FF33" stroke-width="2" stroke-linecap="round"></path><circle r="9" fill="none" stroke="#33FF33" stroke-width="2"></circle><circle r="3.5" fill="#33FF33"></circle>'; this.leaderSvg.style.display = 'none'; host.appendChild(this.leaderSvg); this.leader = null;
      this.s = new T.Scene(); this.s.fog = new T.Fog(BG, 38, 110);
      this.cam = new T.PerspectiveCamera(40, 1, 0.1, 400);
      this.s.add(new T.HemisphereLight(0xeef3ff, 0x2a3140, 1.5));
      const dl = new T.DirectionalLight(0xffffff, 1.1); dl.position.set(8, 20, 10); this.s.add(dl);
      this.col = new T.Color(); this.bg = new T.Color(BG); this.white = new T.Color(0xffffff);
      // geometries
      const gem = new T.OctahedronGeometry(0.2, 0); gem.scale(1, 1.7, 1);
      const tile = new T.BoxGeometry(0.2, 0.05, 0.3);
      const joint = new T.IcosahedronGeometry(0.15, 0);
      const tube = new T.CylinderGeometry(1, 1.6, 1, 6, 1, true); tube.translate(0, 0.5, 0);
      const ring = new T.TorusGeometry(0.36, 0.035, 6, 28);
      const bead = new T.SphereGeometry(0.09, 10, 8);
      const std = o => new T.MeshStandardMaterial(Object.assign({ flatShading: true, roughness: .45, metalness: .15 }, o));
      const mk = (geo, mat, n) => { const m = new T.InstancedMesh(geo, mat, n); m.instanceMatrix.setUsage(T.DynamicDrawUsage); m.count = 0; m.frustumCulled = false; this.s.add(m); m.setColorAt(0, this.col); return m; };
      // vertex-coloured merged meshes: instance colour x vertex shade, so dark details stay dark
      const mergeC = parts => { const P = [], Cc = [], a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), e1 = new T.Vector3(), e2 = new T.Vector3();
        parts.forEach(([g0, shade]) => { const g = g0.index ? g0.toNonIndexed() : g0, p = g.attributes.position.array;
          for (let i = 0; i < p.length; i += 9) { a.fromArray(p, i); b.fromArray(p, i + 3); c.fromArray(p, i + 6); const n = e1.subVectors(b, a).cross(e2.subVectors(c, a)).normalize();
            const k = typeof shade === 'function' ? shade(n) : shade; for (let v = 0; v < 9; v++) P.push(p[i + v]); for (let v = 0; v < 3; v++) Cc.push(k, k, k); } });
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('color', new T.Float32BufferAttribute(Cc, 3)); g.computeVertexNormals(); return g; };
      // Ether glyph: upper diamond + lower chevron, two-tone facets, dark gap
      const pyr = (r, h, y0, up) => { const g = new T.ConeGeometry(r, h, 4, 1, false); g.rotateY(Math.PI / 4); if (!up) g.rotateX(Math.PI); g.translate(0, up ? y0 + h / 2 : y0 - h / 2, 0); return g; };
      const facet = (lit, dim) => n => Math.abs(n.y) > .97 ? .08 : (n.x + n.z * .35 > 0 ? dim : lit);
      const ethG = mergeC([[pyr(.2, .34, 0, true), facet(1, .52)], [pyr(.2, .12, 0, false), facet(.78, .38)], [pyr(.2, .24, -.17, false), facet(.9, .45)], [(() => { const g = new T.CylinderGeometry(.205, .205, .02, 4, 1); g.rotateY(Math.PI / 4); g.translate(0, -.155, 0); return g; })(), .06]]);
      ethG.translate(0, .03, 0);
      this.mGem = mk(ethG, std({ vertexColors: true }), 900);
      // Leaf: ovate blade, dark midrib + veins + petiole
      const ls = new T.Shape(); ls.moveTo(0, -.28); ls.bezierCurveTo(.21, -.21, .26, .1, 0, .33); ls.bezierCurveTo(-.26, .1, -.21, -.21, 0, -.28);
      const blade = new T.ExtrudeGeometry(ls, { depth: .018, bevelEnabled: true, bevelThickness: .008, bevelSize: .008, bevelSegments: 1, curveSegments: 16 }); blade.translate(0, 0, -.009);
      const rib = (w, h, x, y, rz) => { const g = new T.BoxGeometry(w, h, .05); g.translate(0, h / 2, 0); g.rotateZ(rz); g.translate(x, y, 0); return g; };
      const veins = [[-.15, .17], [-.04, .17], [.07, .14], [.17, .09]].flatMap(([y, L]) => [[rib(.011, L, 0, y, -.95), .1], [rib(.011, L, 0, y, .95), .1]]);
      const leafG = mergeC([[blade, n => .78 + .22 * Math.abs(n.z)], [rib(.02, .58, 0, -.28, 0), .1], ...veins, [rib(.024, .13, 0, -.41, 0), .3]]);
      leafG.translate(0, .04, 0);
      this.mLeaf = mk(leafG, std({ vertexColors: true, side: T.DoubleSide }), 900); this.mTile = mk(tile, std({}), 900);
      this.mJoint = mk(joint, new T.MeshBasicMaterial({ transparent: true, opacity: .85 }), 900);
      this.mTube = mk(tube, new T.MeshBasicMaterial({ transparent: true, opacity: .9 }), 1800);
      this.mRing = mk(ring, new T.MeshBasicMaterial({}), 400);
      this.mBead = mk(bead, new T.MeshBasicMaterial({ color: VERM }), 64);
      const cone = new T.ConeGeometry(0.13, 0.36, 12); cone.translate(0, 0.18, 0);
      this.mCone = mk(cone, new T.MeshBasicMaterial({ color: GREEN, fog: false }), 96);
      this.mPulse = mk(new T.SphereGeometry(0.12, 14, 10), new T.MeshBasicMaterial({ color: 0xffffff, fog: false }), 8);
      this.walkP = null;
      this.dummy = new T.Object3D();
      this.nodes = new Map(); this.links = []; this.labels = []; this.fan = null; this.wave = null;
      this.style = {}; this.follow = 'tree';
      // camera controller
      this.camS = { tx: 0, ty: -3, tz: 0, dist: 60, az: 0.4, el: 0.85 }; this.flight = null; this.autoOrbit = false;
      this._bindInput(); this._buildGround();
      new ResizeObserver(() => this._resize()).observe(host); this._resize();
      this.clock = new T.Clock(); const loop = () => { this._raf = requestAnimationFrame(loop); this._tick(); }; loop();
    }
    // ---------- layout ----------
    setAngleUniverse(keys) { // stable angular slots: every key that ever appears gets a fixed angle
      const byZ = { 0: [], 1: [], 255: [] };
      [...new Set(keys.map(k => k.toLowerCase()))].sort().forEach(k => { const z = parseInt(k.substr(2, 2), 16); (byZ[z] || (byZ[z] = [])).push(k); });
      this.univ = byZ;
    }
    angleOf(key) {
      const z = parseInt(key.substr(2, 2), 16), list = this.univ[z] || [], sec = SECT[z] || [96, 102];
      let i = list.indexOf(key), n = list.length;
      if (i < 0) { let j = 0; while (j < n && list[j] < key) j++; i = j - 0.5; }
      return (sec[0] + (sec[1] - sec[0]) * ((i + 0.5) / Math.max(1, n))) * Math.PI / 180;
    }
    zoneOf(n) {
      if (n.type === 'leaf') return parseInt(n.key.substr(2, 2), 16);
      if (n.path.length >= 8) return parseInt(n.path.slice(0, 8), 2);
      return 'mix';
    }
    setWorld(map, opt = {}) {
      const C = this.C; const root = C.binarize(C.toEntries(map)); C.merkleize(root); this.root = root; this.map = map;
      const seen = new Set(), T = THREE, now = performance.now(), dur = (this.reduced || opt.instant) ? 0 : (opt.dur || 700);
      const place = (n, parent, r) => {
        const id = n.type === 'leaf' ? 'L' + n.key : 'B' + n.path; n.id = id;
        let th;
        if (n.type === 'leaf') th = this.angleOf(n.key);
        else { place(n.left, n, 0); place(n.right, n, 0); th = (n.left._th + n.right._th) / 2; }
        n._th = th; return th;
      };
      place(root, null, 0);
      const setR = (n, r, parent, depth) => {
        n._r = r; n.depth = depth; n.parentNode = parent;
        const pos = new T.Vector3(r * Math.sin(n._th), -DROP * r, -r * Math.cos(n._th));
        let v = this.nodes.get(n.id);
        if (!v) {
          const pv = parent && this.nodes.get(parent.id), start = pv ? (pv.to || pv.pos).clone() : pos.clone();
          v = { id: n.id, pos: start, from: start.clone(), appear: dur ? 0 : 1, fresh: true, born: !!dur, ghost: 0, ghostT: 0, flash: 0 };
          if (opt.stagger) v.delay = opt.stagger(n) || 0;
          this.nodes.set(n.id, v);
        }
        v.from = v.pos.clone(); v.to = pos; v.t0 = now + (v.delay || 0); v.dur = dur; v.dying = false; v.appearT = 1;
        v.n = n; v.type = n.type; v.zone = this.zoneOf(n); v.depth = depth; v.parentId = parent ? parent.id : null;
        v.prefixLen = n.type === 'branch' ? n.prefix.length : 0;
        v.isStem = n.type === 'branch' && v.zone === 0 && n.split >= 264 && (!parent || parent.split < 264);
        seen.add(n.id);
        if (n.type === 'branch') {
          [n.left, n.right].forEach(c => setR(c, r + (c.type === 'leaf' ? LEAF : LVL + CB * Math.sqrt(c.prefix.length)), n, depth + 1));
        }
      };
      if (root) setR(root, 0, null, 0);
      for (const [id, v] of this.nodes) if (!seen.has(id) && !v.dying) { v.dying = true; v.appearT = 0; v.t0 = now; v.dur = dur || 1; v.from = v.pos.clone(); v.to = v.pos.clone(); }
      this.byId = id => this.nodes.get(id);
      this._applyStyle();
      return root;
    }
    idOfKey(key) { return 'L' + key.toLowerCase(); }
    findLeaf(key) { return this.nodes.get(this.idOfKey(key)); }
    // lowest node containing every live key starting with prefix hex (a stem / bucket / group)
    stemNode(prefixHex) {
      const bits = Array.from(this.C.hex2b(prefixHex), b => b.toString(2).padStart(8, '0')).join('');
      let n = this.root;
      while (n && n.type === 'branch') {
        const p = n.path; // bits consumed through split (exclusive)
        if (p.length >= bits.length) return p.startsWith(bits) ? n : null;
        if (!bits.startsWith(p)) return null;
        n = bits[p.length] === '0' ? n.left : n.right;
      }
      return n && n.key.startsWith(prefixHex.toLowerCase()) ? n : null;
    }
    pathIds(n) { const out = []; while (n) { out.push(n.id); n = n.parentNode; } return out; }
    // ---------- style ----------
    setStyle(st) { this.style = st || {}; this._applyStyle(); }
    setFollow(f) { this.follow = f; this._applyStyle(); }
    _applyStyle() {
      const st = this.style, focus = new Set(st.focus || []), path = new Set(st.path || []);
      const zone = st.zone;
      for (const v of this.nodes.values()) {
        let g = st.ghostAll ? .8 : 0;
        if (this.follow === 'path' && (path.size || focus.size)) g = (path.has(v.id) || focus.has(v.id)) ? 0 : .85;
        if (this.follow === 'zone' && zone != null) g = (v.zone === zone || path.has(v.id) || focus.has(v.id)) ? 0 : .85;
        if (st.dim && st.dim.includes(v.id)) g = Math.max(g, .55);
        if (st.ghostAll && (focus.has(v.id) || path.has(v.id))) g = 0;
        v.ghostT = g;
        v.hl = st.color && st.color[v.id] || null;
        v.onPath = path.has(v.id);
        v.ring = st.ring && st.ring[v.id] || (focus.has(v.id) && v.type === 'leaf' && v.zone !== 1 ? GREEN : null);
        v.recomputed = st.recomputed && st.recomputed.has(v.id);
      }
      this.beads = (st.siblings || []);
    }
    // ---------- labels / links / fan ----------
    setLabels(list) {
      this.labels.forEach(l => l.el.remove()); this.labels = [];
      (list || []).forEach(l => {
        const el = document.createElement('div'); el.innerHTML = l.html;
        Object.assign(el.style, { position: 'absolute', left: '0', top: '0', whiteSpace: 'nowrap', font: '12px "IBM Plex Mono", monospace', color: '#E2E6E2', transition: this.reduced ? 'none' : 'opacity .3s', willChange: 'transform', opacity: '0' });
        this.labelHost.appendChild(el); this.labels.push(Object.assign({ el }, l));
      });
    }
    setLinks(list) {
      const T = THREE; this.links.forEach(l => { this.s.remove(l.obj); l.obj.geometry.dispose(); }); this.links = [];
      (list || []).forEach(l => {
        let obj;
        if (l.kind === 'resolves') { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(64 * 3), 3)); obj = new T.Points(g, new T.PointsMaterial({ color: 0xE2E6E2, size: 4.5, sizeAttenuation: false, fog: false, transparent: true })); }
        else obj = new T.Mesh(new T.BufferGeometry(), new T.MeshBasicMaterial({ color: 0xf2c46a, transparent: true, opacity: .9, fog: false }));
        obj.frustumCulled = false; obj.renderOrder = 5; this.s.add(obj); this.links.push(Object.assign({ obj, born: performance.now() }, l));
      });
    }
    setFans(list) {
      (this.fans || []).forEach(f => { this.s.remove(f.sprite); f.sprite.material.map.dispose(); }); this.fans = [];
      (list || []).forEach(sp => { this.setFan(sp); this.fans.push(this.fan); }); this.fan = this.fans[0] || null;
    }
    setFan(spec) {
      this.fan = null; if (!spec) return;
      const cv = document.createElement('canvas'); cv.width = cv.height = 512; const x = cv.getContext('2d');
      const cx = 256, R = 244, r0 = 128, zc = '#' + (ZC[spec.zone] || ZC.mix).toString(16).padStart(6, '0');
      const st = spec.slots || {};
      x.beginPath(); x.arc(cx, cx, R + 10, 0, 7); x.arc(cx, cx, r0 - 18, 7, 0, true); x.fillStyle = 'rgba(10,13,20,.78)'; x.fill(); x.beginPath(); x.arc(cx, cx, r0 - 18, 0, 7); x.fillStyle = 'rgba(10,13,20,.55)'; x.fill();
      if (spec.band) { x.beginPath(); x.arc(cx, cx, R + 4, a(spec.band[0]), a(spec.band[1] + 1)); x.arc(cx, cx, r0 - 10, a(spec.band[1] + 1), a(spec.band[0]), true); x.closePath(); x.fillStyle = 'rgba(226,230,226,.10)'; x.fill(); }
      function a(i) { return -Math.PI / 2 + i / 256 * Math.PI * 2; }
      x.beginPath(); x.arc(cx, cx, R - 26, 0, 7); x.arc(cx, cx, r0, 7, 0, true); x.fillStyle = 'rgba(226,230,226,.06)'; x.fill();
      for (let i = 0; i < 256; i += 8) { const t = a(i); x.strokeStyle = 'rgba(226,230,226,' + (i % 64 ? .18 : .5) + ')'; x.lineWidth = i % 64 ? 1 : 2; x.beginPath(); x.moveTo(cx + Math.cos(t) * (R - 26), cx + Math.sin(t) * (R - 26)); x.lineTo(cx + Math.cos(t) * (R - 14), cx + Math.sin(t) * (R - 14)); x.stroke(); }
      const wedge = (i, w, r1, r2) => { x.beginPath(); x.arc(cx, cx, r2, a(i + .5 - w / 2), a(i + .5 + w / 2)); x.arc(cx, cx, r1, a(i + .5 + w / 2), a(i + .5 - w / 2), true); x.closePath(); };
      const zl = '#' + new THREE.Color(ZC[spec.zone] || ZC.mix).lerp(new THREE.Color(0xffffff), spec.zone === 0 ? .35 : .1).getHexString();
      const nPres = Object.values(st).filter(q => q === 'present').length;
      for (let i = 0; i < 256; i++) {
        const s = st[i]; if (!s) continue;
        if (s === 'present') { wedge(i, nPres > 40 ? 1 : 2.2, r0, R - 2); x.fillStyle = zl; x.fill(); }
        else if (s === 'disp') { wedge(i, 2.2, r0, R - 2); x.fillStyle = zl; x.fill(); wedge(i, 2.6, R, R + 8); x.fillStyle = '#c9a0dc'; x.fill(); }
        else if (s === 'absent') { wedge(i, .8, r0 + 6, R - 8); x.strokeStyle = 'rgba(226,230,226,.75)'; x.lineWidth = 1.2; x.stroke(); }
        else if (s === 'gone') { wedge(i, 3, r0 - 4, R + 4); x.setLineDash([5, 4]); x.strokeStyle = '#E2E6E2'; x.lineWidth = 2.5; x.stroke(); x.setLineDash([]); }
      }
      for (let i = 0; i < 256; i++) if (st[i] === 'lit') { wedge(i, 3.4, r0 - 12, R + 10); x.fillStyle = '#33FF33'; x.fill(); }
      for (const q of [0, 64, 128, 192]) { x.fillStyle = 'rgba(226,230,226,.5)'; x.font = '15px IBM Plex Mono, monospace'; x.textAlign = 'center'; const t = a(q + .5); x.fillText(String(q), cx + Math.cos(t) * (r0 - 34), cx + Math.sin(t) * (r0 - 34) + 5); }
      x.fillStyle = '#E2E6E2'; x.font = '600 21px IBM Plex Mono, monospace'; x.textAlign = 'center';
      x.fillText(spec.title || 'stem', cx, cx - 6); x.font = '16px IBM Plex Mono, monospace'; x.fillStyle = 'rgba(226,230,226,.7)'; x.fillText(spec.sub || '256 positions', cx, cx + 20);
      const tex = new THREE.CanvasTexture(cv); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, opacity: 1, sizeAttenuation: false, fog: false }));
      sp.center.set(.5, -.12); sp.renderOrder = 10; this.s.add(sp);
      this.fan = { sprite: sp, ref: spec.ref, offset: new THREE.Vector3() };
    }
    // ---------- wave ----------
    runWave(ids, cb = {}) {
      this.wave = null; const n = ids.length; if (!n) return;
      const interval = cb.interval || Math.min(250, 2500 / n);
      if (this.reduced) { ids.forEach(id => { const v = this.nodes.get(id); if (v) v.recomputed = true; }); cb.tick && cb.tick(n, ids[n - 1]); cb.done && cb.done(); return; }
      this.wave = { ids, i: 0, next: performance.now() + 250, interval, cb };
    }
    stopWave() { this.wave = null; }
    setWalk(ids, n) { this.walkP = ids && ids.length > 1 ? { ids, n: n == null ? ids.length : n } : null; }
    // ---------- camera ----------
    frame(ids, o = {}) {
      const pts = ids.map(id => this.nodes.get(id)).filter(v => v && !v.dying).map(v => v.to || v.pos);
      (o.extra || []).forEach(p => pts.push(p));
      if (!pts.length) pts.push(new THREE.Vector3(0, -3, 0));
      const c = new THREE.Vector3(); pts.forEach(p => c.add(p)); c.divideScalar(pts.length);
      let R = 0; pts.forEach(p => R = Math.max(R, p.distanceTo(c)));
      R = Math.max(R, o.minR || 1.6);
      const fov = this.cam.fov * Math.PI / 180, aspect = this.cam.aspect;
      const freeW = this.region ? Math.max(160, this.W - this.region[0] - this.region[1]) : this.W - 2 * Math.abs(this.shiftPx || 0);
      const fit = R / Math.sin(Math.min(fov, 2 * Math.atan(Math.tan(fov / 2) * aspect * freeW / this.W)) / 2);
      const zaz = { 0: -2.2, 1: 2.2, 255: 0.15, mix: 0.4 }[o.zone ?? 'mix'];
      this.liftT = o.lift || 0; if (this.reduced || o.dur === 0) this.lift = this.liftT;
      const pose = { tx: c.x + (o.shiftX || 0), ty: c.y, tz: c.z, dist: fit * (o.pad || 1.08), az: o.az ?? zaz, el: o.el ?? (o.tier === 'node' ? .55 : .8) };
      this.fly(pose, o.dur);
    }
    fly(pose, dur = 1200) {
      const from = Object.assign({}, this.camS); let daz = pose.az - from.az; daz = Math.atan2(Math.sin(daz), Math.cos(daz)); pose = Object.assign({}, pose, { az: from.az + daz });
      if (this.reduced || !dur) { Object.assign(this.camS, pose); this.flight = null; return; }
      this.flight = { from, to: pose, t0: performance.now(), dur: Math.min(dur, 1600) };
    }
    worldToScreen(p) { const v = p.clone().project(this.cam); return { x: (v.x + 1) / 2 * this.W, y: (1 - v.y) / 2 * this.H, behind: v.z > 1 }; }
    // ---------- internals ----------
    _resize() {
      const w = this.host.clientWidth || 1, h = this.host.clientHeight || 1; this.W = w; this.H = h; this.r.setSize(w, h, false); this.cam.aspect = w / h;
      const sh = this.region ? ((this.region[0] + (w - this.region[1])) / 2 - w / 2) : this.heroShift ? w * .2 : (w > 980 ? (this.shiftMode === 'left' ? -Math.min(90, w * .05) : Math.min(200, w * .13)) : 0); this.shiftPx = sh; // keep subject clear of the left HUD column
      this._applyOffset();
    }
    _buildGround() {
      const T = THREE, grp = new T.Group();
      const sector = (a0, a1, color, op) => {
        const pos = [], idx = [], seg = 40, rs = [2.2, 30];
        for (let i = 0; i <= seg; i++) { const t = (a0 + (a1 - a0) * i / seg) * Math.PI / 180; rs.forEach(r => pos.push(r * Math.sin(t), -DROP * r - .6, -r * Math.cos(t))); }
        for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
        grp.add(new T.Mesh(g, new T.MeshBasicMaterial({ color, transparent: true, opacity: op, side: T.DoubleSide, depthWrite: false })));
      };
      sector(...SECT[0], ZC[0], .06); sector(...SECT[1], ZC[1], .05); sector(...SECT[255], ZC[255], .05);
      sector(SECT[1][1] + 1, SECT[255][0] - 1, ZC.res, .03); sector(SECT[255][1] + 1, 360 + SECT[0][0] - 1, ZC.res, .03);
      for (let r = 5; r <= 30; r += 5) { // faint polar rings on the cone surface
        const pts = []; for (let i = 0; i <= 128; i++) { const t = i / 128 * Math.PI * 2; pts.push(new T.Vector3(r * Math.sin(t), -DROP * r - .6, -r * Math.cos(t))); }
        grp.add(new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: 0x33ff33, transparent: true, opacity: .05 })));
      }
      this.s.add(grp); this.ground = grp;
    }
    _bindInput() {
      const el = this.r.domElement; let drag = null;
      el.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, b: e.button, moved: 0 }; el.setPointerCapture(e.pointerId); this.flight = null; this.autoOrbit = false; });
      el.addEventListener('pointermove', e => {
        if (drag) {
          const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
          if (drag.b === 2 || e.shiftKey) { const k = this.camS.dist * .0015, s = Math.sin(this.camS.az), c = Math.cos(this.camS.az); this.camS.tx -= (dx * c) * k; this.camS.tz -= (-dx * s) * k; this.camS.tx -= dy * s * k; this.camS.tz -= dy * c * k; }
          else { this.camS.az -= dx * .005; this.camS.el = Math.max(.08, Math.min(1.5, this.camS.el + dy * .004)); }
        } else this._hover(e);
      });
      el.addEventListener('pointerup', e => { if (drag && drag.b === 0 && drag.moved < 6) this._click(e); drag = null; });
      el.addEventListener('contextmenu', e => e.preventDefault());
      el.addEventListener('wheel', e => { e.preventDefault(); this.flight = null; this.camS.dist = Math.max(2, Math.min(160, this.camS.dist * Math.exp(e.deltaY * .0012))); }, { passive: false });
      el.addEventListener('keydown', e => {
        const k = e.key.toLowerCase(), st = Math.PI / 12; let used = true;
        if (k === 'a') this.camS.az += st; else if (k === 'd') this.camS.az -= st;
        else if (k === 'w' || k === 'arrowup') this.camS.el = Math.min(1.5, this.camS.el + st); else if (k === 's' || k === 'arrowdown') this.camS.el = Math.max(.08, this.camS.el - st);
        else if (k === '+' || k === '=') this.camS.dist *= .85; else if (k === '-') this.camS.dist *= 1.15; else used = false;
        if (used) { e.preventDefault(); e.stopPropagation(); this.flight = null; }
      });
    }
    _pick(e) {
      const rect = this.r.domElement.getBoundingClientRect(), m = new THREE.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
      const rc = new THREE.Raycaster(); rc.setFromCamera(m, this.cam);
      const h = rc.intersectObjects([this.mGem, this.mLeaf, this.mTile], false)[0]; const id = h ? (h.object === this.mGem ? this._gemIds : h.object === this.mLeaf ? this._leafIds : this._tileIds)[h.instanceId] : null;
      return { v: id ? this.nodes.get(id) : null, x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    _hover(e) {
      if (!this.onHover) return; const p = this._pick(e);
      this.r.domElement.style.cursor = p.v && this.clickable && (p.v.isStem || (p.v.type === 'leaf' && p.v.zone !== 1)) ? 'pointer' : '';
      this.onHover(p.v, p.x, p.y);
    }
    _click(e) { if (this.onClick) { const p = this._pick(e); if (p.v) this.onClick(p.v); } }
    _tick() {
      const now = performance.now(), dt = Math.min(.05, this.clock.getDelta()), T = THREE;
      // camera
      if (this.flight) { const f = this.flight, t = Math.min(1, (now - f.t0) / f.dur), k = ease(t); for (const p in f.to) this.camS[p] = lerp(f.from[p], f.to[p], k); if (t >= 1) this.flight = null; }
      else if (this.autoOrbit) this.camS.az += dt * .06;
      const c = this.camS, tgt = new T.Vector3(c.tx, c.ty, c.tz);
      this.cam.position.set(c.tx + c.dist * Math.cos(c.el) * Math.sin(c.az), c.ty + c.dist * Math.sin(c.el), c.tz + c.dist * Math.cos(c.el) * Math.cos(c.az));
      this.cam.lookAt(tgt);
      if (Math.abs((this.liftT || 0) - (this.lift || 0)) > 1e-3) { this.lift += (this.liftT - this.lift) * Math.min(1, dt * 3); this._applyOffset(); }
      this.s.fog.near = c.dist * .9; this.s.fog.far = c.dist * 2.6 + 20;
      // wave
      if (this.wave && now >= this.wave.next) {
        const w = this.wave, id = w.ids[w.i], v = this.nodes.get(id);
        if (v) { v.flash = 1; v.recomputed = true; }
        w.i++; w.cb.tick && w.cb.tick(w.i, id); w.next = now + w.interval;
        if (w.i >= w.ids.length) { this.wave = null; w.cb.done && w.cb.done(); }
      }
      // nodes
      const counts = { gem: 0, leaf: 0, tile: 0, joint: 0, tube: 0, ring: 0, bead: 0 }; this._gemIds = []; this._tileIds = []; this._leafIds = [];
      const d = this.dummy, up = new T.Vector3(0, 1, 0), tmp = new T.Vector3();
      for (const [id, v] of this.nodes) {
        const t = v.dur ? Math.max(0, Math.min(1, (now - v.t0) / v.dur)) : 1, k = ease(t);
        if (v.to) v.pos.lerpVectors(v.from, v.to, k);
        if (v.born && now >= v.t0) { v.born = false; v.flash = 1; }
        v.appear = v.dying ? 1 - k : (v.appearT === 1 && v.appear < 1 ? Math.max(v.appear, k) : v.appear);
        if (v.dying && t >= 1) { this.nodes.delete(id); continue; }
        v.ghost += (v.ghostT - v.ghost) * Math.min(1, dt * (this.reduced ? 60 : 6));
        v.flash = Math.max(0, v.flash - dt * 2.2);
        const sc = Math.max(0.001, v.appear) * (1 + v.flash * 1.4) * (v.recomputed && !v.dying ? 1.45 : 1);
        // colour
        const base = v.hl != null ? v.hl : (v.recomputed ? REHASH : (ZC[v.zone] ?? ZC.res));
        this.col.setHex(base); if (v.type === 'branch' && !v.hl && !v.recomputed) this.col.lerp(this.white, .25);
        const rs = v.recomputed && !v.dying ? 1.45 : 1;
        this.col.lerp(this.bg, v.ghost * .88 + (v.dying ? .3 : 0)); if (v.flash) this.col.lerp(this.white, v.flash * .8);
        d.position.copy(v.pos); d.quaternion.identity();
        if (v.type === 'leaf') {
          if (v.zone === 1) { d.rotation.set(0, -v.n._th, 0); d.scale.setScalar(sc); d.updateMatrix(); this.mTile.setMatrixAt(counts.tile, d.matrix); this.mTile.setColorAt(counts.tile, this.col); this._tileIds[counts.tile++] = id; }
          else { d.rotation.set(.25, now * .0003 + v.pos.x, .12); d.scale.setScalar(sc * 1.15); d.updateMatrix(); this.mLeaf.setMatrixAt(counts.leaf, d.matrix); this.mLeaf.setColorAt(counts.leaf, this.col); this._leafIds[counts.leaf++] = id; }
        } else if (v.isStem) { d.rotation.set(0, now * .0004 + v.pos.x, 0); d.scale.setScalar(sc * 1.45); d.updateMatrix(); this.mGem.setMatrixAt(counts.gem, d.matrix); this.mGem.setColorAt(counts.gem, this.col); this._gemIds[counts.gem++] = id; }
        else { d.scale.setScalar(sc * (v.depth === 0 ? 2 : 1)); d.updateMatrix(); this.mJoint.setMatrixAt(counts.joint, d.matrix); this.mJoint.setColorAt(counts.joint, this.col); counts.joint++; }
        if ((v.ring || v.recomputed) && v.ghost < .5) { d.position.copy(v.pos); d.quaternion.copy(this.cam.quaternion); d.scale.setScalar(Math.max(.001, v.appear) * (v.type === 'leaf' ? 1 : v.isStem ? 1.25 : .7)); d.updateMatrix(); this.mRing.setMatrixAt(counts.ring, d.matrix); this.col.setHex(v.recomputed ? REHASH : v.ring); this.mRing.setColorAt(counts.ring++, this.col); }
        // corridor to parent
        const p = v.parentId && this.nodes.get(v.parentId);
        if (p) {
          tmp.subVectors(v.pos, p.pos); const len = tmp.length(); if (len > 1e-4) {
            d.position.copy(p.pos); d.quaternion.setFromUnitVectors(up, tmp.normalize());
            const w = (v.type === 'branch' && v.prefixLen > 0 ? .035 + .004 * Math.sqrt(v.prefixLen) : .018) * (v.recomputed ? 2.6 : v.onPath ? 1.8 : 1);
            d.scale.set(w * Math.max(.001, v.appear), len, w * Math.max(.001, v.appear)); d.updateMatrix();
            this.mTube.setMatrixAt(counts.tube, d.matrix);
            this.col.setHex(v.recomputed ? REHASH : v.onPath ? GREEN : (ZC[v.zone] ?? ZC.mix)); if (!v.onPath && !v.recomputed) this.col.lerp(this.white, .15);
            this.col.lerp(this.bg, (v.onPath ? 0 : v.ghost * .88) + (v.dying ? .3 : 0)); if (v.flash) this.col.lerp(this.white, v.flash * .7);
            this.mTube.setColorAt(counts.tube++, this.col);
          }
        }
      }
      (this.beads || []).forEach((id, i) => { const v = this.nodes.get(id); if (!v) return; const a = now * .002 + i; d.position.set(v.pos.x + Math.cos(a) * .45, v.pos.y + .1, v.pos.z + Math.sin(a) * .45); d.quaternion.identity(); d.scale.setScalar(Math.max(1.3, this.camS.dist * .025)); d.updateMatrix(); this.mBead.setMatrixAt(counts.bead++, d.matrix); });
      // traversal markers: a gate ring at every crossing + an arrowhead on the branch taken + a travelling pulse
      counts.cone = 0; counts.pulse = 0;
      if (this.walkP) {
        const W = this.walkP, k = Math.max(1, this.camS.dist * .022), segs = []; let L = 0;
        for (let i = 0; i < Math.min(W.n, W.ids.length) - 1; i++) {
          const a = this.nodes.get(W.ids[i]), b = this.nodes.get(W.ids[i + 1]); if (!a || !b) continue;
          tmp.subVectors(b.pos, a.pos); const len = tmp.length(); if (len < 1e-4) continue; const dir = tmp.clone().normalize();
          segs.push([a.pos, b.pos, len, L]); L += len;
          if (a.type === 'branch' && counts.ring < 400) { d.position.copy(a.pos); d.quaternion.copy(this.cam.quaternion); d.scale.setScalar(.85 * k); d.updateMatrix(); this.mRing.setMatrixAt(counts.ring, d.matrix); this.col.setHex(GREEN); this.mRing.setColorAt(counts.ring++, this.col); }
        }
        if (L > 0 && !this.reduced) {
          const n = Math.min(3, Math.max(1, Math.round(L / 12)));
          for (let p = 0; p < n; p++) { const t = ((now * .006 * Math.max(1, L / 18)) / L * 0 + ((now * .0022 + p / n) % 1)) * L; const sg = segs.find(q => t >= q[3] && t <= q[3] + q[2]) || segs[segs.length - 1];
            d.position.lerpVectors(sg[0], sg[1], Math.min(1, (t - sg[3]) / sg[2])); d.quaternion.identity(); d.scale.setScalar(k * 1.3); d.updateMatrix(); this.mPulse.setMatrixAt(counts.pulse++, d.matrix); }
        }
      }
      this.mCone.count = counts.cone; this.mCone.instanceMatrix.needsUpdate = true; this.mPulse.count = counts.pulse; this.mPulse.instanceMatrix.needsUpdate = true;
      for (const [m, n] of [[this.mGem, counts.gem], [this.mLeaf, counts.leaf], [this.mTile, counts.tile], [this.mJoint, counts.joint], [this.mTube, counts.tube], [this.mRing, counts.ring], [this.mBead, counts.bead]]) { m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
      // links
      for (const l of this.links) {
        const a = this.nodes.get(l.a), b = this.nodes.get(l.b); l.obj.visible = !!(a && b && !a.dying && !b.dying); if (!l.obj.visible) continue;
        const k = this.reduced ? 1 : Math.min(1, (now - l.born) / 900); const end = a.pos.clone().lerp(b.pos, k);
        const mid = a.pos.clone().add(end).multiplyScalar(.5); mid.y += Math.max(1, a.pos.distanceTo(end) * .35);
        const curve = new T.QuadraticBezierCurve3(a.pos.clone(), mid, end);
        if (l.kind === 'resolves') { const arr = l.obj.geometry.attributes.position.array, ph = (now * .0004) % (1 / 32); for (let i = 0; i < 64; i++) { const p = curve.getPoint(Math.min(1, i / 32 * .5 + ph)); arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z; } l.obj.geometry.attributes.position.needsUpdate = true; }
        else { l.obj.geometry.dispose(); l.obj.geometry = new T.TubeGeometry(curve, 40, Math.max(.025, this.camS.dist * .0011), 5, false); }
      }
      // fans
      this.fanPx = Math.min(210, this.H * .3, this.W * .26); const P5 = 1 / Math.tan(this.cam.fov * Math.PI / 360), fs = this.fanPx / (P5 * this.H / 2);
      (this.fans || []).forEach(f => { const v = this.nodes.get(f.ref); f.sprite.visible = !!v; f.sprite.scale.set(fs, fs, 1); if (v) f.sprite.position.copy(v.pos); });
      this.r.render(this.s, this.cam);
      if (this.leader) {
        const L = this.leader, v = this.nodes.get(L.id); let ok = !!v && !v.dying, ex = L.x, ey = L.y;
        if (ok && L.el) { if (!L.el.isConnected) ok = false; else { const r = L.el.getBoundingClientRect(), hr = this.host.getBoundingClientRect(); ex = r.left - hr.left - 3; ey = r.top - hr.top + r.height / 2; if (!r.width) ok = false;
          if (ok) { let p = L.el.parentElement; while (p && p !== document.body) { const cs = getComputedStyle(p); if (/(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight) { const q = p.getBoundingClientRect(); if (r.bottom < q.top + 4 || r.top > q.bottom - 4) ok = false; else ey = Math.max(q.top - hr.top + 6, Math.min(q.bottom - hr.top - 6, ey)); break; } p = p.parentElement; } } } }
        this.leaderSvg.style.display = ok ? 'block' : 'none';
        if (ok) {
          const p = this.worldToScreen(v.pos), [glow, line, ring, dot] = this.leaderSvg.children, mx = (p.x + ex) / 2, d = `M${ex},${ey} C${mx},${ey} ${mx},${p.y} ${p.x},${p.y}`;
          glow.setAttribute('d', d); line.setAttribute('d', d);
          const k = this.reduced ? 1 : Math.min(1, (now - L.born) / 550), len = line.getTotalLength();
          if (k < 1) { line.setAttribute('stroke-dasharray', `${len * k} ${len}`); glow.setAttribute('stroke-dasharray', `${len * k} ${len}`); line.removeAttribute('stroke-dashoffset'); }
          else { line.setAttribute('stroke-dasharray', '7 5'); line.setAttribute('stroke-dashoffset', String(-(now * .04) % 12)); glow.removeAttribute('stroke-dasharray'); }
          const pulse = this.reduced ? 0 : .5 + .5 * Math.sin(now * .007);
          ring.setAttribute('cx', p.x); ring.setAttribute('cy', p.y); ring.setAttribute('r', k < 1 ? 0 : 8 + pulse * 6); ring.setAttribute('stroke-opacity', String(1 - pulse * .6));
          dot.setAttribute('cx', ex); dot.setAttribute('cy', ey);
          if (k >= 1 && !this.reduced) v.flash = Math.max(v.flash, pulse * .45);
        }
      }
      // labels
      for (const l of this.labels) {
        let p = null; if (l.ref) { const v = this.nodes.get(l.ref); if (v && v.appear >= .5 && !v.dying) p = v.pos; } else if (l.pos) p = Array.isArray(l.pos) ? new T.Vector3(...l.pos) : l.pos;
        if (l.off != null && typeof l.off === 'number') l.off = new T.Vector3(0, l.off, 0);
        if (l.fanSlot != null && this.fan) { const f = this.fan.sprite; p = f.position.clone(); const ang = -Math.PI / 2 + (l.fanSlot + .5) / 256 * Math.PI * 2; const sp = this.worldToScreen(p); sp.y -= this.fanPx * .62; const rpx = this.fanPx * .5 * 1.06, cx = Math.cos(ang), sy = Math.sin(ang);
          const ax = cx > .35 ? '0%' : cx < -.35 ? '-100%' : '-50%', ay = Math.abs(cx) > .35 ? '-50%' : (sy < 0 ? '-100%' : '0%');
          l.el.style.transform = `translate(${sp.x + cx * rpx}px, ${sp.y + sy * rpx}px) translate(${ax},${ay})`; l.el.style.opacity = 1; continue; }
        if (!p) { l.el.style.opacity = 0; continue; }
        const s = this.worldToScreen(p.clone().add(l.off || new T.Vector3(0, .35, 0)));
        l.el.style.opacity = s.behind ? 0 : 1; l.el.style.transform = `translate(${s.x}px, ${s.y}px) translate(${l.anchor || '-50%,-100%'})`;
      }
    }
    _applyOffset() { const l = (this.lift || 0) * this.H; if (this.shiftPx || l) this.cam.setViewOffset(this.W, this.H, -this.shiftPx, -l, this.W, this.H); else this.cam.clearViewOffset(); this.cam.updateProjectionMatrix(); }
    setLeader(l) { if (l) l.born = performance.now(); this.leader = l; this.leaderSvg.style.display = l ? 'block' : 'none'; }
    _spritePx(sp) { const a = this.worldToScreen(sp.position), b = this.worldToScreen(sp.position.clone().add(new THREE.Vector3().setFromMatrixColumn(this.cam.matrixWorld, 0).multiplyScalar(sp.scale.x))); return Math.hypot(b.x - a.x, b.y - a.y); }
  }
  PBTScene.ZC = ZC; PBTScene.GREEN = GREEN; PBTScene.VERM = VERM; PBTScene.DISP = DISP;
  G.PBTScene = PBTScene;
})(window);
