  import { DictionaryPlugin } from '@/src/plugins/dictionary/plugin.dictionary.js';                    import { DictionaryService } from '@/src/plugins/dictionary/DictionaryService.js';
                                                                                                       const FAKE_RECT = { left: 100, right: 200, top: 300, bottom: 320 };

  function makePlugin() {
    const plugin = new DictionaryPlugin(null);
    plugin.dictionaryService = new DictionaryService();
    plugin._popup = {
      visible: false, word: '', x: 0, y: 0,
      detectedLang: '', targetLang: 'uk',
      translation: '', definition: '', loading: false,
      contains: jest.fn().mockReturnValue(false),
      addEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    };
    return plugin;
  }

  beforeEach(() => {
    global.fetch = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    window.speechSynthesis = { cancel: jest.fn(), speak: jest.fn() };
    Object.defineProperty(window, 'innerWidth',  { value: 1024, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768,  configurable: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete window.speechSynthesis;
  });

  describe('DictionaryPlugin + DictionaryService integration', () => {
    test('English word: popup gets translation and definition', async () => {
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ translation: 'привіт' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ([{
            meanings: [{
              partOfSpeech: 'exclamation',
              definitions: [{ definition: 'used as a greeting' }],
            }],
          }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ translation: 'використовується як вітання' }),
        });

      const plugin = makePlugin();
      await plugin._showPopup('hello', FAKE_RECT);

      expect(plugin._popup.visible).toBe(true);
      expect(plugin._popup.detectedLang).toBe('en');
      expect(plugin._popup.translation).toBe('привіт');
      expect(plugin._popup.definition).toBe('використовується як вітання');
      expect(plugin._popup.loading).toBe(false);
    });

    test('shows error message when Lingva is unreachable', async () => {
      global.fetch.mockResolvedValue({ ok: false, status: 503 });

      const plugin = makePlugin();
      await plugin._showPopup('hello', FAKE_RECT);

      expect(plugin._popup.translation).toBe('⚠ Помилка перекладу');
      expect(plugin._popup.loading).toBe(false);
    });

    test('keeps English definition as fallback when definition translation fails', async () => {
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ translation: 'привіт' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ([{
            meanings: [{
              partOfSpeech: 'noun',
              definitions: [{ definition: 'a greeting' }],
            }],
          }]),
        })
        .mockResolvedValueOnce({ ok: false, status: 503 });

      const plugin = makePlugin();
      await plugin._showPopup('hello', FAKE_RECT);

      expect(plugin._popup.definition).toBe('(noun) a greeting');
      expect(plugin._popup.loading).toBe(false);
    });

    test('same-language word is not sent to Lingva', async () => {
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ translation: 'hello' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ([{
            meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'a greeting' }] }],
          }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ translation: 'вітання' }),
        });

      const plugin = makePlugin();
      plugin._popup.targetLang = 'uk';
      await plugin._showPopup('привіт', FAKE_RECT);

      expect(plugin._popup.translation).toBe('привіт');
      expect(plugin._popup.loading).toBe(false);
    });

    test('language change via _retranslate updates popup with new data', async () => {
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ translation: 'Hallo' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ([{
            meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'a greeting' }] }],
          }]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ translation: 'eine Begrüßung' }),
        });

      const plugin = makePlugin();
      plugin._popup.word = 'hello';
      plugin._popup.detectedLang = 'en';
      plugin._popup.targetLang   = 'de';

      await plugin._retranslate('de');

      expect(plugin._popup.translation).toBe('Hallo');
      expect(plugin._popup.definition).toBe('eine Begrüßung');
    });
  });