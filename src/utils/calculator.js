// 生成组合
export function generateCombinations(arr, k) {
  const result = [];
  const helper = (start, current) => {
    if (current.length === k) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      current.push(arr[i]);
      helper(i + 1, current);
      current.pop();
    }
  };
  helper(0, []);
  return result;
}

// 笛卡尔积
export function cartesianProduct(arrays) {
  return arrays.reduce((acc, arr) =>
    acc.flatMap(x => arr.map(y => [...x, y])),
    [[]]
  );
}

// 核心计算
export function calculatePayout(userSelections) {
  const { matches, combinations: comboTypes, betAmount } = userSelections;

  const allOptions = matches.flatMap(match =>
    match.plays.map(play => ({
      matchId: match.matchId,
      playType: play.type,
      option: play.option,
      odds: play.odds
    }))
  );

  const validCombos = [];
  comboTypes.forEach(n => {
    const combos = generateCombinations(allOptions, n);
    combos.forEach(combo => {
      const matchIds = new Set();
      const isValid = combo.every(opt =>
        !matchIds.has(opt.matchId) && matchIds.add(opt.matchId)
      );
      if (isValid) validCombos.push(combo);
    });
  });

  const possibleResults = matches.map(match =>
    match.plays.map(play => ({
      matchId: match.matchId,
      result: play.option
    }))
  );

  const resultCombinations = cartesianProduct(possibleResults);

  const getLimit = (n) => {
    if (n === 1) return 100000;
    if (n >= 2 && n <= 3) return 200000;
    if (n >= 4 && n <= 5) return 500000;
    return 1000000;
  };

  let maxPayout = 0;
  let minPayout = Infinity;
  const baseAmount = betAmount * 2;

  resultCombinations.forEach(resultCombo => {
    const resultMap = new Map();
    resultCombo.forEach(r => resultMap.set(r.matchId, r.result));

    const winningCombos = validCombos.filter(combo =>
      combo.every(opt => resultMap.get(opt.matchId) === opt.option)
    );

    let total = 0;
    winningCombos.forEach(combo => {
      const product = combo.reduce((acc, opt) => acc * opt.odds, 1);
      const rawPayout = product * baseAmount;
      const n = combo.length;
      const limit = getLimit(n);
      total += Math.min(rawPayout, limit);
    });

    if (total > maxPayout) maxPayout = total;
    if (total < minPayout) minPayout = total;
  });

  if (minPayout === Infinity) minPayout = 0;

  return {
    totalStake: validCombos.length * baseAmount,
    minPayout: minPayout,
    maxPayout: maxPayout
  };
}