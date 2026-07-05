import React, { useEffect, useState } from "react";
import { Button, Header, Icon, Label, Table } from "semantic-ui-react";
import { observer } from "mobx-react";

import style from "./SectionRanklistPage.module.less";

import api from "@/api";
import { appState } from "@/appState";
import { defineRoute, RouteError } from "@/AppRouter";
import GroupSearch from "@/components/GroupSearch";
import ScoreText from "@/components/ScoreText";
import { getProblemUrl } from "@/pages/problem/utils";
import { Link, useAsyncCallbackPending, useLocalizer } from "@/utils/hooks";
import toast from "@/utils/toast";

interface SectionRanklistPageProps {
  trainingId: number;
  chapterId: number;
  section: ApiTypes.GetSectionByIdResponseDto;
}

async function fetchSection(sectionId: number): Promise<ApiTypes.GetSectionByIdResponseDto> {
  const sectionResult = await api.training.getSectionById({
    id: sectionId,
    locale: appState.locale,
    titleOnly: false
  });
  if (sectionResult.requestError)
    throw new RouteError(sectionResult.requestError, { showRefresh: true, showBack: true });

  return sectionResult.response;
}

let SectionRanklistPage: React.FC<SectionRanklistPageProps> = props => {
  const _ = useLocalizer("training");
  const [group, setGroup] = useState<ApiTypes.GroupMetaDto>(null);
  const [ranklist, setRanklist] = useState<ApiTypes.QuerySectionGroupRanklistResponseDto>(null);
  const canManageTraining = appState.currentUserHasPrivilege("ManageProblem");

  const [pending, queryRanklist] = useAsyncCallbackPending(async (selectedGroup?: ApiTypes.GroupMetaDto) => {
    setGroup(selectedGroup);
    setRanklist(null);
    const { requestError, response } = await api.training.querySectionGroupRanklist({
      sectionId: props.section.id,
      groupId: selectedGroup?.id
    });
    if (requestError) toast.error(requestError((key: string) => key));
    else setRanklist(response);
  });

  useEffect(() => {
    appState.enterNewPage(_(".ranklist_page_title", { title: props.section.title }), "training");

    queryRanklist();
  }, [appState.locale, props.section.id, props.section.title]);

  function renderRank(rank: number): React.ReactNode {
    if (rank === 1) return <span className={`${style.rankRibbon} ${style.rankFirst}`}>{rank}</span>;
    if (rank === 2) return <span className={`${style.rankRibbon} ${style.rankSecond}`}>{rank}</span>;
    if (rank === 3) return <span className={`${style.rankRibbon} ${style.rankThird}`}>{rank}</span>;
    return rank;
  }

  return (
    <>
      <div className={style.header}>
        <div className={style.title}>
          <Header as="h1">{_(".ranklist_title")}</Header>
          <div className={style.sectionTitle}>{props.section.title}</div>
        </div>
        <Button className={style.back} as={Link} href={`/t/${props.trainingId}/${props.chapterId}/${props.section.id}`}>
          <Icon name="arrow left" />
          {_(".back_to_section")}
        </Button>
      </div>

      <div className={style.toolbar}>
        {canManageTraining && (
          <GroupSearch className={style.groupSearch} placeholder={_(".search_group")} onResultSelect={queryRanklist} />
        )}
        {(group || ranklist) && (
          <div className={style.groupMeta}>
            {(ranklist?.groups || [group]).map(group => (
              <Label key={group.id} basic content={group.name} />
            ))}
            <Label
              basic
              size="small"
              content={_(".group_member_count", { count: String(ranklist?.memberCount ?? group.memberCount) })}
            />
          </div>
        )}
        {canManageTraining && group && (
          <Button
            className={style.refresh}
            size="mini"
            icon
            loading={pending}
            disabled={pending}
            onClick={() => queryRanklist(group)}
          >
            <Icon name="refresh" />
          </Button>
        )}
      </div>

      {(group || ranklist || pending) && (
        <>
          {ranklist ? (
            <div className={style.tableWrap}>
              <Table basic="very" textAlign="center" className={style.ranklist}>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell className={style.rank}>#</Table.HeaderCell>
                    <Table.HeaderCell className={style.user}>{_(".user")}</Table.HeaderCell>
                    <Table.HeaderCell className={style.acceptedCount}>{_(".accepted_count")}</Table.HeaderCell>
                    {props.section.problems.map((problem, index) => (
                      <Table.HeaderCell key={problem.meta.id} title={problem.title}>
                        <Link href={getProblemUrl(problem.meta)}>{String.fromCharCode(65 + index)}</Link>
                      </Table.HeaderCell>
                    ))}
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {ranklist.result.map(item => {
                    const acceptedProblemIds = new Set(item.acceptedProblemIds);
                    return (
                      <Table.Row key={item.user.id}>
                        <Table.Cell className={style.rank}>{renderRank(item.rank)}</Table.Cell>
                        <Table.Cell className={style.user}>
                          <Link href={`/u/${item.user.username}`}>
                            {item.user.nickname ? item.user.nickname : item.user.username}
                          </Link>
                        </Table.Cell>
                        <Table.Cell className={style.acceptedCount}>
                          <ScoreText
                            score={
                              ranklist.problemCount ? (item.acceptedProblemCount / ranklist.problemCount) * 100 : 0
                            }
                          >
                            {item.acceptedProblemCount}
                          </ScoreText>
                        </Table.Cell>
                        {props.section.problems.map(problem => {
                          const accepted = acceptedProblemIds.has(problem.meta.id);
                          return (
                            <Table.Cell key={problem.meta.id} className={accepted ? style.acceptedCell : undefined}>
                              {accepted && <ScoreText score={100}>+</ScoreText>}
                            </Table.Cell>
                          );
                        })}
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table>
            </div>
          ) : (
            <div className={style.empty}>
              <Icon name="file outline" />
              <div>{pending ? _(".loading") : _(".empty_ranklist")}</div>
            </div>
          )}
        </>
      )}
    </>
  );
};

SectionRanklistPage = observer(SectionRanklistPage);

export default defineRoute(async request => {
  const trainingId = Number(request.params.trainingId);
  const chapterId = Number(request.params.chapterId);
  const sectionId = Number(request.params.sectionId);
  if (!Number.isSafeInteger(trainingId) || !Number.isSafeInteger(chapterId) || !Number.isSafeInteger(sectionId)) {
    throw new RouteError("Invalid section id" as any);
  }

  return <SectionRanklistPage trainingId={trainingId} chapterId={chapterId} section={await fetchSection(sectionId)} />;
});
