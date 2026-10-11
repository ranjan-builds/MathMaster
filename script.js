const audioFX = {
  ctx: null,
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  },
  playSuccess() {
    const settings = JSON.parse(
      localStorage.getItem("mathmaster_settings") || '{"sound": true}',
    );
    if (!settings.sound) return;
    try {
      this.init();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, this.ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, this.ctx.currentTime + 0.08); // A5
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.3);
    } catch (e) {}
  },
  playError() {
    const settings = JSON.parse(
      localStorage.getItem("mathmaster_settings") || '{"sound": true}',
    );
    if (!settings.sound) return;
    try {
      this.init();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, this.ctx.currentTime);
      osc.frequency.setValueAtTime(150, this.ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.3);
    } catch (e) {}
  },
};

function showToast(message, isError = false) {
  const toast = document.getElementById("toast-banner");
  const msgEl = document.getElementById("toast-msg");
  const iconEl = document.getElementById("toast-icon");
  msgEl.innerText = message;
  iconEl.innerHTML = isError
    ? '<i data-lucide="alert-circle" class="w-5 h-5 text-rose-400"></i>'
    : '<i data-lucide="check-circle-2" class="w-5 h-5 text-emerald-400"></i>';
  lucide.createIcons();
  toast.classList.remove("translate-y-20", "opacity-0");
  setTimeout(() => {
    toast.classList.add("translate-y-20", "opacity-0");
  }, 3000);
}

class MathMasterApp {
  constructor() {
    this.state = {
      xp: 0,
      streak: 0,
      level: 1,
      testsCompleted: 0,
      totalQuestionsAnswered: 0,
      correctAnswersCount: 0,
      bestStreak: 0,
      mistakes: [],
      tableStats: {},
      dailyCompletedDate: null,
    };
    this.loadData();

    this.session = {
      rangeStart: 1,
      rangeEnd: 10,
      customTables: null,
      mode: "practice",
      questionCount: 20,
      difficulty: "mixed",
      timerEnabled: true,
      soundEnabled: true,
      questions: [],
      currentIndex: 0,
      score: 0,
      correctCount: 0,
      incorrectCount: 0,
      currentStreak: 0,
      maxStreak: 0,
      startTime: 0,
      elapsedSeconds: 0,
      timerInterval: null,
      countdownInterval: null,
      questionStartTime: 0,
      fastestTime: 9999,
      answeredCurrent: false,
      powerMode: 0,
    };

    this.learnState = {
      tableNum: 19,
      hideAnswers: false,
    };
  }

  loadData() {
    const saved = localStorage.getItem("mathmaster_state");
    if (saved) {
      try {
        this.state = Object.assign(this.state, JSON.parse(saved));
      } catch (e) {}
    }
  }

  saveData() {
    localStorage.setItem("mathmaster_state", JSON.stringify(this.state));
    this.updateHeaderStats();
  }

  updateHeaderStats() {
    document.getElementById("header-xp").innerText = `${this.state.xp} XP`;
    document.getElementById("header-streak").innerText =
      `${this.state.streak}d`;
    document.getElementById("header-level").innerText =
      `Lvl ${this.state.level}`;

    const mistakeBadge = document.getElementById("mistake-badge");
    if (this.state.mistakes.length > 0) {
      mistakeBadge.innerText = this.state.mistakes.length;
      mistakeBadge.classList.remove("hidden");
    } else {
      mistakeBadge.classList.add("hidden");
    }
  }

  clearSessionTimers() {
    if (this.session.timerInterval) {
      clearInterval(this.session.timerInterval);
      this.session.timerInterval = null;
    }
    if (this.session.countdownInterval) {
      clearInterval(this.session.countdownInterval);
      this.session.countdownInterval = null;
    }
  }

  startElapsedTimer() {
    this.clearSessionTimers();
    this.session.elapsedSeconds = 0;
    document.getElementById("test-timer-container").classList.remove("hidden");
    this.session.timerInterval = setInterval(() => {
      this.session.elapsedSeconds++;
      const mins = String(
        Math.floor(this.session.elapsedSeconds / 60),
      ).padStart(2, "0");
      const secs = String(this.session.elapsedSeconds % 60).padStart(2, "0");
      document.getElementById("test-timer").innerText = `${mins}:${secs}`;
    }, 1000);
  }

