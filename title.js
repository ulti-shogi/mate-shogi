function floorTo4Decimal(num) {
    if (isNaN(num) || num === 0) return "0.0000";
    var str = num.toString();
    var dotIndex = str.indexOf('.');
    if (dotIndex === -1) return num.toFixed(4);
    return (str + "0000").substring(0, dotIndex + 5);
}

// データ全体を保持するグローバル変数
var allSeriesData = [];
var rankingData = [];

async function initRanking() {
    try {
        var response = await fetch('タイトル戦対局結果.txt');
        if (!response.ok) throw new Error('File read error');
        var text = await response.text();
        var lines = text.split('\n');
        var validLines = [];
        for (var i = 0; i < lines.length; i++) {
            if (lines[i].trim().length > 0) validLines.push(lines[i].trim());
        }
        if (validLines.length < 2) return;
        
        var header = validLines[0].split(',');
        var colMap = {};
        for (var j = 0; j < header.length; j++) {
            colMap[header[j].trim()] = j;
        }
        
        var seriesDataMap = {};
        var kishiStats = {}; // 棋士データを保持するオブジェクトをここに移動
        
        function getOrCreateKishi(name) {
            if (!kishiStats[name]) {
                kishiStats[name] = { 
                    name: name, 
                    titleCount: 0, 
                    appearCount: 0, 
                    loseCount: 0, 
                    titles: {},
                    firstAppearDate: "9999-99-99" // 💡 初登場日の初期値（ありえない未来の日付）
                };
            }
            return kishiStats[name];
        }
        
        // テキストデータの読み込みとシリーズごとの集計
        for (var k = 1; k < validLines.length; k++) {
            var lineStr = validLines[k];
            if (lineStr.indexOf('[source:') === 0) continue;
            
            var cells = lineStr.split(',');
            var match = cells[colMap['match']] ? cells[colMap['match']].trim() : "";
            var the = cells[colMap['the']] ? cells[colMap['the']].trim() : "";
            var phase = cells[colMap['phase']] ? cells[colMap['phase']].trim() : "";
            var detail = cells[colMap['detail']] ? cells[colMap['detail']].trim() : "";
            var gameDate = cells[colMap['game_date']] ? cells[colMap['game_date']].trim() : "";
            var playerA = cells[colMap['player_A']] ? cells[colMap['player_A']].trim() : "";
            var playerB = cells[colMap['player_B']] ? cells[colMap['player_B']].trim() : "";
            var resultA = cells[colMap['a']] ? cells[colMap['a']].trim() : "";
            var resultB = cells[colMap['b']] ? cells[colMap['b']].trim() : "";
            var others = cells[colMap['others']] ? cells[colMap['others']].trim() : "";
            
            if (!match || !the || !playerA || !playerB) continue;
            
            // 💡 棋士の初登場日を記録（一番古い日付を保持し続ける）
            if (gameDate && gameDate !== '―') {
                if (playerA !== "該当者なし" && playerA !== "未定") {
                    var pA = getOrCreateKishi(playerA);
                    if (gameDate < pA.firstAppearDate) pA.firstAppearDate = gameDate;
                }
                if (playerB !== "該当者なし" && playerB !== "未定") {
                    var pB = getOrCreateKishi(playerB);
                    if (gameDate < pB.firstAppearDate) pB.firstAppearDate = gameDate;
                }
            }
            
            var seriesKey = the + "-" + match;
            
            if (!seriesDataMap[seriesKey]) {
                var requiredWins = 4;
                var isNoMatch = false;
                
                if (phase.indexOf('五番勝負') !== -1 || phase.indexOf('5番勝負') !== -1) {
                    requiredWins = 3;
                } else if (phase.indexOf('三番勝負') !== -1 || phase.indexOf('3番勝負') !== -1) {
                    requiredWins = 2;
                } else if (phase.indexOf('決勝') !== -1 || detail.indexOf('決勝') !== -1 || phase.indexOf('一発勝負') !== -1) {
                    requiredWins = 1;
                }
                
                if (detail.indexOf('実施なし') !== -1 || phase.indexOf('実施なし') !== -1) {
                    isNoMatch = true;
                }
                
                seriesDataMap[seriesKey] = { 
                    match: match, 
                    the: the, 
                    theNum: parseInt(the.replace(/[^0-9]/g, '')) || 0,
                    year: others,
                    playerA: playerA, 
                    playerB: playerB, 
                    winsA: 0, 
                    winsB: 0, 
                    requiredWins: requiredWins, 
                    isNoMatch: isNoMatch,
                    endDate: "",       
                    isDecided: false,  
                    latestGameDate: "" 
                };
            }
            
            var s = seriesDataMap[seriesKey];
            
            // 星を数え、規定数に達した日を「決着日」としてロックする
            if (!s.isDecided) {
                if (resultA === '☆') s.winsA++;
                else if (resultB === '☆') s.winsB++;
                
                if (s.winsA >= s.requiredWins || s.winsB >= s.requiredWins) {
                    s.endDate = gameDate;
                    s.isDecided = true;
                } else if (s.isNoMatch) {
                    s.endDate = gameDate; 
                    s.isDecided = true;
                }
            }
            
            // まだ決着がついていないシリーズをテーブル下部に並べるための日付保持
            if (gameDate && resultA !== '―' && resultB !== '―') {
                s.latestGameDate = gameDate;
            } else if (gameDate && !s.latestGameDate) {
                s.latestGameDate = gameDate;
            }
        }
        
        var sKeys = Object.keys(seriesDataMap);
        for (var idx = 0; idx < sKeys.length; idx++) {
            var s = seriesDataMap[sKeys[idx]];
            
            var isFinishedA = s.winsA >= s.requiredWins || s.isNoMatch;
            var isFinishedB = s.winsB >= s.requiredWins && !s.isNoMatch;
            s.isFinished = isFinishedA || isFinishedB;
            
            s.winner = isFinishedA ? 'A' : (isFinishedB ? 'B' : null);
            
            allSeriesData.push(s);
            
            if (s.isFinished) {
                var pA = getOrCreateKishi(s.playerA);
                pA.appearCount++;
                
                var pB = null;
                if (s.playerB !== "該当者なし" && s.playerB !== "未定") {
                    pB = getOrCreateKishi(s.playerB);
                    pB.appearCount++;
                }
                
                if (isFinishedA) {
                    pA.titleCount++;
                    if (pB) pB.loseCount++;
                    pA.titles[s.match] = (pA.titles[s.match] || 0) + 1;
                } else {
                    if (pB) pB.titleCount++;
                    pA.loseCount++;
                    if (pB) pB.titles[s.match] = (pB.titles[s.match] || 0) + 1;
                }
            }
        }
        
        rankingData = [];
        var kKeys = Object.keys(kishiStats);
        for (var m = 0; m < kKeys.length; m++) {
            var kData = kishiStats[kKeys[m]];
            kData.winRate = kData.appearCount > 0 ? (kData.titleCount / kData.appearCount) : 0;
            rankingData.push(kData);
        }
        
        sortData(rankingData, 'titleCount', 'desc');
        renderRankingTable(rankingData);
        setupRankingSort();
        
        initDropdowns();
        setupTabs();
        
    } catch (error) {
        console.error(error);
    }
}

