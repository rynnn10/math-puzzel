// --- CONFIG & STATE (VARIABEL GLOBAL) ---
// PENTING: Variabel ini harus dideklarasikan SEBELUM digunakan

// 1. Audio Background (BGM)
let bgmAudio = new Audio();
bgmAudio.src = "bgm.mp3";
bgmAudio.loop = true;
bgmAudio.volume = 0.5;

// 2. Profil User
let userProfile = {
  name: "Player",
  img: null, // Base64 string
  country: "",
  province: "",
};

// 3. Konfigurasi Game Utama
let GRID_SIZE = 5;
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

let gameState = {
  mode: "arcade",
  active: false,
  score: 0,
  level: 1,
  target: 0,
  selectedTiles: [],
  tiles: [],
  equationData: null,
  hints: 3,
  isResumed: false,
};

let playerName = "Player";
let bgmVolume = 0.5;
let sfxVolume = 1.0;

// Variabel untuk menyimpan volume sebelum di-mute
let prevBgmVol = 0.5;
let prevSfxVol = 1.0;

// Global variables gameplay
let selectedGridIndex = -1;
let pendingMode = null;
let currentGridLayout = [];
let crossBank = [];
let selectedBankIndex = -1;
let userState = [];
let timerInterval;
let timeLeft = 100;
let shuffleCount = 3;

// UI Elements
const els = {
  grid: document.getElementById("grid"),
  targetBox: document.getElementById("target-box"),
  eqBox: document.getElementById("equation-box"),
  crossInfo: document.getElementById("cross-info"),
  numpad: document.getElementById("numpad"),
  targetVal: document.getElementById("target-val"),
  currentSum: document.getElementById("current-sum"),
  score: document.getElementById("score-el"),
  mainMenu: document.getElementById("main-menu"),
  modal: document.getElementById("game-over-modal"),
  resumeModal: document.getElementById("resume-modal"),
  shuffleBtn: document.getElementById("shuffle-btn"),
  timerContainer: document.getElementById("timer-bar-container"),
  timerBar: document.getElementById("timer-bar"),
  levelInfo: document.getElementById("level-info"),
  hintBtn: document.getElementById("hint-btn"),
  alertModal: document.getElementById("alert-modal"), // Pastikan ini ada di sini
};

// --- FUNGSI BARU: UPDATE HIGH SCORE ---
function updateMainMenuHighScores() {
  const modes = ["arcade", "puzzle", "equation", "crossmath"];
  modes.forEach((mode) => {
    const savedScore = localStorage.getItem("mathMatrix_hs_" + mode) || 0;
    const el = document.getElementById("hs-" + mode);
    if (el) el.textContent = savedScore;
  });
}

// Update fungsi gameOver untuk simpan High Score baru
const originalGameOver = gameOver; // Simpan referensi lama jika perlu (atau langsung timpa)
// Timpa fungsi gameOver yang ada di bagian atas script.js
gameOver = function (msg) {
  gameState.active = false;
  clearInterval(timerInterval);

  // --- PERBAIKAN CROSSMATH: JANGAN HAPUS SAVE JIKA MENANG ---
  // Hanya hapus save jika Game Over (Kalah/Waktu Habis)
  // Jika "LEVEL COMPLETE" atau "PUZZLE CLEARED", save biarkan ada (berisi level selanjutnya)
  if (!msg.includes("COMPLETE") && !msg.includes("CLEARED")) {
    localStorage.removeItem("mathMatrix_save_" + gameState.mode);
  }
  // ---------------------------------------------------------

  // Cek & Simpan High Score
  const currentHS = parseInt(
    localStorage.getItem("mathMatrix_hs_" + gameState.mode) || 0
  );
  if (gameState.score > currentHS) {
    localStorage.setItem("mathMatrix_hs_" + gameState.mode, gameState.score);
    if (!msg.includes("COMPLETE") && !msg.includes("CLEARED")) {
      msg = "NEW HIGH SCORE!";
    }
  }

  document.getElementById("modal-title").textContent = msg;
  document.getElementById("modal-msg").textContent =
    "Final Score: " + gameState.score;
  els.modal.classList.add("show");

  if (
    msg.includes("COMPLETE") ||
    msg.includes("SCORE") ||
    msg.includes("CLEARED")
  )
    playSound("success");
  else playSound("error");

  updateMainMenuHighScores();
};

// --- FUNGSI POPUP ALERT ---
function showAlert(title, msg) {
  document.getElementById("alert-title").textContent = title;
  document.getElementById("alert-msg").textContent = msg;
  els.alertModal.classList.add("show");
}

function closeAlert() {
  els.alertModal.classList.remove("show");
}

// --- DATA & GENERATOR LEVEL CROSSMATH (AI LOGIC) ---

/**
 * AI GENERATOR CONFIGURATION
 * Membuat rantai persamaan yang saling terhubung (Snake Pattern)
 * agar selalu valid secara matematika.
 */
const CM_ROWS = 9;
const CM_COLS = 11;

