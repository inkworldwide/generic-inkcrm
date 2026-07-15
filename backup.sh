#!/bin/bash

# Configuration
BACKUP_DIR="/var/backups/inkcrm"
MONGO_URI=${MONGODB_URI:-"mongodb://127.0.0.1:27017/inkcrm"}
TIMESTAMP=$(date +"%F_%H-%M-%S")
BACKUP_NAME="inkcrm_backup_$TIMESTAMP"

echo "========================================================="
echo " Starting inkCRM Mongoose Database Backup"
echo " Time: $(date)"
echo "========================================================="

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Perform mongodump
echo "Running mongodump to $BACKUP_DIR/$BACKUP_NAME.tar.gz..."
mongodump --uri="$MONGO_URI" --archive="$BACKUP_DIR/$BACKUP_NAME.tar.gz" --gzip

if [ $? -eq 0 ]; then
  echo "✅ Backup created successfully at $BACKUP_DIR/$BACKUP_NAME.tar.gz"
  
  # Retention policy: remove backups older than 14 days
  echo "Applying retention policy (deleting backups older than 14 days)..."
  find "$BACKUP_DIR" -type f -name "inkcrm_backup_*.tar.gz" -mtime +14 -delete
  echo "Retention policy complete."
else
  echo "❌ Error: Mongoose Database backup failed!"
  exit 1
fi

echo "========================================================="
echo " Backup Process Completed Successfully"
echo "========================================================="
