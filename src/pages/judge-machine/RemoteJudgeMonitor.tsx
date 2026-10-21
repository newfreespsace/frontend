import React, { useEffect, useRef, useState } from "react";
import { Button, Header, Icon, Label, Loader, Message, Segment, Table } from "semantic-ui-react";
import { Link, useLocalizer } from "@/utils/hooks";
import TimeAgo from "@/components/TimeAgo";
import formatDateTime from "@/utils/formatDateTime";
import {
  getRemoteMonitor,
  MonitorAccount,
  PlatformMonitor,
  RemoteMonitorSnapshot,
  RemoteMonitorState,
  RemoteTaskProblem
} from "@/remote-judge/monitor-api";
import style from "./RemoteJudgeMonitor.module.less";
import { getProblemUrl } from "../problem/utils";

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

function AccountLink({ account }: { account: MonitorAccount }) {
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

const taskColors = {
  Queued: "blue",
  Scheduled: "grey",
  Retrying: "orange",
  Paused: "yellow",
  Running: "blue",
  Succeeded: "green",
  Failed: "red",
  Skipped: "grey",
  Unknown: "grey"
} as const;

function TaskProblems(props: {
  problems?: RemoteTaskProblem[];
  truncated?: boolean;
  phase: string;
  finished?: boolean;
  noMatches?: boolean;
  stale?: boolean;
}) {
  const _ = useLocalizer("judge_machine.remote");
  if (!props.problems?.length)
    return (
      <p className={style.hint}>
        {_(
          props.phase === "Collecting"
            ? ".problems_collecting"
            : props.noMatches
            ? ".problems_no_matches"
            : ".problems_unknown"
        )}
      </p>
    );
  return (
    <div className={style.problemTasks}>
      <strong>{_(".target_problems")}</strong>
      {props.problems.map(problem => (
        <div className={style.problemTask} key={problem.problemId}>
          <Link
            href={
              problem.displayId
                ? getProblemUrl(problem.displayId, { use: "displayId" })
                : getProblemUrl(problem.problemId, { use: "id" })
            }
          >
            {problem.displayId ? `#${problem.displayId}` : `P${problem.problemId}`} {problem.title || problem.remoteKey}
          </Link>
          <div className={style.problemMeta}>
            <code>{problem.remoteKey}</code>
            <Label size="mini">
              {_(`.problem_state.${props.stale && !props.finished ? "Unknown" : problem.state}`)}
            </Label>
          </div>
          {problem.records !== null && (
            <div className={style.muted}>
              {_(
                problem.scope === "Buffer"
                  ? ".problem_buffered"
                  : problem.state === "Collecting"
                  ? ".problem_collected"
                  : ".problem_progress",
                {
                  total: problem.records,
                  processed: problem.processed,
                  remaining: Math.max(0, problem.records - problem.processed),
                  synchronized: problem.synchronized
                }
              )}
            </div>
          )}
        </div>
      ))}
      {props.truncated && <p className={style.hint}>{_(".problems_truncated")}</p>}
    </div>
  );
}

function TaskPages(props: { items: { id: string; content: React.ReactNode }[]; label: string }) {
  const _ = useLocalizer("judge_machine.remote");
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(props.items.length / 10));
  const current = Math.min(page, pages);
  return (
    <div aria-label={props.label}>
      {!props.items.length && <p className={style.muted}>{_(".none")}</p>}
      {props.items.slice((current - 1) * 10, current * 10).map(item => (
        <Segment key={item.id} className={style.taskItem}>
          {item.content}
        </Segment>
      ))}
      {pages > 1 && (
        <div className={style.pagination}>
          <Button
            type="button"
            basic
            size="mini"
            icon="angle left"
            aria-label={_(".previous_page")}
            disabled={current === 1}
            onClick={() => setPage(current - 1)}
          />
          <span>{_(".task_page", { page: current, pages, count: props.items.length })}</span>
          <Button
            type="button"
            basic
            size="mini"
            icon="angle right"
            aria-label={_(".next_page")}
            disabled={current === pages}
            onClick={() => setPage(current + 1)}
          />
        </div>
      )}
    </div>
  );
}

