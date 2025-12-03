#!/bin/bash
# Apply patches to node_modules
# This script is run as postinstall to fix Kotlin 2.x compatibility issues

PATCH_DIR="$(dirname "$0")/../patches"
NODE_MODULES="$(dirname "$0")/../node_modules"

if [ ! -d "$NODE_MODULES" ]; then
    echo "node_modules not found, skipping patches"
    exit 0
fi

for patch_file in "$PATCH_DIR"/*.patch; do
    if [ -f "$patch_file" ]; then
        echo "Applying patch: $(basename "$patch_file")"
        # Use -p1 since paths in patch have a/ and b/ prefixes (git diff format)
        # Use --forward to skip already applied patches
        # Use -d to change to project root directory
        patch -p1 -d "$(dirname "$0")/.." --forward < "$patch_file" || {
            # Check if patch was already applied (exit code 1 with "already applied" message)
            if patch -p1 -d "$(dirname "$0")/.." --reverse --dry-run < "$patch_file" > /dev/null 2>&1; then
                echo "Patch already applied: $(basename "$patch_file")"
            else
                echo "Failed to apply patch: $(basename "$patch_file")"
                exit 1
            fi
        }
    fi
done

echo "All patches applied successfully"
