/** Run fn on each item with at most `limit` concurrent calls. */
export async function mapConcurrent<T, R>(
  arr: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(arr.length);
  let i = 0;
  async function worker() {
    while (i < arr.length) {
      const idx = i++;
      results[idx] = await fn(arr[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, arr.length) }, worker));
  return results;
}
