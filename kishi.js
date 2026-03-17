let kishiData = [];
let currentSort = { colId: null, key: null, asc: true };
let currentFilter = 'all'; // 現在のフィルターステータス

window.addEventListener('DOMContentLoaded', () => {
    // kishi.csv を読み込む
    fetch('kishi.csv')
        .then(response => {
            if (!response.ok) throw new Error('CSVの読み込みに失敗しました');
            return response.text();
        })
        .then(csvText => {
            processData(csvText);
        })
        .catch(error => {
            console.error('エラー:', error);
            const tbody = document.querySelector('#kishiTable tbody');
            tbody.innerHTML = `<tr><td colspan="8" class="empty-message">データの読み込みに失敗しました。</td></tr>`;
        });

    // ⬇⬇ タブのイベントリスナー ⬇⬇
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.dataset.filter;
            renderTable();
        });
    });
});

// 年月日の詳細な期間計算（既存の優れたロジックをそのまま使用）
function getPreciseDuration(startStr, endStr, isAge = true) {
    if (!startStr || startStr.trim() === '' || !endStr || endStr.trim() === '') {
        return { text: "-", sortValue: 0 };
    }
    
    let start = new Date(startStr);
    let end = new Date(endStr);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
        return { text: "-", sortValue: 0 };
    }

    let y = end.getFullYear() - start.getFullYear();
    let m = end.getMonth() - start.getMonth();
    let d = end.getDate() - start.getDate();

    if (d < 0) {
        m--;
        let prevMonth = new Date(end.getFullYear(), end.getMonth(), 0); 
        d += prevMonth.getDate();
    }
    if (m < 0) {
        y--;
        m += 12;
    }

    let unitYear = isAge ? "歳" : "年";
    let text = `${y}${unitYear}${m}ヶ月${d}日`;
    let sortValue = end.getTime() - start.getTime();

    return { text: text, sortValue: sortValue };
}

function formatDateString(str) {
    if (!str || typeof str !== 'string') return '-';
    let match = str.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
    if (match) {
        return `${parseInt(match[1], 10)}年${parseInt(match[2], 10)}月${parseInt(match[3], 10)}日`;
    }
    return str;
}

// ⬇⬇ 列名基準でデータを安全に取得する補助関数 ⬇⬇
function getColValue(row, headerMap, colName) {
    const idx = headerMap[colName];
    return (idx !== undefined && row[idx]) ? row[idx].trim() : "";
}

