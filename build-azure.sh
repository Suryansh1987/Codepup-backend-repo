#!/bin/bash
set -e

echo "🚀 Starting Azure build process..."
echo "📋 Build ID: $BUILD_ID"
echo "📥 Downloading source from: $SOURCE_ZIP_URL"

# Debug environment
echo "🔍 Checking environment variables..."
if [ -z "$STORAGE_CONNECTION_STRING" ]; then
  echo "❌ STORAGE_CONNECTION_STRING is not set!"
  exit 1
fi

# Download and extract the source code
echo "📥 Downloading source zip..."
wget -O source.zip "$SOURCE_ZIP_URL" || { echo "❌ Failed to download source"; exit 1; }

echo "📦 Extracting source..."
unzip -q source.zip -d ./temp || { echo "❌ Failed to extract zip"; exit 1; }

# Handle nested folders from zip
if [ $(ls ./temp | wc -l) -eq 1 ] && [ -d "./temp/$(ls ./temp)" ]; then
  mv ./temp/$(ls ./temp)/* ./
  mv ./temp/$(ls ./temp)/.* ./ 2>/dev/null || true
else
  mv ./temp/* ./
  mv ./temp/.* ./ 2>/dev/null || true
fi
rm -rf ./temp source.zip

# Debug: Show extracted files
echo "📁 Extracted files:"
ls -la

# Check if package.json exists
if [ ! -f "package.json" ]; then
  echo "❌ No package.json found!"
  exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install || { echo "❌ npm install failed"; exit 1; }

# Build with relative base path
echo "🔨 Building project..."
npm run build || npx vite build --base="./" || { echo "❌ Build failed"; exit 1; }

# Find build output folder
if [ -d "./dist" ]; then
  BUILD_DIR="./dist"
elif [ -d "./build" ]; then
  BUILD_DIR="./build"
else
  echo "❌ No build output found"
  echo "📁 Current directory contents:"
  ls -la
  exit 1
fi

echo "✅ Build output found in: $BUILD_DIR"
echo "📁 Build directory contents:"
ls -la "$BUILD_DIR"

# Test Azure CLI connection by listing containers (simpler test)
echo "🔐 Testing Azure connection..."
az storage container list --connection-string "$STORAGE_CONNECTION_STRING" --query "[0].name" > /dev/null || { 
  echo "❌ Azure CLI connection failed"
  exit 1
}
echo "✅ Azure connection successful"

# Upload to $web for static hosting
echo "🌐 Uploading to Azure Static Website..."
az storage blob upload-batch \
  --source "$BUILD_DIR" \
  --destination '$web' \
  --destination-path "$BUILD_ID" \
  --connection-string "$STORAGE_CONNECTION_STRING" \
  --overwrite || { 
    echo "❌ Failed to upload to static website"
    exit 1
  }

# Set content types for common files
echo "📝 Setting content types..."
az storage blob list \
  --container-name '$web' \
  --prefix "$BUILD_ID/" \
  --connection-string "$STORAGE_CONNECTION_STRING" \
  --query "[].name" -o tsv | while read -r blob; do
  
  case "${blob##*.}" in
    html) content_type="text/html" ;;
    css) content_type="text/css" ;;
    js) content_type="application/javascript" ;;
    json) content_type="application/json" ;;
    png) content_type="image/png" ;;
    jpg|jpeg) content_type="image/jpeg" ;;
    svg) content_type="image/svg+xml" ;;
    ico) content_type="image/x-icon" ;;
    *) content_type="application/octet-stream" ;;
  esac
  
  az storage blob update \
    --container-name '$web' \
    --name "$blob" \
    --content-type "$content_type" \
    --connection-string "$STORAGE_CONNECTION_STRING" 2>/dev/null || true
done

# Create ZIP for download
ZIP_NAME="build_${BUILD_ID}.zip"
echo "📦 Creating ZIP for download..."
cd "$BUILD_DIR" && zip -r "../$ZIP_NAME" . && cd ..

# Create build-outputs container if it doesn't exist
echo "🗂️ Ensuring build-outputs container exists..."
az storage container create \
  --name "build-outputs" \
  --connection-string "$STORAGE_CONNECTION_STRING" \
  --public-access blob 2>/dev/null || true

# Upload ZIP to build-outputs container
echo "☁️ Uploading ZIP to Azure Blob Storage..."
az storage blob upload \
  --file "$ZIP_NAME" \
  --container-name "build-outputs" \
  --name "${BUILD_ID}/${ZIP_NAME}" \
  --connection-string "$STORAGE_CONNECTION_STRING" \
  --overwrite || { 
    echo "❌ Failed to upload ZIP"
    exit 1
  }

echo "✅ Build completed successfully!"
echo "🌐 Preview URL: https://${STORAGE_ACCOUNT_NAME}.z13.web.core.windows.net/${BUILD_ID}/"
echo "📥 Download URL: https://${STORAGE_ACCOUNT_NAME}.blob.core.windows.net/build-outputs/${BUILD_ID}/${ZIP_NAME}"