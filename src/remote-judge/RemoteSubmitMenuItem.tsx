import React, { useEffect, useRef, useState } from "react";
import { Button, Menu, Popup } from "semantic-ui-react";
import { appState } from "@/appState";
import { useLocalizer, Link, useLoginOrRegisterNavigation } from "@/utils/hooks";
import { remoteApi, RemoteStatus, RemoteContext } from "./api";

export default function RemoteSubmitMenuItem(props: {
  meta: ApiTypes.ProblemMetaDto;
  context: RemoteContext;
  canSubmit: boolean;
  className?: string;
  onResult?: () => void;
}) {
  const _ = useLocalizer("remote_judge");
  const common = useLocalizer("problem");
  const navigateToLogin = useLoginOrRegisterNavigation("login");
  const [status, setStatus] = useState<RemoteStatus>();
  const lastResult = useRef<string>();
  const contextKey = JSON.stringify(props.context);
  useEffect(() => {
    setStatus(undefined);
    lastResult.current = undefined;
    if (!appState.currentUser) return;
    let stopped = false;
    let pending = false;
    const context = props.context;
    const activate = () => {
      if (document.visibilityState === "visible") void remoteApi.activate(context);
    };
    async function poll() {
      if (pending || document.visibilityState !== "visible") return;
      pending = true;
      try {
        const { response } = await remoteApi.status(context);
        if (stopped) return;
        if (!response) return;
        setStatus(response);
        const result = response.latest ? `${response.latest.id}:${response.latest.status}` : "none";
        if (lastResult.current && result !== lastResult.current && response.latest?.status !== "Pending")
          props.onResult?.();
        lastResult.current = result;
      } finally {
        pending = false;
      }
    }
    activate();
    void poll();
    const timer = setInterval(poll, 10000);
    const heartbeat = setInterval(activate, 60000);
    const visible = () => {
      activate();
      void poll();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      stopped = true;
      clearInterval(timer);
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [contextKey, appState.currentUser?.id]);
  if (!props.canSubmit) return null;
  const itemProps = {
    className: props.className,
    content: _(".submit_on_platform", { platform: props.meta.submissionMethod }),
    icon: "paper plane" as const
  };
  if (!appState.currentUser)
    return (
      <Popup
        trigger={<Menu.Item {...itemProps} />}
        content={<Button primary content={common(".action.login_to_submit")} onClick={() => navigateToLogin()} />}
        on="click"
        position="top left"
      />
    );
  if (!status) return <Menu.Item {...itemProps} disabled />;
  if (!status.bound)
    return <Menu.Item {...itemProps} as={Link} href={`/u/${appState.currentUser.username}/edit/remote`} />;
  const source = props.meta.remoteProblem;
  const url =
    props.meta.submissionMethod === "Codeforces"
      ? `https://codeforces.com/contest/${source.contestId}/submit?problemIndex=${source.taskId}`
      : `https://atcoder.jp/contests/${source.contestId}/submit?taskScreenName=${source.taskId}`;
  return (
    <Menu.Item
      {...itemProps}
      as="a"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => void remoteApi.activate(props.context)}
    />
  );
}
