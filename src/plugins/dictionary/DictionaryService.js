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
}
