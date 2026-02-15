// ラスベガス ゴルフ - ゲームロジック

const LasVegas = {
  // スコアから順位を計算（1-indexed）
  // 同スコアの場合はプレイヤーインデックス順（登録順）
  calcRankings(scores) {
    const indexed = scores.map((score, i) => ({ score, index: i }));
    indexed.sort((a, b) => a.score - b.score || a.index - b.index);
    // ranked[i] = i番目のプレイヤーの順位(1-4)
    const ranked = new Array(4);
    indexed.forEach((item, rank) => {
      ranked[item.index] = rank + 1;
    });
    return ranked;
  },

  // 順位からチーム分け: 1位&4位 vs 2位&3位
  // returns { teamA: [playerIdx, playerIdx], teamB: [playerIdx, playerIdx] }
  formTeams(rankings) {
    let p1 = -1, p2 = -1, p3 = -1, p4 = -1;
    for (let i = 0; i < 4; i++) {
      if (rankings[i] === 1) p1 = i;
      else if (rankings[i] === 2) p2 = i;
      else if (rankings[i] === 3) p3 = i;
      else if (rankings[i] === 4) p4 = i;
    }
    return {
      teamA: [p1, p4], // 1位 & 4位
      teamB: [p2, p3], // 2位 & 3位
    };
  },

  // 打順からチーム分け (1H用): 打順1&4 vs 打順2&3
  // battingOrder[i] = i番目のプレイヤーの打順(1-4)
  formTeamsFromBattingOrder(battingOrder) {
    let b1 = -1, b2 = -1, b3 = -1, b4 = -1;
    for (let i = 0; i < 4; i++) {
      if (battingOrder[i] === 1) b1 = i;
      else if (battingOrder[i] === 2) b2 = i;
      else if (battingOrder[i] === 3) b3 = i;
      else if (battingOrder[i] === 4) b4 = i;
    }
    return {
      teamA: [b1, b4], // 打順1 & 打順4
      teamB: [b2, b3], // 打順2 & 打順3
    };
  },

  // ラスベガス数を計算: スコアが小さい方が十の位
  calcLasVegasNumber(scoreA, scoreB) {
    const smaller = Math.min(scoreA, scoreB);
    const larger = Math.max(scoreA, scoreB);
    return smaller * 10 + larger;
  },

  // 5点単位に切り上げ
  roundUpTo5(value) {
    return Math.ceil(value / 5) * 5;
  },

  // 1ホール分のポイント計算
  // scores: [4人のスコア]  (ハンディキャップ適用済み)
  // rankings or battingOrder に基づくチーム分け
  calcHolePoints(scores, teams) {
    const [a1, a2] = teams.teamA;
    const [b1, b2] = teams.teamB;

    const lvA = this.calcLasVegasNumber(scores[a1], scores[a2]);
    const lvB = this.calcLasVegasNumber(scores[b1], scores[b2]);

    const diff = lvB - lvA; // 正ならteamA勝ち、負ならteamB勝ち
    const absDiff = Math.abs(diff);
    const roundedDiff = this.roundUpTo5(absDiff);

    // 各プレイヤーのポイント
    const points = new Array(4).fill(0);
    if (diff > 0) {
      // teamA wins
      points[a1] = roundedDiff;
      points[a2] = roundedDiff;
      points[b1] = -roundedDiff;
      points[b2] = -roundedDiff;
    } else if (diff < 0) {
      // teamB wins
      points[a1] = -roundedDiff;
      points[a2] = -roundedDiff;
      points[b1] = roundedDiff;
      points[b2] = roundedDiff;
    }
    // diff === 0: all zeros (draw)

    return {
      teams,
      lasVegasA: lvA,
      lasVegasB: lvB,
      diff,
      roundedDiff,
      points,
    };
  },

  // ハンディキャップ適用: 指定ホールのプレイヤーはスコア-1
  applyHandicap(rawScores, holeNumber, handicapHoles) {
    return rawScores.map((score, playerIdx) => {
      const playerHoles = handicapHoles[playerIdx] || [];
      if (playerHoles.includes(holeNumber)) {
        return score - 1;
      }
      return score;
    });
  },

  // 全ホールの累計ポイント計算
  calcTotalPoints(holeResults) {
    const totals = [0, 0, 0, 0];
    holeResults.forEach(result => {
      if (result && result.points) {
        for (let i = 0; i < 4; i++) {
          totals[i] += result.points[i];
        }
      }
    });
    return totals;
  },
};
