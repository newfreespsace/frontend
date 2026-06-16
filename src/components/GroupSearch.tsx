import React from "react";

import style from "./GroupSearch.module.less";

import api from "@/api";
import toast from "@/utils/toast";
import PreviewSearch from "./PreviewSearch";

interface GroupSearchProps {
  className?: string;
  placeholder?: string;
  noResultsMessage?: string;
  memberCountText?: (memberCount: number) => string;
  onResultSelect: (group: ApiTypes.GroupMetaDto) => void;
}

const GroupSearch: React.FC<GroupSearchProps> = props => (
  <PreviewSearch
    className={props.className}
    placeholder={props.placeholder || "Search groups"}
    noResultsMessage={props.noResultsMessage || "No groups found"}
    onGetResultKey={result => result.id}
    onSearch={async input => {
      const wildcardStart = input.startsWith("*");
      if (wildcardStart) input = input.substr(1);
      if (!input) return [];

      const { requestError, response } = await api.group.searchGroup({
        query: input,
        wildcard: wildcardStart ? "Both" : "End"
      });

      if (requestError) toast.error(requestError((key: string) => key));
      else return response.groupMetas;

      return [];
    }}
    onRenderResult={result => (
      <div className={style.result}>
        <div className={style.name}>{result.name}</div>
        <div className={style.memberCount}>
          {props.memberCountText ? props.memberCountText(result.memberCount) : String(result.memberCount)}
        </div>
      </div>
    )}
    onResultSelect={props.onResultSelect}
  />
);

export default GroupSearch;
