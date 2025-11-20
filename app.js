document.addEventListener('DOMContentLoaded', function () {
      const attackSelect = document.getElementById('attackType');
      const form = document.getElementById('type-form');
      const resultSection = document.getElementById('result');
      const resultBody = document.getElementById('resultBody');
      const summaryText = document.getElementById('summaryText');

      // CSV を読み込んでから UI を初期化
      loadTypeChart('typechart.csv')
        .then(() => {
          // attackTypes / defenseTypes は typechart.js 側で定義済みを想定
          attackTypes.forEach(function (type) {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            attackSelect.appendChild(option);
          });
        })
        .catch((err) => {
          console.error(err);
          alert('タイプ相性データの読み込みに失敗しました。');
        });

      form.addEventListener('submit', function (event) {
        event.preventDefault();

        const attackType = attackSelect.value;
        if (!attackType) {
          alert('攻撃側のタイプを選択してください。');
          return;
        }

        // 倍率ごとのカウント用オブジェクト
        const multiplierKeys = ['4', '2', '1', '0.5', '0.25', '0'];
        const counts = {
          '4': 0,
          '2': 0,
          '1': 0,
          '0.5': 0,
          '0.25': 0,
          '0': 0
        };

        // 単タイプ＋複合タイプの全組み合わせ（171通り）を走査
        const types = defenseTypes.slice(); // typechart.js の防御側タイプ一覧

        // 1) 単タイプ 18通り
        for (let i = 0; i < types.length; i++) {
          const def1 = types[i];
          const m = getEffectiveness(attackType, def1, null);
          const key = normalizeMultiplier(m);
          if (counts.hasOwnProperty(key)) {
            counts[key]++;
          }
        }

        // 2) 複合タイプ C(18,2) = 153通り（順不同、同じ組み合わせは1回だけ）
        for (let i = 0; i < types.length; i++) {
          for (let j = i + 1; j < types.length; j++) {
            const def1 = types[i];
            const def2 = types[j];
            const m = getEffectiveness(attackType, def1, def2);
            const key = normalizeMultiplier(m);
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

        // 説明文
        summaryText.textContent =
          '攻撃タイプ「' + attackType +
          '」に対して、全171通り（単タイプ18＋複合タイプ153）のタイプの内訳です。（合計 ' +
          total + ' 通り）';

        resultSection.style.display = 'block';
      });

      /**
       * 浮動小数の誤差をならして、'4' / '2' / '1' / '0.5' / '0.25' / '0' のいずれかの文字列に正規化します。
       * @param {number} value
       * @returns {string}
       */
      function normalizeMultiplier(value) {
        // 小数第2位で丸める
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