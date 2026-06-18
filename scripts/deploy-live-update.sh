#!/bin/bash
# Deploy a live update to the production channel
# Usage: npm run deploy:live

set -e

echo "Building for production..."
npm run build

echo "Deploying live update..."
npx @capacitor/live-updates deploy \
  --channel production \
  --app-id com.atlasperformancelabs.app

echo "Live update deployed successfully."
echo "Users will receive the update on next app open."
