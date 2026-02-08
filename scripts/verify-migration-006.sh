#!/usr/bin/env bash
set -e

echo "🔍 Verifying Migration 006: Student 360 Enhancements..."

CONTAINER="hsm-postgres"
DB_USER="hsm_admin"
DB_NAME="hsm_dev"

# 1. Check for email column in students table
echo -n "Checking 'students.email' column... "
if docker exec $CONTAINER psql -U $DB_USER -d $DB_NAME -c "\d students" | grep -q "email"; then
  echo "✅ Found"
else
  echo "❌ Missing"
  exit 1
fi

# 2. Check for student_evaluations table
echo -n "Checking 'student_evaluations' table... "
if docker exec $CONTAINER psql -U $DB_USER -d $DB_NAME -c "\d student_evaluations" > /dev/null 2>&1; then
  echo "✅ Found"
else
  echo "❌ Missing"
  exit 1
fi

# 3. Check backfill status
COUNT=$(docker exec $CONTAINER psql -U $DB_USER -d $DB_NAME -t -c "SELECT count(*) FROM students WHERE email IS NOT NULL;" | xargs)
echo "📊 Students with email populated: $COUNT"

echo "🎉 Migration verification successful!"