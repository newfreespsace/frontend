import React, { useEffect, useState } from "react";
import { Button, Form, Header, Message, Segment, Popup } from "semantic-ui-react";
import { appState } from "@/appState";
import { Link, useLocalizer } from "@/utils/hooks";
import { RouteError } from "@/AppRouter";
import { makeToBeLocalizedText } from "@/locales";
import toast from "@/utils/toast";
import { remoteApi, RemoteAccount, SubmissionMethod } from "@/remote-judge/api";

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
          {account.importingHistory && <p>{_(".importing_history")}</p>}
          {account.lastSyncedAt && (
            <p>{_(".last_synced", { time: new Date(account.lastSyncedAt).toLocaleString() })}</p>
          )}
          {account.lastError && (
            <Message warning role={sessionUnavailable ? "alert" : undefined}>
              {_(sessionUnavailable ? ".atcoder_session_expired" : ".sync_delayed")}
              {sessionUnavailable && appState.currentUser?.isAdmin && (
                <p>
                  <Link href="/site-settings">{_(".update_atcoder_session")}</Link>
                </p>
              )}
            </Message>
          )}
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
  useEffect(() => {
    appState.enterNewPage(_(".accounts"), null, false);
  }, [appState.locale]);
  return (
    <>
      <Header as="h1">{_(".accounts")}</Header>
      <Message info content={_(".account_help")} />
      {!props.enabled && <Message warning content={_(".sync_paused")} />}
      {(["Codeforces", "AtCoder"] as SubmissionMethod[]).map(platform => (
        <BindingCard
          key={platform}
          platform={platform}
          account={accounts.find(account => account.platform === platform)}
          onChange={setAccounts}
        />
      ))}
    </>
  );
}
