import React, { useEffect, useState } from "react";
import { Grid, Header, Icon, Label, List, Placeholder, Progress, Segment, Table } from "semantic-ui-react";
import { observer } from "mobx-react";
import Countdown from "react-countdown";

import style from "./HomePage.module.less";

import { appState } from "@/appState";
import { Link, useLocalizer, useNavigationChecked, useScreenWidthWithin } from "@/utils/hooks";
import { defineRoute, RouteError } from "@/AppRouter";
import api from "@/api";
import MarkdownContent from "@/markdown/MarkdownContent";
import { getDiscussionDisplayTitle, getDiscussionUrl } from "@/pages/discussion/utils";
import formatDateTime from "@/utils/formatDateTime";
import { EmojiRenderer } from "@/components/EmojiRenderer";
import TrainingProgressBar from "@/pages/training/common/TrainingProgressBar";
import { getProblemDisplayName, getProblemUrl } from "@/pages/problem/utils";

async function fetchData() {
  const homepageResult = await api.homepage.getHomepage({
    locale: appState.locale
  });

  if (homepageResult.requestError) {
    throw new RouteError(homepageResult.requestError, { showRefresh: true, showBack: true });
  }

  let currentTraining: ApiTypes.TrainingMetaDto = null;
  const currentTrainingId = appState.currentUser?.currentTrainingId;

  if (currentTrainingId) {
    const trainingResult = await api.training.getTrainingById({
      id: currentTrainingId
    });

    if (trainingResult.requestError) {
      throw new RouteError(trainingResult.requestError, { showRefresh: true, showBack: true });
    }

    currentTraining = trainingResult.response;
  }

  return {
    ...homepageResult.response,
    currentTraining
  };
}

interface Hitokoto {
  id: string;
  hitokoto: string;
  from: string;
}

async function fetchHitokoto(apiUrl: string) {
  try {
    const response = await fetch(apiUrl);
    return (await response.json()) as Hitokoto;
  } catch (e) {
    console.log("Error loading hitokoto:", e);
    return null;
  }
}

type HomePageProps = ApiTypes.GetHomepageResponseDto & {
  currentTraining?: ApiTypes.TrainingMetaDto;
};