// --- LOGIKA GENERATOR CROSSMATH (ABORT & RETRY SYSTEM) ---
function generateCrossmathLevel(level) {
  const difficulty = { maxNum: 10 + level * 5, allowMult: level > 3 };

  // Pattern Soal (Sama seperti sebelumnya)
  const patterns = [
    // A. CLASSIC SNAKE (Standard)
    [
      [1, 2, 3, 4, 5],
      [5, 16, 27, 38, 49],
      [45, 46, 47, 48, 49],
      [45, 56, 67, 78, 89],
      [89, 90, 91, 92, 93],
    ],

    // B. THE DNA (Double Helix)
    [
      [1, 12, 23, 34, 45],
      [5, 16, 27, 38, 49],
      [23, 24, 25, 26, 27],
      [45, 56, 67, 78, 89],
      [49, 60, 71, 82, 93],
      [67, 68, 69, 70, 71],
    ],

    // C. THE MATRIX (Sangat Padat - Kotak Penuh)
    // Pola ini mengisi hampir seluruh layar dengan persimpangan
    [
      [0, 1, 2, 3, 4], // Baris 1
      [22, 23, 24, 25, 26], // Baris 3
      [44, 45, 46, 47, 48], // Baris 5
      [66, 67, 68, 69, 70], // Baris 7
      [88, 89, 90, 91, 92], // Baris 9
      [0, 11, 22, 33, 44], // Kolom 1 Vertikal
      [4, 15, 26, 37, 48], // Kolom 5 Vertikal
      [44, 55, 66, 77, 88], // Lanjut Bawah Kiri
      [48, 59, 70, 81, 92], // Lanjut Bawah Kanan
      [2, 13, 24, 35, 46], // Tengah Atas
      [46, 57, 68, 79, 90], // Tengah Bawah
    ],

    // D. THE FORTRESS (Bingkai Ganda & Pusat)
    [
      [0, 1, 2, 3, 4], // Top Outer
      [0, 11, 22, 33, 44], // Left Outer
      [4, 15, 26, 37, 48], // Right Outer
      [44, 45, 46, 47, 48], // Bottom Outer
      [24, 25, 26, 27, 28], // Inner Horizontal (Salah index? Tidak, grid 11 cols. Center is ~Row 5)
      // Koreksi koordinat inner (Baris ke-3 dan ke-7)
      [24, 35, 46, 57, 68], // Vertical Center
      [44, 55, 66, 77, 88], // Left Leg
      [48, 59, 70, 81, 92], // Right Leg
      [88, 89, 90, 91, 92], // Bottom Floor
    ],

    // E. THE OCTOPUS (Pusat ke Segala Arah)
    [
      [46, 47, 48, 49, 50], // Pusat Horizontal
      [26, 37, 48, 59, 70], // Pusat Vertikal
      [0, 1, 2, 3, 4], // Sayap Kiri Atas
      [4, 15, 26], // Sambungan
      [8, 9, 10], // Sisa Kanan Atas (Hati2 range) -> Ganti ke aman:
      [94, 95, 96, 97, 98], // Kaki Kanan Bawah
      [70, 81, 92], // Sambungan Bawah
      [88, 89, 90, 91, 92], // Kaki Kiri Bawah
    ],
  ];

  let bestGrid = null;
  let success = false;
  let totalAttempts = 0;

  // LOOP RETRY: Jika level macet/salah, ulangi pembuatan dari awal (Maks 50x)
  while (!success && totalAttempts < 50) {
    totalAttempts++;

    // 1. Buat Grid Kosong Baru untuk percobaan ini
    let tempGrid = new Array(CM_ROWS * CM_COLS)
      .fill(null)
      .map(() => ({ type: "gap" }));

    const getValue = (idx) =>
      tempGrid[idx] && tempGrid[idx].val !== undefined
        ? tempGrid[idx].val
        : null;
    const setValue = (idx, val, type = "temp_val") => {
      if (idx < tempGrid.length) tempGrid[idx] = { type: type, val: val };
    };

    const selectedPattern =
      patterns[Math.floor(Math.random() * patterns.length)];
    let levelFailed = false;

    // 2. Loop setiap persamaan dalam pattern
    for (let indices of selectedPattern) {
      if (levelFailed) break;

      const idxA = indices[0];
      const idxOp = indices[1];
      const idxB = indices[2];
      const idxEq = indices[3];
      const idxRes = indices[4];

      // Ambil angka yang SUDAH ADA (Fixed) akibat persimpangan
      const fixedA = getValue(idxA);
      const fixedB = getValue(idxB);
      const fixedRes = getValue(idxRes);

      let valid = false;
      let subAttempts = 0;
      let A, B, res, op;
      let operators = ["+", "-"];
      if (difficulty.allowMult) operators.push("x");

      // 3. Solver: Mencari angka yang cocok (Maks 500x coba per persamaan)
      while (!valid && subAttempts < 500) {
        subAttempts++;
        op = operators[Math.floor(Math.random() * operators.length)];

        // --- LOGIKA SMART SOLVER ---
        if (fixedA !== null && fixedRes !== null) {
          // Cari B
          A = fixedA;
          res = fixedRes;
          if (op === "+") B = res - A;
          else if (op === "-") B = A - res;
          else if (op === "x") B = res / A;
        } else if (fixedA !== null && fixedB !== null) {
          // Cari Res
          A = fixedA;
          B = fixedB;
          if (op === "+") res = A + B;
          else if (op === "-") res = A - B;
          else if (op === "x") res = A * B;
        } else if (fixedB !== null && fixedRes !== null) {
          // Cari A
          B = fixedB;
          res = fixedRes;
          if (op === "+") A = res - B;
          else if (op === "-") A = res + B;
          else if (op === "x") A = res / B;
        } else if (fixedA !== null) {
          // A ada, cari B & Res
          A = fixedA;
          B = Math.floor(Math.random() * difficulty.maxNum) + 1;
          if (op === "+") res = A + B;
          else if (op === "-") res = A - B;
          else if (op === "x") res = A * B;
        } else if (fixedRes !== null) {
          // Res ada, cari A & B
          res = fixedRes;
          if (op === "+") {
            if (res <= 1) continue;
            A = Math.floor(Math.random() * (res - 1)) + 1;
            B = res - A;
          } else if (op === "-") {
            B = Math.floor(Math.random() * difficulty.maxNum) + 1;
            A = res + B;
          } else if (op === "x") {
            let factors = [];
            for (let k = 1; k <= res; k++) if (res % k === 0) factors.push(k);
            if (!factors.length) continue;
            A = factors[Math.floor(Math.random() * factors.length)];
            B = res / A;
          }
        } else {
          // Semua kosong
          A = Math.floor(Math.random() * difficulty.maxNum) + 1;
          B = Math.floor(Math.random() * difficulty.maxNum) + 1;
          if (op === "+") res = A + B;
          else if (op === "-") res = A - B;
          else if (op === "x") res = A * B;
        }

        // --- VALIDASI ---
        if (
          !Number.isInteger(A) ||
          !Number.isInteger(B) ||
          !Number.isInteger(res)
        )
          continue;
        if (A < 0 || B < 0 || res < 0) continue;
        if (res > difficulty.maxNum * 3) continue;

        // CEK TABRAKAN (CRUCIAL): Jangan menimpa angka yang sudah fix dengan nilai beda
        if (fixedA !== null && A !== fixedA) continue;
        if (fixedB !== null && B !== fixedB) continue;
        if (fixedRes !== null && res !== fixedRes) continue;

        valid = true;
      }

      // 4. Keputusan: Jika gagal menemukan kombinasi dalam 500x, BATALKAN LEVEL INI
      if (!valid) {
        levelFailed = true; // Tandai gagal
      } else {
        // Tulis ke tempGrid
        setValue(idxA, A);
        setValue(idxOp, op, "op");
        setValue(idxB, B);
        setValue(idxEq, "=", "op");
        setValue(idxRes, res);
      }
    } // End Loop Pattern

    // 5. Jika Level Berhasil dibuat (Tidak Failed), simpan dan keluar loop utama
    if (!levelFailed) {
      bestGrid = tempGrid;
      success = true;
    }
  } // End Loop Retry

  // Jika setelah 50x percobaan masih gagal (sangat mustahil), buat grid dummy aman
  if (!bestGrid) {
    console.log("Failed generate level, using fallback");
    bestGrid = new Array(CM_ROWS * CM_COLS)
      .fill(null)
      .map(() => ({ type: "gap" }));
    // Isi dummy 1+1=2 agar tidak crash
    bestGrid[1] = { type: "temp_val", val: 1 };
    bestGrid[2] = { type: "temp_val", val: "+" };
    bestGrid[3] = { type: "temp_val", val: 1 };
    bestGrid[4] = { type: "temp_val", val: "=" };
    bestGrid[5] = { type: "temp_val", val: 2 };
  }

  // Convert Grid ke Format Game
  return bestGrid.map((cell) => {
    if (cell.type === "temp_val") {
      return Math.random() > 0.6
        ? { type: "input", answer: cell.val }
        : { type: "fixed", val: cell.val };
    }
    return cell;
  });
}

// script.js (Tambahkan fungsi baru ini)

function addScore(amount) {
  gameState.score += amount;
  els.score.textContent = "SCORE: " + gameState.score;

  // Efek visual kecil pada teks skor (opsional)
  els.score.style.transform = "scale(1.2)";
  els.score.style.color = "#fff";
  setTimeout(() => {
    els.score.style.transform = "scale(1)";
    els.score.style.color = "var(--success)";
  }, 200);
}

// --- CORE FUNCTIONS ---

function startGame(mode) {
  pendingMode = mode;

  // 1. CEK SAVE DATA TERLEBIH DAHULU (TANPA LOADING SCREEN)
  const savedData = localStorage.getItem("mathMatrix_save_" + mode);

  if (savedData) {
    // Jika ada save, LANGSUNG tampilkan popup resume (Jangan munculkan loading dulu)
    els.resumeModal.classList.add("show");
  } else {
    // Jika tidak ada save, baru jalankan proses New Game dengan Loading
    startWithLoading(false);
  }
}

function startWithLoading(isResume) {
  // Tampilkan Loading Screen
  const loader = document.getElementById("loading-overlay");
  loader.classList.add("active");

  // Simulasi Loading 1.5 detik
  setTimeout(() => {
    loader.classList.remove("active");

    if (isResume) {
      loadGame(pendingMode);
    } else {
      initNewGame(pendingMode);
    }
  }, 1500);
}

function confirmResume() {
  els.resumeModal.classList.remove("show");
  // User pilih lanjut, SEKARANG baru munculkan loading
  startWithLoading(true);
}

// [UPDATE FUNGSI confirmNewGame]
function confirmNewGame() {
  els.resumeModal.classList.remove("show");
  localStorage.removeItem("mathMatrix_save_" + pendingMode);
  // User pilih main baru, SEKARANG baru munculkan loading
  startWithLoading(false);
}

