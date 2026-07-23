let allGameRecords = []; 
let kishiMap = {};       
let officialKishiSet = new Set(); 
let playerStats = {};    
let kishiSummary = [];   
let othersSummary = [];  

const sortStateKishi = { colId: 'score', asc: true };
const sortStateOthers = { colId: 'games', asc: false }; 

const dataFiles = [
    '第74期王座戦.txt', '第85期順位戦.txt', '第39期竜王戦.txt', '第52期棋王戦.txt',
    '第67期王位戦.txt', '第76期王将戦.txt', '第11期叡王戦.txt', '第97期棋聖戦.txt',
    '第98期棋聖戦.txt', 'タイトル戦対局結果.txt', '第76回NHK杯本戦.txt', '第34期銀河戦.txt',
    '第47回JT杯.txt', '第46回JT杯.txt', '第16期加古川青流戦.txt', '第57期新人王戦.txt',
    '第4回達人戦.txt', '第20回朝日杯.txt', '第33期銀河戦.txt', '第38期竜王戦.txt', '第73期王座戦.txt'
];

window.addEventListener('DOMContentLoaded', () => {
    const fetchPromises = dataFiles.map(file => 
        fetch(file).then(res => res.ok ? res.text() : "").catch(() => "")
    );
    
    fetchPromises.push(fetch('kishi.csv').then(res => res.ok ? res.text() : "").catch(() => ""));
    fetchPromises.push(fetch('profile_kishi.txt').then(res => res.ok ? res.text() : "").catch(() => ""));

    Promise.all(fetchPromises).then(results => {
        const profileText = results.pop(); 
        const kishiText = results.pop(); 
        const gameTexts = results;       

        setupKishiMap(kishiText, profileText);
        parseAllGames(gameTexts);
        
        setupUI();
        applyFiltersAndAggregate(); 
    });
});

function createHeaderMap(headerLine) {
    const headers = headerLine.replace(/\r/g, '').split(',');
    const map = {};
    headers.forEach((h, i) => { map[h.replace(/^\uFEFF/, '').trim()] = i; });
    return map;
}

