import { appState } from "@/appState";

export enum CodeLanguage {
  Cpp = "cpp",
  C = "c",
  Java = "java",
  Kotlin = "kotlin",
  Pascal = "pascal",
  Python = "python",
  Rust = "rust",
  Swift = "swift",
  Go = "go",
  Haskell = "haskell",
  CSharp = "csharp",
  FSharp = "fsharp"
}

// For UI
export enum CodeLanguageOptionType {
  Select = "Select"
  // Input = "Input"
}

export interface CodeLanguageOption {
  name: string;
  type: CodeLanguageOptionType;
  values: string[]; // string[] | undefined
  defaultValue: string; // string | boolean
}

const codeLanguageExtensions: Record<CodeLanguage, string[]> = {
  [CodeLanguage.Cpp]: [".cpp", ".cc", ".cxx"],
  [CodeLanguage.C]: [".c"],
  [CodeLanguage.Java]: [".java"],
  [CodeLanguage.Kotlin]: [".kt"],
  [CodeLanguage.Pascal]: [".pas"],
  [CodeLanguage.Python]: [".py"],
  [CodeLanguage.Rust]: [".rs"],
  [CodeLanguage.Swift]: [".swift"],
  [CodeLanguage.Go]: [".go"],
  [CodeLanguage.Haskell]: [".hs"],
  [CodeLanguage.CSharp]: [".cs"],
  [CodeLanguage.FSharp]: [".fs"]
};

export function checkCodeFileExtension(language: CodeLanguage, filename: string): boolean {
  return codeLanguageExtensions[language].some(extension => filename.toLowerCase().endsWith(extension));
}

export const compileAndRunOptions: Partial<Record<CodeLanguage, CodeLanguageOption[]>> = {
  [CodeLanguage.Cpp]: [
    {
      name: "compiler",
      type: CodeLanguageOptionType.Select,
      values: ["g++"],
      defaultValue: "g++"
    },
    {
      name: "std",
      type: CodeLanguageOptionType.Select,
      values: ["c++14"],
      defaultValue: "c++14"
    },
    {
      name: "O",
      type: CodeLanguageOptionType.Select,
      values: ["2"],
      defaultValue: "2"
    },
    {
      name: "m",
      type: CodeLanguageOptionType.Select,
      values: ["64"],
      defaultValue: "64"
    }
  ],
  [CodeLanguage.Python]: [
    {
      name: "version",
      type: CodeLanguageOptionType.Select,
      values: ["3.10"],
      defaultValue: "3.10"
    }
  ]
};

export const getDefaultCompileAndRunOptions = (codeLanguage: CodeLanguage): Record<string, unknown> =>
  Object.fromEntries((compileAndRunOptions[codeLanguage] || []).map(({ name, defaultValue }) => [name, defaultValue]));

export const filterValidCompileAndRunOptions = (
  codeLanguage: CodeLanguage,
  inputOptions: Record<string, unknown>
): Record<string, unknown> =>
  Object.assign(
    {},
    getDefaultCompileAndRunOptions(codeLanguage),
    Object.fromEntries(
      Object.entries(inputOptions || ({} as Record<string, unknown>)).filter(([name, value]) => {
        const option = (compileAndRunOptions[codeLanguage] || []).find(option => option.name === name);
        if (!option) return false;
        switch (option.type) {
          case CodeLanguageOptionType.Select:
            return option.values.includes(value as string);
        }
      })
    )
  );

export const getPreferredCodeLanguage = () =>
  (appState.userPreference.code?.defaultLanguage as CodeLanguage) || Object.values(CodeLanguage)[0];

export const getPreferredCompileAndRunOptions = (codeLanguage: CodeLanguage) =>
  codeLanguage === appState.userPreference.code?.defaultLanguage
    ? filterValidCompileAndRunOptions(codeLanguage, appState.userPreference.code?.defaultCompileAndRunOptions)
    : getDefaultCompileAndRunOptions(codeLanguage);
