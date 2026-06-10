import React, { useEffect } from "react";
import { Header, Icon, Segment, Table } from "semantic-ui-react";
import { observer } from "mobx-react";

import style from "../common/TrainingPage.module.less";

import api from "@/api";
import { appState } from "@/appState";
import { defineRoute, RouteError } from "@/AppRouter";
import { Link } from "@/utils/hooks";
import CreateTrainingModal from "../common/CreateTrainingModal";

async function fetchData(): Promise<ApiTypes.QueryTrainingSetResponseDto> {
  const { requestError, response } = await api.training.queryTrainingSet(undefined);
  if (requestError) throw new RouteError(requestError, { showRefresh: true, showBack: true });
  return response;
}

interface TrainingSetPageProps {
  response: ApiTypes.QueryTrainingSetResponseDto;
}

let TrainingSetPage: React.FC<TrainingSetPageProps> = props => {
  useEffect(() => {
    appState.enterNewPage("训练", "training");
  }, []);

  return (
    <>
      <div className={style.header}>
        <Header as="h1">训练</Header>
        <div className={style.headerActions}>
          <CreateTrainingModal nextSortOrder={props.response.count + 1} />
        </div>
      </div>

      {props.response.result.length ? (
        <Table basic="very" textAlign="center" unstackable>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell width={1}>#</Table.HeaderCell>
              <Table.HeaderCell className={style.tableTitle}>训练</Table.HeaderCell>
              <Table.HeaderCell>描述</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {props.response.result.map(training => (
              <Table.Row key={training.id}>
                <Table.Cell>{training.sortOrder}</Table.Cell>
                <Table.Cell className={style.tableTitle}>
                  <Link href={`/t/${training.id}`}>{training.title}</Link>
                </Table.Cell>
                <Table.Cell className={style.tableDescription}>
                  {training.description || <span className={style.muted}>-</span>}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      ) : (
        <Segment placeholder textAlign="center">
          <Header icon>
            <Icon name="book" />
            暂无训练
          </Header>
          <CreateTrainingModal nextSortOrder={1} />
        </Segment>
      )}
    </>
  );
};

TrainingSetPage = observer(TrainingSetPage);

export default defineRoute(async () => {
  return <TrainingSetPage response={await fetchData()} />;
});
