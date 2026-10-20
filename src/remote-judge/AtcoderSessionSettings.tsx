import React, { useEffect, useState } from "react";
import { Button, Form, Header, Message, Segment } from "semantic-ui-react";
import { useLocalizer } from "@/utils/hooks";
import toast from "@/utils/toast";
import { remoteAdminApi, RemoteJudgeSettings } from "./admin-api";

export default function AtcoderSessionSettings(props: { initialSettings?: RemoteJudgeSettings }) {
  const _ = useLocalizer("site_settings");
  const [settings, setSettings] = useState(props.initialSettings);
  const [session, setSession] = useState("");
  const [pending, setPending] = useState<"save" | "clear">();
  const normalized = session.trim().replace(/^REVEL_SESSION=/, "");
  const valid = !!normalized && normalized.length <= 8192 && !/[;\s]/.test(normalized);
  const status = settings?.atcoderSessionStatus || (settings?.atcoderSessionConfigured ? "unchecked" : "missing");
  const unreadable = settings?.atcoderSessionError === "REMOTE_SESSION_UNREADABLE";

  useEffect(() => {
    if (pending) return;
    let stopped = false;
    let inFlight = false;
    const refresh = async () => {
      if (inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        const { response } = await remoteAdminApi.getSettings();
        if (!stopped && response?.settings) setSettings(response.settings);
      } catch {
        // Keep the last observed state when the status request fails.
      } finally {
        inFlight = false;
      }
    };
    const timer = setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [pending]);

  async function update(clear: boolean) {
    if (pending || (!clear && !valid)) return;
    setPending(clear ? "clear" : "save");
    try {
      const { response, requestError } = await remoteAdminApi.updateSettings(
        clear ? { clearAtcoderSession: true } : { atcoderSession: normalized }
      );
      if (requestError) toast.error(requestError(_));
      else if (response?.error) toast.error(_(`.errors.${response.error}`));
      else if (response?.settings) {
        setSettings(response.settings);
        setSession("");
        toast.success(_(".atcoder_session_saved"));
      }
    } finally {
      setPending(undefined);
    }
  }

  return (
    <Segment>
      <Header as="h2">{_(".atcoder_sync")}</Header>
      <Message
        negative={status === "expired" || unreadable}
        warning={status === "unavailable" && !unreadable}
        positive={status === "valid"}
        info={status === "missing" || status === "unchecked"}
        role={status === "expired" || status === "unavailable" ? "alert" : undefined}
        content={_(
          status === "expired"
            ? ".atcoder_session_expired"
            : unreadable
            ? ".atcoder_session_unreadable"
            : status === "unavailable"
            ? ".atcoder_session_unavailable"
            : status === "valid"
            ? ".atcoder_session_valid"
            : settings?.atcoderSessionConfigured
            ? settings.atcoderSessionSource === "environment"
              ? ".atcoder_session_environment"
              : ".atcoder_session_configured"
            : ".atcoder_session_missing"
        )}
      />
      {settings?.atcoderSessionLastCheckedAt && (
        <p>
          {_(".atcoder_session_checked_at", {
            time: new Date(settings.atcoderSessionLastCheckedAt).toLocaleString()
          })}
        </p>
      )}
      {status === "expired" && (
        <Button as="a" href="https://atcoder.jp/login" target="_blank" rel="noopener noreferrer">
          {_(".atcoder_session_login")}
        </Button>
      )}
      <Form onSubmit={() => update(false)}>
        <Form.Input
          id="atcoder-sync-session"
          label={_(".atcoder_session")}
          type="password"
          autoComplete="new-password"
          value={session}
          disabled={!!pending}
          onChange={(_, { value }) => setSession(value)}
          error={!!session && !valid}
        />
        <p>{_(".atcoder_session_help")}</p>
        <p>{_(".atcoder_session_keep")}</p>
        <Button primary type="submit" loading={pending === "save"} disabled={!!pending || !valid}>
          {_(".atcoder_session_save")}
        </Button>
        <Button
          type="button"
          loading={pending === "clear"}
          disabled={!!pending || !settings?.atcoderSessionConfigured}
          onClick={() => update(true)}
        >
          {_(".atcoder_session_clear")}
        </Button>
      </Form>
    </Segment>
  );
}
