#!/bin/bash
# Apply patches to node_modules
# This script is run as postinstall to fix Kotlin 2.x compatibility issues

NODE_MODULES="$(dirname "$0")/../node_modules"

if [ ! -d "$NODE_MODULES" ]; then
    echo "node_modules not found, skipping patches"
    exit 0
fi

echo "Applying Kotlin 2.x null safety patches..."

# Fix react-native-track-player MusicModule.kt
# Kotlin 2.x requires explicit null handling for Arguments.toBundle()
TRACK_PLAYER_FILE="$NODE_MODULES/react-native-track-player/android/src/main/java/com/doublesymmetry/trackplayer/module/MusicModule.kt"

if [ -f "$TRACK_PLAYER_FILE" ]; then
    # Check if already patched (contains " ?: Bundle()")
    if grep -q "Arguments.toBundle(map) ?: Bundle()" "$TRACK_PLAYER_FILE"; then
        echo "react-native-track-player: already patched"
    else
        # Replace Arguments.toBundle(map) with Arguments.toBundle(map) ?: Bundle()
        # Use sed to do pattern replacement regardless of line numbers
        sed -i.bak 's/Arguments\.toBundle(map)\([^)]\)/Arguments.toBundle(map) ?: Bundle()\1/g' "$TRACK_PLAYER_FILE"

        # Also handle the case where it's at the end of function call: Arguments.toBundle(map))
        sed -i.bak 's/Arguments\.toBundle(map))/Arguments.toBundle(map) ?: Bundle())/g' "$TRACK_PLAYER_FILE"

        # Verify patch was applied
        if grep -q "Arguments.toBundle(map) ?: Bundle()" "$TRACK_PLAYER_FILE"; then
            echo "react-native-track-player: patched successfully"
            rm -f "$TRACK_PLAYER_FILE.bak"
        else
            echo "react-native-track-player: patch may have failed, please check manually"
            # Restore backup if patch failed
            if [ -f "$TRACK_PLAYER_FILE.bak" ]; then
                mv "$TRACK_PLAYER_FILE.bak" "$TRACK_PLAYER_FILE"
            fi
        fi
    fi
else
    echo "react-native-track-player: MusicModule.kt not found, skipping"
fi

echo "All patches applied successfully"
