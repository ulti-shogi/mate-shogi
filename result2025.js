let gameData = [];
let playerStats = {}; 
let summaryArray = [];

// 並び替え（ソート）の初期設定（最初は「序列＝裏スコア」順）
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
    // 1. kishi.csvから「段位」と「棋士番号」の辞書を作成
    const kishiLines = kishiText.replace(/\r/g, '').split('\n').filter(line => line.trim() !== '');
    const kishiMap = {};
    for (let i = 1; i < kishiLines.length; i++) {
        const row = kishiLines[i].split(',');
        if (row.length >= 7) {
            const id = parseInt(row[0]);
            const name = row[1].replace(/[\s　]/g, '').replace(/"/g, '');
            const rankStr = row[6].replace(/"/g, ''); // 段位
            kishiMap[name] = { id: isNaN(id) ? 9999 : id, rankStr: rankStr };
        }
    }

    // 2. 序列（裏スコア）を計算する関数
    function calcPlayerScore(name) {
        // 特別枠7名（最上位）
        if(name === "藤井聡太") return 1;
        if(name === "伊藤匠") return 2;
        if(name === "谷川浩司") return 3;
        if(name === "羽生善治") return 4;
        if(name === "佐藤康光") return 5;
        if(name === "森内俊之") return 6;
        if(name === "渡辺明") return 7;

        // 正規の棋士（段位と棋士番号から計算）
        if(kishiMap[name]) {
            const r = kishiMap[name].rankStr;
            let rankNum = 0;
            if(r.includes("九段")) rankNum = 9;
            else if(r.includes("八段")) rankNum = 8;
            else if(r.includes("七段")) rankNum = 7;
            else if(r.includes("六段")) rankNum = 6;
            else if(r.includes("五段")) rankNum = 5;
            else if(r.includes("四段")) rankNum = 4;
            
            if(rankNum > 0) {
                // (10 - 段位)*1000 + 棋士番号 でスコア化（数字が小さいほど上位）
                return (10 - rankNum) * 1000 + kishiMap[name].id;
            } else {
                return 8000 + kishiMap[name].id; // 称号などで段位不明な棋士
            }
        }
        // kishi.csvにいない人（女流、三段、アマ）はどん底へ
        return 99999;
    }

    // プレイヤーの成績箱を取得・作成する関数
    function getPlayer(name) {
        if (!playerStats[name]) {
            playerStats[name] = {
                name: name,
                rankStr: kishiMap[name] ? kishiMap[name].rankStr : "棋士以外",
                score: calcPlayerScore(name),
                wins: 0,
                losses: 0,
                games: [] // 対局履歴
            };
        }
        return playerStats[name];
    }

    // 3. 2025.csvの対局結果を読み込み、それぞれの成績箱に振り分ける
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

        // 備考欄を作成（クラス、千日手、放送日などをまとめる）
        let extra = notes;
        if(thousand) extra += (extra ? " / " : "") + thousand;
        if(broadcast) extra += (extra ? " / 放送:" : "放送:") + broadcast;

        // 先手の処理
        if (p1) {
            let player1 = getPlayer(p1);
            player1.games.push({ date: date, match: match, mySengo: "先手", opponent: p2, result: r1, extra: extra });
            if (r1 === "○") player1.wins++;
            if (r1 === "●") player1.losses++;
        }
        // 後手の処理
        if (p2) {
            let player2 = getPlayer(p2);
            player2.games.push({ date: date, match: match, mySengo: "後手", opponent: p1, result: r2, extra: extra });
            if (r2 === "○") player2.wins++;
            if (r2 === "●") player2.losses++;
        }
    }

    // 4. 勝率の計算と、一覧用配列の作成
    summaryArray = Object.values(playerStats).map(p => {
        let total = p.wins + p.losses;
        let rate = total > 0 ? (p.wins / total) : 0;
        
        // 勝率を ".750" のような表記に直す
        let rateStr = rate.toFixed(3).replace(/^0\./, '.'); 
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
    // タブの切り替え処理
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
            this.classList.add('active');
            document.getElementById(this.dataset.target).classList.add('active');
        });
    });

    // 「全棋士 勝敗一覧」の並び替え処理
    document.querySelectorAll('#summaryTable th.sortable').forEach(th => {
        th.addEventListener('click', function() {
            let colId = this.dataset.col;
            if (sortState.colId === colId) {
                sortState.asc = !sortState.asc;
            } else {
                sortState.colId = colId;
                // 勝率、勝数、対局数などは初期クリックで「多い順（降順）」にする
                sortState.asc = (colId === 'score') ? true : false;
            }
            renderSummaryTable();
        });
    });

    // 「棋士別 対局履歴」のプルダウン作成（裏スコア順＝藤井聡太から順に並べる）
    const pSel = document.getElementById('playerSelect');
    pSel.appendChild(new Option("棋士を選択", ""));
    const sortedPlayers = [...summaryArray].sort((a,b) => a.score - b.score);
    sortedPlayers.forEach(p => pSel.appendChild(new Option(p.name, p.name)));

    pSel.addEventListener('change', renderHistoryTable);

    // 初期描画
    renderSummaryTable();
}

function renderSummaryTable() {
    let viewData = [...summaryArray];

    // ソート処理
    viewData.sort((a, b) => {
        let valA, valB;
        if (sortState.colId === 'games') { valA = a.totalGames; valB = b.totalGames; }
        else if (sortState.colId === 'wins') { valA = a.wins; valB = b.wins; }
        else if (sortState.colId === 'losses') { valA = a.losses; valB = b.losses; }
        else if (sortState.colId === 'winRate') { valA = a.winRate; valB = b.winRate; }
        else { valA = a.score; valB = b.score; } // score（序列）
        
        let cmp = valA - valB;
        if (cmp === 0) cmp = a.score - b.score; // 同点なら序列優先
        return sortState.asc ? cmp : -cmp;
    });

    const tbody = document.querySelector('#summaryTable tbody');
    tbody.innerHTML = viewData.map((d, index) => {
        // 特別枠と正規棋士には1からの通し番号を、棋士以外には「-」を振る
        let rankDisplay = d.score < 99999 ? index + 1 : "-";
        
        return `
        <tr>
            <td>${rankDisplay}</td>
            <td style="font-weight:bold;">${d.name}</td>
            <td style="color:#cba135;">${d.rankStr}</td>
            <td>${d.totalGames}</td>
            <td>${d.wins}</td>
            <td>${d.losses}</td>
            <td style="font-weight:bold; color:#1a3622;">${d.winRateStr}</td>
        </tr>
        `;
    }).join('');

    // アイコン更新
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
    
    // サマリーカードの表示
    statsCard.style.display = "block";
    let rateStr = pData.wins + pData.losses > 0 ? (pData.wins / (pData.wins + pData.losses)).toFixed(3).replace(/^0\./, '.') : "-";
    statsCard.innerHTML = `2025年度成績： ${pData.wins}勝 ${pData.losses}敗 （勝率 ${rateStr}）`;

    // 対局履歴を日付の新しい順（降順）に並び替えて表示
    let games = [...pData.games].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    if (games.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-message">対局データがありません</td></tr>';
    } else {
        tbody.innerHTML = games.map(g => {
            // 勝敗の文字色づけ
            let resColor = g.result === "○" ? "color: #d9534f; font-weight: bold;" : (g.result === "●" ? "color: #0275d8;" : "");
            
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