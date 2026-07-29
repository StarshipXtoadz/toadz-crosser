/**
 * Toadz Crosser! — classic American 2D cartoon / cel-shaded browser game
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

  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  // Flat cel palette (Saturday-morning cartoon)
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

  // Bright cartoon car body colors
  const ROAD_LANES = [
    { row: 2, dir: 1, speed: 2.2, colors: ["#ff4b4b", "#4d8fff", "#ffe14a"] },
    { row: 3, dir: -1, speed: 2.8, colors: ["#58d83a", "#ff6ad5", "#ff9a3c"] },
    { row: 4, dir: 1, speed: 3.4, colors: ["#fffdf8", "#ff4b4b", "#7b5cff"] },
    { row: 5, dir: -1, speed: 2.5, colors: ["#ff8a9a", "#5ecfff", "#ffe14a"] },
    { row: 6, dir: 1, speed: 3.8, colors: ["#ff7a00", "#00c8b4", "#ff4b9a"] },
    { row: 7, dir: -1, speed: 2.0, colors: ["#6b6bff", "#ff5a5a", "#58d83a"] },
    { row: 9, dir: 1, speed: 3.0, colors: ["#ffe14a", "#3d3d46", "#00a8e0"] },
    { row: 10, dir: -1, speed: 3.6, colors: ["#e00070", "#7dff6a", "#ffb464"] },
    { row: 11, dir: 1, speed: 2.4, colors: ["#a0a0ff", "#ff70a0", "#909098"] },
    { row: 12, dir: -1, speed: 4.0, colors: ["#ff3030", "#40ff40", "#4040ff"] },
    { row: 13, dir: 1, speed: 2.7, colors: ["#f0e000", "#00d0e8", "#c070ff"] },
    { row: 14, dir: -1, speed: 3.2, colors: ["#ff8800", "#00ffc0", "#e8e8e8"] },
    { row: 15, dir: 1, speed: 2.1, colors: ["#c04040", "#4040c0", "#40a040"] },
  ];
  const ROAD_ROW_SET = new Set(ROAD_LANES.map((l) => l.row));

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }
  function randInt(a, b) {
    return Math.floor(rand(a, b + 1));
  }
  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // --- Drawing helpers (cel style) ---
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

  function celCircle(x, y, r, fill, shade, shadeDir) {
    fillCircle(x, y, r, fill);
    // Hard cel shadow wedge
    if (shade) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = shade;
      ctx.globalAlpha = 0.35;
      const ox = shadeDir === "left" ? -r * 0.35 : r * 0.25;
      ctx.fillRect(x + ox, y - r, r * 1.2, r * 2);
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

  function drawCloud(x, y, s) {
    ctx.save();
    fillCircle(x, y, 14 * s, C.cloud);
    fillCircle(x + 16 * s, y - 4 * s, 18 * s, C.cloud);
    fillCircle(x + 34 * s, y, 13 * s, C.cloud);
    fillCircle(x + 16 * s, y + 6 * s, 12 * s, C.cloud);
    // outline as combined feel via strokes
    strokeCircle(x, y, 14 * s, 2.5);
    strokeCircle(x + 16 * s, y - 4 * s, 18 * s, 2.5);
    strokeCircle(x + 34 * s, y, 13 * s, 2.5);
    ctx.restore();
  }

  function shadeColor(hex, amount) {
    // simple darken for cel shade fallback
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255;
    let g = (n >> 8) & 255;
    let b = n & 255;
    r = Math.max(0, Math.floor(r * (1 - amount)));
    g = Math.max(0, Math.floor(g * (1 - amount)));
    b = Math.max(0, Math.floor(b * (1 - amount)));
    return "rgb(" + r + "," + g + "," + b + ")";
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

      // Drop shadow
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = C.ink;
      ctx.beginPath();
      ctx.ellipse(r.x + r.w / 2, r.y + r.h + 2, r.w * 0.42, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Body
      celRoundRect(r.x, r.y + 4, r.w, r.h - 4, 10, this.color, shade);

      // Cabin / roof bump
      const cabinW = r.w * 0.42;
      const cabinX = dir > 0 ? r.x + r.w * 0.22 : r.x + r.w * 0.36;
      celRoundRect(cabinX, r.y - 2, cabinW, r.h * 0.55, 8, this.color, shade);

      // Windshield (cel blue glass)
      const winW = Math.max(10, r.w * 0.18);
      const wx = dir > 0 ? r.x + r.w - winW - 10 : r.x + 10;
      celRoundRect(wx, r.y + 7, winW, r.h - 16, 4, "#9fe0ff", "#4aa3e0");

      // Headlights
      const hx = dir > 0 ? r.x + r.w - 6 : r.x + 6;
      fillCircle(hx, r.y + r.h * 0.38, 4, C.yellow);
      strokeCircle(hx, r.y + r.h * 0.38, 4, 2);
      fillCircle(hx, r.y + r.h * 0.68, 4, C.yellow);
      strokeCircle(hx, r.y + r.h * 0.68, 4, 2);

      // Wheels
      const wy = r.y + r.h - 2;
      [[r.x + 12, wy], [r.x + r.w - 12, wy]].forEach(([wx2, wy2]) => {
        fillCircle(wx2, wy2, 7, C.ink);
        fillCircle(wx2, wy2, 3.5, C.gray);
        strokeCircle(wx2, wy2, 7, 2);
      });

      // Grinny bumper line
      setInk(2);
      ctx.beginPath();
      if (dir > 0) {
        ctx.moveTo(r.x + r.w - 4, r.y + r.h * 0.45);
        ctx.quadraticCurveTo(r.x + r.w + 2, r.y + r.h * 0.55, r.x + r.w - 4, r.y + r.h * 0.65);
      } else {
        ctx.moveTo(r.x + 4, r.y + r.h * 0.45);
        ctx.quadraticCurveTo(r.x - 2, r.y + r.h * 0.55, r.x + 4, r.y + r.h * 0.65);
      }
      ctx.stroke();
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
      this.facing = 0;
      this.squash = 0;
      this.home = false;
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
      this.hopTimer = 8;
      if (drow < 0) this.facing = 0;
      else if (dcol > 0) this.facing = 1;
      else if (drow > 0) this.facing = 2;
      else this.facing = 3;
      return true;
    }

    update() {
      if (this.hopTimer > 0) this.hopTimer--;
      if (this.squash > 0) this.squash--;
    }

    draw() {
      if (!this.alive && this.squash <= 0) return;
      const cx = this.x;
      const cy = this.y;

      if (this.squash > 0) {
        // Classic cartoon splat
        celEllipse(cx, cy + 4, 22, 8, C.greenShade, C.greenDeep);
        celEllipse(cx, cy + 4, 12, 4, C.red, C.redShade);
        // X eyes
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

      let stretch = 1;
      if (this.hopTimer > 0) {
        stretch = 1 + 0.2 * Math.sin((this.hopTimer / 8) * Math.PI);
      }
      const bodyW = 13 * (2.05 - stretch * 0.15);
      const bodyH = 11 * stretch;

      // Shadow
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = C.ink;
      ctx.beginPath();
      ctx.ellipse(cx, cy + bodyH + 6, bodyW * 0.9, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Legs (behind)
      if (this.facing === 0 || this.facing === 2) {
        celCircle(cx - 13, cy + 8, 7, C.greenShade, C.greenDeep);
        celCircle(cx + 13, cy + 8, 7, C.greenShade, C.greenDeep);
        celCircle(cx - 11, cy - 2, 6, C.green, C.greenShade);
        celCircle(cx + 11, cy - 2, 6, C.green, C.greenShade);
      } else {
        celCircle(cx - 2, cy - 12, 6, C.greenShade, C.greenDeep);
        celCircle(cx - 2, cy + 12, 6, C.greenShade, C.greenDeep);
        celCircle(cx + 8, cy - 10, 6, C.green, C.greenShade);
        celCircle(cx + 8, cy + 10, 6, C.green, C.greenShade);
      }

      // Body
      celEllipse(cx, cy + 2, bodyW, bodyH, C.green, C.greenShade);
      // Belly
      celEllipse(cx, cy + 5, bodyW * 0.45, bodyH * 0.4, C.belly, null);

      // Eye placements by facing
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
        celCircle(cx + ex, cy + ey, 8, C.green, C.greenShade);
        celCircle(cx + ex, cy + ey, 5, C.white, null);
        fillCircle(cx + ex + 1, cy + ey + 1, 2.4, C.ink);
        fillCircle(cx + ex + 2, cy + ey, 0.9, C.white);
      }

      // Smile
      setInk(2.5);
      ctx.beginPath();
      if (this.facing === 0) {
        ctx.arc(cx, cy + 4, 6, 0.2, Math.PI - 0.2);
      } else if (this.facing === 2) {
        ctx.arc(cx, cy - 2, 6, Math.PI + 0.2, -0.2);
      } else {
        ctx.arc(cx + (this.facing === 1 ? 2 : -2), cy + 4, 5, 0.15, Math.PI - 0.15);
      }
      ctx.stroke();

      // Blush
      ctx.globalAlpha = 0.45;
      fillCircle(cx - bodyW * 0.7, cy + 2, 3.5, C.pink);
      fillCircle(cx + bodyW * 0.7, cy + 2, 3.5, C.pink);
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
  let lives = 5;
  let score = 0;
  let level = 1;
  let homes = [false, false, false, false, false];
  let farthestRow = 16;
  let message = "";
  let msgTimer = 0;
  let timeLeft = 45;
  let difficulty = 1;
  let pulse = 0;

  function maxTime() {
    return Math.max(25, 50 - level * 2);
  }

  function spawnCars() {
    const list = [];
    for (const lane of ROAD_LANES) {
      const count = randInt(3, 5);
      const spacing = (WIDTH + 200) / count;
      for (let i = 0; i < count; i++) {
        const length = pick([1, 2, 2, 3]);
        const speed = (lane.speed + rand(-0.3, 0.3)) * difficulty;
        const car = new Car(lane.row, lane.dir, speed, pick(lane.colors), length);
        if (lane.dir > 0) car.x = -100 + i * spacing + rand(-20, 20);
        else car.x = WIDTH + 50 - i * spacing + rand(-20, 20);
        list.push(car);
      }
    }
    return list;
  }

  function startLevel() {
    difficulty = 1 + (level - 1) * 0.18;
    cars = spawnCars();
    homes = [false, false, false, false, false];
    toad.reset();
    farthestRow = 16;
    timeLeft = maxTime();
  }

  function squashToad() {
    toad.alive = false;
    toad.squash = 40;
    lives--;
    message = "SPLAT!";
    msgTimer = 50;
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
    if (pad === null || homes[pad]) {
      squashToad();
      return;
    }
    homes[pad] = true;
    const bonus = 200 + Math.floor(timeLeft * 10);
    score += bonus;
    message = "SAFE! +" + bonus;
    msgTimer = 60;
    farthestRow = 16;
    if (homes.every(Boolean)) {
      score += 1000 * level;
      message = "LEVEL " + level + " CLEAR! +" + 1000 * level;
      msgTimer = 90;
      state = "levelclear";
    } else {
      toad.reset();
      timeLeft = maxTime();
    }
  }

  function tryStart() {
    if (state === "title") {
      lives = 5;
      score = 0;
      level = 1;
      startLevel();
      state = "play";
      message = "HOP TO IT!";
      msgTimer = 60;
    } else if (state === "gameover") {
      state = "title";
    } else if (state === "levelclear") {
      level++;
      startLevel();
      state = "play";
      message = "LEVEL " + level;
      msgTimer = 60;
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
      if (state === "play" || state === "levelclear") state = "title";
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
      if (state === "title" || state === "gameover" || state === "levelclear") {
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
    if (state === "title" || state === "gameover" || state === "levelclear") {
      tryStart();
    }
  });

  function drawSkyBand(y, h) {
    // Flat cel sky (hard bands, not smooth gradient)
    ctx.fillStyle = C.skyDeep;
    ctx.fillRect(0, y, WIDTH, h * 0.45);
    ctx.fillStyle = C.sky;
    ctx.fillRect(0, y + h * 0.45, WIDTH, h * 0.55);
  }

  function drawBackground() {
    // Top HUD strip as comic panel wood
    ctx.fillStyle = C.hud;
    ctx.fillRect(0, 0, WIDTH, TILE);
    // Decorative top pips
    for (let i = 0; i < 8; i++) {
      fillCircle(30 + i * 80, 12, 3, C.yellow);
      strokeCircle(30 + i * 80, 12, 3, 1.5);
    }

    for (let row = 1; row <= 16; row++) {
      const y = row * TILE;
      if (GOAL_ROWS.has(row)) {
        // Pond goal zone
        ctx.fillStyle = C.waterDeep;
        ctx.fillRect(0, y, WIDTH, TILE);
        ctx.fillStyle = C.water;
        ctx.fillRect(0, y + 6, WIDTH, TILE - 6);
        // Bold top outline
        setInk(3);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(WIDTH, y);
        ctx.stroke();

        for (let i = 0; i < 5; i++) {
          const padX = 40 + i * 120;
          const filled = homes[i];
          celRoundRect(
            padX,
            y + 5,
            64,
            TILE - 10,
            12,
            filled ? C.green : C.waterDeep,
            filled ? C.greenShade : C.water
          );
          // lilypad ring
          setInk(2.5);
          ctx.beginPath();
          ctx.ellipse(padX + 32, y + TILE / 2, 22, 10, 0, 0, Math.PI * 2);
          ctx.stroke();
          if (filled) {
            // Mini toad icon
            celCircle(padX + 32, y + TILE / 2 - 2, 9, C.green, C.greenShade);
            celCircle(padX + 27, y + TILE / 2 - 6, 4, C.white, null);
            celCircle(padX + 37, y + TILE / 2 - 6, 4, C.white, null);
            fillCircle(padX + 28, y + TILE / 2 - 5, 1.5, C.ink);
            fillCircle(padX + 38, y + TILE / 2 - 5, 1.5, C.ink);
          } else {
            // Star marker empty pad
            ctx.fillStyle = C.yellow;
            ctx.font = "bold 16px Nunito, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("★", padX + 32, y + TILE / 2 + 6);
          }
        }
      } else if (MEDIAN_ROWS.has(row)) {
        ctx.fillStyle = C.grass;
        ctx.fillRect(0, y, WIDTH, TILE);
        // Cel shade strip
        ctx.fillStyle = C.grassShade;
        ctx.globalAlpha = 0.35;
        ctx.fillRect(0, y + TILE * 0.55, WIDTH, TILE * 0.45);
        ctx.globalAlpha = 1;
        // Cartoon grass tufts
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
        // Tile grid bold
        setInk(2);
        for (let x = 0; x <= WIDTH; x += TILE) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + TILE);
          ctx.stroke();
        }
        // Yellow curb
        ctx.fillStyle = C.yellow;
        ctx.fillRect(0, y, WIDTH, 6);
        setInk(2.5);
        ctx.strokeRect(0, y, WIDTH, 6);
      } else if (ROAD_ROW_SET.has(row)) {
        ctx.fillStyle = C.road;
        ctx.fillRect(0, y, WIDTH, TILE);
        // Cel shade bottom of lane
        ctx.fillStyle = C.roadShade;
        ctx.globalAlpha = 0.35;
        ctx.fillRect(0, y + TILE * 0.65, WIDTH, TILE * 0.35);
        ctx.globalAlpha = 1;
        // Dashed yellow center-ish line
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

    // Bottom HUD wood panel
    ctx.fillStyle = C.hud;
    ctx.fillRect(0, 17 * TILE, WIDTH, HEIGHT - 17 * TILE);
  }

  function drawComicBalloon(text, x, y, fill) {
    ctx.font = "bold 18px Nunito, Trebuchet MS, sans-serif";
    const w = ctx.measureText(text).width + 28;
    const h = 36;
    celRoundRect(x - w / 2, y - h / 2, w, h, 14, fill || C.cream, null);
  }

  function drawTitle() {
    // Sky
    drawSkyBand(0, HEIGHT * 0.42);
    // Hills
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

    // Cel shade on hills
    ctx.fillStyle = C.grassShade;
    ctx.globalAlpha = 0.3;
    ctx.fillRect(0, HEIGHT * 0.55, WIDTH, HEIGHT * 0.45);
    ctx.globalAlpha = 1;

    drawCloud(40, 50, 1.1);
    drawCloud(480, 70, 0.9);
    drawCloud(280, 40, 0.7);

    // Freeway panel
    celRoundRect(40, HEIGHT / 2 - 50, WIDTH - 80, 110, 16, C.road, C.roadShade);
    // Lane dashes
    ctx.fillStyle = C.yellow;
    for (let x = 60; x < WIDTH - 60; x += 36) {
      ctx.fillRect(x, HEIGHT / 2 + 2, 20, 5);
      setInk(1.5);
      ctx.strokeRect(x, HEIGHT / 2 + 2, 20, 5);
    }

    // Sample cars
    const demo = [
      new Car(0, 1, 0, "#ff4b4b", 2),
      new Car(0, -1, 0, "#4d8fff", 2),
    ];
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

    // Big title toad
    const t = new Toad();
    // hijack draw position via temp override
    Object.defineProperty(t, "x", { get: () => WIDTH / 2 });
    Object.defineProperty(t, "y", { get: () => HEIGHT / 2 + 120 + Math.sin(pulse) * 8 });
    t.facing = 0;
    t.hopTimer = Math.floor((Math.sin(pulse) * 0.5 + 0.5) * 6);
    t.draw();

    // Title text with cartoon stroke
    ctx.textAlign = "center";
    ctx.font = "bold 52px Bangers, Impact, sans-serif";
    const title = "TOADZ CROSSER!";
    // ink outline passes
    ctx.lineWidth = 8;
    ctx.strokeStyle = C.ink;
    ctx.strokeText(title, WIDTH / 2, 100);
    ctx.fillStyle = C.green;
    ctx.fillText(title, WIDTH / 2, 100);
    // highlight
    ctx.fillStyle = C.belly;
    ctx.globalAlpha = 0.35;
    ctx.fillText(title, WIDTH / 2 - 1, 98);
    ctx.globalAlpha = 1;

    ctx.font = "bold 17px Nunito, sans-serif";
    drawComicBalloon("Help Toad hop the freeway!", WIDTH / 2, 145, C.cream);

    const tips = [
      "ARROWS / WASD  —  hop",
      "Fill all 5 goal pads up top",
      "Don't get flattened!",
      "",
      "ENTER / SPACE / TAP  —  start",
      "ESC  —  menu",
    ];
    tips.forEach((line, i) => {
      ctx.font = "bold 18px Nunito, sans-serif";
      ctx.lineWidth = 4;
      ctx.strokeStyle = C.ink;
      ctx.fillStyle = i >= 4 ? C.yellow : C.white;
      const ty = 430 + i * 28;
      if (line) {
        ctx.strokeText(line, WIDTH / 2, ty);
        ctx.fillText(line, WIDTH / 2, ty);
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

    ctx.font = "bold 16px Nunito, sans-serif";
    ctx.lineWidth = 3;
    ctx.fillStyle = C.white;
    ctx.strokeText("Score " + score, 220, 26);
    ctx.fillText("Score " + score, 220, 26);
    ctx.fillStyle = C.yellow;
    ctx.strokeText("Lv " + level, 370, 26);
    ctx.fillText("Lv " + level, 370, 26);

    for (let i = 0; i < lives; i++) {
      celCircle(490 + i * 24, 20, 9, C.green, C.greenShade);
      fillCircle(487 + i * 24, 17, 2.5, C.white);
      fillCircle(493 + i * 24, 17, 2.5, C.white);
      fillCircle(488 + i * 24, 18, 1, C.ink);
      fillCircle(494 + i * 24, 18, 1, C.ink);
    }

    // Timer bar — cartoon battery
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
    ctx.strokeText("Arrows/WASD hop  ·  ESC menu", WIDTH - 22, barY + 38);
    ctx.fillText("Arrows/WASD hop  ·  ESC menu", WIDTH - 22, barY + 38);
    ctx.textAlign = "left";

    if (msgTimer > 0 && message) {
      ctx.textAlign = "center";
      ctx.font = "bold 36px Bangers, Impact, sans-serif";
      ctx.lineWidth = 8;
      ctx.strokeStyle = C.ink;
      ctx.fillStyle = C.yellow;
      ctx.strokeText(message, WIDTH / 2, HEIGHT / 2);
      ctx.fillText(message, WIDTH / 2, HEIGHT / 2);
      ctx.textAlign = "left";
    }
  }

  function drawOverlay(kind) {
    ctx.fillStyle = kind === "win" ? "rgba(40,120,40,0.55)" : "rgba(120,20,20,0.55)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Comic card
    celRoundRect(WIDTH / 2 - 200, HEIGHT / 2 - 80, 400, 160, 20, C.cream, null);

    ctx.textAlign = "center";
    ctx.font = "bold 40px Bangers, Impact, sans-serif";
    ctx.lineWidth = 6;
    ctx.strokeStyle = C.ink;
    if (kind === "win") {
      ctx.fillStyle = C.green;
      ctx.strokeText("LEVEL " + level + " CLEAR!", WIDTH / 2, HEIGHT / 2 - 15);
      ctx.fillText("LEVEL " + level + " CLEAR!", WIDTH / 2, HEIGHT / 2 - 15);
      ctx.font = "bold 16px Nunito, sans-serif";
      ctx.fillStyle = C.ink;
      ctx.fillText("ENTER / SPACE / TAP — next level", WIDTH / 2, HEIGHT / 2 + 30);
    } else {
      ctx.fillStyle = C.red;
      ctx.strokeText("GAME OVER", WIDTH / 2, HEIGHT / 2 - 25);
      ctx.fillText("GAME OVER", WIDTH / 2, HEIGHT / 2 - 25);
      ctx.font = "bold 18px Nunito, sans-serif";
      ctx.fillStyle = C.ink;
      ctx.fillText("Final Score: " + score, WIDTH / 2, HEIGHT / 2 + 15);
      ctx.fillStyle = C.blueShade;
      ctx.fillText("ENTER / SPACE / TAP — title", WIDTH / 2, HEIGHT / 2 + 45);
    }
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
    }

    drawBackground();
    for (const car of cars) car.draw();
    toad.draw();
    drawHud();

    if (state === "levelclear") drawOverlay("win");
    if (state === "gameover") drawOverlay("lose");

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
