/** تقسيم الطلاب إلى مجموعات عشوائية متوازنة الحجم. */
export function shuffle<T>(arr: T[], rand: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** by='size': كل مجموعة بهذا الحجم تقريباً؛ by='count': هذا العدد من المجموعات. الفرق بين أكبر وأصغر مجموعة لا يتجاوز ١. */
export function makeGroups<T>(items: T[], n: number, by: 'size' | 'count', rand: () => number = Math.random): T[][] {
  if (!items.length || n < 1) return [];
  const count = by === 'count' ? Math.min(n, items.length) : Math.max(1, Math.round(items.length / n));
  const mixed = shuffle(items, rand);
  const groups: T[][] = Array.from({ length: count }, () => []);
  mixed.forEach((x, i) => groups[i % count].push(x));
  return groups;
}
