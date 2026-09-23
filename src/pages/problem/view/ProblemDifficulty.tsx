import React, { useState } from "react";
import { Button, Loader, Popup } from "semantic-ui-react";

import style from "./ProblemDifficulty.module.less";

import { useLocalizer } from "@/utils/hooks";
import toast from "@/utils/toast";
import {
  DIFFICULTY_NAMES,
  getDifficultyName,
  getProblemDifficultyRating,
  ProblemDifficultyRating as DifficultyRating,
  setProblemDifficultyRating
} from "@/interfaces/ProblemDifficulty";

export function DifficultyBadge(props: { difficulty?: number; className?: string }) {
  const _ = useLocalizer("problem");
  return (
    <span className={`${style.badge} ${style[`level${props.difficulty || 0}`]} ${props.className || ""}`}>
      {getDifficultyName(props.difficulty) || _(".difficulty.unrated")}
    </span>
  );
}

export default function ProblemDifficulty(props: { problemId: number; initialDifficulty?: number }) {
  const _ = useLocalizer("problem");
  const [open, setOpen] = useState(false);
  const [difficulty, setDifficulty] = useState(props.initialDifficulty);
  const [rating, setRating] = useState<DifficultyRating>(null);
  const [draft, setDraft] = useState<number>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function loadRating() {
    setLoading(true);
    const { requestError, response } = await getProblemDifficultyRating({ problemId: props.problemId });
    if (requestError) toast.error(requestError(_));
    else if (response.error) toast.error(_(`.error.${response.error}`));
    else {
      setRating(response.rating);
      setDraft(response.rating.score ?? null);
      setDifficulty(response.rating.difficulty);
    }
    setLoading(false);
  }

  async function saveRating(score: number) {
    setSaving(true);
    const { requestError, response } = await setProblemDifficultyRating({ problemId: props.problemId, score });
    if (requestError) toast.error(requestError(_));
    else if (response.error) toast.error(_(`.error.${response.error}`));
    else {
      setRating(response.rating);
      setDraft(response.rating.score ?? null);
      setDifficulty(response.rating.difficulty);
      setOpen(false);
    }
    setSaving(false);
  }

  const fill = draft == null ? "0px" : `${(draft - 1) * 25}% + ${24 - (draft - 1) * 12}px`;
  const panel = (
    <div className={style.panel}>
      <div className={style.panelTitle}>{_(".difficulty.title")}</div>
      {loading || !rating ? (
        <Loader active inline="centered" />
      ) : (
        <>
          <div className={style.current}>
            {_(".difficulty.current")}: {getDifficultyName(rating.difficulty) || _(".difficulty.unrated")}
            {rating.average != null && ` · ${rating.average.toFixed(1)}/5`}
          </div>
          <div className={style.myRating}>{_(".difficulty.my_rating")}</div>
          <div className={style.choice}>{draft == null ? _(".difficulty.choose") : DIFFICULTY_NAMES[draft - 1]}</div>
          <div className={`${style.slider} ${draft == null ? style.unselected : ""}`}>
            <div className={style.fill} style={{ width: `calc(${fill})` }} />
            {DIFFICULTY_NAMES.map((name, index) => (
              <span key={name} className={style.mark} style={{ left: `calc(${index * 25}% + ${24 - index * 12}px)` }} />
            ))}
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={draft ?? 3}
              disabled={!rating.canRate || saving}
              aria-label={_(".difficulty.my_rating")}
              aria-valuetext={draft == null ? _(".difficulty.choose") : DIFFICULTY_NAMES[draft - 1]}
              onChange={event => setDraft(Number(event.currentTarget.value))}
              onPointerUp={event => setDraft(Number(event.currentTarget.value))}
            />
          </div>
          <div className={style.ends}>
            <span>{DIFFICULTY_NAMES[0]}</span>
            <span>{DIFFICULTY_NAMES[4]}</span>
          </div>
          {rating.canRate ? (
            <div className={style.actions}>
              {rating.score != null && (
                <Button basic size="small" disabled={saving} onClick={() => saveRating(0)}>
                  {_(".difficulty.remove")}
                </Button>
              )}
              <Button
                primary
                size="small"
                loading={saving}
                disabled={draft == null || draft === rating.score}
                onClick={() => saveRating(draft)}
              >
                {rating.score == null ? _(".difficulty.submit") : _(".difficulty.update")}
              </Button>
            </div>
          ) : (
            <div className={style.notice}>
              {_(rating.score == null ? ".difficulty.need_accepted" : ".difficulty.rating_suspended")}
              {rating.score != null && (
                <div className={style.actions}>
                  <Button basic size="small" disabled={saving} onClick={() => saveRating(0)}>
                    {_(".difficulty.remove")}
                  </Button>
                </div>
              )}
            </div>
          )}
          <div className={style.rule}>{_(".difficulty.admin_weight")}</div>
        </>
      )}
    </div>
  );

  return (
    <Popup
      trigger={
        <button type="button" className={style.trigger} aria-label={_(".difficulty.open")}>
          <DifficultyBadge difficulty={difficulty} />
        </button>
      }
      content={panel}
      on="click"
      open={open}
      onOpen={() => {
        setOpen(true);
        loadRating();
      }}
      onClose={() => setOpen(false)}
      position="bottom left"
      flowing
    />
  );
}
