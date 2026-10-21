import React, { useState } from "react";
import { Button, Form, Message } from "semantic-ui-react";
import { useLocalizer } from "@/utils/hooks";
import { remoteApi, RemoteAccount } from "@/remote-judge/api";

export default function CodeforcesSourceSettings(props: {
  account: RemoteAccount;
  onChange: (accounts: RemoteAccount[]) => void;
}) {
  const _ = useLocalizer("remote_judge");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const valid = [apiKey.trim(), apiSecret.trim()].every(value => /^[a-zA-Z0-9]{1,256}$/.test(value));
  async function save(clear: boolean) {
    if (pending || (!clear && !valid)) return;
    setPending(true);
    setError("");
    try {
      const { response, requestError } = await remoteApi.setCodeforcesCredentials(
        clear ? { clear: true } : { apiKey: apiKey.trim(), apiSecret: apiSecret.trim() }
      );
      if (requestError) setError(requestError(_));
      else if (response?.error) setError(_(`.error.${response.error}`));
      else if (response?.accounts) {
        setApiKey("");
        setApiSecret("");
        props.onChange(response.accounts);
      }
    } catch {
      setError(_(".cf_credentials_save_failed"));
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <Message info content={_(props.account.codeforcesSourceEnabled ? ".cf_source_enabled" : ".cf_source_optional")} />
      {props.account.codeforcesSourceError && (
        <Message warning role="alert">
          <p>
            {_(
              props.account.codeforcesSourceError === "REMOTE_CF_SOURCE_MISSING"
                ? ".cf_source_missing"
                : ["REMOTE_CF_SOURCE_INVALID", "REMOTE_CF_SOURCE_TOO_LARGE"].includes(
                    props.account.codeforcesSourceError
                  )
                ? ".cf_source_response_invalid"
                : ".cf_source_failed"
            )}
          </p>
          <p>{_(".sync_error_code", { code: props.account.codeforcesSourceError })}</p>
          {props.account.codeforcesSourceRetryAt && (
            <p>{_(".next_retry", { time: new Date(props.account.codeforcesSourceRetryAt).toLocaleString() })}</p>
          )}
        </Message>
      )}
      <p>
        <a href="https://codeforces.com/settings/api" target="_blank" rel="noopener noreferrer">
          {_(".cf_api_settings")}
        </a>
      </p>
      <Form onSubmit={() => save(false)}>
        <Form.Input
          id="cf-api-key"
          label="API Key"
          type="password"
          autoComplete="new-password"
          value={apiKey}
          disabled={pending}
          onChange={(_, { value }) => setApiKey(value)}
        />
        <Form.Input
          id="cf-api-secret"
          label="API Secret"
          type="password"
          autoComplete="new-password"
          value={apiSecret}
          disabled={pending}
          onChange={(_, { value }) => setApiSecret(value)}
        />
        <p>{_(".cf_credentials_help")}</p>
        <Button primary type="submit" loading={pending} disabled={pending || !valid}>
          {_(".cf_credentials_save")}
        </Button>
        <Button type="button" disabled={pending || !props.account.codeforcesSourceEnabled} onClick={() => save(true)}>
          {_(".cf_credentials_clear")}
        </Button>
      </Form>
      {error && <Message negative role="alert" content={error} />}
    </>
  );
}
