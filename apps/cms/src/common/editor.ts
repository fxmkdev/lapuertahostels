import type { SanitizedConfig } from "payload";

import {
  BoldFeature,
  defaultEditorConfig,
  getEnabledNodes,
  HeadingFeature,
  IndentFeature,
  InlineCodeFeature,
  InlineToolbarFeature,
  ItalicFeature,
  lexicalEditor,
  LinkFeature,
  OrderedListFeature,
  ParagraphFeature,
  sanitizeServerEditorConfig,
  StrikethroughFeature,
  UnderlineFeature,
  UnorderedListFeature,
} from "@payloadcms/richtext-lexical";
import { createHeadlessEditor } from "@payloadcms/richtext-lexical/lexical/headless";

import {
  externalLinkFields,
  queryStringAndFragmentField,
} from "../fields/link";

const features = [
  BoldFeature(),
  ItalicFeature(),
  UnderlineFeature(),
  StrikethroughFeature(),
  InlineCodeFeature(),
  ParagraphFeature(),
  HeadingFeature({ enabledHeadingSizes: ["h4", "h5"] }),
  UnorderedListFeature(),
  OrderedListFeature(),
  IndentFeature(),
  LinkFeature({
    enabledCollections: ["pages"],
    fields: ({ defaultFields }) => [
      // Use our shared controls so missing settings preserve each renderer's defaults.
      ...defaultFields.filter((f) => f.name !== "newTab"),
      queryStringAndFragmentField(),
      ...externalLinkFields(),
    ],
  }),

  InlineToolbarFeature(),
];

export async function getEditorConfig(payloadConfig: SanitizedConfig) {
  return await sanitizeServerEditorConfig(
    {
      ...defaultEditorConfig,
      features,
    },
    payloadConfig,
  );
}

export function editor() {
  return lexicalEditor({ features });
}

export async function createEditor(payloadConfig: SanitizedConfig) {
  return createHeadlessEditor({
    nodes: getEnabledNodes({
      editorConfig: await getEditorConfig(payloadConfig),
    }),
  });
}
