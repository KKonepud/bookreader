  import { DictionaryPopup, LANGUAGES } from '@/src/plugins/dictionary/DictionaryPopup.js';                            
  describe('DictionaryPopup rendering', () => {
    /** @type {DictionaryPopup} */
    let popup;

    beforeEach(() => {
      window.speechSynthesis = {
        cancel: jest.fn(),
        speak: jest.fn(),
        getVoices: jest.fn().mockReturnValue([]),
      };
      popup = document.createElement('br-dictionary-popup');
      document.body.appendChild(popup);
    });

    afterEach(() => {
      document.body.innerHTML = '';
      delete window.speechSynthesis;
    });

    describe('visibility', () => {
      test('renders nothing when visible is false', async () => {
        popup.visible = false;
        await popup.updateComplete;
        expect(popup.querySelector('.br-dictionary-popup')).toBeNull();
      });

      test('renders popup container when visible is true', async () => {
        popup.visible = true;
        popup.word = 'hello';
        await popup.updateComplete;
        expect(popup.querySelector('.br-dictionary-popup')).not.toBeNull();
      });

      test('renders backdrop when visible', async () => {
        popup.visible = true;
        await popup.updateComplete;
        expect(popup.querySelector('.br-dictionary-popup__backdrop')).not.toBeNull();
      });
    });

    describe('positioning', () => {
      test('applies x and y as inline style', async () => {
        popup.visible = true;
        popup.x = 150;
        popup.y = 300;
        await popup.updateComplete;
        const container = popup.querySelector('.br-dictionary-popup');
        expect(container.style.left).toBe('150px');
        expect(container.style.top).toBe('300px');
      });
    });

    describe('word display', () => {
      test('shows the selected word', async () => {
        popup.visible = true;
        popup.word = 'library';
        await popup.updateComplete;
        const wordEl = popup.querySelector('#br-dict-word');
        expect(wordEl.textContent.trim()).toBe('library');
      });
    });

    describe('detected language', () => {
      test('shows detected language label when detectedLang is set', async () => {
        popup.visible = true;
        popup.detectedLang = 'en';
        await popup.updateComplete;
        const meta = popup.querySelector('.br-dictionary-popup__meta');
        expect(meta.textContent).toContain('English');
      });

      test('shows placeholder text when detectedLang is empty', async () => {
        popup.visible = true;
        popup.detectedLang = '';
        await popup.updateComplete;
        const meta = popup.querySelector('.br-dictionary-popup__meta');
        expect(meta.textContent).toContain('…');
      });
    });

    describe('language selector', () => {
      test('renders a select with all supported languages', async () => {
        popup.visible = true;
        await popup.updateComplete;
        const select = popup.querySelector('#br-dict-lang');
        expect(select).not.toBeNull();
        expect(select.options.length).toBe(LANGUAGES.length);
      });

      test('marks the current targetLang as selected', async () => {
        popup.visible = true;
        popup.targetLang = 'de';
        await popup.updateComplete;
        const select = popup.querySelector('#br-dict-lang');
        const selected = Array.from(select.options).find(o => o.selected);
        expect(selected.value).toBe('de');
      });
    });

    describe('loading state', () => {
      test('shows spinner and hides content while loading', async () => {
        popup.visible = true;
        popup.loading = true;
        await popup.updateComplete;
        expect(popup.querySelector('.br-dictionary-popup__loading')).not.toBeNull();
        expect(popup.querySelector('.br-dictionary-popup__scroll')).toBeNull();
      });

      test('shows content and hides spinner when not loading', async () => {
        popup.visible = true;
        popup.loading = false;
        await popup.updateComplete;
        expect(popup.querySelector('.br-dictionary-popup__loading')).toBeNull();
        expect(popup.querySelector('.br-dictionary-popup__scroll')).not.toBeNull();
      });
    });

    describe('translation display', () => {
      test('shows translation text when available', async () => {
        popup.visible = true;
        popup.loading = false;
        popup.translation = 'Привіт';
        await popup.updateComplete;
        const value = popup.querySelector(
          '.br-dictionary-popup__translation-row .br-dictionary-popup__value'
        );
        expect(value.textContent.trim()).toBe('Привіт');
      });

      test('shows dash placeholder when translation is empty', async () => {
        popup.visible = true;
        popup.loading = false;
        popup.translation = '';
        await popup.updateComplete;
        const value = popup.querySelector(
          '.br-dictionary-popup__translation-row .br-dictionary-popup__value'
        );
        expect(value.textContent.trim()).toBe('—');
      });

      test('renders speak button next to translation', async () => {
        popup.visible = true;
        popup.loading = false;
        await popup.updateComplete;
        expect(popup.querySelector('.br-dictionary-popup__mic-stub')).not.toBeNull();
      });
    });

    describe('definition display', () => {
      test('shows definition section when definition is non-empty', async () => {
        popup.visible = true;
        popup.loading = false;
        popup.definition = '(noun) a common greeting';
        await popup.updateComplete;
        const defEl = popup.querySelector('.br-dictionary-popup__value--definition');
        expect(defEl).not.toBeNull();
        expect(defEl.textContent.trim()).toBe('(noun) a common greeting');
      });

      test('hides definition section when definition is empty', async () => {
        popup.visible = true;
        popup.loading = false;
        popup.definition = '';
        await popup.updateComplete;
        expect(popup.querySelector('.br-dictionary-popup__value--definition')).toBeNull();
      });
    });

    describe('close button', () => {
      test('renders X close button', async () => {
        popup.visible = true;
        await popup.updateComplete;
        expect(popup.querySelector('.br-dictionary-popup__close-x')).not.toBeNull();
      });

      test('clicking close button hides the popup', async () => {
        popup.visible = true;
        await popup.updateComplete;
        popup.querySelector('.br-dictionary-popup__close-x').click();
        await popup.updateComplete;
        expect(popup.querySelector('.br-dictionary-popup')).toBeNull();
      });

      test('clicking backdrop hides the popup', async () => {
        popup.visible = true;
        await popup.updateComplete;
        popup.querySelector('.br-dictionary-popup__backdrop').click();
        await popup.updateComplete;
        expect(popup.querySelector('.br-dictionary-popup')).toBeNull();
      });
    });

    describe('accessibility', () => {
      test('popup container has role="dialog"', async () => {
        popup.visible = true;
        await popup.updateComplete;
        expect(popup.querySelector('[role="dialog"]')).not.toBeNull();
      });

      test('dialog has aria-modal="true"', async () => {
        popup.visible = true;
        await popup.updateComplete;
        expect(
          popup.querySelector('[role="dialog"]').getAttribute('aria-modal')
        ).toBe('true');
      });

      test('close button has aria-label', async () => {
        popup.visible = true;
        await popup.updateComplete;
        expect(
          popup.querySelector('.br-dictionary-popup__close-x').getAttribute('aria-label')
        ).toBeTruthy();
      });
    });
  });