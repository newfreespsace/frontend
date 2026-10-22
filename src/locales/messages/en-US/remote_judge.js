return {
  atcoder_source_pending: "Source code is queued and will appear automatically when fetched.",
  atcoder_source_failed:
    "Source code could not be fetched. Automatic retries will continue; the synced result is preserved.",
  atcoder_source_available: "Source code has been fetched. Visit AtCoder for testcase details.",

  back_to_problem: "Back to problem",
  submittable: "Allow submissions",
  submission_method: "Submission method",
  method: {
    Local: "Local judge",
    Codeforces: "Codeforces",
    AtCoder: "AtCoder"
  },
  problem_url: "Original problem URL",
  full_score: "Original maximum score (optional, for partial scores)",
  source_help:
    "Submit on the original website; results sync automatically. Test data and additional files are disabled. Leave the maximum score empty for standard pass/fail tasks.",
  save: "Save submission method",
  remote_submission: "{platform} submissions",
  submission_help:
    "Submit on the original website. NSOJ syncs results automatically. AtCoder results may take longer to appear.",
  bound_as: "Linked account: {handle}",
  submit_on_platform: "Submit on {platform}",
  bind_account: "Link a remote account",
  login_first: "Sign in and link your remote account to sync results.",
  sync_paused: "Remote result sync has been paused by an administrator.",
  last_synced: "Last synced: {time}",
  sync_delayed: "Sync is delayed and will retry automatically. Existing results are retained.",
  sync_access_denied:
    "The original site denied server access (HTTP 403), possibly due to access protection or IP restrictions. Sync will retry automatically; existing results are retained.",
  sync_rate_limited:
    "The original site is rate limiting requests. Sync will retry automatically; existing results are retained.",
  sync_api_failed:
    "The original API did not return readable submission results. An administrator should check server access. Sync will retry automatically.",
  sync_error_code: "Error code: {code}",
  next_retry: "Next retry: {time}",
  atcoder_session_expired:
    "The AtCoder sync session has expired or is unavailable. An administrator must update it. Existing results are retained.",
  update_atcoder_session: "Update the session in Site Settings",
  accounts: "Remote accounts",
  own_account_only: "You can only manage your own remote accounts.",
  importing_history: "Importing historical submissions for problems on NSOJ.",
  unbind: "Unlink",
  confirm_unbind: "Unlink and keep existing results",
  handle: "Username",
  get_code: "Get verification code",
  copy_code: "Copy",
  code_copied: "Verification code copied.",
  code_copy_failed: "Copy failed. Please copy the verification code manually.",
  verification_help:
    "Temporarily set your profile’s {field} to this code, save, and verify here. The code expires in 15 minutes. You can restore the field after verification.",
  open_profile_settings: "Open profile settings",
  verify: "Verify and link",
  restart_binding: "Start again",
  account_help:
    "Verify ownership before linking. Each remote account can be linked to one NSOJ user. Results sync while you are active and catch up when you return. Idle accounts without pending work are not polled.",
  files_disabled: "Remote problems do not support test data or additional files.",
  source_record: "Original submission",
  details_unavailable:
    "This submission was judged on the original website. Source code and testcase details are unavailable here.",
  raw_points: "Original score: {points}",
  passed_tests: "Passed tests: {count}",
  test_stage: "Test stage: {stage}",
  testset: { SAMPLES: "Samples", PRETESTS: "Pretests", TESTS: "System tests", CHALLENGES: "Challenges" },
  test_details_unavailable:
    "The CF API does not provide individual test details. View the original submission for more information.",
  cf_source_optional:
    "Optional: add your own Codeforces API credentials to sync source code. Results and test summaries sync without credentials.",
  cf_source_enabled: "Source sync credentials are saved. Source code will be fetched and backfilled automatically.",
  cf_source_failed:
    "Source code is unavailable. Check that the credentials are valid and belong to the linked account. Automatic retries continue; result sync remains active.",
  cf_api_settings: "Generate API credentials on Codeforces",
  cf_source_missing:
    "CF returned submissions without readable source code. This does not establish that the credentials are invalid. Automatic retries continue; result sync remains active.",
  cf_source_response_invalid:
    "The source returned by CF could not be decoded or exceeds the size limit. Automatic retries continue; result sync remains active.",
  cf_credentials_help:
    "Use the linked account's API Key and Secret; no password or Cookie is needed. Credentials are encrypted and never displayed. Enter both fields to replace them. Clearing credentials stops future source sync and retains existing code.",
  cf_credentials_save: "Save source sync credentials",
  cf_credentials_clear: "Clear credentials",
  cf_credentials_save_failed: "Save failed. Please try again later.",
  error: {
    INVALID_CF_CREDENTIALS: "Enter a valid API Key and Secret.",
    CF_ACCOUNT_REQUIRED: "Link a Codeforces account first.",
    INVALID_HANDLE: "Invalid username.",
    INVALID_REMOTE_URL: "Enter a supported HTTPS problem URL.",
    REMOTE_SUBMIT_ANSWER_UNSUPPORTED: "Answer-only problems cannot use this remote method.",
    REMOVE_FILES_FIRST: "Remove test data and additional files before switching.",
    PENDING_SUBMISSIONS: "Wait for pending submissions to finish before switching.",
    VERIFICATION_EXPIRED: "Verification expired. Request a new code.",
    VERIFICATION_MISMATCH: "The verification code was not found in the profile.",
    ACCOUNT_ALREADY_BOUND: "This remote account is already linked.",
    UNBIND_FIRST: "Unlink the current account first.",
    BIND_COOLDOWN: "Please wait before trying again.",
    REMOTE_UNAVAILABLE: "The remote service is unavailable. Please try again later.",
    REMOTE_ACCESS_DENIED:
      "The original site denied server access (HTTP 403). An administrator should check access protection or IP restrictions.",
    REMOTE_RATE_LIMITED: "The remote service is unavailable. Please try again later.",
    REMOTE_API_FAILED: "The remote service is unavailable. Please try again later.",
    NO_SUCH_PROBLEM: "Problem not found.",
    REMOTE_SYNC_FAILED: "The remote service is unavailable. Please try again later."
  }
};
