  import { DictionaryService } from '@/src/plugins/dictionary/DictionaryService.js';                                                                                                                        describe('DictionaryService', () => {
    let service;

    beforeEach(() => {
      service = new DictionaryService();
      global.fetch = jest.fn();
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    describe('detectLanguage', () => {
      test.each([
        ['Привіт світ',  'uk'],
        ['こんにちは',   'ja'],
        ['漢字テスト',   'ja'],
        ['hello world',  'en'],
        ['schöner Tag',  'de'],
        ['café au lait', 'fr'],
        ['niño bonito',  'es'],
        ['łódź polska',  'pl'],
        ['',             'en'],
      ])('detectLanguage(%s) → %s', async (text, expected) => {
        expect(await service.detectLanguage(text)).toBe(expected);
      });
    });

    describe('translate', () => {
      test('returns original text when sourceLang equals targetLang', async () => {
        const result = await service.translate('hello', 'en', 'en');
        expect(result).toBe('hello');
        expect(global.fetch).not.toHaveBeenCalled();
      });

      test('returns translation on successful response', async () => {
        global.fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ translation: 'Привіт' }),
        });
        expect(await service.translate('hello', 'en', 'uk')).toBe('Привіт');
      });

      test('throws on non-ok HTTP status', async () => {
        global.fetch.mockResolvedValue({ ok: false, status: 503 });
        await expect(service.translate('hello', 'en', 'uk')).rejects.toThrow('503');
      });

      test('throws when response has no translation field', async () => {
        global.fetch.mockResolvedValue({
          ok: true,
          json: async () => ({}),
        });
        await expect(service.translate('hello', 'en', 'uk')).rejects.toThrow();
      });

      test('URL-encodes the text in the request', async () => {
        global.fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ translation: 'result' }),
        });
        await service.translate('hello world', 'en', 'uk');
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('hello%20world'),
        );
      });
    });

    describe('getDefinition', () => {
      test('returns empty string when response is not ok', async () => {
        global.fetch.mockResolvedValue({ ok: false, status: 404 });
        expect(await service.getDefinition('unknownword')).toBe('');
      });

      test('returns empty string when response body is not an array', async () => {
        global.fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ title: 'No Definitions Found' }),
        });
        expect(await service.getDefinition('xyz')).toBe('');
      });

      test('returns empty string for empty array', async () => {
        global.fetch.mockResolvedValue({
          ok: true,
          json: async () => [],
        });
        expect(await service.getDefinition('xyz')).toBe('');
      });

      test('returns formatted definition with part of speech', async () => {
        global.fetch.mockResolvedValue({
          ok: true,
          json: async () => ([{
            meanings: [{
              partOfSpeech: 'noun',
              definitions: [{ definition: 'a common greeting' }],
            }],
          }]),
        });
        expect(await service.getDefinition('hello')).toBe('(noun) a common greeting');
      });

      test('appends example to definition when available', async () => {
        global.fetch.mockResolvedValue({
          ok: true,
          json: async () => ([{
            meanings: [{
              partOfSpeech: 'noun',
              definitions: [{ definition: 'a greeting', example: 'Say hello to her' }],
            }],
          }]),
        });
        expect(await service.getDefinition('hello')).toBe('(noun) a greeting — "Say hello to her"');
      });

      test('prefers noun over adjective by POS priority', async () => {
        global.fetch.mockResolvedValue({
          ok: true,
          json: async () => ([{
            meanings: [
              { partOfSpeech: 'adjective', definitions: [{ definition: 'easy to see' }] },
              { partOfSpeech: 'noun',      definitions: [{ definition: 'visible radiation' }] },
            ],
          }]),
        });
        expect(await service.getDefinition('light')).toBe('(noun) visible radiation');
      });

      test('lowercases the word in the API request', async () => {
        global.fetch.mockResolvedValue({
          ok: true,
          json: async () => ([{
            meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'def' }] }],
          }]),
        });
        await service.getDefinition('Hello');
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/hello'),
        );
      });
    });

    describe('getDefinitionInLanguage', () => {
      test('returns empty string when no definition is found', async () => {
        jest.spyOn(service, 'translate').mockResolvedValue('hello');
        jest.spyOn(service, 'getDefinition').mockResolvedValue('');
        expect(await service.getDefinitionInLanguage('привіт', 'uk', 'uk')).toBe('');
      });

      test('skips translate-to-en step when sourceLang is already en', async () => {
        const translateSpy = jest.spyOn(service, 'translate').mockResolvedValue('translated def');
        jest.spyOn(service, 'getDefinition').mockResolvedValue('(noun) greeting');
        await service.getDefinitionInLanguage('hello', 'en', 'uk');
        expect(translateSpy).toHaveBeenCalledTimes(1);
        expect(translateSpy).toHaveBeenCalledWith('(noun) greeting', 'en', 'uk');
      });

      test('translates word to English first when sourceLang is not en', async () => {
        const translateSpy = jest.spyOn(service, 'translate')
          .mockResolvedValueOnce('hello')
          .mockResolvedValueOnce('translated def');
        jest.spyOn(service, 'getDefinition').mockResolvedValue('(noun) greeting');
        await service.getDefinitionInLanguage('привіт', 'uk', 'uk');
        expect(translateSpy).toHaveBeenNthCalledWith(1, 'привіт', 'uk', 'en');
      });

      test('falls back to original word when translate-to-en fails', async () => {
        jest.spyOn(service, 'translate')
          .mockRejectedValueOnce(new Error('network error'))
          .mockResolvedValueOnce('translated def');
        const definitionSpy = jest.spyOn(service, 'getDefinition').mockResolvedValue('(noun) greeting');
        await service.getDefinitionInLanguage('привіт', 'uk', 'uk');
        expect(definitionSpy).toHaveBeenCalledWith('привіт');
      });

      test('returns English definition directly when targetLang is en', async () => {
        const translateSpy = jest.spyOn(service, 'translate').mockResolvedValue('hello');
        jest.spyOn(service, 'getDefinition').mockResolvedValue('(noun) greeting');
        const result = await service.getDefinitionInLanguage('привіт', 'uk', 'en');
        expect(result).toBe('(noun) greeting');
        expect(translateSpy).toHaveBeenCalledTimes(1);
      });

      test('falls back to English definition when definition translation fails', async () => {
        jest.spyOn(service, 'translate')
          .mockResolvedValueOnce('hello')
          .mockRejectedValueOnce(new Error('translate error'));
        jest.spyOn(service, 'getDefinition').mockResolvedValue('(noun) greeting');
        const result = await service.getDefinitionInLanguage('привіт', 'uk', 'uk');
        expect(result).toBe('(noun) greeting');
      });
    });
  });