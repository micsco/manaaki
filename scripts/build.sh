#!/bin/bash

# Safe build script with comprehensive validation
# This script runs a full build only after all validations pass

set -e

echo "🏗️  Starting safe build process..."
echo ""

# Step 1: Type checking
echo "📝 Step 1: Running TypeScript type check..."
pnpm run type-check
echo "✅ Type check passed"
echo ""

# Step 2: Biome check
echo "🔍 Step 2: Running Biome check..."
pnpm run check
echo "✅ Biome check passed"
echo ""

# Step 3: Build
echo "🔨 Step 3: Building application..."
pnpm run build
echo "✅ Build completed successfully"
echo ""

echo "🎉 All validations passed and build completed successfully!"