import React, { useEffect } from "react";
import { Header, Icon, Label, Segment, Table } from "semantic-ui-react";
import { observer } from "mobx-react";

import style from "./ProblemReviewPage.module.less";

import api from "@/api";
import { appState } from "@/appState";
import { defineRoute, RouteError } from "@/AppRouter";
import { Pagination } from "@/components/Pagination";
import { EmojiRenderer } from "@/components/EmojiRenderer";
import { getProblemDisplayName } from "@/pages/problem/utils";
import formatDateTime from "@/utils/formatDateTime";
import { Link, useLocalizer } from "@/utils/hooks";

import { getProblemReviewUrl } from "./utils";

const REVIEWS_PER_PAGE = 20;

async function fetchData(page: number) {
  const { requestError, response } = await api.problemReview.queryDueReviews({
    locale: appState.locale,
    skipCount: (page - 1) * REVIEWS_PER_PAGE,
    takeCount: REVIEWS_PER_PAGE
  });

  if (requestError) throw new RouteError(requestError, { showRefresh: true, showBack: true });
  return response;
}

interface ProblemReviewPageProps {
  page: number;
  queryResult: ApiTypes.QueryProblemReviewsResponseDto;
}

let ProblemReviewPage: React.FC<ProblemReviewPageProps> = props => {
  const _ = useLocalizer("problem_review");

  useEffect(() => {
    appState.enterNewPage(_(".title"), "home");
  }, [appState.locale]);

  return (
    <>
      <Header as="h1" icon="repeat" content={_(".title")} />
      <Segment>
        <div className={style.summary}>
          <span>{_(".pending_count", { count: props.queryResult.count })}</span>
          {props.queryResult.overdueCount > 0 && (
            <Label color="red">{_(".overdue_count", { count: props.queryResult.overdueCount })}</Label>
          )}
        </div>
      </Segment>

      {props.queryResult.result.length === 0 ? (
        <Segment placeholder>
          <Header icon>
            <Icon name="check circle outline" />
            {_(".no_reviews")}
          </Header>
        </Segment>
      ) : (
        <Segment>
          <Table basic="very" stackable>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>{_(".problem")}</Table.HeaderCell>
                <Table.HeaderCell>{_(".progress")}</Table.HeaderCell>
                <Table.HeaderCell>{_(".deadline")}</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {props.queryResult.result.map(review => (
                <Table.Row key={review.problem.id}>
                  <Table.Cell className={style.problem}>
                    <EmojiRenderer>
                      <Link href={getProblemReviewUrl(review)}>
                        {getProblemDisplayName(review.problem, review.title, _)}
                      </Link>
                    </EmojiRenderer>
                  </Table.Cell>
                  <Table.Cell>
                    <span>
                      {_(".round", {
                        current: review.reviewNumber,
                        total: review.totalReviewCount
                      })}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <div className={style.reviewMeta}>
                      <span title={formatDateTime(review.dueAt)[1]}>{formatDateTime(review.dueAt)[0]}</span>
                      {review.overdue && (
                        <Label size="mini" color="red">
                          {_(".overdue", { days: review.overdueDays })}
                        </Label>
                      )}
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Segment>
      )}

      {props.queryResult.count > REVIEWS_PER_PAGE && (
        <div className={style.pagination}>
          <Pagination
            totalCount={props.queryResult.count}
            itemsPerPage={REVIEWS_PER_PAGE}
            currentPage={props.page}
            pageUrl={page => ({
              pathname: "/reviews",
              query: page > 1 ? { page: String(page) } : {}
            })}
          />
        </div>
      )}
    </>
  );
};

ProblemReviewPage = observer(ProblemReviewPage);

export default defineRoute(async request => {
  const requestedPage = Number(request.query.page);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  return <ProblemReviewPage page={page} queryResult={await fetchData(page)} />;
});
