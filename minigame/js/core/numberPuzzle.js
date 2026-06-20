"use strict";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

const DIFFICULTIES = {
  easy: {
    key: "easy",
    label: "简单",
    digitLength: 4,
    clueCount: 4,
    staminaCost: 5,
    rewardGold: 10,
    revealCost: 30,
    description: "四位数字，数字可以重复，四条线索叠加可推出唯一答案。",
  },
  hard: {
    key: "hard",
    label: "困难",
    digitLength: 5,
    clueCount: 5,
    staminaCost: 8,
    rewardGold: 18,
    revealCost: 45,
    description: "五位数字，数字可以重复，五条线索叠加可推出唯一答案。",
  },
};

const codeCache = new Map();

function createSolvedPuzzle(difficulty, seed = "") {
  const rng = seed ? createSeededRandom(seed) : Math.random;
  const secret = createSecret(difficulty.digitLength, rng);
  const clues = difficulty.key === "hard" ? createHardClues(secret, rng) : createEasyClues(secret, rng);
  return {
    secret,
    clues,
    guaranteedUnique: countPuzzleSolutions(difficulty.digitLength, clues, 2) === 1,
  };
}

function createSecret(length, rng = Math.random) {
  const chars = [];
  for (let index = 0; index < length; index += 1) {
    chars.push(DIGITS[Math.floor(rng() * DIGITS.length)]);
  }
  if (length > 1 && new Set(chars).size === chars.length && rng() < 0.55) {
    const from = Math.floor(rng() * length);
    let to = Math.floor(rng() * length);
    if (to === from) to = (to + 1) % length;
    chars[to] = chars[from];
  }
  return chars.join("");
}

function compareDigits(secret, guess) {
  if (secret.length !== guess.length) throw new Error("secret and guess length mismatch");
  let exact = 0;
  let misplaced = 0;
  const balance = Array(10).fill(0);
  for (let index = 0; index < secret.length; index += 1) {
    const secretDigit = Number(secret[index]);
    const guessDigit = Number(guess[index]);
    if (secretDigit === guessDigit) {
      exact += 1;
      continue;
    }
    if (balance[guessDigit] > 0) misplaced += 1;
    if (balance[secretDigit] < 0) misplaced += 1;
    balance[secretDigit] += 1;
    balance[guessDigit] -= 1;
  }
  return { exact, misplaced };
}

function toChineseHint(result, length) {
  const total = result.exact + result.misplaced;
  if (result.exact === length) return "所有数字和位置都正确";
  if (total === 0) return "没有任何数字正确";
  if (result.exact > 0 && result.misplaced > 0) {
    return `有 ${cn(result.exact)} 个数字位置正确，另有 ${cn(result.misplaced)} 个数字正确但位置不对`;
  }
  if (result.exact > 0) return `有 ${cn(result.exact)} 个数字和位置都正确`;
  return `有 ${cn(result.misplaced)} 个数字正确，但位置都不对`;
}

function toCountHint(result) {
  return `数字正确 ${result.exact + result.misplaced} 个，位置正确 ${result.exact} 个。`;
}

function isValidGuess(input, length) {
  const joined = input.join("");
  return joined.length === length && input.every((value) => /^\d$/.test(value));
}

function randomUnrevealedIndex(locked) {
  const indexes = locked.map((isLocked, index) => (isLocked ? -1 : index)).filter((index) => index >= 0);
  if (indexes.length === 0) return -1;
  return indexes[Math.floor(Math.random() * indexes.length)];
}

function createSeededRandom(seed) {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }
  if (state === 0) state = 1;
  return () => {
    state = Math.imul(state, 1664525) + 1013904223;
    return (state >>> 0) / 4294967296;
  };
}

function countPuzzleSolutions(length, clues, limit = 2) {
  let matches = 0;
  for (const candidate of getAllCodes(length)) {
    if (!clues.every((clue) => matchesClue(candidate, clue))) continue;
    matches += 1;
    if (matches >= limit) return matches;
  }
  return matches;
}

function createEasyClues(secret, rng) {
  const seen = new Set([secret]);
  const clues = [createRandomClue(secret, rng, seen), createRandomClue(secret, rng, seen)];
  for (const clue of clues) seen.add(clue.guess);
  clues.push(createRelationClue(secret, rng, seen, [
    { kind: "sum", indexes: [0, 1], value: digitAt(secret, 0) + digitAt(secret, 1) },
    { kind: "sum", indexes: [2, 3], value: digitAt(secret, 2) + digitAt(secret, 3) },
  ], `前两位之和为 ${digitAt(secret, 0) + digitAt(secret, 1)}，后两位之和为 ${digitAt(secret, 2) + digitAt(secret, 3)}`));
  clues.push(createRelationClue(secret, rng, seen, [
    { kind: "diff", left: 0, right: 1, value: digitAt(secret, 0) - digitAt(secret, 1) },
    { kind: "diff", left: 2, right: 3, value: digitAt(secret, 2) - digitAt(secret, 3) },
  ], `${diffText(0, 1, digitAt(secret, 0) - digitAt(secret, 1))}，${diffText(2, 3, digitAt(secret, 2) - digitAt(secret, 3))}`));
  return clues;
}

