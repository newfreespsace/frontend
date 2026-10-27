import React, { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { Button, Checkbox, Form, Header, Label, Loader, Message, Modal, Segment } from "semantic-ui-react";
import { v4 as uuid } from "uuid";

import { defineRoute, RouteError } from "@/AppRouter";
import { appState } from "@/appState";
import { makeToBeLocalizedText } from "@/locales";
import { Link, useLocalizer } from "@/utils/hooks";
import { notificationApi, NotificationHistoryItem, SendNotification } from "@/notifications/api";
import style from "@/notifications/notifications.module.less";

function freshDraft(): SendNotification {
  return { body: "", targetPath: "", audience: "users", usernames: [], push: false, requestId: uuid() };
}

function NotificationAdminPage() {
  const _ = useLocalizer("notifications");
  const [draft, setDraft] = useState(freshDraft);
  const [names, setNames] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [history, setHistory] = useState<NotificationHistoryItem[]>([]);
  const [selected, setSelected] = useState<NotificationHistoryItem>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const update = (values: Partial<SendNotification>) => {
    setDraft(current => ({ ...current, ...values, requestId: uuid() }));
    setSuccess("");
  };
  useEffect(() => {
    appState.enterNewPage(_(".admin"));
    void notificationApi.pushStatus().then(result => setConfigured(!!result.response?.enabled));
  }, []);
  useEffect(() => {
    let stopped = false;
    setLoading(true);
    void notificationApi.history({ skip: (page - 1) * 20, take: 20 }).then(result => {
      if (stopped) return;
      if (result.response) {
        setHistory(result.response.items);
        setTotal(result.response.total);
      } else setError(_(".error"));
      setLoading(false);
    });
    return () => {
      stopped = true;
    };
  }, [page, revision]);
  const preview = () => {
    setError("");
    setSuccess("");
    if (
      !draft.body.trim() ||
      (draft.audience === "users" && !draft.usernames.length) ||
      (draft.audience === "group" && (!Number.isSafeInteger(draft.groupId) || draft.groupId < 1)) ||
      (draft.targetPath &&
        (!draft.targetPath.startsWith("/") || draft.targetPath.startsWith("//") || /[\\\s]/.test(draft.targetPath)))
    ) {
      setError(_(".validation"));
      return;
    }
    setConfirming(true);
  };
  const send = async () => {
    setBusy(true);
    setError("");
    try {
      const request = {
        ...draft,
        usernames: draft.audience === "users" ? draft.usernames : [],
        groupId: draft.audience === "group" ? draft.groupId : undefined
      };
      const result = await notificationApi.send(request);
      if (!result.response) {
        setError(result.requestError ? result.requestError(_) : _(".error"));
        return;
      }
      setConfirming(false);
      setSuccess(_(".send_success", { count: result.response.recipientCount }));
      setDraft(freshDraft());
      setNames("");
      setPage(1);
      setRevision(value => value + 1);
    } finally {
      setBusy(false);
    }
  };
  const audienceLabel =
    draft.audience === "all"
      ? _(".audience_all")
      : draft.audience === "group"
      ? `${_(".group_id")} ${draft.groupId}`
      : draft.usernames.join(", ");
  return (
    <>
      <Header as="h1" content={_(".admin")} />
      <Button as={Link} href="/notifications" icon="arrow left" content={_(".title")} />
      <Segment>
        <Form onSubmit={preview}>
          <Form.Select
            aria-label={_(".recipient")}
            label={_(".recipient")}
            value={draft.audience}
            disabled={busy}
            options={[
              { value: "users", text: _(".audience_users") },
              { value: "group", text: _(".audience_group") },
              { value: "all", text: _(".audience_all") }
            ]}
            onChange={(_event, data) => update({ audience: data.value as SendNotification["audience"] })}
          />
          {draft.audience === "users" && (
            <Form.TextArea
              required
              id="notification-usernames"
              label={_(".usernames")}
              value={names}
              disabled={busy}
              rows={2}
              onChange={(_event, data) => {
                const value = String(data.value);
                setNames(value);
                update({ usernames: [...new Set(value.split(/[\s,，;；]+/).filter(Boolean))] });
              }}
            />
          )}
          {draft.audience === "group" && (
            <Form.Input
              required
              type="number"
              min={1}
              id="notification-group-id"
              label={_(".group_id")}
              value={draft.groupId || ""}
              disabled={busy}
              onChange={(_event, data) => update({ groupId: Number(data.value) })}
            />
          )}
          <Form.TextArea
            required
            id="notification-body"
            label={_(".body")}
            maxLength={10000}
            rows={6}
            value={draft.body}
            disabled={busy}
            onChange={(_event, data) => update({ body: String(data.value) })}
          />
          <Form.Input
            id="notification-link"
            label={_(".link")}
            maxLength={500}
            placeholder="/c/123"
            value={draft.targetPath}
            disabled={busy}
            onChange={(_event, data) => update({ targetPath: data.value })}
          />
          <p className={style.meta}>{_(".link_hint")}</p>
          <Form.Field>
            <Checkbox
              label={_(".send_push")}
              checked={draft.push}
              disabled={busy || !configured}
              onChange={(_event, data) => update({ push: !!data.checked })}
            />
          </Form.Field>
          {!configured && <Message content={_(".push_unconfigured")} />}
          <p>{_(".send_note")}</p>
          <Button primary type="submit" disabled={busy}>
            {_(".preview")}
          </Button>
        </Form>
        {error && <Message negative content={error} />}
        {success && <Message positive content={success} />}
      </Segment>
      <Header as="h2" content={_(".history")} />
      <Button
        icon="refresh"
        disabled={loading}
        aria-label={_(".refresh")}
        onClick={() => setRevision(value => value + 1)}
      />
      {loading && <Loader active inline="centered" />}
      {!loading && !history.length && <Message content={_(".no_history")} />}
      {history.map(item => (
        <Segment key={item.id}>
          <div className={style.item}>
            <p className={style.previewBody}>{item.body}</p>
            <Label>{_(".recipient_count", { count: item.recipientCount })}</Label>
          </div>
          <div className={style.meta}>
            {new Date(item.createdAt).toLocaleString()} ·{" "}
            {item.audience === "all" ? _(".audience_all") : item.audienceLabel} ·{" "}
            {_(item.push ? ".push_yes" : ".push_no")}
          </div>
          <Button size="small" onClick={() => setSelected(item)}>
            {_(".history_content")}
          </Button>
        </Segment>
      ))}
      {total > 20 && (
        <div className={style.pagination}>
          <Button disabled={page === 1 || loading} onClick={() => setPage(value => value - 1)}>
            {_(".previous")}
          </Button>
          <span>{_(".page", { page, total })}</span>
          <Button disabled={page * 20 >= total || loading} onClick={() => setPage(value => value + 1)}>
            {_(".next")}
          </Button>
        </div>
      )}
      <Modal
        open={confirming}
        onClose={() => {
          if (!busy) setConfirming(false);
        }}
        size="small"
        closeOnDimmerClick={!busy}
        closeOnEscape={!busy}
      >
        <Modal.Header>{_(".confirm_title")}</Modal.Header>
        <Modal.Content>
          <p>{_(".confirm_description")}</p>
          <p>
            <strong>{_(".recipient")}：</strong>
            {audienceLabel}
          </p>
          <div className={style.messageBody}>{draft.body}</div>
          {draft.targetPath && <p>{draft.targetPath}</p>}
          {error && <Message negative content={error} />}
        </Modal.Content>
        <Modal.Actions>
          <Button disabled={busy} onClick={() => setConfirming(false)}>
            {_(".cancel")}
          </Button>
          <Button
            primary
            loading={busy}
            disabled={busy}
            onClick={() => {
              void send();
            }}
          >
            {_(draft.audience === "all" ? ".confirm_all" : ".send")}
          </Button>
        </Modal.Actions>
      </Modal>
      <Modal open={!!selected} onClose={() => setSelected(null)} size="small" closeIcon>
        <Modal.Header>{_(".history_content")}</Modal.Header>
        <Modal.Content>
          <div className={style.messageBody}>{selected?.body}</div>
          {selected?.targetPath && <p>{selected.targetPath}</p>}
        </Modal.Content>
        <Modal.Actions>
          <Button onClick={() => setSelected(null)}>{_(".close")}</Button>
        </Modal.Actions>
      </Modal>
    </>
  );
}
const ObservedPage = observer(NotificationAdminPage);
export default defineRoute(async () => {
  if (!appState.currentUser?.isAdmin) throw new RouteError(makeToBeLocalizedText("common.request_error.403"));
  return <ObservedPage />;
});
