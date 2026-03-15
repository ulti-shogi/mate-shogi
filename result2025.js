let gameData = [];
let playerStats = {}; 
let summaryArray = [];

const sortState = { colId: 'score', asc: true };

window.addEventListener('DOMContentLoaded', () => {
    Promise.all([
        fetch('2025.csv').then(res => { if(!res.ok) throw new Error('2025.csv失敗'); return res.text(); }),
        fetch('kishi.csv').then(res => { if(!res.ok) throw new Error('kishi.csv失敗'); return res.text(); })
    ])
    .then(([gameText, kishiText]) => {
        processCSV(gameText, kishiText);
        setupUI();
    })
    .catch(error => console.error('エラー:', error));
});

function processCSV(gameText, kishiText) {
    const kishiLines = kishiText.replace(/\r/g, '').split('\n').filter(line => line.trim() !== '');
    
    // kishi.csvから辞書を作成
    const kishiMap = {};
    for (let i = 1; i < kishiLines.length; i++) {
        const row = kishiLines[i].split(',');
        if (row.length >= 4) {
            const id = parseInt(row[0]);
            const name = row[1].replace(/[\s　]/g, '').replace(/"/g, '');
            
            // 段位の判定
            let rankNum = 0;
            if (row.length > 8 && row[8] && row[8].trim() !== '') rankNum = 9;
            else if (row.length > 7 && row[7] && row[7].trim() !== '') rankNum = 8;
            else if (row.length > 6 && row[6] && row[6].trim() !== '') rankNum = 7;
            else if (row.length > 5 && row[5] && row[5].trim() !== '') rankNum = 6;
            else if (row.length > 4 && row[4] && row[4].trim() !== '') rankNum = 5;
            else if (row.length > 3 && row[3] && row[3].trim() !== '') rankNum = 4;

            // 引退の判定（10列目：row[9] に日付があるかどうか）
            let isRetired = false;
            if (row.length > 9 && row[9] && row[9].trim() !== '') {
                isRetired = true;
            }

            kishiMap[name] = { id: isNaN(id) ? 9999 : id, rankNum: rankNum, isRetired: isRetired };
        }
    }

    function calcPlayerScore(name) {
        if (!kishiMap[name]) return 99999; 
        if (kishiMap[name].isRetired) return 50000 + kishiMap[name].id;

        if(name === "藤井聡太") return 1;
        if(name === "伊藤匠") return 2;
        if(name === "谷川浩司") return 3;
        if(name === "羽生善治") return 4;
        if(name === "佐藤康光") return 5;
        if(name === "森内俊之") return 6;
        if(name === "渡辺明") return 7;

        const rankNum = kishiMap[name].rankNum;
        if(rankNum > 0) {
            return (10 - rankNum) * 1000 + kishiMap[name].id;
        } else {
            return 8000 + kishiMap[name].id; 
        }
    }

    function getPlayer(name) {
        if (!playerStats[name]) {
            playerStats[name] = {
                name: name,
                score: calcPlayerScore(name),
                wins: 0,
                losses: 0,
                games: []
            };
        }
        return playerStats[name];
    }

    const gameLines = gameText.replace(/\r/g, '').split('\n').filter(line => line.trim() !== '');
    for (let i = 1; i < gameLines.length; i++) {
        const row = gameLines[i].split(',');
        if (row.length < 7) continue;

        const date = row[0];
        const match = row[1];
        const notes = row[2] ? row[2] : "";
        const r1 = row[3];
        const p1 = row[4].replace(/[\s　]/g, '');
        const p2 = row[5].replace(/[\s　]/g, '');
        const r2 = row[6];
        const thousand = row[7] || "";
        const broadcast = row[8] || "";

        let extra = notes;
        if(thousand) extra += (extra ? " / " : "") + thousand;
        if(broadcast) extra += (extra ? " / 放送:" : "放送:") + broadcast;

        if (p1) {
            let player1 = getPlayer(p1);
            player1.games.push({ date: date, match: match, mySengo: "先手", opponent: p2, result: r1, extra: extra });
            if (r1 === "○" || r1 === "□") player1.wins++;
            if (r1 === "●" || r1 === "■") player1.losses++;
        }
        if (p2) {
            let player2 = getPlayer(p2);
            player2.games.push({ date: date, match: match, mySengo: "後手", opponent: p1, result: r2, extra: extra });
            if (r2 === "○" || r2 === "□") player2.wins++;
            if (r2 === "●" || r2 === "■") player2.losses++;
        }
    }

    summaryArray = Object.values(playerStats).map(p => {
        let total = p.wins + p.losses;
        let rate = total > 0 ? (p.wins / total) : 0;
        
        // ⬇⬇ ここを変更：「.625」から「0.6250」の形式（小数点以下4桁）に ⬇⬇
        let rateStr = rate.toFixed(4); 
        if (total === 0) rateStr = "-";
        
        return {
            ...p,
            totalGames: total,
            winRate: rate,
            winRateStr: rateStr
        };
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
                sortState.asc = (colId === 'score') ? true : false;
            }
            renderSummaryTable();
        });
    });

    const pSel = document.getElementById('playerSelect');
    pSel.appendChild(new Option("棋士を選択", ""));
    const sortedPlayers = [...summaryArray].sort((a,b) => a.score - b.score);
    sortedPlayers.forEach(p => pSel.appendChild(new Option(p.name, p.name)));

    pSel.addEventListener('change', renderHistoryTable);

    renderSummaryTable();
}