function initNewGame(mode, keepState = false) {
  // Jika keepState true (Lanjut Level), level dan score tidak di-reset
  if (!keepState) {
    gameState = {
      mode: mode,
      active: true,
      score: 0,
      level: 1, // Reset level hanya jika game baru
      target: 0,
      hints: 3,
      isResumed: false,
      selectedTiles: [],
      tiles: [],
    };
  } else {
    // Hanya reset state papan, tapi pertahankan level & score
    gameState.active = true;
    gameState.selectedTiles = [];
    gameState.tiles = [];
    gameState.isResumed = false;
  }

  setupUIForGame(mode);
  launchMode(mode);
}

function launchMode(mode) {
  if (mode === "arcade") initArcade();
  else if (mode === "puzzle") initPuzzle();
  else if (mode === "equation") initEquation();
  else if (mode === "crossmath") initCrossmath();
}

function setupUIForGame(mode) {
  els.mainMenu.classList.add("slide-up");
  document.querySelector(".game-container").classList.add("active");

  const mainControls = document.querySelector(".main-header-controls");
  if (mainControls) mainControls.style.display = "none";

  els.modal.classList.remove("show");
  els.resumeModal.classList.remove("show");

  // Reset UI
  els.grid.className = "grid";
  els.grid.innerHTML = "";

  // GUNAKAN PENGECEKAN (IF) SEBELUM MENGUBAH STYLE
  if (els.hintBtn) els.hintBtn.style.display = "none";
  if (els.targetBox) els.targetBox.classList.remove("active");
  if (els.eqBox) els.eqBox.classList.remove("active");
  if (els.crossInfo) els.crossInfo.style.display = "none";
  if (els.numpad) els.numpad.classList.remove("active");

  // Ini yang menyebabkan error sebelumnya
  if (els.timerContainer) els.timerContainer.style.display = "none";
  if (els.shuffleBtn) els.shuffleBtn.style.display = "none";

  if (els.score) els.score.textContent = "SCORE: " + gameState.score;
}

function goToMenu() {
  const currentHS = parseInt(
    localStorage.getItem("mathMatrix_hs_" + gameState.mode) || 0
  );
  if (gameState.score > currentHS) {
    localStorage.setItem("mathMatrix_hs_" + gameState.mode, gameState.score);
  }

  gameState.active = false;
  clearInterval(timerInterval);

  els.mainMenu.classList.remove("slide-up");
  document.querySelector(".game-container").classList.remove("active");

  // PERBAIKAN EROR: Munculkan kembali tombol setting dengan aman
  const mainControls = document.querySelector(".main-header-controls");
  if (mainControls) mainControls.style.display = "flex";

  els.modal.classList.remove("show");
  els.resumeModal.classList.remove("show");
  document.getElementById("settings-modal").classList.remove("show");

  updateMainMenuHighScores();
}

function saveGameState() {
  if (!gameState.active) return;

  const tilesData = (gameState.tiles || []).map((t) => ({
    val: t.val,
    active: t.active,
    idx: t.idx,
  }));

  const data = {
    gameState: gameState,
    currentGridLayout: currentGridLayout,
    crossBank: crossBank,
    userState: userState,
    savedTiles: tilesData,
    timeLeft: timeLeft,
  };
  localStorage.setItem(
    "mathMatrix_save_" + gameState.mode,
    JSON.stringify(data)
  );
}

function loadGame(mode) {
  const saved = JSON.parse(localStorage.getItem("mathMatrix_save_" + mode));
  if (!saved) {
    initNewGame(mode);
    return;
  }

  gameState = saved.gameState;
  gameState.active = true;
  gameState.isResumed = true;
  if (saved.timeLeft) timeLeft = saved.timeLeft;

  if (mode === "crossmath") {
    currentGridLayout = saved.currentGridLayout;
    crossBank = saved.crossBank;
    userState = saved.userState;
  } else {
    gameState.restoredTilesData = saved.savedTiles;
  }

  setupUIForGame(mode);
  launchMode(mode);
}

function gameOver(msg) {
  gameState.active = false;
  clearInterval(timerInterval);
  localStorage.removeItem("mathMatrix_save_" + gameState.mode); // Clear save on finish

  document.getElementById("modal-title").textContent = msg;
  document.getElementById("modal-msg").textContent =
    "Final Score: " + gameState.score;
  els.modal.classList.add("show");

  if (msg.includes("COMPLETE") || msg.includes("CLEARED")) {
    playSound("win");
  } else {
    playSound("error");
  }
}

function restartGame() {
  els.modal.classList.remove("show");

  // Cek apakah pemain Menang atau Kalah dari judul Modal
  const title = document.getElementById("modal-title").textContent;
  const isWin = title.includes("COMPLETE") || title.includes("CLEARED");

  if (isWin) {
    // Jika Menang, Lanjut ke Level berikutnya (keepState = true)
    initNewGame(gameState.mode, true);
  } else {
    // Jika Kalah (Time's Up), Reset dari awal (keepState = false)
    initNewGame(gameState.mode, false);
  }
}

// --- ARCADE MODE ---
function initArcade() {
  els.grid.style.gridTemplateColumns = "repeat(5, 1fr)";
  els.targetBox.classList.add("active");
  els.timerContainer.style.display = "block";
  els.levelInfo.textContent = "MODE: ARCADE BLITZ";

  // Reset progress level arcade
  gameState.arcadeClears = 0;

  if (gameState.isResumed && gameState.restoredTilesData) {
    updateTimerBar();
    els.targetVal.textContent = gameState.target;
    restoreGridTiles();
    gameState.isResumed = false;
  } else {
    timeLeft = 100;
    updateTimerBar();
    nextArcadeTarget();
    buildGrid();
  }

  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (!gameState.active) return;
    // Waktu berkurang makin cepat di level tinggi
    timeLeft -= 0.1 + gameState.level * 0.05;
    updateTimerBar();
    if (timeLeft <= 0) gameOver("TIME'S UP!");
  }, 100);
}

function nextArcadeTarget() {
  // Level 1: 6-20
  // Level 5: 10-40
  // Level 10: 15-65
  const min = 5 + gameState.level;
  const max = 15 + gameState.level * 5;
  gameState.target = Math.floor(Math.random() * (max - min + 1)) + min;
  els.targetVal.textContent = gameState.target;
}

function updateTimerBar() {
  els.timerBar.style.width = timeLeft + "%";
}

// --- PUZZLE MODE ---
function initPuzzle() {
  els.grid.style.gridTemplateColumns = "repeat(5, 1fr)";
  els.targetBox.classList.add("active");
  els.shuffleBtn.style.display = "block";
  updateShuffleBtn();
  els.levelInfo.textContent = `PUZZLE - LEVEL ${gameState.level}`;

  if (gameState.isResumed && gameState.restoredTilesData) {
    els.targetVal.textContent = gameState.target;
    restoreGridTiles();
    gameState.isResumed = false;
  } else {
    startPuzzleLevel();
  }
}

function startPuzzleLevel() {
  // Target difficulty scaling
  const minTarget = 8 + gameState.level * 2;
  const maxTarget = 15 + gameState.level * 3;
  gameState.target =
    Math.floor(Math.random() * (maxTarget - minTarget + 1)) + minTarget;
  els.targetVal.textContent = gameState.target;

  let vals = [];

  // --- PERBAIKAN LOGIKA: 12 PASANG + 1 BONUS ---
  // Total 25 kotak. Kita buat 12 pasang (12 x 2 = 24 kotak).
  // Sisa 1 kotak diisi angka Target itu sendiri (Bonus langsung klik).

  // 1. Masukkan Bonus (Angka Target)
  vals.push(gameState.target);

  // 2. Buat 12 Pasang (A + B = Target)
  for (let i = 0; i < 12; i++) {
    let a = Math.floor(Math.random() * (gameState.target - 1)) + 1;
    let b = gameState.target - a;
    vals.push(a, b);
  }

  // Acak posisi
  vals.sort(() => Math.random() - 0.5);
  buildGrid(vals);
}