  startCountdownTimer(durationSeconds) {
    this.clearSessionTimers();
    let remaining = durationSeconds;
    document.getElementById("test-timer-container").classList.remove("hidden");
    document.getElementById("test-timer").innerText = `${remaining}s`;

    this.session.countdownInterval = setInterval(() => {
      remaining--;
      this.session.elapsedSeconds = durationSeconds - remaining;
      document.getElementById("test-timer").innerText = `${remaining}s`;
      if (remaining <= 0) {
        clearInterval(this.session.countdownInterval);
        this.session.countdownInterval = null;
        this.finishTest();
      }
    }, 1000);
  }

  getWeakestTableInfo() {
    let weakestTable = null;
    let lowestRatio = 1.1;
    let weakestAccuracy = 100;

    for (let t = 1; t <= 30; t++) {
      const stats = this.state.tableStats[t];
      if (stats && stats.total >= 5) {
        const ratio = stats.correct / stats.total;
        if (ratio < lowestRatio) {
          lowestRatio = ratio;
          weakestTable = t;
          weakestAccuracy = Math.round(ratio * 100);
        }
      }
    }

    if (!weakestTable) {
      return { table: 12, accuracy: 0, total: 0 };
    }

    return {
      table: weakestTable,
      accuracy: weakestAccuracy,
      total: this.state.tableStats[weakestTable].total,
    };
  }