function renderSummaryTable() {
    let viewData = [...summaryArray];

    viewData.sort((a, b) => {
        let valA, valB;
        if (sortState.colId === 'games') { valA = a.totalGames; valB = b.totalGames; }
        else if (sortState.colId === 'wins') { valA = a.wins; valB = b.wins; }
        else if (sortState.colId === 'losses') { valA = a.losses; valB = b.losses; }
        else if (sortState.colId === 'winRate') { valA = a.winRate; valB = b.winRate; }
        else { valA = a.score; valB = b.score; }
        
        let cmp = valA - valB;
        if (cmp === 0) cmp = a.score - b.score;
        return sortState.asc ? cmp : -cmp;
    });

    const tbody = document.querySelector('#summaryTable tbody');
    tbody.innerHTML = viewData.map((d, index) => {
        let rankDisplay = d.score < 99999 ? index + 1 : "-";
        
        return `
        <tr>
            <td>${rankDisplay}</td>
            <td style="font-weight:bold;">${d.name}</td>
            <td>${d.totalGames}</td>
            <td>${d.wins}</td>
            <td>${d.losses}</td>
            <td style="font-weight:bold; color:#1a3622;">${d.winRateStr}</td>
        </tr>
        `;
    }).join('');

    document.querySelectorAll('#summaryTable th.sortable').forEach(th => {
        th.classList.remove('asc', 'desc');
        if (th.dataset.col === sortState.colId) {
            th.classList.add(sortState.asc ? 'asc' : 'desc');
        }
    });
}

function renderHistoryTable() {
    const pSel = document.getElementById('playerSelect');
    const tbody = document.querySelector('#historyTable tbody');
    const statsCard = document.getElementById('playerStatsCard');

    if (!pSel.value) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-message">棋士を選択してください</td></tr>';
        statsCard.style.display = "none";
        return;
    }

    const pData = playerStats[pSel.value];
    
    statsCard.style.display = "block";
    
    // ⬇⬇ ここも変更：「棋士別 対局履歴」のサマリー欄の勝率表示 ⬇⬇
    let rateStr = pData.wins + pData.losses > 0 ? (pData.wins / (pData.wins + pData.losses)).toFixed(4) : "-";
    
    statsCard.innerHTML = `2025年度成績： ${pData.wins}勝 ${pData.losses}敗 （勝率 ${rateStr}）`;

    let games = [...pData.games].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    if (games.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-message">対局データがありません</td></tr>';
    } else {
        tbody.innerHTML = games.map(g => {
            let resColor = (g.result === "○" || g.result === "□") ? "color: #d9534f; font-weight: bold;" : ((g.result === "●" || g.result === "■") ? "color: #0275d8;" : "");
            
            return `
            <tr>
                <td>${g.date}</td>
                <td style="font-weight:bold;">${g.match}</td>
                <td>${g.mySengo}</td>
                <td>${g.opponent}</td>
                <td style="${resColor} font-size:16px;">${g.result}</td>
                <td style="text-align:left; font-size: 12px;">${g.extra}</td>
            </tr>
            `;
        }).join('');
    }
}