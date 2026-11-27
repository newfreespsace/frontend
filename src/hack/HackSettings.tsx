import React, { useEffect, useState } from "react";
import { Button, Form, Header, Message, Segment } from "semantic-ui-react";

import { CodeLanguage, compileAndRunOptions } from "@/interfaces/CodeLanguage";
import { useLocalizer } from "@/utils/hooks";

import { HackProfile, Program, hackApi } from "./api";

const createProgram = (language: CodeLanguage, code = ""): Program => ({
  language,
  code,
  compileAndRunOptions: Object.fromEntries(
    (compileAndRunOptions[language] ?? []).map(option => [option.name, option.defaultValue])
  )
});

export default function HackSettings({ problemId }: { problemId: number }) {
  const _ = useLocalizer("hack");
  const [profile, setProfile] = useState<HackProfile>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string }>();

  useEffect(() => {
    let active = true;
    hackApi.profile({ id: problemId }).then(({ response }) => {
      if (active && response)
        setProfile({
          ...response,
          validator: response.validator ?? createProgram(CodeLanguage.Cpp),
          reference: response.reference ?? createProgram(CodeLanguage.Cpp)
        });
    });
    return () => {
      active = false;
    };
  }, [problemId]);

  if (!profile) return null;

  const save = async () => {
    setBusy(true);
    try {
      const { response, errorCode } = await hackApi.saveProfile({
        ...profile,
        validator: profile.validator.code ? profile.validator : undefined,
        reference: profile.reference.code ? profile.reference : undefined
      });
      setMessage({
        error: !response?.success,
        text: response?.success ? _(".saved") : errorCode ? _(`.errors.${errorCode}`) : _(".error")
      });
    } finally {
      setBusy(false);
    }
  };

  const program = (key: "validator" | "reference") => {
    const value = profile[key];
    return (
      <>
        <Form.Dropdown
          selection
          label={_(`.${key}`)}
          value={value.language}
          options={Object.values(CodeLanguage).map(language => ({
            key: language,
            value: language,
            text: language
          }))}
          onChange={(_, { value: language }) =>
            setProfile({ ...profile, [key]: createProgram(language as CodeLanguage, value.code) })
          }
        />
        <Form.TextArea
          value={value.code}
          aria-label={_(`.${key}`)}
          onChange={(_, { value: code }) => setProfile({ ...profile, [key]: { ...value, code: String(code) } })}
        />
      </>
    );
  };

  return (
    <Segment>
      <Header as="h3" content={_(".settings")} />
      {message && <Message negative={message.error} positive={!message.error} content={message.text} />}
      <Form onSubmit={save}>
        <Form.Checkbox
          toggle
          label={_(".enabled")}
          checked={profile.enabled}
          onChange={(_, { checked }) => setProfile({ ...profile, enabled: !!checked })}
        />
        <Form.Input
          type="number"
          min={1}
          max={4 * 1024 * 1024}
          label={_(".input_limit")}
          value={profile.inputLimit}
          onChange={(_, { value }) => setProfile({ ...profile, inputLimit: Number(value) })}
        />
        {program("validator")}
        <p>{_(".validator_exit")}</p>
        {program("reference")}
        <Button loading={busy} disabled={busy || !profile.inputLimit} primary>
          {_(".save")}
        </Button>
      </Form>
    </Segment>
  );
}
