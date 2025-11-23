// typetool-basic-1 extended: defense type match-up support

// 日本語表示用マップ
const typeNameJa = {
  Normal: "ノーマル",
  Fire: "ほのお",
  Water: "みず",
  Electric: "でんき",
  Grass: "くさ",
  Ice: "こおり",
  Fighting: "かくとう",
  Poison: "どく",
  Ground: "じめん",
  Flying: "ひこう",
  Psychic: "エスパー",
  Bug: "むし",
  Rock: "いわ",
  Ghost: "ゴースト",
  Dragon: "ドラゴン",
  Dark: "あく",
  Steel: "はがね",
  Fairy: "フェアリー"
};

document.addEventListener('DOMContentLoaded', function () {
  const attackSelects = [
    document.getElementById('attackType1'),
    document.getElementById('attackType2'),
    document.getElementById('attackType3'),
    document.getElementById('attackType4')
  ];
  const defenseSelect1 = document.getElementById('defenseType1');
  const defenseSelect2 = document.getElementById('defenseType2');

  const form = document.getElementById('type-form');
  const resultSection = document.getElementById('result');
  const resultBody = document.getElementById('resultBody');
  const summaryText = document.getElementById('summaryText');
  const breakdownDiv = document.getElementById('breakdown');

  const defenseResultBox = document.getElementById('defenseResult');
  const defenseSummaryText = document.getElementById('defenseSummaryText');
  const defenseBody = document.getElementById('defenseBody');

  // CSV を読み込んでから UI を初期化
  loadTypeChart('typechart.csv')
    .then(() => {
      // attackTypes / defenseTypes は typechart.js 側で定義済み
      attackSelects.forEach(select => {
        attackTypes.forEach(function (type) {
          const option = document.createElement('option');
          option.value = type;                    // value は英語
          option.textContent = typeNameJa[type]; // 表示は日本語
          select.appendChild(option);
        });
      });

      // 防御側セレクトボックスにも同じリストを流用
      [defenseSelect1, defenseSelect2].forEach(select => {
        if (!select) return;
        defenseTypes.forEach(function (type) {
          const option = document.createElement('option');
          option.value = type;
          option.textContent = typeNameJa[type];
          select.appendChild(option);
        });
      });
    })
    .catch((err) => {
      console.error(err);
      alert('タイプ相性データの読み込みに失敗しました。');
    });

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    // 選択された攻撃タイプ（未選択は除外）
    const chosen = [];
    attackSelects.forEach((sel, index) => {
      if (!sel) return;
      const v = sel.value;
      if (v && v.length > 0) {
        chosen.push({
          type: v,           // 英語のタイプ名
          slot: index + 1    // 技1〜4 の番号
        });
      }
    });

    if (chosen.length === 0) {
      alert('攻撃側のタイプを少なくとも1つは選択してください。');
      return;
    }

    const chosenTypes = chosen.map(c => c.type);

    // 防御側の選択
    const defType1 = defenseSelect1 ? defenseSelect1.value : "";
    const defType2 = defenseSelect2 ? defenseSelect2.value : "";
    const hasDefense =
      (defType1 && defType1.length > 0) ||
      (defType2 && defType2.length > 0);

    // 倍率ごとのカウント用
    const multiplierKeys = ['4', '2', '1', '0.5', '0.25', '0'];
    const counts = {
      '4': 0,
      '2': 0,
      '1': 0,
      '0.5': 0,
      '0.25': 0,
      '0': 0
    };

    // 倍率ごとの内訳一覧（表示用文字列）
    const listByMul = {
      '4': [],
      '2': [],
      '1': [],
      '0.5': [],
      '0.25': [],
      '0': []
    };

    const types = defenseTypes.slice(); // 防御側タイプ一覧

    // 1) 単タイプ 18通り
    for (let i = 0; i < types.length; i++) {
      const d1 = types[i];
      const best = getBestCoverage(chosenTypes, d1, null);
      const key = normalizeMultiplier(best);
      if (counts.hasOwnProperty(key)) {
        counts[key]++;

        const name = typeNameJa[d1] || d1;
        listByMul[key].push(name);
      }
    }

    // 2) 複合タイプ C(18,2) = 153通り
    for (let i = 0; i < types.length; i++) {
      for (let j = i + 1; j < types.length; j++) {
        const d1 = types[i];
        const d2 = types[j];
        const best = getBestCoverage(chosenTypes, d1, d2);
        const key = normalizeMultiplier(best);
        if (counts.hasOwnProperty(key)) {
          counts[key]++;

          const name1 = typeNameJa[d1] || d1;
          const name2 = typeNameJa[d2] || d2;
          const name = name1 + "／" + name2;
          listByMul[key].push(name);
        }
      }
    }

    // 合計確認
    const total = Object.values(counts).reduce((sum, v) => sum + v, 0);

    // 等倍以上／半減以下など
    const totalSuper = counts['4'] + counts['2'] + counts['1'];       // 等倍以上
    const totalSuperEffective = counts['4'] + counts['2'];            // 抜群（2倍以上）
    const totalResist = counts['0.5'] + counts['0.25'] + counts['0']; // 半減以下

    // ▼ 範囲テーブルを更新
    resultBody.innerHTML = '';

    multiplierKeys.forEach(function (key) {
      const tr = document.createElement('tr');

      const tdMul = document.createElement('td');
      tdMul.textContent = key + ' 倍';

      const tdCount = document.createElement('td');
      tdCount.textContent = counts[key] + ' 種類';

      const tdRange = document.createElement('td');
      let rangeText = '';
      if (key === '4') {
        rangeText = '等倍以上';
      } else if (key === '2') {
        rangeText = totalSuper + 'タイプ';
      } else if (key === '1') {
        rangeText = '（うち抜群' + totalSuperEffective + '）';
      } else if (key === '0.5') {
        rangeText = '半減以下';
      } else if (key === '0.25') {
        rangeText = totalResist + 'タイプ';
      } else if (key === '0') {
        rangeText = '合計' + total + 'タイプ';
      }
      tdRange.textContent = rangeText;

      tr.appendChild(tdMul);
      tr.appendChild(tdCount);
      tr.appendChild(tdRange);
      resultBody.appendChild(tr);
    });

    // ▼ 内訳（<details>）を生成
    breakdownDiv.innerHTML = '';

    const orderForDetails = ['4', '2', '1', '0.5', '0.25', '0'];
    orderForDetails.forEach((key) => {
      const list = listByMul[key];
      if (!list || list.length === 0) {
        return;
      }
      list.sort();
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = key + '倍の内訳（' + list.length + '種類）';
      details.appendChild(summary);

      const ul = document.createElement('ul');
      list.forEach((name) => {
        const li = document.createElement('li');
        li.textContent = name;
        ul.appendChild(li);
      });

      details.appendChild(ul);
      breakdownDiv.appendChild(details);
    });

    // ▼ 防御側が指定されていれば、対そのタイプの相性一覧を表示
    if (hasDefense) {
      const def1Label = defType1 ? (typeNameJa[defType1] || defType1) : null;
      const def2Label = defType2 ? (typeNameJa[defType2] || defType2) : null;
      let defenseLabel = '';
      if (def1Label && def2Label) {
        defenseLabel = def1Label + '／' + def2Label;
      } else if (def1Label) {
        defenseLabel = def1Label;
      } else if (def2Label) {
        defenseLabel = def2Label;
      }

      defenseBody.innerHTML = '';

      chosen.forEach((info) => {
        const atkType = info.type;
        const slot = info.slot;

        const tr = document.createElement('tr');

        const tdSlot = document.createElement('td');
        tdSlot.textContent = '技' + slot;

        const tdType = document.createElement('td');
        tdType.textContent = typeNameJa[atkType] || atkType;

        const tdMul = document.createElement('td');
        const mult = getEffectiveness(atkType, defType1 || null, defType2 || null);
        tdMul.textContent = formatMultiplier(mult);

        tr.appendChild(tdSlot);
        tr.appendChild(tdType);
        tr.appendChild(tdMul);
        defenseBody.appendChild(tr);
      });

      defenseSummaryText.textContent =
        '防御タイプ「' + defenseLabel + '」に対する各技の相性です。';

      defenseResultBox.style.display = 'block';
    } else {
      // 防御側が未指定なら、このブロックは非表示
      defenseResultBox.style.display = 'none';
      defenseBody.innerHTML = '';
      defenseSummaryText.textContent = '';
    }

    // ▼ サマリー文
    // 日本語表記へ変換
    const typeListJa = chosenTypes.map(t => typeNameJa[t] || t).join('・');

    summaryText.textContent =
  '攻撃タイプ「' + typeListJa +
  '」で攻撃すると仮定した場合に、全171通り（単タイプ18＋複合タイプ153）のタイプそれぞれに対して、' +
  '最もダメージが入る技の倍率ごとの内訳です。（合計 ' + total + ' 通り）';

    resultSection.style.display = 'block';
  });

  /**
   * 選択した複数の攻撃タイプの中で、
   * その防御側（単タイプ or 複合タイプ）に対して
   * 「最も高いダメージ倍率」を返します。
   */
  function getBestCoverage(attackTypeList, defenseType1, defenseType2) {
    let best = 0; // 0倍（全て無効）のケースもあり得るので 0 からスタート

    for (const atk of attackTypeList) {
      const m = getEffectiveness(atk, defenseType1, defenseType2);
      if (m > best) {
        best = m;
      }
    }
    return best;
  }

  /**
   * 浮動小数の誤差をならして、'4' / '2' / '1' / '0.5' / '0.25' / '0' のいずれかの文字列に正規化します。
   */
  function normalizeMultiplier(value) {
    const v = Math.round(value * 100) / 100;

    if (v === 4) return '4';
    if (v === 2) return '2';
    if (v === 1) return '1';
    if (v === 0.5) return '0.5';
    if (v === 0.25) return '0.25';
    if (v === 0) return '0';

    // 万が一ずれているときのフォールバック（ほぼ保険）
    if (v > 3) return '4';
    if (v > 1.5) return '2';
    if (v > 0.75) return '1';
    if (v > 0.375) return '0.5';
    if (v > 0.125) return '0.25';
    return '0';
  }

  /**
   * 単一の倍率を、表示用テキストに変換する
   */
  function formatMultiplier(value) {
    const key = normalizeMultiplier(value);
    if (key === '4') return '4倍';
    if (key === '2') return '2倍';
    if (key === '1') return '等倍';
    if (key === '0.5') return '0.5倍';
    if (key === '0.25') return '0.25倍';
    return '無効（0倍）';
  }
});