function TaskLists(props: { detail: NonNullable<PlatformMonitor["admin"]>; stale: boolean }) {
  const _ = useLocalizer("judge_machine.remote");
  const [filter, setFilter] = useState("All");
  const detail = props.detail;
  const history = (detail.history || []).filter(task => filter === "All" || task.state === filter);
  return (
    <>
      <p className={style.hint}>{_(".task_hint")}</p>
      <Header as="h4">
        {_(".scheduled_tasks")} ({detail.scheduledTaskTotal ?? 0})
      </Header>
      <TaskPages
        label={_(".scheduled_tasks")}
        items={(detail.scheduledTasks || []).map(task => ({
          id: String(task.account.accountId),
          content: (
            <>
              <div className={style.task}>
                <AccountLink account={task.account} />
                <Label size="small" color={taskColors[props.stale ? "Unknown" : task.state]}>
                  {_(`.task_state.${props.stale ? "Unknown" : task.state}`)}
                </Label>
                <span>{_(`.phase.${task.phase}`)}</span>
              </div>
              <div className={style.inlineFact}>
                <span>{_(".scheduled_at")}</span>
                <Timestamp value={task.scheduledAt} />
              </div>
              <TaskProblems
                problems={task.problems}
                truncated={task.problemsTruncated}
                phase={task.phase}
                stale={props.stale}
              />
              {task.account.lastError && <code className={style.errorCode}>{task.account.lastError}</code>}
            </>
          )
        }))}
      />
      {detail.scheduledTasksTruncated && <p className={style.hint}>{_(".scheduled_truncated")}</p>}
      <Header as="h4">
        {_(".running_tasks")} ({detail.tasks.length})
      </Header>
      <TaskPages
        label={_(".running_tasks")}
        items={detail.tasks.map(task => ({
          id: `${task.account.accountId}:${task.startedAt}`,
          content: (
            <>
              <div className={style.task}>
                <AccountLink account={task.account} />
                <Label size="small" color={taskColors[props.stale ? "Unknown" : "Running"]}>
                  {_(`.task_state.${props.stale ? "Unknown" : "Running"}`)}
                </Label>
                <span>{_(`.phase.${task.phase}`)}</span>
              </div>
              <div className={style.inlineFact}>
                <span>{_(".started_at")}</span>
                <Timestamp value={task.startedAt} />
              </div>
              <TaskProblems
                problems={task.problems}
                truncated={task.problemsTruncated}
                phase={task.phase}
                stale={props.stale}
              />
            </>
          )
        }))}
      />
      <div className={style.historyHeader}>
        <Header as="h4">{_(".finished_tasks")}</Header>
        <select
          className={style.taskFilter}
          aria-label={_(".task_filter")}
          value={filter}
          onChange={event => setFilter(event.target.value)}
        >
          {["All", "Succeeded", "Failed", "Skipped"].map(state => (
            <option key={state} value={state}>
              {_(`.task_state.${state}`)}
            </option>
          ))}
        </select>
      </div>
      <p className={style.hint}>{_(".history_hint")}</p>
      {detail.historyAvailable === false && <Message warning size="small" content={_(".history_unavailable")} />}
      <TaskPages
        key={filter}
        label={_(".finished_tasks")}
        items={history.map(task => ({
          id: task.id,
          content: (
            <>
              <div className={style.task}>
                {task.account ? (
                  <AccountLink account={task.account} />
                ) : (
                  <span>{_(".removed_account", { id: task.accountId })}</span>
                )}
                <Label size="small" color={taskColors[task.state]}>
                  {_(`.task_state.${task.state}`)}
                </Label>
                <span>{_(`.phase.${task.phase}`)}</span>
              </div>
              <div className={style.inlineFact}>
                <span>{_(".started_at")}</span>
                <Timestamp value={task.startedAt} />
              </div>
              <div className={style.inlineFact}>
                <span>{_(".finished_at")}</span>
                <Timestamp value={task.finishedAt} />
              </div>
              <div className={style.inlineFact}>
                <span>{_(".duration")}</span>
                <span>{_(".duration_value", { seconds: (task.durationMs / 1000).toFixed(1) })}</span>
                <span>{_(".processed_count", { count: task.processed })}</span>
              </div>
              <p className={style.taskResult}>{_(`.continuation.${task.continuation}`)}</p>
              <TaskProblems
                problems={task.problems}
                truncated={task.problemsTruncated}
                phase={task.phase}
                finished
                noMatches={task.state === "Succeeded"}
              />
              {task.error && <code className={style.errorCode}>{task.error}</code>}
              {task.sourceError && (
                <div className={style.errorEntry}>
                  <strong>{_(".source_error")}</strong>
                  <code>{task.sourceError}</code>
                </div>
              )}
              {task.nextSyncAt && task.continuation !== "None" && (
                <div className={style.inlineFact}>
                  <span>{_(".next_scheduled_at")}</span>
                  <Timestamp value={task.nextSyncAt} />
                </div>
              )}
            </>
          )
        }))}
      />
    </>
  );
}

