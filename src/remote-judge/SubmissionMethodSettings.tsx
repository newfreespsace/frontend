import React, { useEffect, useState } from "react";
import { Button, Checkbox, Header, Message, Segment } from "semantic-ui-react";
import { Link, useLocalizer } from "@/utils/hooks";
import toast from "@/utils/toast";
import { isRemoteProblem, remoteApi } from "./api";
import { appState } from "@/appState";
import { getProblemUrl } from "@/pages/problem/utils";
import SubmissionMethodFields from "./SubmissionMethodFields";

export default function SubmissionMethodSettings({
  meta,
  submittable
}: {
  meta: ApiTypes.ProblemMetaDto;
  submittable?: boolean;
}) {
  const _ = useLocalizer("remote_judge");
  const [value, setValue] = useState({
    method: meta.submissionMethod || "Local",
    url: meta.remoteProblem?.url || "",
    fullScore: meta.remoteProblem?.fullScore?.toString() || ""
  });
  useEffect(() => {
    if (isRemoteProblem(meta))
      appState.enterNewPage(`${_("problem_judge_settings.title")} P${meta.id}`, "problem_set", false);
  }, [meta.id, appState.locale]);
  const [enabled, setEnabled] = useState(submittable ?? true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    setPending(true);
    setError("");
    const { response, requestError } = await remoteApi.setMethod({
      problemId: meta.id,
      submissionMethod: value.method,
      remoteUrl: value.method === "Local" ? undefined : value.url,
      remoteFullScore: value.fullScore ? Number(value.fullScore) : undefined,
      submittable: submittable == null ? undefined : enabled
    });
    setPending(false);
    if (requestError) toast.error(requestError(_));
    else if (response?.error) setError(_(`.error.${response.error}`));
    else window.location.reload();
  }
  return (
    <Segment>
      <Header>{_(".submission_method")}</Header>
      {isRemoteProblem(meta) && (
        <p>
          <Link href={getProblemUrl(meta)}>{_(".back_to_problem")}</Link>
        </p>
      )}
      <SubmissionMethodFields
        {...{ method: value.method, url: value.url, fullScore: value.fullScore }}
        disabled={pending}
        onChange={setValue}
      />
      {submittable != null && (
        <p>
          <Checkbox
            toggle
            checked={enabled}
            disabled={pending}
            label={_(".submittable")}
            onChange={(_, { checked }) => setEnabled(checked)}
          />
        </p>
      )}
      {error && <Message negative content={error} />}
      <Button primary loading={pending} onClick={save} content={_(".save")} />
    </Segment>
  );
}
