#!/bin/bash
set -e

echo "🚀 Starting Azure SWA build process..."
echo "📋 Build ID: $BUILD_ID"
echo "📥 Downloading source from: $SOURCE_ZIP_URL"

# Download and extract the source code
wget -O source.zip "$SOURCE_ZIP_URL"
unzip -q source.zip -d ./source

# Handle nested folders from zip
cd source
if [ $(ls | wc -l) -eq 1 ] && [ -d "$(ls)" ]; then
  mv $(ls)/* ./
  mv $(ls)/.* ./ 2>/dev/null || true
  rmdir $(ls)
fi

# Install and build
echo "📦 Installing dependencies..."
npm install

echo "🔨 Building project..."
npx vite build --base="./"

# Find build output
if [ -d "./dist" ]; then
  BUILD_DIR="./dist"
elif [ -d "./build" ]; then
  BUILD_DIR="./build"
else
  echo "❌ No build output found"
  exit 1
fi

# Create ZIP first (for download)
ZIP_NAME="build_${BUILD_ID}.zip"
cd "$BUILD_DIR" && zip -r "../../$ZIP_NAME" . && cd ../..

# Upload ZIP to blob storage
echo "☁️ Uploading ZIP to Azure Blob Storage..."
az storage blob upload \
  --file "$ZIP_NAME" \
  --container-name "build-outputs" \
  --name "${BUILD_ID}/${ZIP_NAME}" \
  --connection-string "$STORAGE_CONNECTION_STRING" \
  --overwrite

# Now deploy to SWA from the actual build directory
cd source/"$BUILD_DIR"

# Create staticwebapp.config.json IN the build directory
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
  }
}
EOF

echo "📁 Deploying from: $(pwd)"
echo "📦 Files to deploy:"
ls -la

# Deploy directly from the build directory
echo "🚀 Deploying to SWA..."
npx @azure/static-web-apps-cli deploy \
  --app-location . \
  --output-location . \
  --deployment-token "$SWA_DEPLOYMENT_TOKEN" \
  --verbose

PREVIEW_URL="https://${SWA_DEFAULT_HOSTNAME}"
echo "✅ Deployment completed!"
echo "🌐 Preview URL: $PREVIEW_URL"
echo "📥 Download URL: https://${STORAGE_ACCOUNT_NAME}.blob.core.windows.net/build-outputs/${BUILD_ID}/${ZIP_NAME}"