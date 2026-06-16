import React, { ReactNode, useState } from "react";
import { Button, Icon, Modal } from "semantic-ui-react";

import style from "./TrainingPage.module.less";

interface TrainingManageModalProps {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}

const TrainingManageModal: React.FC<TrainingManageModalProps> = props => {
  const [open, setOpen] = useState(false);

  return (
    <Modal
      size="small"
      open={open}
      onClose={() => setOpen(false)}
      trigger={
        <Button primary className="labeled icon" onClick={() => setOpen(true)}>
          <Icon name="setting" />
          管理
        </Button>
      }
    >
      <Modal.Header>{props.title}</Modal.Header>
      <Modal.Content>
        {props.actions && <div className={style.manageActions}>{props.actions}</div>}
        {props.children}
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={() => setOpen(false)}>关闭</Button>
      </Modal.Actions>
    </Modal>
  );
};

export default TrainingManageModal;
