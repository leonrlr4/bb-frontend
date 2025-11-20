#!/bin/bash

# Frontend deployment script for ECR push and EC2 update

set -e

# Configuration
ECR_REGISTRY="198109036890.dkr.ecr.us-east-1.amazonaws.com"
ECR_REPO="bb-frontend"
AWS_REGION="us-east-1"
EC2_HOST="ubuntu@3.91.189.179"
PEM_KEY="/Users/leonc/WORK/PEM/bb-backend-prod.pem"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "========================================"
echo "BioBuild Frontend Deployment"
echo "========================================"
echo ""

# Check PEM key
if [ ! -f "$PEM_KEY" ]; then
    echo -e "${RED}Error: PEM key not found at $PEM_KEY${NC}"
    exit 1
fi

# Step 1: Build Docker image for linux/amd64 (EC2 architecture)
echo -e "${BLUE}Step 1: Building Docker image for linux/amd64...${NC}"
docker buildx build --platform linux/amd64 -t $ECR_REPO:latest --load .
echo -e "${GREEN}✓ Image built for x86_64${NC}"
echo ""

# Step 2: Login to ECR
echo -e "${BLUE}Step 2: Logging into ECR...${NC}"
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY
echo -e "${GREEN}✓ ECR login successful${NC}"
echo ""

# Step 3: Tag and push to ECR
echo -e "${BLUE}Step 3: Pushing to ECR...${NC}"
docker tag $ECR_REPO:latest $ECR_REGISTRY/$ECR_REPO:latest
docker push $ECR_REGISTRY/$ECR_REPO:latest
echo -e "${GREEN}✓ Image pushed to ECR${NC}"
echo ""

# Step 4: Deploy to EC2
echo -e "${BLUE}Step 4: Deploying to EC2...${NC}"
ssh -i "$PEM_KEY" "$EC2_HOST" << 'ENDSSH'
cd ~
echo "Pulling latest image from ECR..."
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 198109036890.dkr.ecr.us-east-1.amazonaws.com

echo "Updating bb-frontend service..."
docker compose --env-file .env.production -f docker-compose.yml pull bb-frontend
docker compose --env-file .env.production -f docker-compose.yml up -d bb-frontend

echo "Checking service health..."
sleep 5
docker compose --env-file .env.production -f docker-compose.yml ps bb-frontend
ENDSSH

echo -e "${GREEN}✓ Deployment complete${NC}"
echo ""

# Step 5: Verify health
echo -e "${BLUE}Step 5: Verifying service health...${NC}"
sleep 3
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://$(echo $EC2_HOST | cut -d'@' -f2)/health || echo "000")

if [ "$HEALTH_CHECK" = "200" ]; then
    echo -e "${GREEN}✓ Service is healthy (HTTP 200)${NC}"
else
    echo -e "${YELLOW}⚠ Health check returned: $HEALTH_CHECK${NC}"
    echo "Check logs with: ssh -i \"$PEM_KEY\" $EC2_HOST 'docker logs \$(docker ps -qf name=bb-frontend)'"
fi

echo ""
echo "========================================"
echo -e "${GREEN}Deployment Complete!${NC}"
echo "========================================"
echo ""
echo "View logs: ssh -i \"$PEM_KEY\" $EC2_HOST 'docker logs -f \$(docker ps -qf name=bb-frontend)'"
echo ""
