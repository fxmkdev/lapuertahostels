import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react";
import type { ReactNode } from "react";
import { useTheme } from "~/themes";
import { cn } from "./cn";

export type TabsProps = {
  items: { id: string; label: string; content: ReactNode }[];
  selectedIndex: number;
  onChange: (index: number) => void;
  label: string;
  listClassName?: string;
};

export function Tabs({
  items,
  selectedIndex,
  onChange,
  label,
  listClassName,
}: TabsProps) {
  const theme = useTheme();
  return (
    <TabGroup selectedIndex={selectedIndex} onChange={onChange}>
      <TabList
        aria-label={label}
        className={cn(
          "flex flex-wrap gap-x-4 gap-y-1 border-b border-neutral-200",
          listClassName,
        )}
      >
        {items.map((item) => (
          <Tab
            key={item.id}
            className={({ selected }) =>
              cn(
                "min-h-11 max-w-full min-w-0 border-b-2 px-1 py-2 text-sm font-semibold break-words transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
                theme.buttonColors.focusOutlineColor,
                selected
                  ? cn("border-current", theme.headingTextColor)
                  : cn(
                      "border-transparent text-neutral-600",
                      theme.linkColors.hoverTextColor,
                    ),
              )
            }
          >
            {item.label}
          </Tab>
        ))}
      </TabList>
      <TabPanels className="mt-4">
        {items.map((item) => (
          <TabPanel
            key={item.id}
            className={cn(
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
              theme.buttonColors.focusOutlineColor,
            )}
          >
            {item.content}
          </TabPanel>
        ))}
      </TabPanels>
    </TabGroup>
  );
}
