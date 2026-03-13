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
    // ⬇⬇ 魔法の処理：prize.csv と kishi.csv を「同時に」読み込む ⬇⬇
    Promise.all([
        fetch('prize.csv').then(res => { if(!res.ok) throw new Error('prize.csv失敗'); return res.text(); }),
        fetch('kishi.csv').then(res => { if(!res.ok) throw new Error('kishi.csv失敗'); return res.text(); })
    ])
    .then(([prizeText, kishiText]) => {
        processCSV(prizeText, kishiText);
        setupUI();
    })
    .catch(error => console.error('エラー:', error));
});

function processCSV(prizeText, kishiText) {
    // 1. kishi.csvから「名前」と「生まれ年」の辞書を作る
    const kishiLines = kishiText.replace(/\r/g, '').split('\n').filter(line => line.trim() !== '');
    const birthYearMap = {};
    for (let i = 1; i < kishiLines.length; i++) {
        const row = kishiLines[i].split(',');
        if (row.length >= 3 && row[2]) {
            const name = row[1];
            const birthYear = parseInt(row[2].split(/[-\/]/)[0]); // 生年月日から「年」だけを抽出
            birthYearMap[name] = birthYear;
        }
    }

    // 2. prize.csvを読み込み、生まれ年辞書と合体させる
    const prizeLines = prizeText.replace(/\r/g, '').split('\n').filter(line => line.trim() !== '');
    prizeData = [];
    
    for (let i = 1; i < prizeLines.length; i++) {
        // 余計な「"」や「,」がなくなったので、単純にカンマで分割するだけでOK！
        const row = prizeLines[i].split(',');
        if (row.length < 4) continue;
        
        const year = parseInt(row[0]);
        const rank = parseInt(row[1]);
        const name = row[2];
        const amount = parseInt(row[3]);
        const title = row[4] ? row[4] : "-";
        
        // ⬇⬇ 年齢の自動計算（西暦 - 生まれ年） ⬇⬇
        let age = "-";
        if (birthYearMap[name]) {
            age = year - birthYearMap[name];
        }

        prizeData.push({
            year: year,
            rank: rank,
            name: name,
            amount: amount,
            amountText: formatOkuMan(amount), // プログラム側で「〇億〇万円」にする
            title: title,
            age: age
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
    
    const years = [...new Set(prizeData.map(d => d.year))].sort((a,b) => b - a);
    years.forEach(y => ySel.appendChild(new Option(y + "年", y)));
    
    const pTotals = {};
    prizeData.forEach(d => pTotals[d.name] = (pTotals[d.name] || 0) + d.amount);
    const players = Object.keys(pTotals).sort((a,b) => pTotals[b] - pTotals[a]);
    players.forEach(p => pSel.appendChild(new Option(p, p)));

    ySel.addEventListener('change', renderYearTable);
    pSel.addEventListener('change', renderPlayerTable);

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
        if (cmp === 0 && a.year && b.year) cmp = b.year - a.year;
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
    
    let sum = viewData.reduce((acc, curr) => acc + curr.amount, 0);
    
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