import React, { useEffect, useId, useRef, useState } from "react";
import { Button, Header, Icon, Label, Loader, Message, Segment } from "semantic-ui-react";
import { Link, useLocalizer } from "@/utils/hooks";
import TimeAgo from "@/components/TimeAgo";
import formatDateTime from "@/utils/formatDateTime";
import {
  getRemoteMonitor,
  MonitorAccount,
  MonitorPublicTask,
  RemoteErrorDetails,
  PlatformMonitor,
  RemoteMonitorSnapshot,
  RemoteMonitorState
} from "@/remote-judge/monitor-api";
import style from "./RemoteJudgeMonitor.module.less";

const colors = {
  Healthy: "green",
  Syncing: "blue",
  Idle: "grey",
  RateLimited: "orange",
  Error: "red",
  Disabled: "grey",
  Unconfigured: "yellow",
  AuthExpired: "red",
  Unknown: "grey"
} as const;

function Timestamp(props: { value: string | null; showRelative?: boolean }) {
  const _ = useLocalizer("judge_machine.remote");
  const date = props.value ? new Date(props.value) : null;
  return date && Number.isFinite(+date) ? (
    <span className={style.timestamp}>
      <span>{formatDateTime(date)[1]}</span>
      {props.showRelative !== false && (
        <span className={style.muted}>
          <TimeAgo time={date} />
        </span>
      )}
    </span>
  ) : (
    <span className={style.muted}>{_(".no_data")}</span>
  );
}

function AccountLink({ account }: { account: Pick<MonitorAccount, "userId" | "username" | "handle"> }) {
  return (
    <span className={style.account}>
      {account.username ? (
        <Link href={`/u/${encodeURIComponent(account.username)}`}>{account.username}</Link>
      ) : (
        `#${account.userId}`
      )}
      <span className={style.muted}>{account.handle}</span>
    </span>
  );
}

const taskPageSize = 8;
const taskColors = {
  Running: "blue",
  Queued: "yellow",
  RetryQueued: "orange",
  RetryWaiting: "orange",
  Scheduled: "grey"
} as const;

