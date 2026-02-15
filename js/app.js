// ラスベガス ゴルフ - メインアプリ

let App = {
  // --- State ---
  courses: [],
  gameState: null,

  // --- Init ---
  async init() {
    await this.loadCourses();
    this.bindEvents();

    if (Storage.hasSavedGame()) {
      document.getElementById('resume-btn').style.display = 'block';
    }

    this.showScreen('start-screen');
  },

  async loadCourses() {
    const res = await fetch('data/courses.json');
    this.courses = await res.json();
  },

  // --- Screen management ---
  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
  },

  // --- Event binding ---
  bindEvents() {
    // Start screen
    document.getElementById('new-game-btn').addEventListener('click', () => this.startSetup());
    document.getElementById('resume-btn').addEventListener('click', () => this.resumeGame());

    // Setup steps
    document.getElementById('setup-next-1').addEventListener('click', () => this.setupStep1Next());
    document.getElementById('setup-back-2').addEventListener('click', () => this.showSetupStep(1));
    document.getElementById('setup-next-2').addEventListener('click', () => this.setupStep2Next());
    document.getElementById('setup-back-3').addEventListener('click', () => this.showSetupStep(2));
    document.getElementById('setup-next-3').addEventListener('click', () => this.setupStep3Next());
    document.getElementById('setup-back-4').addEventListener('click', () => this.showSetupStep(3));
    document.getElementById('setup-next-4').addEventListener('click', () => this.setupStep4Next());
    document.getElementById('setup-back-5').addEventListener('click', () => this.showSetupStep(4));
    document.getElementById('round-start-btn').addEventListener('click', () => this.startRound());

    // Handicap checkbox
    document.getElementById('hc-enable').addEventListener('change', (e) => this.toggleHandicap(e.target.checked));

    // Course search
    document.getElementById('course-search').addEventListener('input', (e) => this.filterCourses(e.target.value));

    // Round screen
    document.getElementById('next-hole-btn').addEventListener('click', () => this.nextHole());
    document.getElementById('prev-hole-btn').addEventListener('click', () => this.prevHole());
    document.getElementById('scoreboard-btn').addEventListener('click', () => this.showScoreboard());

    // Scoreboard
    document.getElementById('back-to-round-btn').addEventListener('click', () => {
      this.showScreen('round-screen');
      this.renderHole();
    });
    document.getElementById('new-game-from-result-btn').addEventListener('click', () => {
      Storage.clearGame();
      location.reload();
    });
  },

  // ============================
  // SETUP FLOW
  // ============================
  startSetup() {
    this.showScreen('setup-screen');
    this.renderCourseList();
    this.showSetupStep(1);
  },

  showSetupStep(step) {
    document.querySelectorAll('.setup-step').forEach(s => s.classList.remove('active'));
    document.getElementById(`setup-step-${step}`).classList.add('active');
  },

  // --- Step 1: Course selection & Player names ---
  renderCourseList(filter = '') {
    const list = document.getElementById('course-list');
    const allCourses = [...this.courses, ...Storage.loadCustomCourses()];
    const lowerFilter = filter.toLowerCase();
    const filtered = filter
      ? allCourses.filter(c =>
          c.name.toLowerCase().includes(lowerFilter) ||
          (c.prefecture || '').toLowerCase().includes(lowerFilter))
      : allCourses;

    // Group by prefecture
    const grouped = {};
    filtered.forEach(c => {
      const pref = c.prefecture || 'その他';
      if (!grouped[pref]) grouped[pref] = [];
      grouped[pref].push(c);
    });

    list.innerHTML = '';
    if (filtered.length === 0) {
      list.innerHTML = '<p class="empty-msg">該当するコースがありません</p>';
      return;
    }

    Object.keys(grouped).sort().forEach(pref => {
      const group = document.createElement('div');
      group.className = 'course-group';
      group.innerHTML = `<h4 class="pref-label">${pref}</h4>`;
      grouped[pref].forEach(course => {
        const item = document.createElement('div');
        item.className = 'course-item';
        item.textContent = course.name;
        item.dataset.courseId = course.id;
        item.addEventListener('click', () => this.selectCourse(course));
        group.appendChild(item);
      });
      list.appendChild(group);
    });
  },

  selectCourse(course) {
    this._selectedCourse = course;
    document.querySelectorAll('.course-item').forEach(el => el.classList.remove('selected'));
    const el = document.querySelector(`.course-item[data-course-id="${course.id}"]`);
    if (el) el.classList.add('selected');
    document.getElementById('selected-course-name').textContent = course.name;
  },

  filterCourses(query) {
    this.renderCourseList(query);
  },

  setupStep1Next() {
    // Validate course selection
    if (!this._selectedCourse) {
      alert('ゴルフ場を選択してください');
      return;
    }
    // Validate player names
    const names = [];
    for (let i = 0; i < 4; i++) {
      const name = document.getElementById(`player-name-${i}`).value.trim();
      if (!name) {
        alert(`プレイヤー${i + 1}の名前を入力してください`);
        return;
      }
      names.push(name);
    }
    this._playerNames = names;

    // Show Step 2: Course info
    this.renderCourseInfo();
    this.showSetupStep(2);
  },

  // --- Step 2: Course info display ---
  renderCourseInfo() {
    const course = this._selectedCourse;
    const tbody = document.getElementById('course-info-body');
    tbody.innerHTML = '';
    document.getElementById('course-info-title').textContent = course.name;

    course.holes.forEach(h => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${h.hole}</td><td>${h.par}</td><td>${h.hdcp}</td>`;
      tbody.appendChild(tr);
    });
  },

  setupStep2Next() {
    this.renderHandicapSetup();
    this.showSetupStep(3);
  },

  // --- Step 3: Handicap setup ---
  toggleHandicap(enabled) {
    document.getElementById('hc-settings').style.display = enabled ? 'block' : 'none';
  },

  renderHandicapSetup() {
    const container = document.getElementById('hc-settings');
    container.innerHTML = '';

    this._playerNames.forEach((name, pIdx) => {
      const div = document.createElement('div');
      div.className = 'hc-player-section';

      // Player name + HC count input
      const header = document.createElement('div');
      header.className = 'hc-player-header';
      header.innerHTML = `
        <span class="hc-player-name">${name}</span>
        <label>ハンディキャップ数:
          <input type="number" id="hc-count-${pIdx}" min="0" max="18" value="0"
                 class="hc-count-input" data-player="${pIdx}">
        </label>
      `;
      div.appendChild(header);

      // Hole selection grid
      const grid = document.createElement('div');
      grid.className = 'hc-hole-grid';
      grid.id = `hc-grid-${pIdx}`;

      this._selectedCourse.holes.forEach(h => {
        const btn = document.createElement('button');
        btn.className = 'hc-hole-btn';
        btn.textContent = h.hole;
        btn.dataset.hole = h.hole;
        btn.dataset.player = pIdx;
        btn.addEventListener('click', () => this.toggleHcHole(pIdx, h.hole, btn));
        grid.appendChild(btn);
      });
      div.appendChild(grid);

      // Selected count display
      const countDisplay = document.createElement('div');
      countDisplay.className = 'hc-selected-count';
      countDisplay.id = `hc-selected-count-${pIdx}`;
      countDisplay.textContent = '選択: 0';
      div.appendChild(countDisplay);

      container.appendChild(div);
    });

    // Initialize HC holes storage
    this._handicapHoles = [[], [], [], []];
  },

  toggleHcHole(playerIdx, holeNum, btnEl) {
    const maxCount = parseInt(document.getElementById(`hc-count-${playerIdx}`).value) || 0;
    const holes = this._handicapHoles[playerIdx];
    const idx = holes.indexOf(holeNum);

    if (idx >= 0) {
      holes.splice(idx, 1);
      btnEl.classList.remove('selected');
    } else {
      if (holes.length >= maxCount) {
        alert(`最大${maxCount}ホールまで選択できます`);
        return;
      }
      holes.push(holeNum);
      btnEl.classList.add('selected');
    }

    document.getElementById(`hc-selected-count-${playerIdx}`).textContent =
      `選択: ${holes.length} / ${maxCount}`;
  },

  setupStep3Next() {
    const hcEnabled = document.getElementById('hc-enable').checked;
    if (hcEnabled) {
      for (let i = 0; i < 4; i++) {
        const maxCount = parseInt(document.getElementById(`hc-count-${i}`).value) || 0;
        if (this._handicapHoles[i].length !== maxCount && maxCount > 0) {
          alert(`${this._playerNames[i]}さんのハンディキャップホールを${maxCount}個選択してください（現在${this._handicapHoles[i].length}個）`);
          return;
        }
      }
    } else {
      this._handicapHoles = [[], [], [], []];
    }

    this.renderBattingOrder();
    this.showSetupStep(4);
  },

  // --- Step 4: 1H batting order ---
  renderBattingOrder() {
    const container = document.getElementById('batting-order-list');
    container.innerHTML = '';
    this._battingOrder = [0, 0, 0, 0]; // 未設定

    this._playerNames.forEach((name, pIdx) => {
      const row = document.createElement('div');
      row.className = 'batting-order-row';

      const nameEl = document.createElement('span');
      nameEl.className = 'bo-player-name';
      nameEl.textContent = name;

      const orderBtn = document.createElement('button');
      orderBtn.className = 'bo-order-btn';
      orderBtn.textContent = '未設定';
      orderBtn.dataset.player = pIdx;
      orderBtn.addEventListener('click', () => this.cycleBattingOrder(pIdx, orderBtn));

      row.appendChild(nameEl);
      row.appendChild(orderBtn);
      container.appendChild(row);
    });
  },

  cycleBattingOrder(playerIdx, btnEl) {
    const labels = ['未設定', 'オーナー', '2番目', '3番目', '4番目'];
    const current = this._battingOrder[playerIdx];
    // Find next available order
    let next = current + 1;
    if (next > 4) next = 0;

    // If setting to a number, check if already taken by another player
    while (next > 0 && next <= 4) {
      const taken = this._battingOrder.some((v, i) => i !== playerIdx && v === next);
      if (!taken) break;
      next++;
      if (next > 4) { next = 0; break; }
    }

    // Clear old value
    this._battingOrder[playerIdx] = next;
    btnEl.textContent = labels[next];
    btnEl.className = 'bo-order-btn' + (next > 0 ? ' assigned' : '');
  },

  setupStep4Next() {
    // Validate all players have unique orders
    const orders = this._battingOrder;
    if (orders.includes(0)) {
      alert('全プレイヤーの打順を設定してください');
      return;
    }
    const unique = new Set(orders);
    if (unique.size !== 4) {
      alert('打順が重複しています。全員異なる打順を設定してください');
      return;
    }

    this.renderConfirmation();
    this.showSetupStep(5);
  },

  // --- Step 5: Confirmation ---
  renderConfirmation() {
    const container = document.getElementById('confirmation-content');
    const orderLabels = ['', 'オーナー', '2番目', '3番目', '4番目'];
    const hcEnabled = document.getElementById('hc-enable').checked;

    let html = `<div class="confirm-section">
      <h4>ゴルフ場</h4>
      <p>${this._selectedCourse.name}</p>
    </div>`;

    html += `<div class="confirm-section">
      <h4>プレイヤー & 打順</h4>
      <table class="confirm-table">
        <thead><tr><th>プレイヤー</th><th>1H打順</th>${hcEnabled ? '<th>HCホール</th>' : ''}</tr></thead>
        <tbody>`;
    this._playerNames.forEach((name, i) => {
      const hcHoles = this._handicapHoles[i];
      html += `<tr>
        <td>${name}</td>
        <td>${orderLabels[this._battingOrder[i]]}</td>
        ${hcEnabled ? `<td>${hcHoles.length > 0 ? hcHoles.sort((a,b)=>a-b).join(', ') : 'なし'}</td>` : ''}
      </tr>`;
    });
    html += `</tbody></table></div>`;

    container.innerHTML = html;
  },

  // ============================
  // ROUND
  // ============================
  startRound() {
    this.gameState = {
      course: this._selectedCourse,
      playerNames: this._playerNames,
      battingOrder: this._battingOrder,
      handicapHoles: this._handicapHoles,
      currentHole: 1,
      holeScores: {},   // { 1: [scores], 2: [scores], ... }
      holeResults: {},  // { 1: { result }, ... }
    };
    Storage.saveGame(this.gameState);
    this.showScreen('round-screen');
    this.renderHole();
  },

  resumeGame() {
    this.gameState = Storage.loadGame();
    if (!this.gameState) {
      alert('保存データが見つかりません');
      return;
    }
    this.showScreen('round-screen');
    this.renderHole();
  },

  renderHole() {
    const gs = this.gameState;
    const hole = gs.currentHole;
    const courseHole = gs.course.holes.find(h => h.hole === hole);

    // Header
    document.getElementById('hole-number').textContent = hole;
    document.getElementById('hole-par').textContent = courseHole ? courseHole.par : '-';

    // Determine teams for display
    let teams, rankings;
    if (hole === 1) {
      teams = LasVegas.formTeamsFromBattingOrder(gs.battingOrder);
    } else {
      const prevScores = gs.holeScores[hole - 1];
      if (prevScores) {
        rankings = LasVegas.calcRankings(prevScores);
        teams = LasVegas.formTeams(rankings);
      }
    }

    // Team display
    const teamDisplay = document.getElementById('team-display');
    if (teams) {
      const [a1, a2] = teams.teamA;
      const [b1, b2] = teams.teamB;
      teamDisplay.innerHTML = `
        <div class="team team-a">
          <span class="team-label">チームA</span>
          <span class="team-members">${gs.playerNames[a1]} & ${gs.playerNames[a2]}</span>
        </div>
        <div class="team-vs">VS</div>
        <div class="team team-b">
          <span class="team-label">チームB</span>
          <span class="team-members">${gs.playerNames[b1]} & ${gs.playerNames[b2]}</span>
        </div>`;
    } else {
      teamDisplay.innerHTML = '<p>前ホールのスコアを入力してください</p>';
    }

    // Score inputs
    const inputArea = document.getElementById('score-inputs');
    inputArea.innerHTML = '';
    const existingScores = gs.holeScores[hole] || [0, 0, 0, 0];

    gs.playerNames.forEach((name, pIdx) => {
      const isHcHole = gs.handicapHoles[pIdx].includes(hole);
      const row = document.createElement('div');
      row.className = 'score-input-row';

      row.innerHTML = `
        <span class="score-player-name">${name}</span>
        ${isHcHole ? '<span class="hc-badge">HC</span>' : ''}
        <div class="score-control">
          <button class="score-btn minus" data-player="${pIdx}">-</button>
          <input type="number" class="score-value" id="score-${pIdx}"
                 value="${existingScores[pIdx] || (courseHole ? courseHole.par : 4)}"
                 min="1" max="20" data-player="${pIdx}">
          <button class="score-btn plus" data-player="${pIdx}">+</button>
        </div>`;
      inputArea.appendChild(row);
    });

    // Bind +/- buttons
    inputArea.querySelectorAll('.score-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const pIdx = parseInt(e.target.dataset.player);
        const input = document.getElementById(`score-${pIdx}`);
        let val = parseInt(input.value) || 0;
        if (e.target.classList.contains('plus')) val++;
        else if (val > 1) val--;
        input.value = val;
        this.updateHoleResult();
      });
    });

    // Bind direct input
    inputArea.querySelectorAll('.score-value').forEach(input => {
      input.addEventListener('change', () => this.updateHoleResult());
    });

    // Navigation
    document.getElementById('prev-hole-btn').style.visibility = hole > 1 ? 'visible' : 'hidden';
    const isLastHole = hole >= gs.course.holes.length;
    document.getElementById('next-hole-btn').textContent = isLastHole ? '結果を見る' : '次のホールへ';

    // Update result
    this.updateHoleResult();

    // Cumulative points
    this.renderCumulativePoints();
  },

  updateHoleResult() {
    const gs = this.gameState;
    const hole = gs.currentHole;

    // Read scores
    const rawScores = [];
    for (let i = 0; i < 4; i++) {
      rawScores.push(parseInt(document.getElementById(`score-${i}`).value) || 0);
    }

    // Apply handicap
    const scores = LasVegas.applyHandicap(rawScores, hole, gs.handicapHoles);

    // Store raw scores
    gs.holeScores[hole] = rawScores;

    // Get teams
    let teams;
    if (hole === 1) {
      teams = LasVegas.formTeamsFromBattingOrder(gs.battingOrder);
    } else {
      const prevScores = gs.holeScores[hole - 1];
      if (prevScores) {
        const rankings = LasVegas.calcRankings(prevScores);
        teams = LasVegas.formTeams(rankings);
      } else {
        return; // Can't calculate without previous hole
      }
    }

    // Calculate
    const result = LasVegas.calcHolePoints(scores, teams);
    gs.holeResults[hole] = result;

    // Display result
    const resultDiv = document.getElementById('hole-result');
    const [a1, a2] = teams.teamA;
    const [b1, b2] = teams.teamB;

    const hcInfoA1 = gs.handicapHoles[a1].includes(hole) ? ' (HC-1)' : '';
    const hcInfoA2 = gs.handicapHoles[a2].includes(hole) ? ' (HC-1)' : '';
    const hcInfoB1 = gs.handicapHoles[b1].includes(hole) ? ' (HC-1)' : '';
    const hcInfoB2 = gs.handicapHoles[b2].includes(hole) ? ' (HC-1)' : '';

    resultDiv.innerHTML = `
      <div class="result-row">
        <div class="result-team">
          <span class="result-team-label">チームA</span>
          <span>${gs.playerNames[a1]}${hcInfoA1}: ${scores[a1]}  ${gs.playerNames[a2]}${hcInfoA2}: ${scores[a2]}</span>
          <span class="lv-number">${result.lasVegasA}</span>
        </div>
        <div class="result-vs">vs</div>
        <div class="result-team">
          <span class="result-team-label">チームB</span>
          <span>${gs.playerNames[b1]}${hcInfoB1}: ${scores[b1]}  ${gs.playerNames[b2]}${hcInfoB2}: ${scores[b2]}</span>
          <span class="lv-number">${result.lasVegasB}</span>
        </div>
      </div>
      <div class="result-points">
        <span class="diff-label">差: ${Math.abs(result.diff)} → ${result.roundedDiff}点</span>
        <div class="points-list">
          ${gs.playerNames.map((name, i) =>
            `<span class="point-item ${result.points[i] > 0 ? 'win' : result.points[i] < 0 ? 'lose' : 'draw'}">
              ${name}: ${result.points[i] > 0 ? '+' : ''}${result.points[i]}
            </span>`
          ).join('')}
        </div>
      </div>`;

    // Save
    Storage.saveGame(gs);
  },

  renderCumulativePoints() {
    const gs = this.gameState;
    const totals = LasVegas.calcTotalPoints(
      Object.values(gs.holeResults).filter(Boolean)
    );
    const container = document.getElementById('cumulative-points');
    container.innerHTML = `<h3>累計ポイント</h3>
      <div class="cumulative-list">
        ${gs.playerNames.map((name, i) =>
          `<span class="cumulative-item ${totals[i] > 0 ? 'win' : totals[i] < 0 ? 'lose' : ''}">
            ${name}: ${totals[i] > 0 ? '+' : ''}${totals[i]}
          </span>`
        ).join('')}
      </div>`;
  },

  nextHole() {
    const gs = this.gameState;
    if (gs.currentHole >= gs.course.holes.length) {
      this.showScoreboard();
      return;
    }
    gs.currentHole++;
    Storage.saveGame(gs);
    this.renderHole();
  },

  prevHole() {
    const gs = this.gameState;
    if (gs.currentHole <= 1) return;
    gs.currentHole--;
    Storage.saveGame(gs);
    this.renderHole();
  },

  // ============================
  // SCOREBOARD
  // ============================
  showScoreboard() {
    this.showScreen('scoreboard-screen');
    this.renderScoreboard();
  },

  renderScoreboard() {
    const gs = this.gameState;
    this.renderScorecard(gs);
    this.renderLVPointsTable(gs);
  },

  // --- Golf Scorecard (reference image style) ---
  renderScorecard(gs) {
    const holes = gs.course.holes;
    const front9 = holes.filter(h => h.hole <= 9);
    const back9 = holes.filter(h => h.hole >= 10);

    // Header
    const header = document.getElementById('scorecard-header');
    header.innerHTML = '<th class="sc-label-col"></th><th class="sc-par-col">PAR</th>';
    gs.playerNames.forEach(name => {
      header.innerHTML += `<th class="sc-player-col">${name}</th>`;
    });

    const tbody = document.getElementById('scorecard-body');
    tbody.innerHTML = '';

    // Helper: add a hole row
    const addHoleRow = (holeInfo) => {
      const h = holeInfo.hole;
      const rawScores = gs.holeScores[h];
      const tr = document.createElement('tr');

      let cells = `<td class="sc-label">${h}</td><td class="sc-par">${holeInfo.par}</td>`;
      for (let i = 0; i < 4; i++) {
        const score = rawScores ? rawScores[i] : null;
        if (score !== null) {
          const diff = score - holeInfo.par;
          let cls = 'sc-even';
          if (diff <= -2) cls = 'sc-eagle';
          else if (diff === -1) cls = 'sc-birdie';
          else if (diff === 1) cls = 'sc-bogey';
          else if (diff >= 2) cls = 'sc-dblbogey';
          cells += `<td class="sc-score ${cls}">${score}</td>`;
        } else {
          cells += `<td class="sc-score">-</td>`;
        }
      }
      tr.innerHTML = cells;
      tbody.appendChild(tr);
    };

    // Helper: add subtotal row
    const addSubtotalRow = (label, parTotal, scoreTotals, cssClass) => {
      const tr = document.createElement('tr');
      tr.className = cssClass;
      let cells = `<td class="sc-label">${label}</td><td class="sc-par">${parTotal}</td>`;
      for (let i = 0; i < 4; i++) {
        cells += `<td class="sc-score">${scoreTotals[i] > 0 ? scoreTotals[i] : '-'}</td>`;
      }
      tr.innerHTML = cells;
      tbody.appendChild(tr);
    };

    // Front 9
    let outPar = 0;
    const outScores = [0, 0, 0, 0];
    const outHasScore = [false, false, false, false];
    front9.forEach(holeInfo => {
      addHoleRow(holeInfo);
      outPar += holeInfo.par;
      const rawScores = gs.holeScores[holeInfo.hole];
      if (rawScores) {
        for (let i = 0; i < 4; i++) {
          outScores[i] += rawScores[i];
          outHasScore[i] = true;
        }
      }
    });

    // OUT row
    const outDisplay = outScores.map((s, i) => outHasScore[i] ? s : 0);
    addSubtotalRow('OUT', outPar, outDisplay, 'sc-subtotal-row');

    // Back 9
    let inPar = 0;
    const inScores = [0, 0, 0, 0];
    const inHasScore = [false, false, false, false];
    back9.forEach(holeInfo => {
      addHoleRow(holeInfo);
      inPar += holeInfo.par;
      const rawScores = gs.holeScores[holeInfo.hole];
      if (rawScores) {
        for (let i = 0; i < 4; i++) {
          inScores[i] += rawScores[i];
          inHasScore[i] = true;
        }
      }
    });

    // IN row
    const inDisplay = inScores.map((s, i) => inHasScore[i] ? s : 0);
    addSubtotalRow('IN', inPar, inDisplay, 'sc-subtotal-row');

    // GROSS row
    const grossPar = outPar + inPar;
    const grossScores = outScores.map((s, i) => s + inScores[i]);
    const grossHas = outHasScore.map((s, i) => s || inHasScore[i]);
    const grossDisplay = grossScores.map((s, i) => grossHas[i] ? s : 0);
    addSubtotalRow('GROSS', grossPar, grossDisplay, 'sc-total-row');

    // NET row (gross - number of HC holes)
    const netScores = grossScores.map((s, i) => {
      if (!grossHas[i]) return 0;
      const hcCount = gs.handicapHoles[i] ? gs.handicapHoles[i].length : 0;
      return s - hcCount;
    });
    addSubtotalRow('NET', '', netScores, 'sc-total-row');

    // Ranking row (based on NET, lower = better in golf)
    const netForRank = netScores.map((s, i) => ({ score: grossHas[i] ? s : Infinity, index: i }));
    netForRank.sort((a, b) => a.score - b.score);
    const golfRanks = new Array(4).fill('-');
    netForRank.forEach((item, rank) => {
      if (item.score < Infinity) golfRanks[item.index] = rank + 1;
    });

    const rankRow = document.createElement('tr');
    rankRow.className = 'sc-rank-row';
    let rankCells = `<td class="sc-label">順位</td><td class="sc-par"></td>`;
    for (let i = 0; i < 4; i++) {
      rankCells += `<td class="sc-score sc-rank-val">${golfRanks[i]}</td>`;
    }
    rankRow.innerHTML = rankCells;
    tbody.appendChild(rankRow);
  },

  // --- Las Vegas Points Table ---
  renderLVPointsTable(gs) {
    const header = document.getElementById('lv-points-header');
    header.innerHTML = '<th>H</th><th>チーム</th><th>LV</th>';
    gs.playerNames.forEach(name => {
      header.innerHTML += `<th>${name}</th>`;
    });

    const tbody = document.getElementById('lv-points-body');
    tbody.innerHTML = '';

    const totalPoints = [0, 0, 0, 0];
    const holes = gs.course.holes;
    const front9 = holes.filter(h => h.hole <= 9);
    const back9 = holes.filter(h => h.hole >= 10);

    // Partial totals for OUT/IN
    const outPoints = [0, 0, 0, 0];
    const inPoints = [0, 0, 0, 0];

    const addLVHoleRow = (holeInfo, partialPoints) => {
      const h = holeInfo.hole;
      const result = gs.holeResults[h];
      const tr = document.createElement('tr');

      if (result) {
        const [a1, a2] = result.teams.teamA;
        const [b1, b2] = result.teams.teamB;
        const teamStr = `${gs.playerNames[a1][0]}${gs.playerNames[a2][0]} vs ${gs.playerNames[b1][0]}${gs.playerNames[b2][0]}`;

        let cells = `<td class="lv-hole">${h}</td>`;
        cells += `<td class="lv-team">${teamStr}</td>`;
        cells += `<td class="lv-nums">${result.lasVegasA}-${result.lasVegasB}</td>`;

        for (let i = 0; i < 4; i++) {
          const p = result.points[i];
          totalPoints[i] += p;
          partialPoints[i] += p;
          const cls = p > 0 ? 'lv-win' : p < 0 ? 'lv-lose' : '';
          cells += `<td class="lv-pt ${cls}">${p > 0 ? '+' : ''}${p}</td>`;
        }
        tr.innerHTML = cells;
      } else {
        tr.innerHTML = `<td class="lv-hole">${h}</td><td>-</td><td>-</td>` +
          '<td>-</td><td>-</td><td>-</td><td>-</td>';
      }
      tbody.appendChild(tr);
    };

    const addLVSubtotalRow = (label, pts, cssClass) => {
      const tr = document.createElement('tr');
      tr.className = cssClass;
      let cells = `<td class="lv-hole">${label}</td><td></td><td></td>`;
      for (let i = 0; i < 4; i++) {
        const p = pts[i];
        const cls = p > 0 ? 'lv-win' : p < 0 ? 'lv-lose' : '';
        cells += `<td class="lv-pt ${cls}"><strong>${p > 0 ? '+' : ''}${p}</strong></td>`;
      }
      tr.innerHTML = cells;
      tbody.appendChild(tr);
    };

    // Front 9
    front9.forEach(h => addLVHoleRow(h, outPoints));
    addLVSubtotalRow('OUT', outPoints, 'lv-subtotal-row');

    // Back 9
    back9.forEach(h => addLVHoleRow(h, inPoints));
    addLVSubtotalRow('IN', inPoints, 'lv-subtotal-row');

    // Total
    addLVSubtotalRow('合計', totalPoints, 'lv-total-row');

    // Ranking (LV points, higher = better)
    this.renderRanking(totalPoints);
  },

  renderRanking(totalPoints) {
    const gs = this.gameState;
    const container = document.getElementById('ranking');
    const sorted = gs.playerNames.map((name, i) => ({ name, points: totalPoints[i] }))
      .sort((a, b) => b.points - a.points);

    const medals = ['1st', '2nd', '3rd', '4th'];
    container.innerHTML = '<h3 class="ranking-title">最終結果（ラスベガスポイント）</h3>' +
      sorted.map((p, i) => `
        <div class="ranking-item rank-${i + 1}">
          <span class="rank-medal">${medals[i]}</span>
          <span class="rank-name">${p.name}</span>
          <span class="rank-points ${p.points > 0 ? 'win' : p.points < 0 ? 'lose' : ''}">${p.points > 0 ? '+' : ''}${p.points}</span>
        </div>`
      ).join('');
  },
};

// Start
document.addEventListener('DOMContentLoaded', () => App.init());
