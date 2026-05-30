import { RichTextObject } from "@fxmk/common";
import { cn } from "../common/cn";
import { Heading } from "../common/heading";
import { RichTextParagraph } from "../common/paragraph";
import { MediaImage } from "~/common/media";
import { PageLink } from "~/common/page-link";
import { AccommodationSelector } from "@lapuertahostels/payload-types";

export type AccommodationSelectorBlockProps = Partial<AccommodationSelector>;

export function AccommodationSelectorBlock({
  heading,
  text,
  cards,
  elementId,
}: AccommodationSelectorBlockProps) {
  return (
    <div className="relative">
      <div className="from-puerta-700 to-puerta-600 absolute inset-0 -z-10 h-[23rem] bg-linear-to-br"></div>
      <div className="pt-8 pb-12 md:pt-16 md:pb-20">
        <div className="lg-px-0 mx-auto max-w-4xl px-8">
          <Heading
            as="h3"
            size="large"
            variant="white"
            id={elementId || undefined}
          >
            {heading}
          </Heading>
          <RichTextParagraph
            className="mt-4 md:mt-6"
            justify
            size="large"
            variant="white"
          >
            {text as RichTextObject | undefined}
          </RichTextParagraph>
        </div>
        <div className="mx-auto mt-8 grid max-w-7xl grid-cols-1 gap-16 px-0 md:mt-14 md:grid-cols-2 md:gap-8 md:px-8">
          {cards?.map((card) => (
            <AccommodationCard key={card.id} {...card} />
          ))}
        </div>
      </div>
    </div>
  );
}

type AccommodationCardProps = NonNullable<
  AccommodationSelectorBlockProps["cards"]
>[number];

function AccommodationCard({
  color,
  description,
  image,
  link,
  title,
}: AccommodationCardProps) {
  const componentClassName = cn(
    "group flex flex-col overflow-hidden shadow-lg hover:shadow-md md:rounded-xl",
    {
      "bg-puerta-600 hover:bg-puerta-200": color === "puerta",
      "bg-aqua-600 hover:bg-aqua-200": color === "aqua",
      "bg-azul-600 hover:bg-azul-200": color === "azul",
    },
  );

  return (
    <PageLink link={link} className={componentClassName}>
      <div className="relative aspect-1/1 overflow-hidden bg-white sm:aspect-4/3 md:aspect-1/1 lg:aspect-4/3 xl:aspect-16/9">
        <MediaImage
          media={image}
          className="h-full w-full object-cover transition-all duration-300 ease-in-out group-hover:scale-105 group-hover:opacity-75"
          transformation={{
            aspectRatio: { width: 1, height: 1 },
            width: 592,
            focus: "custom",
          }}
          loading="lazy"
          layout="responsive"
          sizes="(min-width: 1280px) 592px, (min-width: 768px) 50vw, 100vw"
          srcMultiplier={4}
        />
      </div>
      <div
        className={cn("space-y-1 px-8 py-4 text-white md:space-y-2 md:px-6", {
          "group-hover:text-puerta-800": color === "puerta",
          "group-hover:text-azul-800": color === "azul",
          "group-hover:text-aqua-800": color === "aqua",
        })}
      >
        <Heading as="h4" variant="inherit" size="extra-small">
          {title}
        </Heading>
        <RichTextParagraph variant="inherit" justify>
          {description as unknown as RichTextObject | undefined}
        </RichTextParagraph>
      </div>
    </PageLink>
  );
}