// ---------------------------
// ランキングタブの処理
// ---------------------------
function renderRankingTable(data) {
    var tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    
    for (var i = 0; i < data.length; i++) {
        var k = data[i];
        var titlesArr = [];
        var tKeys = Object.keys(k.titles);
        for (var j = 0; j < tKeys.length; j++) {
            titlesArr.push(tKeys[j].replace('戦', '') + '(' + k.titles[tKeys[j]] + ')');
        }
        
        var tr = document.createElement('tr');
        tr.innerHTML = '<td>' + k.rank + '</td>' +
        '<td style="font-weight: bold; text-align: left; padding-left: 15px;">' + k.name + '</td>' +
        '<td>' + k.appearCount + '</td>' +
        '<td style="font-weight: bold; color: #1a3622;">' + k.titleCount + '</td>' +
        '<td>' + k.loseCount + '</td>' +
        '<td style="font-variant-numeric: tabular-nums;">' + floorTo4Decimal(k.winRate) + '</td>' +
        '<td class="tablet-col pc-col" style="text-align: left; padding-left: 10px; color: #666; font-size: 12px;">' + (titlesArr.join(' ') || '-') + '</td>';
        tbody.appendChild(tr);
    }
}

function sortData(data, field, direction) {
    data.sort(function(a, b) {
        var valA = a[field];
        var valB = b[field];
        
        if (valA === valB) {
            // 第2の基準: 登場数or獲得数
            if (field === 'appearCount') {
                if (a.titleCount !== b.titleCount) return b.titleCount - a.titleCount;
            } else {
                if (a.appearCount !== b.appearCount) return b.appearCount - a.appearCount;
            }
            
            // 💡 第3の基準: タイトル戦初登場の日付が古い（早い）方を上にする
            if (a.firstAppearDate !== b.firstAppearDate) {
                return a.firstAppearDate < b.firstAppearDate ? -1 : 1;
            }
            
            // 💡 究極の保険: 全く同じ日にデビューして成績も完全に同じ場合は五十音順
            return a.name.localeCompare(b.name, 'ja');
        }
        return direction === 'asc' ? valA - valB : valB - valA;
    });
    
    var currentRank = 1;
    for (var i = 0; i < data.length; i++) {
        if (i > 0 && data[i - 1][field] !== data[i][field] && direction === 'desc') {
            currentRank = i + 1;
        }
        data[i].rank = currentRank;
    }
}

