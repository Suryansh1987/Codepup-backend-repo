#!/bin/bash
set -e

# Load environment variables
if [ ! -f .env ]; then
    echo "❌ .env file not found! Please run setup-azure-resources.sh first."
    exit 1
fi

source .env

# Check if required variables are set
if [ -z "$DATABASE_URL" ] || [ -z "$ANTHROPIC_API_KEY" ] || [ -z "$SUPABASE_URL" ]; then
    echo "❌ Please fill in all required API keys in .env file!"
    exit 1
fi

echo "🚀 Deploying React Builder API to Azure..."
echo "📍 App Name: $AZURE_APP_NAME"
echo "📍 ACR: $AZURE_ACR_NAME"

# Login to ACR
echo "🔐 Logging into ACR..."
az acr login --name $AZURE_ACR_NAME

# Build and tag the Docker image
echo "📦 Building Docker image..."
docker build -f Dockerfile.api -t $AZURE_ACR_NAME.azurecr.io/react-builder-api:latest .

# Push to ACR
echo "📤 Pushing to ACR..."
docker push $AZURE_ACR_NAME.azurecr.io/react-builder-api:latest

# Update App Service with all environment variables
echo "🔧 Configuring App Service settings..."
az webapp config appsettings set \
  --name $AZURE_APP_NAME \
  --resource-group $AZURE_RESOURCE_GROUP \
  --settings \
    NODE_ENV="production" \
    PORT="3000" \
    DATABASE_URL="$DATABASE_URL" \
    ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
    SUPABASE_URL="$SUPABASE_URL" \
    SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
    AZURE_STORAGE_CONNECTION_STRING="$AZURE_STORAGE_CONNECTION_STRING" \
    AZURE_STORAGE_ACCOUNT_NAME="$AZURE_STORAGE_ACCOUNT_NAME" \
    AZURE_ACR_NAME="$AZURE_ACR_NAME" \
    AZURE_CONTAINER_APP_ENV="$AZURE_CONTAINER_APP_ENV" \
    AZURE_RESOURCE_GROUP="$AZURE_RESOURCE_GROUP" \
    AZURE_SUBSCRIPTION_ID="$AZURE_SUBSCRIPTION_ID" \
    ACR_USERNAME="$ACR_USERNAME" \
    ACR_PASSWORD="$ACR_PASSWORD" \
    AZURE_SWA_NAME="$AZURE_SWA_NAME" \
    AZURE_SWA_DEPLOYMENT_TOKEN="$AZURE_SWA_DEPLOYMENT_TOKEN" \
    AZURE_SWA_DEFAULT_HOSTNAME="$AZURE_SWA_DEFAULT_HOSTNAME" \
    WEBSITES_PORT="3000"

# Configure the container
echo "🐳 Updating container configuration..."
az webapp config container set \
  --name $AZURE_APP_NAME \
  --resource-group $AZURE_RESOURCE_GROUP \
  --docker-custom-image-name $AZURE_ACR_NAME.azurecr.io/react-builder-api:latest

# Restart the app to pull the latest image
echo "🔄 Restarting App Service..."
az webapp restart --name $AZURE_APP_NAME --resource-group $AZURE_RESOURCE_GROUP

# Enable logs
echo "📋 Enabling logs..."
az webapp log config \
  --name $AZURE_APP_NAME \
  --resource-group $AZURE_RESOURCE_GROUP \
  --docker-container-logging filesystem \
  --level verbose

# Wait for app to be ready
echo "⏳ Waiting for app to be ready..."
sleep 30

# Test the deployment
echo "🧪 Testing deployment..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$AZURE_APP_URL/health" || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ API is healthy!"
else
    echo "⚠️  API returned status $HTTP_STATUS"
    echo "📋 Check logs with:"
    echo "az webapp log tail --name $AZURE_APP_NAME --resource-group $AZURE_RESOURCE_GROUP"
fi

echo ""
echo "✅ Deployment complete!"
echo "🌐 API URL: $AZURE_APP_URL"
echo ""
echo "📋 Useful commands:"
echo "  View logs:  az webapp log tail --name $AZURE_APP_NAME --resource-group $AZURE_RESOURCE_GROUP"
echo "  Restart:    az webapp restart --name $AZURE_APP_NAME --resource-group $AZURE_RESOURCE_GROUP"
echo "  Stop:       az webapp stop --name $AZURE_APP_NAME --resource-group $AZURE_RESOURCE_GROUP"
echo "  Start:      az webapp start --name $AZURE_APP_NAME --resource-group $AZURE_RESOURCE_GROUP"