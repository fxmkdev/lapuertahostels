import {
  Dialog,
  DialogPanel,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import type { ImageViewerImage } from "./types";
import { ImageViewerPanel } from "./image-viewer-panel";

export type ImageViewerDialogProps = {
  isOpen: boolean;
  defaultImageIndex?: number;
  images: ImageViewerImage[];
  onDismiss: () => void;
};

export function ImageViewerDialog({
  isOpen,
  onDismiss,
  images,
  defaultImageIndex,
}: ImageViewerDialogProps) {
  return (
    <Transition show={isOpen}>
      <Dialog onClose={() => onDismiss()} className="relative z-50">
        <TransitionChild
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black" aria-hidden="true" />
        </TransitionChild>
        <DialogPanel
          as={ImageViewerPanel}
          images={images}
          defaultImageIndex={defaultImageIndex}
          onDismiss={onDismiss}
        />
      </Dialog>
    </Transition>
  );
}
