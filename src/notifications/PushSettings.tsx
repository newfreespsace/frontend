import React, { useEffect, useState } from "react";
import { Button, Header, Message, Segment } from "semantic-ui-react";

import { useLocalizer } from "@/utils/hooks";
import { appState } from "@/appState";

import { browserBinding } from "./binding";
import { notificationApi } from "./api";
import { browserPushErrorKey, browserPushSupported, disableBrowserPush, enableBrowserPush } from "./push";

export default function PushSettings() {
  const _ = useLocalizer("notifications");
  const [active, setActive] = useState(false);
  const [configured, setConfigured] = useState<boolean>(null);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState("");
  const [offline, setOffline] = useState(navigator.onLine === false);
  const connectionFailure = ["push_network_error", "push_subscription_timeout"].includes(errorKey);
  const supported = browserPushSupported();
  useEffect(() => {
    let stopped = false;
    let updateNumber = 0;
    const update = async () => {
      const number = ++updateNumber;
      try {
        const [status, binding] = await Promise.all([
          notificationApi.pushStatus(),
          supported ? browserBinding() : null
        ]);
        if (stopped || number !== updateNumber) return;
        if (!status.response) {
          if (navigator.onLine !== false) setErrorKey("push_error");
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
        if (!stopped && number === updateNumber && navigator.onLine !== false) setErrorKey("push_error");
      }
    };
    const changed = () => {
      void update();
    };
    const online = () => {
      setOffline(false);
      void update();
    };
    const disconnected = () => setOffline(true);
    void update();
    window.addEventListener("nsoj-push-changed", changed);
    window.addEventListener("online", online);
    window.addEventListener("offline", disconnected);
    return () => {
      stopped = true;
      window.removeEventListener("nsoj-push-changed", changed);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", disconnected);
    };
  }, []);
  const change = async () => {
    setBusy(true);
    setErrorKey("");
    try {
      if (active) {
        await disableBrowserPush();
        setActive(false);
      } else {
        await enableBrowserPush();
        setActive(true);
      }
    } catch (failure) {
      setErrorKey(browserPushErrorKey(failure));
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
          {active && <p>{_(".push_enabled_hint")}</p>}
          {offline && <Message warning content={_(".push_offline")} />}
          <Button
            primary={!active}
            loading={busy}
            disabled={busy || configured === null || (!configured && !active) || (offline && !active)}
            onClick={change}
          >
            {_(active ? ".push_disable" : connectionFailure ? ".push_retry" : ".push_enable")}
          </Button>
          {configured && <Message info header={_(".push_network_hint_title")} content={_(".push_network_hint")} />}
        </>
      )}
      {errorKey && (
        <Message
          negative
          header={connectionFailure ? _(".push_connection_error_title") : undefined}
          content={_("." + errorKey)}
        />
      )}
    </Segment>
  );
}
