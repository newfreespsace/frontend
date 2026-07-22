import React from "react";
import { Breadcrumb } from "semantic-ui-react";

import style from "./TrainingPage.module.less";

import { Link } from "@/utils/hooks";

interface TrainingBreadcrumbProps {
  training: Pick<ApiTypes.TrainingMetaDto, "id" | "title">;
  chapter: Pick<ApiTypes.ChapterMetaDto, "id" | "title">;
  section?: Pick<ApiTypes.SectionMetaDto, "id" | "title">;
}

const TrainingBreadcrumb: React.FC<TrainingBreadcrumbProps> = ({ training, chapter, section }) => {
  return (
    <Breadcrumb className={style.pageBreadcrumb}>
      <Breadcrumb.Section as={Link} href={`/t/${training.id}`}>
        {training.title}
      </Breadcrumb.Section>
      <Breadcrumb.Divider icon="right angle" />
      <Breadcrumb.Section
        active={!section}
        as={section ? Link : undefined}
        href={section ? `/t/${training.id}/${chapter.id}` : undefined}
      >
        {chapter.title}
      </Breadcrumb.Section>
      {section && (
        <>
          <Breadcrumb.Divider icon="right angle" />
          <Breadcrumb.Section active>{section.title}</Breadcrumb.Section>
        </>
      )}
    </Breadcrumb>
  );
};

export default TrainingBreadcrumb;
