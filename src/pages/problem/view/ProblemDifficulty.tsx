import React, { useEffect, useState } from "react";
import { Label, Loader, Popup, Rating } from "semantic-ui-react";

import style from "./ProblemDifficulty.module.less";

import { appState } from "@/appState";
import { useLocalizer } from "@/utils/hooks";
import toast from "@/utils/toast";
import {
  getDifficultyName,
  getProblemDifficultyRating,
  ProblemDifficultyRating as DifficultyRating,
  setProblemDifficultyRating
} from "@/interfaces/ProblemDifficulty";

const DIFFICULTY_COLORS = ["grey", "grey", "green", "blue", "purple", "red"] as const;

export function DifficultyBadge(props: { difficulty?: number; size?: "small"; className?: string }) {
  const _ = useLocalizer("problem");
  return (
    <Label color={DIFFICULTY_COLORS[props.difficulty || 0]} size={props.size} className={props.className}>
      {getDifficultyName(props.difficulty) || _(".difficulty.unrated")}
    </Label>
  );
}

export default function ProblemDifficulty(props: {
  problemId: number;
  initialDifficulty?: number;
  size?: "small";
  onRated?: () => void;
}) {
  const _ = useLocalizer("problem");
  const [open, setOpen] = useState(false);
  const [difficulty, setDifficulty] = useState(props.initialDifficulty);
  const [rating, setRating] = useState<DifficultyRating>(null);
  const [ratingUserId, setRatingUserId] = useState<number>(null);
  const [draft, setDraft] = useState(1);
  const [preview, setPreview] = useState<number>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const currentUserId = appState.currentUser?.id;

  useEffect(() => {
    setRating(null);
    setRatingUserId(null);
    if (!currentUserId) return;
    let cancelled = false;
    getProblemDifficultyRating({ problemId: props.problemId }).then(({ requestError, response }) => {
      if (cancelled || requestError || response.error) return;
      setRating(response.rating);
      setRatingUserId(currentUserId);
      setDraft(response.rating.score ?? 1);
      setDifficulty(response.rating.difficulty);
    });
    return () => {
      cancelled = true;
    };
  }, [props.problemId, currentUserId]);

  async function loadRating() {
    setLoading(true);
    const { requestError, response } = await getProblemDifficultyRating({ problemId: props.problemId });
    if (requestError) {
      toast.error(requestError(_));
      setOpen(false);
    } else if (response.error) {
      toast.error(_(`.error.${response.error}`));
      setOpen(false);
    } else {
      setRating(response.rating);
      setRatingUserId(currentUserId);
      setDraft(response.rating.score ?? 1);
      setDifficulty(response.rating.difficulty);
      if (!response.rating.canRate) setOpen(false);
    }
    setLoading(false);
  }

  async function saveRating(score: number) {
    if (!rating?.canRate || saving || score === rating.score) return;
    setSaving(true);
    const { requestError, response } = await setProblemDifficultyRating({ problemId: props.problemId, score });
    if (requestError) {
      toast.error(requestError(_));
      setDraft(rating.score ?? 1);
    } else if (response.error) {
      toast.error(_(`.error.${response.error}`));
      setDraft(rating.score ?? 1);
    } else {
      setRating(response.rating);
      setDraft(response.rating.score ?? 1);
      setDifficulty(response.rating.difficulty);
      props.onRated?.();
    }
    setSaving(false);
  }

  const panel = (
    <div className={style.panel}>
      {loading || !rating ? (
        <Loader active inline="centered" />
      ) : (
        <Rating
          icon="star"
          maxRating={5}
          rating={draft}
          clearable={false}
          disabled={!rating.canRate || saving}
          aria-label={_(rating.canRate ? ".difficulty.open" : ".difficulty.need_accepted")}
          title={!rating.canRate ? _(".difficulty.need_accepted") : undefined}
          className={`${style.stars} ${style[`level${preview ?? draft}`]}`}
          onMouseOver={event => {
            if (!rating.canRate || saving) return;
            const icon = (event.target as HTMLElement).closest(".icon");
            if (icon) setPreview(Number(icon.getAttribute("aria-posinset")));
          }}
          onMouseLeave={() => setPreview(null)}
          onRate={(_, data) => {
            const score = Number(data.rating);
            setDraft(score);
            setPreview(null);
            saveRating(score);
          }}
        />
      )}
    </div>
  );

  if (!currentUserId || ratingUserId !== currentUserId || !rating?.canRate)
    return <DifficultyBadge difficulty={difficulty} size={props.size} />;

  return (
    <Popup
      className={style.popup}
      trigger={
        <Label
          as="button"
          color={DIFFICULTY_COLORS[difficulty || 0]}
          size={props.size}
          className={style.trigger}
          aria-label={_(".difficulty.open")}
        >
          {getDifficultyName(difficulty) || _(".difficulty.unrated")}
        </Label>
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
