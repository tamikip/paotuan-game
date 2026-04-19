import Phaser from "phaser";
import "./style.css";

const app = document.getElementById("app");
app.innerHTML = `
  <div class="game-shell menu-mode" id="game-shell">
    <div id="game-root"></div>
    <div class="vignette-layer" aria-hidden="true"></div>
    <div class="grain-layer" aria-hidden="true"></div>
    <div class="center-toast hidden" id="hud-center-toast"></div>
    <div class="mobile-controls hidden" id="mobile-controls">
      <div class="joystick" id="mobile-joystick">
        <div class="joystick__base"></div>
        <div class="joystick__stick" id="mobile-joystick-stick"></div>
      </div>
      <div class="mobile-actions">
        <button class="mobile-btn" id="mobile-interact" type="button">交互</button>
        <button class="mobile-btn" id="mobile-inspect" type="button">查</button>
        <button class="mobile-btn" id="mobile-scan" type="button">检</button>
        <button class="mobile-btn" id="mobile-quarantine" type="button">隔</button>
        <button class="mobile-btn mobile-btn--wide" id="mobile-phase" type="button">阶段</button>
      </div>
    </div>
    <section class="main-menu" id="main-menu">
      <div class="main-menu__panel">
        <p class="main-menu__eyebrow">2D MVP</p>
        <h1>灰雾公寓</h1>
        <p class="main-menu__desc">灰雾封锁整栋公寓，有人还是人，有人已经不是。先从主菜单进入，再在不完整信息里决定要信谁。</p>
        <div class="main-menu__meta">
          <span>沉浸式 2D</span>
          <span>鼠标朝向视野</span>
          <span>昼夜疑云</span>
        </div>
        <button class="main-menu__start" id="menu-start-btn" type="button">开始游戏</button>
        <p class="main-menu__hint">WASD 移动 · 鼠标控制手电朝向 · E 交互</p>
      </div>
    </section>
    <div class="hud">
      <div class="hud-top">
        <section class="panel cast-panel" id="hud-cast-panel">
          <div class="panel-title-row">
            <h2 id="hud-cast-title">交互中</h2>
            <span id="hud-cast-time">0.0s</span>
          </div>
          <div class="cast-meter"><i id="hud-cast-fill"></i></div>
        </section>
        <section class="panel status-panel">
          <div class="status-grid">
            <div><span>天数</span><strong id="hud-day">1</strong><small>灰雾还在加厚</small></div>
            <div><span>阶段</span><strong id="hud-phase">白天</strong><small id="hud-timer">90s</small></div>
            <div><span>当前位置</span><strong id="hud-room">门厅</strong><small id="hud-objective">先搜零件</small></div>
          </div>
        </section>
        <section class="panel side-panel">
          <div class="minimap-wrap">
            <div class="panel-title-row">
              <h2>小地图</h2>
              <span id="hud-floor">公寓一层</span>
            </div>
            <canvas id="hud-minimap" width="220" height="220"></canvas>
          </div>
          <div class="task-wrap">
            <div class="panel-title-row">
              <h2>任务面板</h2>
              <span id="hud-task-progress">0 / 4</span>
            </div>
            <div id="hud-tasks" class="task-list"></div>
          </div>
        </section>
      </div>
    </div>
  </div>
`;

const gameShell = document.getElementById("game-shell");
const mainMenu = document.getElementById("main-menu");
const startButton = document.getElementById("menu-start-btn");
const mobileControls = document.getElementById("mobile-controls");
const joystick = document.getElementById("mobile-joystick");
const joystickStick = document.getElementById("mobile-joystick-stick");
const isTouchDevice = window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;

const hud = {
  centerToast: document.getElementById("hud-center-toast"),
  castPanel: document.getElementById("hud-cast-panel"),
  castTitle: document.getElementById("hud-cast-title"),
  castTime: document.getElementById("hud-cast-time"),
  castFill: document.getElementById("hud-cast-fill"),
  day: document.getElementById("hud-day"),
  phase: document.getElementById("hud-phase"),
  timer: document.getElementById("hud-timer"),
  room: document.getElementById("hud-room"),
  objective: document.getElementById("hud-objective"),
  tasks: document.getElementById("hud-tasks"),
  taskProgress: document.getElementById("hud-task-progress"),
  minimap: document.getElementById("hud-minimap"),
  floor: document.getElementById("hud-floor"),
};

const mobileInput = {
  active: false,
  pointerId: null,
  startX: 0,
  startY: 0,
  x: 0,
  y: 0,
};

const WORLD = { width: 3200, height: 2200 };

const zones = [
  { id: "foyer", name: "门厅", x: 1320, y: 1770, w: 560, h: 270, hint: "公寓正门外只剩灰雾。真正的逃生路线藏在电梯井。", tint: 0x2a3848 },
  { id: "atrium", name: "中庭环廊", x: 1090, y: 880, w: 1020, h: 820, hint: "所有人都会经过这里，最适合观察谁在绕路。", tint: 0x1c2c32 },
  { id: "generator", name: "地下机房", x: 2440, y: 1350, w: 420, h: 320, hint: "发电机是全楼生命线，寄生体也会优先来这里做手脚。", tint: 0x3d3228 },
  { id: "elevator", name: "电梯井", x: 2470, y: 640, w: 350, h: 250, hint: "修完电梯后，这里就是唯一撤离点。", tint: 0x352a40 },
  { id: "infirmary", name: "医务室", x: 430, y: 650, w: 520, h: 270, hint: "被隔离的住户会被暂时关在这里。", tint: 0x223842 },
  { id: "records", name: "档案区", x: 400, y: 1240, w: 560, h: 340, hint: "终端与纸质记录都在这里，适合做半真半假的误导。", tint: 0x2e2840 },
  { id: "storage", name: "储藏层", x: 2330, y: 1810, w: 510, h: 250, hint: "零件、药包和检测试剂都可能藏在这层。", tint: 0x3a3528 },
  { id: "aptA", name: "A 区住户层", x: 850, y: 250, w: 460, h: 250, hint: "靠北侧的一整排住户房间。", tint: 0x263848 },
  { id: "aptB", name: "B 区住户层", x: 1380, y: 180, w: 450, h: 340, hint: "谁昨晚待在这里太久，通常都说不清理由。", tint: 0x243a4a },
  { id: "aptC", name: "C 区住户层", x: 1910, y: 250, w: 470, h: 250, hint: "离电梯近，但也更容易被寄生体埋伏。", tint: 0x2a3c4c },
  { id: "workshop", name: "维修工坊", x: 520, y: 1780, w: 520, h: 250, hint: "维修工常往返这里和机房。", tint: 0x3d362c },
];

const corridors = [
  { x: 1180, y: 955, w: 840, h: 74, color: 0x141a22 },
  { x: 1180, y: 1555, w: 840, h: 74, color: 0x141a22 },
  { x: 1180, y: 1025, w: 74, h: 530, color: 0x141a22 },
  { x: 1946, y: 1025, w: 74, h: 530, color: 0x141a22 },
  { x: 1528, y: 520, w: 82, h: 360, color: 0x161e28 },
  { x: 1490, y: 1640, w: 82, h: 140, color: 0x161e28 },
  { x: 960, y: 1360, w: 130, h: 82, color: 0x161e28 },
  { x: 2110, y: 1360, w: 330, h: 82, color: 0x161e28 },
  { x: 2110, y: 760, w: 370, h: 82, color: 0x161e28 },
  { x: 960, y: 1860, w: 360, h: 82, color: 0x161e28 },
  { x: 1880, y: 1890, w: 450, h: 82, color: 0x161e28 },
];

const walls = [
  { x: 0, y: 0, w: WORLD.width, h: 80 },
  { x: 0, y: WORLD.height - 80, w: WORLD.width, h: 80 },
  { x: 0, y: 0, w: 80, h: WORLD.height },
  { x: WORLD.width - 80, y: 0, w: 80, h: WORLD.height },
  { x: 1080, y: 900, w: 980, h: 50 },
  { x: 1080, y: 1680, w: 980, h: 50 },
  { x: 1080, y: 950, w: 50, h: 730 },
  { x: 2010, y: 950, w: 50, h: 730 },
  { x: 860, y: 520, w: 1580, h: 50 },
  { x: 500, y: 960, w: 50, h: 720 },
  { x: 2650, y: 1000, w: 50, h: 1080 },
  { x: 1040, y: 1810, w: 700, h: 50 },
  { x: 1740, y: 1740, w: 50, h: 390 },
  { x: 2140, y: 980, w: 50, h: 740 },
];

