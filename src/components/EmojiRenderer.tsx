import React, { useEffect, useRef } from "react";
import twemoji from "twemoji";

import style from "./EmojiRenderer.module.less";

interface EmojiRendererProps {
  children: React.ReactElement;
}

let nextEmojiRendererId = 0;
const emojiRendererDataAttribute = "data-emoji-renderer-id";

export const getTwemojiOptions = (inline: boolean) =>
  ({
    base: `${window.cdnjs}/twemoji/${EXTERNAL_PACKAGE_VERSION["twemoji"]}/`,
    size: "svg",
    ext: ".svg",
    className: inline ? style.emoji : "",
    callback: (icon, options: TwemojiOptions, variant) => {
      if (icon === "1f1f9-1f1fc") icon = "1f1e8-1f1f3";

      switch (icon) {
        // © copyright
        case "a9":
        // ® registered trademark
        case "ae":
        // ™ trademark
        case "2122":
          return false;
      }

      return `${options.base}${options.size}/${icon}${options.ext}`;
    }
  } as Partial<TwemojiOptions>);

export const EmojiRenderer: React.FC<EmojiRendererProps> = props => {
  const rendererIdRef = useRef<string>();
  if (!rendererIdRef.current) rendererIdRef.current = `emoji-renderer-${++nextEmojiRendererId}`;

  useEffect(() => {
    const element = document.querySelector<HTMLElement>(`[${emojiRendererDataAttribute}="${rendererIdRef.current}"]`);
    if (element) twemoji.parse(element, getTwemojiOptions(true));
  });

  return React.cloneElement(props.children, {
    [emojiRendererDataAttribute]: rendererIdRef.current
  } as React.HTMLAttributes<HTMLElement>);
};
