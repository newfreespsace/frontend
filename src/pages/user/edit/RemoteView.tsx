import React, { useEffect, useRef, useState } from "react";
import { Button, Form, Header, Message, Segment, Popup } from "semantic-ui-react";
import { appState } from "@/appState";
import { Link, useLocalizer } from "@/utils/hooks";
import { RouteError } from "@/AppRouter";
import { makeToBeLocalizedText } from "@/locales";
import toast from "@/utils/toast";
import { remoteApi, RemoteAccount, SubmissionMethod } from "@/remote-judge/api";
import CodeforcesSourceSettings from "@/remote-judge/CodeforcesSourceSettings";

export async function fetchData(username: string) {
  if (username !== appState.currentUser?.username)
    throw new RouteError(makeToBeLocalizedText("remote_judge.own_account_only"));
  const { response, requestError } = await remoteApi.accounts({});
  if (requestError) throw new RouteError(requestError);
  return response;
}

function BindingCard({
  platform,
  account,
  onChange
}: {
  platform: SubmissionMethod;
  account?: RemoteAccount;
  onChange: (accounts: RemoteAccount[]) => void;
}) {
  const _ = useLocalizer("remote_judge");
  const [handle, setHandle] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const sessionUnavailable =
    platform === "AtCoder" && ["REMOTE_AUTH_REQUIRED", "REMOTE_SESSION_UNREADABLE"].includes(account?.lastError);
  const syncErrorMessage = sessionUnavailable
    ? ".atcoder_session_expired"
    : account?.lastError === "REMOTE_ACCESS_DENIED"
    ? ".sync_access_denied"
    : account?.lastError === "REMOTE_RATE_LIMITED"
    ? ".sync_rate_limited"
    : account?.lastError === "REMOTE_API_FAILED"
    ? ".sync_api_failed"
    : ".sync_delayed";
  async function run(action: "begin" | "verify" | "unbind") {
    setPending(true);
    setError("");
    const result =
      action === "begin"
        ? await remoteApi.beginBinding({ platform, handle })
        : action === "verify"
        ? await remoteApi.verifyBinding({ platform })
        : await remoteApi.unbind({ platform });
    setPending(false);
    if (result.requestError) toast.error(result.requestError(_));
    else if (result.response?.error) setError(_(`.error.${result.response.error}`));
    else if (action === "begin") setCode((result.response as { code: string }).code);
    else {
      setCode("");
      onChange((result.response as { accounts: RemoteAccount[] }).accounts);
    }
  }
  return (
    <Segment>
      <Header>{platform}</Header>
      {account ? (
        <>
          <p>{_(".bound_as", { handle: account.handle })}</p>
          {account.importingHistory && !account.lastError && <p>{_(".importing_history")}</p>}
          {account.lastSyncedAt && (
            <p>{_(".last_synced", { time: new Date(account.lastSyncedAt).toLocaleString() })}</p>
          )}
          {account.lastError && (
            <Message warning role={sessionUnavailable ? "alert" : undefined}>
              {_(syncErrorMessage)}
              <p>{_(".sync_error_code", { code: account.lastError })}</p>
              {account.nextSyncAt && <p>{_(".next_retry", { time: new Date(account.nextSyncAt).toLocaleString() })}</p>}
              {sessionUnavailable && appState.currentUser?.isAdmin && (
                <p>
                  <Link href="/site-settings">{_(".update_atcoder_session")}</Link>
                </p>
              )}
            </Message>
          )}
          {platform === "Codeforces" && <CodeforcesSourceSettings account={account} onChange={onChange} />}
          <Popup
            on="click"
            trigger={<Button disabled={pending} content={_(".unbind")} />}
            content={<Button negative loading={pending} onClick={() => run("unbind")} content={_(".confirm_unbind")} />}
          />
        </>
      ) : (
        <>
          <Form onSubmit={() => run("begin")}>
            <Form.Input
              label={_(".handle")}
              value={handle}
              disabled={pending || !!code}
              onChange={(_, { value }) => setHandle(value)}
            />
            {!code && <Button primary loading={pending} disabled={!handle} content={_(".get_code")} />}
          </Form>
          {code && (
            <>
              <Message info>
                <p>{_(".verification_help", { field: platform === "Codeforces" ? "Organization" : "Affiliation" })}</p>
                <code style={{ overflowWrap: "anywhere" }}>{code}</code>
                <p>
                  <a
                    href={
                      platform === "Codeforces"
                        ? "https://codeforces.com/settings/social"
                        : "https://atcoder.jp/settings"
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {_(".open_profile_settings")}
                  </a>
                </p>
              </Message>
              <Button primary loading={pending} onClick={() => run("verify")} content={_(".verify")} />
              <Button disabled={pending} onClick={() => setCode("")} content={_(".restart_binding")} />
            </>
          )}
        </>
      )}
      {error && <Message negative content={error} />}
    </Segment>
  );
}

export function View(props: { accounts: RemoteAccount[]; enabled: boolean }) {
  const _ = useLocalizer("remote_judge");
  const [accounts, setAccounts] = useState(props.accounts);
  const [enabled, setEnabled] = useState(props.enabled);
  const revision = useRef(0);
  useEffect(() => {
    appState.enterNewPage(_(".accounts"), null, false);
  }, [appState.locale]);
  useEffect(() => {
    let stopped = false;
    let inFlight = false;
    const refresh = async () => {
      if (inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      const version = revision.current;
      try {
        // Read saved progress only; visiting this page must not create extra upstream requests.
        const { response } = await remoteApi.accounts({});
        if (!stopped && version === revision.current && response?.accounts) {
          setAccounts(response.accounts);
          setEnabled(response.enabled);
        }
      } catch {
        // Retain the last observed state if the status request fails.
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
  }, []);
  const updateAccounts = (next: RemoteAccount[]) => {
    revision.current++;
    setAccounts(next);
  };
  return (
    <>
      <Header as="h1">{_(".accounts")}</Header>
      <Message info content={_(".account_help")} />
      {!enabled && <Message warning content={_(".sync_paused")} />}
      {(["Codeforces", "AtCoder"] as SubmissionMethod[]).map(platform => (
        <BindingCard
          key={platform}
          platform={platform}
          account={accounts.find(account => account.platform === platform)}
          onChange={updateAccounts}
        />
      ))}
    </>
  );
}
