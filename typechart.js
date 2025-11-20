// typechart.csv（行列形式）を読み込んで、タイプ相性を扱うためのユーティリティを提供します。

// グローバルに保持するタイプ相性データ
let typeChart = {};      // 例: typeChart['Fire']['Grass'] = 2
let attackTypes = [];    // 行方向のタイプ名（攻撃側）
let defenseTypes = [];   // 列方向のタイプ名（防御側）

/**
 * CSVファイルを読み込んで typeChart を構築します。
 * @param {string} csvUrl - CSVファイルへのパス（例: 'typechart.csv'）
 * @returns {Promise<void>}
 */
function loadTypeChart(csvUrl) {
  return fetch(csvUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to load type chart CSV: ' + response.status);
      }
      return response.text();
    })
    .then(text => {
      parseTypeChartCSV(text);
    });
}

/**
 * CSV文字列をパースして typeChart / attackTypes / defenseTypes を構築します。
 * CSV形式（行列形式）は以下を想定しています。
 *
 * AttackType,Normal,Fire,Water,...,Fairy
 * Normal,1,1,1,...
 * Fire,1,0.5,0.5,...
 * ...
 *
 * @param {string} csvText
 */
function parseTypeChartCSV(csvText) {
  // 改行で行に分割し、空行を除去
  const lines = csvText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (lines.length === 0) {
    throw new Error('Type chart CSV is empty.');
  }

  // 1行目（ヘッダー）: AttackType,Normal,Fire,...,Fairy
  const header = lines[0].split(',').map(s => s.trim());
  // 0番目は "AttackType" 固定、それ以降が防御側タイプ名
  defenseTypes = header.slice(1);

  typeChart = {};
  attackTypes = [];

  // 2行目以降: 各攻撃タイプの行
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(s => s.trim());
    if (cols.length !== header.length) {
      // 列数が合わない行があればスキップ or エラー
      console.warn('Invalid line in type chart CSV (column length mismatch):', lines[i]);
      continue;
    }

    const attackType = cols[0];
    attackTypes.push(attackType);

    // この攻撃タイプ用のオブジェクトを作成
    if (!typeChart[attackType]) {
      typeChart[attackType] = {};
    }

    for (let j = 1; j < cols.length; j++) {
      const defType = defenseTypes[j - 1];
      const rawValue = cols[j];

      // 数値に変換（0, 0.5, 1, 2, ... を想定）
      const multiplier = parseFloat(rawValue);
      if (isNaN(multiplier)) {
        console.warn(
          `Invalid multiplier at attack=${attackType}, defense=${defType}:`,
          rawValue
        );
        continue;
      }

      typeChart[attackType][defType] = multiplier;
    }
  }
}

/**
 * 単タイプ同士の相性（攻撃タイプ → 防御タイプ）の倍率を取得します。
 * CSV読み込み後に使用してください。
 *
 * @param {string} attackType - 攻撃側タイプ名（例: 'Fire'）
 * @param {string} defenseType - 防御側タイプ名（例: 'Grass'）
 * @returns {number} 倍率（0, 0.5, 1, 2 など）
 */
function getSingleEffectiveness(attackType, defenseType) {
  if (!typeChart[attackType]) {
    console.warn('Unknown attack type:', attackType);
    return 1; // 不明な場合は等倍扱いにしておく
  }
  const row = typeChart[attackType];
  if (typeof row[defenseType] !== 'number') {
    console.warn('Unknown defense type:', defenseType);
    return 1;
  }
  return row[defenseType];
}

/**
 * 複合タイプも含めた最終倍率を取得します。
 * 第2タイプが存在しない場合は null や undefined を渡してください。
 *
 * 例:
 *   getEffectiveness('Fire', 'Grass', 'Steel')  // くさ＋はがね に対する ほのお技
 *   getEffectiveness('Electric', 'Water', null) // みず単タイプに対する でんき技
 *
 * @param {string} attackType - 攻撃側タイプ名（例: 'Fire'）
 * @param {string} defenseType1 - 防御側タイプ1（例: 'Grass'）
 * @param {string|null|undefined} defenseType2 - 防御側タイプ2（例: 'Poison'）なければ null
 * @returns {number} 最終倍率
 */
function getEffectiveness(attackType, defenseType1, defenseType2) {
  // タイプ1が必須
  if (!defenseType1) {
    console.warn('Defense type1 is required.');
    return 1;
  }

  // 単タイプ・複合タイプ問わず、掛け算で計算
  const m1 = getSingleEffectiveness(attackType, defenseType1);
  if (!defenseType2) {
    return m1;
  }

  const m2 = getSingleEffectiveness(attackType, defenseType2);
  return m1 * m2;
}

/**
 * ある防御側（単タイプまたは複合タイプ）に対して、
 * 全攻撃タイプ18種それぞれが何倍になるかをまとめて取得します。
 *
 * 例:
 *   const result = getAllAttackEffectiveness('Grass', 'Poison');
 *   // result = { Fire: 2, Water: 0.5, Electric: 1, ... }
 *
 * @param {string} defenseType1
 * @param {string|null|undefined} defenseType2
 * @returns {Object} 例: { Fire: 2, Water: 0.5, ... }
 */
function getAllAttackEffectiveness(defenseType1, defenseType2) {
  const result = {};
  for (const atk of attackTypes) {
    result[atk] = getEffectiveness(atk, defenseType1, defenseType2);
  }
  return result;
}