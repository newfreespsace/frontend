return {
  title: "Site Settings",
  header: "Site Settings",
  allow_register: "Allow new user registration",
  other_submission_code_min_accepted_problems: "他のユーザーのコード閲覧に必要な最少正解問題数",
  other_submission_code_min_accepted_problems_hint:
    "この問題数に達すると、他のユーザーの公開提出と、アクセス可能な終了済みコンテストの開催中・終了後の提出を閲覧できます。0 にするとすべてのログインユーザーが閲覧できます。",
  other_submission_code_min_accepted_problems_invalid: "0 以上の整数を入力してください。",
  save: "Save",
  success: "Site settings saved.",
  atcoder_sync: "AtCoder の提出結果同期",
  atcoder_session: "専用アカウントのセッション（REVEL_SESSION）",
  atcoder_session_help:
    "専用アカウントで AtCoder にログインし、開発者ツールの Application → Cookies → https://atcoder.jp から REVEL_SESSION の Value をコピーして貼り付けてください。",
  atcoder_session_keep:
    "空欄の場合は現在のセッションを保持します。保存後は再起動不要で反映されます。削除すると AtCoder の同期を停止し、取得済みの結果は保持します。",
  atcoder_session_configured: "セッションを保存しました。次回の AtCoder へのアクセス時に有効性を確認します。",
  atcoder_session_environment: "環境変数で設定済みです。ここで保存したセッションが優先されます。",
  atcoder_session_missing:
    "AtCoder の結果同期は停止中です。専用アカウントのセッションを設定して原サイトからの同期を有効にしてください。",
  atcoder_session_save: "セッションを保存",
  atcoder_session_clear: "セッションを削除",
  atcoder_session_saved: "AtCoder の同期設定を保存しました。",
  atcoder_session_expired:
    "AtCoder 同期セッションの有効期限が切れました。専用アカウントで再ログインし、下の REVEL_SESSION を更新してください。取得済みの結果は保持します。",
  atcoder_session_unreadable:
    "AtCoder の同期セッションを読み取れません。下で再設定してください。取得済みの結果は保持します。",
  atcoder_session_unavailable:
    "直近の AtCoder へのアクセスに失敗しました。接続障害、アクセス制限、追加認証などの可能性があり、セッションの有効性は確認できません。",
  atcoder_session_valid: "直近の AtCoder へのアクセスに成功しました。セッションは有効です。",
  atcoder_session_checked_at: "最終確認：{time}",
  atcoder_session_login: "AtCoder に再ログイン",
  errors: {
    PERMISSION_DENIED: "Permission denied."
  }
};