// --- EQUATION MODE ---
function initEquation() {
  els.grid.style.gridTemplateColumns = "repeat(5, 1fr)";
  els.eqBox.classList.add("active");
  els.levelInfo.textContent = `EQUATION - LEVEL ${gameState.level}`;

  // UBAH BAGIAN INI: Logika Resume yang sebenarnya
  if (
    gameState.isResumed &&
    gameState.equationData &&
    gameState.restoredTilesData
  ) {
    // Ambil data soal yang tersimpan
    const eq = gameState.equationData;

    // Tulis ulang HTML kotak soal berdasarkan data simpanan
    els.eqBox.innerHTML = `<div class="eq-part">${eq.a}</div><div class="eq-part">+</div><div class="eq-part">${eq.b}</div><div class="eq-part">=</div><div class="eq-part eq-slot" id="eq-target-slot">?</div>`;

    // Kembalikan kotak-kotak angka
    restoreGridTiles();

    gameState.isResumed = false;
  } else {
    startEquationLevel();
  }
}

function startEquationLevel() {
  els.levelInfo.textContent = `EQUATION - LEVEL ${gameState.level}`;
  // --- LOGIKA BARU: PROGRESSIVE DIFFICULTY ---
  let level = gameState.level;
  let a, b, ans, op;
  let operators = ["+"];

  // Level 3+ muncul pengurangan, Level 6+ muncul perkalian
  if (level >= 3) operators.push("-");
  if (level >= 6) operators.push("x");

  // Pilih operator acak dari yang tersedia
  op = operators[Math.floor(Math.random() * operators.length)];

  // Tentukan range angka berdasarkan level
  let maxNum = 10 + level * 2; // Level 1=12, Level 10=30, dst.

  if (op === "+") {
    a = Math.floor(Math.random() * maxNum) + 1;
    b = Math.floor(Math.random() * maxNum) + 1;
    ans = a + b;
  } else if (op === "-") {
    // Pastikan hasil tidak negatif
    a = Math.floor(Math.random() * maxNum) + 5;
    b = Math.floor(Math.random() * (a - 1)) + 1;
    ans = a - b;
  } else if (op === "x") {
    // Perkalian angkanya lebih kecil agar tidak terlalu susah
    let maxMult = Math.min(12, 3 + Math.floor(level / 2));
    a = Math.floor(Math.random() * maxMult) + 2;
    b = Math.floor(Math.random() * maxMult) + 2;
    ans = a * b;
  }

  // Simpan data soal untuk resume & pengecekan
  gameState.equationData = { a: a, b: b, answer: ans, op: op };

  // Update HTML Tampilan Soal
  els.eqBox.innerHTML = `<div class="eq-part">${a}</div><div class="eq-part">${op}</div><div class="eq-part">${b}</div><div class="eq-part">=</div><div class="eq-part eq-slot" id="eq-target-slot">?</div>`;

  // Buat Grid Jawaban (1 Jawaban Benar + 24 Jawaban Pengecoh)
  let gridVals = [ans];
  while (gridVals.length < 25) {
    // Buat pengecoh yang dekat dengan jawaban asli (ans +/- 5) agar menantang
    let fake = ans + Math.floor(Math.random() * 10) - 5;
    if (fake !== ans && fake > 0) gridVals.push(fake);
    else gridVals.push(Math.floor(Math.random() * maxNum) + 1);
  }
  gridVals.sort(() => Math.random() - 0.5);

  buildGrid(gridVals);
  saveGameState();
}

function checkEquationAnswer(tileObj) {
  const slot = document.getElementById("eq-target-slot");
  slot.textContent = tileObj.val;

  if (tileObj.val == gameState.equationData.answer) {
    playSound("success");
    addScore(50);
    slot.classList.add("filled");
    setTimeout(() => {
      gameState.level++;
      startEquationLevel();
    }, 1000);
  } else {
    playSound("error");
    setTimeout(() => {
      slot.textContent = "?";
    }, 500);
  }
}

function initCrossmath() {
  els.grid.classList.add("crossmath-mode");
  els.grid.style.gridTemplateColumns = `repeat(${CM_COLS}, 1fr)`;
  els.crossInfo.style.display = "block";
  els.numpad.classList.add("active");
  els.hintBtn.style.display = "flex";
  els.levelInfo.textContent = `CROSSMATH - LEVEL ${gameState.level}`;
  gameState.scoredCells = {}; // Format: { "gridIndex": boolean }

  // LOGIKA RESUME CROSSMATH
  if (gameState.isResumed && currentGridLayout.length > 0) {
    // Jika mode resume DAN data grid ada, jangan generate baru!
    // Gunakan currentGridLayout yang sudah diload oleh loadGame()

    // Pastikan Bank Soal direstore juga
    // (Biasanya sudah diload di loadGame, tapi kita pastikan userState sinkron)
    gameState.isResumed = false;
  } else {
    // HANYA Generate baru jika TIDAK resume
    currentGridLayout = generateCrossmathLevel(gameState.level);
    crossBank = [];
    userState = new Array(currentGridLayout.length).fill(null);
    let answers = [];
    currentGridLayout.forEach((c) => {
      if (c.type === "input") answers.push(c.answer);
    });
    answers.sort(() => Math.random() - 0.5);
    answers.forEach((v, i) => crossBank.push({ id: i, val: v, used: false }));
    gameState.hints = 3;
  }

  renderCrossGrid();
  renderBank();
  updateHintButton();
}

function renderCrossGrid() {
  els.grid.innerHTML = "";
  currentGridLayout.forEach((cell, i) => {
    const div = document.createElement("div");
    div.className = "cell";

    if (cell.type === "gap") div.classList.add("empty");
    else if (cell.type === "fixed") {
      div.classList.add("fixed");
      div.textContent = cell.val;
    } else if (cell.type === "op") {
      div.classList.add("operator");
      div.textContent = cell.val;
    } else if (cell.type === "input") {
      div.classList.add("input");
      div.dataset.idx = i;
      if (userState[i]) {
        div.textContent = userState[i].val;
        div.className +=
          userState[i].val == cell.answer ? " correct" : " wrong";
      }
      if (selectedGridIndex === i) div.classList.add("active-selection");
      div.onclick = () => handleCrossGridClick(i);
    }
    els.grid.appendChild(div);
  });
}

function renderBank() {
  els.numpad.innerHTML = "";
  crossBank.forEach((item, i) => {
    const btn = document.createElement("button");
    btn.className = "num-btn bank-btn";
    if (item.used) btn.classList.add("used");
    if (selectedBankIndex === i) btn.classList.add("selected");
    btn.textContent = item.val;
    btn.onclick = () => handleBankClick(i);
    els.numpad.appendChild(btn);
  });
}

function handleCrossGridClick(idx) {
  if (userState[idx]) {
    const item = crossBank.find((b) => b.id === userState[idx].bankId);
    if (item) item.used = false;
    userState[idx] = null;
    playSound("tap");
    saveGameState();
    renderBank();
    renderCrossGrid();
    return;
  }

  if (selectedBankIndex !== -1) {
    placeNumber(idx, selectedBankIndex);
  } else {
    selectedGridIndex = selectedGridIndex === idx ? -1 : idx;
    renderCrossGrid();
  }
}

function handleBankClick(idx) {
  if (crossBank[idx].used) return;
  if (selectedGridIndex !== -1) {
    placeNumber(selectedGridIndex, idx);
  } else {
    selectedBankIndex = selectedBankIndex === idx ? -1 : idx;
    renderBank();
    renderCrossGrid();
  }
}

