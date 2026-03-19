let gameData = [];
let playerStats = {}; 
let summaryArray = [];

// 初期ソートは「属性スコア（女流>三段>アマ）」基準（asc: true でスコアが小さい順）
const sortState = { colId: 'attribute', asc: true };

window.addEventListener('DOMContentLoaded', () => {
    // 💡 joryu.csv も同時に読み込むように変更
    Promise.all([
        fetch('result_2025.csv').then(res => { if(!res.ok) throw new Error('result_2025.csv失敗'); return res.text(); }),
        fetch('kishi.csv').then(res => { if(!res.ok) throw new Error('kishi.csv失敗'); return res.text(); }),
        fetch('joryu.csv').then(res => { if(!res.ok) throw new Error('joryu.csv失敗'); return res.text(); })
    ])
    .then(([gameText, kishiText, joryuText]) => {
        processCSV(gameText, kishiText, joryuText);
        setupUI();
    })
    .catch(error => console.error('エラー:', error));
});

function createHeaderMap(headerLine) {
    const headers = headerLine.replace(/\r/g, '').split(',');
    const map = {};
    headers.forEach((h, i) => {
        const cleanH = h.replace(/^\uFEFF/, '').trim();
        map[cleanH] = i;
    });
    return map;
}

function processCSV(gameText, kishiText, joryuText) {
    // ==========================================
    // 1. プロ棋士名簿（除外用）の作成
    // ==========================================
    const kishiLines = kishiText.replace(/\r/g, '').split('\n').filter(line => line.trim() !== '');
    const kishiHeaders = createHeaderMap(kishiLines[0]);
    const kishiMap = {};
    for (let i = 1; i < kishiLines.length; i++) {
        const row = kishiLines[i].split(',');
        const nameStr = row[kishiHeaders['棋士名']];
        if (nameStr) {
            const name = nameStr.replace(/[\s　]/g, '').replace(/"/g, '');
            kishiMap[name] = true; // プロ棋士として登録
        }
    }

    // ==========================================
    // 2. 女流棋士名簿の作成
    // ==========================================
    const joryuLines = joryuText.replace(/\r/g, '').split('\n').filter(line => line.trim() !== '');
    const joryuHeaders = createHeaderMap(joryuLines[0]);
    const joryuMap = {};
    for (let i = 1; i < joryuLines.length; i++) {
        const row = joryuLines[i].split(',');
        const nameStr = row[joryuHeaders['女流棋士名']];
        if (nameStr) {
            const name = nameStr.replace(/[\s　]/g, '').replace(/"/g, '');
            joryuMap[name] = true; // 女流棋士として登録
        }
    }

    // ==========================================
    // 3. 属性スコア判定ロジック
    // ==========================================
    function getAttributeScore(name) {
        if (joryuMap[name]) return 1;          // 女流棋士
        if (name.includes('三段')) return 2;   // 奨励会三段
        if (name.includes('アマ')) return 3;   // アマチュア
        return 4;                              // その他
    }

    function initPlayer(name) {
        if (!playerStats[name]) {
            playerStats[name] = {
                name: name,
                attrScore: getAttributeScore(name), // 属性スコアを付与
                games: 0,
                wins: 0,
                losses: 0,
                history: []
            };
        }
    }

    // ==========================================
    // 4. 対局データの処理（プロを除外）
    // ==========================================
    const gameLines = gameText.replace(/\r/g, '').split('\n').filter(line => line.trim() !== '');
    const gameHeaders = createHeaderMap(gameLines[0]);

    for (let i = 1; i < gameLines.length; i++) {
        const row = gameLines[i].split(',');
        if (row.length < 5) continue;

        const date = row[gameHeaders['対局日']]?.trim() || "";
        const match = row[gameHeaders['棋戦']]?.trim() || "";
        const notes = row[gameHeaders['備考']]?.trim() || "";
        const r1 = row[gameHeaders['先手の勝敗']]?.trim() || "";
        const p1 = row[gameHeaders['先手']] ? row[gameHeaders['先手']].replace(/[\s　]/g, '').replace(/"/g, '') : "";
        const p2 = row[gameHeaders['後手']] ? row[gameHeaders['後手']].replace(/[\s　]/g, '').replace(/"/g, '') : "";
        const r2 = row[gameHeaders['後手の勝敗']]?.trim() || "";
        const thousand = row[gameHeaders['千日手']]?.trim() || "";
        const broadcast = row[gameHeaders['放送日']]?.trim() || "";

        let extra = notes;
        if(thousand) extra += (extra ? " / " : "") + thousand;
        if(broadcast) extra += (extra ? " / 放送:" : "放送:") + broadcast;

        // 💡 先手が「プロ棋士名簿(kishiMap)に存在しない」場合のみ集計
        if (p1 && !kishiMap[p1]) {
            initPlayer(p1);
            if (r1 === '○' || r1 === '●' || r1 === '□' || r1 === '■') {
                playerStats[p1].games++;
                if (r1 === '○' || r1 === '□') playerStats[p1].wins++;
                if (r1 === '●' || r1 === '■') playerStats[p1].losses++;
                playerStats[p1].history.push({ date: date, match: match, mySengo: "先手", opponent: p2, result: r1, extra: extra });
            }
        }
        
        // 💡 後手が「プロ棋士名簿(kishiMap)に存在しない」場合のみ集計
        if (p2 && !kishiMap[p2]) {
            initPlayer(p2);
            if (r2 === '○' || r2 === '●' || r2 === '□' || r2 === '■') {
                playerStats[p2].games++;
                if (r2 === '○' || r2 === '□') playerStats[p2].wins++;
                if (r2 === '●' || r2 === '■') playerStats[p2].losses++;
                playerStats[p2].history.push({ date: date, match: match, mySengo: "後手", opponent: p1, result: r2, extra: extra });
            }
        }
    }

    summaryArray = Object.values(playerStats).map(p => {
        let rate = p.games > 0 ? (p.wins / p.games) : 0;
        let rateStr = p.games > 0 ? rate.toFixed(4) : "-";
        return { ...p, winRate: rate, winRateStr: rateStr };
    });
}

function setupUI() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
            this.classList.add('active');
            document.getElementById(this.dataset.target).classList.add('active');
        });
    });

    document.querySelectorAll('#summaryTable th.sortable').forEach(th => {
        th.addEventListener('click', function() {
            let colId = this.dataset.col;
            if (sortState.colId === colId) {
                sortState.asc = !sortState.asc;
            } else {
                sortState.colId = colId;
                sortState.asc = false; // クリック時は基本的に降順（数字が多い順）から
            }
            renderSummaryTable();
        });
    });

    const pSel = document.getElementById('playerSelect');
    pSel.innerHTML = '<option value="">名前を選択</option>';
    
    // プルダウンの並び順を「絶対ルール」で統一
    const sortedPlayers = [...summaryArray].sort((a, b) => {
        let attrCmp = a.attrScore - b.attrScore;
        if (attrCmp !== 0) return attrCmp; // 1. 属性スコア (女流>三段>アマ)

        let gameCmp = b.games - a.games;
        if (gameCmp !== 0) return gameCmp; // 2. 対局数が多い順

        let winCmp = b.wins - a.wins;
        if (winCmp !== 0) return winCmp;   // 3. 勝数が多い順

        return a.name.localeCompare(b.name, 'ja'); // 4. 名前の五十音順
    });
    
    sortedPlayers.forEach(p => pSel.appendChild(new Option(p.name, p.name)));

    renderSummaryTable();
}

