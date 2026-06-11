import React, { useEffect, useState } from "react";
import { Header, Icon, Label, Segment, Table } from "semantic-ui-react";
import { observer } from "mobx-react";

import style from "../common/TrainingPage.module.less";

import api from "@/api";
import { appState } from "@/appState";
import { defineRoute, RouteError } from "@/AppRouter";
import { Link, useLocalizer, useScreenWidthWithin } from "@/utils/hooks";
import { EmojiRenderer } from "@/components/EmojiRenderer";
import { StatusIcon } from "@/components/StatusText";
import { getProblemDisplayName, getProblemIdString, getProblemUrl } from "@/pages/problem/utils";
import { sortTags } from "@/pages/problem/problemTag";
import AddProblemModal from "../common/AddProblemModal";
import TrainingProgressBar from "../common/TrainingProgressBar";

interface SectionViewData {
  training: ApiTypes.TrainingMetaDto;
  chapter: ApiTypes.ChapterMetaDto;
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

async function fetchData(trainingId: number, chapterId: number, sectionId: number): Promise<SectionViewData> {
  const trainingResult = await api.training.getTrainingById({ id: trainingId });
  if (trainingResult.requestError)
    throw new RouteError(trainingResult.requestError, { showRefresh: true, showBack: true });

  const chapterResult = await api.training.getChapterById({ id: chapterId });
  if (chapterResult.requestError)
    throw new RouteError(chapterResult.requestError, { showRefresh: true, showBack: true });

  return {
    training: trainingResult.response,
    chapter: chapterResult.response,
    section: await fetchSection(sectionId)
  };
}

interface SectionViewPageProps extends SectionViewData {}

let SectionViewPage: React.FC<SectionViewPageProps> = props => {
  const _ = useLocalizer("problem_set");
  const [section, setSection] = useState(props.section);
  const isVeryNarrowScreen = useScreenWidthWithin(0, 640);

  useEffect(() => {
    appState.enterNewPage(section.title, "training");
  }, [section.title]);

  async function onProblemAdded() {
    setSection(await fetchSection(section.id));
  }

  return (
    <>
      <div className={style.header}>
        <div className={style.headerTitle}>
          <Header as="h1">{section.title}</Header>
        </div>
        <div className={style.headerActions}>
          <AddProblemModal section={section} onAdded={onProblemAdded} />
        </div>
      </div>

      {section.description && <Segment className={style.description}>{section.description}</Segment>}

      {section.problems.length ? (
        <Table basic="very" textAlign="center" unstackable>
          <Table.Header>
            <Table.Row>
              {appState.currentUser && <Table.HeaderCell width={1}>{_(".column_status")}</Table.HeaderCell>}
              <Table.HeaderCell width={1}>#</Table.HeaderCell>
              <Table.HeaderCell className={style.tableTitle}>题目</Table.HeaderCell>
              <Table.HeaderCell width={1}>{_(".column_submission_count")}</Table.HeaderCell>
              {!isVeryNarrowScreen && <Table.HeaderCell width={1}>{_(".column_accepted_rate")}</Table.HeaderCell>}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {section.problems.map(problem => (
              <Table.Row key={problem.meta.id}>
                {appState.currentUser && (
                  <Table.Cell>
                    {problem.submission && (
                      <Link href={`/s/${problem.submission.id}`}>
                        <StatusIcon status={problem.submission.status} noMarginRight />
                      </Link>
                    )}
                  </Table.Cell>
                )}
                <Table.Cell>
                  <span className={style.problemId}>
                    {getProblemIdString(problem.meta, { hideHashTagOnDisplayId: true })}
                  </span>
                </Table.Cell>
                <Table.Cell textAlign="left" className={style.problemTitleCell}>
                  <EmojiRenderer>
                    <Link href={getProblemUrl(problem.meta)}>{getProblemDisplayName(null, problem.title, _)}</Link>
                  </EmojiRenderer>
                  {!problem.meta.isPublic && (
                    <Label
                      className={style.labelNonPublic}
                      icon="eye slash"
                      size="small"
                      color="red"
                      basic
                      content={_(".non_public")}
                    />
                  )}
                  <div className={style.tags}>
                    {(problem.tags ? sortTags(problem.tags) : []).map(tag => (
                      <EmojiRenderer key={tag.id}>
                        <Label size="small" content={tag.name} color={tag.color as any} />
                      </EmojiRenderer>
                    ))}
                  </div>
                </Table.Cell>
                <Table.Cell>{problem.meta.submissionCount}</Table.Cell>
                {!isVeryNarrowScreen && (
                  <Table.Cell>
                    {((problem.meta.acceptedSubmissionCount / problem.meta.submissionCount) * 100 || 0).toFixed(1)}%
                  </Table.Cell>
                )}
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      ) : (
        <Segment placeholder textAlign="center">
          <Header icon>
            <Icon name="file alternate" />
            暂无题目
          </Header>
          <AddProblemModal section={section} onAdded={onProblemAdded} />
        </Segment>
      )}
    </>
  );
};

SectionViewPage = observer(SectionViewPage);

export default defineRoute(async request => {
  const trainingId = Number(request.params.trainingId);
  const chapterId = Number(request.params.chapterId);
  const sectionId = Number(request.params.sectionId);
  if (!Number.isSafeInteger(trainingId) || !Number.isSafeInteger(chapterId) || !Number.isSafeInteger(sectionId)) {
    throw new RouteError("Invalid section id" as any);
  }
  return <SectionViewPage {...await fetchData(trainingId, chapterId, sectionId)} />;
});
