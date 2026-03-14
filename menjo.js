let menjoData = [];
let filteredData = [];
let currentSort = { colId: 'date', asc: false };

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
    
    // どんな形式のCSVでも絶対にパニックにならない安全な読み込み処理
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
        
        if (row.length < 4) continue;
        
        const dateStr = row[0];
        const name = row[1];
        const rank = row[2];
        const note = row[3];
        // ⬇ 5列目（URL）があれば取得、なければ空欄にする
        const url = row[4] ? row[4].trim() : "";
        
        menjoData.push({
            date: dateStr,
            name: name,
            rank: rank,
            rankValue: rankMap[rank] || 0,
            note: note,
            url: url
        });
    }
    filteredData = [...menjoData];
}

function setupUI() {
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', function() {
        const query = this.value.toLowerCase().replace(/[\s　]/g, '');
        filteredData = menjoData.filter(d => {
            return d.name.toLowerCase().replace(/[\s　]/g, '').includes(query) || 
                   d.note.toLowerCase().includes(query);
        });
        renderTable();
    });

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
        
        if (cmp === 0) {
            cmp = new Date(b.date).getTime() - new Date(a.date).getTime();
        }
        return currentSort.asc ? cmp : -cmp;
    });

    const tbody = document.querySelector('#menjoTable tbody');
    if (filteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-message">該当するデータがありません</td></tr>';
    } else {
        tbody.innerHTML = filteredData.map(d => {
            // ⬇ URLがある人だけ「出典」というリンクを作る魔法
            let linkHtml = d.url ? `<a href="${d.url}" target="_blank" style="color: #0066cc; text-decoration: underline; font-weight: bold;">出典</a>` : '-';
            
            return `
            <tr>
                <td>${d.date}</td>
                <td style="font-weight:bold;">${d.name}</td>
                <td style="color:#cba135;">${d.rank}</td>
                <td>${linkHtml}</td>
                <td style="text-align: left; padding: 8px 10px;">${d.note}</td>
            </tr>
            `;
        }).join('');
    }

    document.querySelectorAll('#menjoTable th.sortable').forEach(th => {
        th.classList.remove('asc', 'desc');
        if (th.dataset.col === currentSort.colId) {
            th.classList.add(currentSort.asc ? 'asc' : 'desc');
        }
    });
}