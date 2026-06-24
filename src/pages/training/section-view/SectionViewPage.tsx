import React, { useEffect, useState } from "react";
import { Button, Header, Icon, Label, Message, Segment, Table } from "semantic-ui-react";
import { observer } from "mobx-react";

import style from "../common/TrainingPage.module.less";

import api from "@/api";
import { appState } from "@/appState";
import { defineRoute, RouteError } from "@/AppRouter";
import { Link, useAsyncCallbackPending, useLocalizer, useScreenWidthWithin } from "@/utils/hooks";
import MarkdownContent from "@/markdown/MarkdownContent";
import { EmojiRenderer } from "@/components/EmojiRenderer";
import { StatusIcon } from "@/components/StatusText";
import { getProblemDisplayName, getProblemIdString, getProblemUrl } from "@/pages/problem/utils";
import { sortTags } from "@/pages/problem/problemTag";
import AddProblemModal from "../common/AddProblemModal";
import DeleteConfirmModal from "../common/DeleteConfirmModal";
import OrderButtons from "../common/OrderButtons";
import RenameTitleModal from "../common/RenameTitleModal";
import TrainingManageModal from "../common/TrainingManageModal";
import toast from "@/utils/toast";

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
  const _p = useLocalizer("problem_set");
  const _ = useLocalizer("training");
  const [section, setSection] = useState(props.section);
  const isVeryNarrowScreen = useScreenWidthWithin(0, 640);
  const canManageTraining = appState.currentUserHasPrivilege("ManageProblem");
  const [deletePending, onDeleteProblem] = useAsyncCallbackPending(async (problemId: number) => {
    const problems = section.problems
      .filter(problem => problem.meta.id !== problemId)
      .map((problem, index) => ({ problemId: problem.meta.id, sortOrder: index + 1 }));
    const { requestError, response } = await api.training.setSectionProblems({
      sectionId: section.id,
      problems
    });
    if (requestError) toast.error(requestError((key: string) => key));
    else if (!response.success) toast.error(_(".delete_failed"));
    else setSection(await fetchSection(section.id));
  });
  const [reorderPending, onMoveProblem] = useAsyncCallbackPending(async (index: number, direction: -1 | 1) => {
    const nextSection = moveProblem(section, index, direction);
    if (nextSection === section) return;
    setSection(nextSection);
    const problems = nextSection.problems.map((problem, nextIndex) => ({
      problemId: problem.meta.id,
      sortOrder: nextIndex + 1
    }));
    const { requestError, response } = await api.training.setSectionProblems({
      sectionId: section.id,
      problems
    });
    if (requestError) toast.error(requestError((key: string) => key));
    else if (!response.success) {
      toast.error(_(".save_failed"));
      setSection(section);
    }
  });

  useEffect(() => {
    appState.enterNewPage(section.title, "training");
  }, [section.title]);

  async function onProblemAdded() {
    setSection(await fetchSection(section.id));
  }

  const [renamePending, onRenameSection] = useAsyncCallbackPending(
    async ({ title, description }: { title: string; description: string }) => {
      const { requestError, response } = await api.training.updateSection({ id: section.id, title, description });
      if (requestError) toast.error(requestError((key: string) => key));
      else
        setSection(currentSection => ({
          ...currentSection,
          title: response.title,
          description: response.description
        }));
    }
  );

  function moveProblem(
    currentSection: ApiTypes.GetSectionByIdResponseDto,
    index: number,
    direction: -1 | 1
  ): ApiTypes.GetSectionByIdResponseDto {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= currentSection.problems.length) return currentSection;
    const problems = [...currentSection.problems];
    [problems[index], problems[targetIndex]] = [problems[targetIndex], problems[index]];
    return { ...currentSection, problems };
  }

  const manageModal = canManageTraining && (
    <TrainingManageModal
      title={_(".manage_problem")}
      actions={
        <>
          <RenameTitleModal
            title={_(".rename_section")}
            label={_(".section")}
            initialTitle={section.title}
            initialDescription={section.description}
            pending={renamePending}
            onSubmit={onRenameSection}
          />
          <AddProblemModal section={section} onAdded={onProblemAdded} />
        </>
      }
    >
      {section.problems.length ? (
        <Table basic="very" textAlign="center" unstackable className={style.manageTable}>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell width={1}>#</Table.HeaderCell>
              <Table.HeaderCell className={style.tableTitle}>{_(".problem")}</Table.HeaderCell>
              <Table.HeaderCell width={2}>{_(".order")}</Table.HeaderCell>
              <Table.HeaderCell width={1}>{_(".action")}</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {section.problems.map((problem, index) => (
              <Table.Row key={problem.meta.id}>
                <Table.Cell>{index + 1}</Table.Cell>
                <Table.Cell className={style.tableTitle}>
                  <span className={style.problemId}>
                    {getProblemIdString(problem.meta, { hideHashTagOnDisplayId: true })}
                  </span>
                  {" " + getProblemDisplayName(null, problem.title, _p)}
                </Table.Cell>
                <Table.Cell>
                  <OrderButtons
                    index={index}
                    count={section.problems.length}
                    disabled={reorderPending}
                    onMoveUp={() => onMoveProblem(index, -1)}
                    onMoveDown={() => onMoveProblem(index, 1)}
                  />
                </Table.Cell>
                <Table.Cell>
                  <DeleteConfirmModal
                    title={_(".remove_problem")}
                    content={_(".confirm_remove_problem", {
                      title: getProblemDisplayName(null, problem.title, _p)
                    })}
                    pending={deletePending}
                    onConfirm={() => onDeleteProblem(problem.meta.id)}
                  />
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      ) : (
        <div className={style.manageEmpty}>{_(".empty_problem")}</div>
      )}
    </TrainingManageModal>
  );

  return (
    <>
      <div className={style.header}>
        <div className={style.headerTitle}>
          <Header as="h1">{section.title}</Header>
        </div>
        {(appState.currentUser || canManageTraining) && (
          <div className={style.headerActions}>
            {appState.currentUser && (
              <Button
                as={Link}
                href={`/t/${props.training.id}/${props.chapter.id}/${section.id}/ranklist`}
                icon
                labelPosition="left"
              >
                <Icon name="ordered list" />
                {_(".ranklist")}
              </Button>
            )}
            {manageModal}
          </div>
        )}
      </div>

      {section.description && (
        <p style={{ marginBottom: 24 }}>
          <MarkdownContent content={section.description} />
        </p>
      )}

      {section.problems.length ? (
        <Table basic="very" textAlign="center" unstackable>
          <Table.Header>
            <Table.Row>
              {appState.currentUser && <Table.HeaderCell width={1}>{_p(".column_status")}</Table.HeaderCell>}
              <Table.HeaderCell width={1}>#</Table.HeaderCell>
              <Table.HeaderCell className={style.tableTitle}>{_(".problem")}</Table.HeaderCell>
              <Table.HeaderCell width={1}>{_p(".column_submission_count")}</Table.HeaderCell>
              {!isVeryNarrowScreen && <Table.HeaderCell width={1}>{_p(".column_accepted_rate")}</Table.HeaderCell>}
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
                    <Link href={getProblemUrl(problem.meta)}>{getProblemDisplayName(null, problem.title, _p)}</Link>
                  </EmojiRenderer>
                  {!problem.meta.isPublic && (
                    <Label
                      className={style.labelNonPublic}
                      icon="eye slash"
                      size="small"
                      color="red"
                      basic
                      content={_p(".non_public")}
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
            {_(".empty_problem")}
          </Header>
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
