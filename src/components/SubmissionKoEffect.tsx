import React, { useEffect } from "react";

import style from "./SubmissionKoEffect.module.less";

interface SubmissionKoEffectProps {
  onFinished: () => void;
}

const SPARK_COUNT = 18;
const EFFECT_DURATION_MS = 1800;

const SubmissionKoEffect: React.FC<SubmissionKoEffectProps> = ({ onFinished }) => {
  useEffect(() => {
    const timer = window.setTimeout(onFinished, EFFECT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [onFinished]);

  return (
    <div className={style.overlay} aria-hidden="true">
      <div className={style.flash} />
      <div className={style.impactBeam} />
      <div className={style.impactRing} />
      <div className={style.sparks}>
        {Array.from({ length: SPARK_COUNT }, (_, index) => (
          <i
            key={index}
            style={
              {
                "--spark-angle": `${index * (360 / SPARK_COUNT)}deg`,
                "--spark-distance": `${150 + (index % 5) * 32}px`,
                "--spark-delay": `${(index % 3) * 24}ms`
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      <div className={style.koWrap}>
        <span className={style.koShadow}>K.O.</span>
        <span className={style.koText} data-text="K.O.">
          K.O.
        </span>
      </div>
    </div>
  );
};

export default SubmissionKoEffect;
