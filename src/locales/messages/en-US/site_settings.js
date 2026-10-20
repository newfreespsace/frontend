return {
  title: "Site Settings",
  header: "Site Settings",
  allow_register: "Allow new user registration",
  other_submission_code_min_accepted_problems: "Minimum solved problems to view others' code",
  other_submission_code_min_accepted_problems_hint:
    "Users who reach this count can view others' public submissions and official or post-contest submissions in ended contests they can access. Set to 0 to allow all signed-in users.",
  other_submission_code_min_accepted_problems_invalid: "Enter a non-negative integer.",
  hide_submission_testcase_details_for_normal_users: "Hide testcase details from normal users",
  save: "Save",
  success: "Site settings saved.",
  atcoder_sync: "AtCoder result sync",
  atcoder_session: "Dedicated account session (REVEL_SESSION)",
  atcoder_session_help:
    "Sign in to AtCoder with a dedicated account. In browser developer tools, open Application → Cookies → https://atcoder.jp and paste the REVEL_SESSION Value here.",
  atcoder_session_keep:
    "Leave blank to keep the current session. Changes apply without restarting the backend. Clearing pauses AtCoder result sync and retains existing results.",
  atcoder_session_configured: "Session saved. Its validity will be checked during the next request to AtCoder.",
  atcoder_session_environment: "A session is configured through the environment. A session saved here takes priority.",
  atcoder_session_missing:
    "AtCoder result sync is paused. Configure a dedicated account session to read results from AtCoder.",
  atcoder_session_save: "Save session",
  atcoder_session_clear: "Clear session",
  atcoder_session_saved: "AtCoder sync settings saved.",
  atcoder_session_expired:
    "The AtCoder sync session has expired. Sign in with the dedicated account and update REVEL_SESSION below. Existing results are retained.",
  atcoder_session_unreadable:
    "The AtCoder sync session cannot be read. Configure it again below. Existing results are retained.",
  atcoder_session_unavailable:
    "The latest AtCoder request failed. The site may be unavailable, rate-limiting requests or requiring verification. Session validity could not be confirmed.",
  atcoder_session_valid: "The latest AtCoder request succeeded. The session is valid.",
  atcoder_session_checked_at: "Last checked: {time}",
  atcoder_session_login: "Sign in to AtCoder again",
  errors: {
    PERMISSION_DENIED: "Permission denied."
  }
};
