import React, { useId } from "react";
import { Form, Message } from "semantic-ui-react";
import { useLocalizer } from "@/utils/hooks";
import { SubmissionMethod } from "./api";

export interface SubmissionMethodFieldsProps {
  method: SubmissionMethod;
  url: string;
  fullScore: string;
  disabled?: boolean;
  hideMethodLabel?: boolean;
  onChange: (value: { method: SubmissionMethod; url: string; fullScore: string }) => void;
}

const submissionMethods: SubmissionMethod[] = ["Local", "Codeforces", "AtCoder"];

export default function SubmissionMethodFields(props: SubmissionMethodFieldsProps) {
  const _ = useLocalizer("remote_judge");
  const radioGroup = useId();
  return (
    <Form>
      <Form.Group inline role="radiogroup" aria-label={_(".submission_method")} style={{ flexWrap: "wrap", rowGap: 8 }}>
        {!props.hideMethodLabel && <label>{_(".submission_method")}</label>}
        {submissionMethods.map(method => (
          <Form.Radio
            key={method}
            id={`${radioGroup}-${method}`}
            name={radioGroup}
            label={_(`.method.${method}`)}
            value={method}
            checked={props.method === method}
            disabled={props.disabled}
            onChange={() => props.onChange({ method, url: props.url, fullScore: props.fullScore })}
          />
        ))}
      </Form.Group>
      {props.method !== "Local" && (
        <>
          <Form.Input
            label={_(".problem_url")}
            value={props.url}
            disabled={props.disabled}
            placeholder={
              props.method === "Codeforces"
                ? "https://codeforces.com/problemset/problem/4/A"
                : "https://atcoder.jp/contests/abc001/tasks/abc001_1"
            }
            onChange={(_, { value }) =>
              props.onChange({ method: props.method, url: value, fullScore: props.fullScore })
            }
          />
          <Form.Input
            label={_(".full_score")}
            type="number"
            min="0.001"
            step="any"
            value={props.fullScore}
            disabled={props.disabled}
            onChange={(_, { value }) => props.onChange({ method: props.method, url: props.url, fullScore: value })}
          />
          <Message info content={_(".source_help")} />
        </>
      )}
    </Form>
  );
}