function createHardClues(secret, rng) {
  const seen = new Set([secret]);
  const clues = [
    createRandomClue(secret, rng, seen),
    createRandomClue(secret, rng, seen),
    createRandomClue(secret, rng, seen),
  ];
  for (const clue of clues) seen.add(clue.guess);
  clues.push(createRelationClue(secret, rng, seen, [
    { kind: "sum", indexes: [0, 1], value: digitAt(secret, 0) + digitAt(secret, 1) },
    { kind: "sum", indexes: [2, 3], value: digitAt(secret, 2) + digitAt(secret, 3) },
  ], `第 1、2 位之和为 ${digitAt(secret, 0) + digitAt(secret, 1)}，第 3、4 位之和为 ${digitAt(secret, 2) + digitAt(secret, 3)}`));
  const total = secret.split("").reduce((sum, digit) => sum + Number(digit), 0);
  clues.push(createRelationClue(secret, rng, seen, [
    { kind: "diff", left: 0, right: 1, value: digitAt(secret, 0) - digitAt(secret, 1) },
    { kind: "diff", left: 2, right: 3, value: digitAt(secret, 2) - digitAt(secret, 3) },
    { kind: "total", value: total },
  ], `${diffText(0, 1, digitAt(secret, 0) - digitAt(secret, 1))}，${diffText(2, 3, digitAt(secret, 2) - digitAt(secret, 3))}，五位数字总和为 ${total}`));
  return clues;
}

function createRelationClue(secret, rng, seen, constraints, relationText) {
  const clue = createRandomClue(secret, rng, seen);
  seen.add(clue.guess);
  return { ...clue, constraints, text: `${clue.text}；${relationText}` };
}

function createRandomClue(secret, rng, seen) {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const guess = createSecret(secret.length, rng);
    if (seen.has(guess) || guess === secret) continue;
    const clue = createClue(secret, guess);
    if (clue.result.exact >= secret.length - 1) continue;
    return clue;
  }
  let guess = createSecret(secret.length, rng);
  while (seen.has(guess) || guess === secret) guess = createSecret(secret.length, rng);
  return createClue(secret, guess);
}

function createClue(secret, guess) {
  const result = compareDigits(secret, guess);
  return { guess, result, text: toChineseHint(result, secret.length) };
}

function matchesClue(candidate, clue) {
  const result = compareDigits(candidate, clue.guess);
  if (result.exact !== clue.result.exact || result.misplaced !== clue.result.misplaced) return false;
  return (clue.constraints || []).every((constraint) => matchesConstraint(candidate, constraint));
}

function matchesConstraint(candidate, constraint) {
  if (constraint.kind === "sum") {
    return constraint.indexes.reduce((sum, index) => sum + digitAt(candidate, index), 0) === constraint.value;
  }
  if (constraint.kind === "diff") {
    return digitAt(candidate, constraint.left) - digitAt(candidate, constraint.right) === constraint.value;
  }
  return candidate.split("").reduce((sum, digit) => sum + Number(digit), 0) === constraint.value;
}

function getAllCodes(length) {
  const cached = codeCache.get(length);
  if (cached) return cached;
  const total = 10 ** length;
  const codes = [];
  for (let value = 0; value < total; value += 1) codes.push(String(value).padStart(length, "0"));
  codeCache.set(length, codes);
  return codes;
}

function digitAt(secret, index) {
  return Number(secret[index]);
}

function diffText(left, right, diff) {
  if (diff === 0) return `第 ${left + 1} 位和第 ${right + 1} 位相同`;
  if (diff > 0) return `第 ${left + 1} 位比第 ${right + 1} 位大 ${diff}`;
  return `第 ${left + 1} 位比第 ${right + 1} 位小 ${Math.abs(diff)}`;
}

function cn(value) {
  return ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"][value] || String(value);
}

module.exports = {
  DIGITS,
  DIFFICULTIES,
  compareDigits,
  countPuzzleSolutions,
  createSeededRandom,
  createSolvedPuzzle,
  createSecret,
  isValidGuess,
  randomUnrevealedIndex,
  toChineseHint,
  toCountHint,
};
