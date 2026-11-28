import { useLivePreview } from "@payloadcms/live-preview-react";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useEnvironment } from "~/common/environment";
import {
  createPreviewRequestHandler,
  type PreviewSnapshot,
} from "./preview-request-handler";

export type OptInLivePreviewProps<TData> = {
  path: string;
  data: TData;
  depth: number;
  children: (data: TData) => ReactNode;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function OptInLivePreview<TData extends Record<string, any>>({
  children,
  path,
  data,
  depth,
}: OptInLivePreviewProps<TData>) {
  const { preview } = useEnvironment();
  const { i18n } = useTranslation();

  return preview === path ? (
    <LivePreview<TData>
      key={`${path}:${i18n.language}`}
      path={path}
      data={data}
      depth={depth}
    >
      {children}
    </LivePreview>
  ) : (
    children(data)
  );
}

type LivePreviewProps<TData> = {
  path: string;
  data: TData;
  depth: number;
  children: (data: TData) => ReactNode;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function LivePreview<T extends Record<string, any>>({
  path,
  data,
  depth,
  children,
}: LivePreviewProps<T>) {
  const { payloadCmsBaseUrl } = useEnvironment();
  const { t, i18n } = useTranslation("admin");
  const [snapshot, setSnapshot] = useState<PreviewSnapshot<T>>({
    data,
    error: null,
  });
  const [guard] = useState(() =>
    createPreviewRequestHandler({
      initialData: data,
      documentPath: path,
      locale: i18n.language,
      onChange: setSnapshot,
    }),
  );

  useEffect(() => guard.cancelPending, [guard]);

  // Keep rendering our validated snapshot: the SDK's shared cache can still
  // receive responses from a previous document or locale after it unmounts.
  useLivePreview<T>({
    initialData: data,
    serverURL: new URL(payloadCmsBaseUrl).origin,
    depth,
    requestHandler: guard.requestHandler,
  });

  return (
    <>
      {snapshot.error && (
        <div
          role="alert"
          className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          {t(`livePreview.${snapshot.error}`)}
        </div>
      )}
      {children(snapshot.data)}
    </>
  );
}
