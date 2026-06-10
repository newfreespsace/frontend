import React, { useState, useRef, useEffect } from "react";
import { ImageProps } from "semantic-ui-react";
import isEqual from "lodash/isEqual";

import defaultAvatar from "@/assets/default-avatar.svg";
import { appState } from "@/appState";

interface UserAvatarProps extends ImageProps {
  userAvatar: ApiTypes.UserAvatarDto;
  placeholder?: boolean;
  imageSize?: number;
  onError?: () => void;
}

function ensureTrailingSlash(url: string) {
  return url.endsWith("/") ? url : `${url}/`;
}

function getAvatarUrl(avatar: ApiTypes.UserAvatarDto, size: number) {
  switch (avatar.type) {
    case "gravatar":
      return `${ensureTrailingSlash(window.gravatarCdn || appState.serverPreference.misc.gravatarCdn)}avatar/${
        avatar.key
      }?size=${size}&default=404`;
    case "qq":
      let sizeParam: number;
      if (size <= 40) sizeParam = 1;
      else if (size <= 100) sizeParam = 3;
      else if (size <= 140) sizeParam = 4;
      else sizeParam = 5;
      return `https://q1.qlogo.cn/g?b=qq&nk=${avatar.key}&s=${sizeParam}`;
    case "github":
      return `${ensureTrailingSlash(window.ghAvatarCdn || "https://github.com")}${avatar.key}.png?size=${size}`;
  }
}

const UserAvatar: React.FC<UserAvatarProps> = props => {
  const [error, setError] = useState(false);
  const {
    userAvatar,
    placeholder,
    imageSize: _imageSize,
    onError,
    as: _as,
    avatar,
    bordered,
    centered,
    circular,
    className,
    content: _content,
    dimmer: _dimmer,
    disabled,
    floated,
    fluid,
    hidden,
    href: _href,
    inline,
    label: _label,
    rounded,
    size,
    spaced,
    ui = true,
    verticalAlign,
    wrapped: _wrapped,
    ...imgProps
  } = props;

  const imageSize =
    _imageSize ||
    {
      mini: 35,
      tiny: 80,
      small: 150,
      medium: 300,
      large: 450,
      big: 600,
      huge: 800,
      massive: 960
    }[size] ||
    80;

  const url = getAvatarUrl(userAvatar, Math.ceil(window.devicePixelRatio * imageSize));

  const previousUrl = useRef<string>();
  useEffect(() => {
    previousUrl.current = url;
  });
  if (previousUrl.current !== url && error) setError(false);

  function onImageError() {
    setError(true);
    if (onError) onError();
  }

  const classes = [
    ui && "ui",
    size,
    avatar && "avatar",
    bordered && "bordered",
    circular && "circular",
    centered && "centered",
    disabled && "disabled",
    fluid && "fluid",
    hidden && "hidden",
    inline && "inline",
    rounded && "rounded",
    spaced === true ? "spaced" : spaced && `${spaced} spaced`,
    floated && `${floated} floated`,
    verticalAlign && `${verticalAlign} aligned`,
    "image",
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <img
      {...imgProps}
      className={classes}
      src={error || placeholder ? defaultAvatar : url}
      onError={error || placeholder ? undefined : onImageError}
    />
  );
};

export default React.memo(UserAvatar, isEqual);
