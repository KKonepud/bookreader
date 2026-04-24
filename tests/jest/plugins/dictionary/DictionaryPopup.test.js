  import { DictionaryPopup, LANGUAGES } from '@/src/plugins/dictionary/DictionaryPopup.js';                                 
  describe('DictionaryPopup', () => {
    /** @type {DictionaryPopup} */
    let popup;

    beforeEach(() => {
      window.speechSynthesis = {
        cancel: jest.fn(),
        speak:  jest.fn(),
        getVoices: jest.fn().mockReturnValue([]),
      };
      global.SpeechSynthesisUtterance = jest.fn().mockImplementation(function(text) {
        this.text  = text;
        this.lang  = '';
        this.voice = null;
        this.onend   = null;
        this.onerror = null;
      });

      popup = document.createElement('br-dictionary-popup');
      document.body.appendChild(popup);
    });

    afterEach(() => {
      document.body.innerHTML = '';
      delete window.speechSynthesis;
      delete global.SpeechSynthesisUtterance;
      jest.resetAllMocks();
    });

    describe('LANGUAGES', () => {
      test('contains all required language codes', () => {
        const codes = LANGUAGES.map(l => l.code);
        for (const code of ['uk', 'en', 'de', 'fr', 'es', 'pl', 'ja']) {
          expect(codes).toContain(code);
        }
      });

      test('every entry has a non-empty code and label', () => {
        for (const lang of LANGUAGES) {
          expect(lang.code).toBeTruthy();
          expect(lang.label).toBeTruthy();
        }
      });
    });

    describe('_getBestVoice', () => {
      test('returns null when speechSynthesis is not available', () => {
        delete window.speechSynthesis;
        expect(popup._getBestVoice('uk')).toBeNull();
      });

      test('returns null when no voices are loaded', () => {
        window.speechSynthesis.getVoices.mockReturnValue([]);
        expect(popup._getBestVoice('uk')).toBeNull();
      });

      test('returns voice with exact lang match', () => {
        const voice = { lang: 'uk', name: 'Ukrainian' };
        window.speechSynthesis.getVoices.mockReturnValue([voice]);
        expect(popup._getBestVoice('uk')).toBe(voice);
      });

      test('returns voice with prefix match when no exact match exists', () => {
        const voice = { lang: 'uk-UA', name: 'Ukrainian UA' };
        window.speechSynthesis.getVoices.mockReturnValue([voice]);
        expect(popup._getBestVoice('uk')).toBe(voice);
      });

      test('returns null when no voice matches the language', () => {
        const voice = { lang: 'en-US', name: 'English' };
        window.speechSynthesis.getVoices.mockReturnValue([voice]);
        expect(popup._getBestVoice('uk')).toBeNull();
      });

      test('returns null for empty langCode', () => {
        expect(popup._getBestVoice('')).toBeNull();
      });
    });

    describe('_close', () => {
      test('sets visible to false', () => {
        popup.visible = true;
        popup._close();
        expect(popup.visible).toBe(false);
      });

      test('calls speechSynthesis.cancel()', () => {
        popup._close();
        expect(window.speechSynthesis.cancel).toHaveBeenCalled();
      });

      test('dispatches br-dictionary-close event', () => {
        const listener = jest.fn();
        popup.addEventListener('br-dictionary-close', listener);
        popup._close();
        expect(listener).toHaveBeenCalledTimes(1);
      });
    });

    describe('_onSpeakTranslation', () => {
      test('does nothing when translation is empty', () => {
        popup.translation = '';
        popup._onSpeakTranslation();
        expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
      });

      test('does nothing when translation is the placeholder dash', () => {
        popup.translation = '—';
        popup._onSpeakTranslation();
        expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
      });

      test('cancels and stops when already speaking', () => {
        popup._speakingTranslation = true;
        popup._onSpeakTranslation();
        expect(window.speechSynthesis.cancel).toHaveBeenCalled();
        expect(popup._speakingTranslation).toBe(false);
        expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
      });

      test('calls speak and sets _speakingTranslation to true', () => {
        popup.translation = 'Привіт';
        popup.targetLang  = 'uk';
        popup._onSpeakTranslation();
        expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
        expect(popup._speakingTranslation).toBe(true);
      });

      test('sets utterance.lang from targetLang', () => {
        popup.translation = 'Привіт';
        popup.targetLang  = 'uk';
        popup._onSpeakTranslation();
        const utterance = global.SpeechSynthesisUtterance.mock.instances[0];
        expect(utterance.lang).toBe('uk');
      });

      test('assigns matching voice to utterance when found', () => {
        const voice = { lang: 'uk', name: 'Ukrainian' };
        window.speechSynthesis.getVoices.mockReturnValue([voice]);
        popup.translation = 'Привіт';
        popup.targetLang  = 'uk';
        popup._onSpeakTranslation();
        const utterance = global.SpeechSynthesisUtterance.mock.instances[0];
        expect(utterance.voice).toBe(voice);
      });
    });

    describe('_onLangChange', () => {
      test('updates targetLang from the select element value', () => {
        popup._onLangChange({ target: { value: 'de' } });
        expect(popup.targetLang).toBe('de');
      });

      test('dispatches br-dictionary-lang-change with correct detail', () => {
        const listener = jest.fn();
        popup.addEventListener('br-dictionary-lang-change', listener);
        popup._onLangChange({ target: { value: 'fr' } });
        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener.mock.calls[0][0].detail).toEqual({ targetLang: 'fr' });
      });
    });
  });