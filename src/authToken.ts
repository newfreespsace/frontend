export const AUTH_TOKEN_STORAGE_KEY = "nsoj-auth-token";

export function getAuthToken(): string {
  try {
    const storedToken = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    if (storedToken !== null) return storedToken;

    // Keep existing logins when upgrading from the token persisted in appState.
    const legacyState = JSON.parse(localStorage.getItem("appState") || "{}");
    const token = !legacyState?.logout && typeof legacyState?.token === "string" ? legacyState.token : "";
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    if (legacyState && typeof legacyState === "object") {
      delete legacyState.token;
      delete legacyState.logout;
      localStorage.setItem("appState", JSON.stringify(legacyState));
    }
    return token;
  } catch {
    return "";
  }
}

export function storeAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token || "");
}
