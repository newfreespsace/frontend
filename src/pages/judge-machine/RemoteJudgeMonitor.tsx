import React, { useEffect, useRef, useState } from "react";
import { Button, Header, Icon, Label, Loader, Message, Segment } from "semantic-ui-react";
import { Link, useLocalizer } from "@/utils/hooks";
import TimeAgo from "@/components/TimeAgo";
import formatDateTime from "@/utils/formatDateTime";
import {
  getRemoteMonitor,
  MonitorAccount,
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

function Timestamp(props: { value: string | null }) {
  const _ = useLocalizer("judge_machine.remote");
  const date = props.value ? new Date(props.value) : null;
  return date && Number.isFinite(+date) ? (
    <span className={style.timestamp}>
      <span>{formatDateTime(date)[1]}</span>
      <span className={style.muted}>
        <TimeAgo time={date} />
      </span>
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

function ErrorDetails({ error, details }: { error: string; details?: RemoteErrorDetails }) {
  const _ = useLocalizer("judge_machine.remote");
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
          <span className={style.muted}>{_(".failure_request_hint")}</span>
        </div>
      )}
    </div>
  );
}

function PlatformCard(props: { platform: PlatformMonitor; admin: boolean; stale: boolean }) {
  const _ = useLocalizer("judge_machine.remote");
  const [expanded, setExpanded] = useState(false);
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
        <Label basic color={colors[state]} className={style.status}>
          {_(`.state.${state}`)}
        </Label>
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
          <Button
            type="button"
            className={style.detailsToggle}
            basic
            size="small"
            fluid
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
            icon={expanded ? "angle up" : "angle down"}
            content={_(expanded ? ".collapse" : ".details")}
          />
          {expanded && (
            <div className={style.details}>
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
              <Header as="h4">{_(".running_tasks")}</Header>
              {!detail.tasks.length ? (
                <p className={style.muted}>{_(".none")}</p>
              ) : (
                <div className={style.taskList}>
                  {detail.tasks.map(task => (
                    <div className={style.task} key={`${task.account.accountId}:${task.startedAt}`}>
                      <AccountLink account={task.account} />
                      <Label size="small">{_(`.phase.${task.phase}`)}</Label>
                      <Timestamp value={task.startedAt} />
                    </div>
                  ))}
                </div>
              )}
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
                          <ErrorDetails error={account.sourceError} />
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
            </div>
          )}
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
  const stale = failed || !!snapshot?.stale || !Number.isFinite(updatedAt) || clock - updatedAt > 90000;
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
