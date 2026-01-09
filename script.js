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

// [REPLACE] Ganti fungsi addScore dengan versi ini
function addScore(amount) {
  // Hitung level poin sebelum ditambah (kelipatan 500)
  const oldMilestone = Math.floor(gameState.score / 500);

  gameState.score += amount;
  els.score.textContent = "SCORE: " + gameState.score;

  // Hitung level poin setelah ditambah
  const newMilestone = Math.floor(gameState.score / 500);

  // Jika melewati kelipatan 500 (misal 490 -> 540)
  if (newMilestone > oldMilestone) {
    // 1. Tambah resource secara background (tetap dapat meski tidak ada notif)
    gameState.eqHints = (gameState.eqHints || 0) + 2; // +2 Hint Equation
    gameState.hints += 1; // +1 Hint Crossmath

    // 2. Update tombol UI hanya jika sedang di mode yang relevan
    if (gameState.mode === "equation") updateHintButton();
    if (gameState.mode === "crossmath") updateHintButton();

    // 3. LOGIKA POPUP (Hanya muncul sesuai Mode)
    if (gameState.mode === "equation") {
      // Khusus Mode Equation: Tampilkan notif +2
      showAlert("BONUS!", "Poin 500+! Dapat +2 Bantuan.");
      playSound("success");
    } else if (gameState.mode === "crossmath") {
      // Khusus Mode Crossmath: Tampilkan notif +1 (agar relevan)
      showAlert("BONUS!", "Poin 500+! Dapat +1 Bantuan.");
      playSound("success");
    }
    // Mode Arcade & Puzzle: TIDAK ADA POPUP (Silent Bonus)
    // Agar tidak mengganggu gameplay yang cepat.
  }

  // Animasi Score
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

// [UPDATE] Tambahkan inisialisasi eqHints di dalam initNewGame
function initNewGame(mode, keepState = false) {
  if (!keepState) {
    gameState = {
      mode: mode,
      active: true,
      score: 0,
      level: 1,
      target: 0,
      hints: 3, // Hint Crossmath default
      eqHints: 2, // Hint Equation default (Mulai dengan 2)
      isResumed: false,
      selectedTiles: [],
      tiles: [],
    };
  } else {
    gameState.active = true;
    gameState.selectedTiles = [];
    gameState.tiles = [];
    gameState.isResumed = false;
    // Pastikan eqHints ada jika lanjut dari save lama yang belum punya variabel ini
    if (typeof gameState.eqHints === "undefined") gameState.eqHints = 2;
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
  els.modal.classList.remove("show"); // Tutup modal

  // Cek apakah pemain Menang atau Kalah dari judul Modal
  const titleEl = document.getElementById("modal-title");
  const title = titleEl ? titleEl.textContent : "";
  const isWin =
    title.includes("COMPLETE") ||
    title.includes("CLEARED") ||
    title.includes("SCORE");

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

// [REPLACE] Ganti fungsi startPuzzleLevel dengan versi stabil ini
function startPuzzleLevel() {
  // 1. Tentukan Target (Difficulty Scaling)
  const minTarget = 10 + gameState.level * 2;
  const maxTarget = 20 + gameState.level * 4;
  gameState.target =
    Math.floor(Math.random() * (maxTarget - minTarget + 1)) + minTarget;

  // Update Teks Target di UI
  if (els.targetVal) els.targetVal.textContent = gameState.target;

  let vals = [];

  // 2. Masukkan Bonus (Angka Target itu sendiri)
  vals.push(gameState.target);

  // 3. Buat 12 Pasang Angka (A + B = Target)
  for (let i = 0; i < 12; i++) {
    // Range A: 1 sampai (Target - 1) agar B tidak nol
    // Proteksi: Jika target terlalu kecil, fallback ke 1
    let maxA = Math.max(1, gameState.target - 1);
    let a = Math.floor(Math.random() * maxA) + 1;
    let b = gameState.target - a;
    vals.push(a, b);
  }

  // 4. Acak Posisi
  vals.sort(() => Math.random() - 0.5);

  // 5. Build Grid Secara Langsung
  buildGrid(vals);

  // --- FIX: Simpan state segera setelah generate agar tidak hilang ---
  saveGameState();
}

// [REPLACE] Ganti fungsi initEquation dengan ini
function initEquation() {
  els.grid.style.gridTemplateColumns = "repeat(5, 1fr)";
  els.eqBox.classList.add("active");
  els.levelInfo.textContent = `EQUATION - LEVEL ${gameState.level}`;

  // TAMPILKAN TOMBOL HINT (Fitur Baru)
  els.hintBtn.style.display = "flex";
  updateHintButton();

  if (
    gameState.isResumed &&
    gameState.equationData &&
    gameState.restoredTilesData
  ) {
    const eq = gameState.equationData;
    els.eqBox.innerHTML = `<div class="eq-part">${eq.a}</div><div class="eq-part">${eq.op}</div><div class="eq-part">${eq.b}</div><div class="eq-part">=</div><div class="eq-part eq-slot" id="eq-target-slot">?</div>`;
    restoreGridTiles();
    gameState.isResumed = false;
  } else {
    startEquationLevel();
  }
}

// [REPLACE] Ganti fungsi startEquationLevel dengan versi ini
function startEquationLevel() {
  els.levelInfo.textContent = `EQUATION - LEVEL ${gameState.level}`;

  // RESET: Izinkan bantuan dipakai lagi di level baru ini
  gameState.eqHintUsedInLevel = false;

  let level = gameState.level;
  let a, b, ans, op;
  let operators = ["+"];

  // Unlock Operator sesuai Level
  if (level >= 3) operators.push("-");
  if (level >= 5) operators.push("x");
  if (level >= 7) operators.push("/");

  op = operators[Math.floor(Math.random() * operators.length)];
  let maxNum = 12 + level * 2;

  // --- GENERATOR SOAL ---
  if (op === "+") {
    a = Math.floor(Math.random() * maxNum) + 1;
    b = Math.floor(Math.random() * maxNum) + 1;
    ans = a + b;
  } else if (op === "-") {
    a = Math.floor(Math.random() * maxNum) + 5;
    b = Math.floor(Math.random() * (a - 1)) + 1;
    ans = a - b;
  } else if (op === "x") {
    let maxMult = Math.min(12, 3 + Math.floor(level / 2));
    a = Math.floor(Math.random() * maxMult) + 2;
    b = Math.floor(Math.random() * maxMult) + 2;
    ans = a * b;
  } else if (op === "/") {
    b = Math.floor(Math.random() * 10) + 2;
    ans = Math.floor(Math.random() * 10) + 2;
    a = b * ans;
  }

  // Simpan data
  gameState.equationData = { a: a, b: b, answer: ans, op: op };

  // Update Tampilan Soal
  els.eqBox.innerHTML = `<div class="eq-part">${a}</div><div class="eq-part">${op}</div><div class="eq-part">${b}</div><div class="eq-part">=</div><div class="eq-part eq-slot" id="eq-target-slot">?</div>`;

  // --- GENERATOR GRID JAWABAN ---
  let gridVals = [];

  // 1. Isi 24 Angka Pengecoh
  for (let i = 0; i < 24; i++) {
    let fake;
    if (Math.random() > 0.5) {
      fake = ans + (Math.floor(Math.random() * 21) - 10);
    } else {
      fake = Math.floor(Math.random() * 50) + 1;
    }

    if (fake <= 0 || fake === ans) {
      fake = ans + 1 + Math.floor(Math.random() * 5);
    }
    gridVals.push(fake);
  }

  // 2. Masukkan Jawaban Benar
  gridVals.push(ans);

  // 3. Acak Posisi Grid
  gridVals.sort(() => Math.random() - 0.5);

  buildGrid(gridVals);
  saveGameState();

  updateHintButton();
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
  if (!els.hintBtn) return;
  const badge = els.hintBtn.querySelector(".hint-badge");

  if (gameState.mode === "crossmath") {
    badge.textContent = gameState.hints;
  } else if (gameState.mode === "equation") {
    badge.textContent = gameState.eqHints || 0;
  }
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

// [REPLACE] Ganti fungsi useHint dengan versi ini
function useHint() {
  // --- MODE CROSSMATH (Tetap sama) ---
  if (gameState.mode === "crossmath") {
    if (gameState.hints <= 0) {
      showAlert("BANTUAN HABIS!", "Selesaikan level atau dapatkan 500 poin.");
      return;
    }
    useCrossmathHintLogic();
    return;
  }

  // --- MODE EQUATION (Logika Baru) ---
  if (gameState.mode === "equation") {
    // 1. Cek Limit Per Level
    if (gameState.eqHintUsedInLevel) {
      showAlert("BATAS TERCAPAI", "Bantuan hanya bisa 1x per level!");
      return;
    }

    // 2. Cek Stok Hint
    if (!gameState.eqHints || gameState.eqHints <= 0) {
      showAlert("BANTUAN HABIS!", "Kumpulkan 500 poin untuk dapat +2 bantuan.");
      return;
    }

    // 3. Eksekusi Bantuan (Auto-Answer)
    gameState.eqHints--;
    gameState.eqHintUsedInLevel = true; // Tandai sudah dipakai
    updateHintButton();

    // Langsung isi slot jawaban di UI
    const slot = document.getElementById("eq-target-slot");
    const correctAnswer = gameState.equationData.answer;

    slot.textContent = correctAnswer; // Isi angka
    slot.classList.add("filled"); // Ubah warna jadi kuning (filled style)

    playSound("success");
    addScore(50); // Tambah skor

    // Lanjut ke level berikutnya (simulasi menang)
    setTimeout(() => {
      gameState.level++;
      startEquationLevel();
    }, 1000);
  }
}

// --- HELPER LOGIC UNTUK CROSSMATH ---
function useCrossmathHintLogic() {
  // 1. Cari slot yang kosong atau salah
  let targets = [];
  currentGridLayout.forEach((cell, i) => {
    if (cell.type === "input") {
      const isFilled = userState[i] !== null;
      const isCorrect = isFilled && userState[i].val == cell.answer;
      if (!isCorrect) targets.push(i);
    }
  });

  if (targets.length === 0) return; // Semua sudah benar

  // 2. Pilih satu target acak
  const targetIdx = targets[Math.floor(Math.random() * targets.length)];
  const correctVal = currentGridLayout[targetIdx].answer;

  // 3. Jika slot sudah terisi (salah), kembalikan item lama ke bank
  if (userState[targetIdx] !== null) {
    const oldBankId = userState[targetIdx].bankId;
    const oldBankItem = crossBank.find((b) => b.id === oldBankId);
    if (oldBankItem) oldBankItem.used = false;
  }

  // 4. Cari angka yang benar di bank
  const correctBankItem = crossBank.find((b) => b.val == correctVal && !b.used);

  if (correctBankItem) {
    // Pasang jawaban benar
    userState[targetIdx] = {
      val: correctBankItem.val,
      bankId: correctBankItem.id,
    };
    correctBankItem.used = true;

    // Kurangi Hint & Update UI
    gameState.hints--;
    updateHintButton();

    playSound("success");
    saveGameState();
    renderBank();
    renderCrossGrid();

    // Cek Kemenangan Langsung
    const allCorrect = currentGridLayout.every((c, i) => {
      if (c.type !== "input") return true;
      return userState[i] && userState[i].val == c.answer;
    });

    if (allCorrect) {
      setTimeout(() => {
        gameState.level++;
        // Reset hint state crossmath jika naik level (opsional, bisa dihapus jika ingin akumulasi)
        gameState.hints = 3;
        gameOver("LEVEL COMPLETE!");
      }, 500);
    }
  } else {
    // Kasus langka: Angka di bank habis/tidak ada (seharusnya tidak terjadi di logika normal)
    showAlert("OOPS", "Angka yang dibutuhkan tidak ditemukan di bank.");
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
    // Tombol Info
    const infoBtn = document.createElement("button");
    infoBtn.className = "menu-action-btn";
    infoBtn.style.background = "#4cc9f0";
    infoBtn.style.color = "#000";
    infoBtn.innerHTML = '<i class="fa-solid fa-circle-info"></i> TENTANG GAME';
    infoBtn.onclick = openInfo;
    actionContainer.appendChild(infoBtn);

    // --- TOMBOL DIAGNOSTIK BARU (Check System) ---
    const diagBtn = document.createElement("button");
    diagBtn.className = "menu-action-btn";
    diagBtn.style.background = "#2a2a40"; // Warna gelap elegan
    diagBtn.style.border = "1px solid var(--accent)";
    diagBtn.style.color = "var(--accent)";
    diagBtn.innerHTML =
      '<i class="fa-solid fa-microchip"></i> CEK KONEKSI & PERFORMA';
    diagBtn.onclick = openDiagnostics; // Panggil fungsi baru
    actionContainer.appendChild(diagBtn);
    // ---------------------------------------------

    const exitBtn = document.createElement("button");
    exitBtn.className = "menu-action-btn btn-exit";
    exitBtn.innerHTML = '<i class="fa-solid fa-door-open"></i> KELUAR GAME';
    exitBtn.onclick = function () {
      closeSettings();
      showCustomConfirm("Yakin ingin menutup aplikasi?", function () {
        window.close();
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

// [REPLACE] Ganti seluruh fungsi playSound yang lama dengan ini:

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

  // --- PERUBAHAN 1: BASE VOLUME DINAIKKAN (Dari 0.1 jadi 0.4) ---
  const vol = 0.4 * sfxVolume;

  // 4. PILIH TIPE SUARA (Switch Case)
  switch (type) {
    case "tap":
      // Suara Gameplay (Pop lebih tebal)
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, now); // Frekuensi awal lebih tinggi
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.15); // Turun lebih drastis

      // Volume Boost
      gainNode.gain.setValueAtTime(vol * 1.5, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

      osc.start(now);
      osc.stop(now + 0.15);
      break;

    case "success":
      // Suara Benar (Ting! yang lebih Kristal)
      osc.type = "triangle"; // Ganti ke Triangle biar lebih tajam
      osc.frequency.setValueAtTime(500, now);
      osc.frequency.linearRampToValueAtTime(1200, now + 0.1); // Pitch naik cepat

      gainNode.gain.setValueAtTime(vol * 1.2, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4); // Sustain lebih lama

      osc.start(now);
      osc.stop(now + 0.4);
      break;

    case "error":
      // Suara Salah (Buzz Kasar - Lebih keras)
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.linearRampToValueAtTime(50, now + 0.3);

      gainNode.gain.setValueAtTime(vol * 2.0, now); // Boost 2x lipat
      gainNode.gain.linearRampToValueAtTime(0.01, now + 0.3);

      osc.start(now);
      osc.stop(now + 0.3);
      break;

    case "ui-click":
      // Suara Klik UI (High Tech Blip)
      osc.type = "sine";
      osc.frequency.setValueAtTime(1200, now); // Lebih tinggi
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);

      gainNode.gain.setValueAtTime(vol * 1.8, now); // Lebih keras
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.start(now);
      osc.stop(now + 0.1);
      break;

    case "popup":
      // Suara Buka Menu (Whoosh Futuristik)
      osc.type = "sine";
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.linearRampToValueAtTime(600, now + 0.3);

      gainNode.gain.setValueAtTime(0.01, now);
      gainNode.gain.linearRampToValueAtTime(vol * 1.5, now + 0.1); // Fade in
      gainNode.gain.linearRampToValueAtTime(0.01, now + 0.3); // Fade out

      osc.start(now);
      osc.stop(now + 0.3);
      break;

    case "toggle":
      // Suara Slider (Klik pendek)
      osc.type = "square";
      osc.frequency.setValueAtTime(400, now);
      gainNode.gain.setValueAtTime(vol * 0.5, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
      break;

    case "win":
      // Nada Menang (Chord Major)
      playTone(523.25, now, 0.2, "sine"); // C
      playTone(659.25, now + 0.15, 0.2, "sine"); // E
      playTone(783.99, now + 0.3, 0.6, "square"); // G (Paling keras)
      break;

    default:
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

// ================================================================
// FITUR VOICE COMMAND & YOUTUBE PLAYER
// ================================================================

// [REPLACE] Ganti seluruh blok konfigurasi YouTube dengan ini

// 1. Variabel Global Player
let player;
let isYoutubePlaying = false;
// Tambahkan parameter &playsinline=1 dan &enablejsapi=1 di URL
const YOUTUBE_LINK =
  "https://youtube.com/playlist?list=PL8NGhre-uK_MnZpWNCX2l8kYvqzwy9x6b&si=mPHQRL7P5sDjdNui";

function getListIdFromUrl(url) {
  try {
    const match = url.match(/[?&]list=([^#\&\?]+)/);
    return match ? match[1] : null;
  } catch (e) {
    return null;
  }
}

window.onYouTubeIframeAPIReady = function () {
  const listId = getListIdFromUrl(YOUTUBE_LINK);
  if (!listId) return;

  player = new YT.Player("youtube-player", {
    height: "1",
    width: "1",
    playerVars: {
      playsinline: 1, // KUNCI: Agar tidak fullscreen otomatis di iOS/Android
      listType: "playlist",
      list: listId,
      controls: 0,
      loop: 1,
      autoplay: 0, // Autoplay sering diblokir browser, lebih baik trigger manual via voice
      origin: window.location.origin,
      enablejsapi: 1,
    },
    events: {
      onStateChange: onPlayerStateChange,
      onReady: onPlayerReady,
    },
  });
};

function onPlayerReady(event) {
  // Setup Media Session (Kontrol di Notifikasi HP)
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: "Math Matrix Soundtrack",
      artist: "Game Background Music",
      artwork: [
        {
          src: "https://cdn-icons-png.flaticon.com/512/3965/3965108.png",
          sizes: "512x512",
          type: "image/png",
        },
      ],
    });

    navigator.mediaSession.setActionHandler("play", () =>
      controlYoutube("PLAY")
    );
    navigator.mediaSession.setActionHandler("pause", () =>
      controlYoutube("STOP")
    );
    navigator.mediaSession.setActionHandler("nexttrack", () =>
      controlYoutube("NEXT")
    );
  }
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.PLAYING) {
    isYoutubePlaying = true;
    if (bgmAudio) bgmAudio.pause(); // Matikan BGM game bawaan
  } else if (event.data === YT.PlayerState.PAUSED) {
    // Jangan set false jika pause disebabkan oleh pindah tab (sistem)
    // Biarkan status tetap 'playing' agar kita bisa mencoba resume
  }
}

// [BARU] Listener Agresif untuk Visibility Change
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "visible") {
    // Saat user kembali ke tab game, PAKSA play jika tadi menyala
    if (isYoutubePlaying && player && typeof player.playVideo === "function") {
      player.playVideo();
    }
  } else {
    // Saat user pindah tab (Hidden)
    // Chrome Mobile mungkin akan pause otomatis di sini.
    // Kita coba kirim perintah play lagi (Mungkin diblokir browser, tapi layak dicoba)
    if (isYoutubePlaying && player && typeof player.playVideo === "function") {
      setTimeout(() => {
        player.playVideo();
      }, 100);
    }
  }
});

function controlYoutube(action) {
  if (!player || typeof player.playVideo !== "function") {
    bicara("Player musik sedang memuat, coba sebentar lagi.");
    return;
  }

  if (action === "PLAY") {
    player.playVideo();
    isYoutubePlaying = true;
    bicara("Memutar playlist musik.");
  } else if (action === "STOP") {
    player.pauseVideo();
    isYoutubePlaying = false;
    bicara("Musik dihentikan.");
  } else if (action === "NEXT") {
    player.nextVideo();
    isYoutubePlaying = true;
    bicara("Memutar lagu selanjutnya.");
  }
}

// 3. VOICE RECOGNITION (Pendengar Suara)
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.lang = "id-ID";
  recognition.interimResults = true;

  // SAAT DIMULAI
  recognition.onstart = () => {
    // Tampilkan Overlay dengan class 'show' agar animasi opacity jalan
    document.getElementById("voice-overlay").classList.add("show");

    // Ubah icon tombol melayang jadi loading spinner
    document.getElementById("mic-icon").className =
      "fa-solid fa-spinner fa-spin";

    // Kecilkan volume game
    if (bgmAudio) bgmAudio.volume = 0.1;
  };

  // SAAT SELESAI
  recognition.onend = () => {
    // Sembunyikan Overlay
    document.getElementById("voice-overlay").classList.remove("show");

    // Balikkan icon ke mic
    document.getElementById("mic-icon").className = "fa-solid fa-microphone";

    // Kembalikan volume game
    if (bgmAudio) bgmAudio.volume = bgmVolume;
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.toLowerCase();

    // Update teks di dalam Overlay
    document.getElementById("voice-text-preview").innerText = `"${transcript}"`;

    if (event.results[0].isFinal) {
      prosesPerintah(transcript);
    }
  };
}

function toggleVoiceCommand() {
  if (!SpeechRecognition) return alert("Browser tidak support Voice Command.");
  recognition.start();
}

function stopVoiceCommand() {
  if (recognition) recognition.stop();
  document.getElementById("voice-overlay").classList.remove("show");
}

// 4. PEMROSESAN PERINTAH
function prosesPerintah(teks) {
  console.log("Perintah:", teks);

  // ===========================================
  // 0. PRIORITAS: CEK POPUP "RESUME GAME"
  // ===========================================
  if (document.getElementById("resume-modal").classList.contains("show")) {
    // OPSI A: LANJUTKAN (Sesuai mode yang dipilih)
    if (
      teks.includes("lanjut") ||
      teks.includes("resume") ||
      teks.includes("teruskan") ||
      teks.includes("ya")
    ) {
      confirmResume();

      // Deteksi nama game dari variabel pendingMode
      let gameName = pendingMode ? pendingMode : "permainan";
      // Ubah huruf awal jadi kapital biar enak didengar (opsional)
      gameName = gameName.charAt(0).toUpperCase() + gameName.slice(1);

      bicara(`Oke, melanjutkan ${gameName}.`);
      return;
    }

    // OPSI B: MULAI BARU
    else if (
      teks.includes("baru") ||
      teks.includes("ulang") ||
      teks.includes("new") ||
      teks.includes("hapus")
    ) {
      confirmNewGame();

      let gameName = pendingMode ? pendingMode : "permainan";
      bicara(`Siap, memulai ${gameName} baru dari awal.`);
      return;
    }

    // OPSI C: BATAL
    else if (
      teks.includes("batal") ||
      teks.includes("kembali") ||
      teks.includes("tutup")
    ) {
      goToMenu();
      bicara("Kembali ke menu utama.");
      return;
    }
  }

  // ===========================================
  // 1. PILIH MODE PERMAINAN (BARU)
  // ===========================================

  if (
    teks.includes("game arcade") ||
    teks.includes("game arkade") ||
    teks.includes("mode kilat")
  ) {
    startGame("arcade");
    bicara("Siap! Memulai Mode Arcade Blitz.");
  } else if (
    teks.includes("game puzzle") ||
    teks.includes("logika") ||
    teks.includes("teka-teki")
  ) {
    startGame("puzzle");
    bicara("Masuk ke Logic Puzzle. Habiskan kotaknya!");
  } else if (
    teks.includes("game equation") ||
    teks.includes("persamaan") ||
    teks.includes("hitung")
  ) {
    startGame("equation");
    bicara("Mode Equation dimulai. Lengkapi rumusnya.");
  } else if (
    teks.includes("game crossmath") ||
    teks.includes("game cross math") ||
    teks.includes("silang")
  ) {
    startGame("crossmath");
    bicara("Membuka Crossmath. TTS Matematika siap.");
  }

  // ===========================================
  // 2. NAVIGASI UMUM (LANJUT/KEMBALI)
  // ===========================================
  else if (
    teks.includes("lanjut") ||
    teks.includes("resume") ||
    teks.includes("mulai")
  ) {
    // Cek 1: Jika ada popup "Resume Game"
    if (document.getElementById("resume-modal").classList.contains("show")) {
      confirmResume();
      bicara("Melanjutkan permainan.");
    }
    // Cek 2: Jika sedang di Menu Utama (Default ke Arcade jika cuma bilang "Mulai")
    else if (
      !document.querySelector(".game-container").classList.contains("active")
    ) {
      startGame("arcade");
      bicara("Memulai permainan Arcade.");
    }
    // Cek 3: Jika game ter-pause (Setting terbuka)
    else {
      closeSettings();
      gameState.active = true;
      bicara("Game dilanjutkan.");
    }
  } else if (
    teks.includes("kembali") ||
    teks.includes("menu utama") ||
    teks.includes("keluar") ||
    teks.includes("home")
  ) {
    if (
      document.querySelector(".game-container").classList.contains("active")
    ) {
      goToMenu();
      bicara("Kembali ke menu utama.");
    } else {
      bicara("Sudah di menu utama.");
    }
  }

  // ===========================================
  // 3. FITUR DALAM GAME (ACAK & BANTUAN)
  // ===========================================
  else if (
    teks.includes("acak") ||
    teks.includes("shuffle") ||
    teks.includes("kocok")
  ) {
    if (
      gameState.active &&
      (gameState.mode === "puzzle" || gameState.mode === "arcade")
    ) {
      shuffleBoard();
      bicara("Papan diacak.");
    } else {
      bicara("Fitur acak tidak tersedia saat ini.");
    }
  } else if (
    teks.includes("buka bantuan") ||
    teks.includes("hint") ||
    teks.includes("petunjuk")
  ) {
    if (gameState.active && gameState.mode === "crossmath") {
      useHint();
      bicara("Menggunakan satu bantuan.");
    } else {
      bicara("Bantuan hanya tersedia di mode Crossmath.");
    }
  }

  // ===========================================
  // 4. KONTROL MUSIK & SISTEM
  // ===========================================
  else if (
    teks.includes("putar musik") ||
    teks.includes("mainkan musik") ||
    teks.includes("lagu")
  ) {
    controlYoutube("PLAY");
  } else if (teks.includes("stop musik") || teks.includes("matikan musik")) {
    controlYoutube("STOP");
  } else if (teks.includes("ganti") || teks.includes("next")) {
    controlYoutube("NEXT");
  } else if (teks.includes("buka pengaturan") || teks.includes("setting")) {
    const context = document
      .querySelector(".game-container")
      .classList.contains("active")
      ? "game"
      : "menu";
    openSettings(context);
    bicara("Membuka pengaturan.");
  } else if (teks.includes("buka profil") || teks.includes("akun")) {
    openProfile();
    bicara("Membuka profil.");
  } else if (teks.includes("tutup")) {
    document
      .querySelectorAll(".modal")
      .forEach((el) => el.classList.remove("show"));
    stopVoiceCommand();
  } else {
    bicara("Maaf, perintah tidak dikenali.");
  }
}

// 5. FUNGSI BICARA (SUARA ROBOT BAWAAN - TANPA ELEVENLABS)
function bicara(teks) {
  // Matikan mic agar tidak mendengar suara sendiri
  if (recognition) recognition.stop();

  const ucapan = new SpeechSynthesisUtterance(teks);
  ucapan.lang = "id-ID"; // Set Bahasa Indonesia
  ucapan.rate = 1.0; // Kecepatan Bicara Normal
  ucapan.pitch = 1.0; // Nada Normal

  window.speechSynthesis.speak(ucapan);
}

// --- FITUR DIAGNOSTIK SYSTEM (PING & FPS) ---

function openDiagnostics() {
  closeSettings(); // Tutup menu setting dulu
  document.getElementById("diag-modal").classList.add("show");
  playSound("popup");
  runSystemCheck();
}

function closeDiag() {
  document.getElementById("diag-modal").classList.remove("show");
}

// [REPLACE] Ganti fungsi runSystemCheck yang lama dengan yang baru ini

function runSystemCheck() {
  const elPing = document.getElementById("diag-ping");
  const elFps = document.getElementById("diag-fps");
  const elLogic = document.getElementById("diag-logic"); // Elemen Baru
  const btn = document.getElementById("btn-retest");

  // Reset UI
  elPing.textContent = "Checking...";
  elFps.textContent = "Checking...";
  elLogic.textContent = "Checking..."; // Reset Logic

  elPing.style.color = "#fff";
  elFps.style.color = "#fff";
  elLogic.style.color = "#fff";

  btn.disabled = true;
  btn.textContent = "MEMPROSES...";

  // 1. INFO PERANGKAT
  document.getElementById("diag-device").textContent =
    navigator.userAgent.slice(0, 30) + "...";
  if (navigator.deviceMemory) {
    document.getElementById(
      "diag-memory"
    ).textContent = `RAM: ~${navigator.deviceMemory} GB`;
  } else {
    document.getElementById("diag-memory").textContent = "RAM: Unknown";
  }

  // 2. CEK PING (Latency)
  const startPing = Date.now();
  fetch(window.location.href + "?t=" + startPing, {
    cache: "no-store",
    method: "HEAD",
  })
    .then(() => {
      const latency = Date.now() - startPing;
      elPing.textContent = latency + " ms";
      if (latency < 100) elPing.style.color = "var(--success)";
      else if (latency < 300) elPing.style.color = "var(--warning)";
      else elPing.style.color = "#ff4444";
    })
    .catch(() => {
      elPing.textContent = "Offline";
      elPing.style.color = "#aaa";
    });

  // 3. CEK LOGIC SPEED (CPU Benchmark) - BARU
  // Kita melakukan 1 juta operasi matematika dan mengukur berapa milidetik yang dibutuhkan
  setTimeout(() => {
    const t0 = performance.now();
    for (let i = 0; i < 2000000; i++) {
      // 2 Juta Loop
      Math.sqrt(i) * Math.random();
    }
    const t1 = performance.now();
    const duration = (t1 - t0).toFixed(1); // Durasi dalam ms

    elLogic.textContent = duration + " ms";

    // Semakin kecil ms, semakin ngebut HP-nya
    if (duration < 15) elLogic.style.color = "var(--success)"; // HP Sultan/PC
    else if (duration < 50)
      elLogic.style.color = "var(--warning)"; // HP Menengah
    else elLogic.style.color = "#ff4444"; // HP Kentang
  }, 100);

  // 4. CEK FPS
  let frames = 0;
  const startFpsTime = Date.now();

  function loop() {
    frames++;
    if (Date.now() - startFpsTime >= 1000) {
      elFps.textContent = frames;
      if (frames >= 50) elFps.style.color = "var(--success)";
      else if (frames >= 30) elFps.style.color = "var(--warning)";
      else elFps.style.color = "#ff4444";

      btn.disabled = false;
      btn.textContent = "TEST ULANG";
    } else {
      requestAnimationFrame(loop);
    }
  }
  requestAnimationFrame(loop);
}
