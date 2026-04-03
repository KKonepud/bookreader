// @ts-check
import { BookReaderPlugin } from "../../BookReaderPlugin.js";
import { DictionaryService } from "./DictionaryService.js";
import { LANGUAGES } from "./DictionaryPopup.js";

/** @typedef {import('../../BookReader/PageContainer.js').PageContainer} PageContainer */

const STORAGE_KEY = 'br-dictionary-targetLang';

const BookReader = /** @type {typeof import('../../BookReader.js').default} */ (
  window.BookReader
);

export class DictionaryPlugin extends BookReaderPlugin {
  options = {
    enabled: true,
    /** Default target language for translation */
    defaultTargetLang: "uk",
  };

  /** @type {DictionaryService} */
  dictionaryService = new DictionaryService();

  /** @type {import('./DictionaryPopup.js').DictionaryPopup | null} */
  _popup = null;

  /** @type {HTMLSelectElement | null} */
  _toolbarSelect = null;

  init() {
    if (!this.options.enabled) return;

    this.dictionaryService = new DictionaryService();

    this._createPopup();
    this._attachGlobalHandlers();
  }

  /** @param {JQuery} $toolbar */
  _configureToolbar($toolbar) {
    if (!this.options.enabled) return;

    // Restore previously saved language preference
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) this.options.defaultTargetLang = saved;

    const section = document.createElement('span');
    section.className = 'BRtoolbarSection BRtoolbarSection--dict-lang';

    const label = document.createElement('label');
    label.className = 'br-dict-toolbar__label';
    label.htmlFor = 'br-dict-toolbar-lang';
    label.textContent = 'Переклад:';

    const select = document.createElement('select');
    select.id = 'br-dict-toolbar-lang';
    select.className = 'br-dict-toolbar__select';
    select.title = 'Мова перекладу';

    for (const lang of LANGUAGES) {
      const option = document.createElement('option');
      option.value = lang.code;
      option.textContent = lang.label;
      if (lang.code === this.options.defaultTargetLang) option.selected = true;
      select.appendChild(option);
    }

    select.addEventListener('change', () => {
      const lang = select.value;
      localStorage.setItem(STORAGE_KEY, lang);
      if (this._popup) {
        this._popup.targetLang = lang;
        if (this._popup.visible && this._popup.word) {
          this._retranslate(lang);
        }
      }
    });

    section.appendChild(label);
    section.appendChild(select);
    this._toolbarSelect = select;

