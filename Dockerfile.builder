FROM node:18

# Install system dependencies and Azure CLI
RUN apt-get update && \
    apt-get install -y \
    curl \
    wget \
    unzip \
    zip \
    ca-certificates \
    apt-transport-https \
    lsb-release \
    gnupg \
    postgresql-client \
    jq \
    git && \
    curl -sL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor | tee /etc/apt/trusted.gpg.d/microsoft.gpg > /dev/null && \
    echo "deb [arch=amd64] https://packages.microsoft.com/repos/azure-cli/ $(lsb_release -cs) main" | tee /etc/apt/sources.list.d/azure-cli.list && \
    apt-get update && \
    apt-get install -y azure-cli && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Supabase CLI using the official binary method
RUN set -e; \
    echo "📦 Installing Supabase CLI via official binary..." && \
    # Download with better error handling
    for i in 1 2 3; do \
        echo "Download attempt $i/3..." && \
        if wget -q --timeout=30 --tries=3 \
            "https://github.com/supabase/cli/releases/download/v1.200.3/supabase_linux_amd64.tar.gz" \
            -O /tmp/supabase.tar.gz; then \
            echo "✅ Download successful" && break; \
        else \
            echo "❌ Download attempt $i failed" && \
            [ $i -eq 3 ] && exit 1 || sleep 5; \
        fi \
    done && \
    # Verify and extract
    if [ ! -f /tmp/supabase.tar.gz ] || [ ! -s /tmp/supabase.tar.gz ]; then \
        echo "❌ Download verification failed" && exit 1; \
    fi && \
    echo "📦 Extracting Supabase CLI..." && \
    tar -xzf /tmp/supabase.tar.gz -C /tmp && \
    if [ ! -f /tmp/supabase ]; then \
        echo "❌ Extraction failed - binary not found" && exit 1; \
    fi && \
    mv /tmp/supabase /usr/local/bin/supabase && \
    chmod +x /usr/local/bin/supabase && \
    rm -f /tmp/supabase.tar.gz && \
    echo "✅ Supabase CLI installed successfully"

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Verify all installations
RUN echo "🔍 Verifying installations..." && \
    node --version && \
    npm --version && \
    supabase --version && \
    az --version && \
    psql --version && \
    echo "✅ All tools verified successfully"

# Copy build script
COPY build-and-zip.sh /app/
RUN chmod +x /app/build-and-zip.sh

CMD ["/app/build-and-zip.sh"]