import React from "react";

import style from "./ScoreText.module.less";

interface ScoreTextProps {
  score: number;
  children?: React.ReactNode;
}

const ScoreText: React.FC<ScoreTextProps> = props => {
  const scoreClass = Math.max(0, Math.min(10, Math.floor(props.score / 10)));
  return <span className={style["score_" + scoreClass]}>{props.children ?? props.score}</span>;
};

export default ScoreText;

export function getScoreColor(score: number | string): string {
  return [
    "#ff4f4f",
    "#ff694f",
    "#f8603a",
    "#fc8354",
    "#fa9231",
    "#f7bb3b",
    "#ecdb44",
    "#e2ec52",
    "#b0d628",
    "#93b127",
    "#25ad40"
  ][Math.floor((Number(score) || 0) / 10)];
}
