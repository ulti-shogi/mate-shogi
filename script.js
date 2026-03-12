let kishiData = [];
let currentSort = { colId: null, key: null, asc: true };

// ⬇⬇ ページが開かれた瞬間に、自動で kishi.csv を読み込む処理 ⬇⬇
window.addEventListener('DOMContentLoaded', () => {
    // サーバー上にある kishi.csv を裏側で取得（フェッチ）する
    fetch('kishi.csv')
        .then(response => {
            if (!response.ok) throw new Error('CSVの読み込みに失敗しました');
            return response.text();
        })
        .then(csvText => {
            processData(csvText); // データ処理へパス
        })
        .catch(error => {
            console.error('エラー:', error);
            const tbody = document.querySelector('#kishiTable tbody');
            tbody.innerHTML = `<tr><td colspan="8" class="empty-message">データの読み込みに失敗しました。</td></tr>`;
        });
});
// ⬆⬆ ここまで ⬆⬆

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

function processData(csvText) {
    const lines = csvText.replace(/\r/g, '').split('\n').filter(line => line.trim() !== '');
    kishiData = []; 
    const todayStr = new Date().toISOString().split('T')[0];

    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',');
        if (row.length < 11) continue;

        let kishi = {
            number: row[0], name: row[1], birthday: row[2],
            four: row[3], five: row[4], six: row[5], seven: row[6],
            eight: row[7], nine: row[8], retire: row[9], passing: row[10]
        };

        const hasDanData = kishi.four || kishi.five || kishi.six || kishi.seven || kishi.eight || kishi.nine;
        if (!hasDanData) continue;

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

    // 検索ボックスの文字を取得
    const searchInputVal = document.getElementById('searchInput').value.toLowerCase().trim();
    
    // ⬇⬇ ここが修正点！スペース（全角・半角）でキーワードを分割する ⬇⬇
    const searchTerms = searchInputVal === '' ? [] : searchInputVal.split(/[\s　]+/);

    let displayData = kishiData;
    if (searchTerms.length > 0) {
        displayData = kishiData.filter(k => {
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
            
            // 分割したすべてのキーワードが searchableText に含まれているか（AND検索）
            return searchTerms.every(term => searchableText.includes(term));
        });
    }

    const tbody = document.querySelector('#kishiTable tbody');
    tbody.innerHTML = '';

    const k4 = document.getElementById('col4Select').value;
    const k5 = document.getElementById('col5Select').value;
    const k6 = document.getElementById('col6Select').value;
    const k7 = document.getElementById('col7Select').value;
    const k8 = document.getElementById('col8Select').value;

    displayData.forEach((k, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td style="font-weight:bold;">${k.name}</td>
            <td style="color:#cba135; font-weight:bold;">${k.highestRank}</td>
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