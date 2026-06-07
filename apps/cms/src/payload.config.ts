import path from "path";

import { mongooseAdapter } from "@payloadcms/db-mongodb";
import { buildConfig } from "payload";

import { Config } from "./payload-types";
import { translations } from "./translations";
import { fileURLToPath } from "url";

import { en } from "@payloadcms/translations/languages/en";
import { es } from "@payloadcms/translations/languages/es";
import { resendAdapter } from "@payloadcms/email-resend";
import { cmsPlugin } from "@fxmk/cms-plugin";
import { RoomListBlock } from "./blocks/room-list/config";
import { AccommodationSelectorBlock } from "./blocks/accommodation-selector/config";
import { footer } from "./globals/footer/config";
import { additionalUiLabelFields } from "./ui-labels";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

declare module "payload" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface GeneratedTypes extends Config {}
}

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET!,
  admin: {
    meta: {
      titleSuffix: " · La Puerta Hostels Admin",
      icons: [
        {
          rel: "icon",
          type: "image/vnd.microsoft.icon",
          url: "/assets/favicon.ico",
          sizes: "48x48",
        },
      ],
    },
    components: {
      graphics: {
        Logo: "/src/components/logo#Logo",
        Icon: "/src/components/logo#LogoSmall",
      },
    },
  },
  typescript: {
    outputFile: path.resolve(dirname, "./payload-types.ts"),
    declare: false,
  },
  plugins: [
    cmsPlugin({
      additionalContentBlocks: [RoomListBlock, AccommodationSelectorBlock],
      additionalUiLabelFields,
      mediaS3Storage: {
        bucket: process.env.MEDIA_S3_BUCKET!,
        region: process.env.MEDIA_S3_REGION!,
        accessKeyId: process.env.MEDIA_S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.MEDIA_S3_SECRET_ACCESS_KEY!,
      },
      deeplApiKey: process.env.DEEPL_API_AUTH_KEY,
      openaiApiKey: process.env.OPENAI_API_KEY,
      publicMediaBaseUrl: process.env.IMAGEKIT_BASE_URL,
      livePreviewBaseUrl: process.env.LIVE_PREVIEW_URL,
      serverUrl: process.env.SERVER_URL,
      e2eTestsApiKey: process.env.E2E_TESTS_API_KEY,
      themeColors: [
        { label: { en: "Puerta", es: "Puerta" }, value: "puerta" },
        { label: { en: "Aqua", es: "Aqua" }, value: "aqua" },
        { label: { en: "Azul", es: "Azul" }, value: "azul" },
      ],
    }),
  ],
  db: mongooseAdapter({
    url: process.env.DATABASE_URI!,
  }),
  globals: [footer()],
  i18n: { supportedLanguages: { en, es }, translations },
  email: resendAdapter({
    defaultFromAddress: "no-reply@admin.lapuertahostels.co",
    defaultFromName: "La Puerta Hostels Admin",
    apiKey: process.env.RESEND_API_KEY!,
  }),
});
