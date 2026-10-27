export const PUSH_PROMPT_STORAGE_PREFIX = "nsoj-push-prompt:";
export const PUSH_PROMPT_CHANGED_EVENT = "nsoj-push-prompt-changed";
export const PUSH_PROMPT_DELAY_MS = 24 * 60 * 60 * 1000;

export type PushPromptChoice = "allowed" | "denied" | "later";
interface PushPromptPreference {
  choice: PushPromptChoice;
  remindAfter?: number;
}

// Also remember the choice for this page if persistent storage is unavailable.
const fallback = new Map<number, PushPromptPreference>();

export function readPushPromptPreference(userId: number): PushPromptPreference | null {
  try {
    const stored = JSON.parse(localStorage.getItem(PUSH_PROMPT_STORAGE_PREFIX + userId) || "null");
    if (stored?.choice === "allowed" || stored?.choice === "denied") return { choice: stored.choice };
    if (stored?.choice === "later" && Number.isFinite(stored.remindAfter) && stored.remindAfter >= 0)
      return { choice: "later", remindAfter: stored.remindAfter };
    return null;
  } catch {
    return fallback.get(userId) || null;
  }
}

export function shouldOfferBrowserPush(userId: number, now = Date.now()): boolean {
  const preference = readPushPromptPreference(userId);
  return !preference || (preference.choice === "later" && now >= preference.remindAfter);
}

export function rememberPushPromptChoice(userId: number, choice: PushPromptChoice, now = Date.now()): void {
  const preference: PushPromptPreference = {
    choice,
    ...(choice === "later" ? { remindAfter: now + PUSH_PROMPT_DELAY_MS } : {})
  };
  fallback.set(userId, preference);
  try {
    localStorage.setItem(PUSH_PROMPT_STORAGE_PREFIX + userId, JSON.stringify(preference));
  } catch {
    // The in-memory choice still prevents repeated prompts during this visit.
  }
  window.dispatchEvent(new Event(PUSH_PROMPT_CHANGED_EVENT));
}
