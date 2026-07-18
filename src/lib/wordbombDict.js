// Lazy English dictionary for Word Bomb. Loaded once, then O(1) lookups.

let loadPromise = null;
let wordSet = null;

export function isDictReady() {
  return wordSet != null;
}

export function isEnglishWord(word) {
  if (!wordSet) return false;
  return wordSet.has(String(word || '').toLowerCase());
}

/** Fetch and parse the word list. Safe to call many times. */
export function loadWordBombDict() {
  if (wordSet) return Promise.resolve(wordSet);
  if (loadPromise) return loadPromise;

  loadPromise = fetch(`${import.meta.env.BASE_URL}dict/english-words.txt`)
    .then(res => {
      if (!res.ok) throw new Error('dictionary missing');
      return res.text();
    })
    .then(text => {
      const set = new Set();
      for (const line of text.split(/\n/)) {
        const w = line.trim().toLowerCase();
        if (w.length >= 3) set.add(w);
      }
      wordSet = set;
      return set;
    })
    .catch(err => {
      loadPromise = null;
      throw err;
    });

  return loadPromise;
}
