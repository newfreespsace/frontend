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

export async function fireAcceptedSubmissionConfetti() {
  const { default: confetti } = await import("canvas-confetti");
  const commonOptions = {
    disableForReducedMotion: true,
    zIndex: 2000,
    ticks: 220,
    gravity: 0.9,
    scalar: 1.05
  };

  confetti({
    ...commonOptions,
    particleCount: 90,
    angle: 60,
    spread: 75,
    startVelocity: 48,
    origin: { x: 0, y: 0.72 }
  });
  confetti({
    ...commonOptions,
    particleCount: 90,
    angle: 120,
    spread: 75,
    startVelocity: 48,
    origin: { x: 1, y: 0.72 }
  });

  window.setTimeout(() => {
    confetti({
      ...commonOptions,
      particleCount: 70,
      spread: 110,
      startVelocity: 38,
      origin: { x: 0.5, y: 0.55 }
    });
  }, 180);
}
