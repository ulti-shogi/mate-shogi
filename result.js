let allGameRecords = []; // 全ファイルの対局データをため込む箱
let kishiMap = {};       // 序列ソート用の棋士名簿
let playerStats = {};    // 絞り込み後の成績データ
let summaryArray = [];   // 表描画用の配列

const sortState = { colId: 'score', asc: true };

// 💡 読み込むテキストファイルのリスト（正確なファイル名に修正）
const dataFiles = [
    '第74期王座戦.txt',
    '第85期順位戦.txt',
    '第39期竜王戦.txt',
    '第52期棋王戦.txt',
    '第67期王位戦.txt',
    '第76期王将戦.txt',
    '第11期叡王戦.txt',
    '第97期棋聖戦.txt',
    'タイトル戦対局結果.txt', // 💡修正
    '第76回NHK杯本戦.txt',   // 💡修正
    '第34期銀河戦.txt',
    '第47回JT杯.txt',
    '第16期加古川青流戦.txt', // 💡修正
    '第57期新人王戦.txt',
    '第4回達人戦.txt',
    '第20回朝日杯.txt'
];

window.addEventListener('DOMContentLoaded', () => {
    const fetchPromises = dataFiles.map(file => 
        fetch(file)
            .then(res => res.ok ? res.text() : "")
            .catch(() => {
                console.warn(`ファイルが見つかりません: ${file}`);
                return "";
            })
    );
    
    fetchPromises.push(
        fetch('kishi.csv')
            .then(res => res.ok ? res.text() : "")
            .catch(() => "")
    );

    Promise.all(fetchPromises).then(results => {
        const kishiText = results.pop(); 
        const gameTexts = results;       

        setupKishiMap(kishiText);
        parseAllGames(gameTexts);
        
        setupUI();
        applyFiltersAndAggregate(); 
    });
});

function createHeaderMap(headerLine) {
    const headers = headerLine.replace(/\r/g, '').split(',');
    const map = {};
    headers.forEach((h, i) => {
        map[h.replace(/^\uFEFF/, '').trim()] = i;
    });
    return map;
}

function setupKishiMap(kishiText) {
    if (!kishiText) return;
    const lines = kishiText.replace(/\r/g, '').split('\n').filter(l => l.trim() !== '');
    if (lines.length === 0) return;
    
    const headers = createHeaderMap(lines[0]);
    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',');
        const nameStr = row[headers['棋士名']];
        if (nameStr) {
            const name = nameStr.replace(/[\s ]/g, '').replace(/"/g, '');
            const numStr = row[headers['棋士番号']];
            const num = numStr ? parseInt(numStr, 10) : 9999;
            kishiMap[name] = num; 
        }
    }
}

