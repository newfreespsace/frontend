import React, { useEffect, useId, useState } from "react";
import { Button, Form, Header, Message, Segment } from "semantic-ui-react";

import { CodeLanguage, compileAndRunOptions } from "@/interfaces/CodeLanguage";
import { useLocalizer } from "@/utils/hooks";

import { HackProfile, Program, hackApi } from "./api";
import style from "./HackSettings.module.less";

const createProgram = (language: CodeLanguage, code = ""): Program => ({
  language,
  code,
  compileAndRunOptions: Object.fromEntries(
    (compileAndRunOptions[language] ?? []).map(option => [option.name, option.defaultValue])
  )
});

export default function HackSettings({ problemId }: { problemId: number }) {
  const _ = useLocalizer("hack");
  const codeLanguage = useLocalizer("code_language");
  const formId = useId();
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
    const label = _(`.${key}`);
    const headingId = `${formId}-${key}`;
    return (
      <section className={style.program} aria-labelledby={headingId}>
        <Header as="h4" id={headingId} content={label} />
        <Form.Select
          className={style.language}
          selection
          aria-label={`${label} · ${codeLanguage(".code_language")}`}
          value={value.language}
          options={Object.values(CodeLanguage).map(language => ({
            key: language,
            value: language,
            text: codeLanguage(`.${language}.name`)
          }))}
          onChange={(_, { value: language }) =>
            setProfile({ ...profile, [key]: createProgram(language as CodeLanguage, value.code) })
          }
        />
        <Form.TextArea
          className={style.source}
          rows={9}
          value={value.code}
          aria-label={label}
          aria-describedby={key === "validator" ? `${formId}-validator-help` : undefined}
          onChange={(_, { value: code }) => setProfile({ ...profile, [key]: { ...value, code: String(code) } })}
        />
        {key === "validator" && (
          <p className={style.description} id={`${formId}-validator-help`}>
            {_(".validator_exit")}
          </p>
        )}
      </section>
    );
  };

  return (
    <Segment>
      <Header as="h3" content={_(".settings")} />
      {message && <Message negative={message.error} positive={!message.error} content={message.text} />}
      <Form onSubmit={save}>
        <div className={style.controls}>
          <Form.Checkbox
            id={`${formId}-enabled`}
            toggle
            label={_(".enabled")}
            checked={profile.enabled}
            onChange={(_, { checked }) => setProfile({ ...profile, enabled: !!checked })}
          />
          <Form.Input
            id={`${formId}-input-limit`}
            className={style.inputLimit}
            type="number"
            min={1}
            max={4 * 1024 * 1024}
            label={_(".input_limit")}
            value={profile.inputLimit}
            onChange={(_, { value }) => setProfile({ ...profile, inputLimit: Number(value) })}
          />
        </div>
        <div className={style.programs}>
          {program("validator")}
          {program("reference")}
        </div>
        <Button loading={busy} disabled={busy || !profile.inputLimit} primary>
          {_(".save")}
        </Button>
      </Form>
    </Segment>
  );
}
