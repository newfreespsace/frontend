import React from "react";
import { Message } from "semantic-ui-react";
import { useLocalizer } from "@/utils/hooks";
import FormattableCodeBox from "@/pages/submission/submission/common/FormattableCodeBox";
import { CodeLanguage } from "@/interfaces/CodeLanguage";
import { RemoteInfo } from "./api";

export default function RemoteSubmissionDetails(props: {
  remote: RemoteInfo;
  content: unknown;
  codeRef?: React.Ref<HTMLPreElement>;
}) {
  const _ = useLocalizer("remote_judge");
  const content = props.content as { code?: string; language?: CodeLanguage };
  const hasSource = typeof content?.code === "string" && content.code.length > 0;
  const remote = props.remote;
  const sourceMessage =
    remote.platform === "AtCoder"
      ? hasSource
        ? ".atcoder_source_available"
        : remote.sourceStatus === "Failed"
        ? ".atcoder_source_failed"
        : ".atcoder_source_pending"
      : hasSource
      ? ".test_details_unavailable"
      : ".details_unavailable";
  const testset = remote.testset?.replace(/\d+$/, "");
  const testsetNumber = remote.testset?.match(/\d+$/)?.[0];
  return (
    <>
      <Message info>
        <Message.Header>
          {_(".source_record")} · {remote.platform}
        </Message.Header>
        <p>
          {remote.language} · {remote.handle} · {remote.verdict}
        </p>
        {remote.points != null && <p>{_(".raw_points", { points: remote.points })}</p>}
        {remote.passedTestCount != null && <p>{_(".passed_tests", { count: remote.passedTestCount })}</p>}
        {remote.testset && (
          <p>{_(".test_stage", { stage: _(`.testset.${testset}`) + (testsetNumber ? ` ${testsetNumber}` : "") })}</p>
        )}
        <p>
          <a href={remote.url} target="_blank" rel="noopener noreferrer">
            {remote.platform} #{remote.id}
          </a>
        </p>
        <p
          role={remote.platform === "AtCoder" && !hasSource && remote.sourceStatus === "Failed" ? "status" : undefined}
        >
          {_(sourceMessage)}
        </p>
        {remote.platform === "AtCoder" && !hasSource && remote.sourceStatus === "Failed" && (
          <>
            {remote.sourceError && <p>{_(".sync_error_code", { code: remote.sourceError })}</p>}
            {remote.sourceRetryAt && (
              <p>{_(".next_retry", { time: new Date(remote.sourceRetryAt).toLocaleString() })}</p>
            )}
          </>
        )}
      </Message>
      {hasSource && <FormattableCodeBox code={content.code} language={content.language} ref={props.codeRef} />}
    </>
  );
}
