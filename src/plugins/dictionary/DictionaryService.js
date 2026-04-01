// @ts-check

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
   * Translate text via MyMemory (free, no API key required).
   * Limit: ~1 000 words/day per IP; enough for demo use.
   * Returns original text unchanged if source === target.
   * @param {string} text
   * @param {string} sourceLang  ISO 639-1 code
   * @param {string} targetLang  ISO 639-1 code
   * @returns {Promise<string>}
   */
  async translate(text, sourceLang, targetLang) {
    if (sourceLang === targetLang) return text;

    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`MyMemory request failed (${res.status})`);

    const data = await res.json();

    // responseStatus 200 = OK, 429 = daily limit exceeded
    if (data.responseStatus === 429) {
      throw new Error('MyMemory: денний ліміт запитів вичерпано');
    }
    if (data.responseStatus !== 200) {
      throw new Error(`MyMemory error: ${data.responseDetails ?? data.responseStatus}`);
    }

    return data.responseData?.translatedText ?? '';
  }

  /**
   * Fetch an English definition from Wiktionary.
   * Works best for single English words; returns '' for unknown words.
   * @param {string} word
   * @returns {Promise<string>}
   */
  async getDefinition(word) {
    const url = `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word.toLowerCase())}`;
    const res = await fetch(url);
    if (!res.ok) return '';
    const data = await res.json();
    const rawHtml = data?.en?.[0]?.definitions?.[0]?.definition ?? '';
    // Strip HTML tags to get plain text
    return rawHtml.replace(/<[^>]+>/g, '').trim();
  }

  /**
   * Fetch an English definition from Wiktionary and translate it into the target language.
   *
   * Workflow:
   *  1. If the source word is not English, translate it to English first (needed for
   *     Wiktionary which only has an English REST endpoint).
   *  2. Look up the English definition via Wiktionary.
   *  3. If targetLang !== 'en', translate the definition text via MyMemory.
   *
   * Supports uk, en, de, fr, es, pl, ja (and any other language MyMemory handles).
   * Returns '' when no definition is found or any step fails.
   *
   * @param {string} word        The word to define (in its original language)
   * @param {string} sourceLang  ISO 639-1 code of the word's language
   * @param {string} targetLang  ISO 639-1 code of the desired output language
   * @returns {Promise<string>}
   */
  async getDefinitionInLanguage(word, sourceLang, targetLang) {
    // Step 1: get the English spelling of the word for the Wiktionary lookup
    let englishWord = word;
    if (sourceLang !== 'en') {
      try {
        englishWord = await this.translate(word, sourceLang, 'en');
      } catch {
        // If translation to English fails, try the original word directly
        englishWord = word;
      }
    }

    // Step 2: fetch English definition from Wiktionary
    const definition = await this.getDefinition(englishWord);
    if (!definition) return '';

    // Step 3: translate the definition into the target language via MyMemory
    if (targetLang === 'en') return definition;

    try {
      return await this.translate(definition, 'en', targetLang);
    } catch {
      // Fallback: return the English definition rather than nothing
      return definition;
    }
  }
}
