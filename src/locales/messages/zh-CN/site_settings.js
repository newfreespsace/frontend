return {
  title: "站点设置",
  header: "站点设置",
  allow_register: "允许新用户注册",
  hide_submission_testcase_details_for_normal_users: "对普通用户隐藏提交详情中的测试点数据",
  save: "保存",
  success: "站点设置已保存。",
  point_recalculation: {
    title: "训练积分全量补算",
    description: "按当前训练计划、题目归属和全部历史 AC 预演或重建所有用户积分。",
    preview: "预演全量补算",
    execute: "执行全量补算",
    mode_preview: "预演",
    mode_execute: "正式执行",
    confirm: "确定执行全量补算吗？该操作会按当前规则覆盖所有用户积分。",
    started_at: "开始时间",
    finished_at: "结束时间",
    validation: "一致性校验",
    validation_passed: "通过",
    validation_failed: "未通过",
    affected_users: "受影响用户",
    records: "积分记录",
    changes: "新增 / 更新 / 删除",
    total_points: "全站积分",
    status: {
      PENDING: "等待执行",
      RUNNING: "正在补算",
      SUCCEEDED: "补算完成",
      FAILED: "补算失败"
    },
    errors: {
      PERMISSION_DENIED: "权限不足。",
      ALREADY_RUNNING: "已有积分补算任务正在运行。",
      NOT_FOUND: "找不到补算任务。"
    }
  },
  errors: {
    PERMISSION_DENIED: "权限不足。"
  }
};