  switchTab(tabId) {
    this.clearSessionTimers();

    document
      .querySelectorAll(".tab-content")
      .forEach((el) => el.classList.add("hidden"));
    document
      .querySelectorAll(".nav-btn")
      .forEach((el) => el.classList.remove("bg-slate-800", "text-white"));

    const targetTab = document.getElementById(`tab-${tabId}`);
    if (targetTab) targetTab.classList.remove("hidden");

    const activeBtn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
    if (activeBtn) activeBtn.classList.add("bg-slate-800", "text-white");

    if (tabId === "dashboard") {
      this.renderDashboardStats();
    } else if (tabId === "learn") {
      this.initLearnTab();
    } else if (tabId === "mistakes") {
      this.renderMistakesNotebook();
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
    lucide.createIcons();
  }

  renderDashboardStats() {
    document.getElementById("stat-tests").innerText = this.state.testsCompleted;
    const totalQ = this.state.totalQuestionsAnswered;
    const acc =
      totalQ > 0
        ? Math.round((this.state.correctAnswersCount / totalQ) * 100)
        : 0;
    document.getElementById("stat-accuracy").innerText = `${acc}%`;
    document.getElementById("stat-streak").innerText = this.state.bestStreak;
    document.getElementById("stat-questions").innerText = totalQ;

    let weakestTable = null;
    let lowestRatio = 1.1;
    for (let t = 1; t <= 30; t++) {
      const stats = this.state.tableStats[t];
      if (stats && stats.total >= 5) {
        const ratio = stats.correct / stats.total;
        if (ratio < lowestRatio) {
          lowestRatio = ratio;
          weakestTable = t;
        }
      }
    }

    const weakAlert = document.getElementById("weak-tables-alert");
    if (weakestTable && lowestRatio < 0.75) {
      document.getElementById("weak-tables-text").innerText =
        `You are struggling with Table ${weakestTable} (Accuracy: ${Math.round(lowestRatio * 100)}%). Targeted practice will help you master it!`;
      weakAlert.classList.remove("hidden");
      this.weakestTableTarget = weakestTable;
    } else {
      weakAlert.classList.add("hidden");
    }
  }

  selectRange(start, end) {
    this.session.rangeStart = start;
    this.session.rangeEnd = end;
    this.session.customTables = null;
    this.session.powerMode = 0;
    document.getElementById("setup-range-title").innerText =
      `Range: ${start} – ${end}`;
    this.switchTab("setup");
  }

  openCustomSetup() {
    const start = parseInt(document.getElementById("custom-start").value) || 1;
    const end = parseInt(document.getElementById("custom-end").value) || 10;
    this.selectRange(Math.min(start, end), Math.max(start, end));
  }

  startCustomRangePractice() {
    const start = parseInt(document.getElementById("custom-start").value);
    const end = parseInt(document.getElementById("custom-end").value);
    if (isNaN(start) || isNaN(end) || start < 1 || end > 30 || start > end) {
      showToast("Please enter a valid range between 1 and 30.", true);
      return;
    }
    this.selectRange(start, end);
  }

  setQuestionCount(count) {
    this.session.questionCount = count;
    document.querySelectorAll(".q-count-btn").forEach((btn) => {
      if (parseInt(btn.getAttribute("data-count")) === count) {
        btn.className =
          "q-count-btn py-2.5 rounded-xl border border-blue-500 bg-blue-600/20 text-blue-400 text-sm font-bold transition";
      } else {
        btn.className =
          "q-count-btn py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-sm font-bold hover:border-blue-500 transition text-slate-300";
      }
    });
  }

  setDifficulty(diff) {
    this.session.difficulty = diff;
    document.querySelectorAll(".diff-btn").forEach((btn) => {
      if (btn.getAttribute("data-diff") === diff) {
        btn.className =
          "diff-btn py-2.5 rounded-xl border border-blue-500 bg-blue-600/20 text-blue-400 text-xs font-bold transition";
      } else {
        btn.className =
          "diff-btn py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-xs font-bold transition text-slate-300";
      }
    });
  }

  startQuickSession() {
    this.selectRange(1, 20);
  }

  startDailyChallenge() {
    this.session.rangeStart = 1;
    this.session.rangeEnd = 25;
    this.session.questionCount = 20;
    this.session.mode = "practice";
    this.session.difficulty = "mixed";
    this.session.timerEnabled = true;
    this.switchTab("test");
    this.initTestSession();
  }

  startWeakTablesPractice() {
    const target = this.getWeakestTableInfo();
    const t = target.table;
    const questionSet = Math.min(
      15,
      Math.max(8, 8 + Math.round((100 - target.accuracy) / 15)),
    );

    this.session.rangeStart = t;
    this.session.rangeEnd = t;
    this.session.customTables = [t];
    this.session.powerMode = 0;
    this.session.questionCount = questionSet;
    this.session.mode = "practice";
    this.session.difficulty = "mixed";
    this.session.timerEnabled = true;
    this.session.soundEnabled = true;

    this.switchTab("test");
    this.initTestSession();
    showToast(`Adaptive booster active: Table ${t} practice started.`);
  }

  startSpecificTablePractice() {
    const t = this.learnState.tableNum;
    this.selectRange(t, t);
  }

  startPowerPractice(power) {
    const max = power === 2 ? 30 : 20;
    this.session.powerMode = power;
    this.session.rangeStart = 1;
    this.session.rangeEnd = max;
    this.session.customTables = null;
    this.session.questionCount = 20;
    this.session.mode = "practice";
    this.session.difficulty = "mixed";
    this.session.timerEnabled = true;
    this.session.soundEnabled = true;
    document.getElementById("setup-range-title").innerText =
      power === 2 ? "Square Sprint · 1²–30²" : "Cube Challenge · 1³–20³";
    this.switchTab("setup");
    showToast(
      power === 2 ? "Square Sprint selected" : "Cube Challenge selected",
    );
  }

  startTest() {
    const modeRadio = document.querySelector(
      'input[name="practice-mode"]:checked',
    );
    this.session.mode = modeRadio ? modeRadio.value : "practice";
    this.session.timerEnabled =
      document.getElementById("setting-timer").checked;
    this.session.soundEnabled =
      document.getElementById("setting-sound").checked;

    this.switchTab("test");
    this.initTestSession();
  }

  initTestSession() {
    // Build the complete valid question pool first, then shuffle it.
    // A question is identified by its operation and operands, so it can
    // appear at most once in this practice session.
    const count = this.session.questionCount;
    const customTables = Array.isArray(this.session.customTables)
      ? this.session.customTables
      : null;
    const tablePool = customTables
      ? [
          ...new Set(
            customTables.filter(
              (n) => Number.isInteger(n) && n >= 1 && n <= 30,
            ),
          ),
        ]
      : Array.from(
          { length: this.session.rangeEnd - this.session.rangeStart + 1 },
          (_, index) => this.session.rangeStart + index,
        );
    let pool = [];

    if (this.session.powerMode === 2) {
      for (let n = 1; n <= 30; n++) {
        pool.push({
          table: n,
          multiplier: n,
          operation: "square",
          answer: n * n,
        });
      }
    } else if (this.session.powerMode === 3) {
      for (let n = 1; n <= 20; n++) {
        pool.push({
          table: n,
          multiplier: n,
          operation: "cube",
          answer: n * n * n,
        });
      }
    } else {
      let multMin = 1,
        multMax = 10;
      const diff = this.session.difficulty;
      if (diff === "easy") {
        multMin = 1;
        multMax = 5;
      } else if (diff === "medium") {
        multMin = 6;
        multMax = 10;
      } else if (diff === "hard") {
        multMin = 11;
        multMax = 20;
      } else if (diff === "mixed") {
        multMin = 1;
        multMax = 20;
      }

      for (const table of tablePool) {
        for (let multiplier = multMin; multiplier <= multMax; multiplier++) {
          pool.push({
            table,
            multiplier,
            operation: "multiply",
            answer: table * multiplier,
          });
        }
      }
    }

    // Fisher–Yates shuffle guarantees random order without replacement.
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    const requestedCount = Number.isFinite(count) ? count : pool.length;
    const actualCount = Math.min(requestedCount, pool.length);
    this.session.questions = pool.slice(0, actualCount);
    if (actualCount < requestedCount) {
      showToast(
        `This setup has only ${pool.length} unique questions. Repeats are disabled; playing all ${pool.length}.`,
        true,
      );
    }
    if (actualCount === 0) {
      showToast("No questions available. Please choose a valid range.", true);
      this.switchTab("setup");
      return;
    }

    this.session.currentIndex = 0;
    this.session.score = 0;
    this.session.correctCount = 0;
    this.session.incorrectCount = 0;
    this.session.currentStreak = 0;
    this.session.maxStreak = 0;
    this.session.startTime = Date.now();
    this.session.elapsedSeconds = 0;
    this.session.fastestTime = 9999;
    this.clearSessionTimers();

    document
      .getElementById("test-timer-container")
      .classList.toggle("hidden", !this.session.timerEnabled);
    if (this.session.timerEnabled) this.startElapsedTimer();
    this.loadCurrentQuestion();
  }

  loadCurrentQuestion() {
    const q = this.session.questions[this.session.currentIndex];
    document.getElementById("question-display").innerText =
      q.operation === "square"
        ? `${q.table}² = ?`
        : q.operation === "cube"
          ? `${q.table}³ = ?`
          : `${q.table} × ${q.multiplier} = ?`;
    document.getElementById("test-progress-text").innerText =
      `Question ${this.session.currentIndex + 1} of ${this.session.questions.length}`;

    const pct =
      (this.session.currentIndex / this.session.questions.length) * 100;
    document.getElementById("test-progress-bar").style.width = `${pct}%`;
    document.getElementById("test-score").innerText = this.session.score;

    const input = document.getElementById("answer-input");
    input.value = "";
    input.disabled = false;
    input.focus();

    document.getElementById("next-btn").classList.add("hidden");
    document.getElementById("feedback-banner").classList.add("hidden");

    this.session.questionStartTime = Date.now();
    this.session.answeredCurrent = false;

    // Bind auto-submit listener on input
    input.oninput = (e) => {
      if (this.session.answeredCurrent) return;
      const val = parseInt(e.target.value);
      if (!isNaN(val) && val === q.answer) {
        this.submitAnswer();
      }
    };

    input.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (this.session.answeredCurrent) {
          this.nextQuestion();
        } else {
          this.submitAnswer();
        }
      }
    };

