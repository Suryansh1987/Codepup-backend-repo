#!/bin/bash
set -euo pipefail

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "🚀 Starting build process..."
log "📋 Build ID: $BUILD_ID"
log "📥 Downloading source from: $SOURCE_ZIP_URL"

# Download and extract source
if ! wget -O source.zip "$SOURCE_ZIP_URL"; then
    log "❌ Failed to download source zip"
    exit 1
fi

if ! unzip -q source.zip -d ./source; then
    log "❌ Failed to extract source zip"
    exit 1
fi

# Navigate to source and handle nested folders
cd source
if [ $(ls | wc -l) -eq 1 ] && [ -d "$(ls)" ]; then
  mv $(ls)/* ./
  mv $(ls)/.* ./ 2>/dev/null || true
  rmdir $(ls)
fi

# Check if it's a full-stack project with Supabase
if [ -d "./supabase" ] && [ ! -z "${DATABASE_URL:-}" ] && [ ! -z "${SUPABASE_TOKEN:-}" ]; then
  log "🔍 Full-stack project detected with Supabase"
  log "🗄️ Setting up Supabase database..."
  
  # Verify Supabase CLI is available
  if ! command -v supabase &> /dev/null; then
    log "❌ Supabase CLI not found"
    exit 1
  fi
  
  # Login to Supabase
  log "🔐 Logging into Supabase..."
  if ! supabase login --token "$SUPABASE_TOKEN"; then
    log "❌ Failed to login to Supabase"
    exit 1
  fi
  
  # Push database schema
  log "📊 Pushing database schema..."
  if ! supabase db push --db-url "$DATABASE_URL"  ; then
    log "❌ Failed to push database schema"
    exit 1
  fi
  
  # Seed database if seed file exists
  if [ -f "./supabase/seed.sql" ]; then
    log "🌱 Seeding database..."
    if ! psql "$DATABASE_URL" -f ./supabase/seed.sql; then
      log "❌ Failed to seed database"
      exit 1
    fi
    log "✅ Database seeded successfully"
  fi
  
  log "✅ Supabase setup completed"
else
  log "ℹ️ Running as frontend-only build (no Supabase setup required)"
fi

# Install dependencies
log "📦 Installing dependencies..."
if ! npm install; then
    log "❌ Failed to install dependencies"
    exit 1
fi

# Build project with environment variables
log "🔨 Building project..."
if [ ! -z "${VITE_SUPABASE_URL:-}" ] && [ ! -z "${VITE_SUPABASE_ANON_KEY:-}" ]; then
    log "📝 Building with Supabase environment variables..."
    if ! VITE_SUPABASE_URL="$VITE_SUPABASE_URL" \
         VITE_SUPABASE_ANON_KEY="$VITE_SUPABASE_ANON_KEY" \
         npx vite build --base="./"; then
        log "❌ Build failed"
        exit 1
    fi
else
    log "📝 Building without Supabase environment variables..."
    if ! npx vite build --base="./"; then
        log "❌ Build failed"
        exit 1
    fi
fi

# Find build output
BUILD_DIR=""
if [ -d "./dist" ]; then
  BUILD_DIR="./dist"
elif [ -d "./build" ]; then
  BUILD_DIR="./build"
else
  log "❌ No build output found"
  exit 1
fi

log "✅ Build output found in: $BUILD_DIR"

# Create deployment info
cat > deployment-info.json << EOF
{
  "buildId": "$BUILD_ID",
  "buildTime": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "projectType": "$([ -d "./supabase" ] && echo "fullstack" || echo "frontend")",
  "hasSupabase": $([ -d "./supabase" ] && echo "true" || echo "false"),
  "databaseSetup": $([ ! -z "${DATABASE_URL:-}" ] && echo "true" || echo "false"),
  "environmentVariables": {
    "hasSupabaseUrl": $([ ! -z "${VITE_SUPABASE_URL:-}" ] && echo "true" || echo "false"),
    "hasSupabaseKey": $([ ! -z "${VITE_SUPABASE_ANON_KEY:-}" ] && echo "true" || echo "false")
  }
}
EOF

# Create ZIP
ZIP_NAME="build_${BUILD_ID}.zip"
cd "$BUILD_DIR" && zip -r "../$ZIP_NAME" . && cd ..

# # Authenticate with Azure using managed identity
# log "🔐 Authenticating with Azure using managed identity..."
# if ! az login --identity; then
#     log "❌ Failed to authenticate with Azure"
#     exit 1
# fi

# Upload to Azure Blob Storage
log "☁️ Uploading ZIP to Azure Blob Storage..."
if ! az storage blob upload \
  --file "$ZIP_NAME" \
  --container-name "build-outputs" \
  --name "${BUILD_ID}/${ZIP_NAME}" \
  --connection-string "$STORAGE_CONNECTION_STRING" \
  --overwrite; then
    log "❌ Failed to upload build zip"
    exit 1
fi


# Upload deployment info separately
if ! az storage blob upload \
  --file "deployment-info.json" \
  --container-name "build-outputs" \
  --name "${BUILD_ID}/deployment-info.json" \
  --connection-string "$STORAGE_CONNECTION_STRING" \
  --overwrite; then
    log "❌ Failed to upload deployment info"
    exit 1
fi

log "✅ Build completed and uploaded"
log "📦 ZIP URL: https://${STORAGE_ACCOUNT_NAME}.blob.core.windows.net/build-outputs/${BUILD_ID}/${ZIP_NAME}"
log "📊 Info URL: https://${STORAGE_ACCOUNT_NAME}.blob.core.windows.net/build-outputs/${BUILD_ID}/deployment-info.json"