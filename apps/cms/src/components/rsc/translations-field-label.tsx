import type {
  FieldLabelServerProps,
  RichTextField,
  RichTextFieldClient,
  TextareaField,
  TextareaFieldClient,
  TextField,
  TextFieldClient,
} from "payload";

import { getLabelText } from "../../common/labels";
import { TranslationsFieldLabelClient } from "../client/translations-field-label";

type TranslationField = RichTextField | TextareaField | TextField;
type TranslationFieldClient =
  | RichTextFieldClient
  | TextareaFieldClient
  | TextFieldClient;

export function TranslationsFieldLabel({
  clientField,
  field,
  i18n,
  path,
}: FieldLabelServerProps<TranslationField, TranslationFieldClient>) {
  const sourceLabel = clientField.label ?? field.label;

  return (
    <TranslationsFieldLabelClient
      label={sourceLabel ? getLabelText(sourceLabel, i18n) : undefined}
      path={path}
      required={clientField.required ?? field.required}
    />
  );
}
