import React, { useState } from "react";
import { Label, Loader, Menu, Modal, Table } from "semantic-ui-react";

import style from "./ProblemDifficultyRatings.module.less";

import { DifficultyBadge } from "./ProblemDifficulty";

import { getProblemDifficultyRatings, ProblemDifficultyRatingEntry } from "@/interfaces/ProblemDifficulty";
import { Link, useLocalizer } from "@/utils/hooks";
import formatDateTime from "@/utils/formatDateTime";
import toast from "@/utils/toast";

export default function ProblemDifficultyRatings(props: { problemId: number }) {
  const _ = useLocalizer("problem");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ratings, setRatings] = useState<ProblemDifficultyRatingEntry[]>([]);

  async function openRatings() {
    setOpen(true);
    setLoading(true);
    const { requestError, response } = await getProblemDifficultyRatings({ problemId: props.problemId });
    if (requestError) {
      toast.error(requestError(_));
      setOpen(false);
    } else if (response.error) {
      toast.error(_(`.error.${response.error}`));
      setOpen(false);
    } else {
      setRatings(response.ratings || []);
    }
    setLoading(false);
  }

  return (
    <>
      <Menu.Item name={_(".action.difficulty_ratings")} icon="star" onClick={openRatings} />
      <Modal size="small" open={open} onClose={() => setOpen(false)} closeIcon>
        <Modal.Header>{_(".difficulty.ratings_title")}</Modal.Header>
        <Modal.Content scrolling>
          {loading ? (
            <Loader active inline="centered" />
          ) : ratings.length ? (
            <Table basic="very" unstackable className={style.table}>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>{_(".difficulty.user")}</Table.HeaderCell>
                  <Table.HeaderCell>{_(".difficulty.rating")}</Table.HeaderCell>
                  <Table.HeaderCell>{_(".difficulty.updated_at")}</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {ratings.map(item => (
                  <Table.Row key={item.userId}>
                    <Table.Cell>
                      <Link href={`/u/${item.username}`}>{item.nickname || item.username}</Link>
                      <span className={style.username}>@{item.username}</span>
                      {item.isAdmin && <Label size="mini" basic color="purple" content={_(".difficulty.admin_vote")} />}
                    </Table.Cell>
                    <Table.Cell>
                      <DifficultyBadge difficulty={item.score} size="small" />
                      {!item.counted && <Label size="mini" basic color="grey" content={_(".difficulty.not_counted")} />}
                    </Table.Cell>
                    <Table.Cell className={style.time}>{formatDateTime(item.updatedAt)[1]}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          ) : (
            _(".difficulty.no_ratings")
          )}
        </Modal.Content>
      </Modal>
    </>
  );
}
