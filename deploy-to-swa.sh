#!/bin/bash
set -e

# Download the built ZIP
ZIP_URL="https://${STORAGE_ACCOUNT_NAME}.blob.core.windows.net/build-outputs/${BUILD_ID}/build_${BUILD_ID}.zip"
wget -O build.zip "$ZIP_URL"

# Extract to deployment directory
mkdir -p deploy
cd deploy
unzip -q ../build.zip

# Add SWA config
cat > staticwebapp.config.json << EOF
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/assets/*", "/*.{css,js,ico,png,jpg,jpeg,gif,svg,json}"]
  },
  "mimeTypes": {
    ".json": "application/json",
    ".js": "application/javascript",
    ".mjs": "application/javascript"
  },
  "responseOverrides": {
    "404": {
      "rewrite": "/index.html"
    }
  }
}
EOF

echo "📁 Files to deploy:"
find . -type f | head -20

# Deploy
swa deploy \
  --app-location . \
  --deployment-token "$SWA_DEPLOYMENT_TOKEN" \
  --verbose \
  --env production

echo "✅ Deployed to: https://${SWA_DEFAULT_HOSTNAME}"