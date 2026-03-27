let gameData = [];
let playerStats = {}; 
let summaryArray = [];

// 初期ソートは「序列（score）」の「昇順（数字が小さい順）」
const sortState = { colId: 'score', asc: true };

window.addEventListener('DOMContentLoaded', () => {
    Promise.all([
        fetch('result_2024_joryu.csv').then(res => { if(!res.ok) throw new Error('result_2024_joryu.csvの読み込みに失敗'); return res.text(); }),
        fetch('joryu.csv').then(res => { if(!res.ok) throw new Error('joryu.csvの読み込みに失敗'); return res.text(); })
    ])
    .then(([gameText, joryuText]) => {
        processCSV(gameText, joryuText);
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

function processCSV(gameText, joryuText) {
    // ==========================================
    // 1. joryu.csvの解析（所属・段位・番号の取得）
    // ==========================================
    const joryuLines = joryuText.replace(/\r/g, '').split('\n').filter(line => line.trim() !== '');
    const joryuHeaders = createHeaderMap(joryuLines[0]);
    const joryuMap = {};

    const rankCols = [
        { name: '女流七段', level: 10 },
        { name: '女流六段', level: 9 },
        { name: '女流五段', level: 8 },
        { name: '女流四段', level: 7 },
        { name: '女流三段', level: 6 },
        { name: '女流二段', level: 5 },
        { name: '女流初段', level: 4 },
        { name: '女流１級', level: 3 },
        { name: '女流２級', level: 2 },
        { name: '女流３級', level: 1 }
    ];

    for (let i = 1; i < joryuLines.length; i++) {
        const row = joryuLines[i].split(',');
        const nameStr = row[joryuHeaders['女流棋士名']];
        if (!nameStr) continue;

        const name = nameStr.replace(/[\s　]/g, '').replace(/"/g, '');
        const numStr = row[joryuHeaders['女流棋士番号']];
        const number = numStr ? parseInt(numStr, 10) : 999;
        const shozoku = row[joryuHeaders['所属']]?.trim() || "";

        let rankLevel = 0;
        for (let rc of rankCols) {
            const idx = joryuHeaders[rc.name];
            if (idx !== undefined && row[idx]?.trim() !== '') {
                rankLevel = rc.level;
                break; 
            }
        }
        
        joryuMap[name] = { number, shozoku, rankLevel };
    }

    // ==========================================
    // 2. 厳格な序列スコアの計算
    // ==========================================
    function getPlayerScore(name) {
        if (!joryuMap[name]) return 99999; // アマチュア等はスコア99999を付与
        
        if (name === '福間香奈') return 1;
        if (name === '西山朋佳') return 2;
        if (name === '清水市代') return 3;

        const info = joryuMap[name];
        const rankScore = (10 - info.rankLevel) * 1000;
        
        let shozokuScore = 400;
        if (info.shozoku === 'JSA') shozokuScore = 100;
        else if (info.shozoku === 'LPSA') shozokuScore = 200;
        else if (info.shozoku === 'フリー') shozokuScore = 300;

        return 10000 + rankScore + shozokuScore + (isNaN(info.number) ? 999 : info.number);
    }

    function initPlayer(name) {
        if (!playerStats[name]) {
            playerStats[name] = {
                name: name,
                score: getPlayerScore(name),
                games: 0,
                wins: 0,
                losses: 0,
                history: []
            };
        }
    }

    // ==========================================
    // 3. result_2024_joryu.csv の処理
    // ==========================================
    const gameLines = gameText.replace(/\r/g, '').split('\n').filter(line => line.trim() !== '');
    const gameHeaders = createHeaderMap(gameLines[0]);

    // 💡 ここではアマチュアも含めて全対局を処理し、女流側の対局履歴に相手のデータを残す
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

        if (p1) {
            initPlayer(p1);
            if (r1 === '○' || r1 === '●' || r1 === '□' || r1 === '■') {
                playerStats[p1].games++;
                if (r1 === '○' || r1 === '□') playerStats[p1].wins++;
                if (r1 === '●' || r1 === '■') playerStats[p1].losses++;
                playerStats[p1].history.push({ date: date, match: match, mySengo: "先手", opponent: p2, result: r1, extra: extra });
            }
        }
        if (p2) {
            initPlayer(p2);
            if (r2 === '○' || r2 === '●' || r2 === '□' || r2 === '■') {
                playerStats[p2].games++;
                if (r2 === '○' || r2 === '□') playerStats[p2].wins++;
                if (r2 === '●' || r2 === '■') playerStats[p2].losses++;
                playerStats[p2].history.push({ date: date, match: match, mySengo: "後手", opponent: p1, result: r2, extra: extra });
            }
        }
    }

    // ==========================================
    // 4. サマリーの生成（アマチュアの除外）
    // ==========================================
    summaryArray = Object.values(playerStats)
        .filter(p => p.score < 99999) // 💡 ここでアマチュア（名簿にない人）を表・プルダウンから完全に除外
        .map(p => {
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
                sortState.asc = (colId === 'score');
            }
            renderSummaryTable();
        });
    });

    const pSel = document.getElementById('playerSelect');
    pSel.innerHTML = '<option value="">名前を選択</option>';
    
    const sortedPlayers = [...summaryArray].sort((a, b) => {
        let scoreCmp = a.score - b.score;
        if (scoreCmp !== 0) return scoreCmp;

        let gameCmp = b.games - a.games;
        if (gameCmp !== 0) return gameCmp;

        let winCmp = b.wins - a.wins;
        if (winCmp !== 0) return winCmp;

        return a.name.localeCompare(b.name, 'ja');
    });

    sortedPlayers.forEach(p => pSel.appendChild(new Option(p.name, p.name)));
    pSel.addEventListener('change', renderHistoryTable);

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
        else { valA = a.score; valB = b.score; }
        
        let cmp = valA - valB;
        
        if (cmp !== 0) {
            return sortState.asc ? cmp : -cmp;
        }

        let scoreCmp = a.score - b.score;
        if (scoreCmp !== 0) return scoreCmp;

        let gameCmp = b.games - a.games;
        if (gameCmp !== 0) return gameCmp;

        let winCmp = b.wins - a.wins;
        if (winCmp !== 0) return winCmp;

        return a.name.localeCompare(b.name, 'ja');
    });

    const tbody = document.querySelector('#summaryTable tbody');
    tbody.innerHTML = viewData.map((d, index) => {
        // アマチュアは既に除外されているため、純粋な順位をそのまま表示
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
    statsCard.innerHTML = `2024年度： ${pData.wins}勝 ${pData.losses}敗 （勝率 ${rateStr}）`;

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