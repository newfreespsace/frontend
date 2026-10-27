import React, { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { Dropdown, Icon, Label } from "semantic-ui-react";

import { Link, useLocalizer } from "@/utils/hooks";

import { notificationApi, NotificationItem } from "./api";
import { notificationState } from "./state";
import style from "./notifications.module.less";

function NotificationBell() {
  const _ = useLocalizer("notifications");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    let stopped = false;
    setLoading(true);
    void notificationApi.query({ take: 5 }).then(result => {
      if (stopped) return;
      setFailed(!result.response);
      setItems(result.response?.items || []);
      setLoading(false);
    });
    return () => {
      stopped = true;
    };
  }, [open, notificationState.revision]);
  return (
    <Dropdown
      item
      icon={null}
      className={style.bell}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      aria-label={_(".unread_count", { count: notificationState.unread })}
      trigger={
        <span>
          <Icon name="bell outline" />
          {notificationState.unread > 0 && (
            <Label color="red" circular size="mini">
              {notificationState.unread > 99 ? "99+" : notificationState.unread}
            </Label>
          )}
        </span>
      }
    >
      <Dropdown.Menu className={style.bellMenu}>
        <Dropdown.Header content={_(".title")} />
        {loading ? (
          <Dropdown.Item disabled text={_(".loading")} />
        ) : failed ? (
          <Dropdown.Item disabled text={_(".error")} />
        ) : !items.length ? (
          <Dropdown.Item disabled text={_(".empty")} />
        ) : (
          items.map(item => (
            <Dropdown.Item
              key={item.id}
              as={Link}
              href={`/notifications?open=${item.id}`}
              onClick={() => setOpen(false)}
            >
              <div className={style.bellPreview}>
                {!item.readAt && <Icon name="circle" color="blue" size="tiny" />}
                {item.body}
              </div>
            </Dropdown.Item>
          ))
        )}
        <Dropdown.Divider />
        <Dropdown.Item as={Link} href="/notifications" onClick={() => setOpen(false)} text={_(".all")} />
      </Dropdown.Menu>
    </Dropdown>
  );
}
export default observer(NotificationBell);
