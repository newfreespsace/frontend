import React, { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { Button, Checkbox, Form, Header, Label, List, Loader, Message, Modal, Segment } from "semantic-ui-react";
import { v4 as uuid } from "uuid";

import { defineRoute, RouteError } from "@/AppRouter";
import { appState } from "@/appState";
import { makeToBeLocalizedText } from "@/locales";
import { Link, useLocalizer } from "@/utils/hooks";
import UserSearch from "@/components/UserSearch";
import GroupSearch from "@/components/GroupSearch";
import { notificationApi, NotificationHistoryItem, SendNotification } from "@/notifications/api";
import { notificationState } from "@/notifications/state";
import style from "@/notifications/notifications.module.less";

function freshDraft(): SendNotification {
  return { body: "", targetPath: "", audience: "users", usernames: [], groupIds: [], push: false, requestId: uuid() };
}

function NotificationAdminPage() {
  const _ = useLocalizer("notifications");
  const [draft, setDraft] = useState(freshDraft);
  const [groups, setGroups] = useState<ApiTypes.GroupMetaDto[]>([]);
  const [userSearchVersion, setUserSearchVersion] = useState(0);
  const [groupSearchVersion, setGroupSearchVersion] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [history, setHistory] = useState<NotificationHistoryItem[]>([]);
  const [selected, setSelected] = useState<NotificationHistoryItem>(null);
  const [revokeTarget, setRevokeTarget] = useState<NotificationHistoryItem>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const update = (values: Partial<SendNotification>) => {
    setDraft(current => ({ ...current, ...values, requestId: uuid() }));
    setSuccess("");
  };
  const addUser = (user: ApiTypes.UserMetaDto) => {
    if (busy) return;
    if (!draft.usernames.includes(user.username)) {
      if (draft.usernames.length >= 500) {
        setError(_(".selection_limit"));
        return;
      }
      update({ usernames: [...draft.usernames, user.username] });
    }
    setError("");
    setUserSearchVersion(value => value + 1);
  };
  const addGroup = (group: ApiTypes.GroupMetaDto) => {
    if (busy) return;
    if (!groups.some(item => item.id === group.id)) {
      if (groups.length >= 500) {
        setError(_(".selection_limit"));
        return;
      }
      const selected = [...groups, group];
      setGroups(selected);
      update({ groupIds: selected.map(item => item.id) });
    }
    setError("");
    setGroupSearchVersion(value => value + 1);
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
        setSelected(current => (current ? result.response.items.find(item => item.id === current.id) || null : null));
        if (!result.response.items.length && page > 1) setPage(page - 1);
      } else setError(_(".error"));
      setLoading(false);
    });
    return () => {
      stopped = true;
    };
  }, [page, revision, notificationState.revision]);
  const revoke = async () => {
    if (!revokeTarget || busy) return;
    const id = revokeTarget.id;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const result = await notificationApi.revoke({ id });
      if (!result.response?.success) {
        setError(_(".error"));
        return;
      }
      setRevokeTarget(null);
      setSelected(current => (current?.id === id ? null : current));
      setSuccess(_(".revoke_success"));
      setRevision(value => value + 1);
    } catch {
      setError(_(".error"));
    } finally {
      setBusy(false);
    }
  };
  const preview = () => {
    setError("");
    setSuccess("");
    if (
      !draft.body.trim() ||
      (draft.audience === "users" && !draft.usernames.length) ||
      (draft.audience === "group" && !draft.groupIds?.length) ||
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
        groupIds: draft.audience === "group" ? draft.groupIds : [],
        groupId: undefined
      };
      const result = await notificationApi.send(request);
      if (!result.response) {
        setError(result.requestError ? result.requestError(_) : _(".error"));
        return;
      }
      setConfirming(false);
      setSuccess(_(".send_success", { count: result.response.recipientCount }));
      setDraft(freshDraft());
      setGroups([]);
      setUserSearchVersion(value => value + 1);
      setGroupSearchVersion(value => value + 1);
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
      ? groups.map(group => group.name).join(", ")
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
            <Form.Field required disabled={busy}>
              <label>{_(".usernames")}</label>
              <UserSearch
                key={userSearchVersion}
                className={style.recipientSearch}
                placeholder={_(".search_users")}
                disabled={busy || draft.usernames.length >= 500}
                onResultSelect={addUser}
              />
              {!!draft.usernames.length && (
                <List divided relaxed className={style.recipientList}>
                  {draft.usernames.map(username => (
                    <List.Item key={username} className={style.recipientRow}>
                      <span>{username}</span>
                      <Button
                        type="button"
                        size="mini"
                        basic
                        icon="close"
                        aria-label={_(".remove_user", { username })}
                        disabled={busy}
                        onClick={() => update({ usernames: draft.usernames.filter(item => item !== username) })}
                      />
                    </List.Item>
                  ))}
                </List>
              )}
            </Form.Field>
          )}
          {draft.audience === "group" && (
            <Form.Field required disabled={busy}>
              <label>{_(".groups")}</label>
              <GroupSearch
                key={groupSearchVersion}
                className={style.recipientSearch}
                placeholder={_(".search_groups")}
                disabled={busy || groups.length >= 500}
                onResultSelect={addGroup}
              />
              {!!groups.length && (
                <List divided relaxed className={style.recipientList}>
                  {groups.map(group => (
                    <List.Item key={group.id} className={style.recipientRow}>
                      <span>{group.name}</span>
                      <Button
                        type="button"
                        size="mini"
                        basic
                        icon="close"
                        aria-label={_(".remove_group", { name: group.name })}
                        disabled={busy}
                        onClick={() => {
                          const remaining = groups.filter(item => item.id !== group.id);
                          setGroups(remaining);
                          update({ groupIds: remaining.map(item => item.id) });
                        }}
                      />
                    </List.Item>
                  ))}
                </List>
              )}
              <p className={style.meta}>{_(".groups_hint")}</p>
            </Form.Field>
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
            {item.revokedAt && <Label color="grey">{_(".revoked")}</Label>}
          </div>
          <div className={style.meta}>
            {new Date(item.createdAt).toLocaleString()} ·{" "}
            {item.audience === "all" ? _(".audience_all") : item.audienceLabel} ·{" "}
            {_(item.push ? ".push_yes" : ".push_no")}
            {item.revokedAt && <> · {_(".revoked_time", { time: new Date(item.revokedAt).toLocaleString() })}</>}
          </div>
          <Button size="small" onClick={() => setSelected(item)}>
            {_(".history_content")}
          </Button>
          {!item.revokedAt && (
            <Button size="small" basic color="red" disabled={busy} onClick={() => setRevokeTarget(item)}>
              {_(".revoke")}
            </Button>
          )}
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
      <Modal
        open={!!revokeTarget}
        onClose={() => {
          if (!busy) setRevokeTarget(null);
        }}
        size="small"
        closeOnDimmerClick={!busy}
        closeOnEscape={!busy}
      >
        <Modal.Header>{_(".revoke_confirm_title")}</Modal.Header>
        <Modal.Content>
          <p>{_(".revoke_confirm_description")}</p>
          <p>{_(".recipient_count", { count: revokeTarget?.recipientCount || 0 })}</p>
          <div className={style.messageBody}>{revokeTarget?.body}</div>
          {error && <Message negative content={error} />}
        </Modal.Content>
        <Modal.Actions>
          <Button disabled={busy} onClick={() => setRevokeTarget(null)}>
            {_(".cancel")}
          </Button>
          <Button negative loading={busy} disabled={busy} onClick={() => void revoke()}>
            {_(".revoke")}
          </Button>
        </Modal.Actions>
      </Modal>
      <Modal open={!!selected} onClose={() => setSelected(null)} size="small" closeIcon>
        <Modal.Header>{_(".history_content")}</Modal.Header>
        <Modal.Content>
          {selected?.revokedAt && <Message content={_(".revoked")} />}
          <div className={style.messageBody}>{selected?.body}</div>
          {selected?.targetPath && <p>{selected.targetPath}</p>}
        </Modal.Content>
        <Modal.Actions>
          {selected && !selected.revokedAt && (
            <Button
              basic
              color="red"
              disabled={busy}
              onClick={() => {
                setRevokeTarget(selected);
                setSelected(null);
              }}
            >
              {_(".revoke")}
            </Button>
          )}
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
