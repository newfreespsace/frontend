import React from "react";
import { Accordion, AccordionContentProps } from "semantic-ui-react";

interface LazyAccordionContentProps extends AccordionContentProps {
  renderContent: () => React.ReactNode;
}

// Accordion panels inject `active` into their content element. Collapsed panels
// must not mount code boxes or build nested testcase lists.
export default function LazyAccordionContent({ renderContent, active, ...props }: LazyAccordionContentProps) {
  return (
    <Accordion.Content {...props} active={active}>
      {active ? renderContent() : null}
    </Accordion.Content>
  );
}
