#!/bin/bash

# Development script with validation
# This script runs the dev server with continuous validation

set -e

echo "🚀 Starting development server with validation..."
echo ""

# Run initial validation
echo "📋 Running initial validation..."
pnpm run validate

if [ $? -ne 0 ]; then
  echo "❌ Validation failed. Please fix the issues above before starting the dev server."
  exit 1
fi

echo "✅ Validation passed. Starting dev server..."
echo ""

# Start dev server
pnpm run dev