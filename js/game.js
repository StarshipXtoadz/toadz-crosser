/**
 * Toadz Crosser! — browser port (HTML5 Canvas)
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

  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  const COLORS = {
    black: "#000000",
    white: "#ffffff",
    green: "#32c850",
    darkGreen: "#19822d",
    lime: "#78ff64",
    yellow: "#ffdc32",
    orange: "#ff9628",
    red: "#dc3232",
    blue: "#3c78dc",
    gray: "#46464b",
    darkGray: "#28282d",
    road: "#2d2d32",
    laneLine: "#dcc83c",
    sidewalk: "#5a5f55",
    grass: "#287837",
    safe: "#329646",
    hud: "#0f140f",
  };

  const GOAL_ROWS = new Set([1]);
  const MEDIAN_ROWS = new Set([8]);
  const START_ROWS = new Set([16]);

  const ROAD_LANES = [
    { row: 2, dir: 1, speed: 2.2, colors: ["#dc3232", "#3278dc", "#f0c828"] },
    { row: 3, dir: -1, speed: 2.8, colors: ["#28b45a", "#c850c8", "#ff8c28"] },
    { row: 4, dir: 1, speed: 3.4, colors: ["#f0f0f0", "#b42828", "#3c3cc8"] },
    { row: 5, dir: -1, speed: 2.5, colors: ["#ff6464", "#64c8ff", "#b4b432"] },
    { row: 6, dir: 1, speed: 3.8, colors: ["#ff5000", "#00b4a0", "#c83296"] },
    { row: 7, dir: -1, speed: 2.0, colors: ["#5a5adc", "#dc5a5a", "#5ac85a"] },
    { row: 9, dir: 1, speed: 3.0, colors: ["#ffc832", "#323232", "#0096c8"] },
    { row: 10, dir: -1, speed: 3.6, colors: ["#c80064", "#64ff64", "#ffb464"] },
    { row: 11, dir: 1, speed: 2.4, colors: ["#9696ff", "#ff6496", "#646464"] },
    { row: 12, dir: -1, speed: 4.0, colors: ["#ff3232", "#32ff32", "#3232ff"] },
    { row: 13, dir: 1, speed: 2.7, colors: ["#dcdc00", "#00c8dc", "#b464ff"] },
    { row: 14, dir: -1, speed: 3.2, colors: ["#ff7800", "#00ffb4", "#c8c8c8"] },
    { row: 15, dir: 1, speed: 2.1, colors: ["#782828", "#282878", "#287828"] },
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

  class Car {
    constructor(row, direction, speed, color, lengthTiles) {
      this.row = row;
      this.direction = direction;
      this.speed = speed;
      this.color = color;
      this.length = lengthTiles * TILE;
      this.height = Math.floor(TILE * 0.72);
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
      roundRect(ctx, r.x, r.y, r.w, r.h, 6, this.color, COLORS.black);
      const winW = Math.max(8, this.length / 5);
      const wx = this.direction > 0 ? r.x + r.w - winW - 8 : r.x + 8;
      roundRect(ctx, wx, r.y + 4, winW, r.h - 10, 3, "#78b4dc", null);
      ctx.fillStyle = COLORS.black;
      ctx.fillRect(r.x + 6, r.y + r.h - 3, 12, 6);
      ctx.fillRect(r.x + r.w - 18, r.y + r.h - 3, 12, 6);
      ctx.fillStyle = COLORS.yellow;
      if (this.direction > 0) {
        circle(ctx, r.x + r.w - 4, r.y + r.h / 2 - 4, 3);
        circle(ctx, r.x + r.w - 4, r.y + r.h / 2 + 4, 3);
      } else {
        circle(ctx, r.x + 4, r.y + r.h / 2 - 4, 3);
        circle(ctx, r.x + 4, r.y + r.h / 2 + 4, 3);
      }
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
      const s = 28;
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
        ellipse(ctx, cx, cy, 18, 7, COLORS.darkGreen);
        ellipse(ctx, cx, cy, 10, 4, COLORS.red);
        return;
      }

      let stretch = 1;
      if (this.hopTimer > 0) {
        stretch = 1 + 0.15 * Math.sin((this.hopTimer / 8) * Math.PI);
      }
      const bodyW = 22 * (2 - stretch);
      const bodyH = 18 * stretch;

      ctx.fillStyle = COLORS.darkGreen;
      if (this.facing === 0 || this.facing === 2) {
        circle(ctx, cx - 12, cy + 6, 6);
        circle(ctx, cx + 12, cy + 6, 6);
        circle(ctx, cx - 10, cy - 4, 5);
        circle(ctx, cx + 10, cy - 4, 5);
      } else {
        circle(ctx, cx - 4, cy - 10, 5);
        circle(ctx, cx - 4, cy + 10, 5);
        circle(ctx, cx + 6, cy - 10, 5);
        circle(ctx, cx + 6, cy + 10, 5);
      }

      ellipse(ctx, cx, cy, bodyW / 2, bodyH / 2, COLORS.green);
      ctx.strokeStyle = COLORS.darkGreen;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, bodyW / 2, bodyH / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ellipse(ctx, cx, cy + 2, bodyW / 4, bodyH / 4, COLORS.lime);

      const eyes = {
        0: [
          [-6, -8],
          [6, -8],
        ],
        1: [
          [6, -6],
          [8, 2],
        ],
        2: [
          [-6, 6],
          [6, 6],
        ],
        3: [
          [-8, -6],
          [-6, 2],
        ],
      }[this.facing];
      for (const [ex, ey] of eyes) {
        circle(ctx, cx + ex, cy + ey, 6, COLORS.green);
        circle(ctx, cx + ex, cy + ey, 3, COLORS.white);
        circle(ctx, cx + ex, cy + ey, 1, COLORS.black);
      }
    }
  }

  function circle(c, x, y, r, fill) {
    if (fill) c.fillStyle = fill;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
  }

  function ellipse(c, x, y, rx, ry, fill) {
    c.fillStyle = fill;
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    c.fill();
  }

  function roundRect(c, x, y, w, h, rad, fill, stroke) {
    c.beginPath();
    c.moveTo(x + rad, y);
    c.arcTo(x + w, y, x + w, y + h, rad);
    c.arcTo(x + w, y + h, x, y + h, rad);
    c.arcTo(x, y + h, x, y, rad);
    c.arcTo(x, y, x + w, y, rad);
    c.closePath();
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = 2;
      c.stroke();
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

  // Input
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

  function drawBackground() {
    ctx.fillStyle = COLORS.hud;
    ctx.fillRect(0, 0, WIDTH, TILE);

    for (let row = 1; row <= 16; row++) {
      const y = row * TILE;
      if (GOAL_ROWS.has(row)) {
        ctx.fillStyle = "#145a28";
        ctx.fillRect(0, y, WIDTH, TILE);
        for (let i = 0; i < 5; i++) {
          const padX = 40 + i * 120;
          const filled = homes[i];
          roundRect(
            ctx,
            padX,
            y + 4,
            64,
            TILE - 8,
            8,
            filled ? "#1ea03c" : "#0f4664",
            filled ? COLORS.lime : COLORS.yellow
          );
          if (filled) {
            circle(ctx, padX + 32, y + TILE / 2, 10, COLORS.green);
            circle(ctx, padX + 28, y + TILE / 2 - 3, 3, COLORS.white);
            circle(ctx, padX + 36, y + TILE / 2 - 3, 3, COLORS.white);
          }
        }
      } else if (MEDIAN_ROWS.has(row)) {
        ctx.fillStyle = COLORS.safe;
        ctx.fillRect(0, y, WIDTH, TILE);
        ctx.strokeStyle = "#3caa50";
        ctx.lineWidth = 2;
        for (let x = 0; x < WIDTH; x += 16) {
          ctx.beginPath();
          ctx.moveTo(x, y + 8);
          ctx.lineTo(x + 8, y + TILE - 8);
          ctx.stroke();
        }
      } else if (START_ROWS.has(row)) {
        ctx.fillStyle = COLORS.sidewalk;
        ctx.fillRect(0, y, WIDTH, TILE);
        ctx.strokeStyle = "#64695f";
        for (let x = 0; x < WIDTH; x += TILE) {
          ctx.strokeRect(x, y, TILE, TILE);
        }
        ctx.strokeStyle = COLORS.yellow;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, y + 2);
        ctx.lineTo(WIDTH, y + 2);
        ctx.stroke();
      } else if (ROAD_ROW_SET.has(row)) {
        ctx.fillStyle = COLORS.road;
        ctx.fillRect(0, y, WIDTH, TILE);
        ctx.fillStyle = COLORS.laneLine;
        for (let x = 0; x < WIDTH; x += 28) {
          ctx.fillRect(x, y + TILE - 3, 14, 2);
        }
      } else {
        ctx.fillStyle = COLORS.grass;
        ctx.fillRect(0, y, WIDTH, TILE);
      }
    }

    ctx.fillStyle = COLORS.hud;
    ctx.fillRect(0, 17 * TILE, WIDTH, HEIGHT - 17 * TILE);
  }

  function drawTitle() {
    ctx.fillStyle = "#14281e";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = COLORS.road;
    ctx.fillRect(0, HEIGHT / 2 - 40, WIDTH, 100);
    ctx.fillStyle = COLORS.laneLine;
    for (let x = 0; x < WIDTH; x += 40) {
      ctx.fillRect(x, HEIGHT / 2 + 5, 20, 4);
    }

    roundRect(ctx, 80, HEIGHT / 2 - 20, 70, 28, 5, COLORS.red, null);
    roundRect(ctx, 400, HEIGHT / 2 + 10, 90, 28, 5, COLORS.blue, null);

    const cx = WIDTH / 2;
    const cy = HEIGHT / 2 + 90 + Math.sin(pulse) * 6;
    ellipse(ctx, cx, cy, 28, 20, COLORS.green);
    circle(ctx, cx - 14, cy - 22, 12, COLORS.green);
    circle(ctx, cx + 14, cy - 22, 12, COLORS.green);
    circle(ctx, cx - 14, cy - 22, 5, COLORS.white);
    circle(ctx, cx + 14, cy - 22, 5, COLORS.white);
    circle(ctx, cx - 14, cy - 22, 2, COLORS.black);
    circle(ctx, cx + 14, cy - 22, 2, COLORS.black);

    ctx.textAlign = "center";
    ctx.font = "bold 44px Consolas, monospace";
    ctx.fillStyle = COLORS.darkGreen;
    ctx.fillText("TOADZ CROSSER!", WIDTH / 2 + 3, 123);
    ctx.fillStyle = COLORS.lime;
    ctx.fillText("TOADZ CROSSER!", WIDTH / 2, 120);

    ctx.font = "18px Consolas, monospace";
    ctx.fillStyle = COLORS.white;
    ctx.fillText("Help Toad hop across the multi-lane freeway!", WIDTH / 2, 170);

    const tips = [
      "ARROWS / WASD  —  hop",
      "Reach a goal pad at the top",
      "Fill all 5 pads to clear the level",
      "Don't get flattened!",
      "",
      "ENTER / SPACE / TAP  —  start",
      "ESC  —  menu",
    ];
    tips.forEach((line, i) => {
      ctx.fillStyle = i >= 5 ? COLORS.yellow : COLORS.white;
      ctx.fillText(line, WIDTH / 2, 400 + i * 26);
    });
  }

  function drawHud() {
    ctx.fillStyle = COLORS.hud;
    ctx.fillRect(0, 0, WIDTH, TILE);

    ctx.textAlign = "left";
    ctx.font = "18px Consolas, monospace";
    ctx.fillStyle = COLORS.lime;
    ctx.fillText("TOADZ CROSSER!", 10, 26);
    ctx.fillStyle = COLORS.white;
    ctx.fillText("Score " + score, 220, 26);
    ctx.fillStyle = COLORS.yellow;
    ctx.fillText("Lv " + level, 380, 26);

    for (let i = 0; i < lives; i++) {
      circle(ctx, 480 + i * 22, 20, 8, COLORS.green);
      circle(ctx, 477 + i * 22, 17, 2, COLORS.white);
      circle(ctx, 483 + i * 22, 17, 2, COLORS.white);
    }

    const barY = 17 * TILE + 8;
    ctx.fillStyle = COLORS.darkGray;
    ctx.fillRect(20, barY, WIDTH - 40, 16);
    const fill = Math.floor((WIDTH - 44) * (timeLeft / maxTime()));
    ctx.fillStyle =
      timeLeft > 15 ? COLORS.green : timeLeft > 7 ? COLORS.yellow : COLORS.red;
    ctx.fillRect(22, barY + 2, Math.max(0, fill), 12);

    ctx.fillStyle = COLORS.white;
    ctx.font = "14px Consolas, monospace";
    ctx.fillText("TIME", 24, barY + 36);
    ctx.fillStyle = "#969696";
    ctx.textAlign = "right";
    ctx.fillText("Arrows/WASD hop  |  ESC menu", WIDTH - 20, barY + 36);
    ctx.textAlign = "left";

    if (msgTimer > 0 && message) {
      ctx.textAlign = "center";
      ctx.font = "bold 32px Consolas, monospace";
      ctx.fillStyle = COLORS.yellow;
      ctx.fillText(message, WIDTH / 2, HEIGHT / 2);
      ctx.textAlign = "left";
    }
  }

  function drawOverlay(kind) {
    ctx.fillStyle = kind === "win" ? "rgba(0,40,0,0.55)" : "rgba(40,0,0,0.62)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.textAlign = "center";
    ctx.font = "bold 32px Consolas, monospace";
    if (kind === "win") {
      ctx.fillStyle = COLORS.lime;
      ctx.fillText("LEVEL " + level + " CLEAR!", WIDTH / 2, HEIGHT / 2 - 30);
      ctx.font = "18px Consolas, monospace";
      ctx.fillStyle = COLORS.white;
      ctx.fillText("ENTER / SPACE / TAP — next level", WIDTH / 2, HEIGHT / 2 + 15);
    } else {
      ctx.fillStyle = COLORS.red;
      ctx.fillText("GAME OVER", WIDTH / 2, HEIGHT / 2 - 40);
      ctx.font = "18px Consolas, monospace";
      ctx.fillStyle = COLORS.white;
      ctx.fillText("Final Score: " + score, WIDTH / 2, HEIGHT / 2 + 5);
      ctx.fillStyle = COLORS.yellow;
      ctx.fillText("ENTER / SPACE / TAP — title", WIDTH / 2, HEIGHT / 2 + 40);
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
