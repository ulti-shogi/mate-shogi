let prizeData = [];
let totalData = [];
let hundredData = [];

// 各タブのソート状態を記憶
const sortState = {
    'panel-year': { colId: 'rank', asc: true },
    'panel-player': { colId: 'year', asc: false },
    'panel-total': { colId: 'year', asc: false },
    'panel-100m': { colId: 'recordRank', asc: true }
};

window.addEventListener('DOMContentLoaded', () => {
    fetch('prize.csv')
        .then(response => {
            if (!response.ok) throw new Error('CSV読み込み失敗');
            return response.text();
        })
        .then(csvText => {
            processCSV(csvText);
            setupUI();
        })
        .catch(error => console.error('エラー:', error));
});

function processCSV(csvText) {
    const lines = csvText.replace(/\r/g, '').split('\n').filter(line => line.trim() !== '');
    prizeData = [];
    
    // CSVを安全に分解（「"」の中のカンマで区切られないようにする魔法の処理）
    for (let i = 1; i < lines.length; i++) {
        let text = lines[i];
        let row = [];
        let cur = "";
        let inQuote = false;
        for (let j = 0; j < text.length; j++) {
            let char = text[j];
            if (char === '"') {
                if (inQuote && text[j+1] === '"') { cur += '"'; j++; } 
                else { inQuote = !inQuote; }
            } else if (char === ',' && !inQuote) {
                row.push(cur); cur = "";
            } else {
                cur += char;
            }
        }
        row.push(cur);
        
        if (row.length < 8) continue;
        
        prizeData.push({
            year: parseInt(row[0]),
            rank: parseInt(row[1]),
            name: row[2].replace(/"/g, ''),
            amount: parseInt(row[3].replace(/,/g, '')), // カンマを消して純粋な数値にする
            amountText: row[4].replace(/"/g, ''),
            title: row[5] ? row[5].replace(/"/g, '') : "-",
            age: parseInt(row[8]) || 0
        });
    }

    // 機能3: 各年の上位10名の総計データを作成
    const yearTotals = {};
    const yearTop = {};
    prizeData.forEach(d => {
        if (d.rank <= 10) yearTotals[d.year] = (yearTotals[d.year] || 0) + d.amount;
        if (d.rank === 1) yearTop[d.year] = d.name;
    });
    
    totalData = Object.keys(yearTotals).map(y => ({
        year: parseInt(y),
        total: yearTotals[y],
        totalText: formatOkuMan(yearTotals[y]),
        topPlayer: yearTop[y] || "-"
    }));

    // 機能4: 歴代1億円以上データを作成
    hundredData = prizeData.filter(d => d.amount >= 10000).sort((a,b) => b.amount - a.amount);
    hundredData.forEach((d, index) => { d.recordRank = index + 1; });
}

// 金額を「〇億〇〇万円」の形式に直す計算機能
function formatOkuMan(manAmount) {
    if (manAmount < 10000) return manAmount.toLocaleString() + "万円";
    let oku = Math.floor(manAmount / 10000);
    let man = manAmount % 10000;
    if (man === 0) return oku + "億円";
    return oku + "億" + man.toLocaleString() + "万円";
}

function setupUI() {
    const ySel = document.getElementById('yearSelect');
    const pSel = document.getElementById('playerSelect');
    
    // 対象年のプルダウン作成
    const years = [...new Set(prizeData.map(d => d.year))].sort((a,b) => b - a);
    years.forEach(y => ySel.appendChild(new Option(y + "年", y)));
    
    // 棋士名のプルダウン作成（ランクイン総額が多い順に並べる）
    const pTotals = {};
    prizeData.forEach(d => pTotals[d.name] = (pTotals[d.name] || 0) + d.amount);
    const players = Object.keys(pTotals).sort((a,b) => pTotals[b] - pTotals[a]);
    players.forEach(p => pSel.appendChild(new Option(p, p)));

    ySel.addEventListener('change', renderYearTable);
    pSel.addEventListener('change', renderPlayerTable);

    // タブの切り替え処理
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
            this.classList.add('active');
            document.getElementById(this.dataset.target).classList.add('active');
        });
    });

    // 並び替え（ソート）ヘッダーのクリック処理
    document.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', function() {
            let colId = this.dataset.col;
            let panelId = this.closest('.panel').id;
            
            if (sortState[panelId].colId === colId) {
                sortState[panelId].asc = !sortState[panelId].asc;
            } else {
                sortState[panelId].colId = colId;
                sortState[panelId].asc = (colId === 'rank' || colId === 'recordRank') ? true : false;
            }
            
            if (panelId === 'panel-year') renderYearTable();
            if (panelId === 'panel-player') renderPlayerTable();
            if (panelId === 'panel-total') renderTotalTable();
            if (panelId === 'panel-100m') renderHundredTable();
        });
    });

    renderYearTable();
    renderPlayerTable();
    renderTotalTable();
    renderHundredTable();
}

