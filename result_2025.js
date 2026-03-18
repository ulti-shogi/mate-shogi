let gameData = [];
let playerStats = {}; 
let summaryArray = [];

// ソート状態の管理
const sortState = { colId: 'score', asc: true };

window.addEventListener('DOMContentLoaded', () => {
    // 読み込むファイル名を「result_2025.csv」に統一
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

/**
 * 💡【新機能】1行目のヘッダーから「列名とインデックスの対応表」を作る関数
 * 例: {"棋士番号": 0, "棋士名": 1, ...}
 */
function createHeaderMap(headerLine) {
    const headers = headerLine.replace(/\r/g, '').split(',');
    const map = {};
    headers.forEach((h, i) => {
        // BOM（不可視の文字化け原因）や前後の空白を除去して安全にする
        const cleanH = h.replace(/^\uFEFF/, '').trim();
        map[cleanH] = i;
    });
    return map;
}

function processCSV(gameText, kishiText) {
    // ==========================================
    // 1. kishi.csv の処理（辞書の作成）
    // ==========================================
    const kishiLines = kishiText.replace(/\r/g, '').split('\n').filter(line => line.trim() !== '');
    
    // ヘッダーマップを作成
    const kishiHeaders = createHeaderMap(kishiLines[0]);
    
    const kishiMap = {};
    for (let i = 1; i < kishiLines.length; i++) {
        const row = kishiLines[i].split(',');
        
        // 列名を使って値を取得
        const idStr = row[kishiHeaders['棋士番号']];
        const nameStr = row[kishiHeaders['棋士名']];
        
        if (idStr && nameStr) {
            const id = parseInt(idStr, 10);
            const name = nameStr.replace(/[\s　]/g, '').replace(/"/g, ''); // 空白と引用符を除去
            kishiMap[name] = id;
        }
    }

    // ==========================================
    // 2. result_2025.csv の処理（勝敗の集計）
    // ==========================================
    const gameLines = gameText.replace(/\r/g, '').split('\n').filter(line => line.trim() !== '');
    
    // ヘッダーマップを作成
    const gameHeaders = createHeaderMap(gameLines[0]);

    // 棋士の成績データを初期化する補助関数
    function initPlayer(name) {
        if (!playerStats[name]) {
            playerStats[name] = { wins: 0, losses: 0, total: 0, history: [] };
        }
    }

    for (let i = 1; i < gameLines.length; i++) {
        const row = gameLines[i].split(',');
        if (row.length < 5) continue; // 空行や不完全な行をスキップ

        // 💡 ここがポイント！数字のインデックスではなく、日本語の列名でデータを取得する
        const date = row[gameHeaders['対局日']];
        const match = row[gameHeaders['棋戦']];
        const notes = row[gameHeaders['備考']];
        const res1 = row[gameHeaders['先手の勝敗']];
        const p1 = row[gameHeaders['先手']] ? row[gameHeaders['先手']].replace(/[\s　]/g, '').replace(/"/g, '') : "";
        const p2 = row[gameHeaders['後手']] ? row[gameHeaders['後手']].replace(/[\s　]/g, '').replace(/"/g, '') : "";
        const res2 = row[gameHeaders['後手の勝敗']];
        const thousand = row[gameHeaders['千日手']];
        const broadcast = row[gameHeaders['放送日']];

        const gameRecord = { date, match, notes, res1, p1, p2, res2, thousand, broadcast };
        gameData.push(gameRecord);

        // --- 成績の集計 ---
        if (p1) initPlayer(p1);
        if (p2) initPlayer(p2);

        // 先手の集計（「○」か「●」の場合のみ集計し、持将棋などのバグを防ぐ）
        if (p1 && (res1 === '○' || res1 === '●')) {
            playerStats[p1].total++;
            if (res1 === '○') playerStats[p1].wins++;
            if (res1 === '●') playerStats[p1].losses++;
            playerStats[p1].history.push({...gameRecord, mySente: true});
        }
        
        // 後手の集計
        if (p2 && (res2 === '○' || res2 === '●')) {
            playerStats[p2].total++;
            if (res2 === '○') playerStats[p2].wins++;
            if (res2 === '●') playerStats[p2].losses++;
            playerStats[p2].history.push({...gameRecord, mySente: false});
        }
    }

    // ==========================================
    // 3. 画面表示用配列 (summaryArray) の生成
    // ==========================================
    summaryArray = Object.keys(playerStats).map(name => {
        const s = playerStats[name];
        const winRate = s.total > 0 ? s.wins / s.total : 0;
        const score = s.wins - s.losses; // 勝越し数
        return {
            name: name,
            id: kishiMap[name] || 99999, // kishi.csvに名前がない場合は一番下に配置
            total: s.total,
            wins: s.wins,
            losses: s.losses,
            winRate: winRate,
            score: score
        };
    });
}

// ==========================================
// これ以降は既存の UI（表の描画・ソート等）のコード
// ==========================================
function setupUI() {
    renderSummary();
    
    // 見出しクリックでのソート設定
    document.querySelectorAll('#summaryTable th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.col;
            if (sortState.colId === col) {
                sortState.asc = !sortState.asc;
            } else {
                sortState.colId = col;
                sortState.asc = false; // 初期クリックは降順（勝数などが多い順）
                if (col === 'id' || col === 'name') sortState.asc = true;
            }
            updateSortIcons();
            renderSummary();
        });
    });

    // タブ切り替えの設定
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
    // データの並び替え（ソート）
    summaryArray.sort((a, b) => {
        const valA = a[sortState.colId];
        const valB = b[sortState.colId];
        if (valA === valB) {
            // 値が同じ場合は勝数または名前でサブソート
            return b.wins - a.wins || a.name.localeCompare(b.name, 'ja');
        }
        if (typeof valA === 'string') {
            return sortState.asc ? valA.localeCompare(valB, 'ja') : valB.localeCompare(valA, 'ja');
        }
        return sortState.asc ? valA - valB : valB - valA;
    });

    const tbody = document.querySelector('#summaryTable tbody');
    if (!tbody) return; // tbodyが存在しない場合はスキップ
    
    tbody.innerHTML = '';

    summaryArray.forEach((item, index) => {
        const tr = document.createElement('tr');
        
        // 勝率の計算（割り切れない場合は小数第4位を四捨五入）
        const winRateStr = item.total > 0 ? (item.winRate).toFixed(3).replace(/^0\./, '.') : '.000';

        tr.innerHTML = `
            <td class="pc-col">${index + 1}</td>
            <td style="text-align: left; font-weight: bold;">${item.name}</td>
            <td>${item.total}</td>
            <td>${item.wins}</td>
            <td>${item.losses}</td>
            <td>${winRateStr}</td>
        `;
        tbody.appendChild(tr);
    });
}