import React from "react";
import { Header, Menu, Button } from "semantic-ui-react";
import { observer } from "mobx-react";

import style from "./SubmitViewFrame.module.less";

import { useLocalizer, Link } from "@/utils/hooks";
import StatusText from "@/components/StatusText";
import ScoreText from "@/components/ScoreText";

interface SubmitViewFrameProps {
  mainContent: React.ReactNode;
  sidebarContent: React.ReactNode;
  submitDisabled: boolean;
  onGetSubmitFile?: () => Promise<Blob>;

  inSubmitView: boolean;
  pendingSubmit: boolean;
  lastSubmission?: ApiTypes.ProblemLastSubmissionDto;
  onCloseSubmitView: () => void;
  onSubmit: (onGetSubmitFile?: () => Promise<Blob>) => void;
}

let SubmitViewFrame: React.FC<SubmitViewFrameProps> = props => {
  const _ = useLocalizer("problem");

  return (
    <div className={style.submitView} style={{ display: props.inSubmitView ? null : "none" }}>
      <div className={style.leftContainer}>{props.mainContent}</div>
      <div className={style.rightContainer}>
        <Menu pointing secondary vertical className={style.actionMenu}>
          <Menu.Item name={_(".submit.back_to_statement")} icon="arrow left" onClick={props.onCloseSubmitView} />
          <div />
        </Menu>
        {props.sidebarContent}
        <Button
          className={style.submitButton}
          primary
          fluid
          icon="paper plane"
          loading={props.pendingSubmit}
          disabled={props.submitDisabled}
          content={_(".submit.submit")}
          onClick={() => props.onSubmit(props.onGetSubmitFile)}
        />
        {props.lastSubmission && props.lastSubmission.lastSubmission && (
          <div className={style.lastSubmission}>
            <Header size="tiny" content={_(".submit.last_submission")} />
            <Link href={`/s/${props.lastSubmission.lastSubmission.id}`}>
              <StatusText status={props.lastSubmission.lastSubmission.status} />
            </Link>
            <Link className={style.scoreText} href={`/s/${props.lastSubmission.lastSubmission.id}`}>
              <ScoreText score={props.lastSubmission.lastSubmission.score || 0} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

SubmitViewFrame = observer(SubmitViewFrame);

interface EditorWrapperProps {
  disabled?: boolean;
  children?: React.ReactNode;
}

const EditorWrapper: React.FC<EditorWrapperProps> = props => {
  return <div className={style.editorWrapper + (props.disabled ? " " + style.disabled : "")}>{props.children}</div>;
};

export default Object.assign(SubmitViewFrame, {
  EditorWrapper
});