function applySort(dataArray, panelId) {
    const { colId, asc } = sortState[panelId];
    dataArray.sort((a, b) => {
        let valA = a[colId];
        let valB = b[colId];
        let cmp = (typeof valA === 'string' && typeof valB === 'string') ? valA.localeCompare(valB) : valA - valB;
        if (cmp === 0 && a.year && b.year) cmp = b.year - a.year; // 同点なら新しい年を上に
        return asc ? cmp : -cmp;
    });
}

function updateSortIcons(panelId) {
    const panel = document.getElementById(panelId);
    panel.querySelectorAll('th.sortable').forEach(th => {
        th.classList.remove('asc', 'desc');
        if (th.dataset.col === sortState[panelId].colId) {
            th.classList.add(sortState[panelId].asc ? 'asc' : 'desc');
        }
    });
}

// --- 各テーブルの描画 ---

function renderYearTable() {
    const ySel = document.getElementById('yearSelect');
    if(!ySel.value) return;
    let viewData = prizeData.filter(d => d.year === parseInt(ySel.value));
    applySort(viewData, 'panel-year');
    
    document.querySelector('#yearTable tbody').innerHTML = viewData.map(d => `
        <tr>
            <td>${d.rank}</td>
            <td style="font-weight:bold;">${d.name}</td>
            <td style="color:#cba135;">${d.title}</td>
            <td>${d.amountText}</td>
            <td>${d.age}歳</td>
        </tr>
    `).join('');
    updateSortIcons('panel-year');
}

function renderPlayerTable() {
    const pSel = document.getElementById('playerSelect');
    if(!pSel.value) return;
    let viewData = prizeData.filter(d => d.name === pSel.value);
    applySort(viewData, 'panel-player');
    
    let sum = viewData.reduce((acc, curr) => acc + curr.amount, 0); // 生涯ランクイン総額
    
    let html = viewData.map(d => `
        <tr>
            <td>${d.year}年</td>
            <td>${d.rank}</td>
            <td style="color:#cba135;">${d.title}</td>
            <td>${d.amountText}</td>
            <td>${d.age}歳</td>
        </tr>
    `).join('');
    
    html += `
        <tr style="background-color: #f0ebd8; font-weight: bold;">
            <td colspan="3" style="text-align: right;">ランクイン総計：</td>
            <td colspan="2" style="color:#1a3622;">${formatOkuMan(sum)}</td>
        </tr>
    `;
    document.querySelector('#playerTable tbody').innerHTML = html;
    updateSortIcons('panel-player');
}

function renderTotalTable() {
    let viewData = [...totalData];
    applySort(viewData, 'panel-total');
    
    document.querySelector('#totalTable tbody').innerHTML = viewData.map(d => `
        <tr>
            <td>${d.year}年</td>
            <td style="font-weight:bold; color:#1a3622;">${d.totalText}</td>
            <td>${d.topPlayer}</td>
        </tr>
    `).join('');
    updateSortIcons('panel-total');
}

function renderHundredTable() {
    let viewData = [...hundredData];
    applySort(viewData, 'panel-100m');
    
    document.querySelector('#hundredTable tbody').innerHTML = viewData.map(d => `
        <tr>
            <td>${d.recordRank}</td>
            <td>${d.year}年</td>
            <td style="font-weight:bold;">${d.name}</td>
            <td style="color:#cba135;">${d.title}</td>
            <td>${d.amountText}</td>
            <td>${d.age}歳</td>
        </tr>
    `).join('');
    updateSortIcons('panel-100m');
}