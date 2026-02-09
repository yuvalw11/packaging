#!/bin/bash

# ==========================================
# Deployment Script for Packing App
# ==========================================

set -e  # Exit on any error

# Configuration - ADD THESE ENV VARIABLES.
source .env

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Functions
print_step() {
    echo -e "${BLUE}==>${NC} ${GREEN}$1${NC}"
}

print_error() {
    echo -e "${RED}ERROR: $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}WARNING: $1${NC}"
}

# Check if required commands exist
command -v docker >/dev/null 2>&1 || { print_error "docker is required but not installed. Aborting."; exit 1; }
command -v ssh >/dev/null 2>&1 || { print_error "ssh is required but not installed. Aborting."; exit 1; }
command -v scp >/dev/null 2>&1 || { print_error "scp is required but not installed. Aborting."; exit 1; }

# Start deployment
print_step "Starting deployment process..."

# Step 1: Build Docker images
print_step "Building Docker images..."
docker buildx build --platform "$ARCH" -t packing-backend:latest -f Dockerfile.backend --load .
docker buildx build --platform "$ARCH" --build-arg "PUBLIC_URL=$PUBLIC_URL" --build-arg "REACT_APP_API_URL=$REACT_APP_API_URL" -t packing-frontend:latest -f Dockerfile.frontend --load .

# Step 2: Save images to tar files
print_step "Saving Docker images to tar files..."
mkdir -p ./deploy-temp
docker save packing-backend:latest | gzip > ./deploy-temp/packing-backend.tar.gz
docker save packing-frontend:latest | gzip > ./deploy-temp/packing-frontend.tar.gz

print_step "Image sizes:"
ls -lh ./deploy-temp/*.tar.gz

# Step 3: Create deployment directory on server
print_step "Creating deployment directory on server..."
ssh ${SERVER_USER}@${SERVER_HOST} "mkdir -p ${SERVER_PATH}"

# Step 4: Transfer files to server
print_step "Transferring files to server..."
scp ./deploy-temp/packing-backend.tar.gz ${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}/
scp ./deploy-temp/packing-frontend.tar.gz ${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}/
scp docker-compose.yml ${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}/

# Step 5: Load images and start containers on server
print_step "Loading images and starting containers on server..."
ssh ${SERVER_USER}@${SERVER_HOST} SERVER_PATH="${SERVER_PATH}" 'bash -se' << 'EOF'
set -e

cd ${SERVER_PATH}

echo "Loading Docker images..."
echo `pwd`
docker load < packing-backend.tar.gz
docker load < packing-frontend.tar.gz

echo "Stopping existing containers..."
docker compose down || true

echo "Starting containers..."
docker compose up -d

echo "Cleaning up tar files..."
rm -f packing-backend.tar.gz packing-frontend.tar.gz

echo "Deployment completed!"
docker compose ps
EOF

# Step 6: Cleanup local temp files
print_step "Cleaning up local temporary files..."
rm -rf ./deploy-temp

# Step 7: Show deployment info
print_step "Deployment completed successfully!"
echo -e "${GREEN}Your app should now be running at:${NC}"
echo -e "  Frontend: http://${SERVER_HOST}:3000"
echo -e "  Backend:  http://${SERVER_HOST}:3001"
echo ""
echo -e "${YELLOW}To view logs:${NC} ssh ${SERVER_USER}@${SERVER_HOST} 'cd ${SERVER_PATH} && docker-compose logs -f'"
echo -e "${YELLOW}To stop:${NC} ssh ${SERVER_USER}@${SERVER_HOST} 'cd ${SERVER_PATH} && docker-compose down'"
