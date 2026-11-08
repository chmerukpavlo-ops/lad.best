/**
 * Interpret optimistic-lock update result after `.eq('version', expected)`.
 * Pure helper for actions + spot tests.
 */
export function resolveOptimisticUpdate(args: {
  updated: { id: string } | null;
  current: { id: string; version: number } | null;
}): "ok" | "conflict" | "not_found" {
  if (args.updated) {
    return "ok";
  }
  if (!args.current) {
    return "not_found";
  }
  return "conflict";
}
