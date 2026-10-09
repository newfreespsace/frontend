import React, { useEffect, useRef, useState } from "react";

import style from "./RanklistScrollArea.module.less";

interface RanklistScrollAreaProps {
  children: React.ReactNode;
  scrollLabel: string;
  tableLabel: string;
}

const RanklistScrollArea: React.FC<RanklistScrollAreaProps> = ({ children, scrollLabel, tableLabel }) => {
  const tableWrap = useRef<HTMLDivElement>(null);
  const topScroll = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const wrap = tableWrap.current;
    const update = () => {
      setContentWidth(wrap.scrollWidth);
      setOverflowing(wrap.scrollWidth > wrap.clientWidth);
      if (topScroll.current) topScroll.current.scrollLeft = wrap.scrollLeft;
    };
    update();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(update);
    observer?.observe(wrap);
    if (wrap.firstElementChild) observer?.observe(wrap.firstElementChild);
    window.addEventListener("resize", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [children]);

  useEffect(() => {
    if (topScroll.current) topScroll.current.scrollLeft = tableWrap.current.scrollLeft;
  }, [contentWidth, overflowing]);

  return (
    <div className={style.container}>
      {overflowing && (
        <>
          <div className={style.scrollHint}>{scrollLabel}</div>
          <div
            ref={topScroll}
            className={style.topScroll}
            role="region"
            aria-label={scrollLabel}
            tabIndex={0}
            onScroll={event => {
              tableWrap.current.scrollLeft = event.currentTarget.scrollLeft;
            }}
          >
            <div style={{ width: contentWidth, height: 1 }} />
          </div>
        </>
      )}
      <div
        ref={tableWrap}
        className={style.tableWrap}
        role="region"
        aria-label={tableLabel}
        tabIndex={0}
        onScroll={event => {
          if (topScroll.current) topScroll.current.scrollLeft = event.currentTarget.scrollLeft;
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default RanklistScrollArea;