let HomePage: React.FC<HomePageProps> = props => {
  const _ = useLocalizer("home");
  const navigation = useNavigationChecked();

  useEffect(() => {
    appState.enterNewPage(_(".title"), "home");
  }, [appState.locale]);

  const [hitokotoError, setHitokotoError] = useState(false);
  const [hitokotoResult, setHitokotoResult] = useState<Hitokoto>(null);
  useEffect(() => {
    if (props.hitokoto) loadHitokoto(true);
  }, []);

  function loadHitokoto(firstLoad: boolean) {
    // Already loading
    if (!hitokotoResult && !firstLoad) return;

    setHitokotoError(false);
    setHitokotoResult(null);
    fetchHitokoto(props.hitokoto.apiUrl).then(result => {
      if (result) setHitokotoResult(result);
      else setHitokotoError(true);
    });
  }

  const getNotice = () =>
    props.notice && (
      <Segment className={style.segment} color="pink">
        <MarkdownContent placeholderLines={7} content={props.notice} />
      </Segment>
    );

  const getAnnnouncements = () => (
    <>
      <Header
        className={style.header}
        as="h4"
        block
        icon="bullhorn"
        content={_(".annnouncements.header")}
        attached="top"
      />
      <Segment className={style.segment} attached="bottom" placeholder={props.annnouncements.length === 0}>
        {props.annnouncements.length > 0 ? (
          <Table unstackable className={style.table} basic="very">
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>{_(".annnouncements.title")}</Table.HeaderCell>
                <Table.HeaderCell width={1} className={style.noWrap}>
                  {_(".annnouncements.date")}
                </Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {props.annnouncements.map(annnouncement => (
                <Table.Row key={annnouncement.id}>
                  <Table.Cell>
                    <EmojiRenderer>
                      <Link href={getDiscussionUrl(annnouncement)}>
                        {getDiscussionDisplayTitle(annnouncement.title, _)}
                      </Link>
                    </EmojiRenderer>
                  </Table.Cell>
                  <Table.Cell width={1} className={style.noWrap}>
                    {formatDateTime(annnouncement.publishTime, true)[1]}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        ) : (
          <Header icon>
            <Icon name="bullhorn" />
            {_(".annnouncements.no_annnouncements")}
          </Header>
        )}
      </Segment>
    </>
  );

  const trainPlan = () => (
    <>
      <Header className={style.header} as="h4" block icon="book" content={_(".training.header")} attached="top" />
      <Segment className={style.segment} attached="bottom" placeholder={!props.currentTraining}>
        {props.currentTraining?.chapters?.length ? (
          <Table unstackable className={style.table + " " + style.trainingTable} basic="very">
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell className={style.trainingTitleCell}>{_(".training.title")}</Table.HeaderCell>
                <Table.HeaderCell className={style.trainingProgressCell}>{_(".training.progress")}</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {props.currentTraining.chapters.map(chapter => {
                const percent = chapter.problemCount ? (chapter.acceptedProblemCount / chapter.problemCount) * 100 : 0;

                return (
                  <Table.Row key={chapter.id}>
                    <Table.Cell className={style.trainingTitleCell}>
                      <Link href={`/t/${props.currentTraining.id}/${chapter.id}`}>{chapter.title}</Link>
                    </Table.Cell>
                    <Table.Cell className={style.trainingProgressCell}>
                      <div className={style.trainingProgress}>
                        <Progress percent={percent} indicating autoSuccess className={style.trainingProgressBar} />
                        <span className={style.trainingProgressText}>
                          {chapter.acceptedProblemCount} / {chapter.problemCount}
                        </span>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>
        ) : props.currentTraining ? (
          <Header icon>
            <Icon name="book" />
            {_(".training.no_chapters")}
          </Header>
        ) : (
          <Header icon>
            <Icon name="book" />
            {_(".training.no_training")}
          </Header>
        )}
      </Segment>
    </>
  );

  const getHitokoto = () =>
    props.hitokoto && (
      <>
        <Header
          className={style.header + " " + style.hitokoto}
          as="h4"
          block
          icon="comment alternate"
          content={
            <>
              {props.hitokoto?.customTitle || _(".hitokoto.header")}
              <Icon onClick={() => loadHitokoto(false)} name="redo" title={_(".hitokoto.refresh")} />
            </>
          }
          attached="top"
        />
        <Segment className={style.segment} textAlign="center" attached="bottom">
          {hitokotoError ? (
            _(".hitokoto.error")
          ) : hitokotoResult ? (
            <EmojiRenderer>
              <div>
                {hitokotoResult.hitokoto}
                <div className={style.hitokotoFrom}>{hitokotoResult.from}</div>
              </div>
            </EmojiRenderer>
          ) : (
            <Placeholder>
              <Placeholder.Line />
              <Placeholder.Line />
              <Placeholder.Line />
              <Placeholder.Line />
            </Placeholder>
          )}
        </Segment>
      </>
    );

  const countdownItems = props.countdown
    ? Object.entries(props.countdown.items).filter(([, time]) => {
        const timestamp = new Date(time as string).getTime();
        const expiredVisibleDuration = 7 * 24 * 60 * 60 * 1000;

        return timestamp >= Date.now() - expiredVisibleDuration;
      })
    : [];

  const getCountdown = () =>
    props.countdown &&
    countdownItems.length > 0 && (
      <>
        <Header
          className={style.header}
          as="h4"
          block
          icon="calendar alternate"
          content={_(".countdown.header")}
          attached="top"
        />
        <Segment className={style.segment} attached="bottom">
          {countdownItems.map(([event, time], i) => (
            <EmojiRenderer key={i}>
              <div className={style.countdown}>
                <Countdown
                  date={new Date(time as string)}
                  renderer={p => {
                    if (p.completed)
                      return (
                        <>
                          {_(".countdown.completed_before_event")}
                          <span className={style.event}>{event}</span>
                          {_(".countdown.completed_after_event")}
                        </>
                      );
                    else {
                      let time: string;
                      let timeIsDays = false;
                      if (p.days > 0) {
                        time = p.days.toString();
                        timeIsDays = true;
                      } else if (p.hours > 0) {
                        time = `${p.formatted.hours}:${p.formatted.minutes}:${p.formatted.seconds}`;
                      } else {
                        time = `${p.formatted.minutes}:${p.formatted.seconds}`;
                      }

                      return _(".countdown.display_time_first") === "1" ? (
                        <>
                          {_(".countdown.before_time")}
                          <span className={style.time}>{time}</span>
                          {_(timeIsDays ? ".countdown.after_days_before_event" : ".countdown.after_time_before_event")}
                          <span className={style.event}>{event}</span>
                          {_(".countdown.after_event")}
                        </>
                      ) : (
                        <>
                          {_(".countdown.before_event")}
                          <span className={style.event}>{event}</span>
                          {_(".countdown.after_event_before_time")}
                          <span className={style.time}>{time}</span>
                          {_(timeIsDays ? ".countdown.after_days" : ".countdown.after_time")}
                        </>
                      );
                    }
                  }}
                />
              </div>
            </EmojiRenderer>
          ))}
        </Segment>
      </>
    );

  const getFriendLinks = () =>
    props.friendLinks &&
    Object.keys(props.friendLinks.links).length > 0 && (
      <>
        <Header className={style.header} as="h4" block icon="linkify" content={_(".friend_links")} attached="top" />
        <Segment className={style.segment} attached="bottom" placeholder={props.topUsers.length === 0}>
          <List bulleted>
            {Object.entries(props.friendLinks.links).map(([title, url], i) => (
              <List.Item key={i}>
                <EmojiRenderer>
                  <a href={url as string} target="_blank" rel="noreferrer noopener">
                    {title}
                  </a>
                </EmojiRenderer>
              </List.Item>
            ))}
          </List>
        </Segment>
      </>
    );

  const getReviewCard = () =>
    props.reviewSummary && (
      <>
        <Header
          className={style.header}
          as="h4"
          block
          icon="repeat"
          content={
            <>
              {_(".review.header")}
              <Label circular size="mini" className={style.reviewCount}>
                {props.reviewSummary.pendingCount}
              </Label>
            </>
          }
          attached="top"
        />
        <Segment className={style.segment} attached="bottom" placeholder={props.reviewSummary.items.length === 0}>
          {props.reviewSummary.items.length === 0 ? (
            <Header icon>
              <Icon name="check circle outline" />
              {_(".review.no_reviews")}
            </Header>
          ) : (
            <>
              <List divided relaxed className={style.reviewList}>
                {props.reviewSummary.items.map(review => (
                  <List.Item key={review.problem.id}>
                    <List.Content>
                      <List.Header>
                        <Link href={`${getProblemUrl(review.problem)}?review=true`}>
                          <EmojiRenderer>{getProblemDisplayName(review.problem, review.title, _)}</EmojiRenderer>
                        </Link>
                      </List.Header>
                      <List.Description className={style.reviewDescription}>
                        <span>
                          {_(".review.round", {
                            current: review.reviewNumber,
                            total: review.totalReviewCount
                          })}
                        </span>
                        {review.overdue ? (
                          <Label size="mini" color="red">
                            {_(".review.overdue", { days: review.overdueDays })}
                          </Label>
                        ) : (
                          <span title={formatDateTime(review.dueAt)[1]}>
                            {_(".review.due_at", { time: formatDateTime(review.dueAt)[1] })}
                          </span>
                        )}
                      </List.Description>
                    </List.Content>
                  </List.Item>
                ))}
              </List>
              {props.reviewSummary.pendingCount > props.reviewSummary.items.length && (
                <div className={style.reviewMore}>
                  <Link href="/reviews">
                    {_(".review.view_all", {
                      count: props.reviewSummary.pendingCount
                    })}
                  </Link>
                </div>
              )}
            </>
          )}
        </Segment>
      </>
    );

  const isNarrowScreen = useScreenWidthWithin(0, 1024);

  return (
    <>
      {isNarrowScreen ? (
        <>
          {getNotice()}
          {trainPlan()}
          {getAnnnouncements()}
          {getHitokoto()}
          {getCountdown()}
          {getReviewCard()}
          {getFriendLinks()}
        </>
      ) : (
        <Grid>
          <Grid.Column width={11}>
            {getNotice()}
            {trainPlan()}
            {getAnnnouncements()}
          </Grid.Column>
          <Grid.Column width={5}>
            {getHitokoto()}
            {getCountdown()}
            {getReviewCard()}
            {getFriendLinks()}
          </Grid.Column>
        </Grid>
      )}
    </>
  );
};

HomePage = observer(HomePage);

export default defineRoute(async request => {
  const dataPromise: ReturnType<typeof fetchData> = fetchData();

  return <HomePage {...await dataPromise} />;
});