function placeNumber(gridIdx, bankIdx) {
  const item = crossBank[bankIdx];
  const cell = currentGridLayout[gridIdx];

  // 1. Simpan State Lama (Benar atau Tidak)
  const wasCorrect =
    userState[gridIdx] && userState[gridIdx].val == cell.answer;

  // 2. Update State Baru
  userState[gridIdx] = { val: item.val, bankId: item.id };
  item.used = true;
  selectedBankIndex = -1;
  selectedGridIndex = -1;

  playSound("tap");

  // 3. Cek Kebenaran Baru
  const isNowCorrect = item.val == cell.answer;

  // 4. Logika Skor Cerdas (Hanya tambah jika belum pernah diskor di sel ini)
  if (isNowCorrect) {
    playSound("success");
    // Jika sebelumnya belum ditandai sebagai scored, tambah poin
    if (!gameState.scoredCells[gridIdx]) {
      addScore(10);
      gameState.scoredCells[gridIdx] = true; // Tandai sudah dapat poin
    }
  } else {
    playSound("error");
    // Jika sebelumnya benar (scored) lalu diganti jadi salah, kurangi poin?
    // Atau biarkan saja (biasanya game tidak mengurangi poin yg sudah didapat agar tidak frustrasi)
    // Tapi kita harus reset flag jika ingin user dapat poin lagi kalau membetulkan.
    if (gameState.scoredCells[gridIdx]) {
      addScore(-10); // Hukuman mengganti jawaban benar jadi salah
      gameState.scoredCells[gridIdx] = false;
    }
  }

  saveGameState();
  renderBank();
  renderCrossGrid();

  // Check Win ... (Sama seperti sebelumnya)
  const allCorrect = currentGridLayout.every((c, i) => {
    if (c.type !== "input") return true;
    return userState[i] && userState[i].val == c.answer;
  });

  if (allCorrect) {
    addScore(100);
    setTimeout(() => {
      gameState.level++;
      userState = [];
      currentGridLayout = [];
      gameState.scoredCells = {}; // Reset tracker untuk level baru
      saveGameState();
      gameOver("LEVEL COMPLETE!");
    }, 500);
  }
}

// --- SHARED HELPERS ---

function buildGrid(values = []) {
  els.grid.innerHTML = "";
  gameState.tiles = [];

  // Safety check: Jika values kosong di mode puzzle, generate ulang
  if (gameState.mode === "puzzle" && values.length === 0) {
    console.warn("Grid kosong terdeteksi, regenerating puzzle...");
    startPuzzleLevel();
    return;
  }

  for (let i = 0; i < 25; i++) {
    const t = document.createElement("div");
    t.className = "tile";
    let v = values.length > i ? values[i] : Math.floor(Math.random() * 9) + 1;
    t.textContent = v;

    // --- FIX BUG VISUAL ---
    t.style.opacity = "1";
    t.style.transform = "scale(1)";
    // ----------------------

    t.onmousedown = () => handleTileClick(i);
    t.ontouchstart = (e) => {
      e.preventDefault();
      handleTileClick(i);
    };
    els.grid.appendChild(t);
    gameState.tiles.push({ el: t, val: v, idx: i, active: true });
  }
}

function restoreGridTiles() {
  buildGrid(gameState.restoredTilesData.map((t) => t.val));
  gameState.tiles.forEach((t, i) => {
    const data = gameState.restoredTilesData[i];
    t.active = data.active;
    if (!t.active) t.el.style.opacity = 0;
  });
}

function handleTileClick(idx) {
  if (!gameState.active) return;
  const t = gameState.tiles[idx];
  if (gameState.mode === "equation") {
    checkEquationAnswer(t);
    return;
  }
  if (!t.active) return;

  const selIdx = gameState.selectedTiles.indexOf(t);
  if (selIdx > -1) {
    t.el.classList.remove("selected");
    gameState.selectedTiles.splice(selIdx, 1);
    playSound("tap");
  } else {
    t.el.classList.add("selected");
    gameState.selectedTiles.push(t);
    playSound("tap");
  }
  checkSum();
}

function checkSum() {
  const sum = gameState.selectedTiles.reduce((a, b) => a + b.val, 0);
  els.currentSum.textContent = "Current: " + sum;

  // --- PERBAIKAN PUZZLE: POPUP JIKA LEBIH DARI 3 KOTAK ---
  // Kode ini diletakkan di awal agar mengecek jumlah seleksi sebelum mengecek hasil
  if (gameState.mode === "puzzle" && gameState.selectedTiles.length > 2) {
    // Batalkan pilihan tile terakhir (agar tidak nyangkut di 4 seleksi)
    const lastTile = gameState.selectedTiles.pop();
    lastTile.el.classList.remove("selected");

    // Hitung ulang sum untuk tampilan UI
    const newSum = gameState.selectedTiles.reduce((a, b) => a + b.val, 0);
    els.currentSum.textContent = "Current: " + newSum;

    // Tampilkan Popup
    showAlert("BATAS MAKSIMAL", "Hanya boleh memilih maksimal 2 angka!");
    return;
  }
  // -------------------------------------------------------

  if (sum === gameState.target) {
    // (Hapus kode lama yang membatasi > 2 kotak dengan shake disini)

    playSound("success");
    addScore(gameState.selectedTiles.length * 10);

    // ... (Sisa kode logika Arcade & Puzzle tetap sama seperti sebelumnya) ...
    if (gameState.mode === "arcade") {
      gameState.arcadeClears = (gameState.arcadeClears || 0) + 1;
      if (gameState.arcadeClears % 5 === 0) {
        gameState.level++;
        timeLeft = Math.min(timeLeft + 20, 100);
        els.levelInfo.textContent = `MODE: ARCADE BLITZ (LVL ${gameState.level})`;
        els.levelInfo.style.color = "var(--warning)";
      } else {
        timeLeft = Math.min(timeLeft + 5, 100);
        els.levelInfo.style.color = "";
      }
      nextArcadeTarget();
    }

    gameState.selectedTiles.forEach((t) => {
      t.el.classList.remove("selected");
      t.el.classList.add("correct");
      setTimeout(() => t.el.classList.remove("correct"), 300);

      if (gameState.mode === "arcade") {
        const newVal = Math.floor(Math.random() * (9 + gameState.level)) + 1;
        t.val = newVal;
        t.el.textContent = newVal;
      } else {
        t.active = false;
        t.el.style.opacity = 0;
      }
    });

    gameState.selectedTiles = [];
    els.currentSum.textContent = "Current: 0";
    saveGameState();

    if (gameState.mode !== "arcade") {
      if (gameState.tiles.every((t) => !t.active)) {
        if (gameState.mode === "puzzle") gameState.level++;
        gameOver("PUZZLE CLEARED!");
      }
    }
  } else if (sum > gameState.target) {
    // ... (Kode error shake saat salah hitung TETAP SAMA) ...
    playSound("error");
    gameState.selectedTiles.forEach((t) => t.el.classList.add("shake"));
    setTimeout(() => {
      gameState.selectedTiles.forEach((t) =>
        t.el.classList.remove("selected", "shake")
      );
      gameState.selectedTiles = [];
      els.currentSum.textContent = "Current: 0";
    }, 400);
  }
}

function updateHintButton() {
  if (els.hintBtn)
    els.hintBtn.querySelector(".hint-badge").textContent = gameState.hints;
}

function updateShuffleBtn() {
  if (els.shuffleBtn) els.shuffleBtn.textContent = `ACAK (${shuffleCount})`;
}

function shuffleBoard() {
  if (!gameState.active) return;
  if (shuffleCount <= 0) {
    showAlert("ACAK HABIS!", "Jatah acak papan sudah habis.");
    return;
  }
  shuffleCount--;
  updateShuffleBtn();
  const actives = gameState.tiles.filter((t) => t.active);
  const vals = actives.map((t) => t.val).sort(() => Math.random() - 0.5);
  actives.forEach((t, i) => {
    t.val = vals[i];
    t.el.textContent = vals[i];
  });
  playSound("tap");
}

function useHint() {
  if (gameState.hints <= 0) {
    showAlert(
      "BANTUAN HABIS!",
      "Kamu sudah menggunakan semua bantuan level ini."
    );
    return;
  }

  // Cari slot yang kosong atau salah
  let targets = [];
  currentGridLayout.forEach((cell, i) => {
    if (cell.type === "input") {
      const isFilled = userState[i] !== null;
      const isCorrect = isFilled && userState[i].val == cell.answer;
      if (!isCorrect) targets.push(i);
    }
  });

  if (targets.length === 0) return;

  const targetIdx = targets[Math.floor(Math.random() * targets.length)];
  const correctVal = currentGridLayout[targetIdx].answer;

  // Jika slot sudah terisi (salah), kembalikan ke bank
  if (userState[targetIdx] !== null) {
    const oldBankId = userState[targetIdx].bankId;
    const oldBankItem = crossBank.find((b) => b.id === oldBankId);
    if (oldBankItem) oldBankItem.used = false;
  }

  // Cari angka yang benar di bank
  const correctBankItem = crossBank.find((b) => b.val == correctVal && !b.used);

  if (correctBankItem) {
    userState[targetIdx] = {
      val: correctBankItem.val,
      bankId: correctBankItem.id,
    };
    correctBankItem.used = true;

    gameState.hints--;
    updateHintButton();

    playSound("success");
    saveGameState();
    renderBank();
    renderCrossGrid();

    // Cek win condition
    const allCorrect = currentGridLayout.every((c, i) => {
      if (c.type !== "input") return true;
      return userState[i] && userState[i].val == c.answer;
    });
    if (allCorrect)
      setTimeout(() => {
        gameState.level++;
        gameOver("LEVEL COMPLETE!");
      }, 500);
  }
}

