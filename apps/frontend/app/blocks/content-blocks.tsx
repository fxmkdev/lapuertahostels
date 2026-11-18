import type { Page } from "@lapuertahostels/payload-types";
import { AccommodationSelectorBlock } from "./accommodation-selector-block";
import { ImageWithFloatingTextBlock } from "./image-with-floating-text-block";
import { LeadTextBlock } from "./lead-text-block";
import { StoryBlock } from "./story-block";
import { FeaturesBlock } from "./features-block/features-block";
import { SeparatorBlock } from "./separator-block";
import { WideImageBlock } from "./wide-image-block";
import { RoomListBlock } from "./room-list-block/room-list-block";
import { TextColumnsWithImagesBlock } from "./text-columns-with-images-block/text-columns-with-images-block";
import { MapBlock } from "./map-block";
import { TestimonialsBlock } from "./testimonials";

type ContentBlocksProps = {
  data: NonNullable<Page["content"]>;
};

export function ContentBlocks({ data }: ContentBlocksProps) {
  return data.map((block) => {
    switch (block.blockType) {
      case "LeadText":
        return <LeadTextBlock key={block.id} {...block} />;
      case "AccommodationSelector":
        return <AccommodationSelectorBlock key={block.id} {...block} />;
      case "ImageWithFloatingText":
        return <ImageWithFloatingTextBlock key={block.id} {...block} />;
      case "Story":
        return <StoryBlock key={block.id} {...block} />;
      case "Features":
        return <FeaturesBlock key={block.id} {...block} />;
      case "Separator":
        return <SeparatorBlock key={block.id} />;
      case "WideImage":
        return <WideImageBlock key={block.id} {...block} />;
      case "RoomList":
        return <RoomListBlock key={block.id} {...block} />;
      case "TextColumnsWithImages":
        return <TextColumnsWithImagesBlock key={block.id} {...block} />;
      case "Map":
        return <MapBlock key={block.id} {...block} />;
      case "testimonials":
        return <TestimonialsBlock key={block.id} {...block} />;
    }
  });
}
