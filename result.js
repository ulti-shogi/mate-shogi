let allGameRecords = []; 
let kishiMap = {};       
let joryuMap = {}; // 💡 joryuSet から joryuMap に変更（所属や番号も保持するため）
let playerStats = {};    

let kishiSummary = [];   
let joryuSummary = [];
let shoreikaiSummary = [];
let amaSummary = [];
let othersSummary = [];  

const sortStateKishi = { colId: 'num', asc: true };
const sortStateOthers = { colId: 'games', asc: false }; 

// 💡 変更箇所：個別の棋戦ファイルから、結合ツールで作った「まとめファイル」に変更
const dataFiles = [
    'games_2026.txt',
    'games_2025.txt',
    // 💡 今後過去のデータを追加する場合は、以下のようにカンマ区切りで書き足すだけでOKです！
    // 'games_2024.txt',
    // 'games_2023.txt'
];

window.addEventListener('DOMContentLoaded', () => {
    const fetchPromises = dataFiles.map(file => 
        fetch(file).then(res => res.ok ? res.text() : "").catch(() => "")
    );
    
    fetchPromises.push(fetch('profile_kishi.txt').then(res => res.ok ? res.text() : "").catch(() => ""));
    fetchPromises.push(fetch('profile_joryu.txt').then(res => res.ok ? res.text() : "").catch(() => "")); 

    Promise.all(fetchPromises).then(results => {
        const profileJoryuText = results.pop(); 
        const profileKishiText = results.pop(); 
        const gameTexts = results;       

        setupKishiMap(profileKishiText);
        setupJoryuMap(profileJoryuText); 
        parseAllGames(gameTexts);
        
        setupYearSelect();
        
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

function setupKishiMap(profileText) {
    if (profileText) {
        const lines = profileText.replace(/\r/g, '').split('\n').filter(l => l.trim() !== '');
        if (lines.length > 0) {
            const headers = createHeaderMap(lines[0]);
            for (let i = 1; i < lines.length; i++) {
                const row = lines[i].split(',');
                const nameStr = row[headers['fullname']];
                if (nameStr) {
                    const name = nameStr.replace(/[\s ]/g, '').replace(/"/g, '');
                    const numStr = row[headers['num']];
                    kishiMap[name] = numStr ? parseInt(numStr, 10) : 99999; 
                }
            }
        }
    }
}

function setupJoryuMap(profileText) {
    if (profileText) {
        const lines = profileText.replace(/\r/g, '').split('\n').filter(l => l.trim() !== '');
        if (lines.length > 0) {
            const headers = createHeaderMap(lines[0]);
            for (let i = 1; i < lines.length; i++) {
                const row = lines[i].split(',');
                const nameStr = row[headers['女流棋士名']]; 
                const affStr = row[headers['所属']];
                const numStr = row[headers['女流棋士番号']];

                if (nameStr) {
                    const name = nameStr.replace(/[\s ]/g, '').replace(/"/g, '');
                    const affiliation = affStr ? affStr.trim() : 'フリー';
                    
                    let affScore = 3; 
                    if (affiliation === 'JSA') affScore = 1;
                    else if (affiliation === 'LPSA') affScore = 2;

                    const num = numStr ? parseInt(numStr, 10) : 99999;
                    
                    joryuMap[name] = { affScore: affScore, num: num };
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
            if (notes && notes !== "なし") matchDetailStr += ` ${notes}`;
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

function getNendo(dateStr) {
    if (!dateStr || !dateStr.includes('-')) return null;
    let parts = dateStr.split('-');
    let y = parseInt(parts[0], 10), m = parseInt(parts[1], 10);
    if (isNaN(y)) return null;
    if (isNaN(m)) return y; 
    return m <= 3 ? y - 1 : y;
}

function setupYearSelect() {
    const yearSet = new Set();
    allGameRecords.forEach(g => {
        const nendo = getNendo(g.date);
        if (nendo !== null) yearSet.add(nendo);
    });

    const sortedYears = Array.from(yearSet).sort((a, b) => b - a);
    const yearSelect = document.getElementById('yearSelect');
    yearSelect.innerHTML = '<option value="all">全期間</option>';
    
    sortedYears.forEach((year, index) => {
        const option = document.createElement('option');
        option.value = year;
        option.text = `${year}年度`;
        if (index === 0) option.selected = true; 
        yearSelect.appendChild(option);
    });
}

function applyFiltersAndAggregate() {
    const yearFilter = document.getElementById('yearSelect').value;

    playerStats = {}; 

    function initPlayer(name) {
        if (!name || name.includes('の勝者') || name === '未定') return false;
        if (!playerStats[name]) {
            const isKishi = kishiMap[name] !== undefined;
            const isJoryu = joryuMap[name] !== undefined;
            const isShoreikai = name.endsWith('三段');
            const isAma = name.endsWith('アマ');
            const isOthers = !isKishi && !isJoryu && !isShoreikai && !isAma;

            const score = isKishi ? kishiMap[name] : 99999;
            const jAff = isJoryu ? joryuMap[name].affScore : 99;
            const jNum = isJoryu ? joryuMap[name].num : 99999;

            playerStats[name] = { 
                name: name, score: score, jAff: jAff, jNum: jNum,
                isKishi, isJoryu, isShoreikai, isAma, isOthers, 
                games: 0, wins: 0, losses: 0, history: [] 
            };
        }
        return true;
    }

    const validRes = ['☆', '★', '□', '■', '○', '●'];

    allGameRecords.forEach(g => {
        if (yearFilter !== 'all' && getNendo(g.date) !== parseInt(yearFilter, 10)) return; 

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
    joryuSummary = allSummary.filter(p => p.isJoryu);
    shoreikaiSummary = allSummary.filter(p => p.isShoreikai);
    amaSummary = allSummary.filter(p => p.isAma);
    othersSummary = allSummary.filter(p => p.isOthers);

    renderSummaryTable('kishi');
    renderSummaryTable('joryu');
    renderSummaryTable('shoreikai');
    renderSummaryTable('ama');
    renderSummaryTable('others');

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
            if (target === 'kishi') {
                if (sortStateKishi.colId === colId) sortStateKishi.asc = !sortStateKishi.asc;
                else { sortStateKishi.colId = colId; sortStateKishi.asc = (colId === 'num'); }
            } else if (target === 'others') {
                if (sortStateOthers.colId === colId) sortStateOthers.asc = !sortStateOthers.asc;
                else { sortStateOthers.colId = colId; sortStateOthers.asc = (colId === 'num'); }
            }
            renderSummaryTable(target);
        });
    });

    document.getElementById('yearSelect').addEventListener('change', applyFiltersAndAggregate);

    document.getElementById('backToListBtn').addEventListener('click', () => {
        document.getElementById('history-view').style.display = 'none';
        document.getElementById('list-view').style.display = 'block';
        window.scrollTo(0, 0); 
    });
}

function renderSummaryTable(target) {
    let viewData, state, tableId;
    
    if (target === 'kishi') { viewData = [...kishiSummary]; state = sortStateKishi; tableId = '#summaryTableKishi'; }
    else if (target === 'others') { viewData = [...othersSummary]; state = sortStateOthers; tableId = '#summaryTableOthers'; }
    else if (target === 'joryu') { viewData = [...joryuSummary]; tableId = '#summaryTableJoryu'; }
    else if (target === 'shoreikai') { viewData = [...shoreikaiSummary]; tableId = '#summaryTableShoreikai'; }
    else if (target === 'ama') { viewData = [...amaSummary]; tableId = '#summaryTableAma'; }

    viewData.sort((a, b) => {
        if (target === 'kishi' || target === 'others') {
            let valA, valB;
            if (state.colId === 'games') { valA = a.games; valB = b.games; }
            else if (state.colId === 'wins') { valA = a.wins; valB = b.wins; }
            else if (state.colId === 'losses') { valA = a.losses; valB = b.losses; }
            else if (state.colId === 'winRate') { valA = a.winRate; valB = b.winRate; }
            else { valA = a.score; valB = b.score; } 
            
            let cmp = valA - valB;
            if (cmp !== 0) return state.asc ? cmp : -cmp;

            if (target === 'kishi') {
                if (state.colId === 'games') {
                    if (a.wins !== b.wins) return b.wins - a.wins;
                } else if (['wins', 'losses', 'winRate'].includes(state.colId)) {
                    if (a.games !== b.games) return b.games - a.games;
                }
                return a.score - b.score;
            } else {
                let scoreCmp = a.score - b.score;
                if (scoreCmp !== 0) return scoreCmp;
                let gameCmp = b.games - a.games;
                if (gameCmp !== 0) return gameCmp;
                return a.name.localeCompare(b.name, 'ja');
            }
        } else if (target === 'joryu') {
            if (a.jAff !== b.jAff) return a.jAff - b.jAff;
            if (a.jNum !== b.jNum) return a.jNum - b.jNum;
            return a.name.localeCompare(b.name, 'ja');
        } else {
            return a.name.localeCompare(b.name, 'ja');
        }
    });

    const tbody = document.querySelector(`${tableId} tbody`);
    if (viewData.length === 0) {
        let colspan = (target === 'others') ? 5 : 6;
        tbody.innerHTML = `<tr><td colspan="${colspan}" class="empty-message">データなし</td></tr>`;
    } else {
        let currentRank = 1;
        let prevVal = null;

        tbody.innerHTML = viewData.map((d, index) => {
            const nameLink = `<a href="javascript:void(0);" onclick="showHistory('${d.name}')" style="color: #0056b3; text-decoration: underline; font-weight: bold; display: block; padding: 5px 0;">${d.name}</a>`;
            
            if (target === 'kishi') {
                let currVal;
                if (state.colId === 'games') currVal = d.games;
                else if (state.colId === 'wins') currVal = d.wins;
                else if (state.colId === 'losses') currVal = d.losses;
                else if (state.colId === 'winRate') currVal = d.winRate;
                else currVal = d.score; 

                if (index > 0 && currVal !== prevVal) currentRank = index + 1; 
                prevVal = currVal; 

                return `<tr>
                    <td>${currentRank}</td><td style="text-align:left;">${nameLink}</td>
                    <td>${d.games}</td><td>${d.wins}</td><td>${d.losses}</td>
                    <td style="font-weight:bold; color:#1a3622;">${d.winRateStr}</td>
                </tr>`;
            } else if (target === 'others') {
                return `<tr>
                    <td style="text-align:left;">${nameLink}</td>
                    <td>${d.games}</td><td>${d.wins}</td><td>${d.losses}</td>
                    <td style="font-weight:bold; color:#1a3622;">${d.winRateStr}</td>
                </tr>`;
            } else {
                return `<tr>
                    <td>${index + 1}</td><td style="text-align:left;">${nameLink}</td>
                    <td>${d.games}</td><td>${d.wins}</td><td>${d.losses}</td>
                    <td style="font-weight:bold; color:#1a3622;">${d.winRateStr}</td>
                </tr>`;
            }
        }).join('');
    }

    if (target === 'kishi' || target === 'others') {
        document.querySelectorAll(`${tableId} th.sortable`).forEach(th => {
            th.classList.remove('asc', 'desc');
            if (th.dataset.col === state.colId) th.classList.add(state.asc ? 'asc' : 'desc');
        });
    }
}

window.showHistory = function(playerName) {
    const pData = playerStats[playerName];
    if (!pData) return;

    document.getElementById('list-view').style.display = 'none';
    document.getElementById('history-view').style.display = 'block';
    window.scrollTo(0, 0); 

    const statsCard = document.getElementById('playerStatsCard');
    const tbody = document.querySelector('#historyTable tbody');

    const yearFilter = document.getElementById('yearSelect');
    const yearText = yearFilter.options[yearFilter.selectedIndex].text;
    
    let rateStr = pData.games > 0 ? (pData.wins / pData.games).toFixed(4) : "-";
    statsCard.innerHTML = `【${playerName}】<br><span style="font-size: 0.9em; font-weight: normal;">${yearText}： ${pData.wins}勝 ${pData.losses}敗 （勝率 ${rateStr}）</span>`;

    let games = [...pData.history].sort((a,b) => {
        let dA = new Date(a.date.replace(/x/g, '0'));
        let dB = new Date(b.date.replace(/x/g, '0'));
        return dB - dA;
    });

    tbody.innerHTML = games.length === 0 ? '<tr><td colspan="5" class="empty-message">データなし</td></tr>' :
        games.map(g => {
            let resColor = (g.result === "☆" || g.result === "□" || g.result === "○") ? "color: #d9534f; font-weight: bold;" : 
                           ((g.result === "★" || g.result === "■" || g.result === "●") ? "color: #0275d8;" : "");
            
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