// --- EVENT LISTENERS TAMBAHAN ---

// Menutup popup Resume jika area gelap di luar kotak diklik

window.onclick = function (event) {
  // Daftar modal yang bisa ditutup dengan klik luar
  const modals = [
    els.resumeModal,
    document.getElementById("settings-modal"),
    document.getElementById("profile-modal"),
    document.getElementById("info-modal"),
  ];

  modals.forEach((modal) => {
    if (event.target === modal) {
      modal.classList.remove("show");
      // Khusus settings, jika ditutup resume game
      if (modal.id === "settings-modal") {
        const gameContainer = document.querySelector(".game-container");
        if (gameContainer.classList.contains("active")) gameState.active = true;
      }
    }
  });
};

// --- Load Settings saat Start ---
window.onload = function () {
  updateMainMenuHighScores();

  // Load Profil
  const savedProfile = localStorage.getItem("mathMatrix_profile_v2");
  if (savedProfile) {
    userProfile = JSON.parse(savedProfile);
    updateProfileUI();
  }

  // Load Nama
  const savedName = localStorage.getItem("mathMatrix_player");
  if (savedName && !userProfile.name) {
    userProfile.name = savedName;
    updateProfileUI();
  }

  // --- FIX ERROR VOLUME ---
  // Kita bungkus dengan try-catch atau cek elemen agar tidak error jika HTML belum siap
  const bgmSlider = document.getElementById("bgm-slider");
  const sfxSlider = document.getElementById("sfx-slider");

  if (bgmSlider && sfxSlider) {
    const savedBgm = localStorage.getItem("mathMatrix_bgm_vol");
    if (savedBgm !== null) {
      bgmVolume = parseFloat(savedBgm);
      bgmSlider.value = bgmVolume;
      if (bgmVolume > 0) prevBgmVol = bgmVolume;
    }
    updateVolume("bgm");

    const savedSfx = localStorage.getItem("mathMatrix_sfx_vol");
    if (savedSfx !== null) {
      sfxVolume = parseFloat(savedSfx);
      sfxSlider.value = sfxVolume;
      if (sfxVolume > 0) prevSfxVol = sfxVolume;
    }
    updateVolume("sfx");
  } else {
    console.warn(
      "Slider audio tidak ditemukan di HTML, melewati inisialisasi suara."
    );
  }
};

// Fungsi Update UI Profil di Menu Utama
function updateProfileUI() {
  document.getElementById("main-profile-name").textContent = userProfile.name;
  const imgDiv = document.getElementById("main-profile-img");
  if (userProfile.img) {
    imgDiv.innerHTML = `<img src="${userProfile.img}">`;
  } else {
    imgDiv.innerHTML = `<i class="fa-solid fa-user"></i>`;
  }
}

function saveProfileName() {
  const val = document.getElementById("player-name-input").value;
  if (val.trim() !== "") {
    playerName = val.trim();
    localStorage.setItem("mathMatrix_player", playerName);
  }
}

// --- UPDATE FITUR VOLUME & IKON ---

function toggleMute(type) {
  const slider = document.getElementById(type + "-slider");
  let currentVal = parseFloat(slider.value);

  if (currentVal > 0) {
    // Sedang hidup -> Mute (Set ke 0)
    if (type === "bgm") prevBgmVol = currentVal;
    else prevSfxVol = currentVal;

    slider.value = 0;
  } else {
    // Sedang mati -> Unmute (Kembalikan ke nilai sebelumnya)
    if (type === "bgm") slider.value = prevBgmVol || 0.5;
    else slider.value = prevSfxVol || 1.0;
  }

  // Panggil fungsi update utama untuk menerapkan perubahan
  updateVolume(type);
}

function updateVolume(type) {
  const slider = document.getElementById(type + "-slider");
  const val = parseFloat(slider.value);
  const icon = document.getElementById(type + "-icon");

  // 1. Update Logika Audio & Storage
  if (type === "bgm") {
    bgmVolume = val;
    bgmAudio.volume = bgmVolume;
    localStorage.setItem("mathMatrix_bgm_vol", bgmVolume);
    // Simpan nilai terakhir jika tidak 0, untuk keperluan unmute
    if (val > 0) prevBgmVol = val;
  } else {
    sfxVolume = val;
    localStorage.setItem("mathMatrix_sfx_vol", sfxVolume);
    if (val > 0) prevSfxVol = val;
  }

  // 2. Update Ikon (Sinkronisasi dengan Slider)
  if (val === 0) {
    icon.className = "fa-solid fa-volume-xmark volume-icon"; // Icon Mute
    icon.style.color = "#ff4444"; // Merah saat mute
  } else {
    icon.className =
      val < 0.5
        ? "fa-solid fa-volume-low volume-icon"
        : "fa-solid fa-volume-high volume-icon"; // Icon Low/High
    icon.style.color = "#666"; // Kembali ke warna normal
  }
}

// --- SISTEM PENGATURAN ---

function openSettings(context) {
  playSound("popup"); // <--- TAMBAHKAN INI
  const modal = document.getElementById("settings-modal");
  const actionContainer = document.getElementById("setting-actions");
  actionContainer.innerHTML = "";

  if (context === "menu") {
    // Tombol Info Baru
    const infoBtn = document.createElement("button");
    infoBtn.className = "menu-action-btn";
    infoBtn.style.background = "#4cc9f0";
    infoBtn.style.color = "#000";
    infoBtn.innerHTML = '<i class="fa-solid fa-circle-info"></i> TENTANG GAME';
    infoBtn.onclick = openInfo; // Buka popup Info baru
    actionContainer.appendChild(infoBtn);

    const exitBtn = document.createElement("button");
    exitBtn.className = "menu-action-btn btn-exit";
    exitBtn.innerHTML = '<i class="fa-solid fa-door-open"></i> KELUAR GAME';
    exitBtn.onclick = function () {
      // Tutup modal settings dulu agar tidak tumpang tindih
      closeSettings();

      // Panggil popup konfirmasi keren
      showCustomConfirm("Yakin ingin menutup aplikasi?", function () {
        // Aksi jika user pilih YA
        window.close();
        // Note: window.close() hanya bekerja di apk/pwa terinstall,
        // di browser biasa mungkin diblokir demi keamanan.
      });
    };
    actionContainer.appendChild(exitBtn);
  } else if (context === "game") {
    // PAUSE GAME
    gameState.active = false;

    const menuBtn = document.createElement("button");
    menuBtn.className = "menu-action-btn btn-back-menu";
    // Perbaikan presisi icon dan teks ada di CSS
    menuBtn.innerHTML = '<i class="fa-solid fa-house"></i> KEMBALI KE MENU';

    menuBtn.onclick = function () {
      closeSettings();
      showCustomConfirm("Progres disimpan. Kembali ke menu?", function () {
        goToMenu();
      });
    };
    actionContainer.appendChild(menuBtn);
  }

  modal.classList.add("show");
}

// --- CUSTOM CONFIRMATION LOGIC ---
function showCustomConfirm(msg, callback) {
  const modal = document.getElementById("confirm-modal");
  document.getElementById("confirm-msg").textContent = msg;
  const yesBtn = document.getElementById("confirm-yes-btn");

  // Hapus event listener lama agar tidak double trigger
  const newBtn = yesBtn.cloneNode(true);
  yesBtn.parentNode.replaceChild(newBtn, yesBtn);

  newBtn.onclick = function () {
    modal.classList.remove("show");
    callback();
  };

  modal.classList.add("show");
}