function setupRankingSort() {
    var thList = document.querySelectorAll('#titleTable th.sortable');
    for (var k = 0; k < thList.length; k++) {
        thList[k].addEventListener('click', function(e) {
            var th = e.currentTarget;
            var field = th.dataset.sort;
            var direction = 'desc';
            
            if (th.classList.contains('desc')) {
                direction = 'asc';
            } else if (th.classList.contains('asc')) {
                direction = 'desc';
            }
            
            for (var j = 0; j < thList.length; j++) {
                thList[j].classList.remove('asc', 'desc');
            }
            th.classList.add(direction);
            
            sortData(rankingData, field, direction);
            renderRankingTable(rankingData);
        });
    }
}

// ---------------------------
// タブ・プルダウン・各年度・各棋戦の処理
// ---------------------------
function setupTabs() {
    var tabBtns = document.querySelectorAll('.tab-btn');
    var panels = document.querySelectorAll('.panel');
    for (var i = 0; i < tabBtns.length; i++) {
        tabBtns[i].addEventListener('click', function(e) {
            for (var j = 0; j < tabBtns.length; j++) tabBtns[j].classList.remove('active');
            for (var j = 0; j < panels.length; j++) {
                panels[j].classList.remove('active');
                panels[j].style.display = 'none';
            }
            
            var targetId = e.currentTarget.dataset.target;
            e.currentTarget.classList.add('active');
            var targetPanel = document.getElementById(targetId);
            targetPanel.classList.add('active');
            targetPanel.style.display = 'block';
        });
    }
}

