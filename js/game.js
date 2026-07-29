/**
 * Toadz Crosser! — classic American 2D cartoon / cel-shaded browser game
 * Rubber-hose hops, speed lines, POW! hits. One pad = next level + full lives.
 */
(function () {
  "use strict";

  const canvas = document.getElementById("game");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const WIDTH = 640;
  const HEIGHT = 720;
  const TILE = 40;
  const COLS = WIDTH / TILE;
  const INK = "#1a1208";
  const MAX_LIVES = 5;
  // Level 1 is easy; each level multiplies car speed a bit more
  const L1_SPEED = 0.42;
  const SPEED_PER_LEVEL = 0.13;

  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  const C = {
    ink: INK,
    white: "#fffdf8",
    cream: "#fff6e0",
    sky: "#7ec8f5",
    skyDeep: "#4aa3e0",
    cloud: "#ffffff",
    green: "#58d83a",
    greenShade: "#3aa32e",
    greenDeep: "#2a7a22",
    belly: "#c8ff8a",
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
  };

  const GOAL_ROWS = new Set([1]);
  const MEDIAN_ROWS = new Set([8]);
  const START_ROWS = new Set([16]);

  // Base speeds are modest; difficulty mult makes L1 slow and later levels zippy
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
    // Sparse traffic early, denser later
    if (level <= 2) return randInt(2, 3);
    if (level <= 5) return randInt(3, 4);
    return randInt(3, 5);
  }

  // --- Drawing helpers ---
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

  // --- FX: POW bubbles + hop speed lines ---
  let fxList = [];

  function spawnPow(x, y, word) {
    fxList.push({
      kind: "pow",
      x: x,
      y: y,
      text: word || pick(POW_WORDS),
      life: 48,
      max: 48,
      rot: rand(-0.35, 0.35),
      scale: rand(0.9, 1.2),
    });
  }

  function spawnSpeedLines(x, y, dcol, drow) {
    // Lines shoot opposite hop direction
    const ox = -dcol;
    const oy = -drow;
    for (let i = 0; i < 7; i++) {
      const spread = (i - 3) * 5;
      fxList.push({
        kind: "line",
        x: x + (oy !== 0 ? spread : 0) + (ox !== 0 ? 0 : spread * 0.3),
        y: y + (ox !== 0 ? spread : 0) + (oy !== 0 ? 0 : spread * 0.3),
        dx: ox,
        dy: oy,
        len: rand(14, 28),
        life: 10 + i,
        max: 14,
        thick: rand(2, 4),
      });
    }
  }

  function updateFx() {
    for (const f of fxList) f.life--;
    fxList = fxList.filter((f) => f.life > 0);
  }

  function drawFx() {
    for (const f of fxList) {
      const t = f.life / f.max;
      if (f.kind === "pow") {
        ctx.save();
        ctx.translate(f.x, f.y - (1 - t) * 28);
        ctx.rotate(f.rot);
        const sc = f.scale * (0.7 + (1 - t) * 0.55);
        ctx.scale(sc, sc);
        ctx.globalAlpha = Math.min(1, t * 1.4);
        // Starburst backplate
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
        // ink outline twin
        ctx.globalAlpha = t * 0.5;
        setInk(f.thick + 2);
        ctx.strokeStyle = C.ink;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + f.dx * f.len * 0.85, ly + f.dy * f.len * 0.85);
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    ctx.textBaseline = "alphabetic";
  }

  class Car {
    constructor(row, direction, speed, color, lengthTiles) {
      this.row = row;
      this.direction = direction;
      this.speed = speed;
      this.color = color;
      this.length = lengthTiles * TILE;
      this.height = Math.floor(TILE * 0.78);
      this.x =
        direction > 0
          ? -this.length - randInt(0, WIDTH)
          : WIDTH + randInt(0, WIDTH);
      this.y = row * TILE + (TILE - this.height) / 2;
    }

    update() {
      this.x += this.direction * this.speed;
      if (this.direction > 0 && this.x > WIDTH + 20) {
        this.x = -this.length - randInt(40, 200);
      } else if (this.direction < 0 && this.x + this.length < -20) {
        this.x = WIDTH + randInt(40, 200);
      }
    }

    rect() {
      return { x: this.x, y: this.y, w: this.length, h: this.height };
    }

    draw() {
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
      [
        [r.x + 12, wy],
        [r.x + r.w - 12, wy],
      ].forEach(([wx2, wy2]) => {
        fillCircle(wx2, wy2, 7, C.ink);
        fillCircle(wx2, wy2, 3.5, C.gray);
        strokeCircle(wx2, wy2, 7, 2);
      });
    }
  }

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
      // Rubber-hose wobble phase
      this.wobble = 0;
      this.limbPhase = 0;
    }

    get x() {
      return this.col * TILE + TILE / 2;
    }
    get y() {
      return this.row * TILE + TILE / 2;
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
      return true;
    }

    update() {
      if (this.hopTimer > 0) {
        this.hopTimer--;
        this.limbPhase += 0.55;
      }
      if (this.squash > 0) this.squash--;
      this.wobble += 0.12;
    }

    draw() {
      if (!this.alive && this.squash <= 0) return;
      const cx = this.x;
      const cy = this.y;

      if (this.squash > 0) {
        const pop = Math.sin((this.squash / 40) * Math.PI) * 4;
        celEllipse(cx, cy + 4, 24 + pop, 7, C.greenShade, C.greenDeep);
        celEllipse(cx, cy + 4, 14, 4, C.red, C.redShade);
        setInk(3);
        ctx.beginPath();
        ctx.moveTo(cx - 12, cy - 4);
        ctx.lineTo(cx - 4, cy + 4);
        ctx.moveTo(cx - 4, cy - 4);
        ctx.lineTo(cx - 12, cy + 4);
        ctx.moveTo(cx + 4, cy - 4);
        ctx.lineTo(cx + 12, cy + 4);
        ctx.moveTo(cx + 12, cy - 4);
        ctx.lineTo(cx + 4, cy + 4);
        ctx.stroke();
        return;
      }

      // Rubber-hose squash / stretch curve
      const hopT = this.hopTimer > 0 ? 1 - this.hopTimer / this.hopMax : 0;
      // Anticipation → stretch mid-air → land squash
      let stretchY = 1;
      let stretchX = 1;
      if (this.hopTimer > 0) {
        const wave = Math.sin(hopT * Math.PI);
        stretchY = 1 + 0.55 * wave; // tall mid hop
        stretchX = 1 - 0.35 * wave; // skinny mid hop
        if (hopT > 0.85) {
          // landing pancake
          stretchY = 0.55;
          stretchX = 1.45;
        } else if (hopT < 0.15) {
          // crouch
          stretchY = 0.7;
          stretchX = 1.25;
        }
      } else {
        // Idle rubber wobble
        stretchY = 1 + Math.sin(this.wobble) * 0.04;
        stretchX = 1 + Math.cos(this.wobble * 1.3) * 0.03;
      }

      const bodyW = 13 * stretchX;
      const bodyH = 11 * stretchY;
      const wobX = Math.sin(this.wobble * 2) * (this.hopTimer > 0 ? 2.5 : 0.8);
      const limbFlail = this.hopTimer > 0 ? Math.sin(this.limbPhase) * 10 : Math.sin(this.wobble) * 2;

      // Shadow
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = C.ink;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 16, bodyW * 0.95, 4 / stretchY, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Extra long rubber legs
      const legReach = this.hopTimer > 0 ? 6 + Math.abs(limbFlail) * 0.4 : 0;
      if (this.facing === 0 || this.facing === 2) {
        celCircle(cx - 14 - limbFlail * 0.3, cy + 9 + legReach * 0.3, 7 + legReach * 0.15, C.greenShade, C.greenDeep);
        celCircle(cx + 14 + limbFlail * 0.3, cy + 9 + legReach * 0.3, 7 + legReach * 0.15, C.greenShade, C.greenDeep);
        // Stretchy limb connectors
        setInk(5);
        ctx.strokeStyle = C.greenShade;
        ctx.beginPath();
        ctx.moveTo(cx - 6, cy + 4);
        ctx.quadraticCurveTo(cx - 16 - limbFlail, cy + 2, cx - 14 - limbFlail * 0.3, cy + 9);
        ctx.moveTo(cx + 6, cy + 4);
        ctx.quadraticCurveTo(cx + 16 + limbFlail, cy + 2, cx + 14 + limbFlail * 0.3, cy + 9);
        ctx.stroke();
        setInk(3);
        ctx.strokeStyle = C.ink;
        ctx.beginPath();
        ctx.moveTo(cx - 6, cy + 4);
        ctx.quadraticCurveTo(cx - 16 - limbFlail, cy + 2, cx - 14 - limbFlail * 0.3, cy + 9);
        ctx.moveTo(cx + 6, cy + 4);
        ctx.quadraticCurveTo(cx + 16 + limbFlail, cy + 2, cx + 14 + limbFlail * 0.3, cy + 9);
        ctx.stroke();

        celCircle(cx - 11 + limbFlail * 0.2, cy - 4 - legReach * 0.2, 6, C.green, C.greenShade);
        celCircle(cx + 11 - limbFlail * 0.2, cy - 4 - legReach * 0.2, 6, C.green, C.greenShade);
      } else {
        celCircle(cx - 2, cy - 14 - limbFlail * 0.2, 6, C.greenShade, C.greenDeep);
        celCircle(cx - 2, cy + 14 + limbFlail * 0.2, 6, C.greenShade, C.greenDeep);
        celCircle(cx + 10 + legReach * 0.2, cy - 10, 6, C.green, C.greenShade);
        celCircle(cx + 10 + legReach * 0.2, cy + 10, 6, C.green, C.greenShade);
      }

      // Body
      celEllipse(cx + wobX, cy + 2, bodyW, bodyH, C.green, C.greenShade);
      celEllipse(cx + wobX, cy + 5, bodyW * 0.45, bodyH * 0.4, C.belly, null);

      // Eyes (lag slightly for rubber feel)
      const eyeLag = this.hopTimer > 0 ? -this.dcol * 2 + limbFlail * 0.15 : 0;
      const eyePairs = {
        0: [
          [-9, -12],
          [9, -12],
        ],
        1: [
          [8, -8],
          [12, 2],
        ],
        2: [
          [-9, 10],
          [9, 10],
        ],
        3: [
          [-12, -8],
          [-8, 2],
        ],
      }[this.facing];

      for (const [ex, ey] of eyePairs) {
        const ex2 = cx + ex + eyeLag + wobX;
        const ey2 = cy + ey - (stretchY - 1) * 6;
        celCircle(ex2, ey2, 8 + (stretchY - 1) * 2, C.green, C.greenShade);
        celCircle(ex2, ey2, 5, C.white, null);
        fillCircle(ex2 + 1 + this.dcol, ey2 + 1 + this.drow, 2.4, C.ink);
        fillCircle(ex2 + 2, ey2, 0.9, C.white);
      }

      setInk(2.5);
      ctx.beginPath();
      if (this.facing === 0) ctx.arc(cx + wobX, cy + 4, 6 + limbFlail * 0.05, 0.15, Math.PI - 0.15);
      else if (this.facing === 2) ctx.arc(cx + wobX, cy - 2, 6, Math.PI + 0.2, -0.2);
      else ctx.arc(cx + (this.facing === 1 ? 2 : -2) + wobX, cy + 4, 5, 0.15, Math.PI - 0.15);
      ctx.stroke();

      ctx.globalAlpha = 0.45;
      fillCircle(cx - bodyW * 0.7 + wobX, cy + 2, 3.5, C.pink);
      fillCircle(cx + bodyW * 0.7 + wobX, cy + 2, 3.5, C.pink);
      ctx.globalAlpha = 1;
    }
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // --- Game state ---
  let state = "title";
  let toad = new Toad();
  let cars = [];
  let lives = MAX_LIVES;
  let score = 0;
  let level = 1;
  let padsCleared = 0; // career pads this run
  let farthestRow = 16;
  let message = "";
  let msgTimer = 0;
  let timeLeft = 50;
  let pulse = 0;
  let levelFlash = 0; // brief green flash on level up

  function maxTime() {
    // More time early; still generous later
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
    fxList = fxList.filter((f) => f.kind === "pow"); // keep celebratory POW briefly
  }

  function squashToad() {
    toad.alive = false;
    toad.squash = 40;
    lives--;
    spawnPow(toad.x, toad.y - 10, pick(POW_WORDS));
    // Extra burst
    spawnPow(toad.x + rand(-20, 20), toad.y + rand(-16, 8), pick(["BAM!", "OOF!", "WHAM!"]));
    message = pick(POW_WORDS);
    msgTimer = 40;
    if (lives <= 0) state = "gameover";
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
      // Missed the lily pads → splash death
      squashToad();
      return;
    }

    // Success: score, full lives, next level (faster cars)
    const bonus = 200 + Math.floor(timeLeft * 10) + level * 50;
    score += bonus;
    padsCleared++;
    lives = MAX_LIVES;
    level++;
    levelFlash = 30;
    message = "LEVEL " + level + "!  +" + bonus;
    msgTimer = 70;
    spawnPow(toad.x, toad.y - 20, "SAFE!");
    spawnPow(WIDTH / 2, HEIGHT / 2 - 40, "LEVEL " + level + "!");
    startLevel();
  }

  function tryStart() {
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
    }
  }

  function hop(dcol, drow) {
    if (state !== "play" || !toad.alive || toad.home) return;
    const moved = toad.tryMove(dcol, drow);
    if (moved && drow < 0 && toad.row < farthestRow) {
      score += 10;
      farthestRow = toad.row;
    }
    if (moved && GOAL_ROWS.has(toad.row)) reachHome();
  }

  window.addEventListener("keydown", (e) => {
    const k = e.key;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(k)) {
      e.preventDefault();
    }
    if (k === "Escape") {
      if (state === "play") state = "title";
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
    const send = (e) => {
      e.preventDefault();
      const d = btn.getAttribute("data-dir");
      if (state === "title" || state === "gameover") {
        tryStart();
        return;
      }
      if (d === "up") hop(0, -1);
      else if (d === "down") hop(0, 1);
      else if (d === "left") hop(-1, 0);
      else if (d === "right") hop(1, 0);
    };
    btn.addEventListener("pointerdown", send);
  });

  canvas.addEventListener("pointerdown", () => {
    if (state === "title" || state === "gameover") tryStart();
  });

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

        // All pads open — any one clears the level
        for (let i = 0; i < 5; i++) {
          const padX = 40 + i * 120;
          celRoundRect(padX, y + 5, 64, TILE - 10, 12, C.waterDeep, C.water);
          setInk(2.5);
          ctx.beginPath();
          ctx.ellipse(padX + 32, y + TILE / 2, 22, 10, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = C.yellow;
          ctx.font = "bold 16px Nunito, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("★", padX + 32, y + TILE / 2 + 6);
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
        ctx.fillStyle = C.road;
        ctx.fillRect(0, y, WIDTH, TILE);
        ctx.fillStyle = C.roadShade;
        ctx.globalAlpha = 0.35;
        ctx.fillRect(0, y + TILE * 0.65, WIDTH, TILE * 0.35);
        ctx.globalAlpha = 1;
        ctx.fillStyle = C.asphaltLine;
        for (let x = 0; x < WIDTH; x += 28) {
          ctx.fillRect(x, y + TILE - 5, 16, 4);
          setInk(1.5);
          ctx.strokeRect(x, y + TILE - 5, 16, 4);
        }
      } else {
        ctx.fillStyle = C.grass;
        ctx.fillRect(0, y, WIDTH, TILE);
      }
    }

    ctx.fillStyle = C.hud;
    ctx.fillRect(0, 17 * TILE, WIDTH, HEIGHT - 17 * TILE);

    if (levelFlash > 0) {
      ctx.fillStyle = "rgba(120,255,80," + levelFlash / 80 + ")";
      ctx.fillRect(0, TILE, WIDTH, 16 * TILE);
      levelFlash--;
    }
  }

  function drawTitle() {
    drawSkyBand(0, HEIGHT * 0.42);
    ctx.fillStyle = C.grass;
    ctx.beginPath();
    ctx.moveTo(0, HEIGHT * 0.4);
    ctx.quadraticCurveTo(WIDTH * 0.25, HEIGHT * 0.32, WIDTH * 0.5, HEIGHT * 0.4);
    ctx.quadraticCurveTo(WIDTH * 0.75, HEIGHT * 0.48, WIDTH, HEIGHT * 0.38);
    ctx.lineTo(WIDTH, HEIGHT);
    ctx.lineTo(0, HEIGHT);
    ctx.closePath();
    ctx.fill();
    setInk(4);
    ctx.beginPath();
    ctx.moveTo(0, HEIGHT * 0.4);
    ctx.quadraticCurveTo(WIDTH * 0.25, HEIGHT * 0.32, WIDTH * 0.5, HEIGHT * 0.4);
    ctx.quadraticCurveTo(WIDTH * 0.75, HEIGHT * 0.48, WIDTH, HEIGHT * 0.38);
    ctx.stroke();
    ctx.fillStyle = C.grassShade;
    ctx.globalAlpha = 0.3;
    ctx.fillRect(0, HEIGHT * 0.55, WIDTH, HEIGHT * 0.45);
    ctx.globalAlpha = 1;

    drawCloud(40, 50, 1.1);
    drawCloud(480, 70, 0.9);
    drawCloud(280, 40, 0.7);

    celRoundRect(40, HEIGHT / 2 - 50, WIDTH - 80, 110, 16, C.road, C.roadShade);
    ctx.fillStyle = C.yellow;
    for (let x = 60; x < WIDTH - 60; x += 36) {
      ctx.fillRect(x, HEIGHT / 2 + 2, 20, 5);
      setInk(1.5);
      ctx.strokeRect(x, HEIGHT / 2 + 2, 20, 5);
    }

    const demo = [new Car(0, 1, 0, "#ff4b4b", 2), new Car(0, -1, 0, "#4d8fff", 2)];
    demo[0].x = 90;
    demo[0].y = HEIGHT / 2 - 40;
    demo[0].length = 70;
    demo[0].height = 28;
    demo[1].x = 420;
    demo[1].y = HEIGHT / 2 + 18;
    demo[1].length = 80;
    demo[1].height = 28;
    demo[0].draw();
    demo[1].draw();

    const t = new Toad();
    Object.defineProperty(t, "x", { get: () => WIDTH / 2 });
    Object.defineProperty(t, "y", {
      get: () => HEIGHT / 2 + 120 + Math.sin(pulse) * 10,
    });
    t.facing = 0;
    t.hopTimer = Math.floor((Math.sin(pulse * 1.5) * 0.5 + 0.5) * 12);
    t.hopMax = 14;
    t.drow = -1;
    t.limbPhase = pulse * 3;
    t.wobble = pulse * 2;
    t.draw();

    ctx.textAlign = "center";
    ctx.font = "bold 52px Bangers, Impact, sans-serif";
    const title = "TOADZ CROSSER!";
    ctx.lineWidth = 8;
    ctx.strokeStyle = C.ink;
    ctx.strokeText(title, WIDTH / 2, 100);
    ctx.fillStyle = C.green;
    ctx.fillText(title, WIDTH / 2, 100);

    ctx.font = "bold 16px Nunito, sans-serif";
    ctx.lineWidth = 4;
    ctx.strokeStyle = C.ink;
    ctx.fillStyle = C.cream;
    const sub = "One pad = next level · Full lives · Cars get faster!";
    ctx.strokeText(sub, WIDTH / 2, 145);
    ctx.fillText(sub, WIDTH / 2, 145);

    const tips = [
      "ARROWS / WASD  —  hop",
      "Reach ANY ★ pad up top to level up",
      "Level 1 is easy — then traffic revs up!",
      "",
      "ENTER / SPACE / TAP  —  start",
      "ESC  —  menu",
    ];
    tips.forEach((line, i) => {
      ctx.font = "bold 18px Nunito, sans-serif";
      ctx.lineWidth = 4;
      ctx.strokeStyle = C.ink;
      ctx.fillStyle = i >= 4 ? C.yellow : C.white;
      if (line) {
        ctx.strokeText(line, WIDTH / 2, 430 + i * 28);
        ctx.fillText(line, WIDTH / 2, 430 + i * 28);
      }
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
    ctx.fillStyle = C.green;
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

    // Speed hint
    const mph = Math.round(levelSpeedMult() * 100);
    ctx.font = "bold 12px Nunito, sans-serif";
    ctx.fillStyle = C.orange;
    ctx.strokeText("SPD " + mph + "%", 400, 26);
    ctx.fillText("SPD " + mph + "%", 400, 26);

    for (let i = 0; i < lives; i++) {
      celCircle(500 + i * 22, 20, 8, C.green, C.greenShade);
      fillCircle(497 + i * 22, 17, 2.2, C.white);
      fillCircle(503 + i * 22, 17, 2.2, C.white);
    }

    const barY = 17 * TILE + 10;
    celRoundRect(20, barY, WIDTH - 40, 18, 8, C.roadShade, null);
    const fill = Math.floor((WIDTH - 48) * (timeLeft / maxTime()));
    const tcol = timeLeft > 15 ? C.green : timeLeft > 7 ? C.yellow : C.red;
    if (fill > 0) {
      celRoundRect(24, barY + 3, Math.max(8, fill), 12, 5, tcol, shadeColor(tcol, 0.25));
    }

    ctx.font = "bold 13px Nunito, sans-serif";
    ctx.fillStyle = C.white;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 3;
    ctx.textAlign = "left";
    ctx.strokeText("TIME", 26, barY + 38);
    ctx.fillText("TIME", 26, barY + 38);
    ctx.textAlign = "right";
    ctx.fillStyle = C.yellow;
    ctx.strokeText("Any ★ pad = next level + full lives", WIDTH - 22, barY + 38);
    ctx.fillText("Any ★ pad = next level + full lives", WIDTH - 22, barY + 38);
    ctx.textAlign = "left";

    if (msgTimer > 0 && message) {
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

  function frame(now) {
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
      if (toad.alive) {
        timeLeft -= dt;
        if (timeLeft <= 0) {
          timeLeft = 0;
          squashToad();
        }
      }
      for (const car of cars) car.update();
      if (toad.alive && toad.squash <= 0 && ROAD_ROW_SET.has(toad.row)) {
        const tr = toad.rect();
        for (const car of cars) {
          if (car.row === toad.row && rectsOverlap(tr, car.rect())) {
            squashToad();
            break;
          }
        }
      }
      if (msgTimer > 0) msgTimer--;
    } else {
      updateFx();
    }

    drawBackground();
    for (const car of cars) car.draw();
    // Speed lines under toad, POW on top
    drawFx();
    toad.draw();
    // Redraw POW above toad so starbursts read on top
    drawFx();
    drawHud();

    if (state === "gameover") drawOverlay();

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
