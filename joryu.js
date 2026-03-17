let kishiData = [];
let currentSort = { colId: null, key: null, asc: true };
let currentFilter = 'all';

window.addEventListener('DOMContentLoaded', () => {
    // 参照元を joryu.csv に変更
    fetch('joryu.csv')
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

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.dataset.filter;
            renderTable();
        });
    });
});

// 日数を含めた正確な期間計算
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

    let text = isAge ? `${y}歳${m}ヶ月${d}日` : `${y}年${m}ヶ月${d}日`;
    let sortValue = y * 12 + m + (d / 31);

    return { text, sortValue };
}

function calculateCurrentAge(birthStr, retireStr, passStr) {
    if (!birthStr || birthStr.trim() === '') return { text: "-", sortValue: 0 };
    if (passStr && passStr.trim() !== '') {
        let result = getPreciseDuration(birthStr, passStr, true);
        return { text: `${result.text} (没)`, sortValue: result.sortValue };
    }
    let today = new Date();
    let todayStr = today.toISOString().split('T')[0];
    return getPreciseDuration(birthStr, todayStr, true);
}

function calculateActivePeriod(startStr, retireStr, passStr) {
    if (!startStr || startStr.trim() === '') return { text: "-", sortValue: 0 };
    
    let endStr = new Date().toISOString().split('T')[0];
    if (retireStr && retireStr.trim() !== '') endStr = retireStr;
    if (passStr && passStr.trim() !== '') endStr = passStr;

    return getPreciseDuration(startStr, endStr, false);
}

// ヘッダーマップから安全にデータを取得する補助関数
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
    
    for (let i = 1; i < lines.length; i++) {
        let row = lines[i].split(',');

        let numStr = getColValue(row, headerMap, '女流棋士番号');
        if (!numStr) continue;
        
        let number = parseInt(numStr, 10);
        let name = getColValue(row, headerMap, '女流棋士名');
        let birthday = getColValue(row, headerMap, '生年月日');
        let kyu3 = getColValue(row, headerMap, '女流３級');
        let kyu2 = getColValue(row, headerMap, '女流２級');
        let kyu1 = getColValue(row, headerMap, '女流１級');
        let dan1 = getColValue(row, headerMap, '女流初段');
        let dan2 = getColValue(row, headerMap, '女流二段');
        let dan3 = getColValue(row, headerMap, '女流三段');
        let dan4 = getColValue(row, headerMap, '女流四段');
        let dan5 = getColValue(row, headerMap, '女流五段');
        let dan6 = getColValue(row, headerMap, '女流六段');
        let dan7 = getColValue(row, headerMap, '女流七段');
        let retire = getColValue(row, headerMap, '引退日');
        let passing = getColValue(row, headerMap, '逝去日'); // 名称変更対応
        let url = getColValue(row, headerMap, 'データベース'); // 名称変更対応

        // ステータス判定
        let status = 'active';
        if (url === '') {
            status = 'withdrawn';
        } else if (passing !== '') {
            status = 'deceased';
        } else if (retire !== '') {
            status = 'retired';
        }

        // プロ入り日判定の範囲を女流七段まで拡張
        let proStartDate = kyu3 || kyu2 || kyu1 || dan1 || dan2 || dan3 || dan4 || dan5 || dan6 || dan7;

        let currentAgeData = calculateCurrentAge(birthday, retire, passing);
        let activePeriodData = calculateActivePeriod(proStartDate, retire, passing);

        let highestRank = "";
        let rankValue = 0;
        if (dan7) { highestRank = "女流七段"; rankValue = 7; }
        else if (dan6) { highestRank = "女流六段"; rankValue = 6; }
        else if (dan5) { highestRank = "女流五段"; rankValue = 5; }
        else if (dan4) { highestRank = "女流四段"; rankValue = 4; }
        else if (dan3) { highestRank = "女流三段"; rankValue = 3; }
        else if (dan2) { highestRank = "女流二段"; rankValue = 2; }
        else if (dan1) { highestRank = "女流初段"; rankValue = 1; }
        else if (kyu1) { highestRank = "女流1級"; rankValue = 0.5; }
        else if (kyu2) { highestRank = "女流2級"; rankValue = 0.2; }
        else if (kyu3) { highestRank = "女流3級"; rankValue = 0.1; }

        if (passing) { rankValue -= 100; }
        else if (retire) { rankValue -= 50; }

        let kishi = {
            number: number,
            name: name,
            url: url,
            status: status,
            birthday: birthday,
            kyu3: kyu3, kyu2: kyu2, kyu1: kyu1,
            dan1: dan1, dan2: dan2, dan3: dan3, dan4: dan4, dan5: dan5, dan6: dan6, dan7: dan7,
            retire: retire, passing: passing,
            highestRank: highestRank, rankValue: rankValue,
            ageText: currentAgeData.text, ageValue: currentAgeData.sortValue,
            activePeriod: activePeriodData.text, activePeriodValue: activePeriodData.sortValue,
            
            ageKyu3: getPreciseDuration(birthday, kyu3, true).text,
            ageKyu3Value: getPreciseDuration(birthday, kyu3, true).sortValue,
            ageKyu2: getPreciseDuration(birthday, kyu2, true).text,
            ageKyu2Value: getPreciseDuration(birthday, kyu2, true).sortValue,
            ageKyu1: getPreciseDuration(birthday, kyu1, true).text,
            ageKyu1Value: getPreciseDuration(birthday, kyu1, true).sortValue,
            ageDan1: getPreciseDuration(birthday, dan1, true).text,
            ageDan1Value: getPreciseDuration(birthday, dan1, true).sortValue,
            ageDan2: getPreciseDuration(birthday, dan2, true).text,
            ageDan2Value: getPreciseDuration(birthday, dan2, true).sortValue,
            ageDan3: getPreciseDuration(birthday, dan3, true).text,
            ageDan3Value: getPreciseDuration(birthday, dan3, true).sortValue,
            ageDan4: getPreciseDuration(birthday, dan4, true).text,
            ageDan4Value: getPreciseDuration(birthday, dan4, true).sortValue,
            ageDan5: getPreciseDuration(birthday, dan5, true).text,
            ageDan5Value: getPreciseDuration(birthday, dan5, true).sortValue,
            ageDan6: getPreciseDuration(birthday, dan6, true).text,
            ageDan6Value: getPreciseDuration(birthday, dan6, true).sortValue,
            ageDan7: getPreciseDuration(birthday, dan7, true).text,
            ageDan7Value: getPreciseDuration(birthday, dan7, true).sortValue
        };
        kishiData.push(kishi);
    }

    renderTable();
}

