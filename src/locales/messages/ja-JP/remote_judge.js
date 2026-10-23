return {
  atcoder_source_pending: "ソースコードを取得待ちです。取得後に自動表示されます。",
  atcoder_source_failed: "ソースコードを取得できませんでした。成績を保持し、自動的に再試行します。",
  atcoder_source_available: "ソースコードを取得しました。各テストの詳細は元サイトをご確認ください。",

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
  sync_verification_required:
    "元サイトで人間による確認が必要です。本人のリクエストを一時停止しています。AtCoderでログインと確認状態を確認してください。",
  sync_shared_cooldown: "本人のAtCoderセッションの待機時間中です。自動で再開し、取得済み結果は保持します。",
  sync_access_denied:
    "元サイトがサーバーからのアクセスを拒否しました（HTTP 403）。アクセス保護または IP 制限の可能性があります。自動で再試行し、取得済みの結果は保持します。",
  sync_rate_limited: "元サイトのレート制限により同期を待機しています。自動で再試行し、取得済みの結果は保持します。",
  sync_api_failed:
    "元サイトの API から提出結果を読み取れませんでした。管理者はサーバーからのアクセスを確認してください。自動で再試行します。",
  sync_error_code: "エラーコード：{code}",
  next_retry: "次回の再試行：{time}",
  atcoder_session_expired:
    "本人のAtCoderセッションが未設定・失効・読取不可です。下で再保存してください。取得済み結果は保持します。",
  accounts: "Remote accounts",
  own_account_only: "You can only manage your own remote accounts.",
  importing_history: "Importing historical submissions for problems on NSOJ.",
  unbind: "Unlink",
  confirm_unbind: "Unlink and keep existing results",
  handle: "Username",
  get_code: "Get verification code",
  copy_code: "コピー",
  code_copied: "認証コードをコピーしました。",
  code_copy_failed: "コピーできませんでした。認証コードを手動でコピーしてください。",
  verification_help:
    "Temporarily set your profile’s {field} to this code, save, and verify here. The code expires in 15 minutes. You can restore the field after verification.",
  open_profile_settings: "Open profile settings",
  verify: "Verify and link",
  restart_binding: "Start again",
  account_help:
    "Codeforcesはプロフィールの確認コードで、AtCoderは本人のセッションを保存して連携します。各原サイトのアカウントは1人のNSOJユーザーのみと連携できます。利用中に結果を追跡し、オフラインで未処理の作業がなければ停止します。",
  files_disabled: "Remote problems do not support test data or additional files.",
  source_record: "Original submission",
  details_unavailable:
    "This submission was judged on the original website. Source code and testcase details are unavailable here.",
  raw_points: "Original score: {points}",
  passed_tests: "通過したテスト数：{count}",
  test_stage: "テスト段階：{stage}",
  testset: { SAMPLES: "サンプル", PRETESTS: "プレテスト", TESTS: "システムテスト", CHALLENGES: "チャレンジ" },
  test_details_unavailable: "CF API は各テストの詳細を提供しません。元サイトの提出をご確認ください。",
  cf_source_optional:
    "任意：本人の Codeforces API キーを設定するとソースコードも同期します。成績とテスト概要はキーなしでも同期します。",
  cf_source_enabled: "ソース同期キーを保存しました。コードと過去の提出を自動取得します。",
  cf_source_failed:
    "ソースを取得できません。キーが有効で連携したアカウントのものか確認してください。自動再試行し、成績の同期は継続します。",
  cf_api_settings: "Codeforces で API キーを生成",
  cf_source_missing:
    "CF から提出一覧を取得しましたが、ソースを読み取れませんでした。キーが無効とは限りません。自動再試行し、成績の同期は継続します。",
  cf_source_response_invalid:
    "CF のソース形式を読み取れないか、サイズ制限を超えています。自動再試行し、成績の同期は継続します。",
  cf_credentials_help:
    "連携したアカウントの API Key と Secret を入力してください。パスワードや Cookie は不要です。暗号化して保存し再表示しません。変更には両方の入力が必要です。削除すると以後のコード同期を停止し、取得済みのコードは保持します。",
  cf_credentials_save: "ソース同期キーを保存",
  cf_credentials_clear: "キーを削除",
  cf_credentials_save_failed: "保存できませんでした。後でもう一度お試しください。",
  atcoder_personal_missing: "本人のAtCoderセッションが未設定のため、同期を停止しています。",
  atcoder_personal_configured: "本人のセッションを保存しました。確認済み提出は状態取得エンドポイントで更新します。",
  atcoder_personal_help:
    "連携済みAtCoderアカウント {handle} にログインし、開発者ツール → Application → Cookies → https://atcoder.jp からREVEL_SESSIONの値をコピーしてください。保存時にアカウントを確認し、暗号化して保存します。値は再表示しません。削除後は本人の同期を停止し、取得済み結果を保持します。",
  atcoder_personal_save: "本人のセッションを確認して保存",
  atcoder_personal_clear: "本人のセッションを削除",
  atcoder_open_login: "AtCoderにログイン",
  atcoder_session_save_failed: "セッションを保存できませんでした。後で再試行してください。",
  atcoder_connect_intro: "本人のセッションを入力すると、AtCoderアカウントを自動で識別して連携します。",
  atcoder_connect_help:
    "連携したいAtCoderアカウントにログインし、開発者ツール → Application → Cookies → https://atcoder.jp からREVEL_SESSIONの値をコピーしてください。保存時にアカウントを識別して連携します。セッションは暗号化して保存し、再表示しません。",
  atcoder_connect: "確認してアカウントを連携",
  error: {
    ATCODER_SESSION_REQUIRED: "本人のREVEL_SESSIONを入力すると、AtCoderアカウントを自動で識別して連携します。",
    INVALID_ATCODER_SESSION: "有効なREVEL_SESSIONの値を入力してください。",
    REMOTE_SESSION_IDENTITY_MISMATCH:
      "別のAtCoderアカウントのセッションです。変更する場合は先に現在の連携を解除してください。取得済み結果は保持します。",
    REMOTE_ATCODER_STATUS_FAILED: "状態取得の応答を解析できません。取得済み結果を保持して再試行します。",

    REMOTE_VERIFICATION_REQUIRED:
      "元サイトで人間による確認が必要です。本人のリクエストを一時停止しています。AtCoderでログインと確認状態を確認してください。",
    REMOTE_COOLDOWN: "本人のAtCoderセッションの待機時間中です。自動で再開し、取得済み結果は保持します。",
    INVALID_CF_CREDENTIALS: "有効な API Key と Secret を入力してください。",
    CF_ACCOUNT_REQUIRED: "先に Codeforces アカウントを連携してください。",
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