    // Insert at the beginning of the right toolbar section
    const toolbarEl = /** @type {HTMLElement} */ ($toolbar[0] ?? $toolbar);
    const right = toolbarEl.querySelector('.BRtoolbarRight') ?? toolbarEl;
    right.prepend(section);
  }

  _createPopup() {
    this._popup = /** @type {any} */ (
      document.createElement("br-dictionary-popup")
    );
    this._popup.targetLang = this.options.defaultTargetLang;
    document.body.appendChild(this._popup);

    // Re-translate when user picks a different language in the popup
    this._popup.addEventListener(
      "br-dictionary-lang-change",
      (/** @type {CustomEvent} */ e) => {
        const lang = e.detail.targetLang;
        this._retranslate(lang);
        // Keep toolbar selector in sync
        if (this._toolbarSelect) this._toolbarSelect.value = lang;
        localStorage.setItem(STORAGE_KEY, lang);
      },
    );
  }

  _attachGlobalHandlers() {
    document.addEventListener("dblclick", this._onDocumentDblClick);
    document.addEventListener("mouseup", this._onDocumentMouseUp);
    document.addEventListener("pointerdown", this._onDocumentPointerDown);
    document.addEventListener("keydown", this._onKeyDown);
  }

  /**
   * Handle double-click on a word element — the primary trigger for dictionary lookup.
   * dblclick fires after the browser has already selected the word, so selection is ready.
   * @param {MouseEvent} e
   */
  _onDocumentDblClick = (e) => {
    const target = /** @type {Element} */ (e.target);
    const wordEl = target.closest?.(".BRwordElement");
    if (!wordEl) return;

    // Prefer the browser's selection (word + surrounding context); fall back to element text
    const selection = window.getSelection();
    const word =
      selection && !selection.isCollapsed
        ? selection.toString().trim()
        : (wordEl.textContent?.trim() ?? "");

    if (!word) return;

    const rect =
      selection && !selection.isCollapsed && selection.rangeCount > 0
        ? selection.getRangeAt(0).getBoundingClientRect()
        : wordEl.getBoundingClientRect();

    this._showPopup(word, rect);
  };

  /**
   * Handle mouseup — covers drag-selections (multi-word) inside the text layer.
   * Skip if the popup was already opened by the dblclick handler.
   * @param {MouseEvent} e
   */
  _onDocumentMouseUp = (e) => {
    // Check if the mouseup happened inside a text layer
    const target = /** @type {Element} */ (e.target);
    if (!target.closest?.(".BRtextLayer")) return;

    setTimeout(() => {
      // Skip single-word selections — dblclick handler already handles those
      if (this._popup?.visible) return;

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim())
        return;
      if (selection.rangeCount === 0) return;

      const word = selection.toString().trim();
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      this._showPopup(word, rect);
    }, 0);
  };

  /**
   * @param {string} word
   * @param {DOMRect} rect
   */
  async _showPopup(word, rect) {
    if (!this._popup) return;

    const popupWidth = 280;
    const popupEstimatedHeight = 220;
    const x = Math.min(rect.left, window.innerWidth - popupWidth - 16);
    const yBelow = rect.bottom + 8;
    const yAbove = rect.top - popupEstimatedHeight - 8;
    const y =
      yBelow + popupEstimatedHeight > window.innerHeight
        ? Math.max(8, yAbove)
        : yBelow;

    // Show immediately with loading state
    this._popup.word = word;
    this._popup.x = x;
    this._popup.y = y;
    this._popup.detectedLang = "";
    this._popup.translation = "";
    this._popup.definition = "";
    this._popup.loading = true;
    this._popup.visible = true;

    try {
      const detectedLang = await this.dictionaryService.detectLanguage(word);
      this._popup.detectedLang = detectedLang;

      // getDefinitionInLanguage handles all source languages:
      // it translates the word to English for the Wiktionary lookup if needed,
      // then translates the resulting definition into targetLang via MyMemory.
      const [translation, definition] = await Promise.all([
        this.dictionaryService.translate(
          word,
          detectedLang,
          this._popup.targetLang,
        ),
        this.dictionaryService.getDefinitionInLanguage(
          word,
          detectedLang,
          this._popup.targetLang,
        ),
      ]);

      this._popup.translation = translation;
      this._popup.definition = definition;
    } catch (err) {
      console.error("[BookReader Dictionary]", err);
      this._popup.translation = "⚠ Помилка перекладу";
      this._popup.definition = "";
    } finally {
      this._popup.loading = false;
    }
  }

  /**
   * Called when user switches the target language in the popup.
   * Re-translates the current word without re-detecting the language.
   * @param {string} targetLang
   */
  async _retranslate(targetLang) {
    if (!this._popup) return;
    const { word, detectedLang } = this._popup;
    if (!word || !detectedLang) return;

    this._popup.loading = true;
    this._popup.translation = "";
    this._popup.definition = "";

    try {
      // Re-translate both the word and its definition into the newly selected language
      const [translation, definition] = await Promise.all([
        this.dictionaryService.translate(word, detectedLang, targetLang),
        this.dictionaryService.getDefinitionInLanguage(word, detectedLang, targetLang),
      ]);
      this._popup.translation = translation;
      this._popup.definition = definition;
    } catch (err) {
      console.error("[BookReader Dictionary]", err);
      this._popup.translation = "⚠ Помилка перекладу";
    } finally {
      this._popup.loading = false;
    }
  }

  /** @param {PointerEvent} e */
  _onDocumentPointerDown = (e) => {
    if (!this._popup?.visible) return;
    // Keep the popup open if the user is pressing inside it
    if (this._popup.contains(/** @type {Node} */ (e.target))) return;
    // Also keep open when the user presses inside the shadow DOM of the popup
    if (e.composedPath().some((el) => el === this._popup)) return;
    this._popup.visible = false;
  };

  /** @param {KeyboardEvent} e */
  _onKeyDown = (e) => {
    if (e.key === "Escape" && this._popup) {
      this._popup.visible = false;
    }
  };
}

BookReader?.registerPlugin("dictionary", DictionaryPlugin);
