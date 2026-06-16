import React from "react";
import { Button } from "semantic-ui-react";

import { useLocalizer } from "@/utils/hooks";

interface OrderButtonsProps {
  index: number;
  count: number;
  disabled?: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const OrderButtons: React.FC<OrderButtonsProps> = props => {
  const _ = useLocalizer("training");

  return (
    <Button.Group basic compact size="small">
      <Button
        icon="arrow up"
        disabled={props.disabled || props.index === 0}
        title={_(".move_up")}
        onClick={props.onMoveUp}
      />
      <Button
        icon="arrow down"
        disabled={props.disabled || props.index === props.count - 1}
        title={_(".move_down")}
        onClick={props.onMoveDown}
      />
    </Button.Group>
  );
};

export default OrderButtons;
