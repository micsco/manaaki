#!/bin/bash

# Pre-push validation script
# This script runs comprehensive validation before pushing changes

set -e

echo "🚀 Running pre-push validation..."
echo ""

# Run all validations
echo "📋 Running comprehensive validation..."
pnpm run validate

if [ $? -ne 0 ]; then
  echo "❌ Validation failed. Please fix the issues before pushing."
  exit 1
fi

echo "✅ All validations passed. Safe to push!"
echo ""

# Optional: Run a quick build test to ensure everything compiles
echo "🏗️  Running quick build test..."
pnpm run build

echo "🎉 Pre-push validation completed successfully!"