import React, { useEffect, useMemo, useState } from "react";
import { Button, Form, Header, Label, Loader, Menu, Message, Modal, Segment } from "semantic-ui-react";

import { appState } from "@/appState";
import { useLocalizer } from "@/utils/hooks";
import StatusText from "@/components/StatusText";

import { HackRecord, hackApi } from "./api";
import style from "./HackPanel.module.less";

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

  if (!records.length) return <Message content={_(".empty_records")} />;
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
          <div className={style.recordHeader}>
            <div className={style.recordDetails}>
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
              <span>{new Date(record.createdAt).toLocaleString()}</span>
            </div>
            {(own || record.canDownload) && (
              <div className={style.recordActions}>
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
              </div>
            )}
          </div>
          <div>
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

function useMyHacks(enabled: boolean, refresh: number, created?: HackRecord) {
  const [records, setRecords] = useState<HackRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const latest = records.find(row => row.id === created?.id) ?? created;
  const waiting = isPending(latest) || records.some(isPending);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const load = async () => {
      const { response } = await hackApi.mine({});
      if (!active) return;
      if (response) setRecords(response);
      setLoadError(!response);
      setLoading(false);
    };
    void load();
    const timer = window.setInterval(load, waiting ? 3000 : 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [enabled, waiting, refresh]);

  return { records, latest, waiting, loading, loadError };
}

function MyHackRecords() {
  const _ = useLocalizer("hack");
  const [refresh, setRefresh] = useState(0);
  const { records, loading, loadError } = useMyHacks(true, refresh);
  if (loading) return <Loader active inline="centered" />;
  return (
    <>
      {loadError && <Message negative content={_(".error")} />}
      {(!loadError || records.length > 0) && (
        <HackRows records={records} own onChange={() => setRefresh(value => value + 1)} />
      )}
    </>
  );
}

export function MyHacksMenuItem({ problemId, contestId }: { problemId: number; contestId?: number }) {
  const _ = useLocalizer("hack");
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    hackApi.targets({ problemId, contestId }).then(({ response }) => {
      if (active) setEnabled(!!response?.enabled);
    });
    return () => {
      active = false;
    };
  }, [problemId, contestId]);

  if (!enabled) return null;
  return (
    <>
      <Menu.Item
        as="button"
        type="button"
        link
        icon="history"
        content={_(".mine")}
        style={{ width: "100%", textAlign: "left" }}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      />
      {open && (
        <Modal open closeIcon onClose={() => setOpen(false)}>
          <Modal.Header>{_(".mine")}</Modal.Header>
          <Modal.Content scrolling>
            <MyHackRecords />
          </Modal.Content>
        </Modal>
      )}
    </>
  );
}

function cleanInput(input: string) {
  const start = input.trimStart();
  const text = start.trimEnd();
  if (!text) return "";
  const cleaned = text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n[ \n]*/g, "\n");
  return /[\r\n]/.test(start.slice(text.length)) ? cleaned + "\n" : cleaned;
}

export function HackSubmissionPanel({
  id,
  contestId,
  eligible,
  onChange
}: {
  id: number;
  contestId?: number;
  eligible: boolean;
  onChange?: () => void;
}) {
  const _ = useLocalizer("hack");
  const [limit, setLimit] = useState<number>();
  const [input, setInput] = useState("");
  const [cleanWhitespace, setCleanWhitespace] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<HackRecord>();
  const [refresh, setRefresh] = useState(0);
  const { latest, waiting } = useMyHacks((eligible && limit != null) || !!created, refresh, created);
  const submittedInput = useMemo(() => (cleanWhitespace ? cleanInput(input) : input), [cleanWhitespace, input]);
  const bytes = useMemo(() => new TextEncoder().encode(submittedInput).length, [submittedInput]);
  const targetWasHacked = latest?.state === "Succeeded" && !latest.revokedAt;
  const showForm = eligible && limit != null && !targetWasHacked;

  useEffect(() => {
    if (!eligible) return;
    let active = true;
    setLimit(undefined);
    hackApi.target({ id, contestId }).then(({ response }) => {
      if (active) setLimit(response?.target?.inputLimit);
    });
    return () => {
      active = false;
    };
  }, [id, contestId, eligible]);

  useEffect(() => {
    if (targetWasHacked) onChange?.();
  }, [targetWasHacked, onChange]);

  if (!showForm && !latest) return null;

  const submit = async () => {
    if (!showForm || busy || waiting || bytes > limit) return;
    setBusy(true);
    setError("");
    try {
      const { response, errorCode } = await hackApi.create({ id, input: submittedInput });
      if (response) {
        setCreated(response);
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
      {showForm && (
        <Form onSubmit={submit}>
          <Form.TextArea
            id="hack-input"
            label={_(".input")}
            value={input}
            onChange={(_, { value }) => setInput(String(value))}
          />
          <Form.Checkbox
            id="hack-clean-whitespace"
            label={_(".clean_whitespace")}
            checked={cleanWhitespace}
            onChange={(_, { checked }) => setCleanWhitespace(!!checked)}
          />
          <p>{_(".size", { bytes, limit })}</p>
          <Button type="submit" primary loading={busy} disabled={busy || waiting || bytes > limit}>
            {_(".send")}
          </Button>
        </Form>
      )}
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
      <Header as="h3" content={_(".history")} />
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