function TaskList({
  detail,
  publicTasks,
  stale,
  workersUnknown
}: {
  detail?: PlatformMonitor["admin"];
  publicTasks?: MonitorPublicTask[];
  stale: boolean;
  workersUnknown: boolean;
}) {
  const _ = useLocalizer("judge_machine.remote");
  const [page, setPage] = useState(0);
  const tasks: (MonitorPublicTask & { account?: Pick<MonitorAccount, "userId" | "username" | "handle"> })[] = detail
    ? [
        ...detail.tasks.map(task => ({
          id: String(task.account.accountId),
          account: task.account,
          status: "Running" as const,
          phase: task.phase,
          time: task.startedAt
        })),
        ...(detail.waitingTasks ?? []).map(task => ({
          id: String(task.account.accountId),
          account: task.account,
          status: task.status,
          time: task.nextSyncAt
        }))
      ]
    : publicTasks ?? [];
  const hasCompleteList = !!(detail ? detail.waitingTasks : publicTasks);
  const lastPage = Math.max(0, Math.ceil(tasks.length / taskPageSize) - 1);
  const first = Math.min(page, lastPage) * taskPageSize;
  const end = Math.min(first + taskPageSize, tasks.length);
  useEffect(() => setPage(current => Math.min(current, lastPage)), [lastPage]);

  return (
    <div className={style.tasks}>
      <Header as="h4">{_(".tasks")}</Header>
      {stale && <p className={style.hint}>{_(".tasks_stale")}</p>}
      {workersUnknown && <p className={style.hint}>{_(".tasks_workers_unknown")}</p>}
      {!hasCompleteList && (
        <p className={style.hint}>{_(detail ? ".waiting_tasks_unavailable" : ".tasks_unavailable")}</p>
      )}
      {!tasks.length ? (
        hasCompleteList && <p className={style.muted}>{_(workersUnknown ? ".no_data" : ".no_tasks")}</p>
      ) : (
        <ul className={style.taskList}>
          {tasks.slice(first, end).map(task => (
            <li className={style.task} key={`${task.id}:${task.status === "Running" ? task.time : "waiting"}`}>
              {task.account ? (
                <AccountLink account={task.account} />
              ) : (
                <strong>{_(".task_reference", { id: task.id })}</strong>
              )}
              <div className={style.taskState}>
                <Label basic size="small" color={taskColors[task.status]}>
                  {_(`.task_state.${task.status}`)}
                </Label>
                {task.phase && <span>{_(`.phase.${task.phase}`)}</span>}
              </div>
              <div className={style.taskTime}>
                <span className={style.muted}>{_(`.task_time.${task.status}`)}</span>
                <Timestamp value={task.time} showRelative={task.status === "Running"} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {lastPage > 0 && (
        <div className={style.taskPagination}>
          <span className={style.muted}>{_(".task_range", { first: first + 1, end, total: tasks.length })}</span>
          <Button.Group size="tiny" basic>
            <Button
              type="button"
              icon="angle left"
              aria-label={_(".tasks_previous")}
              disabled={first === 0}
              onClick={() => setPage(page - 1)}
            />
            <Button
              type="button"
              icon="angle right"
              aria-label={_(".tasks_next")}
              disabled={end === tasks.length}
              onClick={() => setPage(page + 1)}
            />
          </Button.Group>
        </div>
      )}
    </div>
  );
}

function ErrorDetails({ error, details }: { error: string; details?: RemoteErrorDetails }) {
  const _ = useLocalizer("judge_machine.remote");
  const requestHint = details?.request?.url.startsWith("https://codeforces.com/")
    ? details.request.url.includes("includeSources=true")
      ? ".failure_request_hint_cf_source"
      : ".failure_request_hint_cf_public"
    : ".failure_request_hint";
  const knownErrors = [
    "REMOTE_PARSE_FAILED",
    "REMOTE_VERIFICATION_REQUIRED",
    "REMOTE_COOLDOWN",
    "REMOTE_AUTH_REQUIRED",
    "REMOTE_SESSION_UNREADABLE",
    "REMOTE_RATE_LIMITED",
    "REMOTE_ACCESS_DENIED",
    "REMOTE_UNAVAILABLE",
    "REMOTE_ATCODER_STATUS_FAILED",
    "REMOTE_API_FAILED"
  ];
  return (
    <div className={style.errorEntry}>
      <span>{_(`.error_summary.${knownErrors.includes(error) ? error : "UNKNOWN"}`)}</span>
      <code>{error}</code>
      {details?.reason && <span>{_(`.diagnostic_reason.${details.reason}`)}</span>}
      {details?.stage && (
        <div className={style.inlineFact}>
          <span>{_(".failure_stage")}</span>
          <span>{_(`.diagnostic_stage.${details.stage}`)}</span>
        </div>
      )}
      {details?.contestId && (
        <div className={style.inlineFact}>
          <span>{_(".failure_contest")}</span>
          <span>{details.contestId}</span>
        </div>
      )}
      {details?.page != null && (
        <div className={style.inlineFact}>
          <span>{_(".failure_page")}</span>
          <span>{details.page}</span>
        </div>
      )}
      {details?.submissionId && (
        <div className={style.inlineFact}>
          <span>{_(".failure_submission")}</span>
          <span>{details.submissionId}</span>
        </div>
      )}
      {details?.httpStatus != null && (
        <div className={style.inlineFact}>
          <span>HTTP</span>
          <span>{details.httpStatus}</span>
        </div>
      )}
      {details?.request && (
        <div className={style.requestDiagnostic}>
          <span>{_(".failure_request")}</span>
          <pre>
            <code>{details.request.command}</code>
          </pre>
          <span className={style.muted}>{_(requestHint)}</span>
        </div>
      )}
    </div>
  );
}

function PlatformCard(props: { platform: PlatformMonitor; admin: boolean; stale: boolean }) {
  const _ = useLocalizer("judge_machine.remote");
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const row = props.platform;
  const detail = props.admin ? row.admin : undefined;
  const state: RemoteMonitorState = props.stale && row.state !== "Disabled" ? "Unknown" : row.state;
  return (
    <Segment className={style.card} data-platform={row.platform}>
      <div className={style.cardHeader}>
        <Header as="h3" className={style.cardTitle}>
          <span className={style.cardIcon}>
            <Icon name="cloud" />
          </span>
          {row.platform}
        </Header>
        <div className={style.cardActions}>
          <Label basic color={colors[state]} className={style.status}>
            {_(`.state.${state}`)}
          </Label>
          {detail && (
            <Button
              type="button"
              className={style.detailsToggle}
              basic
              size="tiny"
              aria-label={_(expanded ? ".collapse" : ".details")}
              aria-expanded={expanded}
              aria-controls={detailsId}
              onClick={() => setExpanded(current => !current)}
              icon={expanded ? "angle up" : "angle down"}
              content={_(".details_short")}
            />
          )}
        </div>
      </div>
      <div className={style.summary}>
        <div>
          <span className={style.muted}>{_(".last_success")}</span>
          <Timestamp value={row.lastSyncedAt} />
        </div>
        <div>
          <span className={style.muted}>{_(".source")}</span>
          <span>{_(`.source_support.${row.sourceSupport}`)}</span>
        </div>
      </div>
      {state === "Idle" && <p className={style.hint}>{_(".idle_hint")}</p>}
      {state === "Unknown" && <p className={style.hint}>{_(".unknown_hint")}</p>}
      {state !== "Disabled" && (
        <TaskList
          detail={detail}
          publicTasks={row.taskStatuses}
          stale={props.stale}
          workersUnknown={!props.stale && state === "Unknown" && !row.lastHeartbeatAt}
        />
      )}
      {detail && (
        <>
          <div className={style.metrics}>
            <div>
              <strong>{detail.queuedAccounts}</strong>
              <span>{_(".queued_accounts")}</span>
            </div>
            <div>
              <strong>{detail.historyAccounts}</strong>
              <span>{_(".history_accounts")}</span>
            </div>
            <div>
              <strong>{detail.pendingSubmissions}</strong>
              <span>{_(".pending_submissions")}</span>
            </div>
            {row.platform === "AtCoder" && (
              <>
                <div>
                  <strong>{detail.sourcePendingSubmissions ?? 0}</strong>
                  <span>{_(".source_pending_submissions")}</span>
                </div>
                <div>
                  <strong>{detail.sourceFailedSubmissions ?? 0}</strong>
                  <span>{_(".source_failed_submissions")}</span>
                </div>
              </>
            )}
          </div>
          {!!detail.sourceErrorAccounts && (
            <Message warning size="small" content={_(".source_error_hint", { count: detail.sourceErrorAccounts })} />
          )}
          <div id={detailsId} hidden={!expanded} className={style.details}>
            {expanded && (
              <>
                <dl className={style.facts}>
                  <dt>{_(".bound_accounts")}</dt>
                  <dd>{detail.boundAccounts}</dd>
                  <dt>{_(".active_accounts")}</dt>
                  <dd>{detail.activeAccounts}</dd>
                  <dt>{_(".retrying_accounts")}</dt>
                  <dd>{detail.retryingAccounts}</dd>
                  <dt title={_(".oldest_queue_hint")}>{_(".oldest_queue")}</dt>
                  <dd>{detail.oldestQueuedAt ? <TimeAgo time={new Date(detail.oldestQueuedAt)} /> : _(".none")}</dd>
                  <dt>{_(".worker_heartbeat")}</dt>
                  <dd>
                    <Timestamp value={row.lastHeartbeatAt} />
                  </dd>
                  <dt>{_(".live_workers")}</dt>
                  <dd>{detail.liveWorkers}</dd>
                </dl>
                <Header as="h4">{_(".account_errors")}</Header>
                {!detail.errors.length ? (
                  <p className={style.muted}>{_(".no_errors")}</p>
                ) : (
                  <div className={style.errorList}>
                    {detail.errors.map(account => (
                      <Segment key={account.accountId} className={style.errorItem}>
                        <AccountLink account={account} />
                        {account.lastError && (
                          <div className={style.errorEntry}>
                            <strong>{_(".result_error")}</strong>
                            <ErrorDetails error={account.lastError} details={account.lastErrorDetails} />
                            <div className={style.inlineFact}>
                              <span>{_(".occurred_at")}</span>
                              <Timestamp value={account.lastErrorAt} />
                            </div>
                            <div className={style.inlineFact}>
                              <span>{_(".retry_at")}</span>
                              <Timestamp value={account.nextSyncAt} />
                            </div>
                          </div>
                        )}
                        {account.sourceError && (
                          <div className={style.errorEntry}>
                            <strong>{_(".source_error")}</strong>
                            <ErrorDetails error={account.sourceError} details={account.sourceErrorDetails} />
                            <div className={style.inlineFact}>
                              <span>{_(".occurred_at")}</span>
                              <Timestamp value={account.sourceErrorAt} />
                            </div>
                            <div className={style.inlineFact}>
                              <span>{_(".retry_at")}</span>
                              <Timestamp value={account.sourceRetryAt} />
                            </div>
                          </div>
                        )}
                      </Segment>
                    ))}
                  </div>
                )}
                {detail.errorsTruncated && <p className={style.muted}>{_(".errors_truncated")}</p>}
                <Header as="h4">{_(".recent_errors")}</Header>
                <p className={style.hint}>{_(".error_history_hint")}</p>
                {detail.errorHistoryAvailable === false ? (
                  <Message warning content={_(".error_history_unavailable")} />
                ) : !detail.recentErrors?.length ? (
                  <p className={style.muted}>{_(".no_recent_errors")}</p>
                ) : (
                  <div className={style.historyList}>
                    {detail.recentErrors.map(event => (
                      <Segment key={event.id} className={style.errorItem}>
                        <AccountLink account={event.account} />
                        <div className={style.errorEntry}>
                          <strong>{_(event.kind === "Source" ? ".source_error" : ".result_error")}</strong>
                          <ErrorDetails error={event.error} details={event.details} />
                          <div className={style.inlineFact}>
                            <span>{_(".occurred_at")}</span>
                            <Timestamp value={event.at} />
                          </div>
                          {event.retryAt && (
                            <div className={style.inlineFact}>
                              <span>{_(".retry_at_when_failed")}</span>
                              <Timestamp value={event.retryAt} />
                            </div>
                          )}
                        </div>
                      </Segment>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </Segment>
  );
}

function RedisCard({ redis, stale }: { redis: NonNullable<RemoteMonitorSnapshot["admin"]>["redis"]; stale: boolean }) {
  const _ = useLocalizer("judge_machine.remote");
  const rejectionsIncreasing = redis.rejectedDelta !== null && redis.rejectedDelta > 0;
  const state = stale ? "Unknown" : !redis.available || rejectionsIncreasing ? "Error" : "Healthy";
  return (
    <Segment className={style.card}>
      <div className={style.cardHeader}>
        <Header as="h3" className={style.cardTitle}>
          <span className={style.cardIcon}>
            <Icon name="database" />
          </span>
          {_(".redis_title")}
        </Header>
        <Label basic color={colors[state]} className={style.status}>
          {_(`.state.${state}`)}
        </Label>
      </div>
      {!redis.available ? (
        <Message warning content={_(".redis_unavailable")} />
      ) : (
        <>
          <div className={`${style.metrics} ${style.redisMetrics}`}>
            <div>
              <strong>{redis.connectedClients ?? _(".no_data")}</strong>
              <span>{_(".redis_clients")}</span>
            </div>
            <div>
              <strong>{redis.maxClients ?? _(".no_data")}</strong>
              <span>{_(".redis_max_clients")}</span>
            </div>
            <div>
              <strong>{redis.rejectedConnections ?? _(".no_data")}</strong>
              <span>{_(".redis_rejected")}</span>
            </div>
            <div>
              <strong>{redis.rejectedDelta ?? _(".no_data")}</strong>
              <span>{_(".redis_delta")}</span>
            </div>
          </div>
          {rejectionsIncreasing && <Message negative size="small" content={_(".redis_rejections_increasing")} />}
          <div className={style.summary}>
            <div>
              <span className={style.muted}>{_(".sampled_at")}</span>
              <Timestamp value={redis.sampledAt} />
            </div>
            <div>
              <span className={style.muted}>{_(".delta_since")}</span>
              <Timestamp value={redis.deltaSince} />
            </div>
          </div>
          <p className={`${style.hint} ${style.cardNote}`}>{_(".redis_hint")}</p>
        </>
      )}
    </Segment>
  );
}

export default function RemoteJudgeMonitor(props: { isAdmin: boolean }) {
  const _ = useLocalizer("judge_machine.remote");
  const [snapshot, setSnapshot] = useState<RemoteMonitorSnapshot>();
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const generation = useRef(0);
  useEffect(() => {
    const version = ++generation.current;
    let stopped = false;
    let pending = false;
    // Drop previously authorized details immediately when the viewer identity changes.
    setSnapshot(undefined);
    setLoading(true);
    async function refresh() {
      if (pending || document.visibilityState !== "visible") return;
      pending = true;
      try {
        const { requestError, response } = await getRemoteMonitor();
        if (stopped || version !== generation.current) return;
        if (requestError || !response?.platforms) setFailed(true);
        else {
          setSnapshot(response);
          setFailed(false);
        }
      } catch {
        if (!stopped && version === generation.current) setFailed(true);
      } finally {
        pending = false;
        if (!stopped && version === generation.current) {
          setLoading(false);
          setClock(Date.now());
        }
      }
    }
    void refresh();
    const timer = setInterval(() => {
      setClock(Date.now());
      void refresh();
    }, 30000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [props.isAdmin, refreshVersion]);
  const updatedAt = Date.parse(snapshot?.updatedAt || "");
  const stale =
    failed || !!snapshot?.stale || !!snapshot?.unavailable || !Number.isFinite(updatedAt) || clock - updatedAt > 90000;
  const redis = props.isAdmin ? snapshot?.admin?.redis : undefined;
  const displayedPlatforms: PlatformMonitor[] =
    snapshot?.platforms ||
    (loading
      ? []
      : ["Codeforces", "AtCoder"].map(platform => ({
          platform: platform as PlatformMonitor["platform"],
          state: "Unknown",
          lastSyncedAt: null,
          lastHeartbeatAt: null,
          sourceSupport: platform === "Codeforces" ? "PersonalKey" : "PersonalSession"
        })));
  return (
    <section className={style.section} aria-label={_(".title")}>
      <div className={style.sectionHeader}>
        <Header as="h2" icon="cloud" content={_(".title")} />
        <Button
          type="button"
          basic
          size="small"
          icon="refresh"
          title={_(".refresh")}
          aria-label={_(".refresh")}
          loading={loading}
          onClick={() => setRefreshVersion(value => value + 1)}
        />
      </div>
      <p className={style.hint}>{_(".refresh_hint")}</p>
      {(failed || snapshot?.unavailable || (snapshot && stale)) && <Message warning content={_(".unavailable")} />}
      {loading && !snapshot && (
        <Segment>
          <Loader active inline="centered" />
        </Segment>
      )}
      {!!displayedPlatforms.length && (
        <>
          <div className={style.cards}>
            {displayedPlatforms.map(platform => (
              <PlatformCard key={platform.platform} platform={platform} admin={props.isAdmin} stale={stale} />
            ))}
            {redis && <RedisCard redis={redis} stale={stale} />}
          </div>
          <div className={style.updatedAt}>
            {_(".snapshot_at")} <Timestamp value={snapshot?.updatedAt || null} />
          </div>
        </>
      )}
    </section>
  );
}