function PlatformCard(props: { platform: PlatformMonitor; admin: boolean; stale: boolean }) {
  const _ = useLocalizer("judge_machine.remote");
  const [expanded, setExpanded] = useState(false);
  const row = props.platform;
  const detail = props.admin ? row.admin : undefined;
  const state: RemoteMonitorState = props.stale && row.state !== "Disabled" ? "Unknown" : row.state;
  return (
    <Segment className={style.platform} data-platform={row.platform}>
      <div className={style.cardHeader}>
        <Header as="h3">
          <Icon name="cloud" />
          {row.platform}
        </Header>
        <Label color={colors[state]}>{_(`.state.${state}`)}</Label>
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
          </div>
          {!!detail.sourceErrorAccounts && (
            <Message warning size="small" content={_(".source_error_hint", { count: detail.sourceErrorAccounts })} />
          )}
          <Button
            type="button"
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
              {detail.session && (
                <Segment secondary>
                  <Header as="h4">{_(".atcoder_session")}</Header>
                  <p>{_(`.session.${detail.session.status}`)}</p>
                  <div className={style.inlineFact}>
                    <span>{_(".checked_at")}</span>
                    <Timestamp value={detail.session.checkedAt} />
                  </div>
                  {detail.session.error && (
                    <p className={style.errorCode}>
                      <code>{detail.session.error}</code>
                    </p>
                  )}
                  <Link href="/site-settings">{_(".session_settings")}</Link>
                </Segment>
              )}
              <TaskLists detail={detail} stale={props.stale} />
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
                          <code>{account.lastError}</code>
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
                          <code>{account.sourceError}</code>
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
            </div>
          )}
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
          sourceSupport: platform === "Codeforces" ? "PersonalKey" : "Unavailable"
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
          </div>
          <div className={style.updatedAt}>
            {_(".snapshot_at")} <Timestamp value={snapshot?.updatedAt || null} />
          </div>
        </>
      )}
      {redis && (
        <Segment className={style.redis}>
          <Header as="h3" icon="database" content={_(".redis_title")} />
          {!redis.available ? (
            <Message warning content={_(".redis_unavailable")} />
          ) : (
            <>
              <Table basic="very" compact unstackable>
                <Table.Body>
                  <Table.Row>
                    <Table.Cell>{_(".redis_clients")}</Table.Cell>
                    <Table.Cell textAlign="right">{redis.connectedClients ?? _(".no_data")}</Table.Cell>
                  </Table.Row>
                  <Table.Row>
                    <Table.Cell>{_(".redis_max_clients")}</Table.Cell>
                    <Table.Cell textAlign="right">{redis.maxClients ?? _(".no_data")}</Table.Cell>
                  </Table.Row>
                  <Table.Row>
                    <Table.Cell>{_(".redis_rejected")}</Table.Cell>
                    <Table.Cell textAlign="right">{redis.rejectedConnections ?? _(".no_data")}</Table.Cell>
                  </Table.Row>
                  <Table.Row>
                    <Table.Cell>{_(".redis_delta")}</Table.Cell>
                    <Table.Cell textAlign="right">{redis.rejectedDelta ?? _(".no_data")}</Table.Cell>
                  </Table.Row>
                </Table.Body>
              </Table>
              {redis.rejectedDelta !== null && redis.rejectedDelta > 0 && (
                <Message negative content={_(".redis_rejections_increasing")} />
              )}
              <p className={style.hint}>{_(".redis_hint")}</p>
              <div className={style.inlineFact}>
                <span>{_(".delta_since")}</span>
                <Timestamp value={redis.deltaSince} />
              </div>
              <div className={style.inlineFact}>
                <span>{_(".sampled_at")}</span>
                <Timestamp value={redis.sampledAt} />
              </div>
            </>
          )}
        </Segment>
      )}
    </section>
  );
}
