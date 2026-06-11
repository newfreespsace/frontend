import React, { useEffect } from "react";
import { Header, Icon, Segment, Table } from "semantic-ui-react";
import { observer } from "mobx-react";

import style from "../common/TrainingPage.module.less";

import api from "@/api";
import { appState } from "@/appState";
import { defineRoute, RouteError } from "@/AppRouter";
import { Link } from "@/utils/hooks";
import CreateSectionModal from "../common/CreateSectionModal";
import TrainingProgressBar from "../common/TrainingProgressBar";

interface ChapterViewData {
  training: ApiTypes.TrainingMetaDto;
  chapter: ApiTypes.ChapterMetaDto;
  sections: ApiTypes.SectionMetaDto[];
}

async function fetchData(trainingId: number, chapterId: number): Promise<ChapterViewData> {
  const trainingResult = await api.training.getTrainingById({ id: trainingId });
  if (trainingResult.requestError)
    throw new RouteError(trainingResult.requestError, { showRefresh: true, showBack: true });

  const chapterResult = await api.training.getChapterById({ id: chapterId });
  if (chapterResult.requestError)
    throw new RouteError(chapterResult.requestError, { showRefresh: true, showBack: true });

  const sectionsResult = await api.training.querySectionSetByChapterId({ chapterId });
  if (sectionsResult.requestError)
    throw new RouteError(sectionsResult.requestError, { showRefresh: true, showBack: true });

  return {
    training: trainingResult.response,
    chapter: chapterResult.response,
    sections: ((sectionsResult.response as unknown) || []) as ApiTypes.SectionMetaDto[]
  };
}

interface ChapterViewPageProps extends ChapterViewData {}

let ChapterViewPage: React.FC<ChapterViewPageProps> = props => {
  useEffect(() => {
    appState.enterNewPage(props.chapter.title, "training");
  }, [props.chapter.title]);

  return (
    <>
      <div className={style.header}>
        <div className={style.headerTitle}>
          <Header as="h1">{props.chapter.title}</Header>
        </div>
        <div className={style.headerActions}>
          <CreateSectionModal
            trainingId={props.training.id}
            chapterId={props.chapter.id}
            nextSortOrder={props.sections.length + 1}
          />
        </div>
      </div>

      {props.chapter.description && <Segment className={style.description}>{props.chapter.description}</Segment>}

      {props.sections.length ? (
        <Table basic="very" textAlign="center" unstackable>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell width={1}>#</Table.HeaderCell>
              <Table.HeaderCell className={style.tableTitle}>小节</Table.HeaderCell>
              <Table.HeaderCell>进度</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {props.sections.map(section => (
              <Table.Row key={section.id}>
                <Table.Cell>{section.sortOrder}</Table.Cell>
                <Table.Cell className={style.tableTitle}>
                  <div className={style.titleWithProgress}>
                    <Link href={`/t/${props.training.id}/${props.chapter.id}/${section.id}`}>{section.title}</Link>
                  </div>
                </Table.Cell>
                <Table.Cell className={style.tableDescription}>
                  <TrainingProgressBar
                    acceptedProblemCount={section.acceptedProblemCount}
                    problemCount={section.problemCount}
                  />
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      ) : (
        <Segment placeholder textAlign="center">
          <Header icon>
            <Icon name="list alternate" />
            暂无小节
          </Header>
          <CreateSectionModal trainingId={props.training.id} chapterId={props.chapter.id} nextSortOrder={1} />
        </Segment>
      )}
    </>
  );
};

ChapterViewPage = observer(ChapterViewPage);

export default defineRoute(async request => {
  const trainingId = Number(request.params.trainingId);
  const chapterId = Number(request.params.chapterId);
  if (!Number.isSafeInteger(trainingId) || !Number.isSafeInteger(chapterId))
    throw new RouteError("Invalid chapter id" as any);
  return <ChapterViewPage {...await fetchData(trainingId, chapterId)} />;
});
