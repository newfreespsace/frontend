import React, { useEffect, useState } from "react";
import { Pagination } from "semantic-ui-react";

export function useListPagination(totalCount: number, pageSize: number) {
  const [requestedPage, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(requestedPage, totalPages);
  useEffect(() => setPage(current => Math.min(current, totalPages)), [totalPages]);
  const start = (page - 1) * pageSize;

  return {
    start,
    end: Math.min(start + pageSize, totalCount),
    showIndex: (index: number) => setPage(Math.floor(index / pageSize) + 1),
    controls:
      totalPages > 1 ? (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, margin: "12px 0" }}>
          <span>{`#${start + 1}–${Math.min(start + pageSize, totalCount)} / ${totalCount}`}</span>
          <Pagination
            size="mini"
            activePage={page}
            totalPages={totalPages}
            siblingRange={0}
            boundaryRange={1}
            onPageChange={(_, { activePage }) => setPage(Number(activePage))}
          />
        </div>
      ) : null
  };
}

interface PaginatedListProps {
  totalCount: number;
  pageSize?: number;
  renderRange: (start: number, end: number) => React.ReactNode;
}

export default function PaginatedList({ totalCount, pageSize = 50, renderRange }: PaginatedListProps) {
  const { start, end, controls } = useListPagination(totalCount, pageSize);
  return (
    <>
      {controls}
      {renderRange(start, end)}
      {controls}
    </>
  );
}
