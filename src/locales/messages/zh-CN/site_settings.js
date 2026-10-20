return {
  title: "站点设置",
  header: "站点设置",
  allow_register: "允许新用户注册",
  other_submission_code_min_accepted_problems: "查看他人代码所需的最少通过题数",
  other_submission_code_min_accepted_problems_hint:
    "达到此题数即可查看他人的公开提交，以及有权访问的已结束比赛中赛时、赛后的提交。设为 0 表示所有登录用户均可查看。",
  other_submission_code_min_accepted_problems_invalid: "请输入大于或等于 0 的整数。",
  hide_submission_testcase_details_for_normal_users: "对普通用户隐藏提交详情中的测试点数据",
  save: "保存",
  success: "站点设置已保存。",
  atcoder_sync: "AtCoder 成绩同步",
  atcoder_session: "专用账号会话（REVEL_SESSION）",
  atcoder_session_help:
    "使用专用账号登录 AtCoder，在浏览器开发者工具的 Application → Cookies → https://atcoder.jp 中复制 REVEL_SESSION 的 Value，粘贴到此处。",
  atcoder_session_keep: "留空保留现有会话。保存后自动生效，无需重启后端；清除后暂停 AtCoder 成绩同步，已有成绩保留。",
  atcoder_session_configured: "会话已保存，等待下一次原站查询确认是否有效。",
  atcoder_session_environment: "已通过环境变量配置会话。此处保存的新会话将优先使用。",
  atcoder_session_missing: "尚未配置会话，AtCoder 成绩同步已暂停。请配置专用账号会话以启用原站直读。",
  atcoder_session_save: "保存会话",
  atcoder_session_clear: "清除会话",
  atcoder_session_saved: "AtCoder 同步配置已保存。",
  atcoder_session_expired: "AtCoder 同步会话已失效。请重新登录专用账号，并在下方更新 REVEL_SESSION。已有成绩保留。",
  atcoder_session_unreadable: "AtCoder 同步会话无法读取，请在下方重新配置。已有成绩保留。",
  atcoder_session_unavailable:
    "最近一次原站查询失败，原站可能暂时不可用、限流或要求验证。请检查访问情况；目前无法确认会话是否有效。",
  atcoder_session_valid: "最近一次原站查询成功，会话可用。",
  atcoder_session_checked_at: "最近检查：{time}",
  atcoder_session_login: "重新登录 AtCoder",
  errors: {
    PERMISSION_DENIED: "权限不足。"
  }
};
