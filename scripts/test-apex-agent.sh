#!/bin/bash
# Test the Apex Agent Web endpoint on live server
BASE_URL="https://www.alwakeelo.com"

# Step 1: Log in and get session cookie
echo "=== Step 1: Logging in ==="
LOGIN_RESPONSE=$(curl -s -c /tmp/alwakeelo_cookies.txt \
  -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "Origin: $BASE_URL" \
  -H "Referer: $BASE_URL/auth" \
  -d '{"email":"admin@alwakeelo.com","password":"Admin123!"}' \
  2>&1)
echo "Login response: $LOGIN_RESPONSE"

# Step 2: Check session
echo ""
echo "=== Step 2: Checking session ==="
USER_RESPONSE=$(curl -sL -b /tmp/alwakeelo_cookies.txt \
  "$BASE_URL/api/user" \
  -H "Origin: $BASE_URL" \
  -H "Referer: $BASE_URL/" \
  2>&1)
echo "User: $USER_RESPONSE" | head -c 200

# Step 3: Test Apex Agent Web
echo ""
echo ""
echo "=== Step 3: Testing Apex Agent Web ==="
echo "Sending query... (this may take 60-120s)"
AGENT_RESPONSE=$(curl -sL -b /tmp/alwakeelo_cookies.txt \
  --max-time 200 \
  -X POST "$BASE_URL/api/apex/agent" \
  -H "Content-Type: application/json" \
  -H "Origin: $BASE_URL" \
  -H "Referer: $BASE_URL/" \
  -d '{"message":"What is the limitation period for filing an appeal against a civil court decree in Pakistan?","maxIterations":4}' \
  2>&1)
echo "Response length: ${#AGENT_RESPONSE} chars"
echo ""
echo "$AGENT_RESPONSE" | head -c 1000
echo ""
echo "..."