const interactions = [
  { id: "cache-a", zoneId: "storage", x: 2440, y: 1910, label: "打开储藏箱", kind: "cache" },
  { id: "cache-b", zoneId: "storage", x: 2550, y: 1885, label: "打开储藏箱", kind: "cache" },
  { id: "cache-c", zoneId: "storage", x: 2650, y: 1945, label: "打开储藏箱", kind: "cache" },
  { id: "cache-d", zoneId: "storage", x: 2740, y: 1898, label: "打开储藏箱", kind: "cache" },
  { id: "terminal", zoneId: "records", x: 820, y: 1430, label: "读取档案终端", kind: "terminal" },
  { id: "generator-console", zoneId: "generator", x: 2610, y: 1490, label: "修理发电机", kind: "generator" },
  { id: "medbox", zoneId: "infirmary", x: 800, y: 760, label: "取药包", kind: "medbox" },
  { id: "lift-panel", zoneId: "elevator", x: 2620, y: 750, label: "修复电梯", kind: "elevator" },
];

const keySpawnCandidates = {
  aptA: [
    { x: 945, y: 382 },
    { x: 1065, y: 378 },
    { x: 1188, y: 386 },
  ],
  aptB: [
    { x: 1495, y: 332 },
    { x: 1605, y: 346 },
    { x: 1718, y: 336 },
  ],
  aptC: [
    { x: 2015, y: 378 },
    { x: 2130, y: 372 },
    { x: 2248, y: 382 },
  ],
};

const bonusCacheCandidates = [
  { id: "bonus-cache-foyer", zoneId: "foyer", x: 1700, y: 1910, label: "打开散落锁箱", kind: "cache" },
  { id: "bonus-cache-records", zoneId: "records", x: 690, y: 1490, label: "打开散落锁箱", kind: "cache" },
  { id: "bonus-cache-workshop", zoneId: "workshop", x: 860, y: 1910, label: "打开散落锁箱", kind: "cache" },
  { id: "bonus-cache-atrium", zoneId: "atrium", x: 1880, y: 1470, label: "打开散落锁箱", kind: "cache" },
  { id: "bonus-cache-infirmary", zoneId: "infirmary", x: 760, y: 842, label: "打开散落锁箱", kind: "cache" },
];

const graph = {
  foyer: ["atrium", "workshop", "storage"],
  atrium: ["foyer", "generator", "records", "infirmary", "aptA", "aptB", "aptC", "elevator", "workshop"],
  generator: ["atrium", "storage"],
  elevator: ["atrium", "aptC"],
  infirmary: ["atrium", "records"],
  records: ["atrium", "infirmary", "workshop"],
  storage: ["generator", "foyer"],
  aptA: ["atrium", "aptB"],
  aptB: ["atrium", "aptA", "aptC"],
  aptC: ["atrium", "aptB", "elevator"],
  workshop: ["foyer", "atrium", "records"],
};

const npcTemplates = [
  { name: "许医生", role: "医生", home: "infirmary", speed: 120 },
  { name: "周师傅", role: "维修工", home: "workshop", speed: 126 },
  { name: "林记者", role: "记者", home: "records", speed: 124 },
  { name: "沈保安", role: "保安", home: "foyer", speed: 118 },
  { name: "陈住户", role: "普通人", home: "aptB", speed: 116 },
];

const taskDefinitions = [
  { id: "survey", title: "勘察公寓动线", detail: "走进中庭环廊，先熟悉整张图的通路。 " },
  { id: "parts", title: "搜集修理零件", detail: "去储藏层或其他高价值区域，补足零件。 " },
  { id: "power", title: "恢复基础供电", detail: "前往地下机房，把发电机修到 3/3。 " },
  { id: "lift", title: "修通逃生电梯", detail: "供电恢复后，前往电梯井完成 4 次维修。 " },
];

function zoneById(id) {
  return zones.find((zone) => zone.id === id);
}

function zoneAt(x, y) {
  return zones.find((zone) => x >= zone.x && x <= zone.x + zone.w && y >= zone.y && y <= zone.y + zone.h) ?? zoneById("atrium");
}

function zoneCenter(id) {
  const zone = zoneById(id);
  return { x: zone.x + zone.w / 2, y: zone.y + zone.h / 2 };
}

function sample(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function bindMobileButton(element, handler) {
  element.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    handler();
  });
}

function normalizeAngle(angle) {
  let normalized = angle;
  while (normalized <= -Math.PI) {
    normalized += Math.PI * 2;
  }
  while (normalized > Math.PI) {
    normalized -= Math.PI * 2;
  }
  return normalized;
}

function isAngleInsideCone(angle, center, halfWidth) {
  return Math.abs(normalizeAngle(angle - center)) <= halfWidth;
}

function raySegmentIntersection(origin, angle, segment) {
  const rayDx = Math.cos(angle);
  const rayDy = Math.sin(angle);
  const segDx = segment.b.x - segment.a.x;
  const segDy = segment.b.y - segment.a.y;
  const determinant = rayDx * segDy - rayDy * segDx;

  if (Math.abs(determinant) < 0.00001) {
    return null;
  }

  const diffX = segment.a.x - origin.x;
  const diffY = segment.a.y - origin.y;
  const distanceAlongRay = (diffX * segDy - diffY * segDx) / determinant;
  const distanceAlongSegment = (diffX * rayDy - diffY * rayDx) / determinant;

  if (distanceAlongRay < 0 || distanceAlongSegment < 0 || distanceAlongSegment > 1) {
    return null;
  }

  return {
    x: origin.x + rayDx * distanceAlongRay,
    y: origin.y + rayDy * distanceAlongRay,
    distance: distanceAlongRay,
  };
}

function shortestPath(from, to) {
  if (from === to) {
    return [to];
  }
  const queue = [[from]];
  const seen = new Set([from]);
  while (queue.length) {
    const path = queue.shift();
    const last = path[path.length - 1];
    for (const next of graph[last] ?? []) {
      if (seen.has(next)) {
        continue;
      }
      const nextPath = [...path, next];
      if (next === to) {
        return nextPath.slice(1);
      }
      seen.add(next);
      queue.push(nextPath);
    }
  }
  return [to];
}

function getTasks(state, currentZoneId) {
  return taskDefinitions.map((task) => {
    if (task.id === "survey") {
      return {
        ...task,
        done: currentZoneId === "atrium" || state.visitedAtrium,
        progress: state.visitedAtrium ? "已完成" : "前往中庭",
      };
    }
    if (task.id === "parts") {
      const openedChests = state.openedCaches.size;
      return {
        ...task,
        done: state.resources.parts >= 2 || state.progress.generator > 0 || state.progress.elevator > 0,
        progress: `零件 ${state.resources.parts} · 钥匙 ${state.resources.keys} · 箱 ${openedChests}/4`,
      };
    }
    if (task.id === "power") {
      return {
        ...task,
        done: state.progress.generator >= 3,
        progress: `${state.progress.generator}/3`,
      };
    }
    return {
      ...task,
      done: state.progress.elevator >= 4,
      progress: `${state.progress.elevator}/4`,
    };
  });
}

class GreyMistScene extends Phaser.Scene {
  constructor() {
    super("GreyMistScene");
    this.state = {
      day: 1,
      phase: "day",
      timer: 90,
      progress: { generator: 0, elevator: 0 },
      resources: { parts: 1, scans: 2, medkits: 1, keys: 0 },
      stress: 12,
      playerExposure: 0,
      mode: "playing",
      exploredZones: new Set(["foyer"]),
      facingAngle: Math.PI / 2,
      targetFacingAngle: Math.PI / 2,
      castAction: null,
      collectedKeys: new Set(),
      openedCaches: new Set(),
      prompt: "沿着中庭和住户层走，先熟悉地图。",
      banner: "发电机和电梯都修好前，公寓不会给你第二次机会。",
      logs: [],
      toastTimer: 0,
      traces: [],
      visitedAtrium: false,
      quarantineTargetId: null,
      quarantineUsedToday: false,
      securityRevealLeft: 1,
    };
  }

