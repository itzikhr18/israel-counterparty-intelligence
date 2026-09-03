const COMPANY_SUFFIXES = new Set([
  "בעמ",
  "חברה",
  "מוגבלת",
  "ltd",
  "limited",
  "inc",
  "incorporated",
  "llc",
  "company",
  "co",
  "חלצ",
  "cc",
]);

export function normalizeCompanyNumber(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  return /^\d{9}$/.test(digits) ? digits : null;
}

export function normalizeName(input: string): string {
  return input
    .normalize("NFKC")
    .toLocaleLowerCase("he")
    .replace(/בע[״׳"'`~]?מ/g, "בעמ")
    .replace(/חל[״׳"'`~]?צ/g, "חלצ")
    .replace(/[״׳"'`~.,()\[\]{}\-_/\\]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !COMPANY_SUFFIXES.has(token))
    .join(" ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        (current[j - 1] ?? 0) + 1,
        (previous[j] ?? 0) + 1,
        (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length] ?? Math.max(a.length, b.length);
}

export function nameSimilarity(query: string, candidate: string): number {
  const left = normalizeName(query);
  const right = normalizeName(candidate);
  if (!left || !right) return 0;
  if (left === right) return 1;

  const distanceRatio =
    1 - levenshtein(left, right) / Math.max(left.length, right.length);
  const leftTokens = new Set(left.split(" "));
  const rightTokens = new Set(right.split(" "));
  const intersection = [...leftTokens].filter((token) =>
    rightTokens.has(token),
  ).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  const tokenScore = union ? intersection / union : 0;

  return Math.max(0, Math.min(1, distanceRatio * 0.65 + tokenScore * 0.35));
}