function processData(csvText) {
    const lines = csvText.replace(/\r/g, '').split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) return;

    // 1行目からヘッダーの列名とインデックス番号をマッピング（列名基準）
    const headers = lines[0].split(',').map(h => h.trim());
    const headerMap = {};
    headers.forEach((h, i) => { headerMap[h] = i; });

    kishiData = []; 
    const todayStr = new Date().toISOString().split('T')[0];

    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',');

        let numStr = getColValue(row, headerMap, '棋士番号');
        if (!numStr) continue;

        let kishi = {
            number: numStr, 
            name: getColValue(row, headerMap, '棋士名'), 
            birthday: getColValue(row, headerMap, '生年月日'),
            four: getColValue(row, headerMap, '四段昇段日'), 
            five: getColValue(row, headerMap, '五段昇段日'), 
            six: getColValue(row, headerMap, '六段昇段日'), 
            seven: getColValue(row, headerMap, '七段昇段日'),
            eight: getColValue(row, headerMap, '八段昇段日'), 
            nine: getColValue(row, headerMap, '九段昇段日'), 
            retire: getColValue(row, headerMap, '引退日'), 
            passing: getColValue(row, headerMap, '逝去日'),
            url: getColValue(row, headerMap, 'データベース')
        };

        // 現状維持：四段～九段のデータが1つもない棋士（昔の棋士など）はスキップ
        const hasDanData = kishi.four || kishi.five || kishi.six || kishi.seven || kishi.eight || kishi.nine;
        if (!hasDanData) continue;

        // ⬇⬇ ステータス判定処理の追加 ⬇⬇
        let status = 'active';
        if (kishi.url === '') {
            status = 'withdrawn'; // データベースURLが空欄なら退会
        } else if (kishi.passing !== '') {
            status = 'deceased';
        } else if (kishi.retire !== '') {
            status = 'retired';
        }
        kishi.status = status;

        let ageData = getPreciseDuration(kishi.birthday, kishi.passing || todayStr, true);
        kishi.ageText = ageData.text !== "-" ? ageData.text + (kishi.passing ? " (没)" : "") : "-";
        kishi.ageText_sort = ageData.sortValue; 

        let a4 = getPreciseDuration(kishi.birthday, kishi.four, true);
        kishi.ageFour = a4.text; kishi.ageFour_sort = a4.sortValue;
        
        let a5 = getPreciseDuration(kishi.birthday, kishi.five, true);
        kishi.ageFive = a5.text; kishi.ageFive_sort = a5.sortValue;
        
        let a6 = getPreciseDuration(kishi.birthday, kishi.six, true);
        kishi.ageSix = a6.text; kishi.ageSix_sort = a6.sortValue;
        
        let a7 = getPreciseDuration(kishi.birthday, kishi.seven, true);
        kishi.ageSeven = a7.text; kishi.ageSeven_sort = a7.sortValue;
        
        let a8 = getPreciseDuration(kishi.birthday, kishi.eight, true);
        kishi.ageEight = a8.text; kishi.ageEight_sort = a8.sortValue;
        
        let a9 = getPreciseDuration(kishi.birthday, kishi.nine, true);
        kishi.ageNine = a9.text; kishi.ageNine_sort = a9.sortValue;

        // 棋士は四段がプロ入りのため kishi.four を基準に現役期間を計算
        let endOfActive = kishi.retire ? kishi.retire : (kishi.passing ? kishi.passing : todayStr);
        let ap = getPreciseDuration(kishi.four, endOfActive, false);
        kishi.activePeriod = ap.text; kishi.activePeriod_sort = ap.sortValue;

        let rank = "-";
        if (kishi.nine) rank = "九段";
        else if (kishi.eight) rank = "八段";
        else if (kishi.seven) rank = "七段";
        else if (kishi.six) rank = "六段";
        else if (kishi.five) rank = "五段";
        else if (kishi.four) rank = "四段";
        kishi.highestRank = rank;

        kishiData.push(kishi);
    }
    
    renderTable();
}

const rankValues = { "九段": 9, "八段": 8, "七段": 7, "六段": 6, "五段": 5, "四段": 4, "-": 0 };

function applySort() {
    if (!currentSort.key) return; 

    kishiData.sort((a, b) => {
        let valA = a[currentSort.key];
        let valB = b[currentSort.key];

        let isMissingA = (!valA || valA === '-');
        let isMissingB = (!valB || valB === '-');
        if (isMissingA && isMissingB) return 0;
        if (isMissingA) return 1;
        if (isMissingB) return -1;

        let cmp = 0;
        if (currentSort.key === 'highestRank') {
            cmp = rankValues[valA] - rankValues[valB];
        } else if (currentSort.key === 'number') {
            cmp = parseInt(valA) - parseInt(valB);
        } else if (a[currentSort.key + '_sort'] !== undefined) {
            cmp = a[currentSort.key + '_sort'] - b[currentSort.key + '_sort'];
        } else {
            cmp = new Date(valA).getTime() - new Date(valB).getTime();
        }

        if (cmp === 0) {
            return parseInt(a.number) - parseInt(b.number);
        }

        return currentSort.asc ? cmp : -cmp;
    });
}