  preload() {
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });

    graphics.fillStyle(0xd8e2ea, 1);
    graphics.fillCircle(16, 16, 14);
    graphics.generateTexture("player-dot", 32, 32);
    graphics.clear();

    graphics.fillStyle(0x6a8fa4, 1);
    graphics.fillCircle(14, 14, 12);
    graphics.generateTexture("human-dot", 28, 28);
    graphics.clear();

    graphics.fillStyle(0xa83c3c, 1);
    graphics.fillCircle(14, 14, 12);
    graphics.generateTexture("parasite-dot", 28, 28);
    graphics.clear();

    graphics.fillStyle(0x1e252e, 1);
    graphics.fillRect(0, 0, 64, 64);
    graphics.lineStyle(2, 0x2a3542, 1);
    graphics.strokeRect(1, 1, 62, 62);
    graphics.generateTexture("wall", 64, 64);
    graphics.clear();

    graphics.fillStyle(0x8b7aa8, 1);
    graphics.fillCircle(8, 8, 7);
    graphics.generateTexture("trace", 16, 16);

    graphics.clear();
    graphics.fillStyle(0x4e3f2c, 1);
    graphics.fillRoundedRect(4, 10, 32, 22, 4);
    graphics.lineStyle(2, 0x261c14, 1);
    graphics.strokeRoundedRect(4, 10, 32, 22, 4);
    graphics.fillStyle(0xa98e60, 1);
    graphics.fillRect(16, 8, 8, 6);
    graphics.fillStyle(0xd2be88, 1);
    graphics.fillCircle(20, 20, 3);
    graphics.generateTexture("cache-crate", 40, 40);

    graphics.clear();
    graphics.lineStyle(3, 0xe0cc82, 1);
    graphics.strokeCircle(12, 18, 5);
    graphics.beginPath();
    graphics.moveTo(17, 18);
    graphics.lineTo(29, 18);
    graphics.lineTo(33, 14);
    graphics.moveTo(24, 18);
    graphics.lineTo(24, 28);
    graphics.moveTo(28, 18);
    graphics.lineTo(28, 24);
    graphics.strokePath();
    graphics.generateTexture("resident-key", 40, 40);
    graphics.destroy();
  }

  create() {
    this.createBackdrop();
    this.createMap();
    this.createActors();
    this.createInteractions();
    this.createAtmosphere();
    this.bindInput();
    this.addLog("灰雾公寓被封锁后，整栋楼只剩一条规则：先活下来。", "alert");
    this.addLog("观察住户的路线、痕迹和借口。寄生体会在夜里动手。", "ok");
    this.syncHud();
  }

  createBackdrop() {
    this.cameras.main.setBackgroundColor("#080a10");
    const backdrop = this.add.graphics();
    backdrop.fillGradientStyle(0x0c1018, 0x0c1018, 0x05060c, 0x05060c, 1);
    backdrop.fillRect(0, 0, WORLD.width, WORLD.height);

    const beams = this.add.graphics();
    beams.fillStyle(0x6a7a9a, 0.045);
    beams.fillEllipse(1610, 1120, 1350, 980);
    beams.fillStyle(0x4a5a78, 0.035);
    beams.fillEllipse(1610, 1120, 1840, 1420);

    const fog = this.add.graphics();
    fog.fillStyle(0x8890a8, 0.035);
    for (let index = 0; index < 180; index += 1) {
      const radius = Phaser.Math.Between(30, 130);
      fog.fillCircle(Phaser.Math.Between(0, WORLD.width), Phaser.Math.Between(0, WORLD.height), radius);
    }
  }

  createMap() {
    this.mapLayer = this.add.container(0, 0);
    const deco = this.add.graphics();
    deco.fillStyle(0x0e131a, 0.96);
    deco.fillRoundedRect(200, 120, 2800, 1960, 120);
    deco.lineStyle(4, 0x1e2836, 0.75);
    deco.strokeRoundedRect(200, 120, 2800, 1960, 120);
    corridors.forEach((corridor) => {
      deco.fillStyle(corridor.color, 1);
      deco.fillRoundedRect(corridor.x, corridor.y, corridor.w, corridor.h, 28);
    });
    deco.fillStyle(0x0c1016, 1);
    deco.fillEllipse(1600, 1290, 520, 360);
    deco.lineStyle(2, 0x2a3848, 0.88);
    deco.strokeEllipse(1600, 1290, 520, 360);
    deco.lineStyle(1, 0x3a4a5c, 0.38);
    deco.strokeEllipse(1600, 1290, 660, 500);
    this.mapLayer.add(deco);

    const floor = this.add.graphics();
    zones.forEach((zone) => {
      floor.fillStyle(zone.tint, 0.92);
      floor.fillRoundedRect(zone.x, zone.y, zone.w, zone.h, zone.id === "atrium" ? 56 : 30);
      floor.fillStyle(0x080c12, 0.28);
      floor.fillRoundedRect(zone.x + 12, zone.y + 12, zone.w - 24, zone.h - 24, zone.id === "atrium" ? 44 : 20);
      floor.lineStyle(3, 0x354558, 1);
      floor.strokeRoundedRect(zone.x, zone.y, zone.w, zone.h, 26);
      floor.lineStyle(1, 0xa8b4c8, 0.07);
      floor.strokeRoundedRect(zone.x + 18, zone.y + 18, zone.w - 36, zone.h - 36, zone.id === "atrium" ? 38 : 18);
      if (zone.id.startsWith("apt")) {
        for (let roomIndex = 0; roomIndex < 4; roomIndex += 1) {
          const roomWidth = (zone.w - 60) / 4;
          floor.lineStyle(2, 0x182028, 0.88);
          floor.strokeRoundedRect(zone.x + 18 + roomIndex * roomWidth, zone.y + 56, roomWidth - 8, zone.h - 76, 12);
        }
      }
      if (zone.id === "atrium") {
        floor.lineStyle(2, 0x6a7088, 0.2);
        floor.strokeEllipse(zone.x + zone.w / 2, zone.y + zone.h / 2, 300, 210);
        floor.strokeEllipse(zone.x + zone.w / 2, zone.y + zone.h / 2, 200, 130);
      }
    });
    this.mapLayer.add(floor);

    const labels = this.add.container();
    zones.forEach((zone) => {
      const title = this.add.text(zone.x + 26, zone.y + 18, zone.name, {
        fontFamily: "Microsoft YaHei UI",
        fontSize: zone.id === "atrium" ? "28px" : "22px",
        color: "#c8d2dc",
      });
      title.setStroke("#080a10", 4);
      title.setShadow(0, 2, "#000000", 6, true, true);
      title.setAlpha(0.92);
      labels.add(title);
    });
    this.mapLayer.add(labels);

    this.wallGroup = this.physics.add.staticGroup();
    walls.forEach((wall) => {
      const sprite = this.wallGroup.create(wall.x + wall.w / 2, wall.y + wall.h / 2, "wall");
      sprite.setDisplaySize(wall.w, wall.h).refreshBody().setAlpha(0.9);
    });
    this.visionSegments = [];
    this.visionVertices = [];
    walls.forEach((wall) => {
      const corners = [
        { x: wall.x, y: wall.y },
        { x: wall.x + wall.w, y: wall.y },
        { x: wall.x + wall.w, y: wall.y + wall.h },
        { x: wall.x, y: wall.y + wall.h },
      ];
      this.visionVertices.push(...corners);
      this.visionSegments.push(
        { a: corners[0], b: corners[1] },
        { a: corners[1], b: corners[2] },
        { a: corners[2], b: corners[3] },
        { a: corners[3], b: corners[0] }
      );
    });
  }

  createActors() {
    const start = zoneCenter("foyer");
    this.player = this.physics.add.sprite(start.x, start.y, "player-dot");
    this.player.setCircle(14).setCollideWorldBounds(true).setDrag(900, 900);
    this.player.setDepth(17);

    this.physics.world.setBounds(0, 0, WORLD.width, WORLD.height);
    this.physics.add.collider(this.player, this.wallGroup);

    this.npcs = npcTemplates.map((template, index) => {
      const center = zoneCenter(template.home);
      const sprite = this.add.sprite(center.x + index * 6, center.y + index * 8, "human-dot");
      sprite.setDepth(17);
      return {
        id: `npc-${index}`,
        sprite,
        name: template.name,
        role: template.role,
        speed: template.speed,
        home: template.home,
        zoneId: template.home,
        route: [],
        waypoint: null,
        suspicion: 18 + index * 8,
        note: "暂时没抓到硬证据。",
        hiddenRole: "human",
        status: "healthy",
        quarantine: false,
      };
    });

    this.parasiteNpc = sample(this.npcs);
    this.parasiteNpc.hiddenRole = "parasite";
    this.parasiteNpc.note = "总是在关键房间附近兜圈。";

    this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setZoom(0.9);
    this.cameras.main.roundPixels = true;
  }

  createInteractions() {
    const runtimeInteractions = [...interactions];
    Object.entries(keySpawnCandidates).forEach(([zoneId, candidates]) => {
      const pick = sample(candidates);
      runtimeInteractions.push({
        id: `key-${zoneId}`,
        zoneId,
        x: pick.x,
        y: pick.y,
        label: "搜居民钥匙",
        kind: "key",
      });
    });
    bonusCacheCandidates.forEach((spot) => {
      if (Math.random() < 0.28) {
        runtimeInteractions.push({ ...spot });
      }
    });

    this.interactionMarkers = runtimeInteractions.map((spot) => {
      const pulseColor = spot.kind === "key" ? 0xe0cc82 : spot.kind === "cache" ? 0x8f7551 : 0x8a9cb8;
      const pulse = this.add.circle(spot.x, spot.y, spot.kind === "cache" ? 22 : 18, pulseColor, 0.14).setDepth(16);
      const texture =
        spot.kind === "key" ? "resident-key" :
        spot.kind === "cache" ? "cache-crate" :
        null;
      const core = texture
        ? this.add.image(spot.x, spot.y, texture).setDepth(17)
        : this.add.circle(spot.x, spot.y, 7, 0xc8d6e8, 0.82).setDepth(17);
      if (spot.kind === "key") {
        core.setScale(0.72);
      }
      if (spot.kind === "cache") {
        core.setScale(0.88);
      }
      this.tweens.add({
        targets: pulse,
        alpha: { from: 0.1, to: 0.28 },
        scale: { from: 1, to: 1.12 },
        duration: 900,
        yoyo: true,
        repeat: -1,
      });
      return { ...spot, pulse, core, consumed: false };
    });
  }

  createAtmosphere() {
    this.traceGroup = this.add.group();
    this.nightOverlay = this.add.rectangle(0, 0, WORLD.width, WORLD.height, 0x2a3048, 0.12)
      .setOrigin(0)
      .setDepth(20);
    this.nightOverlay.setVisible(false);

    this.fogMaskGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    this.fogTexture = this.textures.createCanvas("fog-of-war", WORLD.width, WORLD.height);
    this.fogCanvas = this.fogTexture.getSourceImage();
    this.fogContext = this.fogCanvas.getContext("2d");
    this.fogSprite = this.add.image(0, 0, "fog-of-war")
      .setOrigin(0)
      .setDepth(18)
      .setScrollFactor(1, 1);
    this.exploredMask = this.add.graphics().setDepth(17);
    this.redrawExploredMask();
    this.refreshFog();
  }

  bindInput() {
    this.keys = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      shift: Phaser.Input.Keyboard.KeyCodes.SHIFT,
      interact: Phaser.Input.Keyboard.KeyCodes.E,
      inspect: Phaser.Input.Keyboard.KeyCodes.Q,
      scan: Phaser.Input.Keyboard.KeyCodes.F,
      quarantine: Phaser.Input.Keyboard.KeyCodes.G,
      phase: Phaser.Input.Keyboard.KeyCodes.SPACE,
    });

    this.input.keyboard.on("keydown-E", () => this.handleInteract());
    this.input.keyboard.on("keydown-Q", () => this.inspectArea());
    this.input.keyboard.on("keydown-F", () => this.scanNearbyNpc());
    this.input.keyboard.on("keydown-G", () => this.quarantineNearbyNpc());
    this.input.keyboard.on("keydown-SPACE", (event) => {
      event.preventDefault();
      this.advancePhase();
    });
  }

  startCast(action) {
    this.state.castAction = {
      ...action,
      elapsed: 0,
    };
  }

  cancelCast(reason = "") {
    if (!this.state.castAction) {
      return;
    }
    if (reason) {
      this.addLog(reason);
    }
    this.state.castAction = null;
  }

  handleInteract() {
    if (this.state.mode !== "playing") {
      return;
    }
    if (this.state.castAction) {
      this.cancelCast("你打断了当前交互。");
      this.syncHud();
      return;
    }
    const nearest = this.closestInteraction();
    if (!nearest) {
      this.state.prompt = "附近没有可交互装置。走近发光节点再试。";
      this.syncHud();
      return;
    }
    const castConfig = {
      cache: { label: "打开储藏箱", duration: 1.5, execute: (spot) => this.searchStorage(spot) },
      terminal: { label: "读取档案终端", duration: 1.8, execute: () => this.readTerminal() },
      generator: { label: "修理发电机", duration: 2.2, execute: () => this.repairGenerator() },
      medbox: { label: "取用药包", duration: 1.2, execute: () => this.useMedkit() },
      elevator: { label: "修复电梯", duration: 2.4, execute: () => this.repairElevator() },
      key: { label: "搜居民钥匙", duration: 1.1, execute: (spot) => this.collectKey(spot) },
    }[nearest.kind];
    if (!castConfig) {
      return;
    }
    const availability = this.canStartInteraction(nearest);
    if (!availability.ok) {
      if (availability.message) {
        this.addLog(availability.message, availability.tone ?? "");
      }
      this.syncHud();
      return;
    }
    this.startCast({
      label: castConfig.label,
      duration: castConfig.duration,
      spotId: nearest.id,
      execute: () => castConfig.execute(nearest),
    });
    this.syncHud();
  }

  closestInteraction() {
    return this.interactionMarkers.find((spot) => !spot.consumed && Phaser.Math.Distance.Between(this.player.x, this.player.y, spot.x, spot.y) < 90);
  }

  closestNpc() {
    return this.npcs.find((npc) => Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.sprite.x, npc.sprite.y) < 82);
  }

  canStartInteraction(spot) {
    switch (spot.kind) {
      case "cache":
        if (this.state.openedCaches.has(spot.id)) {
          return { ok: false, message: "这个箱子已经被打开过了。" };
        }
        if (this.state.resources.keys <= 0) {
          return { ok: false, message: "储藏箱上着锁。你需要先去居民区找钥匙。" };
        }
        return { ok: true };
      case "key":
        if (this.state.collectedKeys.has(spot.id)) {
          return { ok: false, message: "这里的钥匙已经被拿走了。" };
        }
        return { ok: true };
      case "terminal":
        if (this.state.securityRevealLeft <= 0) {
          return { ok: false, message: "档案终端今天已经被你翻完了，只剩灰白噪点。" };
        }
        return { ok: true };
      case "generator":
        if (this.state.progress.generator >= 3) {
          return { ok: false, message: "发电机已经满负荷运转。", tone: "ok" };
        }
        if (this.state.resources.parts <= 0) {
          return { ok: false, message: "你手里没有零件，修不了机房控制台。" };
        }
        return { ok: true };
      case "medbox":
        if (this.state.resources.medkits <= 0) {
          return { ok: false, message: "药包已经见底。" };
        }
        return { ok: true };
      case "elevator":
        if (this.state.progress.generator < 3) {
          return { ok: false, message: "电梯还没有供电，控制面板完全不响应。" };
        }
        if (this.state.progress.elevator >= 4) {
          return { ok: true };
        }
        if (this.state.resources.parts <= 0) {
          return { ok: false, message: "电梯还缺零件。你得再去搜。" };
        }
        return { ok: true };
      default:
        return { ok: false };
    }
  }

  addLog(text, tone = "") {
    this.state.logs.unshift({ text, tone });
    this.state.logs = this.state.logs.slice(0, 10);
    this.showCenterToast(text, tone);
  }

  showCenterToast(text, tone = "") {
    hud.centerToast.textContent = text;
    hud.centerToast.className = `center-toast ${tone} visible`.trim();
    this.state.toastTimer = 2;
  }

  createTrace(zoneId, text, tone = "alert") {
    const zone = zoneById(zoneId);
    const x = Phaser.Math.Between(zone.x + 40, zone.x + zone.w - 40);
    const y = Phaser.Math.Between(zone.y + 40, zone.y + zone.h - 40);
    const icon = this.add.image(x, y, "trace").setAlpha(0.9).setDepth(17);
    this.traceGroup.add(icon);
    this.state.traces.push({ zoneId, text, tone, ttl: 2, icon });
  }

  collectKey(spot) {
    if (this.state.collectedKeys.has(spot.id)) {
      return;
    }
    this.state.collectedKeys.add(spot.id);
    this.state.resources.keys += 1;
    spot.consumed = true;
    spot.pulse.setVisible(false);
    spot.core.setVisible(false);
    this.addLog(`你在【${zoneById(spot.zoneId).name}】摸到了一把居民钥匙。`, "ok");
    this.state.prompt = "钥匙是一次性的。开箱后就会消耗。";
  }

  searchStorage(spot) {
    if (this.state.openedCaches.has(spot.id)) {
      return;
    }
    this.state.openedCaches.add(spot.id);
    this.state.resources.keys = Math.max(0, this.state.resources.keys - 1);
    spot.consumed = true;
    spot.pulse.setVisible(false);
    spot.core.setVisible(false);
    const roll = Math.random();
    if (roll < 0.48) {
      this.state.resources.parts += 1;
      this.addLog("你从锁箱里翻出一组电梯零件。", "ok");
    } else if (roll < 0.78) {
      this.state.resources.scans += 1;
      this.addLog("箱底藏着一支备用检测试剂。", "ok");
    } else {
      this.state.resources.medkits += 1;
      this.addLog("你在箱子里找到了一包还能用的急救物资。", "ok");
    }
    this.createTrace("storage", "一只锁箱被撬开过，里面已经被彻底翻过。");
    this.state.prompt = "箱子和钥匙都是一次性的。开一个少一个。";
  }

  readTerminal() {
    if (this.state.securityRevealLeft <= 0) {
      this.addLog("档案终端今天已经被你翻完了，只剩灰白噪点。");
      this.state.prompt = "每天只能从终端榨出一次有价值的异常记录。";
      return;
    }
    this.state.securityRevealLeft -= 1;
    const latest = [...this.state.traces].sort((a, b) => b.ttl - a.ttl)[0];
    if (!latest) {
      this.addLog("终端里没有足够清晰的录像。昨夜似乎有人刻意避开了镜头。");
      return;
    }
    this.addLog(`终端回放指向【${zoneById(latest.zoneId).name}】：${latest.text}`, latest.tone);
    this.state.prompt = "终端给的是碎片，不是答案。它只能帮你缩小怀疑范围。";
  }

  repairGenerator() {
    if (this.state.progress.generator >= 3) {
      this.addLog("发电机已经满负荷运转。", "ok");
      return;
    }
    if (this.state.resources.parts <= 0) {
      this.addLog("你手里没有零件，修不了机房控制台。");
      return;
    }
    this.state.resources.parts -= 1;
    this.state.progress.generator += 1;
    this.addLog(`发电机修复进度推进到 ${this.state.progress.generator}/3。`, "ok");
    this.state.prompt = "灯光恢复得越多，寄生体越不喜欢藏在明处。";
    if (this.state.progress.generator >= 3) {
      this.addLog("整栋楼恢复基础供电。电梯井那边终于有了回应。", "ok");
    }
  }

  useMedkit() {
    if (this.state.resources.medkits <= 0) {
      this.addLog("药包已经见底。");
      return;
    }
    this.state.resources.medkits -= 1;
    this.state.playerExposure = Math.max(0, this.state.playerExposure - 1);
    this.state.stress = Math.max(0, this.state.stress - 18);
    this.addLog("你处理了擦伤和灰雾刺激，精神状态略微回稳。", "ok");
  }

  repairElevator() {
    if (this.state.progress.generator < 3) {
      this.addLog("电梯还没有供电，控制面板完全不响应。");
      return;
    }
    if (this.state.progress.elevator >= 4) {
      this.escape();
      return;
    }
    if (this.state.resources.parts <= 0) {
      this.addLog("电梯还缺零件。你得再去搜。");
      return;
    }
    this.state.resources.parts -= 1;
    this.state.progress.elevator += 1;
    this.addLog(`你修通了一组升降控制线。电梯进度 ${this.state.progress.elevator}/4。`, "ok");
    if (this.state.progress.elevator >= 4) {
      this.state.prompt = "电梯可用了。回到控制面板再按一次，就能尝试撤离。";
    }
  }

  inspectArea() {
    this.cancelCast("检查房间打断了交互。");
    const zone = zoneAt(this.player.x, this.player.y);
    const traces = this.state.traces.filter((entry) => entry.zoneId === zone.id);
    if (!traces.length) {
      this.addLog(`你在【${zone.name}】没找到明确物证，只有越来越重的灰味。`);
      this.state.prompt = "没证据不等于没问题。看看谁总是恰好不在场。";
      this.syncHud();
      return;
    }
    const trace = sample(traces);
    this.addLog(`你在【${zone.name}】发现痕迹：${trace.text}`, trace.tone);
    this.state.prompt = "痕迹只告诉你“这里发生过事”，不会直接写出凶手。";
    this.syncHud();
  }

  scanNearbyNpc() {
    this.cancelCast("检测动作打断了交互。");
    const npc = this.closestNpc();
    if (!npc) {
      this.state.prompt = "靠近住户后才能检测。";
      this.syncHud();
      return;
    }
    if (this.state.resources.scans <= 0) {
      this.addLog("检测试剂已经用完。");
      return;
    }
    this.state.resources.scans -= 1;
    if (npc.hiddenRole === "parasite" || npc.status === "infected") {
      npc.note = "试剂反应异常，伪装正在失效。";
      npc.suspicion = clamp(npc.suspicion + 28, 0, 100);
      npc.sprite.setTexture("parasite-dot");
      this.addLog(`检测结果异常：【${npc.name}】体内有寄生反应。`, "alert");
    } else {
      npc.note = "检测暂时正常。";
      npc.suspicion = clamp(npc.suspicion - 12, 0, 100);
      this.addLog(`检测正常：【${npc.name}】目前未见明显感染。`, "ok");
    }
    this.state.prompt = `你刚检测了 ${npc.name}。这会改变其他人的判断。`;
    this.syncHud();
  }

  quarantineNearbyNpc() {
    this.cancelCast("隔离动作打断了交互。");
    const npc = this.closestNpc();
    if (!npc) {
      this.state.prompt = "先靠近目标住户，再决定要不要隔离。";
      this.syncHud();
      return;
    }
    if (this.state.quarantineUsedToday) {
      this.addLog("今天已经隔离过一人，再乱关只会把局势搞炸。");
      return;
    }
    this.state.quarantineUsedToday = true;
    this.state.quarantineTargetId = npc.id;
    npc.quarantine = true;
    npc.zoneId = "infirmary";
    npc.route = [];
    npc.waypoint = zoneCenter("infirmary");
    npc.note = "被临时关进了医务室。";
    this.addLog(`你强行把【${npc.name}】押进医务室，今晚它无法自由行动。`, npc.hiddenRole === "parasite" ? "ok" : "");
    this.state.prompt = "隔离只是拖时间，不是处决。用错对象的代价很高。";
    this.syncHud();
  }

  escape() {
    this.state.mode = "won";
    this.state.banner = "临时电梯启动。你带着仍未完全失控的幸存者冲出了灰雾公寓。";
    this.addLog("撤离成功。这个夜晚没有继续把所有人都吃干净。", "ok");
    this.cameras.main.shake(500, 0.004);
    this.syncHud();
  }

  startNight() {
    this.state.phase = "night";
    this.state.timer = 34;
    this.state.banner = "夜晚降临。真正的行动现在才开始。";
    this.state.prompt = "寄生体会优先对关键路线、关键房间和孤立目标动手。";
    this.nightOverlay.setVisible(true);
    this.tweens.add({
      targets: this.nightOverlay,
      alpha: 0.24,
      duration: 500,
    });
    this.addLog("夜里所有借口都会变得更可疑。", "alert");
  }

  startDay() {
    this.state.phase = "day";
    this.state.day += 1;
    this.state.timer = 90;
    this.state.securityRevealLeft = 1;
    this.state.quarantineUsedToday = false;
    this.state.banner = "白天开始。继续搜资源，查痕迹，决定该不该相信任何人。";
    this.state.prompt = "天亮后，昨夜的行为会以路线、物品和污痕的形式留下来。";
    this.nightOverlay.setVisible(false);
    this.state.traces = this.state.traces
      .map((trace) => ({ ...trace, ttl: trace.ttl - 1 }))
      .filter((trace) => {
        if (trace.ttl <= 0) {
          trace.icon.destroy();
          return false;
        }
        return true;
      });

    this.npcs.forEach((npc) => {
      if (npc.id === this.state.quarantineTargetId) {
        npc.quarantine = false;
        npc.note = "刚被放出医务室，状态很差。";
      }
    });
    this.state.quarantineTargetId = null;
    this.addMorningReport();
    this.evaluateOutcome();
  }

  addMorningReport() {
    const reportPool = [];
    reportPool.push(`有人声称昨晚在【${zoneById(this.parasiteNpc.zoneId).name}】附近看到过影子停留。`);
    if (this.state.playerExposure > 0) {
      reportPool.push("你醒来时喉咙发涩，像有灰雾钻进肺里。");
    }
    if (this.npcs.some((npc) => npc.status === "infected")) {
      reportPool.push("某个住户今天的脸色明显不对，像在压抑异化。");
    }
    this.addLog(sample(reportPool), "alert");
  }

  resolveNight() {
    const attackers = this.npcs.filter((npc) => (npc.hiddenRole === "parasite" || npc.status === "infected") && !npc.quarantine);
    attackers.forEach((npc) => {
      const candidates = this.npcs.filter((target) => target.id !== npc.id && !target.quarantine);
      const target = sample(candidates);
      if (!target) {
        return;
      }
      const targetZone = sample(["atrium", "records", "generator", target.zoneId]);
      npc.zoneId = targetZone;
      npc.waypoint = zoneCenter(targetZone);
      this.createTrace(targetZone, "墙边留下了一层发灰的黏质痕迹，像是什么活物蹭过去的。", "alert");
      this.createTrace(targetZone, "门把上有一点被人擦过的暗色血迹。", "alert");
      npc.suspicion = clamp(npc.suspicion + 16, 0, 100);
      if (Math.random() < 0.65 && target.hiddenRole !== "parasite") {
        target.status = "infected";
        target.note = "脸色发灰，像在极力压住什么。";
        target.suspicion = clamp(target.suspicion + 20, 0, 100);
      }
    });

    if (Math.random() < 0.45) {
      this.state.playerExposure += 1;
      this.state.stress += 14;
      this.addLog("夜里有什么东西在你的房门外停了太久。", "alert");
    }
  }

  evaluateOutcome() {
    const parasiteCount = this.npcs.filter((npc) => npc.hiddenRole === "parasite" || npc.status === "infected").length;
    const humanCount = 1 + this.npcs.filter((npc) => npc.hiddenRole === "human" && npc.status !== "infected").length;
    if (this.state.playerExposure >= 3) {
      this.state.mode = "lost";
      this.state.banner = "灰雾和寄生痕迹已经进入你的身体。你没能走出这栋楼。";
      this.addLog("你失败了。最后连自己是不是人都说不准。", "alert");
      return;
    }
    if (parasiteCount >= humanCount) {
      this.state.mode = "lost";
      this.state.banner = "寄生体数量反超，公寓内部秩序彻底瓦解。";
      this.addLog("你失败了。人类阵营已经守不住这层壳。", "alert");
      return;
    }
    if (this.state.day > 6) {
      this.state.mode = "lost";
      this.state.banner = "时间拖到尽头，灰雾吞掉了最后的撤离窗口。";
      this.addLog("你失败了。不是所有局都来得及推到真相。", "alert");
    }
  }

  advancePhase() {
    if (this.state.mode !== "playing") {
      return;
    }
    this.cancelCast("阶段推进打断了交互。");
    if (this.state.phase === "day") {
      this.startNight();
    } else {
      this.resolveNight();
      this.startDay();
    }
    this.syncHud();
  }

  updateNpc(npc, delta) {
    if (npc.quarantine) {
      npc.waypoint = zoneCenter("infirmary");
    }
    if (!npc.waypoint || Phaser.Math.Distance.Between(npc.sprite.x, npc.sprite.y, npc.waypoint.x, npc.waypoint.y) < 8) {
      if (!npc.route.length) {
        const destinations = zones.map((zone) => zone.id).filter((id) => id !== npc.zoneId && id !== this.state.quarantineTargetId);
        const nextZone = npc.quarantine ? "infirmary" : sample(destinations);
        npc.route = shortestPath(npc.zoneId, nextZone);
      }
      const nextZoneId = npc.quarantine ? "infirmary" : npc.route.shift();
      npc.zoneId = nextZoneId;
      npc.waypoint = zoneCenter(nextZoneId);
    }

    const angle = Phaser.Math.Angle.Between(npc.sprite.x, npc.sprite.y, npc.waypoint.x, npc.waypoint.y);
    npc.sprite.x += Math.cos(angle) * npc.speed * (delta / 1000);
    npc.sprite.y += Math.sin(angle) * npc.speed * (delta / 1000);
    npc.sprite.setTexture(npc.hiddenRole === "parasite" && npc.suspicion >= 80 ? "parasite-dot" : "human-dot");
  }

  syncHud() {
    const zone = zoneAt(this.player.x, this.player.y);
    if (zone.id === "atrium") {
      this.state.visitedAtrium = true;
    }
    this.state.exploredZones.add(zone.id);
    hud.day.textContent = `${this.state.day}`;
    hud.phase.textContent = this.state.phase === "day" ? "白天" : "夜晚";
    hud.timer.textContent = `${Math.ceil(this.state.timer)}s`;
    hud.room.textContent = zone.name;
    hud.objective.textContent = zone.hint.trim();
    const tasks = getTasks(this.state, zone.id);
    const completed = tasks.filter((task) => task.done).length;
    hud.taskProgress.textContent = `${completed} / ${tasks.length}`;
    hud.tasks.innerHTML = tasks
      .map((task) => `
        <div class="task-item ${task.done ? "done" : ""}">
          <div class="task-top">
            <strong>${task.title}</strong>
            <span>${task.progress}</span>
          </div>
          <p>${task.detail}</p>
        </div>
      `)
      .join("");
    hud.floor.textContent = this.state.phase === "day" ? "公寓一层" : "夜间封锁";
    const cast = this.state.castAction;
    hud.castPanel.classList.toggle("hidden", !cast);
    if (cast) {
      hud.castTitle.textContent = cast.label;
      hud.castTime.textContent = `${Math.max(0, cast.duration - cast.elapsed).toFixed(1)}s`;
      hud.castFill.style.width = `${clamp((cast.elapsed / cast.duration) * 100, 0, 100)}%`;
    } else {
      hud.castFill.style.width = "0%";
    }
    this.drawMiniMap(zone.id);
  }

  drawMiniMap(currentZoneId) {
    const canvas = hud.minimap;
    const context = canvas.getContext("2d");
    const pad = 12;
    const scaleX = (canvas.width - pad * 2) / WORLD.width;
    const scaleY = (canvas.height - pad * 2) / WORLD.height;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#0a0d14";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "rgba(120, 140, 168, 0.35)";
    context.lineWidth = 1;
    context.strokeRect(6.5, 6.5, canvas.width - 13, canvas.height - 13);

    corridors.forEach((corridor) => {
      const visible = zones.some((zone) =>
        this.state.exploredZones.has(zone.id) &&
        corridor.x < zone.x + zone.w &&
        corridor.x + corridor.w > zone.x &&
        corridor.y < zone.y + zone.h &&
        corridor.y + corridor.h > zone.y
      );
      context.fillStyle = visible ? "rgba(52, 62, 78, 0.5)" : "rgba(12, 16, 22, 0.94)";
      context.fillRect(pad + corridor.x * scaleX, pad + corridor.y * scaleY, corridor.w * scaleX, corridor.h * scaleY);
    });

    zones.forEach((zone) => {
      const x = pad + zone.x * scaleX;
      const y = pad + zone.y * scaleY;
      const w = zone.w * scaleX;
      const h = zone.h * scaleY;
      const explored = this.state.exploredZones.has(zone.id);
      context.fillStyle = !explored
        ? "rgba(10, 14, 20, 0.97)"
        : zone.id === currentZoneId
          ? "rgba(110, 128, 152, 0.72)"
          : "rgba(56, 72, 92, 0.58)";
      context.strokeStyle = !explored
        ? "rgba(255,255,255,0.04)"
        : zone.id === currentZoneId
          ? "rgba(200, 210, 228, 0.85)"
          : "rgba(255,255,255,0.1)";
      context.lineWidth = zone.id === currentZoneId && explored ? 2 : 1;
      context.beginPath();
      context.roundRect(x, y, w, h, 6);
      context.fill();
      context.stroke();
    });

    this.state.traces.forEach((trace) => {
      if (!this.state.exploredZones.has(trace.zoneId)) {
        return;
      }
      const zone = zoneById(trace.zoneId);
      const cx = pad + (zone.x + zone.w / 2) * scaleX;
      const cy = pad + (zone.y + zone.h / 2) * scaleY;
      context.fillStyle = "rgba(168, 64, 72, 0.92)";
      context.beginPath();
      context.arc(cx, cy, 3, 0, Math.PI * 2);
      context.fill();
    });

    this.npcs.forEach((npc) => {
      if (!this.state.exploredZones.has(npc.zoneId)) {
        return;
      }
      const x = pad + npc.sprite.x * scaleX;
      const y = pad + npc.sprite.y * scaleY;
      context.fillStyle = npc.hiddenRole === "parasite" && npc.suspicion >= 80 ? "#b84848" : "#6a8fa0";
      context.beginPath();
      context.arc(x, y, 2.5, 0, Math.PI * 2);
      context.fill();
    });

    context.fillStyle = "#d4dde8";
    context.beginPath();
    context.arc(pad + this.player.x * scaleX, pad + this.player.y * scaleY, 3.5, 0, Math.PI * 2);
    context.fill();
  }

  redrawExploredMask() {
    this.exploredMask.clear();
    this.state.exploredZones.forEach((zoneId) => {
      const zone = zoneById(zoneId);
      if (!zone) {
        return;
      }
      this.exploredMask.fillStyle(0x8896a8, 0.04);
      this.exploredMask.fillRoundedRect(zone.x + 8, zone.y + 8, zone.w - 16, zone.h - 16, zone.id === "atrium" ? 48 : 22);
    });
  }

  refreshFog() {
    const context = this.fogContext;
    context.clearRect(0, 0, WORLD.width, WORLD.height);
    context.fillStyle = "rgba(0,0,0,1)";
    context.fillRect(0, 0, WORLD.width, WORLD.height);
    const powerRestored = this.state.progress.generator >= 3;

    context.globalCompositeOperation = "destination-out";
    this.state.exploredZones.forEach((zoneId) => {
      const zone = zoneById(zoneId);
      if (!zone) {
        return;
      }
      context.fillStyle = powerRestored ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.16)";
      context.beginPath();
      context.roundRect(zone.x + 6, zone.y + 6, zone.w - 12, zone.h - 12, zone.id === "atrium" ? 48 : 22);
      context.fill();
    });

    const coneRadius = this.state.phase === "day"
      ? (powerRestored ? 590 : 520)
      : (powerRestored ? 360 : 310);
    const coneWidth = this.state.phase === "day"
      ? (powerRestored ? 0.9 : 0.78)
      : (powerRestored ? 0.56 : 0.48);
    const angle = this.state.facingAngle;
    const origin = { x: this.player.x, y: this.player.y };
    const epsilon = 0.0004;
    const candidateAngles = [];
    const arcSamples = this.state.phase === "day" ? 96 : 72;

    for (let index = 0; index <= arcSamples; index += 1) {
      const t = index / arcSamples;
      candidateAngles.push(angle - coneWidth + t * coneWidth * 2);
    }

    this.visionVertices.forEach((vertex) => {
      const distance = Phaser.Math.Distance.Between(origin.x, origin.y, vertex.x, vertex.y);
      if (distance > coneRadius + 40) {
        return;
      }
      const vertexAngle = Math.atan2(vertex.y - origin.y, vertex.x - origin.x);
      if (!isAngleInsideCone(vertexAngle, angle, coneWidth + 0.1)) {
        return;
      }
      candidateAngles.push(vertexAngle - epsilon, vertexAngle, vertexAngle + epsilon);
    });

    const points = candidateAngles
      .filter((candidate) => isAngleInsideCone(candidate, angle, coneWidth + 0.0005))
      .map((candidate) => {
        const fallback = {
          x: origin.x + Math.cos(candidate) * coneRadius,
          y: origin.y + Math.sin(candidate) * coneRadius,
          distance: coneRadius,
        };
        let hit = fallback;
        this.visionSegments.forEach((segment) => {
          const intersection = raySegmentIntersection(origin, candidate, segment);
          if (intersection && intersection.distance < hit.distance) {
            hit = intersection;
          }
        });
        return {
          x: hit.x,
          y: hit.y,
          angle: candidate,
          relativeAngle: normalizeAngle(candidate - angle),
        };
      })
      .sort((left, right) => left.relativeAngle - right.relativeAngle)
      .filter((point, index, list) => {
        if (index === 0) {
          return true;
        }
        const previous = list[index - 1];
        return Math.abs(point.relativeAngle - previous.relativeAngle) > 0.0001;
      });

    if (points.length >= 2) {
      const isDay = this.state.phase === "day";
      const coneGradient = context.createRadialGradient(
        origin.x,
        origin.y,
        10,
        origin.x,
        origin.y,
        coneRadius
      );
      coneGradient.addColorStop(0, isDay ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.98)");
      coneGradient.addColorStop(0.14, isDay ? "rgba(255,255,255,0.98)" : "rgba(255,255,255,0.9)");
      coneGradient.addColorStop(0.35, isDay
        ? (powerRestored ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.72)")
        : (powerRestored ? "rgba(255,255,255,0.68)" : "rgba(255,255,255,0.58)"));
      coneGradient.addColorStop(0.68, isDay
        ? (powerRestored ? "rgba(255,255,255,0.44)" : "rgba(255,255,255,0.34)")
        : (powerRestored ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.22)"));
      coneGradient.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = coneGradient;
      context.beginPath();
      context.moveTo(origin.x, origin.y);
      points.forEach((point) => {
        context.lineTo(point.x, point.y);
      });
      context.closePath();
      context.fill();

      const coreGradient = context.createRadialGradient(
        origin.x,
        origin.y,
        0,
        origin.x,
        origin.y,
        isDay ? (powerRestored ? 150 : 125) : (powerRestored ? 98 : 82)
      );
      coreGradient.addColorStop(0, "rgba(255,255,255,1)");
      coreGradient.addColorStop(0.45, isDay
        ? (powerRestored ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.68)")
        : (powerRestored ? "rgba(255,255,255,0.62)" : "rgba(255,255,255,0.52)"));
      coreGradient.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = coreGradient;
      context.beginPath();
      context.moveTo(origin.x, origin.y);
      points.forEach((point) => {
        context.lineTo(point.x, point.y);
      });
      context.closePath();
      context.fill();
    }

    context.globalCompositeOperation = "source-over";
    this.fogTexture.refresh();
  }

  canSeePoint(targetX, targetY) {
    const powerRestored = this.state.progress.generator >= 3;
    const coneRadius = this.state.phase === "day"
      ? (powerRestored ? 590 : 520)
      : (powerRestored ? 360 : 310);
    const coneWidth = this.state.phase === "day"
      ? (powerRestored ? 0.9 : 0.78)
      : (powerRestored ? 0.56 : 0.48);
    const origin = { x: this.player.x, y: this.player.y };
    const dx = targetX - origin.x;
    const dy = targetY - origin.y;
    const distance = Math.hypot(dx, dy);

    if (distance <= 1 || distance > coneRadius) {
      return false;
    }

    const angle = Math.atan2(dy, dx);
    if (!isAngleInsideCone(angle, this.state.facingAngle, coneWidth)) {
      return false;
    }

    let nearestBlock = Infinity;
    this.visionSegments.forEach((segment) => {
      const intersection = raySegmentIntersection(origin, angle, segment);
      if (intersection && intersection.distance < nearestBlock) {
        nearestBlock = intersection.distance;
      }
    });

    return distance < nearestBlock - 1;
  }

  update(_time, delta) {
    if (this.state.mode === "playing") {
      const speed = this.keys.shift.isDown ? 300 : 220;
      const vx = (this.keys.left.isDown ? -1 : 0) + (this.keys.right.isDown ? 1 : 0) + mobileInput.x;
      const vy = (this.keys.up.isDown ? -1 : 0) + (this.keys.down.isDown ? 1 : 0) + mobileInput.y;
      const vector = new Phaser.Math.Vector2(vx, vy).normalize().scale(speed);
      const pointerWorld = this.input.activePointer.positionToCamera(this.cameras.main);
      const pointerDx = pointerWorld.x - this.player.x;
      const pointerDy = pointerWorld.y - this.player.y;
      if (isTouchDevice && mobileInput.active && Math.hypot(mobileInput.x, mobileInput.y) > 0.08) {
        this.state.targetFacingAngle = Math.atan2(mobileInput.y, mobileInput.x);
      } else if (Math.hypot(pointerDx, pointerDy) > 4) {
        this.state.targetFacingAngle = Math.atan2(pointerDy, pointerDx);
      }
      const smoothing = this.keys.shift.isDown ? 0.12 : 0.2;
      this.state.facingAngle = Phaser.Math.Angle.RotateTo(
        this.state.facingAngle,
        this.state.targetFacingAngle,
        smoothing
      );
      this.player.setVelocity(vector.x, vector.y);
      if ((vx !== 0 || vy !== 0) && this.state.castAction) {
        this.cancelCast("移动打断了交互。");
      }
      this.state.timer -= delta / 1000;
      if (this.state.timer <= 0) {
        this.advancePhase();
      }
      this.npcs.forEach((npc) => this.updateNpc(npc, delta));
      this.npcs.forEach((npc) => {
        const visible = this.canSeePoint(npc.sprite.x, npc.sprite.y);
        npc.sprite.setVisible(visible);
      });
      this.interactionMarkers.forEach((spot) => {
        if (spot.consumed) {
          spot.pulse.setVisible(false);
          spot.core.setVisible(false);
          return;
        }
        const visible = this.canSeePoint(spot.x, spot.y);
        spot.pulse.setVisible(visible);
        spot.core.setVisible(visible);
      });
      this.state.traces.forEach((trace) => {
        trace.icon.setVisible(this.canSeePoint(trace.icon.x, trace.icon.y));
      });
      if (this.state.castAction) {
        const castSpot = this.interactionMarkers.find((spot) => spot.id === this.state.castAction.spotId);
        const stillInRange = castSpot && Phaser.Math.Distance.Between(this.player.x, this.player.y, castSpot.x, castSpot.y) < 96;
        if (!stillInRange) {
          this.cancelCast("离开交互范围，读条取消。");
        } else {
          this.state.castAction.elapsed += delta / 1000;
          if (this.state.castAction.elapsed >= this.state.castAction.duration) {
            const execute = this.state.castAction.execute;
            this.state.castAction = null;
            execute();
          }
        }
      }
      const currentZone = zoneAt(this.player.x, this.player.y);
      const exploredBefore = this.state.exploredZones.size;
      this.state.exploredZones.add(currentZone.id);
      if (this.state.exploredZones.size !== exploredBefore) {
        this.redrawExploredMask();
      }
      this.refreshFog();

      const nearest = this.closestInteraction();
      const nearestNpc = this.closestNpc();
      if (nearest) {
        this.state.prompt = `可交互：${nearest.label}`;
      } else if (nearestNpc) {
        this.state.prompt = `邻近住户：${nearestNpc.name}（${nearestNpc.note}）`;
      }
    } else {
      this.player.setVelocity(0, 0);
    }

    if (this.state.toastTimer > 0) {
      this.state.toastTimer = Math.max(0, this.state.toastTimer - delta / 1000);
      if (this.state.toastTimer < 0.35) {
        hud.centerToast.classList.remove("visible");
      }
      if (this.state.toastTimer === 0) {
        hud.centerToast.className = "center-toast hidden";
      }
    }

    this.syncHud();
  }
}

