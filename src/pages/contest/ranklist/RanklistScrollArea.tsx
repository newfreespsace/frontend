import React from "react";

import style from "./RanklistScrollArea.module.less";

interface RanklistScrollAreaProps {
  children: React.ReactNode;
  tableLabel: string;
}

const RanklistScrollArea: React.FC<RanklistScrollAreaProps> = ({ children, tableLabel }) => (
  <div className={style.tableWrap} role="region" aria-label={tableLabel} tabIndex={0}>
    {children}
  </div>
);

export default RanklistScrollArea;
