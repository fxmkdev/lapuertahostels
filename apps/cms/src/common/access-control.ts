import { Access, CollectionSlug, PayloadRequest } from "payload";

export function isAdmin(req: PayloadRequest) {
  return (
    (req.user?.collection === "users" && req.user?.role === "admin") ||
    (req.user?.collection === "api-keys" && req.user?.role === "e2e-tests")
  );
}

export function isEditor(req: PayloadRequest) {
  return req.user?.collection === "users" && req.user?.role === "editor";
}

export function isSelf(
  req: PayloadRequest,
  userId: number | string,
  authCollectionSlug: CollectionSlug,
) {
  return req.user?.id === userId && req.user?.collection === authCollectionSlug;
}

export function canManageContent({ req }: Parameters<Access>[0]) {
  return isAdmin(req) || isEditor(req);
}