    if (this.session.currentStreak >= 2) {
      const badge = document.getElementById("test-streak-badge");
      document.getElementById("test-streak-count").innerText =
        `Streak x${this.session.currentStreak}`;
      badge.classList.remove("hidden");
    } else {
      document.getElementById("test-streak-badge").classList.add("hidden");
    }
  }

  submitAnswer() {
    if (this.session.answeredCurrent) return;

    const input = document.getElementById("answer-input");
    const val = parseInt(input.value);
    if (isNaN(val)) return;

    this.session.answeredCurrent = true;
    input.disabled = true;

    const q = this.session.questions[this.session.currentIndex];
    const isCorrect = val === q.answer;
    const timeTaken = (Date.now() - this.session.questionStartTime) / 1000;

    if (!this.state.tableStats[q.table]) {
      this.state.tableStats[q.table] = { correct: 0, total: 0 };
    }
    this.state.tableStats[q.table].total++;

    const feedbackBanner = document.getElementById("feedback-banner");
    const feedbackIcon = document.getElementById("feedback-icon");
    const feedbackTitle = document.getElementById("feedback-title");
    const feedbackDesc = document.getElementById("feedback-desc");
    feedbackBanner.classList.remove("hidden");

    if (isCorrect) {
      audioFX.playSuccess();
      this.session.correctCount++;
      this.state.correctAnswersCount++;
      this.state.tableStats[q.table].correct++;
      this.session.currentStreak++;
      if (this.session.currentStreak > this.session.maxStreak) {
        this.session.maxStreak = this.session.currentStreak;
      }
      if (this.session.currentStreak > this.state.bestStreak) {
        this.state.bestStreak = this.session.currentStreak;
      }
      if (timeTaken < this.session.fastestTime) {
        this.session.fastestTime = timeTaken;
      }

      const points = 10 + Math.min(this.session.currentStreak * 2, 20);
      this.session.score += points;

      feedbackBanner.className =
        "rounded-2xl p-4 text-left bg-emerald-950/40 border border-emerald-600/40 animate-fadeIn";
      feedbackIcon.className =
        "p-2 rounded-xl bg-emerald-500/20 text-emerald-400";
      feedbackIcon.innerHTML = '<i data-lucide="check" class="w-6 h-6"></i>';
      feedbackTitle.className = "font-bold text-base text-emerald-300";
      feedbackTitle.innerText = "Excellent! Correct answer.";
      feedbackDesc.innerText = `${q.operation === "square" ? `${q.table}²` : q.operation === "cube" ? `${q.table}³` : `${q.table} × ${q.multiplier}`} = ${q.answer} (${timeTaken.toFixed(1)}s)`;

      lucide.createIcons();

      // Auto advance after correct answer in practice/learn/timed mode
      setTimeout(() => {
        if (this.session.answeredCurrent) {
          this.nextQuestion();
        }
      }, 400);
    } else {
      audioFX.playError();
      this.session.incorrectCount++;
      this.session.currentStreak = 0;

      this.state.mistakes.push({
        table: q.table,
        multiplier: q.multiplier,
        userAnswer: val,
        correctAnswer: q.answer,
        date: new Date().toLocaleDateString(),
      });

      feedbackBanner.className =
        "rounded-2xl p-4 text-left bg-rose-950/40 border border-rose-600/40 animate-fadeIn";
      feedbackIcon.className = "p-2 rounded-xl bg-rose-500/20 text-rose-400";
      feedbackIcon.innerHTML = '<i data-lucide="x" class="w-6 h-6"></i>';
      feedbackTitle.className = "font-bold text-base text-rose-300";
      feedbackTitle.innerText = `Incorrect. Correct answer is ${q.answer}`;

      let explanation =
        q.operation === "square"
          ? `${q.table} × ${q.table} = ${q.answer}.`
          : q.operation === "cube"
            ? `${q.table} × ${q.table} × ${q.table} = ${q.answer}.`
            : `${q.table} × ${q.multiplier} = ${q.answer}.`;
      if (q.multiplier === 9) {
        explanation = `Shortcut: (${q.table} × 10) − ${q.table} = ${q.table * 10} − ${q.table} = ${q.answer}`;
      } else if (q.multiplier === 11 && q.table < 10) {
        explanation = `Shortcut: Separate digits and insert sum in middle: ${q.answer}`;
      } else {
        const base10 = Math.floor(q.multiplier / 10) * 10;
        if (base10 > 0) {
          const rem = q.multiplier - base10;
          explanation = `Mental math: (${q.table} × ${base10}) + (${q.table} × ${rem}) = ${q.table * base10} + ${q.table * rem} = ${q.answer}`;
        }
      }
      feedbackDesc.innerText = explanation;
      lucide.createIcons();
      document.getElementById("next-btn").classList.remove("hidden");
      document.getElementById("next-btn").focus();
    }

    if (this.session.mode === "exam") {
      setTimeout(() => {
        this.nextQuestion();
      }, 500);
    }
  }

  nextQuestion() {
    this.session.currentIndex++;
    if (this.session.currentIndex >= this.session.questions.length) {
      this.finishTest();
    } else {
      this.loadCurrentQuestion();
    }
  }

  exitTest() {
    this.clearSessionTimers();
    this.switchTab("dashboard");
  }

  finishTest() {
    this.clearSessionTimers();

    this.state.testsCompleted++;
    this.state.totalQuestionsAnswered += this.session.questions.length;

    const earnedXP = this.session.score;
    this.state.xp += earnedXP;
    this.state.level = Math.floor(this.state.xp / 300) + 1;

    this.saveData();

    document.getElementById("res-score").innerText = this.session.score;
    const acc = Math.round(
      (this.session.correctCount / this.session.questions.length) * 100,
    );
    document.getElementById("res-accuracy").innerText = `${acc}%`;
    document.getElementById("res-counts").innerText =
      `${this.session.correctCount} / ${this.session.questions.length}`;
    document.getElementById("res-time").innerText =
      `${this.session.elapsedSeconds}s`;

    const avgT = (
      this.session.elapsedSeconds / this.session.questions.length
    ).toFixed(1);
    document.getElementById("res-avg-time").innerText = `${avgT}s`;
    document.getElementById("res-streak").innerText = this.session.maxStreak;
    document.getElementById("res-fastest").innerText =
      this.session.fastestTime === 9999
        ? "N/A"
        : `${this.session.fastestTime.toFixed(1)}s`;
    document.getElementById("res-xp").innerText = `+${earnedXP} XP`;

    const tierBadge = document.getElementById("results-tier-badge");
    if (acc >= 95) {
      tierBadge.innerText = "Math Master (95–100%)";
      tierBadge.className =
        "bg-purple-500/10 text-purple-400 text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider border border-purple-500/20";
    } else if (acc >= 85) {
      tierBadge.innerText = "Excellent (85–94%)";
      tierBadge.className =
        "bg-blue-500/10 text-blue-400 text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider border border-blue-500/20";
    } else if (acc >= 70) {
      tierBadge.innerText = "Good Progress (70–84%)";
      tierBadge.className =
        "bg-emerald-500/10 text-emerald-400 text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider border border-emerald-500/20";
    } else if (acc >= 50) {
      tierBadge.innerText = "Getting Better (50–69%)";
      tierBadge.className =
        "bg-amber-500/10 text-amber-400 text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider border border-amber-500/20";
    } else {
      tierBadge.innerText = "Keep Practicing (<50%)";
      tierBadge.className =
        "bg-rose-500/10 text-rose-400 text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider border border-rose-500/20";
    }

    const reviewBtn = document.getElementById("review-mistakes-btn");
    if (this.state.mistakes.length > 0) reviewBtn.classList.remove("hidden");
    else reviewBtn.classList.add("hidden");

    this.switchTab("results");
  }

  repeatTest() {
    this.switchTab("test");
    this.initTestSession();
  }

  initLearnTab() {
    const select = document.getElementById("learn-table-select");
    if (select.children.length === 0) {
      let html = "";
      for (let i = 1; i <= 30; i++) {
        html += `<option value="${i}">Table of ${i}</option>`;
      }
      select.innerHTML = html;
      select.value = "19";
    }
    this.renderLearnTable();
  }

  renderLearnTable() {
    const t =
      parseInt(document.getElementById("learn-table-select").value) || 19;
    this.learnState.tableNum = t;
    document.getElementById("learn-table-title").innerText =
      `Multiplication Table of ${t}`;

    let gridHtml = "";
    for (let i = 1; i <= 20; i++) {
      const ans = t * i;
      const displayAns = this.learnState.hideAnswers ? "••••" : ans;
      gridHtml += `
                        <div class="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between font-mono">
                            <span class="text-slate-300 font-bold">${t} × ${i}</span>
                            <span class="text-blue-400 font-black text-lg">${displayAns}</span>
                        </div>
                    `;
    }
    document.getElementById("learn-table-grid").innerHTML = gridHtml;
  }

  toggleAnswersVisibility() {
    this.learnState.hideAnswers = !this.learnState.hideAnswers;
    const btnText = document.getElementById("toggle-answers-text");
    const btn = document.getElementById("toggle-answers-btn");
    if (this.learnState.hideAnswers) {
      btnText.innerText = "Reveal Answers";
      btn.innerHTML =
        '<i data-lucide="eye" class="w-4 h-4"></i><span id="toggle-answers-text">Reveal Answers</span>';
    } else {
      btnText.innerText = "Hide Answers";
      btn.innerHTML =
        '<i data-lucide="eye-off" class="w-4 h-4"></i><span id="toggle-answers-text">Hide Answers</span>';
    }
    lucide.createIcons();
    this.renderLearnTable();
  }

  startSpeedChallenge(durationSeconds) {
    this.session.rangeStart = 1;
    this.session.rangeEnd = 20;
    this.session.questionCount = 999;
    this.session.mode = "timed";
    this.session.difficulty = "mixed";
    this.session.timerEnabled = false;
    this.session.customTables = null;
    this.session.powerMode = 0;
    this.switchTab("test");
    this.initTestSession();
    this.startCountdownTimer(durationSeconds);
  }

  renderMistakesNotebook() {
    const container = document.getElementById("mistakes-container");
    if (this.state.mistakes.length === 0) {
      container.innerHTML = `
                        <div class="bg-cardBg border border-slate-800/80 rounded-3xl p-12 text-center space-y-3 shadow-md">
                            <i data-lucide="check-circle-2" class="w-12 h-12 text-emerald-400 mx-auto"></i>
                            <h3 class="font-bold text-lg text-white">No Mistakes Recorded!</h3>
                            <p class="text-slate-400 text-sm">Great job! You haven't made any mistakes yet, or your notebook is clear.</p>
                        </div>
                    `;
      lucide.createIcons();
      return;
    }

    let html = "";
    this.state.mistakes.forEach((m, idx) => {
      html += `
                        <div class="bg-cardBg border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-md">
                            <div class="flex items-center space-x-4">
                                <div class="p-3 bg-rose-500/10 text-rose-400 rounded-xl font-bold font-mono text-lg border border-rose-500/20">
                                    ${m.table} × ${m.multiplier}
                                </div>
                                <div>
                                    <p class="text-xs text-slate-400">Practiced on ${m.date}</p>
                                    <p class="text-sm mt-0.5 text-slate-300">Your answer: <span class="text-rose-400 font-bold">${m.userAnswer}</span> | Correct: <span class="text-emerald-400 font-bold">${m.correctAnswer}</span></p>
                                </div>
                            </div>
                            <button onclick="app.removeMistake(${idx})" class="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold px-3 py-2 rounded-xl transition">
                                Mastered
                            </button>
                        </div>
                    `;
    });
    container.innerHTML = html;
    lucide.createIcons();
  }

  removeMistake(index) {
    this.state.mistakes.splice(index, 1);
    this.saveData();
    this.renderMistakesNotebook();
  }

  clearMistakes() {
    this.state.mistakes = [];
    this.saveData();
    this.renderMistakesNotebook();
    showToast("Mistake notebook cleared successfully.");
  }
}

const app = new MathMasterApp();
window.onload = function () {
  app.switchTab("dashboard");
  lucide.createIcons();
};
