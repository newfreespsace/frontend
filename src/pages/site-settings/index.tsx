import React, { useEffect, useState } from "react";
import { Button, Checkbox, Form, Header, Icon, Segment } from "semantic-ui-react";
import { observer } from "mobx-react";

import api from "@/api";
import { defineRoute, RouteError } from "@/AppRouter";
import { appState } from "@/appState";
import { makeToBeLocalizedText } from "@/locales";
import { useLocalizer } from "@/utils/hooks";
import toast from "@/utils/toast";

async function fetchData() {
  const { requestError, response } = await api.siteSetting.getPreference();

  if (requestError) throw new RouteError(requestError, { showRefresh: true, showBack: true });
  else if (response.error)
    throw new RouteError(makeToBeLocalizedText(`site_settings.errors.${response.error}`), {
      showRefresh: true,
      showBack: true
    });

  return response;
}

type SiteSettingsPageProps = Omit<ApiTypes.GetSitePreferenceResponseDto, "error">;

const SiteSettingsPage: React.FC<SiteSettingsPageProps> = props => {
  const _ = useLocalizer("site_settings");

  useEffect(() => {
    appState.enterNewPage(_(".title"));
  }, [appState.locale]);

  const [allowRegister, setAllowRegister] = useState(props.preference.security.allowRegister);
  const [hideSubmissionTestcaseDetailsForNormalUsers, setHideSubmissionTestcaseDetailsForNormalUsers] = useState(
    props.preference.security.hideSubmissionTestcaseDetailsForNormalUsers
  );
  const [pending, setPending] = useState(false);
  const [otherSubmissionCodeMinAcceptedProblems, setOtherSubmissionCodeMinAcceptedProblems] = useState(
    String(props.preference.security.otherSubmissionCodeMinAcceptedProblems)
  );
  const threshold = Number(otherSubmissionCodeMinAcceptedProblems);
  const thresholdValid =
    otherSubmissionCodeMinAcceptedProblems.trim() !== "" && Number.isSafeInteger(threshold) && threshold >= 0;

  async function onSubmit() {
    if (pending) return;
    if (!thresholdValid) return toast.error(_(".other_submission_code_min_accepted_problems_invalid"));
    setPending(true);

    const { requestError, response } = await api.siteSetting.updatePreference({
      preference: {
        security: {
          allowRegister,
          hideSubmissionTestcaseDetailsForNormalUsers,
          otherSubmissionCodeMinAcceptedProblems: threshold
        }
      }
    });

    if (requestError) toast.error(requestError(_));
    else if (response.error) toast.error(_(`.errors.${response.error}`));
    else {
      appState.serverPreference = response.preference;
      toast.success(_(".success"));
    }

    setPending(false);
  }

  return (
    <>
      <Header as="h1">{_(".header")}</Header>
      <Segment>
        <Form>
          <Form.Field>
            <Checkbox
              toggle
              label={_(".allow_register")}
              checked={allowRegister}
              onChange={(e, { checked }) => setAllowRegister(!!checked)}
            />
          </Form.Field>
          <Form.Field>
            <Checkbox
              toggle
              label={_(".hide_submission_testcase_details_for_normal_users")}
              checked={hideSubmissionTestcaseDetailsForNormalUsers}
              onChange={(e, { checked }) => setHideSubmissionTestcaseDetailsForNormalUsers(!!checked)}
            />
          </Form.Field>
          <Form.Input
            type="number"
            min={0}
            step={1}
            label={_(".other_submission_code_min_accepted_problems")}
            value={otherSubmissionCodeMinAcceptedProblems}
            onChange={(e, { value }) => setOtherSubmissionCodeMinAcceptedProblems(value)}
            error={!thresholdValid}
          />
          <p>{_(".other_submission_code_min_accepted_problems_hint")}</p>
          <Button primary loading={pending} disabled={!thresholdValid} onClick={onSubmit}>
            <Icon name="save" />
            {_(".save")}
          </Button>
        </Form>
      </Segment>
    </>
  );
};

export default defineRoute(async () => <SiteSettingsPage {...await fetchData()} />);
