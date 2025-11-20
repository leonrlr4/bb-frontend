#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}=== Bio Build Frontend Deployment ===${NC}"

# Config
ECR_URI="132121093867.dkr.ecr.us-east-1.amazonaws.com"
AWS_REGION="us-east-1"
IMAGE_NAME="bb-frontend"

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Warning: .env file not found${NC}"
    exit 1
fi

# Load environment variables
source .env

echo -e "${BLUE}[1/5] ECR Login${NC}"
aws ecr get-login-password --region $AWS_REGION | \
    docker login --username AWS --password-stdin $ECR_URI

echo -e "${BLUE}[2/5] Building & Pushing Docker Image${NC}"
docker buildx build \
  --platform linux/amd64 \
  --build-arg VITE_API_BASE_URL=https://api.biobuild.click \
  --build-arg VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
  --build-arg VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
  -t $ECR_URI/$IMAGE_NAME:latest \
  --push .

echo -e "${BLUE}[3/5] Deploying to EC2${NC}"
ssh biobuild << 'EOF'
cd ~/biobuild
/usr/local/bin/aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin 132121093867.dkr.ecr.us-east-1.amazonaws.com
docker compose pull bb-frontend
docker compose up -d bb-frontend
EOF

echo -e "${BLUE}[4/5] Verifying Deployment${NC}"
sleep 3
curl -I https://biobuild.click 2>&1 | head -1

echo -e "${GREEN}[5/5] ✓ Deployment Complete!${NC}"
echo -e "Frontend URL: ${GREEN}https://biobuild.click${NC}"
