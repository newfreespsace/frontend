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
  const [pending, setPending] = useState(false);

  async function onSubmit() {
    if (pending) return;
    setPending(true);

    const { requestError, response } = await api.siteSetting.updatePreference({
      preference: {
        security: {
          allowRegister
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
          <Button primary loading={pending} onClick={onSubmit}>
            <Icon name="save" />
            {_(".save")}
          </Button>
        </Form>
      </Segment>
    </>
  );
};

export default defineRoute(async () => <SiteSettingsPage {...await fetchData()} />);
