// app.js
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
          option.value = type;
          option.textContent = type;
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

    // 選択された攻撃タイプ（重複は一応許可、未選択は除外）
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

    // 表の中身を更新
    resultBody.innerHTML = '';
    multiplierKeys.forEach(function (key) {
      const tr = document.createElement('tr');

      const tdMul = document.createElement('td');
      tdMul.textContent = key + ' 倍';

      const tdCount = document.createElement('td');
      tdCount.textContent = counts[key] + ' 種類';

      tr.appendChild(tdMul);
      tr.appendChild(tdCount);
      resultBody.appendChild(tr);
    });

    // 選択タイプ一覧を文字列化
    const typeListText = chosenTypes.join(', ');

    // 説明文（範囲補完後の最終倍率の内訳）
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
   * 範囲補完の概念そのもの：
   *   例）Fairy が半減されても Ground で抜群なら、その相手は 2倍 として扱う。
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