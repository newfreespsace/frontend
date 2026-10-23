import React, { useState } from "react";
import { Button, Form, Message } from "semantic-ui-react";
import { useLocalizer } from "@/utils/hooks";
import { remoteApi, RemoteAccount } from "@/remote-judge/api";

export default function AtcoderSessionSettings(props: {
  account?: RemoteAccount;
  onChange: (accounts: RemoteAccount[]) => void;
}) {
  const _ = useLocalizer("remote_judge");
  const [session, setSession] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const value = session.trim().replace(/^REVEL_SESSION=/, "");
  const valid =
    !!value &&
    value.length <= 8192 &&
    !/[;\s]/.test(value) &&
    Array.from(value).every(character => character.charCodeAt(0) >= 33 && character.charCodeAt(0) <= 126);
  async function save(clear: boolean) {
    if (pending || (!clear && !valid)) return;
    setPending(true);
    setError("");
    try {
      const { response, requestError } = await remoteApi.setAtcoderSession(
        clear ? { clear: true } : { atcoderSession: value }
      );
      if (requestError) setError(requestError(_));
      else if (response?.error) setError(_(`.error.${response.error}`));
      else if (response?.accounts) {
        setSession("");
        props.onChange(response.accounts);
      }
    } catch {
      setError(_(".atcoder_session_save_failed"));
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <Message
        info
        content={_(
          !props.account
            ? ".atcoder_connect_intro"
            : props.account.atcoderSessionConfigured
            ? ".atcoder_personal_configured"
            : ".atcoder_personal_missing"
        )}
      />
      <Form onSubmit={() => save(false)}>
        <Form.Input
          id="atcoder-personal-session"
          label="REVEL_SESSION"
          type="password"
          autoComplete="new-password"
          value={session}
          disabled={pending}
          onChange={(_, { value }) => setSession(value)}
        />
        <p>
          {_(props.account ? ".atcoder_personal_help" : ".atcoder_connect_help", { handle: props.account?.handle })}
        </p>
        <Button as="a" href="https://atcoder.jp/login" target="_blank" rel="noopener noreferrer">
          {_(".atcoder_open_login")}
        </Button>
        <Button primary type="submit" loading={pending} disabled={pending || !valid}>
          {_(props.account ? ".atcoder_personal_save" : ".atcoder_connect")}
        </Button>
        {props.account && (
          <Button
            type="button"
            disabled={pending || !props.account.atcoderSessionConfigured}
            onClick={() => save(true)}
          >
            {_(".atcoder_personal_clear")}
          </Button>
        )}
      </Form>
      {error && <Message negative role="alert" content={error} />}
    </>
  );
}