function renderTable() {
    applySort();

    const searchInputVal = document.getElementById('searchInput').value.toLowerCase().trim();
    const searchTerms = searchInputVal === '' ? [] : searchInputVal.split(/[\s　]+/);

    // ⬇⬇ フィルター処理：タブ判定とAND検索の統合 ⬇⬇
    let displayData = kishiData.filter(k => {
        // 1. タブによるステータス判定
        let matchFilter = (currentFilter === 'all' || k.status === currentFilter);
        if (!matchFilter) return false;

        // 2. キーワード検索判定
        if (searchTerms.length === 0) return true;

        let searchableText = `
            ${k.number} ${k.name} ${k.highestRank}
            ${formatDateString(k.birthday)} ${k.ageText}
            ${formatDateString(k.four)} ${k.ageFour}
            ${formatDateString(k.five)} ${k.ageFive}
            ${formatDateString(k.six)} ${k.ageSix}
            ${formatDateString(k.seven)} ${k.ageSeven}
            ${formatDateString(k.eight)} ${k.ageEight}
            ${formatDateString(k.nine)} ${k.ageNine}
            ${k.activePeriod}
            ${formatDateString(k.retire)} ${formatDateString(k.passing)}
        `.toLowerCase();
        
        return searchTerms.every(term => searchableText.includes(term));
    });

    const tbody = document.querySelector('#kishiTable tbody');
    tbody.innerHTML = '';

    if (displayData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-message">該当する棋士が見つかりません</td></tr>`;
        return;
    }

    const k4 = document.getElementById('col4Select').value;
    const k5 = document.getElementById('col5Select').value;
    const k6 = document.getElementById('col6Select').value;
    const k7 = document.getElementById('col7Select').value;
    const k8 = document.getElementById('col8Select').value;

    displayData.forEach((k, index) => {
        const tr = document.createElement('tr');
        
        // 女流側と同様に、URLがある場合はリンク化（退会などでURLが無い場合は文字のみ）
        let nameDisplay = k.url ? `<a href="${k.url}" target="_blank" style="color: #cba135; font-weight: bold; text-decoration: none;">${k.name}</a>` : `<span style="font-weight: bold;">${k.name}</span>`;

        tr.innerHTML = `
            <td>${index + 1}</td>
            <td style="text-align: left;">${nameDisplay}</td>
            <td style="color:#1a3622; font-weight:bold;">${k.highestRank}</td>
            <td>${formatDateString(k[k4]) || '-'}</td>
            <td class="tablet-col">${formatDateString(k[k5]) || '-'}</td>
            <td class="tablet-col">${formatDateString(k[k6]) || '-'}</td>
            <td class="pc-col">${formatDateString(k[k7]) || '-'}</td>
            <td class="pc-col">${formatDateString(k[k8]) || '-'}</td>
        `;
        tbody.appendChild(tr);
    });

    document.querySelectorAll('th.sortable').forEach(th => {
        th.classList.remove('asc', 'desc');
        if (th.dataset.col === currentSort.colId) {
            th.classList.add(currentSort.asc ? 'asc' : 'desc');
        }
    });
}

document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', function(e) {
        if (e.target.tagName.toLowerCase() === 'select') return;

        let colId = this.dataset.col;
        let key;

        if (colId === 'col3') key = 'highestRank';
        else {
            key = this.querySelector('select').value;
        }

        if (currentSort.colId === colId) {
            currentSort.asc = !currentSort.asc;
        } else {
            currentSort.colId = colId;
            currentSort.asc = (key === 'highestRank') ? false : true;
        }
        currentSort.key = key;

        renderTable();
    });
});

document.querySelectorAll('.dynamic-select').forEach(select => {
    select.addEventListener('change', function() {
        let th = this.closest('th');
        let colId = th.dataset.col;
        
        if (currentSort.colId === colId) {
            currentSort.key = this.value;
        }
        
        renderTable();
    });
    select.addEventListener('click', e => e.stopPropagation());
});

document.getElementById('searchInput').addEventListener('input', function() {
    renderTable();
});