let examData = [];
const sortState = { colId: 'id', asc: true };

// 日付フォーマット変換関数（例: "2014-09-23" → "2014年9月23日"）
function formatDate(dateStr) {
    if (!dateStr || dateStr.trim() === '') return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        // parseIntを使うことで "09" を "9" に変換します
        return `${parts[0]}年${parseInt(parts[1], 10)}月${parseInt(parts[2], 10)}日`;
    }
    return dateStr;
}

window.addEventListener('DOMContentLoaded', () => {
    fetch('exam.csv')
        .then(res => { 
            if(!res.ok) throw new Error('exam.csvの読み込みに失敗しました'); 
            return res.text(); 
        })
        .then(text => {
            processCSV(text);
            setupUI();
        })
        .catch(error => {
            console.error('エラー:', error);
            document.querySelector('#examSummaryTable tbody').innerHTML = `<tr><td colspan="6" class="empty-message">${error.message}</td></tr>`;
        });
});

function processCSV(text) {
    const lines = text.replace(/\r/g, '').split('\n').filter(line => line.trim() !== '');
    const headers = lines[0].split(',').map(h => h.trim());

    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',');
        if (row.length < headers.length) continue;

        const d = {};
        headers.forEach((h, index) => {
            d[h] = row[index] ? row[index].trim() : '';
        });

        const idNum = parseInt(d.id, 10) || 999;

        // ① 属性の自動判別（IDが4, 6, 7なら女流、それ以外はアマ）
        const attr = [4, 6, 7].includes(idNum) ? "女流" : "アマ";

        // 実施年の算出（変換前のハイフン区切りのデータから年だけ抽出）
        let year = '-';
        if (d.date1) {
            year = d.date1.split('-')[0] + '年';
        }

        let wins = 0;
        let losses = 0;
        let games = [];

        for (let j = 1; j <= 6; j++) {
            const opp = d[`opp${j}`];
            const rawDate = d[`date${j}`];
            const res = d[`res${j}`];

            if (opp || rawDate) {
                games.push({
                    round: `第${j}局`,
                    date: formatDate(rawDate), // ③ 年月日フォーマットに変換
                    opp: opp || '-',
                    res: res || '-'
                });

                if (res === '○' || res === '□') wins++;
                if (res === '●' || res === '■') losses++;
            }
        }

        let status = '試験中';
        if (wins >= 3) status = '合格';
        else if (losses >= 3) status = '不合格';

        let winLossStr = `${wins}勝${losses}敗`;
        if (status === '試験中' && wins === 0 && losses === 0) {
            winLossStr = '対局前';
        }

        examData.push({
            id: idNum,
            name: d.name,
            attr: attr, // 属性を格納
            meet: formatDate(d.meet),     // ③ 変換
            accept: formatDate(d.accept), // ③ 変換
            escape: formatDate(d.escape), // ③ 変換
            year: year,
            wins: wins,
            losses: losses,
            status: status,
            winLossStr: winLossStr,
            games: games
        });
    }
}

function setupUI() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
            this.classList.add('active');
            document.getElementById(this.dataset.target).classList.add('active');
        });
    });

    document.querySelectorAll('#examSummaryTable th.sortable').forEach(th => {
        th.addEventListener('click', function() {
            let colId = this.dataset.col;
            if (sortState.colId === colId) {
                sortState.asc = !sortState.asc;
            } else {
                sortState.colId = colId;
                sortState.asc = true;
            }
            renderSummaryTable();
        });
    });

    const pSel = document.getElementById('playerSelect');
    pSel.innerHTML = '<option value="">受験者を選択</option>';
    
    const sortedForSelect = [...examData].sort((a, b) => a.id - b.id);
    sortedForSelect.forEach(p => pSel.appendChild(new Option(p.name, p.id)));
    
    pSel.addEventListener('change', renderHistoryTable);

    renderSummaryTable();
}

function renderSummaryTable() {
    let viewData = [...examData];

    viewData.sort((a, b) => {
        let valA = a[sortState.colId];
        let valB = b[sortState.colId];

        if (valA < valB) return sortState.asc ? -1 : 1;
        if (valA > valB) return sortState.asc ? 1 : -1;
        return 0;
    });

    const tbody = document.querySelector('#examSummaryTable tbody');
    tbody.innerHTML = viewData.map(d => {
        let statusColor = "";
        if (d.status === "合格") statusColor = "color: #d32f2f; font-weight: bold;";
        else if (d.status === "不合格") statusColor = "color: #1976d2;";

        return `<tr>
            <td>${d.id}</td>
            <td style="font-weight:bold;">${d.name}</td>
            <td class="tablet-col">${d.attr}</td> <td>${d.year}</td>
            <td style="${statusColor}">${d.status}</td>
            <td style="font-weight:bold; color:#1a3622;">${d.winLossStr}</td>
        </tr>`;
    }).join('');

    document.querySelectorAll('#examSummaryTable th.sortable').forEach(th => {
        th.classList.remove('asc', 'desc');
        if (th.dataset.col === sortState.colId) {
            th.classList.add(sortState.asc ? 'asc' : 'desc');
        }
    });
}

function renderHistoryTable() {
    const pSel = document.getElementById('playerSelect');
    const tbody = document.querySelector('#historyTable tbody');
    const statsCard = document.getElementById('playerStatsCard');

    if (!pSel.value) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-message">受験者を選択してください</td></tr>';
        statsCard.style.display = "none";
        return;
    }

    const selectedId = parseInt(pSel.value, 10);
    const pData = examData.find(d => d.id === selectedId);

    if (!pData) return;

    statsCard.style.display = "block";
    
    let escapeHtml = "";
    if (pData.status === "合格" && pData.escape !== "-") {
        escapeHtml = `<div>順位戦昇級日： <span style="color:#d32f2f; font-weight:bold;">${pData.escape}</span></div>`;
    }
    
    // ② サマリー内の情報をそれぞれ <div> で囲み、縦一列に並べる
    statsCard.innerHTML = `
        <div style="font-size: 18px; font-weight: bold; margin-bottom: 12px; border-bottom: 1px dashed #cba135; padding-bottom: 8px;">
            ${pData.name} <span style="font-size: 14px; font-weight: normal;">（${pData.status} / ${pData.winLossStr}）</span>
        </div>
        <div style="font-size: 14px; color: #555; line-height: 1.8;">
            <div>資格獲得日： ${pData.meet}</div>
            <div>申請受理日： ${pData.accept}</div>
            ${escapeHtml}
        </div>
    `;

    if (pData.games.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-message">対局データがありません</td></tr>';
    } else {
        tbody.innerHTML = pData.games.map(g => {
            let resColor = (g.res === "○" || g.res === "□") ? "color: #d32f2f; font-weight: bold;" : 
                           ((g.res === "●" || g.res === "■") ? "color: #1976d2;" : "");
            return `<tr>
                <td style="font-weight:bold;">${g.round}</td>
                <td>${g.date}</td>
                <td>${g.opp}</td>
                <td style="${resColor} font-size:16px;">${g.res}</td>
            </tr>`;
        }).join('');
    }
}