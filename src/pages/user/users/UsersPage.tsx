import React, { useEffect, useState } from "react";
import { Table, Icon, Button } from "semantic-ui-react";
import { observer } from "mobx-react";
import { useCurrentRoute } from "react-navi";

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
import toast from "@/utils/toast";

const USERS_PER_PAGE = appState.serverPreference.pagination.userList;
const ACTIVE_USER_TIME_RANGE = 30 * 24 * 60 * 60 * 1000;

enum SortBy {
  rating = "rating",
  acceptedProblemCount = "acceptedProblemCount"
}

enum View {
  all = "all",
  active = "active",
  pendingActivation = "pendingActivation"
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

async function fetchInactiveUsers(currentPage: number): Promise<[ApiTypes.InactiveUserDto[], number]> {
  const { requestError, response } = await api.user.getInactiveUserList({
    skipCount: USERS_PER_PAGE * (currentPage - 1),
    takeCount: USERS_PER_PAGE
  });

  if (requestError) throw new RouteError(requestError, { showRefresh: true, showBack: true });
  else if (response.error) throw new RouteError(makeToBeLocalizedText(`users.error.${response.error}`));

  return [response.users, response.count];
}

interface UsersPageProps {
  users: UserMeta[];
  activeUsers: ApiTypes.ActiveUserDto[];
  inactiveUsers: ApiTypes.InactiveUserDto[];
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
  const pendingActivationView = props.view === View.pendingActivation;
  const users = activeView ? props.activeUsers.map(activeUser => activeUser.user) : props.users;
  const [inactiveUsers, setInactiveUsers] = useState(props.inactiveUsers);
  const [inactiveUserCount, setInactiveUserCount] = useState(props.totalCount);
  const [activatingUserIds, setActivatingUserIds] = useState(new Set<number>());

  async function activateUser(user: ApiTypes.InactiveUserDto) {
    if (activatingUserIds.has(user.id)) return;
    setActivatingUserIds(userIds => new Set(userIds).add(user.id));

    const { requestError, response } = await api.user.setUserActiveStatus({ userId: user.id, isActive: true });
    if (requestError) toast.error(requestError(_));
    else if (response.error) toast.error(_(`.error.${response.error}`));
    else {
      toast.success(_(".activated_success", { username: user.username }));
      setInactiveUsers(currentUsers => currentUsers.filter(currentUser => currentUser.id !== user.id));
      setInactiveUserCount(count => Math.max(0, count - 1));

      if (inactiveUsers.length === 1 && props.currentPage > 1) {
        navigation.navigate({
          query: {
            ...currentRoute.url.query,
            page: (props.currentPage - 1).toString()
          }
        });
      }
    }

    setActivatingUserIds(userIds => {
      const nextUserIds = new Set(userIds);
      nextUserIds.delete(user.id);
      return nextUserIds;
    });
  }

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
              <>
                <Button
                  basic={props.view !== View.all}
                  primary={props.view === View.all}
                  content={_(".all_users")}
                  as={Link}
                  href={{ query: {} }}
                />
                <Button
                  basic={!activeView}
                  primary={activeView}
                  content={_(".active_users")}
                  as={Link}
                  href={{ query: { view: View.active } }}
                />
              </>
            )}
            {appState.currentUser?.isAdmin && (
              <Button
                basic={!pendingActivationView}
                primary={pendingActivationView}
                content={_(".pending_activation_users")}
                as={Link}
                href={{ query: { view: View.pendingActivation } }}
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
          {pendingActivationView ? (
            <Table.Row>
              <Table.HeaderCell className={style.columnUsername}>{_(".username")}</Table.HeaderCell>
              <Table.HeaderCell className={style.columnNickname}>{_(".nickname")}</Table.HeaderCell>
              <Table.HeaderCell className={style.columnEmail}>{_(".email")}</Table.HeaderCell>
              <Table.HeaderCell className={style.columnRegistrationTime}>{_(".registration_time")}</Table.HeaderCell>
              <Table.HeaderCell className={style.columnAction}>{_(".action")}</Table.HeaderCell>
            </Table.Row>
          ) : (
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
          )}
        </Table.Header>
        <Table.Body>
          {pendingActivationView ? (
            inactiveUsers.length > 0 ? (
              inactiveUsers.map(user => (
                <Table.Row key={user.id}>
                  <Table.Cell>
                    <Link href={`/u/${user.username}`}>{user.username}</Link>
                  </Table.Cell>
                  <Table.Cell>{user.nickname}</Table.Cell>
                  <Table.Cell className={style.columnEmail}>{user.email}</Table.Cell>
                  <Table.Cell className={style.columnRegistrationTime}>
                    <TimeAgo time={new Date(user.registrationTime)} />
                  </Table.Cell>
                  <Table.Cell className={style.columnAction}>
                    <Button
                      primary
                      size="small"
                      loading={activatingUserIds.has(user.id)}
                      disabled={activatingUserIds.has(user.id)}
                      content={_(".activate")}
                      onClick={() => activateUser(user)}
                    />
                  </Table.Cell>
                </Table.Row>
              ))
            ) : (
              <Table.Row>
                <Table.Cell colSpan={5}>{_(".no_pending_activation_users")}</Table.Cell>
              </Table.Row>
            )
          ) : (
            users.map((user, i) => (
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
            ))
          )}
        </Table.Body>
      </Table>
      {activeView || (pendingActivationView ? inactiveUserCount : props.totalCount) <= USERS_PER_PAGE ? null : (
        <div className={style.pagination}>
          <Pagination
            totalCount={pendingActivationView ? inactiveUserCount : props.totalCount}
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

  let view = View.all;
  if (appState.currentUserHasPrivilege("ManageUser") && request.query.view === View.active) view = View.active;
  else if (appState.currentUser?.isAdmin && request.query.view === View.pendingActivation)
    view = View.pendingActivation;

  let sortBy = request.query.sortBy as SortBy;
  if (!(sortBy in SortBy))
    sortBy = appState.serverPreference.misc.sortUserByRating ? SortBy.rating : SortBy.acceptedProblemCount;

  const [users, userCount] = view === View.all ? await fetchData(sortBy, page) : [[], 0];
  const activeUsers = view === View.active ? await fetchActiveUsers() : [];
  const [inactiveUsers, inactiveUserCount] = view === View.pendingActivation ? await fetchInactiveUsers(page) : [[], 0];

  return (
    <UsersPage
      key={`${view}-${page}`}
      sortBy={sortBy}
      users={users}
      activeUsers={activeUsers}
      inactiveUsers={inactiveUsers}
      view={view}
      totalCount={view === View.pendingActivation ? inactiveUserCount : userCount}
      currentPage={page}
    />
  );
});
