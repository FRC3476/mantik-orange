export const MAX_LIVE_MONACO = 3;

/**
 * Choose which example editors may mount Monaco.
 * Prefer currently visible editors that need one, then keep recently live editors
 * until the cap is needed for someone else.
 */
export function pickLiveEditors(
  idsNeedingEditor: string[],
  intersectingIds: string[],
  previousLive: string[],
  max = MAX_LIVE_MONACO,
): string[] {
  const need = new Set(idsNeedingEditor);
  const picked: string[] = [];

  for (const id of intersectingIds) {
    if (picked.length >= max) break;
    if (need.has(id) && !picked.includes(id)) picked.push(id);
  }

  for (const id of previousLive) {
    if (picked.length >= max) break;
    if (need.has(id) && !picked.includes(id)) picked.push(id);
  }

  return picked;
}
