const CELEBRATION_STORAGE_KEY_PREFIX = "lyrio:submission-celebration:";

function getStorageKey(submissionId: number) {
  return CELEBRATION_STORAGE_KEY_PREFIX + submissionId;
}

export function markSubmissionForCelebration(submissionId: number) {
  try {
    window.sessionStorage.setItem(getStorageKey(submissionId), "1");
  } catch (error) {
    console.warn("Failed to remember the submission celebration", error);
  }
}

export function consumeSubmissionCelebration(submissionId: number) {
  try {
    const storageKey = getStorageKey(submissionId);
    const shouldCelebrate = window.sessionStorage.getItem(storageKey) === "1";
    window.sessionStorage.removeItem(storageKey);
    return shouldCelebrate;
  } catch (error) {
    console.warn("Failed to consume the submission celebration", error);
    return false;
  }
}
