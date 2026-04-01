// @ts-check
import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

const LANGUAGES = [
  { code: 'uk', label: 'Українська' },
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'pl', label: 'Polski' },
  { code: 'ja', label: '日本語' },
];

@customElement('br-dictionary-popup')
export class DictionaryPopup extends LitElement {
  @property({ type: String }) word = '';
  @property({ type: Boolean }) visible = false;
  @property({ type: Number }) x = 0;
  @property({ type: Number }) y = 0;

  /** Detected language of the selected word (e.g. 'en', 'de') */
  @property({ type: String }) detectedLang = '';

  /** Language the user wants translation/definition in */
  @property({ type: String }) targetLang = 'uk';

  /** Translation of the word in targetLang */
  @property({ type: String }) translation = '';

  /** Definition of the word (Wiktionary, English source only) */
  @property({ type: String }) definition = '';

  /** True while the service call is in flight */
  @property({ type: Boolean }) loading = false;

  /** Disable Shadow DOM so BookReader.css styles reach this element */
  createRenderRoot() {
    return this;
  }

  render() {
    if (!this.visible) return html``;

    const detectedLabel = LANGUAGES.find(l => l.code === this.detectedLang)?.label ?? this.detectedLang;

    return html`
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="br-dict-word"
        class="br-dictionary-popup"
        style="left:${this.x}px; top:${this.y}px;"
      >
        <!-- Header: word + close -->
        <div class="br-dictionary-popup__header">
          <h3 id="br-dict-word" class="br-dictionary-popup__word">${this.word}</h3>
          <button
            class="br-dictionary-popup__close"
            @click="${this._close}"
            aria-label="Close dictionary"
          >✕</button>
        </div>

        <!-- Body -->
        <div class="br-dictionary-popup__body">

          <!-- Detected language -->
          ${this.detectedLang ? html`
            <p class="br-dictionary-popup__detected-lang">
              Мова: <strong>${detectedLabel}</strong>
            </p>
          ` : ''}

          <!-- Target language selector -->
          <div class="br-dictionary-popup__lang-select">
            <label for="br-dict-lang">Перекласти на:</label>
            <select
              id="br-dict-lang"
              .value="${this.targetLang}"
              @change="${this._onLangChange}"
            >
              ${LANGUAGES.map(l => html`
                <option value="${l.code}" ?selected="${l.code === this.targetLang}">
                  ${l.label}
                </option>
              `)}
            </select>
          </div>

          <!-- Loading spinner -->
          ${this.loading ? html`
            <div class="br-dictionary-popup__loading" aria-live="polite">
              <span class="br-dictionary-popup__spinner"></span>
              Завантаження…
            </div>
          ` : html`

            <!-- Translation -->
            <div class="br-dictionary-popup__section">
              <span class="br-dictionary-popup__label">Переклад</span>
              <span class="br-dictionary-popup__value">
                ${this.translation || '—'}
              </span>
            </div>

            <!-- Definition (shown only when available) -->
            ${this.definition ? html`
              <div class="br-dictionary-popup__section">
                <span class="br-dictionary-popup__label">Значення</span>
                <span class="br-dictionary-popup__value br-dictionary-popup__value--definition">
                  ${this.definition}
                </span>
              </div>
            ` : ''}

          `}

        </div>
      </div>
    `;
  }

  _close() {
    this.visible = false;
    // Clear the text selection so the mouseup handler doesn't immediately re-open the popup
    window.getSelection()?.removeAllRanges();
    this.dispatchEvent(new CustomEvent('br-dictionary-close', { bubbles: true }));
  }

  /** @param {Event} e */
  _onLangChange(e) {
    const select = /** @type {HTMLSelectElement} */(e.target);
    this.targetLang = select.value;
    this.dispatchEvent(new CustomEvent('br-dictionary-lang-change', {
      bubbles: true,
      detail: { targetLang: this.targetLang },
    }));
  }
}
