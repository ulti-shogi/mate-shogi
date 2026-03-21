let examData = [];
const sortState = { colId: 'id', asc: true };

// ページ読み込み時にCSVを取得
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
            document.querySelector('#examSummaryTable tbody').innerHTML = `<tr><td colspan="5" class="empty-message">${error.message}</td></tr>`;
        });
});

// CSVを解析し、プログラムで扱いやすい形に変換・計算する
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

        // 実施年の算出
        let year = '-';
        if (d.date1) {
            year = d.date1.split('-')[0];
        }

        let wins = 0;
        let losses = 0;
        let games = [];

        for (let j = 1; j <= 6; j++) {
            const opp = d[`opp${j}`];
            const date = d[`date${j}`];
            const res = d[`res${j}`];

            if (opp || date) {
                games.push({
                    round: `第${j}局`,
                    date: date || '-',
                    opp: opp || '-',
                    res: res || '-'
                });

                if (res === '○' || res === '□') wins++;
                if (res === '●' || res === '■') losses++;
            }
        }

        // 合否判定
        let status = '試験中';
        if (wins >= 3) status = '合格';
        else if (losses >= 3) status = '不合格';

        // 勝敗文字列
        let winLossStr = `${wins}勝${losses}敗`;
        if (status === '試験中' && wins === 0 && losses === 0) {
            winLossStr = '対局前';
        }

        examData.push({
            id: parseInt(d.id, 10) || 999,
            name: d.name,
            meet: d.meet,
            accept: d.accept,
            escape: d.escape,
            year: year,
            wins: wins,
            losses: losses,
            status: status,
            winLossStr: winLossStr,
            games: games
        });
    }
}

// UIの初期設定
function setupUI() {
    // タブ切り替え処理
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
            this.classList.add('active');
            document.getElementById(this.dataset.target).classList.add('active');
        });
    });

    // ソートイベントの設定（今回はID列のみ動作します）
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

    // プルダウンの初期化
    const pSel = document.getElementById('playerSelect');
    pSel.innerHTML = '<option value="">受験者を選択</option>';
    
    const sortedForSelect = [...examData].sort((a, b) => a.id - b.id);
    sortedForSelect.forEach(p => pSel.appendChild(new Option(p.name, p.id)));
    
    pSel.addEventListener('change', renderHistoryTable);

    renderSummaryTable();
}

// パネル1：結果一覧の描画
function renderSummaryTable() {
    let viewData = [...examData];

    // ソート処理
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
            <td>${d.year}</td>
            <td style="${statusColor}">${d.status}</td>
            <td style="font-weight:bold; color:#1a3622;">${d.winLossStr}</td>
        </tr>`;
    }).join('');

    // 見出しの矢印アイコンを更新
    document.querySelectorAll('#examSummaryTable th.sortable').forEach(th => {
        th.classList.remove('asc', 'desc');
        if (th.dataset.col === sortState.colId) {
            th.classList.add(sortState.asc ? 'asc' : 'desc');
        }
    });
}

// パネル2：個別の詳細の描画
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
    if (pData.status === "合格" && pData.escape) {
        escapeHtml = `<br><span style="font-size: 14px; color: #555;">順位戦C級2組昇級日: <span style="color:#d32f2f; font-weight:bold;">${pData.escape}</span></span>`;
    }
    
    // サマリー内に「申請受理日」を追加
    statsCard.innerHTML = `
        <div style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">${pData.name} （${pData.status} / ${pData.winLossStr}）</div>
        <div style="font-size: 14px; color: #555;">資格獲得日: ${pData.meet || '-'}　|　申請受理日: ${pData.accept || '-'}</div>
        ${escapeHtml}
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