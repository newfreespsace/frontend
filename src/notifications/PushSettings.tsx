import React, { useEffect, useState } from "react";
import { Button, Header, Message, Segment } from "semantic-ui-react";

import { useLocalizer } from "@/utils/hooks";
import { appState } from "@/appState";

import { browserBinding } from "./binding";
import { notificationApi } from "./api";
import { browserPushSupported, disableBrowserPush, enableBrowserPush } from "./push";

export default function PushSettings() {
  const _ = useLocalizer("notifications");
  const [active, setActive] = useState(false);
  const [configured, setConfigured] = useState<boolean>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const supported = browserPushSupported();
  useEffect(() => {
    let stopped = false;
    const update = async () => {
      try {
        const [status, binding] = await Promise.all([
          notificationApi.pushStatus(),
          supported ? browserBinding() : null
        ]);
        if (stopped) return;
        if (!status.response) {
          setError(_(".push_error"));
          return;
        }
        setConfigured(status.response.enabled);
        setActive(
          supported &&
            Notification.permission === "granted" &&
            binding?.userId === appState.currentUser?.id &&
            status.response.subscriptions.some(
              item => item.id === binding.id && item.bindingVersion === binding.bindingVersion
            )
        );
      } catch {
        if (!stopped) setError(_(".push_error"));
      }
    };
    const changed = () => {
      void update();
    };
    void update();
    window.addEventListener("nsoj-push-changed", changed);
    return () => {
      stopped = true;
      window.removeEventListener("nsoj-push-changed", changed);
    };
  }, []);
  const change = async () => {
    setBusy(true);
    setError("");
    try {
      if (active) {
        await disableBrowserPush();
        setActive(false);
      } else {
        await enableBrowserPush();
        setActive(true);
      }
    } catch (failure) {
      const key = (failure as Error).message;
      setError(
        _(
          ["push_unsupported", "push_denied", "push_unconfigured", "push_deferred"].includes(key)
            ? "." + key
            : ".push_error"
        )
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Segment>
      <Header as="h3" icon="bell outline" content={_(".push_title")} />
      <p>{_(".push_description")}</p>
      {!supported ? (
        <Message content={_(".push_unsupported")} />
      ) : (
        <>
          {configured === false && <Message content={_(".push_unconfigured")} />}
          <p>{_(active ? ".push_enabled" : ".push_disabled")}</p>
          <Button
            primary={!active}
            loading={busy}
            disabled={busy || configured === null || (!configured && !active)}
            onClick={change}
          >
            {_(active ? ".push_disable" : ".push_enable")}
          </Button>
        </>
      )}
      {error && <Message negative content={error} />}
    </Segment>
  );
}
