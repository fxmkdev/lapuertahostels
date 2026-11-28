export type LanguageSuggestion = {
  locale: string;
  pathname: string;
  message: string;
  switch: string;
  keep: string;
};

export const languageSuggestionDefaults = {
  en: {
    message: "This page is also available in {{language}}.",
    switch: "Switch to {{language}}",
    keep: "Keep {{language}}",
  },
  es: {
    message: "Esta página también está disponible en {{language}}.",
    switch: "Cambiar a {{language}}",
    keep: "Continuar en {{language}}",
  },
};
