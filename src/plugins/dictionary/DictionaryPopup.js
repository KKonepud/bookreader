// @ts-check
import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export const LANGUAGES = [
  { code: 'uk', label: 'Українська' },
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'pl', label: 'Polski' },
  { code: 'ja', label: '日本語' },
];

/** Мікрофон у стилі line-art (як іконки навігації BookReader): лише stroke */
const micIcon = html`
  <svg class="br-dictionary-popup__mic-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M12 15a4 4 0 0 0 4-4V7a4 4 0 0 0-8 0v4a4 4 0 0 0 4 4Z" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round"/>
    <path d="M19 11a7 7 0 0 1-14 0" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/>
    <path d="M12 19v3M9 22h6" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/>
  </svg>
`;

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

  createRenderRoot() {
    return this;
  }

  render() {
    if (!this.visible) return html``;

    const detectedLabel = LANGUAGES.find(l => l.code === this.detectedLang)?.label ?? this.detectedLang;

    return html`
      <div class="br-dictionary-popup__backdrop" @click="${this._close}" aria-hidden="true"></div>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="br-dict-word"
        class="br-dictionary-popup"
        style="left:${this.x}px; top:${this.y}px;"
      >
        <button
          type="button"
          class="br-dictionary-popup__close-x"
          @click="${this._close}"
          aria-label="Закрити словник"
          title="Закрити"
        >
          <svg class="br-dictionary-popup__close-icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/>
          </svg>
        </button>

        <div class="br-dictionary-popup__inner">
          ${this.detectedLang ? html`
            <p class="br-dictionary-popup__meta">
              Мова: <strong>${detectedLabel}</strong>
            </p>
          ` : html`
            <p class="br-dictionary-popup__meta br-dictionary-popup__meta--muted">Мова: …</p>
          `}

          <div class="br-dictionary-popup__translate-to">
            <label class="br-dictionary-popup__translate-to-label" for="br-dict-lang">Перекласти на:</label>
            <select
              id="br-dict-lang"
              class="br-dictionary-popup__target-lang"
              aria-label="Мова перекладу"
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

          <div class="br-dictionary-popup__source-row">
            <span id="br-dict-word" class="br-dictionary-popup__source-word">${this.word}</span>
          </div>

          ${this.loading ? html`
            <div class="br-dictionary-popup__loading" aria-live="polite">
              <span class="br-dictionary-popup__spinner"></span>
              Завантаження…
            </div>
          ` : html`
            <div class="br-dictionary-popup__scroll">
              <div class="br-dictionary-popup__section">
                <span class="br-dictionary-popup__label">Переклад</span>
                <div class="br-dictionary-popup__translation-row">
                  <span class="br-dictionary-popup__value">${this.translation || '—'}</span>
                  <button
                    type="button"
                    class="br-dictionary-popup__mic-stub"
                    @click="${this._onSpeakTranslation}"
                    aria-label="Озвучити переклад"
                    title="Озвучити переклад"
                  >
                    ${micIcon}
                  </button>
                </div>
              </div>
              ${this.definition ? html`
                <div class="br-dictionary-popup__section">
                  <span class="br-dictionary-popup__label">Значення</span>
                  <span class="br-dictionary-popup__value br-dictionary-popup__value--definition">
                    ${this.definition}
                  </span>
                </div>
              ` : ''}
            </div>
          `}
        </div>
      </div>
    `;
  }

  _close() {
    this.visible = false;
    window.getSelection()?.removeAllRanges();
    this.dispatchEvent(new CustomEvent('br-dictionary-close', { bubbles: true }));
  }

  /** Озвучити переклад цільовою мовою (заглушка Web Speech API) */
  _onSpeakTranslation() {
    const text = (this.translation || '').trim();
    if (!text || text === '—') return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = this.targetLang || 'uk';
    window.speechSynthesis?.cancel();
    window.speechSynthesis?.speak(utterance);
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
