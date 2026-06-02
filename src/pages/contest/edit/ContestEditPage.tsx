import React, { useEffect, useState } from "react";
import { Button, Checkbox, Form, Header, Icon, List, Segment } from "semantic-ui-react";
import { observer } from "mobx-react";

import style from "./ContestEditPage.module.less";

import api from "@/api";
import { appState } from "@/appState";
import { defineRoute, RouteError } from "@/AppRouter";
import { makeToBeLocalizedText } from "@/locales";
import { Link, useAsyncCallbackPending, useLocalizer, useNavigationChecked } from "@/utils/hooks";
import toast from "@/utils/toast";
import ProblemSearch from "@/components/ProblemSearch";
import UserSearch from "@/components/UserSearch";
import UserLink from "@/components/UserLink";

function toDatetimeLocal(value: string) {
  const date = value ? new Date(value) : new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function fromDatetimeLocal(value: string) {
  return new Date(value).toISOString();
}

async function fetchData(contestId: number): Promise<ApiTypes.GetContestResponseDto> {
  if (!contestId) return null;

  const { requestError, response } = await api.contest.getContest({
    contestId,
    locale: appState.locale
  });
  if (requestError) throw new RouteError(requestError, { showRefresh: true, showBack: true });
  if (response.error) throw new RouteError(makeToBeLocalizedText(`contest.error.${response.error}`));
  if (!response.permissions.manage) throw new RouteError(makeToBeLocalizedText("contest.error.PERMISSION_DENIED"));
  return response;
}

interface ContestEditPageProps {
  contestId: number;
  response: ApiTypes.GetContestResponseDto;
}

let ContestEditPage: React.FC<ContestEditPageProps> = props => {
  const _ = useLocalizer("contest_edit");
  const navigation = useNavigationChecked();
  const editing = !!props.response;

  const [title, setTitle] = useState(props.response?.meta.title || "");
  const [subtitle, setSubtitle] = useState(props.response?.meta.subtitle || "");
  const [information, setInformation] = useState(props.response?.meta.information || "");
  const [startTime, setStartTime] = useState(toDatetimeLocal(props.response?.meta.startTime));
  const [endTime, setEndTime] = useState(
    toDatetimeLocal(props.response?.meta.endTime || new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString())
  );
  const [type, setType] = useState<ApiTypes.SaveContestRequestDto["type"]>(props.response?.meta.type || "acm");
  const [isPublic, setIsPublic] = useState(props.response?.meta.isPublic ?? true);
  const [hideStatistics, setHideStatistics] = useState(props.response?.meta.hideStatistics ?? false);
  const [problems, setProblems] = useState<ApiTypes.ContestProblemDto[]>(props.response?.problems || []);
  const [admins, setAdmins] = useState<ApiTypes.UserMetaDto[]>(props.response?.admins || []);

  useEffect(() => {
    appState.enterNewPage(editing ? _(".edit_title") : _(".new_title"), "contests" as any);
  }, [appState.locale, editing]);

  const [pending, onSubmit] = useAsyncCallbackPending(async () => {
    const { requestError, response } = await api.contest.saveContest({
      contestId: props.contestId || undefined,
      title,
      subtitle,
      information,
      startTime: fromDatetimeLocal(startTime),
      endTime: fromDatetimeLocal(endTime),
      type,
      isPublic,
      hideStatistics,
      problemIds: problems.map(problem => problem.meta.id),
      adminIds: admins.map(admin => admin.id),
      rankingParams: {}
    });

    if (requestError) toast.error(requestError(_));
    else if (response.error) toast.error(_(`.error.${response.error}`));
    else navigation.navigate(`/c/${response.contestId}`);
  });

  function addProblem(problem: ApiTypes.QueryProblemSetResponseItemDto) {
    if (problems.some(item => item.meta.id === problem.meta.id)) return;
    setProblems([
      ...problems,
      {
        meta: problem.meta,
        title: problem.title
      }
    ]);
  }

  function addAdmin(user: ApiTypes.UserMetaDto) {
    if (admins.some(item => item.id === user.id)) return;
    setAdmins([...admins, user]);
  }

  return (
    <>
      <Header as="h1">{editing ? _(".edit_title") : _(".new_title")}</Header>
      <Segment>
        <Form>
          <Form.Input label={_(".title")} value={title} onChange={e => setTitle(e.currentTarget.value)} />
          <Form.TextArea label={_(".subtitle")} value={subtitle} onChange={e => setSubtitle(e.currentTarget.value)} />
          <Form.TextArea
            label={_(".information")}
            value={information}
            onChange={e => setInformation(e.currentTarget.value)}
          />
          <Form.Group widths="equal">
            <Form.Input
              label={_(".start_time")}
              type="datetime-local"
              value={startTime}
              onChange={e => setStartTime(e.currentTarget.value)}
            />
            <Form.Input
              label={_(".end_time")}
              type="datetime-local"
              value={endTime}
              onChange={e => setEndTime(e.currentTarget.value)}
            />
          </Form.Group>
          <Form.Select
            label={_(".type")}
            value={type}
            disabled={editing}
            options={[
              { key: "acm", text: _(".type_acm"), value: "acm" },
              { key: "ioi", text: _(".type_ioi"), value: "ioi" },
              { key: "noi", text: _(".type_noi"), value: "noi" }
            ]}
            onChange={(e, data) => setType(data.value as ApiTypes.SaveContestRequestDto["type"])}
          />
          <Form.Field>
            <Checkbox
              toggle
              label={_(".is_public")}
              checked={isPublic}
              onChange={(e, data) => setIsPublic(!!data.checked)}
            />
          </Form.Field>
          <Form.Field>
            <Checkbox
              toggle
              label={_(".hide_statistics")}
              checked={hideStatistics}
              onChange={(e, data) => setHideStatistics(!!data.checked)}
            />
          </Form.Field>

          <Form.Field>
            <label>{_(".problems")}</label>
            <ProblemSearch placeholder={_(".add_problem")} onResultSelect={addProblem} />
            <List divided relaxed className={style.list}>
              {problems.map((problem, index) => (
                <List.Item key={problem.meta.id} className={style.listItem}>
                  {String.fromCharCode(65 + index)}. {problem.title}
                  <Button
                    icon="trash"
                    size="mini"
                    className={style.remove}
                    onClick={() => setProblems(problems.filter(item => item.meta.id !== problem.meta.id))}
                  />
                </List.Item>
              ))}
            </List>
          </Form.Field>

          <Form.Field>
            <label>{_(".admins")}</label>
            <UserSearch placeholder={_(".add_admin")} onResultSelect={addAdmin} />
            <List divided relaxed className={style.list}>
              {admins.map(admin => (
                <List.Item key={admin.id} className={style.listItem}>
                  <UserLink user={admin} />
                  <Button
                    icon="trash"
                    size="mini"
                    className={style.remove}
                    onClick={() => setAdmins(admins.filter(item => item.id !== admin.id))}
                  />
                </List.Item>
              ))}
            </List>
          </Form.Field>

          <div className={style.formActions}>
            <Button primary disabled={pending} onClick={onSubmit}>
              <Icon name="save" />
              {_(".save")}
            </Button>
            <Button as={Link} href={editing ? `/c/${props.contestId}` : "/c"}>
              {_(".cancel")}
            </Button>
          </div>
        </Form>
      </Segment>
    </>
  );
};

export default defineRoute(async request => {
  const contestId = Number(request.params.id) || 0;
  return <ContestEditPage contestId={contestId} response={await fetchData(contestId)} />;
});

ContestEditPage = observer(ContestEditPage);
