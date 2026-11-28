import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

export function PreviewFrame({
  toolbar,
  children,
  headerHeight,
  resetKey,
}: {
  toolbar: ReactNode;
  children: ReactNode;
  headerHeight: number;
  resetKey?: string;
}) {
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (content.current) content.current.scrollTop = 0;
  }, [resetKey]);
  return (
    <div className="flex h-dvh min-w-0 flex-col">
      <div
        data-preview-toolbar
        className="relative z-50 shrink-0 border-b border-neutral-300 bg-white p-3 text-sm text-neutral-900"
      >
        {toolbar}
      </div>
      <div
        data-preview-content
        ref={content}
        className="min-h-0 flex-1 overflow-y-auto"
        style={{ scrollPaddingTop: headerHeight + 32 }}
      >
        {children}
      </div>
    </div>
  );
}
