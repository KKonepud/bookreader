  import { DictionaryPlugin } from '@/src/plugins/dictionary/plugin.dictionary.js';                     
  function makeMockPopup() {                                                                             return {      
      visible: false,
      word: '',
      x: 0,
      y: 0,
      detectedLang: '',
      targetLang: 'uk',
      translation: '',
      definition: '',
      loading: false,
      contains: jest.fn().mockReturnValue(false),
      addEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    };
  }

  function makeMockService(overrides = {}) {
    return {
      detectLanguage:          jest.fn().mockResolvedValue('en'),
      translate:               jest.fn().mockResolvedValue('translated'),
      getDefinitionInLanguage: jest.fn().mockResolvedValue('(noun) definition'),
      ...overrides,
    };
  }

  function makePlugin() {
    const plugin = new DictionaryPlugin(null);
    plugin._popup = makeMockPopup();
    plugin.dictionaryService = makeMockService();
    return plugin;
  }

  const FAKE_RECT = { left: 200, right: 300, top: 400, bottom: 420 };

  describe('DictionaryPlugin', () => {
    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      window.speechSynthesis = { cancel: jest.fn(), speak: jest.fn() };
      Object.defineProperty(window, 'innerWidth',  { value: 1024, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 768,  configurable: true });
    });

    afterEach(() => {
      document.body.innerHTML = '';
      delete window.speechSynthesis;
      jest.restoreAllMocks();
    });

    describe('_showPopup', () => {
      test('sets loading and visible immediately before awaiting service calls', async () => {
        const plugin = makePlugin();
        let resolveDetect;
        plugin.dictionaryService.detectLanguage = jest.fn(
          () => new Promise(r => { resolveDetect = r; }),
        );

        const promise = plugin._showPopup('hello', FAKE_RECT);
        expect(plugin._popup.loading).toBe(true);
        expect(plugin._popup.visible).toBe(true);

        resolveDetect('en');
        await promise;
      });

      test('fills translation and definition after successful service calls', async () => {
        const plugin = makePlugin();
        await plugin._showPopup('hello', FAKE_RECT);
        expect(plugin._popup.translation).toBe('translated');
        expect(plugin._popup.definition).toBe('(noun) definition');
      });

      test('sets loading to false after success', async () => {
        const plugin = makePlugin();
        await plugin._showPopup('hello', FAKE_RECT);
        expect(plugin._popup.loading).toBe(false);
      });

      test('sets error translation and clears loading when service throws', async () => {
        const plugin = makePlugin();
        plugin.dictionaryService.detectLanguage = jest.fn().mockRejectedValue(new Error('net'));
        await plugin._showPopup('hello', FAKE_RECT);
        expect(plugin._popup.translation).toBe('⚠ Помилка перекладу');
        expect(plugin._popup.loading).toBe(false);
      });

      test('stores detected language on the popup', async () => {
        const plugin = makePlugin();
        plugin.dictionaryService.detectLanguage = jest.fn().mockResolvedValue('de');
        await plugin._showPopup('schön', FAKE_RECT);
        expect(plugin._popup.detectedLang).toBe('de');
      });
    });

    describe('_retranslate', () => {
      test('does nothing when popup has no word', async () => {
        const plugin = makePlugin();
        plugin._popup.word = '';
        plugin._popup.detectedLang = 'en';
        await plugin._retranslate('de');
        expect(plugin.dictionaryService.translate).not.toHaveBeenCalled();
      });

      test('does nothing when detectedLang is missing', async () => {
        const plugin = makePlugin();
        plugin._popup.word = 'hello';
        plugin._popup.detectedLang = '';
        await plugin._retranslate('de');
        expect(plugin.dictionaryService.translate).not.toHaveBeenCalled();
      });

      test('updates translation and definition after successful re-translation', async () => {
        const plugin = makePlugin();
        plugin._popup.word = 'hello';
        plugin._popup.detectedLang = 'en';
        plugin.dictionaryService.translate               = jest.fn().mockResolvedValue('Hallo');
        plugin.dictionaryService.getDefinitionInLanguage = jest.fn().mockResolvedValue('(Nomen) Begrüßung');
        await plugin._retranslate('de');
        expect(plugin._popup.translation).toBe('Hallo');
        expect(plugin._popup.definition).toBe('(Nomen) Begrüßung');
        expect(plugin._popup.loading).toBe(false);
      });

      test('sets error translation and clears loading when re-translation throws', async () => {
        const plugin = makePlugin();
        plugin._popup.word = 'hello';
        plugin._popup.detectedLang = 'en';
        plugin.dictionaryService.translate = jest.fn().mockRejectedValue(new Error('fail'));
        await plugin._retranslate('de');
        expect(plugin._popup.translation).toBe('⚠ Помилка перекладу');
        expect(plugin._popup.loading).toBe(false);
      });
    });

    describe('_onDocumentDblClick', () => {
      test('does nothing when target is not inside .BRwordElement', () => {
        const plugin = makePlugin();
        const showSpy = jest.spyOn(plugin, '_showPopup').mockResolvedValue(undefined);
        const div = document.createElement('div');
        document.body.appendChild(div);
        plugin._onDocumentDblClick({ target: div });
        expect(showSpy).not.toHaveBeenCalled();
      });

      test('calls _showPopup with element text on .BRwordElement', () => {
        const plugin = makePlugin();
        const showSpy = jest.spyOn(plugin, '_showPopup').mockResolvedValue(undefined);
        window.getSelection = jest.fn().mockReturnValue(null);

        const wordEl = document.createElement('span');
        wordEl.className = 'BRwordElement';
        wordEl.textContent = 'library';
        document.body.appendChild(wordEl);

        plugin._onDocumentDblClick({ target: wordEl });
        expect(showSpy).toHaveBeenCalledWith('library', expect.any(Object));
      });

      test('prefers browser selection text over element text', () => {
        const plugin = makePlugin();
        const showSpy = jest.spyOn(plugin, '_showPopup').mockResolvedValue(undefined);
        const range = { getBoundingClientRect: () => FAKE_RECT };
        window.getSelection = jest.fn().mockReturnValue({
          isCollapsed: false,
          toString: () => 'selected phrase',
          rangeCount: 1,
          getRangeAt: () => range,
        });

        const wordEl = document.createElement('span');
        wordEl.className = 'BRwordElement';
        wordEl.textContent = 'library';
        document.body.appendChild(wordEl);

        plugin._onDocumentDblClick({ target: wordEl });
        expect(showSpy).toHaveBeenCalledWith('selected phrase', expect.any(Object));
      });
    });

    describe('_onDocumentPointerDown', () => {
      test('does nothing when popup is not visible', () => {
        const plugin = makePlugin();
        plugin._popup.visible = false;
        plugin._onDocumentPointerDown({ target: document.body, composedPath: () => [] });
        expect(plugin._popup.visible).toBe(false);
      });

      test('hides popup when clicking outside it', () => {
        const plugin = makePlugin();
        plugin._popup.visible = true;
        plugin._popup.contains.mockReturnValue(false);
        const outsideEl = document.createElement('div');
        plugin._onDocumentPointerDown({
          target: outsideEl,
          composedPath: () => [outsideEl],
        });
        expect(plugin._popup.visible).toBe(false);
      });

      test('keeps popup open when clicking inside it', () => {
        const plugin = makePlugin();
        plugin._popup.visible = true;
        plugin._popup.contains.mockReturnValue(true);
        plugin._onDocumentPointerDown({
          target: document.body,
          composedPath: () => [],
        });
        expect(plugin._popup.visible).toBe(true);
      });
    });

    describe('_onKeyDown', () => {
      test('hides popup and cancels speech on Escape', () => {
        const plugin = makePlugin();
        plugin._popup.visible = true;
        plugin._onKeyDown({ key: 'Escape' });
        expect(plugin._popup.visible).toBe(false);
        expect(window.speechSynthesis.cancel).toHaveBeenCalled();
      });

      test('ignores keys other than Escape', () => {
        const plugin = makePlugin();
        plugin._popup.visible = true;
        plugin._onKeyDown({ key: 'Enter' });
        expect(plugin._popup.visible).toBe(true);
      });
    });
  });