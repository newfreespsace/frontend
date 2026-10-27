import React, { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import { Button, Modal } from "semantic-ui-react";

import { appState } from "@/appState";
import { getAuthToken } from "@/authToken";
import { useLocalizer } from "@/utils/hooks";
import toast from "@/utils/toast";

import { notificationApi } from "./api";
import { browserBinding } from "./binding";
import { browserPushSupported, enableBrowserPush } from "./push";
import {
  PUSH_PROMPT_CHANGED_EVENT,
  PUSH_PROMPT_STORAGE_PREFIX,
  rememberPushPromptChoice,
  shouldOfferBrowserPush
} from "./pushPromptPreference";

function BrowserPushPrompt() {
  const _ = useLocalizer("notifications");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const userId = appState.currentUser?.id;
  const token = appState.token;
  const restricted = appState.activeGroupContests.length > 0;
  const eligible = !!(userId && token && !restricted && browserPushSupported());

  useEffect(() => {
    setOpen(false);
    if (!eligible) return;
    let stopped = false;
    let checking = false;
    const check = async () => {
      if (stopped || busyRef.current) return;
      if (getAuthToken() !== token || !shouldOfferBrowserPush(userId)) {
        setOpen(false);
        return;
      }
      if (document.visibilityState !== "visible" || checking) return;
      if (Notification.permission === "denied") {
        rememberPushPromptChoice(userId, "denied");
        return;
      }
      checking = true;
      try {
        const [status, binding] = await Promise.all([notificationApi.pushStatus(), browserBinding()]);
        if (stopped || busyRef.current || getAuthToken() !== token) return;
        if (!status.response?.enabled || !shouldOfferBrowserPush(userId)) {
          setOpen(false);
          return;
        }
        const active =
          Notification.permission === "granted" &&
          binding?.userId === userId &&
          status.response.subscriptions.some(
            item => item.id === binding.id && item.bindingVersion === binding.bindingVersion
          );
        if (active) {
          rememberPushPromptChoice(userId, "allowed");
          return;
        }
        if (document.visibilityState === "visible") setOpen(true);
      } catch {
        // A failed status check must not interrupt a visit with a permission prompt.
      } finally {
        checking = false;
      }
    };
    const recheck = () => {
      void check();
    };
    const storageChanged = (event: StorageEvent) => {
      if (event.key === null || event.key === PUSH_PROMPT_STORAGE_PREFIX + userId) recheck();
    };
    recheck();
    window.addEventListener(PUSH_PROMPT_CHANGED_EVENT, recheck);
    window.addEventListener("storage", storageChanged);
    window.addEventListener("focus", recheck);
    window.addEventListener("pageshow", recheck);
    document.addEventListener("visibilitychange", recheck);
    return () => {
      stopped = true;
      window.removeEventListener(PUSH_PROMPT_CHANGED_EVENT, recheck);
      window.removeEventListener("storage", storageChanged);
      window.removeEventListener("focus", recheck);
      window.removeEventListener("pageshow", recheck);
      document.removeEventListener("visibilitychange", recheck);
    };
  }, [userId, token, eligible]);

  const choose = (choice: "denied" | "later") => {
    rememberPushPromptChoice(userId, choice);
    setOpen(false);
  };
  const allow = async () => {
    // enableBrowserPush calls requestPermission before its first await, preserving
    // the click gesture required by browsers. Never request permission on mount.
    busyRef.current = true;
    setBusy(true);
    try {
      await enableBrowserPush();
    } catch (failure) {
      if (getAuthToken() !== token) return;
      const key = (failure as Error).message;
      if (key !== "push_deferred")
        toast.warning(
          _(["push_unsupported", "push_denied", "push_unconfigured"].includes(key) ? "." + key : ".push_error")
        );
    } finally {
      busyRef.current = false;
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <Modal open={eligible && open} size="small" closeOnDimmerClick={false} closeOnEscape={false}>
      <Modal.Header>{_(".push_prompt_title")}</Modal.Header>
      <Modal.Content>
        <p>{_(".push_prompt_description")}</p>
        <p>{_(".push_prompt_hint")}</p>
      </Modal.Content>
      <Modal.Actions>
        <Button disabled={busy} onClick={() => choose("denied")}>
          {_(".push_prompt_deny")}
        </Button>
        <Button disabled={busy} onClick={() => choose("later")}>
          {_(".push_prompt_later")}
        </Button>
        <Button
          primary
          loading={busy}
          disabled={busy}
          onClick={() => {
            void allow();
          }}
        >
          {_(".push_prompt_allow")}
        </Button>
      </Modal.Actions>
    </Modal>
  );
}

export default observer(BrowserPushPrompt);