function closeCustomConfirm() {
  document.getElementById("confirm-modal").classList.remove("show");
}

function closeSettings() {
  document.getElementById("settings-modal").classList.remove("show");

  // Resume Game jika sedang di dalam permainan
  const gameContainer = document.querySelector(".game-container");
  if (gameContainer.classList.contains("active")) {
    gameState.active = true;
  }
}

// --- UPDATE FUNGSI REPORT BUG (CLIPBOARD FEATURE) ---
async function reportBug() {
  // 1. Buat input file virtual
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";

  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      let pesanStatus = "Silakan pilih foto manual di WhatsApp.";

      // 2. COBA SALIN GAMBAR KE CLIPBOARD (Fitur Modern)
      try {
        // Cek apakah browser mendukung penyalinan gambar
        if (navigator.clipboard && navigator.clipboard.write) {
          await navigator.clipboard.write([
            new ClipboardItem({
              [file.type]: file,
            }),
          ]);
          pesanStatus =
            "Foto telah DISALIN! Tekan lama di kolom chat WA lalu pilih TEMPEL/PASTE.";
        }
      } catch (err) {
        console.warn("Gagal menyalin ke clipboard:", err);
        // Fallback jika HP tidak mendukung copy gambar via web
        pesanStatus =
          "Browser tidak mengizinkan copy otomatis. Lampirkan foto secara manual.";
      }

      // 3. Tampilkan Pesan Instruksi
      showAlert("MENUJU WHATSAPP 🚀", pesanStatus);

      // 4. Buka WhatsApp setelah jeda
      setTimeout(() => {
        const phone = "6282275894842";
        // Tambahkan detail perangkat agar report lebih berguna
        const deviceInfo = `Device: ${navigator.platform}, UserAgent: ${navigator.userAgent}`;
        const text = `Halo Admin, saya ${userProfile.name} dari ${userProfile.country}. Saya ingin lapor bug.\n\n(Info Perangkat: ${deviceInfo})\n\n[Mohon lampirkan screenshot di sini]`;

        window.open(
          `https://wa.me/${phone}?text=${encodeURIComponent(text)}`,
          "_blank"
        );
      }, 2500); // Waktu baca diperlama sedikit jadi 2.5 detik
    }
  };

  // Pemicu dialog file
  input.click();
}

// --- SISTEM PROFIL ---
// --- SISTEM PROFIL (UPDATED) ---
function openProfile() {
  playSound("popup"); // <--- TAMBAHKAN INI
  // 1. Set Nama
  document.getElementById("profile-name").value = userProfile.name;

  // 2. Set Negara terlebih dahulu
  const countrySelect = document.getElementById("country-select");
  countrySelect.value = userProfile.country;

  // 3. PENTING: Populate Provinsi berdasarkan Negara yang terpilih
  populateProvinces();

  // 4. Set Provinsi (hanya bisa dilakukan setelah populate selesai)
  if (userProfile.province) {
    document.getElementById("province-select").value = userProfile.province;
  }

  // 5. Preview Image Logic
  const preview = document.getElementById("preview-profile");
  const icon = document.getElementById("default-profile-icon");
  if (userProfile.img) {
    preview.src = userProfile.img;
    preview.style.display = "block";
    icon.style.display = "none";
  } else {
    preview.style.display = "none";
    icon.style.display = "block";
  }

  // 6. Populate High Scores
  const hsContainer = document.getElementById("profile-highscores");
  if (hsContainer) {
    // Definisi Warna & Icon
    const modes = [
      { id: "arcade", name: "Arcade Blitz", icon: "fa-bolt", color: "#fca311" },
      {
        id: "puzzle",
        name: "Logic Puzzle",
        icon: "fa-puzzle-piece",
        color: "#b5179e",
      },
      {
        id: "equation",
        name: "Equation",
        icon: "fa-magnifying-glass",
        color: "#4cc9f0",
      },
      {
        id: "crossmath",
        name: "Crossmath",
        icon: "fa-calculator",
        color: "#06d6a0",
      },
    ];

    let html = "";
    modes.forEach((m) => {
      const score = localStorage.getItem("mathMatrix_hs_" + m.id) || 0;
      html += `
            <div class="profile-hs-item">
                <div class="hs-icon" style="background: ${m.color}20; color: ${m.color}">
                    <i class="fa-solid ${m.icon}"></i>
                </div>
                <div class="hs-info">
                    <span>${m.name}</span>
                    <strong style="font-size: 1.1rem;">${score}</strong>
                </div>
            </div>
          `;
    });
    hsContainer.innerHTML = html;
  }

  document.getElementById("profile-modal").classList.add("show");
}

function closeProfile() {
  document.getElementById("profile-modal").classList.remove("show");
}

function handleProfileUpload(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function (e) {
      document.getElementById("preview-profile").src = e.target.result;
      document.getElementById("preview-profile").style.display = "block";
      document.getElementById("default-profile-icon").style.display = "none";
    };
    reader.readAsDataURL(input.files[0]);
  }
}

function saveProfile() {
  const nameInput = document.getElementById("profile-name");
  let name = nameInput.value.trim();

  // Validasi Panjang
  if (name.length > 12) {
    alert("Nama maksimal 12 karakter!");
    return;
  }
  // Force Uppercase
  name = name.toUpperCase();

  const country = document.getElementById("country-select").value;
  const province = document.getElementById("province-select").value;
  const imgSrc = document.getElementById("preview-profile").src;
  const imgVisible =
    document.getElementById("preview-profile").style.display !== "none";

  if (name) userProfile.name = name;
  userProfile.country = country;
  userProfile.province = province;
  if (imgVisible && imgSrc.startsWith("data:image")) {
    userProfile.img = imgSrc;
  }

  localStorage.setItem("mathMatrix_profile_v2", JSON.stringify(userProfile));
  updateProfileUI();
  closeProfile();
  playSound("success");
}

// [TAMBAHKAN FUNGSI BARU UNTUK INFO MODAL]
function openInfo() {
  playSound("popup"); // <--- TAMBAHKAN INI
  closeSettings(); // Tutup setting dulu
  document.getElementById("info-modal").classList.add("show");
}
function closeInfo() {
  document.getElementById("info-modal").classList.remove("show");
}

