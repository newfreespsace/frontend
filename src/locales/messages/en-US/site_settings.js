return {
  title: "Site Settings",
  header: "Site Settings",
  allow_register: "Allow new user registration",
  hide_submission_testcase_details_for_normal_users: "Hide testcase details from normal users",
  save: "Save",
  success: "Site settings saved.",
  point_recalculation: {
    title: "Full training point recalculation",
    description: "Preview or rebuild every user's points from current training plans and all historical accepts.",
    preview: "Preview recalculation",
    execute: "Run recalculation",
    mode_preview: "Preview",
    mode_execute: "Execution",
    confirm: "Run a full recalculation? This overwrites every user's points using the current rules.",
    started_at: "Started",
    finished_at: "Finished",
    validation: "Consistency validation",
    validation_passed: "Passed",
    validation_failed: "Failed",
    affected_users: "Affected users",
    records: "Point records",
    changes: "Added / updated / removed",
    total_points: "Total points",
    status: {
      PENDING: "Pending",
      RUNNING: "Running",
      SUCCEEDED: "Completed",
      FAILED: "Failed"
    },
    errors: {
      PERMISSION_DENIED: "Permission denied.",
      ALREADY_RUNNING: "Another point recalculation is already running.",
      NOT_FOUND: "Recalculation task not found."
    }
  },
  errors: {
    PERMISSION_DENIED: "Permission denied."
  }
};