function parseAllGames(gameTexts) {
    gameTexts.forEach(text => {
        if (!text) return;
        const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim() !== '');
        if (lines.length < 2) return;

        const headers = createHeaderMap(lines[0]);

        for (let i = 1; i < lines.length; i++) {
            const row = lines[i].split(',');
            if (row.length < 5) continue;

            // 💡 列名が 'the' だったり 'period' だったりする揺らぎを吸収
            let theStr = row[headers['the']]?.trim();
            if (!theStr && headers['period'] !== undefined) {
                theStr = row[headers['period']]?.trim();
            }
            
            const match = row[headers['match']]?.trim() || "";
            const phase = row[headers['phase']]?.trim() || "";
            const detail = row[headers['detail']]?.trim() || "";
            const notes = row[headers['notes']]?.trim() || "";
            const date = row[headers['game_date']]?.trim() || "";
            
            let matchDetailStr = "";
            if (theStr) {
                // JT杯などは「第〇回」、王将戦などは「第〇期」と表示を分ける
                if(match === "JT杯" || match === "NHK杯" || match === "朝日杯" || match === "達人戦") {
                    matchDetailStr += `第${theStr}回 `;
                } else {
                    matchDetailStr += `第${theStr}期 `;
                }
            }
            if (match) matchDetailStr += `${match} `;
            if (phase) matchDetailStr += `${phase} `;
            if (detail) matchDetailStr += `${detail} `;
            if (notes && notes !== "なし") matchDetailStr += `(${notes})`;
            matchDetailStr = matchDetailStr.replace(/\s+/g, ' ').trim();

            allGameRecords.push({
                date: date,
                match: match,          
                matchDetail: matchDetailStr, 
                p1: row[headers['player_A']]?.replace(/[\s ]/g, '').replace(/"/g, '') || "",
                p1_sengo: row[headers['A']]?.trim() || "",
                p1_res: row[headers['a']]?.trim() || "",
                p2: row[headers['player_B']]?.replace(/[\s ]/g, '').replace(/"/g, '') || "",
                p2_sengo: row[headers['B']]?.trim() || "",
                p2_res: row[headers['b']]?.trim() || ""
            });
        }
    });
}

function applyFiltersAndAggregate() {
    const yearFilter = document.getElementById('yearSelect').value;
    const matchFilter = document.getElementById('matchSelect').value;

    playerStats = {}; 

    function initPlayer(name) {
        // 名前が空文字、または「〇〇の勝者」のようなダミーデータの場合は登録しない
        if (!name || name.includes('の勝者') || name === '未定') return false;

        if (!playerStats[name]) {
            const score = kishiMap[name] !== undefined ? kishiMap[name] : 99999;
            playerStats[name] = { name: name, score: score, games: 0, wins: 0, losses: 0, history: [] };
        }
        return true;
    }

    function getNendo(dateStr) {
        if (!dateStr || !dateStr.includes('-')) return null;
        let parts = dateStr.split('-');
        let y = parseInt(parts[0], 10);
        let m = parseInt(parts[1], 10);
        if (isNaN(y)) return null;
        if (isNaN(m)) return y; 
        return m <= 3 ? y - 1 : y;
    }

    allGameRecords.forEach(g => {
        if (yearFilter !== 'all') {
            const nendo = getNendo(g.date);
            if (nendo !== parseInt(yearFilter, 10)) return; 
        }
        
        // 名人戦は「順位戦」ファイルの中に含まれることが多いので特別扱い
        if (matchFilter !== 'all') {
             if (matchFilter === '名人戦') {
                 if (g.match !== '名人戦' && g.match !== '順位戦') return;
             } else {
                 if (g.match !== matchFilter) return;
             }
        }

        if (initPlayer(g.p1)) {
            if (g.p1_res === '☆' || g.p1_res === '★' || g.p1_res === '□' || g.p1_res === '■' || g.p1_res === '○' || g.p1_res === '●') {
                playerStats[g.p1].games++;
                if (g.p1_res === '☆' || g.p1_res === '□' || g.p1_res === '○') playerStats[g.p1].wins++;
                if (g.p1_res === '★' || g.p1_res === '■' || g.p1_res === '●') playerStats[g.p1].losses++;
                playerStats[g.p1].history.push({
                    date: g.date, matchStr: g.matchDetail, mySengo: g.p1_sengo, opponent: g.p2, result: g.p1_res
                });
            }
        }
        if (initPlayer(g.p2)) {
            if (g.p2_res === '☆' || g.p2_res === '★' || g.p2_res === '□' || g.p2_res === '■' || g.p2_res === '○' || g.p2_res === '●') {
                playerStats[g.p2].games++;
                if (g.p2_res === '☆' || g.p2_res === '□' || g.p2_res === '○') playerStats[g.p2].wins++;
                if (g.p2_res === '★' || g.p2_res === '■' || g.p2_res === '●') playerStats[g.p2].losses++;
                playerStats[g.p2].history.push({
                    date: g.date, matchStr: g.matchDetail, mySengo: g.p2_sengo, opponent: g.p1, result: g.p2_res
                });
            }
        }
    });

    summaryArray = Object.values(playerStats).map(p => {
        let rate = p.games > 0 ? (p.wins / p.games) : 0;
        let rateStr = p.games > 0 ? rate.toFixed(4) : "-";
        return { ...p, winRate: rate, winRateStr: rateStr };
    });

    updatePlayerSelect();
    renderSummaryTable();
    renderHistoryTable(); 
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

    document.getElementById('yearSelect').addEventListener('change', applyFiltersAndAggregate);
    document.getElementById('matchSelect').addEventListener('change', applyFiltersAndAggregate);
    document.getElementById('playerSelect').addEventListener('change', renderHistoryTable);
}

function updatePlayerSelect() {
    const pSel = document.getElementById('playerSelect');
    const currentValue = pSel.value;
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

    let valueExists = false;
    sortedPlayers.forEach(p => {
        pSel.appendChild(new Option(p.name, p.name));
        if (p.name === currentValue) valueExists = true;
    });

    if (valueExists) pSel.value = currentValue;
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
        if (cmp !== 0) return sortState.asc ? cmp : -cmp;

        let scoreCmp = a.score - b.score;
        if (scoreCmp !== 0) return scoreCmp;
        let gameCmp = b.games - a.games;
        if (gameCmp !== 0) return gameCmp;
        let winCmp = b.wins - a.wins;
        if (winCmp !== 0) return winCmp;
        return a.name.localeCompare(b.name, 'ja');
    });

    const tbody = document.querySelector('#summaryTable tbody');
    if (viewData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-message">該当する対局データがありません</td></tr>';
    } else {
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
    }

    document.querySelectorAll('#summaryTable th.sortable').forEach(th => {
        th.classList.remove('asc', 'desc');
        if (th.dataset.col === sortState.colId) th.classList.add(sortState.asc ? 'asc' : 'desc');
    });
}

function renderHistoryTable() {
    const pSel = document.getElementById('playerSelect');
    const tbody = document.querySelector('#historyTable tbody');
    const statsCard = document.getElementById('playerStatsCard');

    if (!pSel.value || !playerStats[pSel.value]) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-message">名前を選択してください</td></tr>';
        statsCard.style.display = "none";
        return;
    }

    const pData = playerStats[pSel.value];
    statsCard.style.display = "block";
    
    const yearFilter = document.getElementById('yearSelect');
    const matchFilter = document.getElementById('matchSelect');
    const yearText = yearFilter.options[yearFilter.selectedIndex].text;
    const matchText = matchFilter.options[matchFilter.selectedIndex].text;
    
    let rateStr = pData.games > 0 ? (pData.wins / pData.games).toFixed(4) : "-";
    statsCard.innerHTML = `【${yearText} / ${matchText}】成績： ${pData.wins}勝 ${pData.losses}敗 （勝率 ${rateStr}）`;

    let games = [...pData.history].sort((a,b) => {
        let dA = new Date(a.date.replace(/x/g, '0'));
        let dB = new Date(b.date.replace(/x/g, '0'));
        return dB - dA;
    });

    tbody.innerHTML = games.length === 0 ? '<tr><td colspan="5" class="empty-message">データなし</td></tr>' :
        games.map(g => {
            let resColor = (g.result === "☆" || g.result === "□" || g.result === "○") ? "color: #d9534f; font-weight: bold;" : 
                           ((g.result === "★" || g.result === "■" || g.result === "●") ? "color: #0275d8;" : "");
            return `<tr>
                <td>${g.date}</td>
                <td style="font-weight:bold; text-align:left;">${g.matchStr}</td>
                <td>${g.mySengo}</td>
                <td>${g.opponent}</td>
                <td style="${resColor} font-size:16px;">${g.result}</td>
            </tr>`;
        }).join('');
}