function renderSummaryTable() {
    let viewData = [...summaryArray];

    viewData.sort((a, b) => {
        let valA, valB;
        if (sortState.colId === 'games') { valA = a.games; valB = b.games; }
        else if (sortState.colId === 'wins') { valA = a.wins; valB = b.wins; }
        else if (sortState.colId === 'losses') { valA = a.losses; valB = b.losses; }
        else if (sortState.colId === 'winRate') { valA = a.winRate; valB = b.winRate; }
        else { valA = a.attrScore; valB = b.attrScore; } // 初期は属性スコア
        
        let cmp = valA - valB;
        
        // メイン条件で差がある場合は、指定された昇順・降順で並べる
        if (cmp !== 0) {
            return sortState.asc ? cmp : -cmp;
        }

        // --- 同数・同率の場合のタイブレーク（絶対ルール） ---
        let attrCmp = a.attrScore - b.attrScore;
        if (attrCmp !== 0) return attrCmp; // 1. 属性スコア (女流>三段>アマ)

        let gameCmp = b.games - a.games;
        if (gameCmp !== 0) return gameCmp; // 2. 対局数が多い順

        let winCmp = b.wins - a.wins;
        if (winCmp !== 0) return winCmp;   // 3. 勝数が多い順

        return a.name.localeCompare(b.name, 'ja'); // 4. 名前の五十音順
    });

    const tbody = document.querySelector('#summaryTable tbody');
    tbody.innerHTML = viewData.map((d, index) => {
        return `<tr>
            <td>${index + 1}</td>
            <td style="text-align:left; font-weight:bold;">${d.name}</td>
            <td>${d.games}</td>
            <td>${d.wins}</td>
            <td>${d.losses}</td>
            <td style="font-weight:bold; color:#1a3622;">${d.winRateStr}</td>
        </tr>`;
    }).join('');

    document.querySelectorAll('#summaryTable th.sortable').forEach(th => {
        th.classList.remove('asc', 'desc');
        if (th.dataset.col === sortState.colId) th.classList.add(sortState.asc ? 'asc' : 'desc');
    });
}

function renderHistoryTable() {
    const pSel = document.getElementById('playerSelect');
    const tbody = document.querySelector('#historyTable tbody');
    const statsCard = document.getElementById('playerStatsCard');

    if (!pSel.value) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-message">名前を選択してください</td></tr>';
        statsCard.style.display = "none";
        return;
    }

    const pData = playerStats[pSel.value];
    statsCard.style.display = "block";
    let rateStr = pData.games > 0 ? (pData.wins / pData.games).toFixed(4) : "-";
    statsCard.innerHTML = `2025年度成績： ${pData.wins}勝 ${pData.losses}敗 （勝率 ${rateStr}）`;

    let games = [...pData.history].sort((a,b) => new Date(b.date) - new Date(a.date));
    tbody.innerHTML = games.length === 0 ? '<tr><td colspan="6" class="empty-message">データなし</td></tr>' :
        games.map(g => {
            let resColor = (g.result === "○" || g.result === "□") ? "color: #d9534f; font-weight: bold;" : 
                           ((g.result === "●" || g.result === "■") ? "color: #0275d8;" : "");
            return `<tr>
                <td>${g.date}</td>
                <td style="font-weight:bold;">${g.match}</td>
                <td>${g.mySengo}</td>
                <td>${g.opponent}</td>
                <td style="${resColor} font-size:16px;">${g.result}</td>
                <td style="text-align:left; font-size: 12px;">${g.extra}</td>
            </tr>`;
        }).join('');
}