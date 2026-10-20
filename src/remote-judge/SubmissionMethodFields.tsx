import React from "react";
import { Form, Message } from "semantic-ui-react";
import { useLocalizer } from "@/utils/hooks";
import { SubmissionMethod } from "./api";

export interface SubmissionMethodFieldsProps {
  method: SubmissionMethod;
  url: string;
  fullScore: string;
  disabled?: boolean;
  onChange: (value: { method: SubmissionMethod; url: string; fullScore: string }) => void;
}

export default function SubmissionMethodFields(props: SubmissionMethodFieldsProps) {
  const _ = useLocalizer("remote_judge");
  return (
    <Form>
      <Form.Select
        label={_(".submission_method")}
        value={props.method}
        disabled={props.disabled}
        options={["Local", "Codeforces", "AtCoder"].map(value => ({ key: value, value, text: _(`.method.${value}`) }))}
        onChange={(_, { value }) =>
          props.onChange({ method: value as SubmissionMethod, url: props.url, fullScore: props.fullScore })
        }
      />
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
