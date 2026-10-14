import React, { useMemo, useState } from "react";
import { Dropdown, Form, Icon, FormSelectProps, DropdownProps, SemanticICONS, Popup } from "semantic-ui-react";

import style from "./TestDataFileSelector.module.less";

import { useLocalizer } from "@/utils/hooks";
import getFileIcon from "@/utils/getFileIcon";
import formatFileSize from "@/utils/formatFileSize";
import { EmojiRenderer } from "@/components/EmojiRenderer";

interface TestDataFileSelectorProps {
  type: "FormSelect" | "ItemSearchDropdown";
  className?: string;
  iconInputOrOutput?: SemanticICONS;
  label?: FormSelectProps["label"];
  testData: ApiTypes.ProblemFileDto[];
  optional?: boolean;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}

// Every testcase shares the same immutable file list; index it only once.
const fileIndexes = new WeakMap<ApiTypes.ProblemFileDto[], Map<string, ApiTypes.ProblemFileDto>>();
const MAX_VISIBLE_FILES = 100;

const TestDataFileSelector: React.FC<TestDataFileSelectorProps> = props => {
  const _ = useLocalizer("problem_judge_settings");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  let fileIndex = fileIndexes.get(props.testData);
  if (!fileIndex) {
    fileIndex = new Map(props.testData.map(file => [file.filename, file]));
    fileIndexes.set(props.testData, fileIndex);
  }
  const selectedFile = fileIndex.get(props.value);
  const { visibleFiles, hasMore } = useMemo(() => {
    if (!open) return { visibleFiles: selectedFile ? [selectedFile] : [], hasMore: false };
    const visibleFiles: ApiTypes.ProblemFileDto[] = [];
    const search = query.toLowerCase();
    for (const file of props.testData) {
      if (!file.filename.toLowerCase().includes(search)) continue;
      if (visibleFiles.length === MAX_VISIBLE_FILES) return { visibleFiles, hasMore: true };
      visibleFiles.push(file);
    }
    return { visibleFiles, hasMore: false };
  }, [open, query, props.testData, selectedFile]);

  function renderFile(filename: string, file?: ApiTypes.ProblemFileDto) {
    return (
      <div className="text">
        {props.iconInputOrOutput && <Icon className={style.iconInputOrOutput} name={props.iconInputOrOutput} />}
        {file ? (
          <Icon name={getFileIcon(filename)} className={style.iconFile} />
        ) : (
          <Popup
            trigger={<Icon name="warning sign" className={style.iconFile} />}
            content={_(".file_selector.file_not_found_warning")}
            position="top center"
          />
        )}
        <EmojiRenderer>
          <div className={style.filename}>{"\u200E" + filename}</div>
        </EmojiRenderer>
        {file && <div className={style.fileSize}>{formatFileSize(file.size, 1)}</div>}
      </div>
    );
  }

  const options: DropdownProps["options"] = [
    ...(props.optional ? [{ key: "empty", value: null, text: _(".file_selector.empty") }] : []),
    ...(!open && props.value && !selectedFile
      ? [{ key: props.value, value: props.value, text: props.value, content: renderFile(props.value) }]
      : []),
    ...visibleFiles.map(file => ({
      key: file.filename,
      value: file.filename,
      text: file.filename,
      content: renderFile(file.filename, file)
    })),
    ...(hasMore ? [{ key: "search-hint", disabled: true, text: _(".file_selector.search_hint") }] : [])
  ];
  const uiProps: DropdownProps = {
    className:
      style.fileSelect +
      " " +
      (props.type === "ItemSearchDropdown" ? style.itemSearchDropdown : style.formSelect) +
      (props.className ? " " + props.className : ""),
    placeholder: props.placeholder,
    value: props.value,
    options,
    lazyLoad: true,
    open,
    search: () => options,
    searchQuery: query,
    onSearchChange: (_, { searchQuery }) => setQuery(searchQuery),
    onOpen: () => setOpen(true),
    onClose: () => {
      setOpen(false);
      setQuery("");
    },
    noResultsMessage: _(".file_selector.no_matching_files"),
    onChange: (_, { value }) => props.onChange(value as string)
  };

  return props.type === "ItemSearchDropdown" ? (
    <Dropdown item selection {...uiProps} />
  ) : (
    <Form.Select label={props.label} {...(uiProps as FormSelectProps)} />
  );
};

export default TestDataFileSelector;
