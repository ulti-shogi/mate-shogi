function floorTo4Decimal(num) {
    if (isNaN(num) || num === 0) return "0.0000";
    var str = num.toString();
    var dotIndex = str.indexOf('.');
    if (dotIndex === -1) return num.toFixed(4);
    return (str + "0000").substring(0, dotIndex + 5);
}

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
        
        var seriesData = {};
        for (var k = 1; k < validLines.length; k++) {
            var lineStr = validLines[k];
            if (lineStr.indexOf('[source:') === 0) continue;
            
            var cells = lineStr.split(',');
            var match = cells[colMap['match']] ? cells[colMap['match']].trim() : "";
            var the = cells[colMap['the']] ? cells[colMap['the']].trim() : "";
            var phase = cells[colMap['phase']] ? cells[colMap['phase']].trim() : "";
            var detail = cells[colMap['detail']] ? cells[colMap['detail']].trim() : "";
            var playerA = cells[colMap['player_A']] ? cells[colMap['player_A']].trim() : "";
            var playerB = cells[colMap['player_B']] ? cells[colMap['player_B']].trim() : "";
            var resultA = cells[colMap['a']] ? cells[colMap['a']].trim() : "";
            var resultB = cells[colMap['b']] ? cells[colMap['b']].trim() : "";
            
            if (!match || !the || !playerA || !playerB || playerB === "未定") continue;
            var seriesKey = the + "-" + match;
            
            if (!seriesData[seriesKey]) {
                var requiredWins = 4;
                var isNoMatch = false; // 「実施なし」フラグを追加
                
                if (phase.indexOf('五番勝負') !== -1 || phase.indexOf('5番勝負') !== -1) {
                    requiredWins = 3;
                } else if (phase.indexOf('三番勝負') !== -1 || phase.indexOf('3番勝負') !== -1) {
                    requiredWins = 2;
                } else if (phase.indexOf('決勝') !== -1 || detail.indexOf('決勝') !== -1 || phase.indexOf('一発勝負') !== -1) {
                    requiredWins = 1;
                }
                
                // 「実施なし」の文字が含まれる場合は不戦勝（自動獲得）扱いとする
                if (detail.indexOf('実施なし') !== -1 || phase.indexOf('実施なし') !== -1) {
                    isNoMatch = true;
                }
                
                seriesData[seriesKey] = { 
                    match: match, 
                    the: the, 
                    playerA: playerA, 
                    playerB: playerB, 
                    winsA: 0, 
                    winsB: 0, 
                    requiredWins: requiredWins, 
                    hasStarted: false,
                    isNoMatch: isNoMatch
                };
            }
            
            if (resultA === '☆') {
                seriesData[seriesKey].winsA++;
                seriesData[seriesKey].hasStarted = true;
            } else if (resultB === '☆') {
                seriesData[seriesKey].winsB++;
                seriesData[seriesKey].hasStarted = true;
            } else if (resultA === '★' || resultB === '★') {
                seriesData[seriesKey].hasStarted = true;
            }
        }
        
        var kishiStats = {};
        function getOrCreateKishi(name) {
            if (!kishiStats[name]) {
                kishiStats[name] = { name: name, titleCount: 0, appearCount: 0, loseCount: 0, titles: {} };
            }
            return kishiStats[name];
        }
        
        var sKeys = Object.keys(seriesData);
        for (var idx = 0; idx < sKeys.length; idx++) {
            var s = seriesData[sKeys[idx]];
            
            // 💡 実施なしの場合は、問答無用でプレイヤーA（防衛者）の獲得とする
            var isFinishedA = s.winsA >= s.requiredWins || s.isNoMatch;
            var isFinishedB = s.winsB >= s.requiredWins && !s.isNoMatch;
            var isFinished = isFinishedA || isFinishedB;
            
            if (isFinished || s.hasStarted) {
                var pA = getOrCreateKishi(s.playerA);
                pA.appearCount++;
                
                var pB = null;
                // 💡 相手が「該当者なし」の場合は、棋士として集計しない
                if (s.playerB !== "該当者なし") {
                    pB = getOrCreateKishi(s.playerB);
                    pB.appearCount++;
                }
                
                if (isFinished) {
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
        }
        
        var rankingArray = [];
        var kKeys = Object.keys(kishiStats);
        for (var m = 0; m < kKeys.length; m++) {
            var kData = kishiStats[kKeys[m]];
            kData.winRate = kData.appearCount > 0 ? (kData.titleCount / kData.appearCount) : 0;
            rankingArray.push(kData);
        }
        
        sortData(rankingArray, 'titleCount', 'desc');
        renderTable(rankingArray);
        setupControls(rankingArray);
        
    } catch (error) {
        console.error(error);
    }
}

function renderTable(data) {
    var tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    if (data.length === 0) {
        document.getElementById('emptyMessage').style.display = 'block';
        return;
    }
    document.getElementById('emptyMessage').style.display = 'none';
    
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
        if (valA === valB) return a.name.localeCompare(b.name, 'ja');
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

function setupControls(allData) {
    var searchInput = document.getElementById('searchInput');
    var thList = document.querySelectorAll('#titleTable th.sortable');
    
    function filterAndSort() {
        var query = searchInput.value.trim();
        var filtered = [];
        for (var i = 0; i < allData.length; i++) {
            if (allData[i].name.indexOf(query) !== -1) filtered.push(allData[i]);
        }
        var activeTh = document.querySelector('#titleTable th.sortable.asc, #titleTable th.sortable.desc');
        var field = activeTh ? activeTh.dataset.sort : 'titleCount';
        var direction = activeTh && activeTh.classList.contains('asc') ? 'asc' : 'desc';
        sortData(filtered, field, direction);
        renderTable(filtered);
    }
    
    searchInput.addEventListener('input', filterAndSort);
    
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
            filterAndSort();
        });
    }
}

document.addEventListener('DOMContentLoaded', initRanking);