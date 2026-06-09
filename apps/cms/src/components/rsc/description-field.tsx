import type { StaticDescription } from "payload";

import { FieldDescription } from "@payloadcms/ui";

export type DescriptionFieldProps = {
  description: StaticDescription;
  path: string;
};

export function DescriptionField({ description, path }: DescriptionFieldProps) {
  return (
    <FieldDescription
      description={description}
      marginPlacement="bottom"
      path={path}
    />
  );
}