function formatDateString(str) {
    if (str === null || str === undefined || str === '') return '-';
    let s = String(str); 
    if (s === '-') return '-';
    if (s.includes('歳') || s.includes('年')) return s; 
    let parts = s.split('-');
    if (parts.length === 3) {
        return `${parts[0]}年${parseInt(parts[1], 10)}月${parseInt(parts[2], 10)}日`;
    }
    return s;
}

function getSortValue(item, key) {
    if (key === 'ageText') return item.ageValue;
    if (key === 'activePeriod') return item.activePeriodValue;
    if (key === 'highestRank') return item.rankValue;
    if (key.startsWith('age') && key !== 'ageText') return item[key + 'Value'];
    
    let val = item[key];
    if (!val || val === '-') return 0;
    if (key === 'number') return item.number;
    
    let date = new Date(val);
    if (!isNaN(date.getTime())) return date.getTime();

    return String(val);
}

function renderTable() {
    const tbody = document.querySelector('#kishiTable tbody');
    const searchStr = document.getElementById('searchInput').value.toLowerCase();
    
    let filteredData = kishiData.filter(k => {
        let matchFilter = (currentFilter === 'all' || k.status === currentFilter);
        
        let matchSearch = true;
        if (searchStr) {
            matchSearch = Object.values(k).some(val => 
                String(val).toLowerCase().includes(searchStr)
            );
        }
        
        return matchFilter && matchSearch;
    });

    if (currentSort.colId && currentSort.key) {
        filteredData.sort((a, b) => {
            let valA = getSortValue(a, currentSort.key);
            let valB = getSortValue(b, currentSort.key);
            
            if (valA === 0 && valB !== 0) return 1;
            if (valB === 0 && valA !== 0) return -1;
            if (valA === 0 && valB === 0) return 0;

            if (valA < valB) return currentSort.asc ? -1 : 1;
            if (valA > valB) return currentSort.asc ? 1 : -1;
            return 0;
        });
    }

    tbody.innerHTML = '';

    if (filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-message">該当する女流棋士が見つかりません</td></tr>`;
        return;
    }

    let k4 = document.getElementById('col4Select').value;
    let k5 = document.getElementById('col5Select').value;
    let k6 = document.getElementById('col6Select').value;
    let k7 = document.getElementById('col7Select').value;
    let k8 = document.getElementById('col8Select').value;

    filteredData.forEach((k, index) => {
        let tr = document.createElement('tr');
        
        let nameDisplay = k.url ? `<a href="${k.url}" target="_blank" style="color: #cba135; font-weight: bold; text-decoration: none;">${k.name}</a>` : `<span style="font-weight: bold;">${k.name}</span>`;

        tr.innerHTML = `
            <td>${index + 1}</td>
            <td style="text-align: left;">${nameDisplay}</td>
            <td style="font-weight:bold; color:#1a3622;">${k.highestRank}</td>
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
    select.addEventListener('click', function(e) {
        e.stopPropagation();
    });
});

document.getElementById('searchInput').addEventListener('input', renderTable);