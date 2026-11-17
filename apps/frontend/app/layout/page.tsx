import type { Page as PageItem } from "@lapuertahostels/payload-types";
import { ContentBlocks } from "~/blocks/content-blocks";
import { HeroBlocks } from "~/blocks/hero-blocks";

export type PageProps = {
  content: PageItem;
};

export function Page({ content }: PageProps) {
  return (
    <>
      {content.hero && <HeroBlocks data={content.hero} />}
      {content.content && <ContentBlocks data={content.content} />}
    </>
  );
}