let game = null;

function startGame() {
  if (game) {
    return;
  }
  gameShell.classList.remove("menu-mode");
  mainMenu.classList.add("hidden");
  if (isTouchDevice) {
    mobileControls.classList.remove("hidden");
  }
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game-root",
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: "#080a10",
    physics: {
      default: "arcade",
      arcade: {
        debug: false,
      },
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [GreyMistScene],
  });
}

startButton.addEventListener("click", startGame);

if (isTouchDevice) {
  const joystickRadius = 46;
  const resetJoystick = () => {
    mobileInput.active = false;
    mobileInput.pointerId = null;
    mobileInput.x = 0;
    mobileInput.y = 0;
    joystickStick.style.transform = "translate(-50%, -50%)";
  };

  joystick.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    const rect = joystick.getBoundingClientRect();
    mobileInput.active = true;
    mobileInput.pointerId = event.pointerId;
    mobileInput.startX = rect.left + rect.width / 2;
    mobileInput.startY = rect.top + rect.height / 2;
    joystick.setPointerCapture(event.pointerId);
  });

  joystick.addEventListener("pointermove", (event) => {
    if (!mobileInput.active || event.pointerId !== mobileInput.pointerId) {
      return;
    }
    const dx = event.clientX - mobileInput.startX;
    const dy = event.clientY - mobileInput.startY;
    const distance = Math.hypot(dx, dy);
    const limited = distance > joystickRadius ? joystickRadius / distance : 1;
    const clampedX = dx * limited;
    const clampedY = dy * limited;
    mobileInput.x = clampedX / joystickRadius;
    mobileInput.y = clampedY / joystickRadius;
    joystickStick.style.transform = `translate(calc(-50% + ${clampedX}px), calc(-50% + ${clampedY}px))`;
  });

  ["pointerup", "pointercancel", "lostpointercapture"].forEach((eventName) => {
    joystick.addEventListener(eventName, (event) => {
      if (mobileInput.pointerId !== null && event.pointerId !== undefined && event.pointerId !== mobileInput.pointerId) {
        return;
      }
      resetJoystick();
    });
  });

  bindMobileButton(document.getElementById("mobile-interact"), () => game?.scene.keys.GreyMistScene?.handleInteract());
  bindMobileButton(document.getElementById("mobile-inspect"), () => game?.scene.keys.GreyMistScene?.inspectArea());
  bindMobileButton(document.getElementById("mobile-scan"), () => game?.scene.keys.GreyMistScene?.scanNearbyNpc());
  bindMobileButton(document.getElementById("mobile-quarantine"), () => game?.scene.keys.GreyMistScene?.quarantineNearbyNpc());
  bindMobileButton(document.getElementById("mobile-phase"), () => game?.scene.keys.GreyMistScene?.advancePhase());
}

window.addEventListener("resize", () => {
  if (game) {
    game.scale.resize(window.innerWidth, window.innerHeight);
  }
});
