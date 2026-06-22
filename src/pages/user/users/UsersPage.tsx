import React, { useEffect } from "react";
import { Table, Icon, Button } from "semantic-ui-react";
import { observer } from "mobx-react";
import { useCurrentRoute } from "react-navi";
import { v4 as uuid } from "uuid";

import style from "./UsersPage.module.less";

import api from "@/api";
import { UserMeta } from "@/interfaces/UserMeta";
import { useLocalizer, useNavigationChecked, Link } from "@/utils/hooks";
import { appState } from "@/appState";
import { Pagination } from "@/components/Pagination";
import UserLink from "@/components/UserLink";
import UserSearch from "@/components/UserSearch";
import { defineRoute, RouteError } from "@/AppRouter";
import { makeToBeLocalizedText } from "@/locales";
import { EmojiRenderer } from "@/components/EmojiRenderer";
import MarkdownContent from "@/markdown/MarkdownContent";
import TimeAgo from "@/components/TimeAgo";

const USERS_PER_PAGE = appState.serverPreference.pagination.userList;
const ACTIVE_USER_TIME_RANGE = 24 * 60 * 60 * 1000;

enum SortBy {
  rating = "rating",
  acceptedProblemCount = "acceptedProblemCount"
}

enum View {
  all = "all",
  active = "active"
}

async function fetchData(sortBy: SortBy, currentPage: number): Promise<[UserMeta[], number]> {
  const { requestError, response } = await api.user.getUserList({
    sortBy,
    skipCount: USERS_PER_PAGE * (currentPage - 1),
    takeCount: USERS_PER_PAGE
  });

  if (requestError) throw new RouteError(requestError, { showRefresh: true, showBack: true });
  else if (response.error) throw new RouteError(makeToBeLocalizedText(`users.error.${response.error}`));

  return [response.userMetas, response.count];
}

async function fetchActiveUsers(): Promise<ApiTypes.ActiveUserDto[]> {
  const { requestError, response } = await api.auth.listActiveUsers({
    sinceTime: +new Date() - ACTIVE_USER_TIME_RANGE,
    takeCount: USERS_PER_PAGE
  });

  if (requestError) throw new RouteError(requestError, { showRefresh: true, showBack: true });
  else if (response.error) throw new RouteError(makeToBeLocalizedText(`users.error.${response.error}`));

  return response.users || [];
}

interface UsersPageProps {
  users: UserMeta[];
  activeUsers: ApiTypes.ActiveUserDto[];
  view: View;
  sortBy: SortBy;
  currentPage: number;
  totalCount: number;
}

let UsersPage: React.FC<UsersPageProps> = props => {
  const _ = useLocalizer("users");
  const navigation = useNavigationChecked();
  const currentRoute = useCurrentRoute();

  useEffect(() => {
    appState.enterNewPage(_(".title"), "members");
  }, [appState.locale]);

  const activeView = props.view === View.active;
  const users = activeView ? props.activeUsers.map(activeUser => activeUser.user) : props.users;

  const scrollElement = document.documentElement;
  useEffect(() => {
    scrollElement.scrollTop = 0;
  }, [props.currentPage]);

  return (
    <>
      <div className={style.header}>
        <UserSearch onResultSelect={user => navigation.navigate(`/u/${user.username}`)} />
        {(appState.currentUserHasPrivilege("ManageUser") || appState.currentUserHasPrivilege("ManageUserGroup")) && (
          <div className={style.actions}>
            {appState.currentUserHasPrivilege("ManageUser") && (
              <Button
                className={style.viewToggleButton}
                basic={!activeView}
                primary={activeView}
                content={activeView ? _(".all_users") : _(".active_users")}
                as={Link}
                href={
                  activeView
                    ? {
                        query: {}
                      }
                    : {
                        query: {
                          view: View.active
                        }
                      }
                }
              />
            )}
            {appState.currentUserHasPrivilege("ManageUserGroup") && (
              <Button primary content={_(".manage_groups")} as={Link} href="/groups" />
            )}
          </div>
        )}
      </div>
      <Table unstackable basic="very" textAlign="center" className={style.table}>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell className={activeView ? style.columnLastActive : style.columnRank}>
              {activeView ? _(".last_active") : _(".rank")}
            </Table.HeaderCell>
            <Table.HeaderCell className={style.columnUsername}>{_(".username")}</Table.HeaderCell>
            <Table.HeaderCell className={style.columnBio}>{_(".bio")}</Table.HeaderCell>
            <Table.HeaderCell className={style.columnAcceptedProblemCount}>
              {activeView ? (
                _(".accepted_problem_count")
              ) : props.sortBy === SortBy.acceptedProblemCount ? (
                <>
                  {_(".accepted_problem_count")}
                  <Icon name="angle down" />
                </>
              ) : (
                <Link
                  className={style.link}
                  href={{
                    query: {
                      sortBy: SortBy.acceptedProblemCount
                    }
                  }}
                >
                  {_(".accepted_problem_count")}
                </Link>
              )}
            </Table.HeaderCell>
            <Table.HeaderCell className={style.columnRating}>
              {activeView ? (
                _(".rating")
              ) : props.sortBy === SortBy.rating ? (
                <>
                  {_(".rating")}
                  <Icon name="angle down" />
                </>
              ) : (
                <Link
                  className={style.link}
                  href={{
                    query: {
                      sortBy: SortBy.rating
                    }
                  }}
                >
                  {_(".rating")}
                </Link>
              )}
            </Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {users.map((user, i) => (
            <Table.Row key={user.id}>
              <Table.Cell className={activeView ? style.columnLastActive : undefined}>
                {activeView ? (
                  <TimeAgo time={new Date(props.activeUsers[i].lastAccessTime)} />
                ) : (
                  <strong>{(props.currentPage - 1) * USERS_PER_PAGE + i + 1}</strong>
                )}
              </Table.Cell>
              <Table.Cell>
                <UserLink user={user} />
              </Table.Cell>
              <Table.Cell className={style.columnBio}>
                {appState.serverPreference.misc.renderMarkdownInUserBio ? (
                  <MarkdownContent content={user.bio} dontUseContentFont />
                ) : (
                  <EmojiRenderer>
                    <div>{user.bio}</div>
                  </EmojiRenderer>
                )}
              </Table.Cell>
              <Table.Cell>{user.acceptedProblemCount}</Table.Cell>
              <Table.Cell>{user.rating}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
      {activeView || props.totalCount <= USERS_PER_PAGE ? null : (
        <div className={style.pagination}>
          <Pagination
            totalCount={props.totalCount}
            currentPage={props.currentPage}
            itemsPerPage={USERS_PER_PAGE}
            pageUrl={page => ({
              query: {
                ...currentRoute.url.query,
                page: page.toString()
              }
            })}
          />
        </div>
      )}
    </>
  );
};

UsersPage = observer(UsersPage);

export default defineRoute(async request => {
  let page = parseInt(request.query.page) || 1;
  if (page < 1) page = 1;

  const view =
    appState.currentUserHasPrivilege("ManageUser") && request.query.view === View.active ? View.active : View.all;

  let sortBy = request.query.sortBy as SortBy;
  if (!(sortBy in SortBy))
    sortBy = appState.serverPreference.misc.sortUserByRating ? SortBy.rating : SortBy.acceptedProblemCount;

  const [users, count] = view === View.active ? [[], 0] : await fetchData(sortBy, page);
  const activeUsers = view === View.active ? await fetchActiveUsers() : [];

  return (
    <UsersPage
      sortBy={sortBy}
      users={users}
      activeUsers={activeUsers}
      view={view}
      totalCount={count}
      currentPage={page}
    />
  );
});
