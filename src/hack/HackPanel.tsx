import React, { useEffect, useState } from "react";
import { Button, Form, Header, Label, Message, Segment } from "semantic-ui-react";

import { appState } from "@/appState";
import { useLocalizer } from "@/utils/hooks";
import StatusText from "@/components/StatusText";

import { HackRecord, HackTarget, hackApi } from "./api";

const isPending = (record: HackRecord) => record?.state === "Queued" || record?.state === "Running";

function saveFile(name: string, content: string) {
  const bytes = Uint8Array.from(window.atob(content), character => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function HackRows({ records, onChange, own }: { records: HackRecord[]; onChange: () => void; own?: boolean }) {
  const _ = useLocalizer("hack");
  const [busy, setBusy] = useState<number>();
  const [selectedInput, setSelectedInput] = useState<string>();
  const [notice, setNotice] = useState<{ error: boolean; text: string }>();

  const act = async (id: number, operation: () => Promise<void>) => {
    setBusy(id);
    setNotice(undefined);
    try {
      await operation();
    } catch {
      setNotice({ error: true, text: _(".error") });
    } finally {
      setBusy(undefined);
    }
  };

  const download = async (id: number, input: boolean) => {
    const { response } = await hackApi.download({ id, input, output: !input });
    if (!response) throw new Error();
    if (response.error) {
      setNotice({ error: true, text: _(".download_limit") });
    } else {
      response.files.forEach(file => saveFile(file.name, file.data));
      if (response.remaining != null) setNotice({ error: false, text: _(".remaining", { count: response.remaining }) });
    }
  };

  return (
    <>
      {notice && <Message negative={notice.error} info={!notice.error} content={notice.text} />}
      {selectedInput != null && (
        <Segment secondary>
          <Button size="mini" floated="right" onClick={() => setSelectedInput(undefined)}>
            {_(".close")}
          </Button>
          <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{selectedInput}</pre>
        </Segment>
      )}
      {records.map(record => (
        <Segment key={record.id}>
          <Label>
            #{record.id}
            {own && " / #" + record.targetSubmissionId}
          </Label>
          <Label color={record.state === "Succeeded" ? "green" : undefined}>{_(`.state.${record.state}`)}</Label>
          {record.verdict && (
            <Label basic>
              <StatusText status={record.verdict} />
            </Label>
          )}
          {record.revokedAt && <Label basic>{_(".revoked")}</Label>}
          {record.recheckFailed && (
            <Label basic color="red">
              {_(".recheck_failed")}
            </Label>
          )}
          {record.challengerId != null && <Label basic>#{record.challengerId}</Label>}
          <span> {new Date(record.createdAt).toLocaleString()}</span>
          <div>
            {own && (
              <Button
                size="mini"
                disabled={busy === record.id}
                onClick={() =>
                  act(record.id, async () => {
                    const { response } = await hackApi.mine({ id: record.id });
                    if (response?.[0]?.input == null) throw new Error();
                    setSelectedInput(response[0].input);
                  })
                }
              >
                {_(".input")}
              </Button>
            )}
            {record.canDownload &&
              [true, false].map(input => (
                <Button
                  key={String(input)}
                  size="mini"
                  disabled={busy === record.id}
                  onClick={() => act(record.id, () => download(record.id, input))}
                >
                  {_(input ? ".download_input" : ".download_output")}
                </Button>
              ))}
            {record.canCancel && (
              <Button
                size="mini"
                disabled={busy === record.id}
                onClick={() =>
                  act(record.id, async () => {
                    if (!(await hackApi.cancel({ id: record.id })).response?.success) throw new Error();
                    onChange();
                  })
                }
              >
                {_(".cancel")}
              </Button>
            )}
            {record.canRevoke && (
              <Button
                size="mini"
                disabled={busy === record.id}
                onClick={() => {
                  const reason = window.prompt(_(".revoke_reason"))?.trim();
                  if (reason)
                    void act(record.id, async () => {
                      if (!(await hackApi.revoke({ id: record.id, reason })).response?.success) throw new Error();
                      onChange();
                    });
                }}
              >
                {_(".revoke")}
              </Button>
            )}
          </div>
        </Segment>
      ))}
    </>
  );
}

export function HackProblemPanel({ problemId, contestId }: { problemId: number; contestId?: number }) {
  const _ = useLocalizer("hack");
  const user = appState.currentUser?.id;
  const [enabled, setEnabled] = useState(false);
  const [limit, setLimit] = useState(0);
  const [targets, setTargets] = useState<HackTarget[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [target, setTarget] = useState<number>();
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showMine, setShowMine] = useState(false);
  const [records, setRecords] = useState<HackRecord[]>([]);
  const [latest, setLatest] = useState<HackRecord>();
  const [refresh, setRefresh] = useState(0);
  const waiting = isPending(latest) || records.some(isPending);

  useEffect(() => {
    if (!user) return;
    let active = true;
    hackApi.targets({ problemId, contestId }).then(({ response }) => {
      if (!active) return;
      setEnabled(!!response?.enabled);
      setLimit(response?.inputLimit ?? 0);
      setTargets(response?.targets ?? []);
      setHasMore(response?.targets.length === 30);
    });
    return () => {
      active = false;
    };
  }, [problemId, contestId, user, refresh]);

  useEffect(() => {
    if (!user || !enabled) return;
    let active = true;
    const load = async () => {
      const { response } = await hackApi.mine({});
      if (!active || !response) return;
      setRecords(response);
      setLatest(previous => response.find(row => row.id === previous?.id) ?? previous);
    };
    void load();
    const timer = window.setInterval(load, waiting ? 3000 : 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [user, enabled, waiting, refresh]);

  if (!user || !enabled) return null;
  const bytes = new TextEncoder().encode(input).length;

  const submit = async () => {
    if (!target || busy || waiting || bytes > limit) return;
    setBusy(true);
    setError("");
    try {
      const { response, errorCode } = await hackApi.create({ id: target, input });
      if (response) {
        setLatest(response);
        setRefresh(value => value + 1);
      } else setError(errorCode ? _(`.errors.${errorCode}`) : _(".error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Segment>
      <Header as="h3" content={_(".title")} />
      {error && <Message negative content={error} />}
      {latest && <Message info content={`#${latest.id} · ${_(`.state.${latest.state}`)}`} />}
      <Form onSubmit={submit}>
        <Form.Dropdown
          selection
          search
          label={_(".target")}
          value={target ?? ""}
          onChange={(_, { value }) => setTarget(Number(value))}
          options={targets.map(row => ({
            key: row.id,
            value: row.id,
            text: `#${row.id} · ${row.language} · ${new Date(row.time).toLocaleString()}`
          }))}
        />
        {!targets.length && <Message content={_(".empty_targets")} />}
        {hasMore && (
          <Button
            type="button"
            size="mini"
            onClick={async () => {
              const { response } = await hackApi.targets({
                problemId,
                contestId,
                before: targets[targets.length - 1].id
              });
              if (response) {
                setTargets([...targets, ...response.targets]);
                setHasMore(response.targets.length === 30);
              }
            }}
          >
            {_(".more")}
          </Button>
        )}
        <Form.TextArea label={_(".input")} value={input} onChange={(_, { value }) => setInput(String(value))} />
        <p>{_(".size", { bytes, limit })}</p>
        <Button primary loading={busy} disabled={!target || busy || waiting || bytes > limit}>
          {_(".send")}
        </Button>
        <Button type="button" onClick={() => setShowMine(!showMine)}>
          {_(".mine")}
        </Button>
      </Form>
      {showMine &&
        (records.length ? (
          <HackRows records={records} own onChange={() => setRefresh(value => value + 1)} />
        ) : (
          <Message content={_(".empty_records")} />
        ))}
    </Segment>
  );
}

export function HackHistory({ id, onChange }: { id: number; onChange: () => void }) {
  const _ = useLocalizer("hack");
  const user = appState.currentUser?.id;
  const [records, setRecords] = useState<HackRecord[]>([]);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!user) return;
    let active = true;
    let previous: string;
    const load = async () => {
      const { response } = await hackApi.history({ id });
      if (!active || !response) return;
      const effective = response
        .filter(row => row.state === "Succeeded")
        .map(row => `${row.id}:${row.revokedAt ?? ""}`)
        .join(",");
      if (previous !== undefined && previous !== effective) onChange();
      previous = effective;
      setRecords(response);
    };
    void load();
    const timer = window.setInterval(load, 10000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [id, user, onChange, refresh]);

  if (!records.length) return null;
  return (
    <Segment>
      <Header as="h3" content={_(".title")} />
      <HackRows
        records={records}
        onChange={() => {
          onChange();
          setRefresh(value => value + 1);
        }}
      />
    </Segment>
  );
}
