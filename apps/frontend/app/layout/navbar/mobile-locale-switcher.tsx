import {
  Transition,
  Dialog,
  TransitionChild,
  DialogPanel,
} from "@headlessui/react";
import { cn } from "~/common/cn";
import { useTheme } from "~/themes";
import type { LocaleConfig } from "@lapuertahostels/payload-types";

export type MobileLocaleSwitcherProps = {
  currentLocale: string;
  open: boolean;
  onClose: () => void;
  redirectTo: string;
  publishedLocales: Pick<LocaleConfig, "id" | "displayLabel">[];
};

export function MobileLocaleSwitcher({
  currentLocale,
  publishedLocales,
  open,
  onClose,
  redirectTo,
}: MobileLocaleSwitcherProps) {
  const theme = useTheme();
  return (
    <Transition show={open}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <TransitionChild
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-neutral-500/75 transition-opacity" />
        </TransitionChild>

        <div className="fixed inset-0 z-50 w-screen overflow-y-auto">
          <div className="flex min-h-full items-start justify-center p-4 text-center sm:items-center sm:p-0">
            <TransitionChild
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <DialogPanel className="relative w-full max-w-sm transform overflow-hidden rounded-lg bg-white pt-5 pb-4 text-left shadow-xl transition-all sm:my-8">
                {publishedLocales.map(({ id, displayLabel }) => (
                  <form
                    key={id}
                    method="post"
                    action="/locale"
                    className="contents"
                  >
                    <input type="hidden" name="locale" value={id} />
                    <input type="hidden" name="redirectTo" value={redirectTo} />
                    <button
                      type="submit"
                      className={cn(
                        "mobile-touch-target flex w-full items-center gap-1.5 border-l-4 py-2 pr-8 pl-6 text-base font-bold",
                        currentLocale !== id
                          ? "border-transparent text-neutral-500 hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-700"
                          : theme.navButtonClassName,
                      )}
                    >
                      {displayLabel}
                    </button>
                  </form>
                ))}
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
