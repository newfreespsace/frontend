import { useEffect, useState } from "react";

function isEventTarget(element: unknown): element is HTMLElement {
  return (
    !!element &&
    typeof (element as HTMLElement).addEventListener === "function" &&
    typeof (element as HTMLElement).removeEventListener === "function"
  );
}

export function useFocusWithin(): [boolean, (element: unknown) => void] {
  const [element, setElement] = useState<unknown>();
  const [focuseWithin, setFocuseWithin] = useState(false);
  useEffect(() => {
    if (!isEventTarget(element)) return;

    const onFocus = () => setFocuseWithin(true);
    const onBlur = () => setFocuseWithin(false);
    element.addEventListener("focus", onFocus);
    element.addEventListener("blur", onBlur);

    return () => {
      element.removeEventListener("focus", onFocus);
      element.removeEventListener("blur", onBlur);
    };
  }, [element]);

  return [focuseWithin, setElement];
}
