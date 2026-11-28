#!/bin/sh
set -eu
. ./.env

: "${MEDIA_STORAGE_ENDPOINT:?Set MEDIA_STORAGE_ENDPOINT}"
: "${MEDIA_STORAGE_BUCKET:?Set MEDIA_STORAGE_BUCKET}"
: "${MEDIA_STORAGE_ACCESS_KEY_ID:?Set MEDIA_STORAGE_ACCESS_KEY_ID}"
: "${MEDIA_STORAGE_SECRET_ACCESS_KEY:?Set MEDIA_STORAGE_SECRET_ACCESS_KEY}"
: "${BACKUP_DATABASE_NAME:?Set BACKUP_DATABASE_NAME}"
: "${BACKUP_DATABASE_URI:?Set BACKUP_DATABASE_URI}"

echo "Backing up database…"
if [ -d .backup ]; then
  tar -czf .previous-backup.tar.gz .backup
  rm -r .backup
fi
mongodump --uri "$BACKUP_DATABASE_URI" --db "$BACKUP_DATABASE_NAME" --out .backup

echo "Backing up Tigris bucket…"
AWS_ACCESS_KEY_ID="$MEDIA_STORAGE_ACCESS_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$MEDIA_STORAGE_SECRET_ACCESS_KEY" \
aws --endpoint-url "$MEDIA_STORAGE_ENDPOINT" --region "${MEDIA_STORAGE_REGION:-auto}" \
  s3 sync "s3://$MEDIA_STORAGE_BUCKET" ./.media-backup --delete

echo "Done"
