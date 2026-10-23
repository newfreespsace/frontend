import React, { useEffect, useRef, useState } from "react";
import { Button, Header, Label, Loader, Message, Segment } from "semantic-ui-react";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, LineElement, PointElement, LinearScale, Tooltip } from "chart.js";

import { useLocalizer } from "@/utils/hooks";

import { getServerMonitor, ResourcePoint, ServerMonitorSnapshot } from "./server-monitor-api";
import style from "./ServerMonitor.module.less";

ChartJS.register(LineElement, PointElement, LinearScale, Tooltip);

function ResourceChart(props: {
  points: ResourcePoint[];
  metric: "cpuPercent" | "memoryPercent";
  title: string;
  locale: string;
}) {
  const color = props.metric === "cpuPercent" ? "#3b82f6" : "#16a085";
  return (
    <div className={style.chartCard}>
      <Header as="h3" content={props.title} />
      <div className={style.chart}>
        <Line
          aria-label={props.title}
          role="img"
          data={{
            datasets: [
              {
                label: props.title,
                data: props.points.map(point => ({ x: point.at, y: point[props.metric] })),
                borderColor: color,
                backgroundColor: color,
                borderWidth: 2,
                pointRadius: 0,
                pointHitRadius: 12,
                spanGaps: false
              }
            ]
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            interaction: { mode: "nearest", axis: "x", intersect: false },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  title: items => (items.length ? new Date(items[0].parsed.x).toLocaleString(props.locale) : ""),
                  label: item => `${props.title}: ${item.parsed.y.toFixed(1)}%`
                }
              }
            },
            scales: {
              x: {
                type: "linear",
                min: props.points[0]?.at,
                max: props.points[props.points.length - 1]?.at,
                ticks: {
                  maxTicksLimit: 6,
                  callback: value =>
                    new Date(Number(value)).toLocaleTimeString(props.locale, { hour: "2-digit", minute: "2-digit" })
                },
                grid: { display: false }
              },
              y: { min: 0, max: 100, ticks: { stepSize: 25, callback: value => `${value}%` } }
            }
          }}
        />
      </div>
    </div>
  );
}

export default function ServerMonitor({ locale }: { locale: string }) {
  const _ = useLocalizer("judge_machine.server");
  // App locale IDs use underscores; browser Intl APIs require BCP 47 tags.
  const dateLocale = locale.replace(/_/g, "-");
  const [hours, setHours] = useState(1);
  const [snapshot, setSnapshot] = useState<ServerMonitorSnapshot>();
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [now, setNow] = useState(Date.now());
  const previousHours = useRef(hours);
  useEffect(() => {
    let stopped = false;
    let pending = false;
    if (previousHours.current !== hours) {
      setSnapshot(undefined);
      setFailed(false);
      previousHours.current = hours;
    }
    setLoading(true);
    async function refresh() {
      if (pending || document.visibilityState !== "visible") return;
      pending = true;
      try {
        const { requestError, response } = await getServerMonitor({ hours });
        if (stopped) return;
        if (requestError || !response || response.unavailable) setFailed(true);
        else {
          setSnapshot(response);
          setFailed(false);
        }
      } catch {
        if (!stopped) setFailed(true);
      } finally {
        pending = false;
        if (!stopped) {
          setLoading(false);
          setNow(Date.now());
        }
      }
    }
    void refresh();
    const timer = setInterval(() => {
      setNow(Date.now());
      void refresh();
    }, 15000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [hours, refreshVersion]);
  return (
    <section className={style.section} aria-label={_(".title")}>
      <div className={style.header}>
        <Header as="h2" icon="dashboard" content={_(".title")} />
        <div className={style.controls}>
          <Button.Group size="small">
            {[1, 6, 24].map(value => (
              <Button
                key={value}
                type="button"
                active={hours === value}
                aria-pressed={hours === value}
                onClick={() => setHours(value)}
              >
                {_(`.range_${value}`)}
              </Button>
            ))}
          </Button.Group>
          <Button
            type="button"
            basic
            size="small"
            icon="refresh"
            aria-label={_(".refresh")}
            title={_(".refresh")}
            loading={loading}
            onClick={() => setRefreshVersion(value => value + 1)}
          />
        </div>
      </div>
      <p className={style.hint}>{_(".hint")}</p>
      {failed && <Message warning content={_(".unavailable")} />}
      {loading && !snapshot && (
        <Segment>
          <Loader active inline="centered" />
        </Segment>
      )}
      {!loading && !failed && snapshot?.servers.length === 0 && <Message content={_(".empty")} />}
      {snapshot?.servers.map(server => {
        const stale = failed || now - server.latest.at > 35000;
        const percent = (value: number | null) => (value === null || stale ? "—" : `${value.toFixed(1)}%`);
        const gib = (bytes: number) => (bytes / 1024 ** 3).toFixed(2);
        return (
          <Segment key={server.id} className={style.server}>
            {snapshot.servers.length > 1 && (
              <Header as="h3">
                {_(".title")} · {server.id}
              </Header>
            )}
            <div className={style.metrics}>
              <div>
                <span>{_(".cpu")}</span>
                <strong>{percent(server.latest.cpuPercent)}</strong>
              </div>
              <div>
                <span>{_(".memory")}</span>
                <strong>{percent(server.latest.memoryPercent)}</strong>
                <small>
                  {gib(server.latest.memoryUsedBytes)} / {gib(server.latest.memoryTotalBytes)} GiB
                </small>
              </div>
              <div className={style.updated}>
                <Label basic color={stale ? "orange" : "green"}>
                  {_(stale ? ".stale" : ".live")}
                </Label>
                <time dateTime={new Date(server.latest.at).toISOString()}>
                  {new Date(server.latest.at).toLocaleString(dateLocale)}
                </time>
              </div>
            </div>
            <div className={style.charts}>
              <ResourceChart points={server.points} metric="cpuPercent" title={_(".cpu")} locale={dateLocale} />
              <ResourceChart points={server.points} metric="memoryPercent" title={_(".memory")} locale={dateLocale} />
            </div>
            <p className={style.hint}>{_(`.resolution_${snapshot.bucketSeconds}`)}</p>
          </Segment>
        );
      })}
    </section>
  );
}
