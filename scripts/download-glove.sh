#!/bin/bash
# Download GloVe 6B embeddings (50-dimensional)
# File size: ~171 MB compressed, ~823 MB uncompressed (all dimensions)
# We only need the 50d file which is ~171 MB uncompressed

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="$SCRIPT_DIR/../data"

mkdir -p "$DATA_DIR"

GLOVE_URL="https://nlp.stanford.edu/data/glove.6B.zip"
ZIP_FILE="$DATA_DIR/glove.6B.zip"
TARGET_FILE="$DATA_DIR/glove.6B.50d.txt"

if [ -f "$TARGET_FILE" ]; then
    echo "GloVe 50d vectors already exist at $TARGET_FILE"
    exit 0
fi

echo "Downloading GloVe 6B embeddings..."
curl -L -o "$ZIP_FILE" "$GLOVE_URL"

echo "Extracting glove.6B.50d.txt..."
unzip -o "$ZIP_FILE" "glove.6B.50d.txt" -d "$DATA_DIR"

echo "Cleaning up..."
rm -f "$ZIP_FILE"

echo "Done! GloVe 50d vectors are at $TARGET_FILE"
