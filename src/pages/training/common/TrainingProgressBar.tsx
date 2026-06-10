import React from "react";
import { Progress } from "semantic-ui-react";

import style from "./TrainingPage.module.less";

interface TrainingProgressBarProps {
  acceptedProblemCount: number;
  problemCount: number;
}

const TrainingProgressBar: React.FC<TrainingProgressBarProps> = props => {
  const percent = props.problemCount ? (props.acceptedProblemCount / props.problemCount) * 100 : 0;

  return (
    <div className={style.trainingProgress}>
      <Progress percent={percent} size="tiny" indicating className={style.trainingProgressBar} />
      <span className={style.trainingProgressText}>
        {props.acceptedProblemCount} / {props.problemCount}
      </span>
    </div>
  );
};

export default TrainingProgressBar;
