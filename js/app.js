// ラスベガス ゴルフ - メインアプリ

let App = {
  // --- State ---
  courses: [],
  gameState: null,
  _startType: 'out',

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
    const newGameBtn = document.getElementById('new-game-btn');
    const resumeBtn = document.getElementById('resume-btn');
    const rulebookBtn = document.getElementById('rulebook-btn');
    
    if (!newGameBtn) {
      console.error('new-game-btn not found');
    } else {
      newGameBtn.addEventListener('click', () => {
        console.log('new-game-btn clicked');
        this.startSetup();
      });
    }
    
    if (resumeBtn) {
      resumeBtn.addEventListener('click', () => this.resumeGame());
    }
    
    if (rulebookBtn) {
      rulebookBtn.addEventListener('click', () => {
        const rulebookModal = document.getElementById('rulebook-modal');
        if (rulebookModal) {
          rulebookModal.classList.add('active');
        }
      });
    }

    // Rulebook modal close
    const rulebookCloseBtn = document.getElementById('rulebook-close-btn');
    const rulebookModal = document.getElementById('rulebook-modal');
    if (rulebookCloseBtn) {
      rulebookCloseBtn.addEventListener('click', () => {
        if (rulebookModal) {
          rulebookModal.classList.remove('active');
        }
      });
    }
    if (rulebookModal) {
      rulebookModal.addEventListener('click', (e) => {
        if (e.target === rulebookModal) rulebookModal.classList.remove('active');
      });
    }
    document.getElementById('setup-next-1').addEventListener('click', () => this.setupStep1Next());
    document.getElementById('setup-back-2').addEventListener('click', () => this.showSetupStep(1));
    document.getElementById('setup-next-2').addEventListener('click', () => this.setupStep2Next());
    document.getElementById('setup-back-3').addEventListener('click', () => this.showSetupStep(2));
    document.getElementById('setup-next-3').addEventListener('click', () => this.setupStep3Next());
    document.getElementById('setup-back-4').addEventListener('click', () => this.showSetupStep(3));
    document.getElementById('round-start-btn').addEventListener('click', () => this.startRound());

    // HC toggle buttons
    document.getElementById('hc-yes-btn').addEventListener('click', () => this.toggleHcEnabled(true));
    document.getElementById('hc-no-btn').addEventListener('click', () => this.toggleHcEnabled(false));

    // Course search
    document.getElementById('course-search').addEventListener('input', (e) => this.filterCourses(e.target.value));

    // Start type selection
    document.getElementById('start-out-btn').addEventListener('click', () => {
      this._startType = 'out';
      document.getElementById('start-out-btn').classList.add('active');
      document.getElementById('start-in-btn').classList.remove('active');
    });
    document.getElementById('start-in-btn').addEventListener('click', () => {
      this._startType = 'in';
      document.getElementById('start-in-btn').classList.add('active');
      document.getElementById('start-out-btn').classList.remove('active');
    });

    // Random batting order
    document.getElementById('random-order-btn').addEventListener('click', () => this.randomizeBattingOrder());

    // Round screen
    document.getElementById('next-hole-btn').addEventListener('click', () => this.nextHole());
    document.getElementById('prev-hole-btn').addEventListener('click', () => this.prevHole());
    document.getElementById('scoreboard-btn').addEventListener('click', () => this.showScoreboard());

    // HC review (between hole 9 and 10)
    document.getElementById('hc-review-skip-btn').addEventListener('click', () => this.skipHcReview());
    document.getElementById('hc-review-confirm-btn').addEventListener('click', () => this.confirmHcReview());

    // Scoreboard tabs
    document.querySelectorAll('.sb-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.sb-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.sb-tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');
      });
    });

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
  // HELPERS
  // ============================
  buildHoleOrder(startType) {
    if (startType === 'in') {
      return [10, 11, 12, 13, 14, 15, 16, 17, 18, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    }
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  },

  parseStartLabels(courseName) {
    const match = courseName.match(/(\S+)・(\S+)コース$/);
    if (match) {
      return { out: `${match[1]}スタート`, in: `${match[2]}スタート` };
    }
    return { out: 'OUTスタート', in: 'INスタート' };
  },

  // ============================
  // SETUP FLOW
  // ============================
  startSetup() {
    this.showScreen('setup-screen');
    this._selectedPrefs = new Set();
    this.renderPrefFilter();
    this.renderCourseList();
    this.showSetupStep(1);
  },

  showSetupStep(step) {
    document.querySelectorAll('.setup-step').forEach(s => s.classList.remove('active'));
    document.getElementById(`setup-step-${step}`).classList.add('active');
  },

  // --- Step 1: Course selection & Player names ---
  _selectedPrefs: new Set(),

  renderPrefFilter() {
    const container = document.getElementById('pref-filter');
    const allCourses = [...this.courses, ...Storage.loadCustomCourses()];
    const prefCounts = {};
    allCourses.forEach(c => {
      const pref = c.prefecture || 'その他';
      prefCounts[pref] = (prefCounts[pref] || 0) + 1;
    });

    container.innerHTML = '';
    Object.keys(prefCounts).sort().forEach(pref => {
      const label = document.createElement('label');
      label.className = 'pref-chip';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = pref;
      cb.className = 'pref-cb';
      cb.addEventListener('change', () => {
        if (cb.checked) {
          this._selectedPrefs.add(pref);
        } else {
          this._selectedPrefs.delete(pref);
        }
        label.classList.toggle('checked', cb.checked);
        this.renderCourseList(document.getElementById('course-search').value);
      });
      const span = document.createElement('span');
      span.textContent = `${pref}(${prefCounts[pref]})`;
      label.appendChild(cb);
      label.appendChild(span);
      container.appendChild(label);
    });
  },

  renderCourseList(filter = '') {
    const list = document.getElementById('course-list');
    const allCourses = [...this.courses, ...Storage.loadCustomCourses()];
    const lowerFilter = filter.toLowerCase();

    // Filter by selected prefectures first
    let filtered = allCourses;
    if (this._selectedPrefs.size > 0) {
      filtered = filtered.filter(c => this._selectedPrefs.has(c.prefecture || 'その他'));
    }

    // Then filter by search text
    if (filter) {
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(lowerFilter));
    }

    // Group by prefecture
    const grouped = {};
    filtered.forEach(c => {
      const pref = c.prefecture || 'その他';
      if (!grouped[pref]) grouped[pref] = [];
      grouped[pref].push(c);
    });

    list.innerHTML = '';
    if (this._selectedPrefs.size === 0 && !filter) {
      list.innerHTML = '<p class="empty-msg">都道府県を選択してください</p>';
      return;
    }
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

    // Show start type selector and update labels
    document.getElementById('start-type-section').style.display = 'block';
    const labels = this.parseStartLabels(course.name);
    document.getElementById('start-out-label').textContent = labels.out;
    document.getElementById('start-in-label').textContent = labels.in;
    this._startType = 'out';
    document.getElementById('start-out-btn').classList.add('active');
    document.getElementById('start-in-btn').classList.remove('active');
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

    // Show Step 2: Course info + HC (combined)
    this.renderCourseInfoWithHC();
    this.showSetupStep(2);
  },

  // ============================
  // Step 2: Course Info + Handicap (combined)
  // ============================
  renderCourseInfoWithHC() {
    const course = this._selectedCourse;
    document.getElementById('course-info-title').textContent = course.name;

    // Initialize state
    this._hcEnabled = false;
    this._handicapHoles = [[], [], [], []];

    // Reset toggle buttons
    document.getElementById('hc-yes-btn').classList.remove('active');
    document.getElementById('hc-no-btn').classList.add('active');

    const front9 = course.holes.filter(h => h.hole <= 9);
    const back9 = course.holes.filter(h => h.hole >= 10);

    // HC count inputs per player: first half only
    const firstHalf = this._startType === 'in' ? 'in' : 'out';
    const firstHalfLabel = firstHalf.toUpperCase();
    const countSection = document.getElementById('hc-count-section');
    countSection.style.display = 'none';
    countSection.innerHTML = '';
    this._playerNames.forEach((name, i) => {
      const row = document.createElement('div');
      row.className = 'hc-count-row';
      row.innerHTML = `
        <span class="hc-count-name">${name}</span>
        <div class="hc-count-halves">
          <div class="hc-count-half">
            <span class="hc-count-label">${firstHalfLabel}:</span>
            <button type="button" id="hc-count-${firstHalf}-${i}" class="hc-count-btn" data-value="0">0</button>
            <span class="hc-count-status" id="hc-status-${firstHalf}-${i}">0/0</span>
          </div>
        </div>`;
      countSection.appendChild(row);
    });

    // Bind HC count tap events (tap to increment, cycles 0→1→...→9→0)
    for (let i = 0; i < 4; i++) {
      document.getElementById(`hc-count-${firstHalf}-${i}`).addEventListener('click', (e) => {
        const btn = e.currentTarget;
        let val = (parseInt(btn.dataset.value) || 0) + 1;
        if (val > 9) val = 0;
        btn.dataset.value = val;
        btn.textContent = val;
        this.onHcCountChange(i, firstHalf);
      });
    }

    // Build table header
    const thead = document.getElementById('course-hc-head');
    thead.innerHTML = '';
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = '<th class="cht-hole">HOLE</th><th class="cht-par">PAR</th><th class="cht-yard">YARD</th><th class="cht-hdcp">HDCP</th>';
    this._playerNames.forEach(name => {
      headerRow.innerHTML += `<th class="cht-player">${name}</th>`;
    });
    thead.appendChild(headerRow);

    // Build table body with OUT/IN sections
    const tbody = document.getElementById('course-hc-body');
    tbody.innerHTML = '';
    const numCols = 4 + 4;

    // Show first-half holes only
    const firstHalfHoles = this._startType === 'in' ? back9 : front9;
    const sectionHeader = document.createElement('tr');
    sectionHeader.className = 'cht-section-row';
    sectionHeader.innerHTML = `<td colspan="${numCols}" class="cht-section-label">${firstHalfLabel}</td>`;
    tbody.appendChild(sectionHeader);
    firstHalfHoles.forEach(h => tbody.appendChild(this._buildHcHoleRow(h)));
  },

  _buildHcHoleRow(h) {
    const tr = document.createElement('tr');

    const holeTd = document.createElement('td');
    holeTd.className = 'cht-hole-num';
    holeTd.textContent = h.hole;
    tr.appendChild(holeTd);

    const parTd = document.createElement('td');
    parTd.className = 'cht-par-val';
    parTd.textContent = h.par;
    tr.appendChild(parTd);

    const yardTd = document.createElement('td');
    yardTd.className = 'cht-yard-val';
    yardTd.textContent = h.yardage || '-';
    tr.appendChild(yardTd);

    const hdcpTd = document.createElement('td');
    hdcpTd.className = 'cht-hdcp-val';
    hdcpTd.textContent = h.hdcp;
    tr.appendChild(hdcpTd);

    for (let i = 0; i < 4; i++) {
      const td = document.createElement('td');
      td.className = 'cht-hc-cell hc-disabled';
      td.dataset.hole = String(h.hole);
      td.dataset.player = String(i);
      td.addEventListener('click', () => this.toggleHcCell(i, h.hole, td));
      tr.appendChild(td);
    }

    return tr;
  },

  toggleHcEnabled(enabled) {
    this._hcEnabled = enabled;
    document.getElementById('hc-yes-btn').classList.toggle('active', enabled);
    document.getElementById('hc-no-btn').classList.toggle('active', !enabled);
    document.getElementById('hc-count-section').style.display = enabled ? 'flex' : 'none';
    document.getElementById('hc-tap-hint').style.display = enabled ? 'block' : 'none';

    // Toggle cell interactivity
    document.querySelectorAll('.cht-hc-cell').forEach(cell => {
      cell.classList.toggle('hc-disabled', !enabled);
    });

    if (!enabled) {
      this._handicapHoles = [[], [], [], []];
      document.querySelectorAll('.cht-hc-cell').forEach(cell => {
        cell.textContent = '';
        cell.classList.remove('hc-selected');
      });
      for (let i = 0; i < 4; i++) {
        this.updateHcStatus(i, 'out');
        this.updateHcStatus(i, 'in');
      }
    }
  },

  toggleHcCell(playerIdx, holeNum, td) {
    if (!this._hcEnabled) return;

    const half = holeNum <= 9 ? 'out' : 'in';
    const maxCount = parseInt(document.getElementById(`hc-count-${half}-${playerIdx}`).dataset.value) || 0;
    const holes = this._handicapHoles[playerIdx];
    const halfHoles = holes.filter(h => half === 'out' ? h <= 9 : h >= 10);
    const idx = holes.indexOf(holeNum);

    if (idx >= 0) {
      holes.splice(idx, 1);
      td.textContent = '';
      td.classList.remove('hc-selected');
    } else {
      if (maxCount === 0) {
        alert(`${this._playerNames[playerIdx]}さんの${half.toUpperCase()} HC数を先に設定してください`);
        return;
      }
      if (halfHoles.length >= maxCount) {
        alert(`${this._playerNames[playerIdx]}さんは${half.toUpperCase()}で最大${maxCount}ホールまでです`);
        return;
      }
      holes.push(holeNum);
      td.textContent = '\u25CB';
      td.classList.add('hc-selected');
    }

    this.updateHcStatus(playerIdx, half);
  },

  onHcCountChange(playerIdx, half) {
    const maxCount = parseInt(document.getElementById(`hc-count-${half}-${playerIdx}`).dataset.value) || 0;
    const holes = this._handicapHoles[playerIdx];
    const isHalf = half === 'out' ? h => h <= 9 : h => h >= 10;

    // Remove excess holes from this half
    let halfHoles = holes.filter(isHalf);
    while (halfHoles.length > maxCount) {
      const removedHole = halfHoles.pop();
      const idx = holes.indexOf(removedHole);
      if (idx >= 0) holes.splice(idx, 1);
      const cell = document.querySelector(`.cht-hc-cell[data-player="${playerIdx}"][data-hole="${removedHole}"]`);
      if (cell) {
        cell.textContent = '';
        cell.classList.remove('hc-selected');
      }
    }

    this.updateHcStatus(playerIdx, half);
  },

  updateHcStatus(playerIdx, half) {
    const maxCount = parseInt(document.getElementById(`hc-count-${half}-${playerIdx}`).dataset.value) || 0;
    const current = this._handicapHoles[playerIdx].filter(h => half === 'out' ? h <= 9 : h >= 10).length;
    const statusEl = document.getElementById(`hc-status-${half}-${playerIdx}`);
    statusEl.textContent = `${current}/${maxCount}`;
    statusEl.classList.toggle('hc-status-ok', current === maxCount && maxCount > 0);
    statusEl.classList.toggle('hc-status-ng', current !== maxCount && maxCount > 0);
  },

  setupStep2Next() {
    if (this._hcEnabled) {
      const half = this._startType === 'in' ? 'in' : 'out';
      for (let i = 0; i < 4; i++) {
        const maxCount = parseInt(document.getElementById(`hc-count-${half}-${i}`).dataset.value) || 0;
        const currentCount = this._handicapHoles[i].filter(h => half === 'out' ? h <= 9 : h >= 10).length;
        if (currentCount !== maxCount && maxCount > 0) {
          alert(`${this._playerNames[i]}さんの${half.toUpperCase()} HCホールを${maxCount}個選択してください（現在${currentCount}個）`);
          return;
        }
      }
    } else {
      this._handicapHoles = [[], [], [], []];
    }

    this.renderBattingOrder();
    this.showSetupStep(3);
  },

  // ============================
  // Step 3: Batting Order
  // ============================
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

  randomizeBattingOrder() {
    const labels = ['未設定', 'オーナー', '2番目', '3番目', '4番目'];
    // Fisher-Yates shuffle of [1,2,3,4]
    const orders = [1, 2, 3, 4];
    for (let i = orders.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [orders[i], orders[j]] = [orders[j], orders[i]];
    }
    this._battingOrder = orders;
    // Update button labels
    const btns = document.querySelectorAll('.bo-order-btn');
    btns.forEach((btn, idx) => {
      btn.textContent = labels[orders[idx]];
      btn.className = 'bo-order-btn assigned';
    });
  },

  setupStep3Next() {
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
    this.showSetupStep(4);
  },

  // ============================
  // Step 4: Confirmation
  // ============================
  renderConfirmation() {
    const container = document.getElementById('confirmation-content');
    const orderLabels = ['', 'オーナー', '2番目', '3番目', '4番目'];
    const hcEnabled = this._hcEnabled;

    const startLabels = this.parseStartLabels(this._selectedCourse.name);
    const startLabel = this._startType === 'out' ? startLabels.out : startLabels.in;
    const startHoleNum = this._startType === 'out' ? '1番ホール' : '10番ホール';

    let html = `<div class="confirm-section">
      <h4>ゴルフ場</h4>
      <p>${this._selectedCourse.name}</p>
      <p style="margin-top:4px;font-weight:700;color:var(--primary);">${startLabel}（${startHoleNum}から）</p>
    </div>`;

    const firstHalf = this._startType === 'in' ? 'in' : 'out';
    const firstHalfLabel = firstHalf.toUpperCase();
    html += `<div class="confirm-section">
      <h4>プレイヤー & 打順</h4>
      <table class="confirm-table">
        <thead><tr><th>プレイヤー</th><th>打順</th>${hcEnabled ? `<th>${firstHalfLabel} HC</th>` : ''}</tr></thead>
        <tbody>`;
    this._playerNames.forEach((name, i) => {
      const hcHoles = this._handicapHoles[i]
        .filter(h => firstHalf === 'out' ? h <= 9 : h >= 10)
        .sort((a,b)=>a-b);
      html += `<tr>
        <td>${name}</td>
        <td>${orderLabels[this._battingOrder[i]]}</td>
        ${hcEnabled ? `<td>${hcHoles.length > 0 ? hcHoles.join(',') : 'なし'}</td>` : ''}
      </tr>`;
    });
    html += `</tbody></table></div>`;

    container.innerHTML = html;
  },

  // ============================
  // ROUND
  // ============================
  startRound() {
    const holeOrder = this.buildHoleOrder(this._startType);
    this.gameState = {
      course: this._selectedCourse,
      playerNames: this._playerNames,
      battingOrder: this._battingOrder,
      handicapHoles: this._handicapHoles,
      hcEnabled: this._hcEnabled,
      startType: this._startType,
      holeOrder: holeOrder,
      currentHoleIndex: 0,
      currentHole: holeOrder[0],
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
    // Backward compatibility for saved games without holeOrder
    const gs = this.gameState;
    if (!gs.holeOrder) {
      gs.startType = 'out';
      gs.holeOrder = this.buildHoleOrder('out');
      gs.currentHoleIndex = gs.currentHole - 1;
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

    // Determine teams for display (打順ベース: オーナー+4番目 vs 2番目+3番目)
    const holeIndex = gs.currentHoleIndex;
    const teeOrder = LasVegas.calcTeeOrder(gs, holeIndex);
    const teams = LasVegas.formTeamsFromBattingOrder(teeOrder);

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
    const orderLabels = ['オーナー', '2番目', '3番目', '4番目'];
    const sortedPlayers = [0, 1, 2, 3].sort((a, b) => teeOrder[a] - teeOrder[b]);

    sortedPlayers.forEach((pIdx, displayIdx) => {
      const name = gs.playerNames[pIdx];
      const isHcHole = gs.handicapHoles[pIdx].includes(hole);
      const row = document.createElement('div');
      row.className = 'score-input-row';

      row.innerHTML = `
        <span class="tee-order-label${displayIdx === 0 ? ' tee-order-owner' : ''}">${orderLabels[displayIdx]}</span>
        <span class="score-player-name">${name}</span>
        ${isHcHole ? '<span class="hc-badge">HC</span>' : ''}
        <div class="score-control">
          <button class="score-btn minus" data-player="${pIdx}">-</button>
          <input type="number" class="score-value" id="score-${pIdx}"
                 value="${existingScores[pIdx] || (courseHole ? courseHole.par : 4)}"
                 min="1" max="20" data-player="${pIdx}">
          <button class="score-btn plus" data-player="${pIdx}">+</button>
        </div>
        <span class="score-label" id="score-label-${pIdx}"></span>`;
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
    document.getElementById('prev-hole-btn').style.visibility = holeIndex > 0 ? 'visible' : 'hidden';
    const isLastHole = holeIndex >= gs.holeOrder.length - 1;
    document.getElementById('next-hole-btn').textContent = isLastHole ? '結果を見る' : '次のホールへ';

    // Update result
    this.updateHoleResult();

    // Cumulative points
    this.renderCumulativePoints();
  },

  getScoreLabel(score, par) {
    const diff = score - par;
    if (diff <= -3) return { text: `${diff}`, cls: 'score-eagle' };
    if (diff === -2) return { text: 'Eagle', cls: 'score-eagle' };
    if (diff === -1) return { text: 'Birdie', cls: 'score-birdie' };
    if (diff === 0)  return { text: 'Par', cls: 'score-par' };
    if (diff === 1)  return { text: 'Bogey', cls: 'score-bogey' };
    if (diff === 2)  return { text: 'D.Bogey', cls: 'score-dbogey' };
    return { text: `+${diff}`, cls: 'score-dbogey' };
  },

  updateScoreLabels() {
    const gs = this.gameState;
    const hole = gs.currentHole;
    const courseHole = gs.course.holes.find(h => h.hole === hole);
    if (!courseHole) return;
    const par = courseHole.par;

    for (let i = 0; i < 4; i++) {
      const score = parseInt(document.getElementById(`score-${i}`).value) || 0;
      const label = document.getElementById(`score-label-${i}`);
      if (!label) continue;
      const info = this.getScoreLabel(score, par);
      label.textContent = info.text;
      label.className = `score-label ${info.cls}`;
    }
  },

  updateHoleResult() {
    const gs = this.gameState;
    const hole = gs.currentHole;
    const courseHole = gs.course.holes.find(h => h.hole === hole);
    const par = courseHole ? courseHole.par : 4;

    // Update score labels (Eagle, Birdie, Par, etc.)
    this.updateScoreLabels();

    // Read scores
    const rawScores = [];
    for (let i = 0; i < 4; i++) {
      rawScores.push(parseInt(document.getElementById(`score-${i}`).value) || 0);
    }

    // Apply handicap
    const scores = LasVegas.applyHandicap(rawScores, hole, gs.handicapHoles);

    // Store raw scores
    gs.holeScores[hole] = rawScores;

    // Get teams (打順ベース: オーナー+4番目 vs 2番目+3番目)
    const teeOrder = LasVegas.calcTeeOrder(gs, gs.currentHoleIndex);
    const teams = LasVegas.formTeamsFromBattingOrder(teeOrder);

    // Calculate (rawScores, par, handicapHoles, hole for birdie + HC cancel)
    const result = LasVegas.calcHolePoints(scores, teams, rawScores, par, gs.handicapHoles, hole);
    gs.holeResults[hole] = result;

    // Display result
    const resultDiv = document.getElementById('hole-result');
    const [a1, a2] = teams.teamA;
    const [b1, b2] = teams.teamB;
    const bi = result.birdieInfo;
    const eff = result.effectiveScores || scores;
    const hcCancelled = (bi && bi.hcCancelled) || [];

    // HC label helper: if HC was cancelled by birdie, show strikethrough
    const hcLabel = (playerIdx) => {
      if (!gs.handicapHoles[playerIdx].includes(hole)) return '';
      if (hcCancelled.includes(playerIdx)) return ' <s>(HC-1)</s>';
      return ' (HC-1)';
    };

    // LV number display (show original → flipped if birdie)
    let lvADisplay = `${result.lasVegasA}`;
    let lvBDisplay = `${result.lasVegasB}`;
    if (bi && bi.flipped) {
      if (bi.teamABirdies > 0) {
        // Team A had birdie → Team B's number was flipped
        lvBDisplay = `<s>${result.originalLvB}</s> → ${result.lasVegasB}`;
      } else {
        // Team B had birdie → Team A's number was flipped
        lvADisplay = `<s>${result.originalLvA}</s> → ${result.lasVegasA}`;
      }
    }

    // Birdie flip banner
    let birdieHtml = '';
    if (bi && bi.flipped) {
      const flipTarget = bi.teamABirdies > 0 ? 'B' : 'A';
      const mult = bi.multiplier > 1 ? ` x${bi.multiplier}` : '';
      birdieHtml = `<div class="birdie-flip-banner">Birdie! チーム${flipTarget}の数字が反転${mult}</div>`;
    } else if (bi && bi.teamABirdies > 0 && bi.teamBBirdies > 0) {
      birdieHtml = `<div class="birdie-cancel-banner">両チームBirdie - 相殺</div>`;
    }

    resultDiv.innerHTML = `
      ${birdieHtml}
      <div class="result-row">
        <div class="result-team">
          <span class="result-team-label">チームA</span>
          <span>${gs.playerNames[a1]}${hcLabel(a1)}: ${eff[a1]}  ${gs.playerNames[a2]}${hcLabel(a2)}: ${eff[a2]}</span>
          <span class="lv-number">${lvADisplay}</span>
        </div>
        <div class="result-vs">vs</div>
        <div class="result-team">
          <span class="result-team-label">チームB</span>
          <span>${gs.playerNames[b1]}${hcLabel(b1)}: ${eff[b1]}  ${gs.playerNames[b2]}${hcLabel(b2)}: ${eff[b2]}</span>
          <span class="lv-number">${lvBDisplay}</span>
        </div>
      </div>
      ${hcCancelled.length > 0 ? '<div class="hc-cancel-note">HCがある人がバーディーを取った場合、スコアは-1されません（相手チームのスコアは逆転します）</div>' : ''}
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

    // Save & update cumulative
    Storage.saveGame(gs);
    this.renderCumulativePoints();
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
    if (gs.currentHoleIndex >= gs.holeOrder.length - 1) {
      this.showScoreboard();
      return;
    }

    // Show HC review after the 9th hole played (index 8)
    if (gs.currentHoleIndex === 8) {
      this.showHcReview();
      return;
    }

    gs.currentHoleIndex++;
    gs.currentHole = gs.holeOrder[gs.currentHoleIndex];
    Storage.saveGame(gs);
    this.renderHole();
  },

  prevHole() {
    const gs = this.gameState;
    if (gs.currentHoleIndex <= 0) return;
    gs.currentHoleIndex--;
    gs.currentHole = gs.holeOrder[gs.currentHoleIndex];
    Storage.saveGame(gs);
    this.renderHole();
  },

  // ============================
  // HC REVIEW (between hole 9 and 10)
  // ============================
  showHcReview() {
    const gs = this.gameState;
    this.showScreen('hc-review-screen');

    const startType = gs.startType || 'out';
    const isSecondHalfOut = (startType === 'in');

    // Update dynamic text
    if (isSecondHalfOut) {
      document.getElementById('hc-review-title-text').textContent = '後半のハンディを見直しますか？';
      document.getElementById('hc-review-desc-text').textContent = 'OUTコース（1-9H）のハンディキャップを変更できます';
    } else {
      document.getElementById('hc-review-title-text').textContent = '後半のハンディを見直しますか？';
      document.getElementById('hc-review-desc-text').textContent = 'INコース（10-18H）のハンディキャップを変更できます';
    }

    // Copy second-half holes for editing
    const filterFn = isSecondHalfOut ? (h => h <= 9) : (h => h >= 10);
    this._reviewSecondHalfHoles = gs.handicapHoles.map(holes =>
      holes.filter(filterFn).slice()
    );

    // Build count inputs
    const halfLabel = isSecondHalfOut ? 'OUT' : 'IN';
    const countSection = document.getElementById('hc-review-count-section');
    countSection.innerHTML = '';
    gs.playerNames.forEach((name, i) => {
      const count = this._reviewSecondHalfHoles[i].length;
      const row = document.createElement('div');
      row.className = 'hc-count-row';
      row.innerHTML = `
        <span class="hc-count-name">${name}</span>
        <div class="hc-count-halves">
          <div class="hc-count-half">
            <span class="hc-count-label">${halfLabel}:</span>
            <button type="button" id="hc-review-count-${i}" class="hc-count-btn" data-value="${count}">${count}</button>
            <span class="hc-count-status" id="hc-review-status-${i}">${count}/${count}</span>
          </div>
        </div>`;
      countSection.appendChild(row);
    });

    for (let i = 0; i < 4; i++) {
      document.getElementById(`hc-review-count-${i}`).addEventListener('click', (e) => {
        const btn = e.currentTarget;
        let val = (parseInt(btn.dataset.value) || 0) + 1;
        if (val > 9) val = 0;
        btn.dataset.value = val;
        btn.textContent = val;
        this.onHcReviewCountChange(i);
      });
    }

    // Build table header
    const thead = document.getElementById('hc-review-head');
    thead.innerHTML = '';
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = '<th class="cht-hole">HOLE</th><th class="cht-par">PAR</th><th class="cht-yard">YARD</th><th class="cht-hdcp">HDCP</th>';
    gs.playerNames.forEach(name => {
      headerRow.innerHTML += `<th class="cht-player">${name}</th>`;
    });
    thead.appendChild(headerRow);

    // Build table body (second-half holes)
    const tbody = document.getElementById('hc-review-body');
    tbody.innerHTML = '';
    const secondHalfHoles = isSecondHalfOut
      ? gs.course.holes.filter(h => h.hole <= 9)
      : gs.course.holes.filter(h => h.hole >= 10);

    secondHalfHoles.forEach(h => {
      const tr = document.createElement('tr');

      const holeTd = document.createElement('td');
      holeTd.className = 'cht-hole-num';
      holeTd.textContent = h.hole;
      tr.appendChild(holeTd);

      const parTd = document.createElement('td');
      parTd.className = 'cht-par-val';
      parTd.textContent = h.par;
      tr.appendChild(parTd);

      const yardTd = document.createElement('td');
      yardTd.className = 'cht-yard-val';
      yardTd.textContent = h.yardage || '-';
      tr.appendChild(yardTd);

      const hdcpTd = document.createElement('td');
      hdcpTd.className = 'cht-hdcp-val';
      hdcpTd.textContent = h.hdcp;
      tr.appendChild(hdcpTd);

      for (let i = 0; i < 4; i++) {
        const td = document.createElement('td');
        td.className = 'hc-review-cell';
        td.dataset.hole = String(h.hole);
        td.dataset.player = String(i);

        if (this._reviewSecondHalfHoles[i].includes(h.hole)) {
          td.textContent = '\u25CB';
          td.classList.add('hc-selected');
        }

        td.addEventListener('click', () => this.toggleHcReviewCell(i, h.hole, td));
        tr.appendChild(td);
      }

      tbody.appendChild(tr);
    });

    // Update initial statuses
    for (let i = 0; i < 4; i++) {
      this.updateHcReviewStatus(i);
    }
  },

  toggleHcReviewCell(playerIdx, holeNum, td) {
    const gs = this.gameState;
    const startType = gs.startType || 'out';
    const halfLabel = (startType === 'in') ? 'OUT' : 'IN';
    const maxCount = parseInt(document.getElementById(`hc-review-count-${playerIdx}`).dataset.value) || 0;
    const holes = this._reviewSecondHalfHoles[playerIdx];
    const idx = holes.indexOf(holeNum);

    if (idx >= 0) {
      holes.splice(idx, 1);
      td.textContent = '';
      td.classList.remove('hc-selected');
    } else {
      if (maxCount === 0) {
        alert(`${gs.playerNames[playerIdx]}さんの${halfLabel} HC数を先に設定してください`);
        return;
      }
      if (holes.length >= maxCount) {
        alert(`${gs.playerNames[playerIdx]}さんは${halfLabel}で最大${maxCount}ホールまでです`);
        return;
      }
      holes.push(holeNum);
      td.textContent = '\u25CB';
      td.classList.add('hc-selected');
    }

    this.updateHcReviewStatus(playerIdx);
  },

  onHcReviewCountChange(playerIdx) {
    const maxCount = parseInt(document.getElementById(`hc-review-count-${playerIdx}`).dataset.value) || 0;
    const holes = this._reviewSecondHalfHoles[playerIdx];

    while (holes.length > maxCount) {
      const removedHole = holes.pop();
      const cell = document.querySelector(`.hc-review-cell[data-player="${playerIdx}"][data-hole="${removedHole}"]`);
      if (cell) {
        cell.textContent = '';
        cell.classList.remove('hc-selected');
      }
    }

    this.updateHcReviewStatus(playerIdx);
  },

  updateHcReviewStatus(playerIdx) {
    const maxCount = parseInt(document.getElementById(`hc-review-count-${playerIdx}`).dataset.value) || 0;
    const current = this._reviewSecondHalfHoles[playerIdx].length;
    const statusEl = document.getElementById(`hc-review-status-${playerIdx}`);
    statusEl.textContent = `${current}/${maxCount}`;
    statusEl.classList.toggle('hc-status-ok', current === maxCount && maxCount > 0);
    statusEl.classList.toggle('hc-status-ng', current !== maxCount && maxCount > 0);
  },

  skipHcReview() {
    const gs = this.gameState;
    gs.currentHoleIndex = 9;
    gs.currentHole = gs.holeOrder[9];
    Storage.saveGame(gs);
    this.showScreen('round-screen');
    this.renderHole();
  },

  confirmHcReview() {
    const gs = this.gameState;
    const startType = gs.startType || 'out';
    const isSecondHalfOut = (startType === 'in');
    const halfLabel = isSecondHalfOut ? 'OUT' : 'IN';

    // Validate
    for (let i = 0; i < 4; i++) {
      const maxCount = parseInt(document.getElementById(`hc-review-count-${i}`).dataset.value) || 0;
      const currentCount = this._reviewSecondHalfHoles[i].length;
      if (currentCount !== maxCount && maxCount > 0) {
        alert(`${gs.playerNames[i]}さんの${halfLabel} HCホールを${maxCount}個選択してください（現在${currentCount}個）`);
        return;
      }
    }

    // Apply: replace second-half holes with reviewed selections
    const keepFn = isSecondHalfOut ? (h => h >= 10) : (h => h <= 9);
    for (let i = 0; i < 4; i++) {
      gs.handicapHoles[i] = [
        ...gs.handicapHoles[i].filter(keepFn),
        ...this._reviewSecondHalfHoles[i]
      ];
    }

    // Enable HC if any player has HC holes set
    if (gs.handicapHoles.some(holes => holes.length > 0)) {
      gs.hcEnabled = true;
    }

    gs.currentHoleIndex = 9;
    gs.currentHole = gs.holeOrder[9];
    Storage.saveGame(gs);
    this.showScreen('round-screen');
    this.renderHole();
  },

  // ============================
  // SCOREBOARD
  // ============================
  showScoreboard() {
    this.showScreen('scoreboard-screen');
    // Reset tabs to default (LV points)
    document.querySelectorAll('.sb-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.sb-tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('.sb-tab[data-tab="lv-tab"]').classList.add('active');
    document.getElementById('lv-tab').classList.add('active');
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

        const bi = result.birdieInfo;
        let lvDisplay = `${result.lasVegasA}-${result.lasVegasB}`;
        let birdieClass = '';
        if (bi && bi.flipped) {
          const origA = result.originalLvA != null ? result.originalLvA : result.lasVegasA;
          const origB = result.originalLvB != null ? result.originalLvB : result.lasVegasB;
          lvDisplay = `${origA}-${origB} → ${result.lasVegasA}-${result.lasVegasB}`;
          birdieClass = ' lv-birdie-flip';
          if (bi.multiplier > 1) lvDisplay += ` x${bi.multiplier}`;
        }

        let cells = `<td class="lv-hole">${h}</td>`;
        cells += `<td class="lv-team">${teamStr}</td>`;
        cells += `<td class="lv-nums${birdieClass}">${lvDisplay}</td>`;

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
