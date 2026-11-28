import type { Ref } from "react";
import { MapPinIcon } from "@heroicons/react/20/solid";
import type { RichTextObject } from "@lapuertahostels/rich-text";
import { useTranslation } from "react-i18next";
import { Link } from "~/common/link";
import { Tabs } from "~/common/tabs";
import {
  OverlayTextBoxContent,
  OverlayTextBoxShell,
} from "../common/overlay-text-box";
import type { ResolvedMapLocation } from "./use-map-locations";

type MapLocationDetailsProps = {
  overlayRef: Ref<HTMLDivElement>;
  locations: ResolvedMapLocation[];
  selected: ResolvedMapLocation;
  onSelect: (index: number) => void;
};

export function MapLocationDetails({
  overlayRef,
  locations,
  selected,
  onSelect,
}: MapLocationDetailsProps) {
  const { t } = useTranslation();
  return (
    <OverlayTextBoxShell
      ref={overlayRef}
      position={selected.overlayTextBox?.position}
    >
      {locations.length > 1 ? (
        <Tabs
          label={t("mapBlock.locations", { defaultValue: "Locations" })}
          selectedIndex={locations.indexOf(selected)}
          onChange={(index) => onSelect(locations[index].index)}
          listClassName="justify-center lg:justify-start"
          items={locations.map((entry) => ({
            id: String(entry.index),
            label: entry.label,
            content: <LocationContent entry={entry} />,
          }))}
        />
      ) : (
        <LocationContent entry={selected} />
      )}
    </OverlayTextBoxShell>
  );
}

function LocationContent({ entry }: { entry: ResolvedMapLocation }) {
  const details = entry.overlayTextBox;
  return (
    <OverlayTextBoxContent
      heading={details?.heading}
      text={details?.text as RichTextObject | undefined}
      cta={
        details?.callToActionLabel
          ? {
              icon: MapPinIcon,
              label: details.callToActionLabel,
              as: Link,
              variant: "secondary",
              to: entry.place.url,
            }
          : undefined
      }
    />
  );
}