function setupKishiMap(kishiText, profileText) {
    if (kishiText) {
        const lines = kishiText.replace(/\r/g, '').split('\n').filter(l => l.trim() !== '');
        if (lines.length > 0) {
            const headers = createHeaderMap(lines[0]);
            for (let i = 1; i < lines.length; i++) {
                const row = lines[i].split(',');
                const nameStr = row[headers['棋士名']];
                if (nameStr) {
                    const name = nameStr.replace(/[\s ]/g, '').replace(/"/g, '');
                    const numStr = row[headers['棋士番号']];
                    kishiMap[name] = numStr ? parseInt(numStr, 10) : 9999; 
                }
            }
        }
    }
    if (profileText) {
        const lines = profileText.replace(/\r/g, '').split('\n').filter(l => l.trim() !== '');
        if (lines.length > 0) {
            const headers = createHeaderMap(lines[0]);
            for (let i = 1; i < lines.length; i++) {
                const row = lines[i].split(',');
                const nameStr = row[headers['fullname']];
                if (nameStr) {
                    officialKishiSet.add(nameStr.replace(/[\s ]/g, '').replace(/"/g, ''));
                }
            }
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

            let theStr = row[headers['the']]?.trim() || row[headers['period']]?.trim() || "";
            const match = row[headers['match']]?.trim() || "";
            const phase = row[headers['phase']]?.trim() || "";
            const detail = row[headers['detail']]?.trim() || "";
            const notes = row[headers['notes']]?.trim() || "";
            const date = row[headers['game_date']]?.trim() || "";
            
            let matchDetailStr = "";
            if (theStr) {
                if(["JT杯", "NHK杯", "朝日杯", "達人戦"].includes(match)) {
                    matchDetailStr += `第${theStr}回 `;
                } else {
                    matchDetailStr += `第${theStr}期 `;
                }
            }
            if (match) matchDetailStr += `${match} `;
            if (phase) matchDetailStr += `${phase} `;
            if (detail) matchDetailStr += `${detail} `;
            if (notes && notes !== "なし") matchDetailStr += ` ${notes}`; // 💡 カッコを削除
            matchDetailStr = matchDetailStr.replace(/\s+/g, ' ').trim();

            allGameRecords.push({
                date: date, match: match, matchDetail: matchDetailStr, 
                p1: row[headers['player_A']]?.replace(/[\s ]/g, '').replace(/"/g, '') || "",
                p1_sengo: row[headers['A']]?.trim() || "", p1_res: row[headers['a']]?.trim() || "",
                p2: row[headers['player_B']]?.replace(/[\s ]/g, '').replace(/"/g, '') || "",
                p2_sengo: row[headers['B']]?.trim() || "", p2_res: row[headers['b']]?.trim() || ""
            });
        }
    });
}

function applyFiltersAndAggregate() {
    const yearFilter = document.getElementById('yearSelect').value;
    const matchFilter = document.getElementById('matchSelect').value;

    playerStats = {}; 

    function initPlayer(name) {
        if (!name || name.includes('の勝者') || name === '未定') return false;
        if (!playerStats[name]) {
            const score = kishiMap[name] !== undefined ? kishiMap[name] : 99999;
            const isKishi = officialKishiSet.has(name);
            playerStats[name] = { name: name, score: score, isKishi: isKishi, games: 0, wins: 0, losses: 0, history: [] };
        }
        return true;
    }

    function getNendo(dateStr) {
        if (!dateStr || !dateStr.includes('-')) return null;
        let parts = dateStr.split('-');
        let y = parseInt(parts[0], 10), m = parseInt(parts[1], 10);
        if (isNaN(y)) return null;
        if (isNaN(m)) return y; 
        return m <= 3 ? y - 1 : y;
    }

    const validRes = ['☆', '★', '□', '■', '○', '●'];

    allGameRecords.forEach(g => {
        if (yearFilter !== 'all' && getNendo(g.date) !== parseInt(yearFilter, 10)) return; 
        if (matchFilter !== 'all') {
             if (matchFilter === '名人戦') { if (g.match !== '名人戦' && g.match !== '順位戦') return; } 
             else if (g.match !== matchFilter) return;
        }

        if (initPlayer(g.p1) && validRes.includes(g.p1_res)) {
            playerStats[g.p1].games++;
            if (['☆', '□', '○'].includes(g.p1_res)) playerStats[g.p1].wins++;
            else playerStats[g.p1].losses++;
            playerStats[g.p1].history.push({ date: g.date, matchStr: g.matchDetail, mySengo: g.p1_sengo, opponent: g.p2, result: g.p1_res });
        }
        if (initPlayer(g.p2) && validRes.includes(g.p2_res)) {
            playerStats[g.p2].games++;
            if (['☆', '□', '○'].includes(g.p2_res)) playerStats[g.p2].wins++;
            else playerStats[g.p2].losses++;
            playerStats[g.p2].history.push({ date: g.date, matchStr: g.matchDetail, mySengo: g.p2_sengo, opponent: g.p1, result: g.p2_res });
        }
    });

    const allSummary = Object.values(playerStats).map(p => {
        let rate = p.games > 0 ? (p.wins / p.games) : 0;
        return { ...p, winRate: rate, winRateStr: p.games > 0 ? rate.toFixed(4) : "-" };
    });

    kishiSummary = allSummary.filter(p => p.isKishi);
    othersSummary = allSummary.filter(p => !p.isKishi);

    renderSummaryTable('kishi');
    renderSummaryTable('others');

    // 💡 絞り込みが変わったら必ずリスト画面に戻す
    document.getElementById('list-view').style.display = 'block';
    document.getElementById('history-view').style.display = 'none';
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

    document.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', function() {
            let colId = this.dataset.col;
            let target = this.dataset.target; 
            let state = target === 'kishi' ? sortStateKishi : sortStateOthers;

            if (state.colId === colId) {
                state.asc = !state.asc;
            } else {
                state.colId = colId;
                state.asc = (colId === 'score');
            }
            renderSummaryTable(target);
        });
    });

    document.getElementById('yearSelect').addEventListener('change', applyFiltersAndAggregate);
    document.getElementById('matchSelect').addEventListener('change', applyFiltersAndAggregate);

    // 💡 戻るボタンのイベント
    document.getElementById('backToListBtn').addEventListener('click', () => {
        document.getElementById('history-view').style.display = 'none';
        document.getElementById('list-view').style.display = 'block';
        window.scrollTo(0, 0); // 戻った時に一番上へ
    });
}