// --- DATA WILAYAH LENGKAP (UPDATED) ---
const regionsData = {
  Indonesia: [
    "Aceh",
    "Sumatera Utara",
    "Sumatera Barat",
    "Riau",
    "Jambi",
    "Sumatera Selatan",
    "Bengkulu",
    "Lampung",
    "Kep. Bangka Belitung",
    "Kep. Riau",
    "DKI Jakarta",
    "Jawa Barat",
    "Jawa Tengah",
    "DI Yogyakarta",
    "Jawa Timur",
    "Banten",
    "Bali",
    "Nusa Tenggara Barat",
    "Nusa Tenggara Timur",
    "Kalimantan Barat",
    "Kalimantan Tengah",
    "Kalimantan Selatan",
    "Kalimantan Timur",
    "Kalimantan Utara",
    "Sulawesi Utara",
    "Sulawesi Tengah",
    "Sulawesi Selatan",
    "Sulawesi Tenggara",
    "Gorontalo",
    "Sulawesi Barat",
    "Maluku",
    "Maluku Utara",
    "Papua",
    "Papua Barat",
    "Papua Selatan",
    "Papua Tengah",
    "Papua Pegunungan",
    "Papua Barat Daya",
  ],
  Malaysia: [
    "Johor",
    "Kedah",
    "Kelantan",
    "Melaka",
    "Negeri Sembilan",
    "Pahang",
    "Penang",
    "Perak",
    "Perlis",
    "Sabah",
    "Sarawak",
    "Selangor",
    "Terengganu",
    "Kuala Lumpur",
    "Labuan",
    "Putrajaya",
  ],
  Singapore: [
    "Central Region",
    "East Region",
    "North Region",
    "North-East Region",
    "West Region",
  ],
  USA: [
    "Alabama",
    "Alaska",
    "Arizona",
    "Arkansas",
    "California",
    "Colorado",
    "Connecticut",
    "Delaware",
    "Florida",
    "Georgia",
    "Hawaii",
    "Idaho",
    "Illinois",
    "Indiana",
    "Iowa",
    "Kansas",
    "Kentucky",
    "Louisiana",
    "Maine",
    "Maryland",
    "Massachusetts",
    "Michigan",
    "Minnesota",
    "Mississippi",
    "Missouri",
    "Montana",
    "Nebraska",
    "Nevada",
    "New Hampshire",
    "New Jersey",
    "New Mexico",
    "New York",
    "North Carolina",
    "North Dakota",
    "Ohio",
    "Oklahoma",
    "Oregon",
    "Pennsylvania",
    "Rhode Island",
    "South Carolina",
    "South Dakota",
    "Tennessee",
    "Texas",
    "Utah",
    "Vermont",
    "Virginia",
    "Washington",
    "West Virginia",
    "Wisconsin",
    "Wyoming",
  ],
  Japan: [
    "Hokkaido",
    "Aomori",
    "Iwate",
    "Miyagi",
    "Akita",
    "Yamagata",
    "Fukushima",
    "Ibaraki",
    "Tochigi",
    "Gunma",
    "Saitama",
    "Chiba",
    "Tokyo",
    "Kanagawa",
    "Niigata",
    "Toyama",
    "Ishikawa",
    "Fukui",
    "Yamanashi",
    "Nagano",
    "Gifu",
    "Shizuoka",
    "Aichi",
    "Mie",
    "Shiga",
    "Kyoto",
    "Osaka",
    "Hyogo",
    "Nara",
    "Wakayama",
    "Tottori",
    "Shimane",
    "Okayama",
    "Hiroshima",
    "Yamaguchi",
    "Tokushima",
    "Kagawa",
    "Ehime",
    "Kochi",
    "Fukuoka",
    "Saga",
    "Nagasaki",
    "Kumamoto",
    "Oita",
    "Miyazaki",
    "Kagoshima",
    "Okinawa",
  ],
  "South Korea": [
    "Seoul",
    "Busan",
    "Daegu",
    "Incheon",
    "Gwangju",
    "Daejeon",
    "Ulsan",
    "Sejong",
    "Gyeonggi",
    "Gangwon",
    "Chungbuk",
    "Chungnam",
    "Jeonbuk",
    "Jeonnam",
    "Gyeongbuk",
    "Gyeongnam",
    "Jeju",
  ],
  "United Kingdom": ["England", "Scotland", "Wales", "Northern Ireland"],
  India: [
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chhattisgarh",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal",
  ],
  Australia: [
    "New South Wales",
    "Victoria",
    "Queensland",
    "Western Australia",
    "South Australia",
    "Tasmania",
    "Australian Capital Territory",
    "Northern Territory",
  ],
};

// Pastikan fungsi ini dipanggil dengan benar
function populateProvinces() {
  const countrySelect = document.getElementById("country-select");
  const provSelect = document.getElementById("province-select");
  const selectedCountry = countrySelect.value;

  // Reset opsi
  provSelect.innerHTML = '<option value="">Pilih Provinsi/Daerah</option>';

  if (selectedCountry && regionsData[selectedCountry]) {
    regionsData[selectedCountry].forEach((prov) => {
      const opt = document.createElement("option");
      opt.value = prov;
      opt.textContent = prov;
      provSelect.appendChild(opt);
    });
  }
}

// --- BGM AUTO-START HANDLER ---
// Browser modern memblokir autoplay audio.
// Kita pancing play saat user pertama kali klik di mana saja pada layar.
document.body.addEventListener(
  "click",
  function () {
    // Hanya play jika belum playing dan volume > 0
    if (bgmAudio.paused && bgmVolume > 0) {
      bgmAudio.play().catch((e) => console.log("BGM Start blocked:", e));
    }
  },
  { once: true }
); // {once: true} artinya event ini hanya jalan sekali saja

// --- SYSTEM AUDIO FINAL (Letakkan di bagian bawah script.js) ---

function playSound(type) {
  // 1. Cek Volume Global
  if (sfxVolume <= 0) return;

  // 2. Resume AudioContext (Wajib untuk browser modern)
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }

  // 3. Setup Oscillator
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  const now = audioCtx.currentTime;
  const vol = 0.1 * sfxVolume; // Master volume control

  // 4. PILIH TIPE SUARA (Switch Case)
  switch (type) {
    case "tap":
      // Suara Gameplay (Pop Lembut)
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);
      gainNode.gain.setValueAtTime(vol, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
      break;

    case "success":
      // Suara Benar (Ting!)
      osc.type = "triangle";
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.linearRampToValueAtTime(880, now + 0.1);
      gainNode.gain.setValueAtTime(vol, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
      break;

    case "error":
      // Suara Salah (Buzz Kasar - Sawtooth)
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.linearRampToValueAtTime(100, now + 0.2);
      gainNode.gain.setValueAtTime(vol * 1.5, now);
      gainNode.gain.linearRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
      break;

    case "ui-click":
      // Suara Klik UI (Diperkeras & Dipertebal)
      osc.type = "sine";
      // Frekuensi sedikit diturunkan agar lebih "berbobot"
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(1000, now + 0.08);

      // VOLUME BOOST: Naikkan dari 0.5 menjadi 3.0
      gainNode.gain.setValueAtTime(vol * 3.0, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.start(now);
      osc.stop(now + 0.08);
      break;

    case "popup":
      // Suara Buka Menu (Whoosh)
      osc.type = "sine";
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.linearRampToValueAtTime(400, now + 0.15);
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(vol, now + 0.05);
      gainNode.gain.linearRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
      break;

    case "toggle":
      // Suara Slider Geser
      osc.type = "square";
      osc.frequency.setValueAtTime(300, now);
      gainNode.gain.setValueAtTime(vol * 0.2, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.03);
      osc.start(now);
      osc.stop(now + 0.03);
      break;

    case "win":
      // Nada Menang
      playTone(523.25, now, 0.1, "sine");
      playTone(659.25, now + 0.1, 0.1, "sine");
      playTone(783.99, now + 0.2, 0.4, "square");
      break;

    default:
      // Fallback Aman (Jika typo, bunyi tap biasa, BUKAN error)
      osc.type = "sine";
      osc.frequency.value = 440;
      gainNode.gain.setValueAtTime(vol, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
      break;
  }
}

// Helper untuk playTone (biarkan saja, ini sudah benar)
function playTone(freq, time, duration, type = "sine") {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type = type;
  osc.frequency.value = freq;
  const vol = 0.1 * sfxVolume;
  gain.gain.setValueAtTime(vol, time);
  gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
  osc.start(time);
  osc.stop(time + duration);
}

// --- AUTO UI SOUND LISTENER ---
// Letakkan ini di baris paling akhir script.js

// --- AUTO UI SOUND LISTENER ---
document.addEventListener("click", function (e) {
  // Target tombol UI (bukan gameplay)
  const target = e.target.closest(
    "button, .mode-card, .profile-btn-wrapper, .back-btn, .settings-btn-main"
  );

  if (target) {
    // Filter: Jangan bunyikan UI sound jika itu adalah tombol game (Tile/NumPad)
    // Karena tombol game sudah punya logika bunyi sendiri di fungsinya
    if (
      target.classList.contains("tile") ||
      target.classList.contains("cell") ||
      target.classList.contains("num-btn") ||
      target.id === "hint-btn" ||
      target.id === "shuffle-btn"
    ) {
      return;
    }

    // Mainkan suara UI Click yang benar
    playSound("ui-click");
  }

  // Suara Slider
  if (e.target.tagName === "INPUT" && e.target.type === "range") {
    playSound("toggle");
  }
});

// Tambahan suara khusus saat slide volume
document.querySelectorAll('input[type="range"]').forEach((input) => {
  input.addEventListener("input", () => playSound("toggle"));
});
