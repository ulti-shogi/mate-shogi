let kishiData = [];
let currentSort = { colId: null, key: null, asc: true };
let currentFilter = 'all';

window.addEventListener('DOMContentLoaded', () => {
    fetch('joryu.csv')
        .then(response => {
            if (!response.ok) throw new Error('CSVの読み込みに失敗しました');
            return response.text();
        })
        .then(csvText => processData(csvText))
        .catch(error => {
            console.error('エラー:', error);
            document.querySelector('#kishiTable tbody').innerHTML = `<tr><td colspan="8" class="empty-message">データの読み込みに失敗しました。</td></tr>`;
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

function getPreciseDuration(startStr, endStr, isAge = true) {
    if (!startStr || startStr.trim() === '' || !endStr || endStr.trim() === '') return { text: "-", sortValue: 0 };
    let start = new Date(startStr);
    let end = new Date(endStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return { text: "-", sortValue: 0 };
    let y = end.getFullYear() - start.getFullYear();
    let m = end.getMonth() - start.getMonth();
    let d = end.getDate() - start.getDate();
    if (d < 0) { m--; let prevMonth = new Date(end.getFullYear(), end.getMonth(), 0); d += prevMonth.getDate(); }
    if (m < 0) { y--; m += 12; }
    return { text: isAge ? `${y}歳${m}ヶ月${d}日` : `${y}年${m}ヶ月${d}日`, sortValue: y * 12 + m + (d / 31) };
}

function getColValue(row, headerMap, colName) {
    const idx = headerMap[colName];
    return (idx !== undefined && row[idx]) ? row[idx].trim() : "";
}

function processData(csvText) {
    const lines = csvText.replace(/\r/g, '').split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) return;

    const headers = lines[0].split(',').map(h => h.trim());
    const headerMap = {};
    headers.forEach((h, i) => { headerMap[h] = i; });

    kishiData = [];
    const todayStr = new Date().toISOString().split('T')[0];

    for (let i = 1; i < lines.length; i++) {
        let row = lines[i].split(',');
        let name = getColValue(row, headerMap, '女流棋士名');
        if (!name) continue;

        let affiliation = getColValue(row, headerMap, '所属') || 'JSA'; // 所属が空ならJSA
        let number = parseInt(getColValue(row, headerMap, '女流棋士番号'), 10) || 0;
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
        let passing = getColValue(row, headerMap, '逝去日');
        let url = getColValue(row, headerMap, 'データベース');

        // ⬇⬇ ステータス判定（順番を修正！） ⬇⬇
        let status = 'active';
        if (url === '') status = 'withdrawn';           // 最優先：URL空欄は退会
        else if (passing !== '') status = 'deceased';   // 次点：逝去日があれば物故
        else if (retire !== '') status = 'retired';     // それ以外で引退日があれば引退

        let proStartDate = kyu3 || kyu2 || kyu1 || dan1 || dan2 || dan3 || dan4 || dan5 || dan6 || dan7;
        let currentAgeData = (birthday && passing) ? getPreciseDuration(birthday, passing, true) : (birthday ? getPreciseDuration(birthday, todayStr, true) : {text:"-", sortValue:0});
        let activePeriodData = getPreciseDuration(proStartDate, retire || passing || todayStr, false);

        // 最高段位判定
        const ranks = ["女流七段", "女流六段", "女流五段", "女流四段", "女流三段", "女流二段", "女流初段", "女流１級", "女流２級", "女流３級"];
        const rankFields = [dan7, dan6, dan5, dan4, dan3, dan2, dan1, kyu1, kyu2, kyu3];
        let highestRank = "-";
        let rankWeight = 0;
        for (let j = 0; j < rankFields.length; j++) {
            if (rankFields[j]) { highestRank = ranks[j]; rankWeight = 10 - j; break; }
        }
        if (passing) rankWeight -= 100; else if (retire) rankWeight -= 50;

        // 【番号ソート用の重み付け】 JSA(1000) < LPSA(2000) < フリー(3000)
        let affWeight = affiliation === 'JSA' ? 1000 : (affiliation === 'LPSA' ? 2000 : 3000);

        kishiData.push({
            number: number,
            sortNumber: affWeight + number,
            name: name,
            affiliation: affiliation,
            status: status,
            url: url,
            highestRank: highestRank,
            rankWeight: rankWeight,
            birthday: birthday,
            kyu3: kyu3, kyu2: kyu2, kyu1: kyu1, dan1: dan1, dan2: dan2, dan3: dan3, dan4: dan4, dan5: dan5, dan6: dan6, dan7: dan7,
            retire: retire, passing: passing,
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
        });
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

// セルの表示内容を決定する補助関数（番号の時だけバッジをつける）
function getCellContent(kishi, key) {
    if (key === 'number') {
        let badgeColor = kishi.affiliation === 'LPSA' ? '#e91e63' : (kishi.affiliation === 'フリー' ? '#607d8b' : '#1a3622');
        let badgeHTML = `<span style="font-size: 10px; background: ${badgeColor}; color: white; padding: 2px 4px; border-radius: 4px; margin-left: 5px;">${kishi.affiliation}</span>`;
        let numText = kishi.number === 0 ? '-' : kishi.number;
        return `${numText}${badgeHTML}`;
    }
    return formatDateString(kishi[key]) || '-';
}

function renderTable() {
    const tbody = document.querySelector('#kishiTable tbody');
    const searchStr = document.getElementById('searchInput').value.toLowerCase();
    
    let filtered = kishiData.filter(k => {
        let matchFilter = (currentFilter === 'all' || k.status === currentFilter);
        let matchSearch = k.name.includes(searchStr) || k.highestRank.includes(searchStr) || (k.affiliation.toLowerCase().includes(searchStr));
        return matchFilter && matchSearch;
    });

    if (currentSort.key) {
        filtered.sort((a, b) => {
            let valA, valB;
            if (currentSort.key === 'number') {
                valA = a.sortNumber; valB = b.sortNumber;
            } else if (currentSort.key === 'highestRank') {
                valA = a.rankWeight; valB = b.rankWeight;
            } else if (currentSort.key === 'ageText') {
                valA = a.ageValue; valB = b.ageValue;
            } else if (currentSort.key === 'activePeriod') {
                valA = a.activePeriodValue; valB = b.activePeriodValue;
            } else if (currentSort.key.startsWith('age') && currentSort.key !== 'ageText') {
                valA = a[currentSort.key + 'Value']; valB = b[currentSort.key + 'Value'];
            } else {
                let vA = a[currentSort.key]; let vB = b[currentSort.key];
                if (!vA || vA === '-') valA = 0; else { let d = new Date(vA); valA = isNaN(d) ? vA : d.getTime(); }
                if (!vB || vB === '-') valB = 0; else { let d = new Date(vB); valB = isNaN(d) ? vB : d.getTime(); }
            }
            
            if (valA === 0 && valB !== 0) return 1;
            if (valB === 0 && valA !== 0) return -1;
            if (valA === 0 && valB === 0) return 0;
            return currentSort.asc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
        });
    }

    tbody.innerHTML = '';
    
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-message">該当する女流棋士が見つかりません</td></tr>`;
        return;
    }

    const colKeys = ['col4Select', 'col5Select', 'col6Select', 'col7Select', 'col8Select'].map(id => document.getElementById(id).value);

    filtered.forEach((k, index) => {
        let tr = document.createElement('tr');
        
        // 名前列はシンプルに（バッジなし）
        let nameDisplay = k.url ? `<a href="${k.url}" target="_blank" style="color: #cba135; font-weight: bold; text-decoration: none;">${k.name}</a>` : `<span style="font-weight: bold;">${k.name}</span>`;

        tr.innerHTML = `
            <td>${index + 1}</td>
            <td style="text-align: left;">${nameDisplay}</td>
            <td style="font-weight:bold; color:#1a3622;">${k.highestRank}</td>
            <td>${getCellContent(k, colKeys[0])}</td>
            <td class="tablet-col">${getCellContent(k, colKeys[1])}</td>
            <td class="tablet-col">${getCellContent(k, colKeys[2])}</td>
            <td class="pc-col">${getCellContent(k, colKeys[3])}</td>
            <td class="pc-col">${getCellContent(k, colKeys[4])}</td>
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
        let key = colId === 'col3' ? 'highestRank' : this.querySelector('select').value;

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
        if (currentSort.colId === th.dataset.col) currentSort.key = this.value;
        renderTable();
    });
    select.addEventListener('click', e => e.stopPropagation());
});

document.getElementById('searchInput').addEventListener('input', renderTable);