// PBEL City is temporarily closed. The API has no branch field on batches, so its
// teacher record is matched by name. Used by the public pages only; on reopening,
// remove this file and its callers.
export const isClosedBranch = (teacherName?: string) => /\bpbel\b/i.test(teacherName ?? '');
