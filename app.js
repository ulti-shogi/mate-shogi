// app.js

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
  const form = document.getElementById('type-form');
  const resultSection = document.getElementById('result');
  const resultBody = document.getElementById('resultBody');
  const summaryText = document.getElementById('summaryText');

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
    })
    .catch((err) => {
      console.error(err);
      alert('タイプ相性データの読み込みに失敗しました。');
    });

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    // 選択された攻撃タイプ（未選択は除外）
    const chosenTypes = attackSelects
      .map(sel => sel.value)
      .filter(v => v && v.length > 0);

    if (chosenTypes.length === 0) {
      alert('攻撃側のタイプを少なくとも1つは選択してください。');
      return;
    }

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

    const types = defenseTypes.slice(); // 防御側タイプ一覧

    // 1) 単タイプ 18通り
    for (let i = 0; i < types.length; i++) {
      const def1 = types[i];
      const best = getBestCoverage(chosenTypes, def1, null);
      const key = normalizeMultiplier(best);
      if (counts.hasOwnProperty(key)) {
        counts[key]++;
      }
    }

    // 2) 複合タイプ C(18,2) = 153通り
    for (let i = 0; i < types.length; i++) {
      for (let j = i + 1; j < types.length; j++) {
        const def1 = types[i];
        const def2 = types[j];
        const best = getBestCoverage(chosenTypes, def1, def2);
        const key = normalizeMultiplier(best);
        if (counts.hasOwnProperty(key)) {
          counts[key]++;
        }
      }
    }

    // 合計確認（デバッグ用）
    const total = Object.values(counts).reduce((sum, v) => sum + v, 0);
    console.log('total combinations =', total); // 171 になる想定

    // 等倍以上／半減以下の合計を計算
    const totalSuper = counts['4'] + counts['2'] + counts['1'];                // 等倍以上
    const totalResist = counts['0.5'] + counts['0.25'] + counts['0'];         // 半減以下

    // 表の中身を更新
    resultBody.innerHTML = '';

    // 通常の6行（倍率ごとのカウント）
    multiplierKeys.forEach(function (key) {
      const tr = document.createElement('tr');

      const tdMul = document.createElement('td');
      tdMul.textContent = key + ' 倍';

      const tdCount = document.createElement('td');
      tdCount.textContent = counts[key] + ' 種類';

      const tdTotal = document.createElement('td');
      tdTotal.textContent = ''; // 個別行では空欄

      tr.appendChild(tdMul);
      tr.appendChild(tdCount);
      tr.appendChild(tdTotal);
      resultBody.appendChild(tr);
    });

    // まとめ行：等倍以上（4・2・1）
    const trSuper = document.createElement('tr');
    const tdSuperLabel = document.createElement('td');
    tdSuperLabel.textContent = '等倍以上（4・2・1）';

    const tdSuperCount = document.createElement('td');
    tdSuperCount.textContent = ''; // ここは空欄でもよい

    const tdSuperTotal = document.createElement('td');
    tdSuperTotal.textContent = totalSuper + ' 種類';

    trSuper.appendChild(tdSuperLabel);
    trSuper.appendChild(tdSuperCount);
    trSuper.appendChild(tdSuperTotal);
    resultBody.appendChild(trSuper);

    // まとめ行：半減以下（0.5・0.25・0）
    const trResist = document.createElement('tr');
    const tdResistLabel = document.createElement('td');
    tdResistLabel.textContent = '半減以下（0.5・0.25・0）';

    const tdResistCount = document.createElement('td');
    tdResistCount.textContent = '';

    const tdResistTotal = document.createElement('td');
    tdResistTotal.textContent = totalResist + ' 種類';

    trResist.appendChild(tdResistLabel);
    trResist.appendChild(tdResistCount);
    trResist.appendChild(tdResistTotal);
    resultBody.appendChild(trResist);

    // 選択タイプ一覧（英語）をそのまま表示
    const typeListText = chosenTypes.join(', ');

    summaryText.textContent =
      '攻撃タイプ「' + typeListText +
      '」で攻撃すると仮定した場合に、全171通り（単タイプ18＋複合タイプ153）のタイプそれぞれに対して、' +
      '最もダメージが入る技の倍率ごとの内訳です。（合計 ' + total + ' 通り）';

    resultSection.style.display = 'block';
  });

  /**
   * 選択した複数の攻撃タイプの中で、
   * その防御側（単タイプ or 複合タイプ）に対して
   * 「最も高いダメージ倍率」を返します。
   *
   * @param {string[]} attackTypeList - 攻撃タイプ配列
   * @param {string} defenseType1 - 防御タイプ1
   * @param {string|null} defenseType2 - 防御タイプ2（なければ null）
   * @returns {number} 最高倍率
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
   * @param {number} value
   * @returns {string}
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
});