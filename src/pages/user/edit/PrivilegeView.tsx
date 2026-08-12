import React, { useState, useEffect } from "react";
import { Header, Checkbox, Button } from "semantic-ui-react";
import { observer } from "mobx-react";

import style from "./UserEdit.module.less";

import api from "@/api";
import { appState } from "@/appState";
import toast from "@/utils/toast";
import { useAsyncCallbackPending, useConfirmNavigation, useLocalizer } from "@/utils/hooks";
import { RouteError } from "@/AppRouter";
import { makeToBeLocalizedText } from "@/locales";

export async function fetchData(username: string) {
  const { requestError, response } = await api.user.getUserMeta({ username, getPrivileges: true });
  if (requestError) throw new RouteError(requestError, { showRefresh: true, showBack: true });
  else if (response.error) throw new RouteError(makeToBeLocalizedText(`user_edit.errors.${response.error}`));

  return response;
}

enum Privilege {
  EditHomepage = "EditHomepage",
  ManageUser = "ManageUser",
  ManageUserGroup = "ManageUserGroup",
  ManageProblem = "ManageProblem",
  ManageContest = "ManageContest",
  ManageDiscussion = "ManageDiscussion",
  SkipRecaptcha = "SkipRecaptcha"
}

interface PrevilegeViewProps {
  meta?: ApiTypes.UserMetaDto;
  privileges?: ApiTypes.GetUserMetaResponseDto["privileges"];
}

const PrevilegeView: React.FC<PrevilegeViewProps> = props => {
  const _ = useLocalizer("user_edit.privilege");

  useEffect(() => {
    appState.enterNewPage(`${_(`.title`)} - ${props.meta.username}`, null, false);
  }, [appState.locale, props.meta]);

  const [, setModified] = useConfirmNavigation();
  const isAdmin = appState.currentUser.isAdmin;
  const isCurrentUser = props.meta.id === appState.currentUser.id;

  const [isActive, setIsActive] = useState(props.meta.isActive);
  const [statusPending, setStatusPending] = useState(false);

  async function onActiveStatusChange(active: boolean) {
    if (statusPending || active === isActive) return;
    if (!active && !window.confirm(_(".account_status.confirm_deactivate", { username: props.meta.username }))) return;

    setStatusPending(true);
    const { requestError, response } = await api.user.setUserActiveStatus({
      userId: props.meta.id,
      isActive: active
    });

    if (requestError) toast.error(requestError(_));
    else if (response.error) toast.error(_(`user_edit.errors.${response.error}`));
    else {
      setIsActive(response.meta.isActive);
      toast.success(
        active
          ? _(".account_status.activated_success", { username: props.meta.username })
          : _(".account_status.deactivated_success", { username: props.meta.username })
      );
    }
    setStatusPending(false);
  }

  const [pending, onSubmit] = useAsyncCallbackPending(async () => {
    const { requestError, response } = await api.user.setUserPrivileges({
      userId: props.meta.id,
      privileges: [...privileges]
    });
    if (requestError) toast.error(requestError(_));
    else if (response.error) toast.error(_(`user_edit.errors.${response.error}`));
    else {
      setModified(false);
      toast.success(_(".success"));
    }
  });

  const [privileges, setPrivileges] = useState(new Set(props.privileges as Privilege[]));
  function togglePrivilege(privilege: Privilege, has: boolean) {
    const newPrivileges = new Set(privileges);
    if (has) newPrivileges.add(privilege);
    else newPrivileges.delete(privilege);
    setPrivileges(newPrivileges);
    setModified(true);
  }

  return (
    <>
      <Header className={style.sectionHeader} size="large" content={_(".account_status.header")} />
      <div className={style.privilegeRow}>
        <Checkbox
          toggle
          readOnly={!isAdmin || statusPending || (isCurrentUser && isActive)}
          disabled={statusPending || (isCurrentUser && isActive)}
          label={isActive ? _(".account_status.active") : _(".account_status.inactive")}
          checked={isActive}
          onChange={(e, { checked }) => onActiveStatusChange(checked)}
        />
        <div className={style.notes}>
          {isCurrentUser ? _(".account_status.cannot_deactivate_self") : _(".account_status.notes")}
        </div>
      </div>
      <Header className={style.sectionHeader} size="large" content={_(".header")} />
      {Object.values(Privilege).map(privilege => (
        <div key={privilege} className={style.privilegeRow}>
          <Checkbox
            toggle
            readOnly={!isAdmin}
            label={_(`.privileges.${privilege}.name`)}
            checked={privileges.has(privilege)}
            onChange={(e, { checked }) => togglePrivilege(privilege, checked)}
          />
          <div className={style.notes}>{_(`.privileges.${privilege}.notes`)}</div>
        </div>
      ))}
      <div className={style.notes + " " + style.notesAdminOnly}>{_(".admin_only")}</div>
      <Button
        className={style.submit}
        loading={pending}
        disabled={!isAdmin}
        primary
        content={_(".submit")}
        onClick={onSubmit}
      />
    </>
  );
};

export const View = observer(PrevilegeView);
