import React, { useState } from "react";
import { Button, Form, Icon, Modal } from "semantic-ui-react";

import { useLocalizer } from "@/utils/hooks";

interface TrainingPointsModalProps {
  initialPoints: number;
  pending: boolean;
  onSubmit: (pointsPerProblem: number) => Promise<void>;
}

const TrainingPointsModal: React.FC<TrainingPointsModalProps> = props => {
  const _ = useLocalizer("training");
  const [open, setOpen] = useState(false);
  const [points, setPoints] = useState(props.initialPoints);

  async function onSubmit() {
    await props.onSubmit(points);
    setOpen(false);
  }

  return (
    <Modal
      size="tiny"
      open={open}
      onClose={() => setOpen(false)}
      trigger={
        <Button onClick={() => setOpen(true)}>
          <Icon name="star" />
          {_(".edit_points")}
        </Button>
      }
    >
      <Modal.Header>{_(".edit_points")}</Modal.Header>
      <Modal.Content>
        <Form>
          <Form.Input
            type="number"
            min={0}
            step={1}
            label={_(".points_per_problem")}
            value={points}
            onChange={e => setPoints(Math.max(0, Math.floor(Number(e.currentTarget.value) || 0)))}
          />
          <p>{_(".points_per_problem_hint")}</p>
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={() => setOpen(false)}>{_(".cancel")}</Button>
        <Button primary loading={props.pending} onClick={onSubmit}>
          {_(".save")}
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default TrainingPointsModal;
