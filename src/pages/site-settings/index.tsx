import React, { useEffect, useState } from "react";
import { Button, Checkbox, Form, Header, Icon, Message, Segment, Statistic } from "semantic-ui-react";
import { observer } from "mobx-react";

import api from "@/api";
import { defineRoute, RouteError } from "@/AppRouter";
import { appState } from "@/appState";
import { makeToBeLocalizedText } from "@/locales";
import { useLocalizer } from "@/utils/hooks";
import toast from "@/utils/toast";

async function fetchData() {
  const { requestError, response } = await api.siteSetting.getPreference();

  if (requestError) throw new RouteError(requestError, { showRefresh: true, showBack: true });
  else if (response.error)
    throw new RouteError(makeToBeLocalizedText(`site_settings.errors.${response.error}`), {
      showRefresh: true,
      showBack: true
    });

  return response;
}

type SiteSettingsPageProps = Omit<ApiTypes.GetSitePreferenceResponseDto, "error">;
const TRAINING_POINT_TASK_STORAGE_KEY = "training-point-recalculation-task-id";

const SiteSettingsPage: React.FC<SiteSettingsPageProps> = props => {
  const _ = useLocalizer("site_settings");

  useEffect(() => {
    appState.enterNewPage(_(".title"));
  }, [appState.locale]);

  const [allowRegister, setAllowRegister] = useState(props.preference.security.allowRegister);
  const [hideSubmissionTestcaseDetailsForNormalUsers, setHideSubmissionTestcaseDetailsForNormalUsers] = useState(
    props.preference.security.hideSubmissionTestcaseDetailsForNormalUsers
  );
  const [pending, setPending] = useState(false);
  const [pointTask, setPointTask] = useState<ApiTypes.TrainingPointRecalculationTaskDto | null>(null);
  const [startingPointTask, setStartingPointTask] = useState(false);

  const pointTaskRunning = !!pointTask && ["PENDING", "RUNNING"].includes(pointTask.status);

  function rememberPointTask(task: ApiTypes.TrainingPointRecalculationTaskDto) {
    window.localStorage.setItem(TRAINING_POINT_TASK_STORAGE_KEY, String(task.id));
    setPointTask(task);
  }

  useEffect(() => {
    const taskId = Number(window.localStorage.getItem(TRAINING_POINT_TASK_STORAGE_KEY));
    const request = Number.isSafeInteger(taskId) && taskId > 0 ? { taskId } : {};

    api.siteSetting.getTrainingPointRecalculation(request).then(({ requestError, response }) => {
      if (requestError || response.error || !response.task) {
        window.localStorage.removeItem(TRAINING_POINT_TASK_STORAGE_KEY);
        return;
      }
      rememberPointTask(response.task);
    });
  }, []);

  useEffect(() => {
    if (!pointTaskRunning) return undefined;
    const timer = window.setTimeout(async () => {
      const { requestError, response } = await api.siteSetting.getTrainingPointRecalculation({
        taskId: pointTask.id
      });
      if (requestError) toast.error(requestError(_));
      else if (response.error) toast.error(_(`.point_recalculation.errors.${response.error}`));
      else if (response.task) rememberPointTask(response.task);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [pointTask?.id, pointTask?.status]);

  async function onSubmit() {
    if (pending) return;
    setPending(true);

    const { requestError, response } = await api.siteSetting.updatePreference({
      preference: {
        security: {
          allowRegister,
          hideSubmissionTestcaseDetailsForNormalUsers
        }
      }
    });

    if (requestError) toast.error(requestError(_));
    else if (response.error) toast.error(_(`.errors.${response.error}`));
    else {
      appState.serverPreference = response.preference;
      toast.success(_(".success"));
    }

    setPending(false);
  }

  async function startPointRecalculation(dryRun: boolean) {
    if (startingPointTask || pointTaskRunning) return;
    if (!dryRun && !window.confirm(_(".point_recalculation.confirm"))) return;

    setStartingPointTask(true);
    try {
      const { requestError, response } = await api.siteSetting.startTrainingPointRecalculation({ dryRun });
      if (requestError) toast.error(requestError(_));
      else if (response.error) {
        toast.error(_(`.point_recalculation.errors.${response.error}`));
        if (response.task) rememberPointTask(response.task);
      } else if (response.task) rememberPointTask(response.task);
    } finally {
      setStartingPointTask(false);
    }
  }

  return (
    <>
      <Header as="h1">{_(".header")}</Header>
      <Segment>
        <Form>
          <Form.Field>
            <Checkbox
              toggle
              label={_(".allow_register")}
              checked={allowRegister}
              onChange={(e, { checked }) => setAllowRegister(!!checked)}
            />
          </Form.Field>
          <Form.Field>
            <Checkbox
              toggle
              label={_(".hide_submission_testcase_details_for_normal_users")}
              checked={hideSubmissionTestcaseDetailsForNormalUsers}
              onChange={(e, { checked }) => setHideSubmissionTestcaseDetailsForNormalUsers(!!checked)}
            />
          </Form.Field>
          <Button primary loading={pending} onClick={onSubmit}>
            <Icon name="save" />
            {_(".save")}
          </Button>
        </Form>
      </Segment>
      <Header as="h2">{_(".point_recalculation.title")}</Header>
      <Segment>
        <p>{_(".point_recalculation.description")}</p>
        <Button
          basic
          primary
          loading={startingPointTask && !pointTaskRunning}
          disabled={!!pointTaskRunning}
          onClick={() => startPointRecalculation(true)}
        >
          <Icon name="search" />
          {_(".point_recalculation.preview")}
        </Button>
        <Button
          negative
          loading={startingPointTask || !!pointTaskRunning}
          disabled={!!pointTaskRunning}
          onClick={() => startPointRecalculation(false)}
        >
          <Icon name="refresh" />
          {_(".point_recalculation.execute")}
        </Button>

        {pointTask && (
          <Message
            info={pointTask.status === "PENDING" || pointTask.status === "RUNNING"}
            positive={pointTask.status === "SUCCEEDED"}
            negative={pointTask.status === "FAILED"}
          >
            <Message.Header>
              {_(pointTask.dryRun ? ".point_recalculation.mode_preview" : ".point_recalculation.mode_execute")} ·{" "}
              {_(`.point_recalculation.status.${pointTask.status}`)} · #{pointTask.id}
            </Message.Header>
            {pointTask.startedAt && (
              <div>
                {_(`.point_recalculation.started_at`)}: {new Date(pointTask.startedAt).toLocaleString()}
              </div>
            )}
            {pointTask.finishedAt && (
              <div>
                {_(`.point_recalculation.finished_at`)}: {new Date(pointTask.finishedAt).toLocaleString()}
              </div>
            )}
            {pointTask.error && <pre style={{ whiteSpace: "pre-wrap" }}>{pointTask.error}</pre>}
            {pointTask.summary && (
              <Statistic.Group size="mini" widths={4} style={{ marginTop: "1rem" }}>
                <Statistic
                  label={_(".point_recalculation.affected_users")}
                  value={pointTask.summary.affectedUserCount}
                />
                <Statistic
                  label={_(".point_recalculation.records")}
                  value={`${pointTask.summary.currentRecordCount} → ${pointTask.summary.expectedRecordCount}`}
                />
                <Statistic
                  label={_(".point_recalculation.changes")}
                  value={`+${pointTask.summary.addedRecordCount} / ~${pointTask.summary.updatedRecordCount} / -${pointTask.summary.deletedRecordCount}`}
                />
                <Statistic
                  label={_(".point_recalculation.total_points")}
                  value={`${pointTask.summary.beforeTotalPoints} → ${pointTask.summary.afterTotalPoints}`}
                />
              </Statistic.Group>
            )}
            {!pointTask.dryRun && pointTask.status === "SUCCEEDED" && pointTask.summary && (
              <div>
                {_(`.point_recalculation.validation`)}:{" "}
                {_(
                  pointTask.summary.validationPassed
                    ? ".point_recalculation.validation_passed"
                    : ".point_recalculation.validation_failed"
                )}
              </div>
            )}
          </Message>
        )}
      </Segment>
    </>
  );
};

export default defineRoute(async () => <SiteSettingsPage {...await fetchData()} />);
