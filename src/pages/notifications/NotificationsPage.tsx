import React, { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import { Button, Checkbox, Header, Label, Loader, Message, Modal, Segment } from "semantic-ui-react";
import { runInAction } from "mobx";

import { defineRoute } from "@/AppRouter";
import { appState } from "@/appState";
import { Link, useLocalizer } from "@/utils/hooks";
import { notificationApi, NotificationItem } from "@/notifications/api";
import { notificationState } from "@/notifications/state";
import PushSettings from "@/notifications/PushSettings";
import style from "@/notifications/notifications.module.less";

function NotificationsPage({ openId }: { openId?: string }) {
  const _ = useLocalizer("notifications");
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<NotificationItem>(null);
  const [revision, setRevision] = useState(0);
  const requestNumber = useRef(0);
  useEffect(() => {
    appState.enterNewPage(_(".title"));
  }, []);
  useEffect(() => {
    const number = ++requestNumber.current;
    let stopped = false;
    setLoading(true);
    void notificationApi.query({ skip: (page - 1) * 20, take: 20, unreadOnly }).then(result => {
      if (stopped || number !== requestNumber.current) return;
      if (result.response) {
        setItems(result.response.items);
        setTotal(result.response.total);
        setError("");
        if (!result.response.items.length && page > 1) setPage(page - 1);
      } else setError(_(".error"));
      setLoading(false);
    });
    return () => {
      stopped = true;
    };
  }, [page, unreadOnly, revision, notificationState.revision]);
  const markRead = async (item?: NotificationItem) => {
    setBusy(true);
    try {
      const result = await notificationApi.read(item ? { id: item.id } : { all: true });
      if (!result.response) {
        setError(_(".error"));
        return;
      }
      runInAction(() => {
        notificationState.unread = result.response.count;
      });
      if (item)
        setSelected(current => (current?.id === item.id ? { ...current, readAt: new Date().toISOString() } : current));
      setRevision(value => value + 1);
    } finally {
      setBusy(false);
    }
  };
  const open = (item: NotificationItem) => {
    setSelected(item);
    if (!item.readAt) void markRead(item);
  };
  useEffect(() => {
    if (!openId || !/^[0-9a-f-]{36}$/i.test(openId)) return;
    let stopped = false;
    void notificationApi.get({ id: openId }).then(result => {
      if (stopped) return;
      if (result.response) open(result.response.item);
      else setError(_(".error"));
    });
    return () => {
      stopped = true;
    };
  }, [openId]);
  return (
    <>
      <Header as="h1" icon="bell outline" content={_(".title")} />
      <div className={style.toolbar}>
        <Checkbox
          label={_(".unread")}
          checked={unreadOnly}
          onChange={(_event, data) => {
            setUnreadOnly(!!data.checked);
            setPage(1);
          }}
        />
        <Button
          disabled={busy || notificationState.unread === 0}
          onClick={() => {
            void markRead();
          }}
        >
          {_(".mark_all")}
        </Button>
        <Button
          icon="refresh"
          aria-label={_(".refresh")}
          disabled={loading}
          onClick={() => setRevision(value => value + 1)}
        />
        {appState.currentUser?.isAdmin && (
          <Button as={Link} href="/notifications/admin" primary>
            {_(".admin")}
          </Button>
        )}
      </div>
      {error && <Message negative content={error} />}
      {loading && <Loader active inline="centered" />}
      {!loading && !items.length && !error && <Message content={_(".empty")} />}
      {items.map(item => (
        <Segment key={item.id}>
          <div className={style.item}>
            <p className={style.previewBody}>{item.body}</p>
            {!item.readAt && <Label color="blue">{_(".unread_label")}</Label>}
          </div>
          <div className={style.meta}>
            {new Date(item.createdAt).toLocaleString()} · {_(item.readAt ? ".read" : ".unread_label")}
          </div>
          <Button size="small" onClick={() => open(item)}>
            {_(".open")}
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
      <PushSettings />
      <Modal open={!!selected} onClose={() => setSelected(null)} size="small" closeIcon>
        <Modal.Header>{_(".open")}</Modal.Header>
        <Modal.Content>
          <div className={style.messageBody}>{selected?.body}</div>
        </Modal.Content>
        <Modal.Actions>
          {selected && !selected.readAt && (
            <Button
              disabled={busy}
              onClick={() => {
                void markRead(selected);
              }}
            >
              {_(".mark_read")}
            </Button>
          )}
          {selected?.targetPath && (
            <Button primary as={Link} href={selected.targetPath}>
              {_(".go")}
            </Button>
          )}
          <Button onClick={() => setSelected(null)}>{_(".close")}</Button>
        </Modal.Actions>
      </Modal>
    </>
  );
}
const ObservedPage = observer(NotificationsPage);
export default defineRoute(async request => <ObservedPage openId={request.query.open} />);