function initDropdowns() {
    var yearSet = {};
    var matchSet = {};
    
    for (var i = 0; i < allSeriesData.length; i++) {
        var y = allSeriesData[i].year;
        var m = allSeriesData[i].match;
        if (y) yearSet[y] = true;
        if (m) matchSet[m] = true;
    }
    
    var yearArr = Object.keys(yearSet).sort(function(a, b) { return b - a; });
    var ySelect = document.getElementById('yearSelect');
    ySelect.innerHTML = ''; 
    for (var i = 0; i < yearArr.length; i++) {
        var opt = document.createElement('option');
        opt.value = yearArr[i];
        opt.text = yearArr[i] + '年度';
        ySelect.appendChild(opt);
    }
    ySelect.addEventListener('change', function(e) { renderYearlyTable(e.target.value); });
    
    var mSelect = document.getElementById('matchSelect');
    mSelect.innerHTML = ''; 
    var definedOrder = ["竜王戦", "名人戦", "叡王戦", "王位戦", "王座戦", "棋聖戦", "棋王戦", "王将戦"];
    
    var matchArr = [];
    for (var i = 0; i < definedOrder.length; i++) {
        if (matchSet[definedOrder[i]]) {
            matchArr.push(definedOrder[i]);
            delete matchSet[definedOrder[i]];
        }
    }
    var remaining = Object.keys(matchSet);
    for (var j = 0; j < remaining.length; j++) {
        matchArr.push(remaining[j]);
    }
    
    for (var j = 0; j < matchArr.length; j++) {
        var opt = document.createElement('option');
        opt.value = matchArr[j];
        opt.text = matchArr[j];
        mSelect.appendChild(opt);
    }
    mSelect.addEventListener('change', function(e) { renderMatchTable(e.target.value); });
    
    if (yearArr.length > 0) renderYearlyTable(yearArr[0]);
    if (mSelect.options.length > 0) renderMatchTable(mSelect.options[0].value);
}

function renderYearlyTable(year) {
    var filtered = [];
    for (var i = 0; i < allSeriesData.length; i++) {
        if (allSeriesData[i].year === year) filtered.push(allSeriesData[i]);
    }
    
    filtered.sort(function(a, b) {
        var dateA = a.isDecided && a.endDate ? a.endDate : (a.latestGameDate || "9999-99-99");
        var dateB = b.isDecided && b.endDate ? b.endDate : (b.latestGameDate || "9999-99-99");
        if (dateA < dateB) return -1;
        if (dateA > dateB) return 1;
        return a.theNum - b.theNum;
    });
    
    var tbody = document.getElementById('yearlyTableBody');
    tbody.innerHTML = '';
    
    if (filtered.length === 0) {
        document.getElementById('yearlyEmptyMessage').style.display = 'block';
    } else {
        document.getElementById('yearlyEmptyMessage').style.display = 'none';
        for (var j = 0; j < filtered.length; j++) {
            var s = filtered[j];
            var bgA = s.winner === 'A' ? 'winner-bg' : '';
            var bgB = s.winner === 'B' ? 'winner-bg' : '';
            
            var tr = document.createElement('tr');
            tr.innerHTML = 
                '<td>' + s.match + '</td>' +
                '<td>' + s.the + '</td>' +
                '<td class="' + bgA + '">' + s.playerA + '</td>' +
                '<td class="' + bgA + '">' + s.winsA + '</td>' +
                '<td class="' + bgB + '">' + s.winsB + '</td>' +
                '<td class="' + bgB + '">' + s.playerB + '</td>';
            tbody.appendChild(tr);
        }
    }
}

function renderMatchTable(matchName) {
    var filtered = [];
    for (var i = 0; i < allSeriesData.length; i++) {
        if (allSeriesData[i].match === matchName) filtered.push(allSeriesData[i]);
    }
    
    filtered.sort(function(a, b) {
        return b.theNum - a.theNum;
    });
    
    var tbody = document.getElementById('matchTableBody');
    tbody.innerHTML = '';
    
    if (filtered.length === 0) {
        document.getElementById('matchEmptyMessage').style.display = 'block';
    } else {
        document.getElementById('matchEmptyMessage').style.display = 'none';
        for (var j = 0; j < filtered.length; j++) {
            var s = filtered[j];
            var bgA = s.winner === 'A' ? 'winner-bg' : '';
            var bgB = s.winner === 'B' ? 'winner-bg' : '';
            
            var tr = document.createElement('tr');
            tr.innerHTML = 
                '<td>' + s.the + '</td>' +
                '<td>' + s.year + '</td>' +
                '<td class="' + bgA + '">' + s.playerA + '</td>' +
                '<td class="' + bgA + '">' + s.winsA + '</td>' +
                '<td class="' + bgB + '">' + s.winsB + '</td>' +
                '<td class="' + bgB + '">' + s.playerB + '</td>';
            tbody.appendChild(tr);
        }
    }
}

document.addEventListener('DOMContentLoaded', initRanking);