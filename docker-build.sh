#!/bin/bash

# ChatVortex Docker 构建脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目信息
PROJECT_NAME="chatvortex"
VERSION=${1:-"latest"}
IMAGE_NAME="${PROJECT_NAME}:${VERSION}"

echo -e "${BLUE}🚀 开始构建 ChatVortex Docker 镜像...${NC}"
echo -e "${YELLOW}镜像名称: ${IMAGE_NAME}${NC}"

# 检查Docker是否运行
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker 未运行，请先启动 Docker${NC}"
    exit 1
fi

# 构建镜像
echo -e "${BLUE}📦 构建 Docker 镜像...${NC}"
docker build -t ${IMAGE_NAME} .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Docker 镜像构建成功！${NC}"
    echo -e "${YELLOW}镜像信息:${NC}"
    docker images ${PROJECT_NAME} --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
    
    echo -e "\n${BLUE}🎯 使用方法:${NC}"
    echo -e "${YELLOW}1. 运行容器:${NC}"
    echo -e "   docker run -d -p 3000:3000 --name chatvortex ${IMAGE_NAME}"
    echo -e "\n${YELLOW}2. 使用 docker-compose:${NC}"
    echo -e "   docker-compose up -d"
    echo -e "\n${YELLOW}3. 查看日志:${NC}"
    echo -e "   docker logs -f chatvortex"
    echo -e "\n${YELLOW}4. 停止容器:${NC}"
    echo -e "   docker stop chatvortex"
    echo -e "\n${YELLOW}5. 删除容器:${NC}"
    echo -e "   docker rm chatvortex"
    
    echo -e "\n${GREEN}🌐 访问地址: http://localhost:3000${NC}"
else
    echo -e "${RED}❌ Docker 镜像构建失败！${NC}"
    exit 1
fi
