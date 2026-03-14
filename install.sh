#!/usr/bin/env bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "🌸 Fabiana installer"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check Node.js
if ! command -v node &>/dev/null; then
  echo -e "${RED}✗ Node.js not found.${NC}"
  echo "  Install Node.js 22+ from https://nodejs.org or via nvm:"
  echo "    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash"
  echo "    nvm install 22"
  exit 1
fi

NODE_MAJOR=$(node -e "process.stdout.write(process.version.slice(1).split('.')[0])")
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo -e "${RED}✗ Node.js 22+ required (found v$(node -v)).${NC}"
  echo "  Upgrade via nvm: nvm install 22 && nvm use 22"
  exit 1
fi

echo -e "${GREEN}✓ Node.js $(node -v)${NC}"

# Check npm
if ! command -v npm &>/dev/null; then
  echo -e "${RED}✗ npm not found. Install npm alongside Node.js.${NC}"
  exit 1
fi

echo -e "${GREEN}✓ npm $(npm -v)${NC}"

# Install fabiana globally
echo ""
echo "Installing fabiana..."
npm install -g fabiana

echo ""
echo -e "${GREEN}✓ Fabiana installed!${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Next steps:"
echo ""
echo "  1. Create a workspace directory:"
echo "       mkdir ~/fabiana && cd ~/fabiana"
echo ""
echo "  2. Create .env with your API keys:"
echo "       TELEGRAM_BOT_TOKEN=..."
echo "       TELEGRAM_CHAT_ID=..."
echo "       OPENROUTER_API_KEY=..."
echo ""
echo "  3. Run the setup check:"
echo "       fabiana doctor"
echo ""
echo "  4. Start Fabiana:"
echo "       fabiana start"
echo ""
