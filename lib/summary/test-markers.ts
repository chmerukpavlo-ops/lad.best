/** Gate test fixtures marked in titles/notes — exclude from live summaries. */
const TEST_RE = /\[TEST\b/i;

export function hasTestMarker(text: string | null | undefined): boolean {
  return typeof text === "string" && TEST_RE.test(text);
}

export type TestDataInventory = {
  listingIds: string[];
  adPaymentIds: string[];
  saleIds: string[];
};

export function collectTestListingIds(
  listings: readonly { id: string; title: string; notes?: string | null }[],
): Set<string> {
  const ids = new Set<string>();
  for (const row of listings) {
    if (hasTestMarker(row.title) || hasTestMarker(row.notes)) {
      ids.add(row.id);
    }
  }
  return ids;
}
