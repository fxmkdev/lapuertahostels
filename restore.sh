#!/bin/sh
set -eu
. ./.env

: "${MEDIA_STORAGE_ENDPOINT:?Set MEDIA_STORAGE_ENDPOINT}"
: "${MEDIA_STORAGE_BUCKET:?Set MEDIA_STORAGE_BUCKET}"
: "${MEDIA_STORAGE_ACCESS_KEY_ID:?Set MEDIA_STORAGE_ACCESS_KEY_ID}"
: "${MEDIA_STORAGE_SECRET_ACCESS_KEY:?Set MEDIA_STORAGE_SECRET_ACCESS_KEY}"
: "${BACKUP_DATABASE_NAME:?Set BACKUP_DATABASE_NAME}"
: "${RESTORE_DATABASE_URI:?Set RESTORE_DATABASE_URI}"
: "${RESTORE_DATABASE_NAME:?Set RESTORE_DATABASE_NAME}"
test -d ".backup/$BACKUP_DATABASE_NAME"
test -d .media-backup

echo "Dropping database…"
RESTORE_DATABASE_NAME="$RESTORE_DATABASE_NAME" mongosh "$RESTORE_DATABASE_URI" <<'JS'
db = db.getSiblingDB(process.env.RESTORE_DATABASE_NAME);
db.getCollectionNames().filter(c => !['users', 'api-keys', 'payload-preferences'].includes(c)).forEach(c => db.getCollection(c).drop());
JS

echo "Restoring database…"
mongorestore --uri "$RESTORE_DATABASE_URI" \
  --nsFrom "$BACKUP_DATABASE_NAME.*" --nsTo "$RESTORE_DATABASE_NAME.*" \
  --nsExclude "$BACKUP_DATABASE_NAME.users" \
  --nsExclude "$BACKUP_DATABASE_NAME.api-keys" \
  --nsExclude "$BACKUP_DATABASE_NAME.payload-preferences" \
  --drop ".backup/$BACKUP_DATABASE_NAME"

echo "Restoring Tigris bucket…"
AWS_ACCESS_KEY_ID="$MEDIA_STORAGE_ACCESS_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$MEDIA_STORAGE_SECRET_ACCESS_KEY" \
aws --endpoint-url "$MEDIA_STORAGE_ENDPOINT" --region "${MEDIA_STORAGE_REGION:-auto}" \
  s3 sync ./.media-backup "s3://$MEDIA_STORAGE_BUCKET" --delete

echo "Done"
