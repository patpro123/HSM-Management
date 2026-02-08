#!/bin/bash

BASE_URL="http://localhost:3000/api"

echo "🚀 Starting Local API Tests..."
echo "Target: $BASE_URL"
echo "-----------------------------------"

# 1. Test Instruments (Basic Connectivity)
echo "1️⃣  Testing GET /instruments..."
RESPONSE=$(curl -s "$BASE_URL/instruments")
if [[ $RESPONSE == *"instruments"* ]]; then
  echo "✅ Success: Fetched instruments"
else
  echo "❌ Failed: $RESPONSE"
fi
echo ""

# 2. Test Batches
echo "2️⃣  Testing GET /batches..."
RESPONSE=$(curl -s "$BASE_URL/batches")
if [[ $RESPONSE == *"batches"* ]]; then
  echo "✅ Success: Fetched batches"
else
  echo "❌ Failed: $RESPONSE"
fi
echo ""

# 3. Test Enrollments (Student List)
echo "3️⃣  Testing GET /enrollments..."
RESPONSE=$(curl -s "$BASE_URL/enrollments")
if [[ $RESPONSE == *"enrollments"* ]]; then
  echo "✅ Success: Fetched enrollments"
  # Extract an email for the next test (requires jq, falling back to grep/sed if needed)
  TEST_EMAIL=$(echo $RESPONSE | grep -o '"email":"[^"]*"' | head -1 | cut -d'"' -f4)
else
  echo "❌ Failed: $RESPONSE"
fi
echo ""

# 4. Test Student 360 View (New Feature)
if [ -n "$TEST_EMAIL" ]; then
  echo "4️⃣  Testing GET /portal/student/$TEST_EMAIL (Student 360)..."
  RESPONSE=$(curl -s "$BASE_URL/portal/student/$TEST_EMAIL")
  if [[ $RESPONSE == *"personal"* && $RESPONSE == *"academic"* ]]; then
    echo "✅ Success: Fetched Student 360 view for $TEST_EMAIL"
  else
    echo "❌ Failed: $RESPONSE"
  fi
else
  echo "⚠️  Skipping Student 360 test (No students found in enrollments)"
fi

# 5. Test Auth Config
echo "5️⃣  Testing GET /auth/config..."
RESPONSE=$(curl -s "$BASE_URL/auth/config")
if [[ $RESPONSE == *"authDisabled"* ]]; then
  echo "✅ Success: Fetched auth config"
  echo "   Config: $RESPONSE"
else
  echo "❌ Failed: $RESPONSE"
fi
echo ""

echo "-----------------------------------"
echo "🎉 Tests Completed"