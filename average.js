let allData = [];
let filteredData = [];
// 初期ソートは「四段昇段年齢が若い順（昇順）」
let currentSort = { colId: 'ageValue', asc: true };

// ページ読み込み時に自動でCSVを取得
window.addEventListener('DOMContentLoaded', () => {
    fetch('kishi.csv')
        .then(response => {
            if (!response.ok) throw new Error('CSV読み込み失敗');
            return response.text();
        })
        .then(csvText => {
            processData(csvText);
        })
        .catch(error => {
            console.error(error);
            document.getElementById('averageDisplay').textContent = "エラー";
            document.getElementById('averageDesc').textContent = "データの読み込みに失敗しました。";
        });
});

// CSVから必要なデータを抽出し、個人ごとの正確な日数を計算
function processData(csvText) {
    const lines = csvText.replace(/\r/g, '').split('\n').filter(line => line.trim() !== '');
    allData = [];

    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',');
        if (row.length < 11) continue;

        let num = parseInt(row[0]);
        let name = row[1];
        let birthdayStr = row[2];
        let fourStr = row[3];

        // 73番以降で、生年月日と四段昇段日の両方がある人のみ対象
        if (num >= 73 && birthdayStr && fourStr) {
            let birth = new Date(birthdayStr);
            let four = new Date(fourStr);
            
            if (!isNaN(birth.getTime()) && !isNaN(four.getTime())) {
                // 生まれてから四段になるまでの「正確な日数」
                let diffDays = (four.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24);
                
                // 表示用の「〇歳〇ヶ月〇日」を作る関数（script.jsと同じロジック）
                let y = four.getFullYear() - birth.getFullYear();
                let m = four.getMonth() - birth.getMonth();
                let d = four.getDate() - birth.getDate();
                if (d < 0) {
                    m--;
                    let prevMonth = new Date(four.getFullYear(), four.getMonth(), 0); 
                    d += prevMonth.getDate();
                }
                if (m < 0) {
                    y--;
                    m += 12;
                }
                
                allData.push({
                    number: num,
                    name: name,
                    birthday: birthdayStr,
                    four: fourStr,
                    ageText: `${y}歳${m}ヶ月${d}日`,
                    ageValue: diffDays // ソートと平均計算用の数値（日数）
                });
            }
        }
    }
    updateView();
}

// 日数（数値）から「〇歳〇ヶ月〇日」を計算する平均用の特殊関数
function daysToYMD(totalDays) {
    // 1年=365.2425日、1ヶ月=30.436875日として正確に平均を割り出す
    let y = Math.floor(totalDays / 365.2425);
    let rem = totalDays % 365.2425;
    let m = Math.floor(rem / 30.436875);
    let d = Math.floor(rem % 30.436875);
    return `${y}歳${m}ヶ月${d}日`;
}

// 画面を更新する関数
function updateView() {
    // 1. プルダウンの選択肢から、対象の棋士番号の範囲を取得
    const select = document.getElementById('periodSelect');
    const [minNum, maxNum] = select.value.split('-').map(Number);
    const selectedText = select.options[select.selectedIndex].text;

    // 2. 対象者を絞り込む
    filteredData = allData.filter(k => k.number >= minNum && k.number <= maxNum);

    // 3. 平均年齢の計算と表示
    if (filteredData.length > 0) {
        let totalDays = filteredData.reduce((sum, k) => sum + k.ageValue, 0);
        let averageDays = totalDays / filteredData.length;
        
        document.getElementById('averageDisplay').textContent = daysToYMD(averageDays);
        document.getElementById('averageDesc').textContent = 
            `集計対象：${selectedText} に四段昇段した棋士（計 ${filteredData.length} 名）`;
    } else {
        document.getElementById('averageDisplay').textContent = "-";
        document.getElementById('averageDesc').textContent = "対象データがありません";
    }

    renderTable();
}

// 表の並べ替えと描画
function renderTable() {
    // 並べ替え（ソート）
    filteredData.sort((a, b) => {
        let cmp = 0;
        if (currentSort.colId === 'number' || currentSort.colId === 'ageValue') {
            cmp = a[currentSort.colId] - b[currentSort.colId];
        } else {
            cmp = new Date(a.four).getTime() - new Date(b.four).getTime();
        }

        // 同点決勝（引き分けなら棋士番号の若い順）
        if (cmp === 0) {
            return a.number - b.number;
        }
        return currentSort.asc ? cmp : -cmp;
    });

    // 描画
    const tbody = document.querySelector('#averageTable tbody');
    tbody.innerHTML = '';

    filteredData.forEach((k, index) => {
        // 日付を「1990年1月1日」の形にする
        let dateMatch = k.four.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
        let dateStr = dateMatch ? `${parseInt(dateMatch[1])}年${parseInt(dateMatch[2])}月${parseInt(dateMatch[3])}日` : k.four;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td style="font-weight:bold;">${k.name}</td>
            <td>${k.number}</td>
            <td>${dateStr}</td>
            <td>${k.ageText}</td>
        `;
        tbody.appendChild(tr);
    });

    // 見出しの「▲/▼」マークを更新
    document.querySelectorAll('#averageTable th.sortable').forEach(th => {
        th.classList.remove('asc', 'desc');
        if (th.dataset.col === currentSort.colId) {
            th.classList.add(currentSort.asc ? 'asc' : 'desc');
        }
    });
}

// イベントリスナー（クリック操作などの設定）
document.getElementById('periodSelect').addEventListener('change', updateView);

document.querySelectorAll('#averageTable th.sortable').forEach(th => {
    th.addEventListener('click', function() {
        let colId = this.dataset.col;
        if (currentSort.colId === colId) {
            currentSort.asc = !currentSort.asc;
        } else {
            currentSort.colId = colId;
            currentSort.asc = true;
        }
        renderTable();
    });
});