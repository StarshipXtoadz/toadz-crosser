/**
 * Toadz Crosser! — cel cartoon hopper
 * New toad look · ribbit/POW/traffic audio · YOU MADE IT! pad pause
 */
(function () {
  "use strict";

  const canvas = document.getElementById("game");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const WIDTH = 640;
  // Extra room under the playfield so the timer bar + labels aren't clipped
  const HEIGHT = 780;
  const TILE = 40;
  const COLS = WIDTH / TILE;
  const INK = "#1a1208";
  const MAX_LIVES = 5;
  const L1_SPEED = 0.42;
  const SPEED_PER_LEVEL = 0.13;

  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  // Hand-painted stylized 3D sprites
  const ASSET_URLS = {
    toad: "assets/toad.png",
    car_red: "assets/car_red.png",
    car_blue: "assets/car_blue.png",
    car_yellow: "assets/car_yellow.png",
    truck_blue: "assets/truck_blue.png",
    truck_red: "assets/truck_red.png",
    lily: "assets/lily.png",
  };
  const ASSETS = {};
  let assetsReady = false;
  let assetsFailed = false;

  function loadAssets(done) {
    const keys = Object.keys(ASSET_URLS);
    let left = keys.length;
    if (!left) {
      done();
      return;
    }
    keys.forEach((k) => {
      const img = new Image();
      img.onload = () => {
        ASSETS[k] = img;
        left--;
        if (left === 0) {
          assetsReady = true;
          done();
        }
      };
      img.onerror = () => {
        left--;
        if (left === 0) {
          assetsFailed = true;
          done();
        }
      };
      img.src = ASSET_URLS[k];
    });
  }

  function hasAsset(k) {
    return ASSETS[k] && ASSETS[k].complete && ASSETS[k].naturalWidth > 0;
  }

  function drawSprite(img, x, y, w, h, flipX) {
    // Pixel-align to reduce shimmer while moving
    const px = Math.round(x);
    const py = Math.round(y);
    const dw = Math.max(1, Math.round(w));
    const dh = Math.max(1, Math.round(h));
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.translate(px, py);
    if (flipX) ctx.scale(-1, 1);
    // Soft contact shadow
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(0, dh * 0.42, dw * 0.38, Math.max(2, dh * 0.08), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  }

  // Toad palette — bright apple-green frog, freckles, pale belly
  const C = {
    ink: INK,
    white: "#fffdf8",
    cream: "#fff6e0",
    sky: "#7ec8f5",
    skyDeep: "#4aa3e0",
    cloud: "#ffffff",
    green: "#4fd63a",
    greenShade: "#2fa824",
    greenDeep: "#1e7a18",
    olive: "#62e04a",
    spot: "#2a9a22",
    belly: "#e8ffc8",
    freckle: "#ffb0a0",
    yellow: "#ffe14a",
    orange: "#ff9a3c",
    red: "#ff4b4b",
    redShade: "#d62828",
    blue: "#4d8fff",
    blueShade: "#2a5fcc",
    pink: "#ff8a9a",
    road: "#55555e",
    roadShade: "#3d3d46",
    asphaltLine: "#ffe14a",
    sidewalk: "#d4c4a8",
    sidewalkShade: "#b8a888",
    grass: "#5ecf4a",
    grassShade: "#3aa32e",
    water: "#3a9fd4",
    waterDeep: "#1e6fa0",
    hud: "#2a1f12",
    gray: "#8a8a92",
    truckCab: "#3d4a5c",
    truckBox: "#e8e4d8",
    signWood: "#c48a3a",
    signWoodDark: "#8a5a22",
    signText: "#3a2810",
  };

  const GOAL_ROWS = new Set([1]);
  const MEDIAN_ROWS = new Set([8]);
  const START_ROWS = new Set([16]);

  const ROAD_LANES = [
    { row: 2, dir: 1, speed: 1.15, colors: ["#ff4b4b", "#4d8fff", "#ffe14a"] },
    { row: 3, dir: -1, speed: 1.35, colors: ["#58d83a", "#ff6ad5", "#ff9a3c"] },
    { row: 4, dir: 1, speed: 1.55, colors: ["#fffdf8", "#ff4b4b", "#7b5cff"] },
    { row: 5, dir: -1, speed: 1.25, colors: ["#ff8a9a", "#5ecfff", "#ffe14a"] },
    { row: 6, dir: 1, speed: 1.7, colors: ["#ff7a00", "#00c8b4", "#ff4b9a"] },
    { row: 7, dir: -1, speed: 1.05, colors: ["#6b6bff", "#ff5a5a", "#58d83a"] },
    { row: 9, dir: 1, speed: 1.4, colors: ["#ffe14a", "#3d3d46", "#00a8e0"] },
    { row: 10, dir: -1, speed: 1.65, colors: ["#e00070", "#7dff6a", "#ffb464"] },
    { row: 11, dir: 1, speed: 1.2, colors: ["#a0a0ff", "#ff70a0", "#909098"] },
    { row: 12, dir: -1, speed: 1.8, colors: ["#ff3030", "#40ff40", "#4040ff"] },
    { row: 13, dir: 1, speed: 1.3, colors: ["#f0e000", "#00d0e8", "#c070ff"] },
    { row: 14, dir: -1, speed: 1.5, colors: ["#ff8800", "#00ffc0", "#e8e8e8"] },
    { row: 15, dir: 1, speed: 1.1, colors: ["#c04040", "#4040c0", "#40a040"] },
  ];
  const ROAD_ROW_SET = new Set(ROAD_LANES.map((l) => l.row));
  const POW_WORDS = ["POW!", "BAM!", "SPLAT!", "OOF!", "WHAM!", "BONK!"];

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }
  function randInt(a, b) {
    return Math.floor(rand(a, b + 1));
  }
  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
  function levelSpeedMult() {
    return L1_SPEED + (level - 1) * SPEED_PER_LEVEL;
  }
  function carsPerLane() {
    if (level <= 2) return randInt(2, 3);
    if (level <= 5) return randInt(3, 4);
    return randInt(3, 5);
  }

  // ========== AUDIO (Web Audio API — no files needed) ==========
  let audioCtx = null;
  let masterGain = null;
  let trafficNodes = null;
  let audioReady = false;
  let trafficOn = false;

  function ensureAudio() {
    if (audioReady) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      audioCtx = new AC();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.55;
      masterGain.connect(audioCtx.destination);
      audioReady = true;
      return true;
    } catch (e) {
      return false;
    }
  }

  function resumeAudio() {
    if (!ensureAudio()) return;
    if (audioCtx.state === "suspended") audioCtx.resume();
  }

  function playRibbit() {
    if (!ensureAudio()) return;
    resumeAudio();
    const t0 = audioCtx.currentTime;
    // Two-note cartoon ribbit
    [0, 0.07].forEach((delay, i) => {
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      const f = audioCtx.createBiquadFilter();
      osc.type = "square";
      osc.frequency.setValueAtTime(i === 0 ? 280 : 360, t0 + delay);
      osc.frequency.exponentialRampToValueAtTime(i === 0 ? 180 : 220, t0 + delay + 0.12);
      f.type = "bandpass";
      f.frequency.value = 500;
      f.Q.value = 2;
      g.gain.setValueAtTime(0.0001, t0 + delay);
      g.gain.exponentialRampToValueAtTime(0.22, t0 + delay + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + 0.14);
      osc.connect(f);
      f.connect(g);
      g.connect(masterGain);
      osc.start(t0 + delay);
      osc.stop(t0 + delay + 0.16);
    });
  }

  function playPow() {
    if (!ensureAudio()) return;
    resumeAudio();
    const t0 = audioCtx.currentTime;
    // Noise thump
    const bufferSize = audioCtx.sampleRate * 0.25;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2.5);
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const ng = audioCtx.createGain();
    const nf = audioCtx.createBiquadFilter();
    nf.type = "lowpass";
    nf.frequency.setValueAtTime(1200, t0);
    nf.frequency.exponentialRampToValueAtTime(200, t0 + 0.2);
    ng.gain.setValueAtTime(0.5, t0);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
    noise.connect(nf);
    nf.connect(ng);
    ng.connect(masterGain);
    noise.start(t0);
    // Impact tone
    const osc = audioCtx.createOscillator();
    const og = audioCtx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(120, t0);
    osc.frequency.exponentialRampToValueAtTime(40, t0 + 0.18);
    og.gain.setValueAtTime(0.35, t0);
    og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
    osc.connect(og);
    og.connect(masterGain);
    osc.start(t0);
    osc.stop(t0 + 0.22);
  }

  function playSuccess() {
    if (!ensureAudio()) return;
    resumeAudio();
    const t0 = audioCtx.currentTime;
    [523, 659, 784, 1046].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0 + i * 0.1);
      g.gain.exponentialRampToValueAtTime(0.18, t0 + i * 0.1 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.1 + 0.28);
      osc.connect(g);
      g.connect(masterGain);
      osc.start(t0 + i * 0.1);
      osc.stop(t0 + i * 0.1 + 0.3);
    });
  }

  function startTrafficAmbience() {
    if (!ensureAudio() || trafficOn) return;
    resumeAudio();
    trafficOn = true;
    // Soft road rumble
    const bufferSize = audioCtx.sampleRate * 2;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 180;
    filter.Q.value = 0.7;
    const g = audioCtx.createGain();
    g.gain.value = 0.045;
    noise.connect(filter);
    filter.connect(g);
    g.connect(masterGain);
    noise.start();
    trafficNodes = { noise, g, filter, whooshTimer: 0 };
  }

  function stopTrafficAmbience() {
    if (!trafficOn || !trafficNodes) return;
    try {
      trafficNodes.noise.stop();
    } catch (e) {}
    trafficNodes = null;
    trafficOn = false;
  }

  function playCarWhoosh() {
    if (!ensureAudio() || !trafficOn) return;
    resumeAudio();
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    const f = audioCtx.createBiquadFilter();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(90, t0);
    osc.frequency.exponentialRampToValueAtTime(160, t0 + 0.15);
    osc.frequency.exponentialRampToValueAtTime(70, t0 + 0.45);
    f.type = "bandpass";
    f.frequency.value = 400;
    f.Q.value = 0.8;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.06, t0 + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
    osc.connect(f);
    f.connect(g);
    g.connect(masterGain);
    osc.start(t0);
    osc.stop(t0 + 0.52);
  }

  // ========== DRAW HELPERS ==========
  function setInk(width) {
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = width || 3;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
  }
  function fillCircle(x, y, r, fill) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
  }
  function strokeCircle(x, y, r, w) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    setInk(w || 3);
    ctx.stroke();
  }
  function celCircle(x, y, r, fill, shade) {
    fillCircle(x, y, r, fill);
    if (shade) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = shade;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(x + r * 0.15, y - r, r, r * 2);
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    strokeCircle(x, y, r, 3);
  }
  function celEllipse(x, y, rx, ry, fill, shade) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (shade) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.globalAlpha = 0.32;
      ctx.fillStyle = shade;
      ctx.fillRect(x - rx, y, rx * 2, ry * 1.2);
      ctx.restore();
    }
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    setInk(3);
    ctx.stroke();
  }
  function roundPath(x, y, w, h, rad) {
    const r = Math.min(rad, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function celRoundRect(x, y, w, h, rad, fill, shade) {
    roundPath(x, y, w, h, rad);
    ctx.fillStyle = fill;
    ctx.fill();
    if (shade) {
      ctx.save();
      roundPath(x, y, w, h, rad);
      ctx.clip();
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = shade;
      ctx.fillRect(x + w * 0.55, y, w * 0.5, h);
      ctx.restore();
    }
    roundPath(x, y, w, h, rad);
    setInk(3);
    ctx.stroke();
  }
  function drawCloud(x, y, s) {
    fillCircle(x, y, 14 * s, C.cloud);
    fillCircle(x + 16 * s, y - 4 * s, 18 * s, C.cloud);
    fillCircle(x + 34 * s, y, 13 * s, C.cloud);
    fillCircle(x + 16 * s, y + 6 * s, 12 * s, C.cloud);
    strokeCircle(x, y, 14 * s, 2.5);
    strokeCircle(x + 16 * s, y - 4 * s, 18 * s, 2.5);
    strokeCircle(x + 34 * s, y, 13 * s, 2.5);
  }
  function shadeColor(hex, amount) {
    if (!hex || hex[0] !== "#") return hex;
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255;
    let g = (n >> 8) & 255;
    let b = n & 255;
    r = Math.max(0, Math.floor(r * (1 - amount)));
    g = Math.max(0, Math.floor(g * (1 - amount)));
    b = Math.max(0, Math.floor(b * (1 - amount)));
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  // ========== FX ==========
  let fxList = [];
  function spawnPow(x, y, word) {
    fxList.push({
      kind: "pow",
      x, y,
      text: word || pick(POW_WORDS),
      life: 48, max: 48,
      rot: rand(-0.35, 0.35),
      scale: rand(0.9, 1.2),
    });
  }
  function spawnSpeedLines(x, y, dcol, drow) {
    const ox = -dcol;
    const oy = -drow;
    for (let i = 0; i < 7; i++) {
      const spread = (i - 3) * 5;
      fxList.push({
        kind: "line",
        x: x + (oy !== 0 ? spread : 0),
        y: y + (ox !== 0 ? spread : 0),
        dx: ox, dy: oy,
        len: rand(14, 28),
        life: 10 + i, max: 14,
        thick: rand(2, 4),
      });
    }
  }
  function updateFx() {
    for (const f of fxList) f.life--;
    fxList = fxList.filter((f) => f.life > 0);
  }
  function drawFx(kindFilter) {
    for (const f of fxList) {
      if (kindFilter && f.kind !== kindFilter) continue;
      const t = f.life / f.max;
      if (f.kind === "pow") {
        ctx.save();
        ctx.translate(f.x, f.y - (1 - t) * 28);
        ctx.rotate(f.rot);
        const sc = f.scale * (0.7 + (1 - t) * 0.55);
        ctx.scale(sc, sc);
        ctx.globalAlpha = Math.min(1, t * 1.4);
        ctx.fillStyle = C.yellow;
        setInk(4);
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const r = i % 2 === 0 ? 38 : 22;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.font = "bold 28px Bangers, Impact, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = 5;
        ctx.strokeStyle = C.ink;
        ctx.fillStyle = C.red;
        ctx.strokeText(f.text, 0, 0);
        ctx.fillText(f.text, 0, 0);
        ctx.restore();
      } else if (f.kind === "line") {
        ctx.save();
        ctx.globalAlpha = t;
        setInk(f.thick);
        ctx.strokeStyle = C.white;
        const lx = f.x + f.dx * (1 - t) * 20;
        const ly = f.y + f.dy * (1 - t) * 20;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + f.dx * f.len, ly + f.dy * f.len);
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    ctx.textBaseline = "alphabetic";
  }

  // ========== CAR / BOX TRUCK ==========
  class Car {
    constructor(row, direction, speed, color, lengthTiles) {
      this.row = row;
      this.direction = direction;
      this.speed = speed;
      this.color = color;
      this.lengthTiles = lengthTiles;
      this.isTruck = lengthTiles >= 3;
      this.length = lengthTiles * TILE;
      this.height = Math.floor(TILE * (this.isTruck ? 0.88 : 0.78));
      this.x = direction > 0 ? -this.length - randInt(0, WIDTH) : WIDTH + randInt(0, WIDTH);
      this.y = row * TILE + (TILE - this.height) / 2;
      this.whooshed = false;
      // Painted sprite pick (side-view faces right)
      if (this.isTruck) {
        this.spriteKey = pick(["truck_blue", "truck_red"]);
      } else {
        this.spriteKey = pick(["car_red", "car_blue", "car_yellow"]);
      }
    }
    update() {
      this.x += this.direction * this.speed;
      const mid = this.x + this.length / 2;
      if (!this.whooshed && mid > WIDTH * 0.35 && mid < WIDTH * 0.65) {
        this.whooshed = true;
        if (Math.random() < 0.35) playCarWhoosh();
      }
      if (this.direction > 0 && this.x > WIDTH + 20) {
        this.x = -this.length - randInt(40, 200);
        this.whooshed = false;
      } else if (this.direction < 0 && this.x + this.length < -20) {
        this.x = WIDTH + randInt(40, 200);
        this.whooshed = false;
      }
    }
    rect() {
      return { x: this.x, y: this.y, w: this.length, h: this.height };
    }
    draw() {
      if (hasAsset(this.spriteKey)) {
        const r = this.rect();
        // Cars face right; truck art faces left — invert truck flip
        const flip = this.isTruck
          ? this.direction > 0
          : this.direction < 0;
        const w = r.w * 1.05;
        const h = this.isTruck ? r.h * 1.35 : r.h * 1.45;
        drawSprite(
          ASSETS[this.spriteKey],
          r.x + r.w / 2,
          r.y + r.h / 2 - (this.isTruck ? 4 : 2),
          w,
          h,
          flip
        );
        return;
      }
      if (this.isTruck) this.drawTruck();
      else this.drawSedan();
    }
    drawSedan() {
      const r = this.rect();
      const dir = this.direction;
      const shade = shadeColor(this.color, 0.28);
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = C.ink;
      ctx.beginPath();
      ctx.ellipse(r.x + r.w / 2, r.y + r.h + 2, r.w * 0.42, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      celRoundRect(r.x, r.y + 4, r.w, r.h - 4, 10, this.color, shade);
      const cabinW = r.w * 0.42;
      const cabinX = dir > 0 ? r.x + r.w * 0.22 : r.x + r.w * 0.36;
      celRoundRect(cabinX, r.y - 2, cabinW, r.h * 0.55, 8, this.color, shade);
      const winW = Math.max(10, r.w * 0.18);
      const wx = dir > 0 ? r.x + r.w - winW - 10 : r.x + 10;
      celRoundRect(wx, r.y + 7, winW, r.h - 16, 4, "#9fe0ff", "#4aa3e0");
      const hx = dir > 0 ? r.x + r.w - 6 : r.x + 6;
      fillCircle(hx, r.y + r.h * 0.38, 4, C.yellow);
      strokeCircle(hx, r.y + r.h * 0.38, 4, 2);
      fillCircle(hx, r.y + r.h * 0.68, 4, C.yellow);
      strokeCircle(hx, r.y + r.h * 0.68, 4, 2);
      const wy = r.y + r.h - 2;
      [[r.x + 12, wy], [r.x + r.w - 12, wy]].forEach(([wx2, wy2]) => {
        fillCircle(wx2, wy2, 7, C.ink);
        fillCircle(wx2, wy2, 3.5, C.gray);
        strokeCircle(wx2, wy2, 7, 2);
      });
    }
    drawTruck() {
      // Delivery box truck: cab + tall cargo box
      const r = this.rect();
      const dir = this.direction;
      const boxColor = this.color;
      const boxShade = shadeColor(boxColor, 0.25);
      const cabColor = C.truckCab;
      const cabW = Math.max(28, r.w * 0.28);
      const boxW = r.w - cabW + 4;

      ctx.globalAlpha = 0.2;
      ctx.fillStyle = C.ink;
      ctx.beginPath();
      ctx.ellipse(r.x + r.w / 2, r.y + r.h + 2, r.w * 0.45, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Cargo box (tall, flat front)
      let boxX, cabX;
      if (dir > 0) {
        boxX = r.x;
        cabX = r.x + boxW - 4;
      } else {
        cabX = r.x;
        boxX = r.x + cabW - 4;
      }
      // Box body sits a bit higher
      celRoundRect(boxX, r.y - 2, boxW, r.h + 2, 4, boxColor, boxShade);
      // Panel lines on box
      setInk(2);
      ctx.strokeStyle = C.ink;
      ctx.globalAlpha = 0.35;
      for (let i = 1; i < 3; i++) {
        const lx = boxX + (boxW * i) / 3;
        ctx.beginPath();
        ctx.moveTo(lx, r.y + 2);
        ctx.lineTo(lx, r.y + r.h - 4);
        ctx.stroke();
      }
      // Horizontal belt line
      ctx.beginPath();
      ctx.moveTo(boxX + 4, r.y + r.h * 0.45);
      ctx.lineTo(boxX + boxW - 4, r.y + r.h * 0.45);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Cab
      celRoundRect(cabX, r.y + 6, cabW, r.h - 6, 6, cabColor, shadeColor(cabColor, 0.3));
      // Windshield
      const winW = cabW * 0.45;
      const wx = dir > 0 ? cabX + cabW - winW - 4 : cabX + 4;
      celRoundRect(wx, r.y + 10, winW, r.h * 0.4, 3, "#9fe0ff", "#4aa3e0");
      // Headlights on cab
      const hx = dir > 0 ? cabX + cabW - 5 : cabX + 5;
      fillCircle(hx, r.y + r.h * 0.55, 3.5, C.yellow);
      strokeCircle(hx, r.y + r.h * 0.55, 3.5, 2);
      fillCircle(hx, r.y + r.h * 0.78, 3.5, C.yellow);
      strokeCircle(hx, r.y + r.h * 0.78, 3.5, 2);

      // Rear door lines on box (opposite cab)
      const doorX = dir > 0 ? boxX + 3 : boxX + boxW - 10;
      setInk(2);
      ctx.strokeStyle = C.ink;
      ctx.strokeRect(doorX, r.y + 4, 8, r.h - 10);
      // Little brand stripe
      ctx.fillStyle = C.yellow;
      ctx.fillRect(boxX + boxW * 0.25, r.y + 6, boxW * 0.5, 5);
      setInk(1.5);
      ctx.strokeRect(boxX + boxW * 0.25, r.y + 6, boxW * 0.5, 5);

      // Wheels (3 for truck)
      const wy = r.y + r.h - 1;
      const wheels = dir > 0
        ? [r.x + 14, r.x + r.w * 0.45, r.x + r.w - 16]
        : [r.x + 16, r.x + r.w * 0.55, r.x + r.w - 14];
      wheels.forEach((wx2) => {
        fillCircle(wx2, wy, 7, C.ink);
        fillCircle(wx2, wy, 3.5, C.gray);
        strokeCircle(wx2, wy, 7, 2);
      });
    }
  }

  // ========== NEW TOAD LOOK ==========
  class Toad {
    constructor() {
      this.reset();
    }
    reset() {
      this.col = Math.floor(COLS / 2);
      this.row = 16;
      this.alive = true;
      this.hopTimer = 0;
      this.hopMax = 14;
      this.facing = 0;
      this.squash = 0;
      this.home = false;
      this.dcol = 0;
      this.drow = 0;
      this.wobble = 0;
      this.limbPhase = 0;
      this.celebrate = 0;
      this.homeX = null;
      this.homeY = null;
    }
    get x() {
      return this.homeX != null ? this.homeX : this.col * TILE + TILE / 2;
    }
    get y() {
      return this.homeY != null ? this.homeY : this.row * TILE + TILE / 2;
    }
    rect() {
      const s = 30;
      return { x: this.x - s / 2, y: this.y - s / 2, w: s, h: s };
    }
    tryMove(dcol, drow) {
      if (this.hopTimer > 0 || !this.alive || this.home) return false;
      const nc = this.col + dcol;
      const nr = this.row + drow;
      if (!(nc >= 0 && nc < COLS && nr >= 1 && nr <= 16)) return false;
      this.col = nc;
      this.row = nr;
      this.dcol = dcol;
      this.drow = drow;
      this.hopMax = 14;
      this.hopTimer = this.hopMax;
      this.limbPhase = 0;
      if (drow < 0) this.facing = 0;
      else if (dcol > 0) this.facing = 1;
      else if (drow > 0) this.facing = 2;
      else this.facing = 3;
      spawnSpeedLines(this.x, this.y, dcol, drow);
      playRibbit();
      return true;
    }
    update() {
      if (this.hopTimer > 0) {
        this.hopTimer--;
        this.limbPhase += 0.55;
      }
      if (this.squash > 0) this.squash--;
      if (this.celebrate > 0) this.celebrate++;
      this.wobble += 0.12;
    }

    draw() {
      if (!this.alive && this.squash <= 0) return;
      const cx = this.x;
      const cy = this.y;

      if (this.squash > 0) {
        const pop = Math.sin((this.squash / 40) * Math.PI) * 4;
        if (hasAsset("toad")) {
          ctx.save();
          ctx.translate(cx, cy + 6);
          ctx.scale(1.35 + pop * 0.02, 0.35);
          ctx.globalAlpha = 0.95;
          ctx.drawImage(ASSETS.toad, -28, -28, 56, 56);
          ctx.restore();
        } else {
          celEllipse(cx, cy + 4, 22 + pop, 8, C.greenShade, C.greenDeep);
          celEllipse(cx, cy + 4, 12, 4, C.red, C.redShade);
        }
        setInk(3);
        ctx.beginPath();
        ctx.moveTo(cx - 10, cy - 2);
        ctx.lineTo(cx - 4, cy + 4);
        ctx.moveTo(cx - 4, cy - 2);
        ctx.lineTo(cx - 10, cy + 4);
        ctx.moveTo(cx + 4, cy - 2);
        ctx.lineTo(cx + 10, cy + 4);
        ctx.moveTo(cx + 10, cy - 2);
        ctx.lineTo(cx + 4, cy + 4);
        ctx.stroke();
        return;
      }

      // Painted 3D toad sprite — solid draw, mild bob only (no scale flicker)
      if (hasAsset("toad")) {
        const hopT = this.hopTimer > 0 ? 1 - this.hopTimer / this.hopMax : 0;
        let bob = 0;
        if (this.hopTimer > 0) {
          const wave = Math.sin(hopT * Math.PI);
          bob = -Math.round(8 * wave);
        } else if (this.home) {
          bob = Math.round(Math.sin(this.celebrate * 0.25) * 3);
        }
        const flip = this.facing === 3;
        const base = 56;
        const dx = Math.round(cx);
        const dy = Math.round(cy + bob + 4);
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.translate(dx, dy);
        // Contact shadow (stable)
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.ellipse(0, 22, 18, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        if (flip) ctx.scale(-1, 1);
        // Fixed size — no per-frame scale stretch (that caused flashing)
        ctx.drawImage(ASSETS.toad, -base / 2, -base / 2 - 6, base, base);
        ctx.restore();
        if (this.home) {
          const sp = this.celebrate;
          for (let i = 0; i < 5; i++) {
            const a = sp * 0.15 + i * 1.2;
            ctx.fillStyle = i % 2 ? C.yellow : C.white;
            ctx.font = "14px sans-serif";
            ctx.fillText("✦", cx + Math.cos(a) * 26, cy - 12 + Math.sin(a * 1.3) * 14);
          }
        }
        return;
      }

      const hopT = this.hopTimer > 0 ? 1 - this.hopTimer / this.hopMax : 0;
      let stretchY = 1;
      let stretchX = 1;
      if (this.hopTimer > 0) {
        const wave = Math.sin(hopT * Math.PI);
        stretchY = 1 + 0.5 * wave;
        stretchX = 1 - 0.32 * wave;
        if (hopT > 0.85) {
          stretchY = 0.6;
          stretchX = 1.4;
        } else if (hopT < 0.15) {
          stretchY = 0.72;
          stretchX = 1.22;
        }
      } else if (this.home) {
        stretchY = 1 + Math.sin(this.celebrate * 0.25) * 0.1;
        stretchX = 1 - Math.sin(this.celebrate * 0.25) * 0.05;
      } else {
        stretchY = 1 + Math.sin(this.wobble) * 0.035;
        stretchX = 1 + Math.cos(this.wobble * 1.3) * 0.025;
      }

      const bodyW = 13 * stretchX;
      const bodyH = 11 * stretchY;
      const wobX = Math.sin(this.wobble * 2) * (this.hopTimer > 0 ? 2 : 0.5);
      const limbFlail = this.hopTimer > 0 ? Math.sin(this.limbPhase) * 8 : Math.sin(this.wobble) * 1.5;

      // Shadow
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = C.ink;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 15, bodyW * 0.9, 3.5 / stretchY, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Webbed back feet (behind body)
      if (this.facing === 0 || this.facing === 2) {
        celEllipse(cx - 12 + limbFlail * 0.2, cy + 12, 8, 5, C.greenShade, C.greenDeep);
        fillCircle(cx - 18 + limbFlail * 0.2, cy + 13, 2.5, C.greenShade);
        fillCircle(cx - 14 + limbFlail * 0.2, cy + 15, 2.5, C.greenShade);
        fillCircle(cx - 10 + limbFlail * 0.2, cy + 15, 2.5, C.greenShade);
        setInk(1.5);
        strokeCircle(cx - 18 + limbFlail * 0.2, cy + 13, 2.5, 1.5);
        strokeCircle(cx - 14 + limbFlail * 0.2, cy + 15, 2.5, 1.5);
        strokeCircle(cx - 10 + limbFlail * 0.2, cy + 15, 2.5, 1.5);
        celEllipse(cx + 12 - limbFlail * 0.2, cy + 12, 8, 5, C.greenShade, C.greenDeep);
        fillCircle(cx + 18 - limbFlail * 0.2, cy + 13, 2.5, C.greenShade);
        fillCircle(cx + 14 - limbFlail * 0.2, cy + 15, 2.5, C.greenShade);
        fillCircle(cx + 10 - limbFlail * 0.2, cy + 15, 2.5, C.greenShade);
        strokeCircle(cx + 18 - limbFlail * 0.2, cy + 13, 2.5, 1.5);
        strokeCircle(cx + 14 - limbFlail * 0.2, cy + 15, 2.5, 1.5);
        strokeCircle(cx + 10 - limbFlail * 0.2, cy + 15, 2.5, 1.5);
      } else {
        celEllipse(cx - 2, cy - 12, 5, 7, C.greenShade, C.greenDeep);
        celEllipse(cx - 2, cy + 12, 5, 7, C.greenShade, C.greenDeep);
      }

      // —— Clear cartoon ARMS (drawn before body so shoulders tuck in) ——
      const armWave = limbFlail;
      if (this.facing === 0 || this.facing === 2) {
        // Left arm: shoulder → elbow → hand
        const lShoulder = { x: cx + wobX - bodyW * 0.75, y: cy - 1 };
        const lHand = {
          x: cx + wobX - bodyW * 1.35 - armWave * 0.4,
          y: cy + 2 + armWave * 0.35,
        };
        const lElbow = {
          x: (lShoulder.x + lHand.x) / 2 - 4,
          y: (lShoulder.y + lHand.y) / 2 + 3,
        };
        setInk(7);
        ctx.strokeStyle = C.olive;
        ctx.beginPath();
        ctx.moveTo(lShoulder.x, lShoulder.y);
        ctx.quadraticCurveTo(lElbow.x, lElbow.y, lHand.x, lHand.y);
        ctx.stroke();
        setInk(3);
        ctx.strokeStyle = C.ink;
        ctx.beginPath();
        ctx.moveTo(lShoulder.x, lShoulder.y);
        ctx.quadraticCurveTo(lElbow.x, lElbow.y, lHand.x, lHand.y);
        ctx.stroke();
        // Hand + fingers
        celCircle(lHand.x, lHand.y, 6, C.olive, C.greenShade);
        fillCircle(lHand.x - 5, lHand.y - 2, 2.2, C.olive);
        fillCircle(lHand.x - 5, lHand.y + 2, 2.2, C.olive);
        fillCircle(lHand.x - 3, lHand.y + 5, 2.2, C.olive);
        setInk(1.5);
        strokeCircle(lHand.x - 5, lHand.y - 2, 2.2, 1.5);
        strokeCircle(lHand.x - 5, lHand.y + 2, 2.2, 1.5);
        strokeCircle(lHand.x - 3, lHand.y + 5, 2.2, 1.5);

        // Right arm
        const rShoulder = { x: cx + wobX + bodyW * 0.75, y: cy - 1 };
        const rHand = {
          x: cx + wobX + bodyW * 1.35 + armWave * 0.4,
          y: cy + 2 - armWave * 0.35,
        };
        const rElbow = {
          x: (rShoulder.x + rHand.x) / 2 + 4,
          y: (rShoulder.y + rHand.y) / 2 + 3,
        };
        setInk(7);
        ctx.strokeStyle = C.olive;
        ctx.beginPath();
        ctx.moveTo(rShoulder.x, rShoulder.y);
        ctx.quadraticCurveTo(rElbow.x, rElbow.y, rHand.x, rHand.y);
        ctx.stroke();
        setInk(3);
        ctx.strokeStyle = C.ink;
        ctx.beginPath();
        ctx.moveTo(rShoulder.x, rShoulder.y);
        ctx.quadraticCurveTo(rElbow.x, rElbow.y, rHand.x, rHand.y);
        ctx.stroke();
        celCircle(rHand.x, rHand.y, 6, C.olive, C.greenShade);
        fillCircle(rHand.x + 5, rHand.y - 2, 2.2, C.olive);
        fillCircle(rHand.x + 5, rHand.y + 2, 2.2, C.olive);
        fillCircle(rHand.x + 3, rHand.y + 5, 2.2, C.olive);
        strokeCircle(rHand.x + 5, rHand.y - 2, 2.2, 1.5);
        strokeCircle(rHand.x + 5, rHand.y + 2, 2.2, 1.5);
        strokeCircle(rHand.x + 3, rHand.y + 5, 2.2, 1.5);
      } else {
        // Side view arms
        setInk(7);
        ctx.strokeStyle = C.olive;
        ctx.beginPath();
        ctx.moveTo(cx + 4, cy - 2);
        ctx.quadraticCurveTo(cx + 16, cy - 8 - armWave, cx + 20, cy - 2);
        ctx.moveTo(cx + 4, cy + 4);
        ctx.quadraticCurveTo(cx + 16, cy + 10 + armWave, cx + 20, cy + 6);
        ctx.stroke();
        setInk(3);
        ctx.strokeStyle = C.ink;
        ctx.beginPath();
        ctx.moveTo(cx + 4, cy - 2);
        ctx.quadraticCurveTo(cx + 16, cy - 8 - armWave, cx + 20, cy - 2);
        ctx.moveTo(cx + 4, cy + 4);
        ctx.quadraticCurveTo(cx + 16, cy + 10 + armWave, cx + 20, cy + 6);
        ctx.stroke();
        celCircle(cx + 20, cy - 2, 5.5, C.olive, C.greenShade);
        celCircle(cx + 20, cy + 6, 5.5, C.olive, C.greenShade);
      }

      // Round apple body (on top of arm shoulders)
      celEllipse(cx + wobX, cy + 1, bodyW, bodyH, C.olive, C.greenShade);
      fillCircle(cx + wobX - 5, cy - 1, 2.2, C.spot);
      fillCircle(cx + wobX + 6, cy + 3, 1.8, C.spot);
      fillCircle(cx + wobX + 1, cy + 6, 1.5, C.spot);
      celEllipse(cx + wobX, cy + 5, bodyW * 0.48, bodyH * 0.4, C.belly, null);

      // Head
      const headY = cy - 6 - (stretchY - 1) * 4;
      celEllipse(cx + wobX, headY, bodyW * 0.78, bodyH * 0.62, C.olive, C.greenShade);

      // Eyes on face — big, side-by-side
      const eyeLag = this.hopTimer > 0 ? -this.dcol * 1.5 : 0;
      const eyes = [
        [cx + wobX - 7 + eyeLag, headY - 2],
        [cx + wobX + 7 + eyeLag, headY - 2],
      ];
      for (const [ex, ey] of eyes) {
        celCircle(ex, ey, 7, C.white, null);
        // thick lid line on top
        setInk(2.5);
        ctx.beginPath();
        ctx.arc(ex, ey, 7, Math.PI + 0.3, -0.3);
        ctx.stroke();
        fillCircle(ex + this.dcol, ey + this.drow + 1, 3.2, C.ink);
        fillCircle(ex + this.dcol + 1.1, ey + this.drow, 1.1, C.white);
      }

      // Nostrils
      fillCircle(cx + wobX - 2, headY + 4, 1.2, C.greenDeep);
      fillCircle(cx + wobX + 2, headY + 4, 1.2, C.greenDeep);

      // Big smile
      setInk(2.5);
      ctx.beginPath();
      ctx.arc(cx + wobX, headY + 5, 6.5, 0.2, Math.PI - 0.2);
      ctx.stroke();

      // Cheek freckles
      ctx.globalAlpha = 0.55;
      fillCircle(cx + wobX - bodyW * 0.55, headY + 3, 2.8, C.freckle);
      fillCircle(cx + wobX + bodyW * 0.55, headY + 3, 2.8, C.freckle);
      ctx.globalAlpha = 1;

      if (this.home) {
        const sp = this.celebrate;
        for (let i = 0; i < 5; i++) {
          const a = sp * 0.15 + i * 1.2;
          ctx.fillStyle = i % 2 ? C.yellow : C.white;
          ctx.font = "14px sans-serif";
          ctx.fillText("✦", cx + Math.cos(a) * 26, cy - 12 + Math.sin(a * 1.3) * 14);
        }
      }
    }
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // ========== STATE ==========
  let state = "title"; // title | play | madeit | gameover
  let toad = new Toad();
  let cars = [];
  let lives = MAX_LIVES;
  let score = 0;
  let level = 1;
  let nextLevel = 2;
  let padsCleared = 0;
  let farthestRow = 16;
  let message = "";
  let msgTimer = 0;
  let timeLeft = 50;
  let pulse = 0;
  let levelFlash = 0;
  let madeItBonus = 0;
  let homePadIndex = 0;

  function maxTime() {
    return Math.max(28, 55 - level * 1.5);
  }

  function spawnCars() {
    const mult = levelSpeedMult();
    const list = [];
    for (const lane of ROAD_LANES) {
      const count = carsPerLane();
      const spacing = (WIDTH + 280) / count;
      for (let i = 0; i < count; i++) {
        const length = level <= 2 ? pick([2, 2, 3]) : pick([1, 2, 2, 3]);
        const speed = (lane.speed + rand(-0.12, 0.12)) * mult;
        const car = new Car(lane.row, lane.dir, Math.max(0.35, speed), pick(lane.colors), length);
        if (lane.dir > 0) car.x = -120 + i * spacing + rand(-30, 30);
        else car.x = WIDTH + 80 - i * spacing + rand(-30, 30);
        list.push(car);
      }
    }
    return list;
  }

  function startLevel() {
    cars = spawnCars();
    toad.reset();
    farthestRow = 16;
    timeLeft = maxTime();
    fxList = [];
    startTrafficAmbience();
  }

  function squashToad() {
    if (toad.home || state !== "play") return;
    toad.alive = false;
    toad.squash = 40;
    lives--;
    playPow();
    spawnPow(toad.x, toad.y - 10, pick(POW_WORDS));
    spawnPow(toad.x + rand(-20, 20), toad.y + rand(-16, 8), pick(["BAM!", "OOF!", "WHAM!"]));
    message = pick(POW_WORDS);
    msgTimer = 40;
    if (lives <= 0) {
      state = "gameover";
      stopTrafficAmbience();
    }
  }

  function reachHome() {
    let pad = null;
    for (let i = 0; i < 5; i++) {
      const padX = 40 + i * 120;
      if (toad.x >= padX && toad.x <= padX + 64) {
        pad = i;
        break;
      }
    }
    if (pad === null) {
      squashToad();
      return;
    }

    // Stay on pad — pause for YOU MADE IT!
    homePadIndex = pad;
    const padCenterX = 40 + pad * 120 + 32;
    toad.row = 1;
    toad.homeX = padCenterX;
    toad.homeY = 1 * TILE + TILE / 2;
    toad.home = true;
    toad.celebrate = 1;
    toad.facing = 0;
    toad.hopTimer = 0;

    madeItBonus = 200 + Math.floor(timeLeft * 10) + level * 50;
    score += madeItBonus;
    padsCleared++;
    nextLevel = level + 1;
    lives = MAX_LIVES;
    state = "madeit";
    playSuccess();
    stopTrafficAmbience();
    spawnPow(toad.x, toad.y - 24, "SAFE!");
  }

  function continueFromPad() {
    if (state !== "madeit") return;
    level = nextLevel;
    levelFlash = 24;
    startLevel();
    state = "play";
    message = "LEVEL " + level + "!";
    msgTimer = 50;
  }

  function tryStart() {
    resumeAudio();
    if (state === "title") {
      lives = MAX_LIVES;
      score = 0;
      level = 1;
      padsCleared = 0;
      startLevel();
      state = "play";
      message = "HOP TO IT!";
      msgTimer = 60;
    } else if (state === "gameover") {
      state = "title";
    } else if (state === "madeit") {
      continueFromPad();
    }
  }

  function hop(dcol, drow) {
    if (state !== "play" || !toad.alive || toad.home) return;
    resumeAudio();
    const moved = toad.tryMove(dcol, drow);
    if (moved && drow < 0 && toad.row < farthestRow) {
      score += 10;
      farthestRow = toad.row;
    }
    if (moved && GOAL_ROWS.has(toad.row)) reachHome();
  }

  window.addEventListener("keydown", (e) => {
    const k = e.key;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(k)) e.preventDefault();
    if (k === "Escape") {
      if (state === "play" || state === "madeit") {
        state = "title";
        stopTrafficAmbience();
      }
      return;
    }
    if (k === "Enter" || k === " ") {
      tryStart();
      return;
    }
    if (state === "play") {
      if (k === "ArrowUp" || k === "w" || k === "W") hop(0, -1);
      else if (k === "ArrowDown" || k === "s" || k === "S") hop(0, 1);
      else if (k === "ArrowLeft" || k === "a" || k === "A") hop(-1, 0);
      else if (k === "ArrowRight" || k === "d" || k === "D") hop(1, 0);
    }
  });

  document.querySelectorAll("[data-dir]").forEach((btn) => {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      resumeAudio();
      if (state === "title" || state === "gameover" || state === "madeit") {
        tryStart();
        return;
      }
      const d = btn.getAttribute("data-dir");
      if (d === "up") hop(0, -1);
      else if (d === "down") hop(0, 1);
      else if (d === "left") hop(-1, 0);
      else if (d === "right") hop(1, 0);
    });
  });

  canvas.addEventListener("pointerdown", () => {
    resumeAudio();
    if (state === "title" || state === "gameover" || state === "madeit") tryStart();
  });

  // ========== SCENES ==========
  function drawSkyBand(y, h) {
    ctx.fillStyle = C.skyDeep;
    ctx.fillRect(0, y, WIDTH, h * 0.45);
    ctx.fillStyle = C.sky;
    ctx.fillRect(0, y + h * 0.45, WIDTH, h * 0.55);
  }

  function drawBackground() {
    ctx.fillStyle = C.hud;
    ctx.fillRect(0, 0, WIDTH, TILE);
    for (let i = 0; i < 8; i++) {
      fillCircle(30 + i * 80, 12, 3, C.yellow);
      strokeCircle(30 + i * 80, 12, 3, 1.5);
    }

    for (let row = 1; row <= 16; row++) {
      const y = row * TILE;
      if (GOAL_ROWS.has(row)) {
        ctx.fillStyle = C.waterDeep;
        ctx.fillRect(0, y, WIDTH, TILE);
        ctx.fillStyle = C.water;
        ctx.fillRect(0, y + 6, WIDTH, TILE - 6);
        setInk(3);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(WIDTH, y);
        ctx.stroke();
        for (let i = 0; i < 5; i++) {
          const padX = 40 + i * 120;
          const occupied = state === "madeit" && i === homePadIndex;
          // Water pool under pad
          ctx.fillStyle = occupied ? "rgba(80,200,100,0.35)" : "rgba(30,100,160,0.45)";
          ctx.beginPath();
          ctx.ellipse(padX + 32, y + TILE / 2 + 4, 30, 12, 0, 0, Math.PI * 2);
          ctx.fill();
          if (hasAsset("lily")) {
            ctx.drawImage(ASSETS.lily, padX + 2, y + 2, 60, 36);
            if (occupied) {
              ctx.globalAlpha = 0.35;
              ctx.fillStyle = C.yellow;
              ctx.beginPath();
              ctx.ellipse(padX + 32, y + TILE / 2, 28, 14, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.globalAlpha = 1;
            }
          } else {
            celRoundRect(
              padX, y + 5, 64, TILE - 10, 12,
              occupied ? C.green : C.waterDeep,
              occupied ? C.greenShade : C.water
            );
          }
          if (!occupied) {
            ctx.fillStyle = C.yellow;
            ctx.font = "bold 14px Nunito, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("★", padX + 32, y + TILE / 2 + 5);
          }
        }
        ctx.textAlign = "left";
      } else if (MEDIAN_ROWS.has(row)) {
        ctx.fillStyle = C.grass;
        ctx.fillRect(0, y, WIDTH, TILE);
        ctx.fillStyle = C.grassShade;
        ctx.globalAlpha = 0.35;
        ctx.fillRect(0, y + TILE * 0.55, WIDTH, TILE * 0.45);
        ctx.globalAlpha = 1;
        setInk(2.5);
        ctx.strokeStyle = C.greenDeep;
        for (let x = 8; x < WIDTH; x += 18) {
          ctx.beginPath();
          ctx.moveTo(x, y + TILE - 4);
          ctx.quadraticCurveTo(x + 3, y + 8, x + 6, y + TILE - 4);
          ctx.stroke();
        }
        setInk(3);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(WIDTH, y);
        ctx.moveTo(0, y + TILE);
        ctx.lineTo(WIDTH, y + TILE);
        ctx.stroke();
      } else if (START_ROWS.has(row)) {
        ctx.fillStyle = C.sidewalk;
        ctx.fillRect(0, y, WIDTH, TILE);
        ctx.fillStyle = C.sidewalkShade;
        ctx.globalAlpha = 0.4;
        ctx.fillRect(0, y + TILE * 0.6, WIDTH, TILE * 0.4);
        ctx.globalAlpha = 1;
        setInk(2);
        for (let x = 0; x <= WIDTH; x += TILE) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + TILE);
          ctx.stroke();
        }
        ctx.fillStyle = C.yellow;
        ctx.fillRect(0, y, WIDTH, 6);
        setInk(2.5);
        ctx.strokeRect(0, y, WIDTH, 6);
      } else if (ROAD_ROW_SET.has(row)) {
        // Painterly asphalt: soft vertical shading
        const g = ctx.createLinearGradient(0, y, 0, y + TILE);
        g.addColorStop(0, "#6a6a74");
        g.addColorStop(0.45, "#4e4e58");
        g.addColorStop(1, "#3a3a44");
        ctx.fillStyle = g;
        ctx.fillRect(0, y, WIDTH, TILE);
        // Soft painted edge highlight
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.fillRect(0, y + 2, WIDTH, 3);
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.fillRect(0, y + TILE - 6, WIDTH, 6);
        // Dashed center
        ctx.fillStyle = "rgba(255, 220, 70, 0.85)";
        for (let x = 0; x < WIDTH; x += 28) {
          ctx.fillRect(x, y + TILE - 6, 14, 3);
        }
      } else {
        const g = ctx.createLinearGradient(0, y, 0, y + TILE);
        g.addColorStop(0, "#6ed95a");
        g.addColorStop(1, "#3aa832");
        ctx.fillStyle = g;
        ctx.fillRect(0, y, WIDTH, TILE);
      }
    }

    // Bottom HUD panel (taller so TIME label + hints fit below the bar)
    const hudTop = 17 * TILE;
    ctx.fillStyle = C.hud;
    ctx.fillRect(0, hudTop, WIDTH, HEIGHT - hudTop);
    // Subtle top edge of bottom panel
    setInk(3);
    ctx.beginPath();
    ctx.moveTo(0, hudTop);
    ctx.lineTo(WIDTH, hudTop);
    ctx.stroke();
    if (levelFlash > 0) {
      ctx.fillStyle = "rgba(120,255,80," + levelFlash / 80 + ")";
      ctx.fillRect(0, TILE, WIDTH, 16 * TILE);
      levelFlash--;
    }
  }

  function drawMadeItSign() {
    // Dim overlay
    ctx.fillStyle = "rgba(20, 30, 50, 0.45)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const cx = WIDTH / 2;
    const cy = HEIGHT / 2 + 20;
    const w = 420;
    const h = 220;

    // Wooden sign posts
    celRoundRect(cx - w / 2 + 30, cy - 20, 18, 140, 4, C.signWoodDark, null);
    celRoundRect(cx + w / 2 - 48, cy - 20, 18, 140, 4, C.signWoodDark, null);

    // Main sign board
    celRoundRect(cx - w / 2, cy - h / 2, w, h, 18, C.signWood, C.signWoodDark);
    // Inner cream panel
    celRoundRect(cx - w / 2 + 16, cy - h / 2 + 16, w - 32, h - 32, 12, C.cream, null);

    ctx.textAlign = "center";
    ctx.font = "bold 42px Bangers, Impact, sans-serif";
    ctx.lineWidth = 7;
    ctx.strokeStyle = C.ink;
    ctx.fillStyle = C.green;
    ctx.strokeText("YOU MADE IT!", cx, cy - 45);
    ctx.fillText("YOU MADE IT!", cx, cy - 45);

    ctx.font = "bold 28px Bangers, Impact, sans-serif";
    ctx.fillStyle = C.red;
    ctx.strokeText("LEVEL " + nextLevel, cx, cy + 5);
    ctx.fillText("LEVEL " + nextLevel, cx, cy + 5);

    // Thin, readable body copy (no heavy outline)
    ctx.font = "600 15px Nunito, sans-serif";
    ctx.lineWidth = 0;
    ctx.fillStyle = C.signText;
    ctx.fillText("Bonus +" + madeItBonus + "  ·  Lives refilled!", cx, cy + 40);

    // Prompt pulse — thin readable text
    const blink = 0.7 + Math.sin(pulse * 3) * 0.3;
    ctx.globalAlpha = blink;
    ctx.font = "600 14px Nunito, sans-serif";
    ctx.fillStyle = C.blueShade;
    ctx.fillText("ENTER / SPACE / TAP  —  start Level " + nextLevel, cx, cy + 78);
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
  }

  function drawTitle() {
    // Layout (top → bottom): title · road scene · toad · ALL instructions below road
    const roadTop = 200;
    const roadH = 100;
    const roadBottom = roadTop + roadH;

    // Sky band only above the road
    drawSkyBand(0, roadTop + 20);
    drawCloud(40, 48, 1.0);
    drawCloud(480, 58, 0.85);

    // Grass from mid-road down
    ctx.fillStyle = C.grass;
    ctx.fillRect(0, roadTop + 40, WIDTH, HEIGHT - (roadTop + 40));
    ctx.fillStyle = C.grassShade;
    ctx.globalAlpha = 0.28;
    ctx.fillRect(0, roadBottom + 20, WIDTH, HEIGHT - roadBottom - 20);
    ctx.globalAlpha = 1;

    // Title (above road)
    ctx.textAlign = "center";
    ctx.font = "bold 48px Bangers, Impact, sans-serif";
    ctx.lineWidth = 7;
    ctx.strokeStyle = C.ink;
    ctx.strokeText("TOADZ CROSSER!", WIDTH / 2, 70);
    ctx.fillStyle = C.olive;
    ctx.fillText("TOADZ CROSSER!", WIDTH / 2, 70);

    ctx.font = "600 14px Nunito, sans-serif";
    const sub = "Ribbit · dodge traffic · reach a pad!";
    const tw = ctx.measureText(sub).width + 24;
    celRoundRect(WIDTH / 2 - tw / 2, 88, tw, 26, 10, C.cream, null);
    ctx.fillStyle = C.signText;
    ctx.fillText(sub, WIDTH / 2, 106);

    // Road strip (no text on top of it)
    celRoundRect(36, roadTop, WIDTH - 72, roadH, 16, C.road, C.roadShade);
    ctx.fillStyle = C.yellow;
    for (let x = 56; x < WIDTH - 56; x += 36) {
      ctx.fillRect(x, roadTop + roadH / 2 - 3, 20, 5);
      setInk(1.5);
      ctx.strokeRect(x, roadTop + roadH / 2 - 3, 20, 5);
    }
    const demo = [new Car(0, 1, 0, "#ff4b4b", 2), new Car(0, 1, 0, "#4d8fff", 3)];
    demo[0].x = 90;
    demo[0].y = roadTop + 18;
    demo[0].length = 70;
    demo[0].height = 28;
    demo[0].isTruck = false;
    demo[0].spriteKey = "car_red";
    demo[1].x = 360;
    demo[1].y = roadTop + 42;
    demo[1].length = 110;
    demo[1].height = 34;
    demo[1].isTruck = true;
    demo[1].spriteKey = "truck_blue";
    demo[0].draw();
    demo[1].draw();

    // Toad below the road (not covering instructions)
    const t = new Toad();
    const toadY = roadBottom + 70 + Math.sin(pulse) * 8;
    Object.defineProperty(t, "x", { get: () => WIDTH / 2 });
    Object.defineProperty(t, "y", { get: () => toadY });
    t.facing = 0;
    t.hopTimer = Math.floor((Math.sin(pulse * 1.5) * 0.5 + 0.5) * 12);
    t.hopMax = 14;
    t.drow = -1;
    t.limbPhase = pulse * 3;
    t.wobble = pulse * 2;
    t.draw();

    // Instruction card — fully BELOW road + toad
    const panelTop = roadBottom + 130;
    const panelH = 280;
    celRoundRect(48, panelTop, WIDTH - 96, panelH, 18, C.cream, null);

    ctx.font = "bold 20px Bangers, Impact, sans-serif";
    ctx.lineWidth = 4;
    ctx.strokeStyle = C.ink;
    ctx.fillStyle = C.red;
    ctx.strokeText("HOW TO PLAY", WIDTH / 2, panelTop + 36);
    ctx.fillText("HOW TO PLAY", WIDTH / 2, panelTop + 36);

    const tips = [
      "ARROWS / WASD  —  hop (ribbit!)",
      "Any ★ pad  —  YOU MADE IT! then next level",
      "Sound on — traffic, hops & POW hits",
      "Level 1 is slow — traffic speeds up each pad",
      "",
      "ENTER / SPACE / TAP  —  start",
      "ESC  —  menu",
    ];
    tips.forEach((line, i) => {
      if (!line) return;
      ctx.font = "600 16px Nunito, sans-serif";
      ctx.lineWidth = 0;
      ctx.fillStyle = i >= 5 ? C.blueShade : C.signText;
      ctx.fillText(line, WIDTH / 2, panelTop + 72 + i * 26);
    });
    ctx.textAlign = "left";
  }

  function drawHud() {
    ctx.fillStyle = C.hud;
    ctx.fillRect(0, 0, WIDTH, TILE);
    ctx.textAlign = "left";
    ctx.font = "bold 22px Bangers, Impact, sans-serif";
    ctx.lineWidth = 4;
    ctx.strokeStyle = C.ink;
    ctx.fillStyle = C.olive;
    ctx.strokeText("TOADZ CROSSER!", 10, 28);
    ctx.fillText("TOADZ CROSSER!", 10, 28);

    ctx.font = "bold 15px Nunito, sans-serif";
    ctx.lineWidth = 3;
    ctx.fillStyle = C.white;
    ctx.strokeText("Score " + score, 210, 26);
    ctx.fillText("Score " + score, 210, 26);
    ctx.fillStyle = C.yellow;
    ctx.strokeText("Lv " + level, 340, 26);
    ctx.fillText("Lv " + level, 340, 26);
    const mph = Math.round(levelSpeedMult() * 100);
    ctx.font = "bold 12px Nunito, sans-serif";
    ctx.fillStyle = C.orange;
    ctx.strokeText("SPD " + mph + "%", 400, 26);
    ctx.fillText("SPD " + mph + "%", 400, 26);

    for (let i = 0; i < lives; i++) {
      celCircle(500 + i * 22, 20, 8, C.olive, C.greenShade);
      fillCircle(497 + i * 22, 17, 2.2, C.white);
      fillCircle(503 + i * 22, 17, 2.2, C.white);
    }

    // Bottom panel: bar + labels (canvas is tall enough that nothing is clipped)
    const barY = 17 * TILE + 16;
    celRoundRect(20, barY, WIDTH - 40, 22, 10, C.roadShade, null);
    const fill = Math.floor((WIDTH - 48) * (timeLeft / maxTime()));
    const tcol = timeLeft > 15 ? C.green : timeLeft > 7 ? C.yellow : C.red;
    if (fill > 0) {
      celRoundRect(24, barY + 4, Math.max(8, fill), 14, 6, tcol, shadeColor(tcol, 0.25));
    }
    const labelY = barY + 48;
    ctx.font = "bold 15px Nunito, sans-serif";
    ctx.fillStyle = C.white;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 3;
    ctx.textAlign = "left";
    ctx.strokeText("TIME", 26, labelY);
    ctx.fillText("TIME", 26, labelY);
    ctx.textAlign = "right";
    ctx.fillStyle = C.yellow;
    const hint =
      state === "madeit"
        ? "ENTER / SPACE — next level"
        : "★ pad = YOU MADE IT!";
    ctx.strokeText(hint, WIDTH - 22, labelY);
    ctx.fillText(hint, WIDTH - 22, labelY);
    ctx.textAlign = "left";

    if (msgTimer > 0 && message && state === "play") {
      ctx.textAlign = "center";
      ctx.font = "bold 34px Bangers, Impact, sans-serif";
      ctx.lineWidth = 8;
      ctx.strokeStyle = C.ink;
      ctx.fillStyle = C.yellow;
      ctx.strokeText(message, WIDTH / 2, HEIGHT / 2 - 20);
      ctx.fillText(message, WIDTH / 2, HEIGHT / 2 - 20);
      ctx.textAlign = "left";
    }
  }

  function drawOverlay() {
    ctx.fillStyle = "rgba(120,20,20,0.55)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    celRoundRect(WIDTH / 2 - 200, HEIGHT / 2 - 90, 400, 180, 20, C.cream, null);
    ctx.textAlign = "center";
    ctx.font = "bold 40px Bangers, Impact, sans-serif";
    ctx.lineWidth = 6;
    ctx.strokeStyle = C.ink;
    ctx.fillStyle = C.red;
    ctx.strokeText("GAME OVER", WIDTH / 2, HEIGHT / 2 - 30);
    ctx.fillText("GAME OVER", WIDTH / 2, HEIGHT / 2 - 30);
    ctx.font = "bold 18px Nunito, sans-serif";
    ctx.fillStyle = C.ink;
    ctx.fillText("Score: " + score + "   ·   Level " + level, WIDTH / 2, HEIGHT / 2 + 10);
    ctx.fillText("Pads cleared: " + padsCleared, WIDTH / 2, HEIGHT / 2 + 38);
    ctx.fillStyle = C.blueShade;
    ctx.fillText("ENTER / SPACE / TAP — title", WIDTH / 2, HEIGHT / 2 + 70);
    ctx.textAlign = "left";
  }

  let last = performance.now();

  function drawLoading() {
    ctx.fillStyle = "#1a2a40";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.textAlign = "center";
    ctx.font = "bold 28px Bangers, Impact, sans-serif";
    ctx.fillStyle = "#8fd45a";
    ctx.fillText("Loading painted world…", WIDTH / 2, HEIGHT / 2);
    ctx.textAlign = "left";
  }

  function frame(now) {
    if (!assetsReady && !assetsFailed) {
      drawLoading();
      requestAnimationFrame(frame);
      return;
    }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    pulse += dt * 4;

    if (state === "title") {
      drawTitle();
      requestAnimationFrame(frame);
      return;
    }

    if (state === "play") {
      toad.update();
      updateFx();
      if (!toad.alive && toad.squash <= 0 && lives > 0) {
        toad.reset();
        timeLeft = maxTime();
        farthestRow = 16;
      }
      if (toad.alive && !toad.home) {
        timeLeft -= dt;
        if (timeLeft <= 0) {
          timeLeft = 0;
          squashToad();
        }
      }
      for (const car of cars) car.update();
      if (toad.alive && toad.squash <= 0 && !toad.home && ROAD_ROW_SET.has(toad.row)) {
        const tr = toad.rect();
        for (const car of cars) {
          if (car.row === toad.row && rectsOverlap(tr, car.rect())) {
            squashToad();
            break;
          }
        }
      }
      if (msgTimer > 0) msgTimer--;
    } else if (state === "madeit") {
      toad.update();
      updateFx();
      // Cars freeze while celebrating
    } else {
      updateFx();
    }

    drawBackground();
    if (state !== "madeit") {
      for (const car of cars) car.draw();
    } else {
      // Still show frozen traffic under the sign
      for (const car of cars) car.draw();
    }
    drawFx("line");
    toad.draw();
    drawFx("pow");
    drawHud();

    if (state === "madeit") drawMadeItSign();
    if (state === "gameover") drawOverlay();

    requestAnimationFrame(frame);
  }

  loadAssets(() => {
    requestAnimationFrame(frame);
  });
})();
