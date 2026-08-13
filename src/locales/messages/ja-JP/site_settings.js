return {
  title: "Site Settings",
  header: "Site Settings",
  allow_register: "Allow new user registration",
  save: "Save",
  success: "Site settings saved.",
  point_recalculation: {
    title: "トレーニングポイントの全再計算",
    description: "現在のトレーニングプランと過去の AC から全ユーザーのポイントを再計算します。",
    preview: "再計算をプレビュー",
    execute: "再計算を実行",
    mode_preview: "プレビュー",
    mode_execute: "実行",
    confirm: "全ユーザーのポイントを現在のルールで上書きします。実行しますか？",
    started_at: "開始時刻",
    finished_at: "終了時刻",
    validation: "整合性チェック",
    validation_passed: "合格",
    validation_failed: "不合格",
    affected_users: "対象ユーザー",
    records: "ポイント記録",
    changes: "追加 / 更新 / 削除",
    total_points: "合計ポイント",
    status: {
      PENDING: "待機中",
      RUNNING: "実行中",
      SUCCEEDED: "完了",
      FAILED: "失敗"
    },
    errors: {
      PERMISSION_DENIED: "権限がありません。",
      ALREADY_RUNNING: "別の再計算タスクが実行中です。",
      NOT_FOUND: "再計算タスクが見つかりません。"
    }
  },
  errors: {
    PERMISSION_DENIED: "Permission denied."
  }
};
