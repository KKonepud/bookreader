// @ts-check

/**
 * Public Lingva Translate instance used for translation.
 * Lingva is an open-source Google Translate front-end — no API key required.
 * If this instance is down, replace with another from the Lingva public list.
 */
const LINGVA_BASE = 'https://lingva.ml';

/**
 * Heuristic language detection based on Unicode character ranges.
 * Covers the languages supported in the popup: uk, en, de, fr, es, pl.
 * Good enough for demo/development; replace with an API call for production.
 * @param {string} text
 * @returns {string} ISO 639-1 code
 */
function detectLangLocally(text) {
  const t = text.trim();

  // Cyrillic block — assume Ukrainian (covers uk/ru; good enough for this app)
  if (/[\u0400-\u04FF]/.test(t)) return 'uk';

  // Japanese: Hiragana, Katakana, or CJK Unified Ideographs
  if (/[\u3040-\u30FF\u4E00-\u9FFF]/.test(t)) return 'ja';

  // Count language-specific Latin characters
  const deChars = (t.match(/[äöüÄÖÜß]/g) || []).length;
  const frChars = (t.match(/[àâæçéèêëîïôœùûüÿÀÂÆÇÉÈÊËÎÏÔŒÙÛÜŸ]/g) || []).length;
  const esChars = (t.match(/[áéíóúüñÁÉÍÓÚÜÑ¿¡]/g) || []).length;
  const plChars = (t.match(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g) || []).length;

  const max = Math.max(deChars, frChars, esChars, plChars);
  if (max === 0) return 'en'; // plain Latin → English

  if (max === deChars) return 'de';
  if (max === frChars) return 'fr';
  if (max === esChars) return 'es';
  return 'pl';
}

export class DictionaryService {
  /**
   * Detect the language of a text snippet.
   * Uses local Unicode heuristics — no API call needed.
   * @param {string} text
   * @returns {Promise<string>} ISO 639-1 code
   */
  async detectLanguage(text) {
    return detectLangLocally(text);
  }

  /**
   * Translate text via Lingva Translate (open-source Google Translate front-end).
   * No API key required. Returns original text unchanged if source === target.
   * @param {string} text
   * @param {string} sourceLang  ISO 639-1 code
   * @param {string} targetLang  ISO 639-1 code
   * @returns {Promise<string>}
   */
  async translate(text, sourceLang, targetLang) {
    if (sourceLang === targetLang) return text;

    const url = `${LINGVA_BASE}/api/v1/${sourceLang}/${targetLang}/${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Lingva request failed (${res.status})`);

    const data = await res.json();
    if (!data.translation) throw new Error('Lingva: порожня відповідь');

    return data.translation;
  }

  /**
   * Fetch an English definition from the Free Dictionary API (dictionaryapi.dev).
   * Works for single English words; returns '' for unknown words.
   * Returns the first meaningful definition with part of speech.
   * @param {string} word
   * @returns {Promise<string>}
   */
  async getDefinition(word) {
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`;
    const res = await fetch(url);
    if (!res.ok) return '';

    const data = await res.json();
    if (!Array.isArray(data) || !data.length) return '';

    const POS_PRIORITY = ['noun', 'verb', 'adjective', 'adverb', 'preposition',
      'conjunction', 'interjection', 'particle', 'phrase', 'idiom'];

    const allMeanings = data.flatMap(entry => entry.meanings ?? []);

    let meaning = null;
    for (const pos of POS_PRIORITY) {
      meaning = allMeanings.find(m => m.partOfSpeech?.toLowerCase() === pos) ?? null;
      if (meaning) break;
    }
    if (!meaning) meaning = allMeanings[0] ?? null;
    if (!meaning) return '';

    const def = meaning.definitions?.[0];
    if (!def) return '';

    const pos = meaning.partOfSpeech ? `(${meaning.partOfSpeech}) ` : '';
    const example = def.example ? ` — "${def.example}"` : '';
    return `${pos}${def.definition}${example}`;
  }

  /**
   * Fetch an English definition and translate it into the target language.
   *
   * Workflow:
   *  1. If the source word is not English, translate it to English first (for
   *     the Free Dictionary API which only covers English words).
   *  2. Look up the English definition via Free Dictionary API.
   *  3. If targetLang !== 'en', translate the definition text via Lingva.
   *
   * Returns '' when no definition is found or any step fails.
   *
   * @param {string} word        The word to define (in its original language)
   * @param {string} sourceLang  ISO 639-1 code of the word's language
   * @param {string} targetLang  ISO 639-1 code of the desired output language
   * @returns {Promise<string>}
   */
  async getDefinitionInLanguage(word, sourceLang, targetLang) {
    // Step 1: get the English spelling of the word for the dictionary lookup
    let englishWord = word;
    if (sourceLang !== 'en') {
      try {
        englishWord = await this.translate(word, sourceLang, 'en');
      } catch {
        englishWord = word;
      }
    }

    // Step 2: fetch English definition from Free Dictionary API
    const definition = await this.getDefinition(englishWord);
    if (!definition) return '';

    // Step 3: translate the definition into the target language via Lingva
    if (targetLang === 'en') return definition;

    try {
      return await this.translate(definition, 'en', targetLang);
    } catch {
      // Fallback: return the English definition rather than nothing
      return definition;
    }
  }
}
