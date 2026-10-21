return {
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
    "元サイトがサーバーからのアクセスを拒否しました（HTTP 403）。アクセス保護または IP 制限の可能性があります。自動で再試行し、取得済みの結果は保持します。",
  sync_rate_limited: "元サイトのレート制限により同期を待機しています。自動で再試行し、取得済みの結果は保持します。",
  sync_api_failed:
    "元サイトの API から提出結果を読み取れませんでした。管理者はサーバーからのアクセスを確認してください。自動で再試行します。",
  sync_error_code: "エラーコード：{code}",
  next_retry: "次回の再試行：{time}",
  atcoder_session_expired:
    "AtCoder の同期セッションが無効または利用できません。管理者による再設定が必要です。取得済みの結果は保持します。",
  update_atcoder_session: "サイト設定でセッションを更新",
  accounts: "Remote accounts",
  own_account_only: "You can only manage your own remote accounts.",
  importing_history: "Importing historical submissions for problems on NSOJ.",
  unbind: "Unlink",
  confirm_unbind: "Unlink and keep existing results",
  handle: "Username",
  get_code: "Get verification code",
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
  error: {
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
      "元サイトがサーバーからのアクセスを拒否しました（HTTP 403）。管理者はアクセス保護または IP 制限を確認してください。",
    REMOTE_RATE_LIMITED: "The remote service is unavailable. Please try again later.",
    REMOTE_API_FAILED: "The remote service is unavailable. Please try again later.",
    NO_SUCH_PROBLEM: "Problem not found.",
    REMOTE_SYNC_FAILED: "The remote service is unavailable. Please try again later."
  }
};
