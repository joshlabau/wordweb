#!/usr/bin/env python3
"""
Build game data for Synonimble from WordNet synonyms.

Uses NLTK's WordNet to find semantically related words and Wu-Palmer
similarity scores, which better match human intuition about word similarity
than vector-based approaches like GloVe.

Usage:
    python scripts/build-game-data.py

Prerequisites:
    - pip install nltk
    - WordNet data is auto-downloaded if missing

Outputs:
    - public/game-data.json
"""

import json
import os
import sys
from pathlib import Path

import nltk
from nltk.corpus import wordnet as wn
from nltk.stem import PorterStemmer

# ── Configuration ──────────────────────────────────────────────────────

FREQUENCY_PATH = "data/frequency-list.txt"
BLOCKLIST_PATH = "data/profanity-blocklist.txt"
OUTPUT_PATH = "public/game-data.json"

MIN_WORD_LENGTH = 3
MAX_VOCABULARY = 12000
NUM_PARENTS = 5000
STORED_CANDIDATES = 20  # store top 20 per parent; runtime picks 5
MIN_CANDIDATES = 5      # minimum related words to be a valid parent


# ── WordNet helpers ────────────────────────────────────────────────────

def ensure_wordnet():
    """Download WordNet data if not already present."""
    try:
        wn.synsets("test")
    except LookupError:
        print("Downloading WordNet data...")
        nltk.download("wordnet")
        nltk.download("omw-1.4")


# Global cache for wup_similarity (synset pairs repeat across words)
_wup_cache: dict[tuple[str, str], float | None] = {}


def cached_wup(s1, s2) -> float:
    """Wu-Palmer similarity with caching."""
    key = (s1.name(), s2.name())
    if key not in _wup_cache:
        _wup_cache[key] = s1.wup_similarity(s2)
    return _wup_cache[key] or 0.0


def get_reachable_synsets(word):
    """Get all synsets reachable through WordNet relations from `word`."""
    synsets = wn.synsets(word)
    if not synsets:
        return set(), synsets

    reachable = set()
    for synset in synsets:
        reachable.add(synset)

        # Hypernyms (up to 3 levels)
        for h1 in synset.hypernyms():
            reachable.add(h1)
            for h2 in h1.hypernyms():
                reachable.add(h2)
                for h3 in h2.hypernyms():
                    reachable.add(h3)

        # Hyponyms (up to 3 levels)
        for h1 in synset.hyponyms():
            reachable.add(h1)
            for h2 in h1.hyponyms():
                reachable.add(h2)
                for h3 in h2.hyponyms():
                    reachable.add(h3)

        # Sister terms (co-hyponyms)
        for hyper in synset.hypernyms():
            for sister in hyper.hyponyms():
                reachable.add(sister)

        # Also-see and similar-to (important for adjectives)
        for also in synset.also_sees():
            reachable.add(also)
        for sim in synset.similar_tos():
            reachable.add(sim)

        # Meronyms and holonyms (part-of / whole-of)
        for m in (
            synset.part_meronyms()
            + synset.member_meronyms()
            + synset.substance_meronyms()
        ):
            reachable.add(m)
        for h in (
            synset.part_holonyms()
            + synset.member_holonyms()
            + synset.substance_holonyms()
        ):
            reachable.add(h)

    return reachable, synsets


def find_related_words(word, vocab_set):
    """Find vocab words related to `word` via WordNet with max Wu-Palmer similarity.

    Computes similarity at the synset level (max across all sense pairs),
    then maps to vocabulary words.
    """
    reachable, word_synsets = get_reachable_synsets(word)
    if not word_synsets:
        return {}

    related: dict[str, float] = {}
    for cs in reachable:
        # Max similarity of this candidate synset against any sense of the word
        best_sim = max(cached_wup(ws, cs) for ws in word_synsets)
        if best_sim <= 0.15:
            continue

        for lemma in cs.lemmas():
            name = lemma.name().lower()
            if "_" in name or name == word or name not in vocab_set:
                continue
            if name not in related or best_sim > related[name]:
                related[name] = round(best_sim, 2)

    return related


# ── Data loading ───────────────────────────────────────────────────────

def load_word_list(path: str) -> set[str]:
    """Load a newline-delimited word list."""
    if not os.path.exists(path):
        print(f"  Warning: {path} not found, skipping")
        return set()
    with open(path, "r", encoding="utf-8") as f:
        words = {line.strip().lower() for line in f if line.strip()}
    print(f"  Loaded {len(words)} words from {path}")
    return words


def build_vocabulary(frequency_words: set[str], blocklist: set[str]) -> list[str]:
    """Build vocabulary from WordNet lemmas intersected with frequency list."""
    wn_words = set()
    for synset in wn.all_synsets():
        for lemma in synset.lemmas():
            name = lemma.name().lower()
            if "_" not in name:
                wn_words.add(name)

    print(f"  WordNet single-word lemmas: {len(wn_words)}")

    if frequency_words:
        vocab = wn_words & frequency_words
    else:
        vocab = set(wn_words)

    vocab = {
        w
        for w in vocab
        if len(w) >= MIN_WORD_LENGTH
        and w.isalpha()
        and w.islower()
        and w not in blocklist
    }

    vocab_list = sorted(vocab)[:MAX_VOCABULARY]
    print(f"  Final vocabulary: {len(vocab_list)} words")
    return vocab_list


