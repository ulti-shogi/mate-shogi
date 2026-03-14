let menjoData = [];
let filteredData = [];
let currentSort = { colId: 'date', asc: false }; // 初期は「免状授与日が新しい順」

// 段位を正しくソートするための裏の点数表
const rankMap = {
    "初段": 1, "二段": 2, "三段": 3, "四段": 4, "五段": 5, "六段": 6, "七段": 7, "八段": 8, "九段": 9
};

window.addEventListener('DOMContentLoaded', () => {
    fetch('menjo.csv')
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
    menjoData = [];
    
    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',');
        if (row.length < 4) continue;
        
        const dateStr = row[0];
        const name = row[1];
        const rank = row[2];
        const note = row[3];
        
        menjoData.push({
            date: dateStr,
            name: name,
            rank: rank,
            rankValue: rankMap[rank] || 0, // 点数表を使って数値化
            note: note
        });
    }
    filteredData = [...menjoData];
}

function setupUI() {
    // 検索機能の設定
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', function() {
        // 全角・半角スペースを無視して検索
        const query = this.value.toLowerCase().replace(/[\s　]/g, '');
        filteredData = menjoData.filter(d => {
            return d.name.toLowerCase().replace(/[\s　]/g, '').includes(query) || 
                   d.note.toLowerCase().includes(query);
        });
        renderTable();
    });

    // 並び替え（ソート）ヘッダーのクリック処理
    document.querySelectorAll('#menjoTable th.sortable').forEach(th => {
        th.addEventListener('click', function() {
            let colId = this.dataset.col;
            if (currentSort.colId === colId) {
                currentSort.asc = !currentSort.asc;
            } else {
                currentSort.colId = colId;
                currentSort.asc = (colId === 'date') ? false : true;
            }
            renderTable();
        });
    });

    renderTable();
}

function renderTable() {
    // ソート処理
    filteredData.sort((a, b) => {
        let valA = a[currentSort.colId];
        let valB = b[currentSort.colId];
        
        let cmp = 0;
        if (currentSort.colId === 'date') {
            cmp = new Date(valA).getTime() - new Date(valB).getTime();
        } else if (currentSort.colId === 'rankValue') {
            cmp = valA - valB;
        } else {
            cmp = String(valA).localeCompare(String(valB));
        }
        
        // 同点なら日付が新しい順を優先
        if (cmp === 0) {
            cmp = new Date(b.date).getTime() - new Date(a.date).getTime();
        }
        return currentSort.asc ? cmp : -cmp;
    });

    // 描画
    const tbody = document.querySelector('#menjoTable tbody');
    if (filteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-message">該当するデータがありません</td></tr>';
    } else {
        tbody.innerHTML = filteredData.map(d => `
            <tr>
                <td>${d.date}</td>
                <td style="font-weight:bold;">${d.name}</td>
                <td style="color:#cba135;">${d.rank}</td>
                <td style="text-align: left; padding: 8px 10px;">${d.note}</td>
            </tr>
        `).join('');
    }

    // 見出しの「▲/▼」マークを更新
    document.querySelectorAll('#menjoTable th.sortable').forEach(th => {
        th.classList.remove('asc', 'desc');
        if (th.dataset.col === currentSort.colId) {
            th.classList.add(currentSort.asc ? 'asc' : 'desc');
        }
    });
}