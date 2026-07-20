#!/bin/bash
set -euo pipefail

# ============================================================
# 英文单词闪卡系统 - Azure Static Web Apps 部署脚本
# 用法: ./scripts/deploy.sh [环境]
# 环境: production (默认) | staging
# ============================================================

ENV=${1:-production}
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="$PROJECT_ROOT/dist"
APP_NAME="flash-cards-app"
RESOURCE_GROUP="flash-cards-rg"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🚀 开始部署 Flash Cards 应用到 $ENV 环境...${NC}"

# ─── 步骤 1: 环境检查 ───
echo -e "${YELLOW}📋 检查环境...${NC}"
command -v az >/dev/null 2>&1 || { echo -e "${RED}❌ 需要 Azure CLI${NC}"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo -e "${RED}❌ 需要 Node.js${NC}"; exit 1; }

# ─── 步骤 2: 安装依赖 ───
echo -e "${YELLOW}📦 安装依赖...${NC}"
cd "$PROJECT_ROOT/api"
npm install --production

# ─── 步骤 3: 构建前端 ───
echo -e "${YELLOW}🔨 构建前端...${NC}"
mkdir -p "$BUILD_DIR"
cp "$PROJECT_ROOT/index.html" "$BUILD_DIR/"

# ─── 步骤 4: 验证 Azure 登录 ───
echo -e "${YELLOW}🔐 验证 Azure 登录...${NC}"
az account show >/dev/null 2>&1 || az login

# ─── 步骤 5: 部署到 Azure Static Web Apps ───
echo -e "${YELLOW}☁️  部署到 Azure Static Web Apps...${NC}"

if [ "$ENV" = "production" ]; then
  # 检查应用是否已存在
  if az staticwebapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" >/dev/null 2>&1; then
    echo -e "${YELLOW}🏗️  应用已存在，执行更新...${NC}"
    az staticwebapp create \
      --name "$APP_NAME" \
      --resource-group "$RESOURCE_GROUP" \
      --location "eastasia" \
      --sku "Free" \
      --source "$BUILD_DIR" \
      --branch "main" \
      --yes || true
  else
    # 创建新应用
    az staticwebapp create \
      --name "$APP_NAME" \
      --resource-group "$RESOURCE_GROUP" \
      --location "eastasia" \
      --sku "Free" \
      --source "$BUILD_DIR" \
      --branch "main" \
      --yes || true
  fi

  # 设置 API 端点 (Azure Functions)
  echo -e "${YELLOW}⚙️  配置应用设置...${NC}"
  az staticwebapp appsettings set \
    --name "$APP_NAME" \
    --setting-names "COSMOS_CONNECTION_STRING" \
    2>/dev/null || echo -e "${YELLOW}⚠️  请在 Azure Portal 中手动配置 COSMOS_CONNECTION_STRING${NC}"
else
  # Staging 环境
  echo -e "${YELLOW}🏗️  Staging 环境使用 swa CLI 部署...${NC}"
  npx @azure/static-web-apps-cli deploy "$BUILD_DIR" \
    --env "staging" \
    --app-location . \
    --api-location ./api
fi

# ─── 步骤 6: 验证部署 ───
echo -e "${YELLOW}✅ 验证部署...${NC}"
URL=$(az staticwebapp show --name "$APP_NAME" --query "defaultHostname" -o tsv 2>/dev/null || echo "")
if [ -n "$URL" ]; then
  echo -e "${GREEN}🎉 部署成功！访问地址: https://$URL${NC}"
else
  echo -e "${YELLOW}⚠️  请通过 Azure Portal 查看部署状态${NC}"
fi

echo -e "${GREEN} 部署完成！${NC}"
