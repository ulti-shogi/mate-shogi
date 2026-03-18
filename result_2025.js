let gameData = [];
let playerStats = {}; 
let summaryArray = [];

// ★修正3: 初期ソートは「序列（score）」の「降順（多い順）」
const sortState = { colId: 'score', asc: false };

window.addEventListener('DOMContentLoaded', () => {
    Promise.all([
        fetch('result_2025.csv').then(res => { if(!res.ok) throw new Error('result_2025.csvの読み込みに失敗'); return res.text(); }),
        fetch('kishi.csv').then(res => { if(!res.ok) throw new Error('kishi.csvの読み込みに失敗'); return res.text(); })
    ])
    .then(([gameText, kishiText]) => {
        processCSV(gameText, kishiText);
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

function processCSV(gameText, kishiText) {
    const kishiLines = kishiText.replace(/\r/g, '').split('\n').filter(line => line.trim() !== '');
    const kishiHeaders = createHeaderMap(kishiLines[0]);
    const kishiMap = {};
    for (let i = 1; i < kishiLines.length; i++) {
        const row = kishiLines[i].split(',');
        const idStr = row[kishiHeaders['棋士番号']];
        const nameStr = row[kishiHeaders['棋士名']];
        if (idStr && nameStr) {
            const id = parseInt(idStr, 10);
            const name = nameStr.replace(/[\s　]/g, '').replace(/"/g, '');
            kishiMap[name] = id;
        }
    }

    const gameLines = gameText.replace(/\r/g, '').split('\n').filter(line => line.trim() !== '');
    const gameHeaders = createHeaderMap(gameLines[0]);

    function initPlayer(name) {
        if (!playerStats[name]) {
            playerStats[name] = { games: 0, wins: 0, losses: 0, history: [] }; // ★修正2: totalをgamesに変更
        }
    }

    for (let i = 1; i < gameLines.length; i++) {
        const row = gameLines[i].split(',');
        if (row.length < 5) continue;

        const date = row[gameHeaders['対局日']]?.trim() || "";
        const match = row[gameHeaders['棋戦']]?.trim() || "";
        const notes = row[gameHeaders['備考']]?.trim() || "";
        const res1 = row[gameHeaders['先手の勝敗']]?.trim() || "";
        const p1 = row[gameHeaders['先手']] ? row[gameHeaders['先手']].replace(/[\s　]/g, '').replace(/"/g, '') : "";
        const p2 = row[gameHeaders['後手']] ? row[gameHeaders['後手']].replace(/[\s　]/g, '').replace(/"/g, '') : "";
        const res2 = row[gameHeaders['後手の勝敗']]?.trim() || "";
        const thousand = row[gameHeaders['千日手']]?.trim() || "";
        const broadcast = row[gameHeaders['放送日']]?.trim() || "";

        const gameRecord = { date, match, notes, res1, p1, p2, res2, thousand, broadcast };
        gameData.push(gameRecord);

        if (p1) initPlayer(p1);
        if (p2) initPlayer(p2);

        // 勝敗の判定を厳密に
        if (p1 && (res1 === '○' || res1 === '●' || res1 === '□' || res1 === '■')) {
            playerStats[p1].games++;
            if (res1 === '○' || res1 === '□') playerStats[p1].wins++;
            if (res1 === '●' || res1 === '■') playerStats[p1].losses++;
            playerStats[p1].history.push({...gameRecord, mySente: true});
        }
        
        if (p2 && (res2 === '○' || res2 === '●' || res2 === '□' || res2 === '■')) {
            playerStats[p2].games++;
            if (res2 === '○' || res2 === '□') playerStats[p2].wins++;
            if (res2 === '●' || res2 === '■') playerStats[p2].losses++;
            playerStats[p2].history.push({...gameRecord, mySente: false});
        }
    }

    summaryArray = Object.keys(playerStats).map(name => {
        const s = playerStats[name];
        const winRate = s.games > 0 ? s.wins / s.games : 0;
        const score = s.wins - s.losses;
        return {
            name: name,
            id: kishiMap[name] || 99999,
            games: s.games, // ★修正2: HTMLの data-col="games" と一致
            wins: s.wins,
            losses: s.losses,
            winRate: winRate,
            score: score
        };
    });
}

function setupUI() {
    renderSummary();
    populatePlayerSelect(); 

    document.querySelectorAll('#summaryTable th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.col;
            if (sortState.colId === col) {
                sortState.asc = !sortState.asc;
            } else {
                sortState.colId = col;
                sortState.asc = false;
                if (col === 'id' || col === 'name') sortState.asc = true;
            }
            updateSortIcons();
            renderSummary();
        });
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
            e.target.classList.add('active');
            const targetId = e.target.dataset.target;
            document.getElementById(targetId).classList.add('active');
        });
    });
}

function updateSortIcons() {
    document.querySelectorAll('#summaryTable th.sortable').forEach(th => {
        th.classList.remove('asc', 'desc');
        if (th.dataset.col === sortState.colId) {
            th.classList.add(sortState.asc ? 'asc' : 'desc');
        }
    });
}

function renderSummary() {
    summaryArray.sort((a, b) => {
        const valA = a[sortState.colId];
        const valB = b[sortState.colId];
        if (valA === valB) {
            return b.wins - a.wins || a.name.localeCompare(b.name, 'ja');
        }
        if (typeof valA === 'string') {
            return sortState.asc ? valA.localeCompare(valB, 'ja') : valB.localeCompare(valA, 'ja');
        }
        return sortState.asc ? valA - valB : valB - valA;
    });

    const tbody = document.querySelector('#summaryTable tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    summaryArray.forEach((item, index) => {
        const tr = document.createElement('tr');
        const winRateStr = item.games > 0 ? (item.winRate).toFixed(3).replace(/^0\./, '.') : '.000';

        // ★修正1: 余計な pc-col クラスを削除。これでタブレットでも列がズレない。
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td style="text-align: left; font-weight: bold;">${item.name}</td>
            <td>${item.games}</td>
            <td>${item.wins}</td>
            <td>${item.losses}</td>
            <td>${winRateStr}</td>
        `;
        tbody.appendChild(tr);
    });
}

function populatePlayerSelect() {
    const select = document.getElementById('playerSelect'); 
    if (!select) return;

    select.innerHTML = '<option value="">棋士を選択してください</option>';

    const sortedNames = Object.keys(playerStats).sort((a, b) => a.localeCompare(b, 'ja'));

    sortedNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
    });

    select.addEventListener('change', (e) => {
        renderHistory(e.target.value);
    });
}

function renderHistory(playerName) {
    const tbody = document.querySelector('#historyTable tbody');
    const statsCard = document.getElementById('playerStatsCard'); 
    
    if (!tbody || !statsCard) return;
    tbody.innerHTML = '';

    if (!playerName || !playerStats[playerName]) {
        statsCard.style.display = 'none';
        tbody.innerHTML = '<tr><td colspan="6" class="empty-message">棋士を選択してください</td></tr>';
        return;
    }

    const stats = playerStats[playerName];
    const winRateStr = stats.games > 0 ? (stats.wins / stats.games).toFixed(3).replace(/^0\./, '.') : '.000';
    statsCard.innerHTML = `${playerName} の成績： ${stats.games}戦 ${stats.wins}勝 ${stats.losses}敗 （勝率 ${winRateStr}）`;
    statsCard.style.display = 'block';

    const history = stats.history;
    history.sort((a, b) => new Date(b.date) - new Date(a.date));

    history.forEach((game) => {
        const tr = document.createElement('tr');

        const isSente = game.mySente;
        const opponent = isSente ? game.p2 : game.p1;
        const myResult = isSente ? game.res1 : game.res2;
        const senteGote = isSente ? '先手' : '後手';

        const resultStyle = (myResult === '○' || myResult === '□') ? 'color: #cba135; font-weight: bold;' : '';

        tr.innerHTML = `
            <td>${game.date || ''}</td>
            <td>${game.match || ''}</td>
            <td>${senteGote}</td>
            <td>${opponent || ''}</td>
            <td style="${resultStyle}">${myResult || ''}</td>
            <td>${game.notes || ''}</td>
        `;
        tbody.appendChild(tr);
    });
}