# ── Candidate selection ────────────────────────────────────────────────

def select_top_candidates(
    related_words: dict[str, float],
    parent_word: str,
    vocab_idx: dict[str, int],
    stems: list[str],
    parent_set: set[str],
) -> list[dict]:
    """Select top STORED_CANDIDATES related words, deduplicating by stem."""
    parent_stem = stems[vocab_idx[parent_word]]

    # Filter to parent words, sort by similarity descending
    scored = sorted(
        [(w, s) for w, s in related_words.items() if w in parent_set],
        key=lambda x: -x[1],
    )

    selected = []
    used_stems: set[str] = {parent_stem}

    for word, sim in scored:
        if len(selected) >= STORED_CANDIDATES:
            break
        stem = stems[vocab_idx[word]]
        if stem in used_stems:
            continue
        selected.append({"word": vocab_idx[word], "similarity": sim})
        used_stems.add(stem)

    return selected


# ── Main pipeline ──────────────────────────────────────────────────────

def main():
    root = Path(__file__).resolve().parent.parent
    os.chdir(root)

    ensure_wordnet()

    frequency_words = load_word_list(FREQUENCY_PATH)
    blocklist = load_word_list(BLOCKLIST_PATH)

    # Build vocabulary
    print("Building vocabulary...")
    vocabulary = build_vocabulary(frequency_words, blocklist)
    vocab_set = set(vocabulary)
    vocab_idx = {w: i for i, w in enumerate(vocabulary)}

    # Build stem lookup
    print("Computing word stems...")
    stemmer = PorterStemmer()
    stems = [stemmer.stem(w) for w in vocabulary]
    unique_stems = len(set(stems))
    print(f"  {len(vocabulary)} words → {unique_stems} unique stems")

    # Phase 1: Find related words for all vocabulary words
    print("Finding WordNet relations...")
    word_relations: dict[str, dict[str, float]] = {}
    for i, word in enumerate(vocabulary):
        if i % 1000 == 0:
            print(f"  Processing {i}/{len(vocabulary)}...")
        related = find_related_words(word, vocab_set)
        if len(related) >= MIN_CANDIDATES:
            word_relations[word] = related

    print(f"  {len(word_relations)} words have >= {MIN_CANDIDATES} related words")

    # Phase 2: Select parent words (most related words = richest neighborhoods)
    print("Selecting parent words...")
    parent_scores = [(w, len(r)) for w, r in word_relations.items()]
    parent_scores.sort(key=lambda x: -x[1])
    parent_words = [w for w, _ in parent_scores[:NUM_PARENTS]]
    parent_set = set(parent_words)
    print(f"  Selected {len(parent_words)} parent words")

    # Phase 3: Iteratively refine for mutual expandability
    print("Refining parent set for mutual expandability...")
    for iteration in range(10):
        new_parents = []
        for word in parent_words:
            related = word_relations[word]
            in_set = sum(1 for w in related if w in parent_set)
            if in_set >= MIN_CANDIDATES:
                new_parents.append(word)

        if len(new_parents) == len(parent_words):
            print(f"  Stable after {iteration + 1} iterations: {len(parent_words)} parents")
            break

        parent_words = new_parents
        parent_set = set(parent_words)
        print(f"  Iteration {iteration + 1}: {len(parent_words)} parents")

    # Phase 4: Generate candidate entries (top 20 per parent)
    print("Generating candidate entries...")
    parents = []
    for word in parent_words:
        related = word_relations[word]
        candidates = select_top_candidates(related, word, vocab_idx, stems, parent_set)
        if len(candidates) >= MIN_CANDIDATES:
            parents.append({"word": vocab_idx[word], "candidates": candidates})

    print(f"  Generated {len(parents)} playable parent entries")

    if len(parents) == 0:
        print("Error: No playable parents generated!")
        sys.exit(1)

    # Build output
    game_data = {
        "version": 1,
        "vocabulary": vocabulary,
        "parents": parents,
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(game_data, f, separators=(",", ":"))

    file_size = os.path.getsize(OUTPUT_PATH)
    print(f"\nOutput: {OUTPUT_PATH} ({file_size:,} bytes)")
    print(f"  Vocabulary: {len(vocabulary)} words")
    print(f"  Parents: {len(parents)}")
    if parents:
        cand_counts = [len(p["candidates"]) for p in parents]
        avg_cand = sum(cand_counts) / len(cand_counts)
        print(f"  Avg candidates per parent: {avg_cand:.1f}")
        print(f"  Min candidates: {min(cand_counts)}, Max: {max(cand_counts)}")

    # Sample entries for inspection
    print("\nSample entries:")
    for p in parents[:8]:
        word = vocabulary[p["word"]]
        cands = [(vocabulary[c["word"]], c["similarity"]) for c in p["candidates"]]
        print(f"  {word}: {cands[:6]}...")

    print(f"\nWUP cache size: {len(_wup_cache):,} entries")
    print("Done!")


if __name__ == "__main__":
    main()
