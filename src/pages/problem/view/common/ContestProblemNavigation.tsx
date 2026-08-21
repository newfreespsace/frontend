import React from "react";

import style from "./ContestProblemNavigation.module.less";

import { Link, useLocalizer } from "@/utils/hooks";

interface ContestProblemNavigationProps {
  contest: ApiTypes.ContestMetaDto;
  problems: ApiTypes.ContestProblemDto[];
  currentPid: number;
  hideSubmissionResults?: boolean;
}

function getProblemLabel(index: number) {
  let value = index + 1;
  let label = "";
  while (value > 0) {
    value--;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

const ContestProblemNavigation: React.FC<ContestProblemNavigationProps> = props => {
  const _ = useLocalizer("problem");

  if (!props.problems?.length) return null;

  return (
    <section className={style.container} aria-label={_(".contest_navigation.title")}>
      <Link className={style.title} href={`/c/${props.contest.id}`}>
        {props.contest.title}
      </Link>
      <div className={style.problemList}>
        {props.problems.map((problem, index) => {
          const pid = index + 1;
          const label = getProblemLabel(index);
          const current = pid === props.currentPid;
          const submitted = problem.submissionId != null;
          const resultHidden = submitted && (props.hideSubmissionResults || problem.status === "Submitted");
          const accepted =
            submitted && !resultHidden && (problem.accepted || problem.score === 100 || problem.status === "Accepted");
          const submissionState = accepted
            ? "accepted"
            : resultHidden
            ? "submitted"
            : submitted
            ? "attempted"
            : "not_submitted";
          const accessibleLabel = _(".contest_navigation.problem_label", {
            label,
            title: problem.title,
            status: _(`.contest_navigation.${submissionState}`),
            current: current ? _(".contest_navigation.current") : ""
          });

          return (
            <Link
              key={problem.meta.id}
              className={
                style.problemLink +
                (accepted
                  ? ` ${style.accepted}`
                  : resultHidden
                  ? ` ${style.submitted}`
                  : submitted
                  ? ` ${style.attempted}`
                  : "") +
                (current ? ` ${style.current}` : "")
              }
              href={`/c/${props.contest.id}/p/${pid}`}
              aria-label={accessibleLabel}
              aria-current={current ? "page" : undefined}
              title={accessibleLabel}
            >
              {label}
              {submitted && (
                <span
                  className={`${style.submissionIndicator} ${
                    accepted
                      ? style.indicatorAccepted
                      : resultHidden
                      ? style.indicatorSubmitted
                      : style.indicatorAttempted
                  }`}
                  aria-hidden="true"
                />
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
};

export default ContestProblemNavigation;