function renderSummaryTable(target) {
    let viewData = target === 'kishi' ? [...kishiSummary] : [...othersSummary];
    let state = target === 'kishi' ? sortStateKishi : sortStateOthers;
    let tableId = target === 'kishi' ? '#summaryTableKishi' : '#summaryTableOthers';

    viewData.sort((a, b) => {
        let valA, valB;
        if (state.colId === 'games') { valA = a.games; valB = b.games; }
        else if (state.colId === 'wins') { valA = a.wins; valB = b.wins; }
        else if (state.colId === 'losses') { valA = a.losses; valB = b.losses; }
        else if (state.colId === 'winRate') { valA = a.winRate; valB = b.winRate; }
        else { valA = a.score; valB = b.score; }
        
        let cmp = valA - valB;
        if (cmp !== 0) return state.asc ? cmp : -cmp;

        let scoreCmp = a.score - b.score;
        if (scoreCmp !== 0) return scoreCmp;
        let gameCmp = b.games - a.games;
        if (gameCmp !== 0) return gameCmp;
        return a.name.localeCompare(b.name, 'ja');
    });

    const tbody = document.querySelector(`${tableId} tbody`);
    if (viewData.length === 0) {
        let colspan = target === 'kishi' ? 6 : 5;
        tbody.innerHTML = `<tr><td colspan="${colspan}" class="empty-message">データなし</td></tr>`;
    } else {
        tbody.innerHTML = viewData.map((d, index) => {
            // 💡 名前をタップ可能なリンクに装飾
            const nameLink = `<a href="javascript:void(0);" onclick="showHistory('${d.name}')" style="color: #0056b3; text-decoration: underline; font-weight: bold; display: block; padding: 5px 0;">${d.name}</a>`;
            if (target === 'kishi') {
                return `<tr>
                    <td>${index + 1}</td><td style="text-align:left;">${nameLink}</td>
                    <td>${d.games}</td><td>${d.wins}</td><td>${d.losses}</td>
                    <td style="font-weight:bold; color:#1a3622;">${d.winRateStr}</td>
                </tr>`;
            } else {
                return `<tr>
                    <td style="text-align:left;">${nameLink}</td>
                    <td>${d.games}</td><td>${d.wins}</td><td>${d.losses}</td>
                    <td style="font-weight:bold; color:#1a3622;">${d.winRateStr}</td>
                </tr>`;
            }
        }).join('');
    }

    document.querySelectorAll(`${tableId} th.sortable`).forEach(th => {
        th.classList.remove('asc', 'desc');
        if (th.dataset.col === state.colId) th.classList.add(state.asc ? 'asc' : 'desc');
    });
}

// 💡 名前がタップされた時に呼ばれる画面切り替え関数
window.showHistory = function(playerName) {
    const pData = playerStats[playerName];
    if (!pData) return;

    // 画面切り替えと一番上へのスクロール
    document.getElementById('list-view').style.display = 'none';
    document.getElementById('history-view').style.display = 'block';
    window.scrollTo(0, 0); 

    const statsCard = document.getElementById('playerStatsCard');
    const tbody = document.querySelector('#historyTable tbody');

    const yearFilter = document.getElementById('yearSelect');
    const matchFilter = document.getElementById('matchSelect');
    const yearText = yearFilter.options[yearFilter.selectedIndex].text;
    const matchText = matchFilter.options[matchFilter.selectedIndex].text;
    
    let rateStr = pData.games > 0 ? (pData.wins / pData.games).toFixed(4) : "-";
    statsCard.innerHTML = `【${playerName}】<br><span style="font-size: 0.9em; font-weight: normal;">${yearText} / ${matchText}： ${pData.wins}勝 ${pData.losses}敗 （勝率 ${rateStr}）</span>`;

    let games = [...pData.history].sort((a,b) => {
        let dA = new Date(a.date.replace(/x/g, '0'));
        let dB = new Date(b.date.replace(/x/g, '0'));
        return dB - dA;
    });

    tbody.innerHTML = games.length === 0 ? '<tr><td colspan="5" class="empty-message">データなし</td></tr>' :
        games.map(g => {
            let resColor = (g.result === "☆" || g.result === "□" || g.result === "○") ? "color: #d9534f; font-weight: bold;" : 
                           ((g.result === "★" || g.result === "■" || g.result === "●") ? "color: #0275d8;" : "");
            
            // 💡 相手の名前もタップできるようにする（Wikipedia的な回遊）
            let oppLink = g.opponent;
            if (playerStats[g.opponent]) {
                oppLink = `<a href="javascript:void(0);" onclick="showHistory('${g.opponent}')" style="color: #0056b3; text-decoration: underline;">${g.opponent}</a>`;
            }

            return `<tr>
                <td style="white-space: nowrap;">${g.date}</td>
                <td style="${resColor} font-size:16px;">${g.result}</td>
                <td>${oppLink}</td>
                <td>${g.mySengo}</td>
                <td style="font-weight:bold; text-align:left;">${g.matchStr}</td>
            </tr>`;
        }).join('');
};