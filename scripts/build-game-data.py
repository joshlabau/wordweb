#!/usr/bin/env python3
"""
Build game data for Synonimble from GloVe embeddings.

Usage:
    python scripts/build-game-data.py

Prerequisites:
    - Download GloVe vectors: bash scripts/download-glove.sh
    - pip install numpy

Outputs:
    - public/game-data.json (shipped to clients, ~50-70 KB gzipped)
"""

import json
import os
import sys
from pathlib import Path

import numpy as np

# ── Configuration ──────────────────────────────────────────────────────

GLOVE_PATH = "data/glove.6B.50d.txt"
FREQUENCY_PATH = "data/frequency-list.txt"
BLOCKLIST_PATH = "data/profanity-blocklist.txt"
OUTPUT_PATH = "public/game-data.json"

MIN_WORD_LENGTH = 3
MAX_VOCABULARY = 12000
NUM_PARENTS = 5000

# Candidate selection: skip the top SKIP most similar, then take the next COUNT
CANDIDATE_SKIP = 2   # skip #1 and #2 most similar
CANDIDATE_COUNT = 5  # take #3 through #7


def load_glove(path: str) -> tuple[dict[str, np.ndarray], int]:
    """Load GloVe vectors from text file."""
    print(f"Loading GloVe vectors from {path}...")
    vectors = {}
    dim = 0
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            parts = line.strip().split()
            word = parts[0]
            vec = np.array([float(x) for x in parts[1:]], dtype=np.float32)
            if dim == 0:
                dim = len(vec)
            vectors[word] = vec
    print(f"  Loaded {len(vectors)} vectors ({dim}D)")
    return vectors, dim


def load_word_list(path: str) -> set[str]:
    """Load a newline-delimited word list."""
    if not os.path.exists(path):
        print(f"  Warning: {path} not found, skipping")
        return set()
    with open(path, "r", encoding="utf-8") as f:
        words = {line.strip().lower() for line in f if line.strip()}
    print(f"  Loaded {len(words)} words from {path}")
    return words


def filter_vocabulary(
    glove_words: set[str],
    frequency_words: set[str],
    blocklist: set[str],
) -> list[str]:
    """Filter and intersect word lists to build game vocabulary."""
    # Start with intersection of GloVe and frequency list
    if frequency_words:
        vocab = glove_words & frequency_words
    else:
        # If no frequency list, use all GloVe words
        vocab = set(glove_words)

    # Apply filters
    vocab = {
        w
        for w in vocab
        if len(w) >= MIN_WORD_LENGTH
        and w.isalpha()           # only alphabetic (no numbers, hyphens)
        and w.islower()           # no proper nouns (rough heuristic)
        and w not in blocklist
    }

    # Sort alphabetically for determinism, then limit
    vocab_list = sorted(vocab)[:MAX_VOCABULARY]
    print(f"  Filtered vocabulary: {len(vocab_list)} words")
    return vocab_list


def build_embedding_matrix(
    vocabulary: list[str], glove: dict[str, np.ndarray], dim: int
) -> np.ndarray:
    """Build a normalized embedding matrix for the vocabulary."""
    matrix = np.zeros((len(vocabulary), dim), dtype=np.float32)
    for i, word in enumerate(vocabulary):
        matrix[i] = glove[word]

    # Normalize to unit vectors (cosine similarity = dot product)
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    norms[norms == 0] = 1  # avoid division by zero
    matrix = matrix / norms
    return matrix


def select_candidates(
    similarities: np.ndarray,
    parent_idx: int,
    parent_set: set[int],
) -> list[dict]:
    """Select candidates ranked #3–#7 most similar (among parent words).

    Skips the top 2 most similar to make ranking harder — all candidates
    are close in similarity so the player can't rely on obvious outliers.
    Only picks from parent words so every candidate is expandable.
    """
    # Get similarities for parent words only (excluding self)
    scored = []
    for idx in parent_set:
        if idx == parent_idx:
            continue
        scored.append((idx, float(similarities[idx])))

    # Sort by similarity descending
    scored.sort(key=lambda x: -x[1])

    # Skip top CANDIDATE_SKIP, take next CANDIDATE_COUNT
    selected = scored[CANDIDATE_SKIP : CANDIDATE_SKIP + CANDIDATE_COUNT]

    return [
        {"word": idx, "similarity": round(sim, 2)}
        for idx, sim in selected
    ]


def main():
    root = Path(__file__).resolve().parent.parent
    os.chdir(root)

    # Load data
    glove_path = GLOVE_PATH
    if not os.path.exists(glove_path):
        print(f"Error: GloVe vectors not found at {glove_path}")
        print("Run: bash scripts/download-glove.sh")
        sys.exit(1)

    glove, dim = load_glove(glove_path)
    frequency_words = load_word_list(FREQUENCY_PATH)
    blocklist = load_word_list(BLOCKLIST_PATH)

    # Build vocabulary
    print("Building vocabulary...")
    vocabulary = filter_vocabulary(set(glove.keys()), frequency_words, blocklist)

    # Build embedding matrix
    print("Building embedding matrix...")
    matrix = build_embedding_matrix(vocabulary, glove, dim)

    # Score all words as potential parents
    # Good parents have many similar words (so #3-#7 are meaningfully close)
    print("Scoring parent word quality...")
    parent_scores = []
    for i in range(len(vocabulary)):
        sims = matrix @ matrix[i]
        # Score = sum of top 10 similarities (excluding self)
        top_sims = np.sort(sims)[-11:-1]  # top 10 excluding self (last = self = 1.0)
        score = float(np.sum(top_sims))
        parent_scores.append((i, score))

    # Select top parents
    parent_scores.sort(key=lambda x: -x[1])
    parent_indices = [idx for idx, _ in parent_scores[:NUM_PARENTS]]
    print(f"  Selected {len(parent_indices)} parent words")

    if len(parent_indices) == 0:
        print("Error: No suitable parent words found. Check your data.")
        sys.exit(1)

    # Generate candidates for each parent (#3-#7 most similar parent words)
    print("Generating candidates...")
    parent_set = set(parent_indices)
    parents = []

    for parent_idx in parent_indices:
        sims = matrix @ matrix[parent_idx]
        candidates = select_candidates(sims, parent_idx, parent_set)
        if len(candidates) >= CANDIDATE_COUNT:
            parents.append({"word": parent_idx, "candidates": candidates})

    print(f"  Generated {len(parents)} playable parent entries")

    # Build output
    game_data = {
        "version": 1,
        "vocabulary": vocabulary,
        "parents": parents,
    }

    # Write output
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(game_data, f, separators=(",", ":"))

    file_size = os.path.getsize(OUTPUT_PATH)
    print(f"\nOutput: {OUTPUT_PATH} ({file_size:,} bytes)")
    print(f"  Vocabulary: {len(vocabulary)} words")
    print(f"  Parents: {len(parents)}")
    print(f"  Avg candidates per parent: {sum(len(p['candidates']) for p in parents) / len(parents):.1f}")
    print("\nDone!")


if __name__ == "__main__":
    main()
