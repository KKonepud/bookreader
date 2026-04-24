# Плагін «Словник» для BookReader

Плагін дозволяє читачам двічі клікнути на будь-яке слово в текстовому шарі BookReader і отримати його переклад та визначення у спливаючому вікні.

## Зміст

- [Огляд функціональності](#огляд-функціональності)
- [Архітектура](#архітектура)
- [Файли проєкту](#файли-проєкту)
- [Детальний опис модулів](#детальний-опис-модулів)
  - [DictionaryService](#dictionaryservice)
  - [DictionaryPopup](#dictionarypopup)
  - [DictionaryPlugin](#dictionaryplugin)
- [Підтримувані мови](#підтримувані-мови)
- [Зовнішні API](#зовнішні-api)
- [Тести](#тести)
- [Запуск тестів](#запуск-тестів)

## Огляд функціональності

- **Подвійний клік на слові** — відкривається попап із перекладом і визначенням.
- **Виділення фрази мишею** — те саме для кількох слів.
- **Вибір мови** у списку всередині попапу або в тулбарі BookReader — переклад і визначення оновлюються одразу. Вибрана мова зберігається в `localStorage` між сесіями.
- **Кнопка 🎙️** — озвучення перекладу через Web Speech API. Повторний клік зупиняє.
- **Escape / клік на підложку / кнопка ✕** — три способи закрити попап.

## Архітектура

```
DictionaryPlugin          (підклас BookReaderPlugin — події, попап, localStorage)
    │
    ├── DictionaryService (без стану, чисто async — мова, переклад, визначення)
    │       ├── detectLanguage()
    │       ├── translate()
    │       ├── getDefinition()
    │       └── getDefinitionInLanguage()
    │
    └── DictionaryPopup   (LitElement — тільки рендер і кастомні події)
```

Plugin обробляє всі події, працює з DOM і координує інші компоненти. Service — чисті асинхронні функції без DOM. Popup — «тупий» компонент, рендерить пропси й випускає події.

## Файли проєкту

| Шлях | Призначення |
|------|-------------|
| `src/plugins/dictionary/plugin.dictionary.js` | Точка входу: реєстрація в BookReader, прив'язка подій, керування попапом |
| `src/plugins/dictionary/DictionaryService.js` | Виявлення мови, переклад, пошук у словнику |
| `src/plugins/dictionary/DictionaryPopup.js` | LitElement-компонент `<br-dictionary-popup>` |
| `src/css/_BRdictionary.scss` | Стилі попапу та тулбару |

## Детальний опис модулів

### DictionaryService

Безстановий клас, усі методи повертають `Promise`.

**`detectLanguage(text)`** визначає мову через Unicode-евристику — без мережевого запиту, миттєво. Кирилиця → `uk`, японські символи → `ja`, далі рахуються мово-специфічні діакритики: `äöüß` → `de`, `àâçéèêë…` → `fr`, `áéíóúñ` → `es`, `ąćęłńśźż` → `pl`. Чиста латиниця — `en`.

**`translate(text, sourceLang, targetLang)`** перекладає через Lingva Translate. Якщо мови збігаються — повертає оригінал без запиту. Кидає `Error` при HTTP-помилці.

**`getDefinition(word)`** отримує англійське визначення з Free Dictionary API у форматі `(part of speech) definition — "example"`. При помилці або невідомому слові повертає `''`. Пріоритет при виборі значення: noun → verb → adjective → adverb → ...

**`getDefinitionInLanguage(word, sourceLang, targetLang)`** оркеструє повний ланцюжок:
1. Якщо слово не англійське — перекладає його в англійський для пошуку у словнику.
2. Шукає визначення через `getDefinition`.
3. Якщо `targetLang ≠ 'en'` — перекладає визначення в цільову мову.
4. Якщо переклад визначення не вдався — повертає англійський варіант як резерв.

### DictionaryPopup

LitElement веб-компонент `<br-dictionary-popup>`. Рендер без Shadow DOM (`createRenderRoot` повертає `this`), тому стилі з `_BRdictionary.scss` застосовуються напряму.

Реактивні властивості: `word`, `visible`, `x`, `y`, `detectedLang`, `targetLang`, `translation`, `definition`, `loading`.

**`_close()`** — скасовує мовлення, ховає попап, знімає виділення тексту, випускає `br-dictionary-close`.

**`_onLangChange(e)`** — зчитує значення з `<select>`, випускає `br-dictionary-lang-change` з `{ detail: { targetLang } }`.

**`_onSpeakTranslation()`** — озвучує `translation` через `SpeechSynthesisUtterance`. Повторний клік зупиняє. Голос підбирається через `_getBestVoice`: спочатку точний збіг (`uk`), потім префіксний (`uk-UA`).

Структура DOM:

```
<br-dictionary-popup>
  <div class="br-dictionary-popup__backdrop">
  <div class="br-dictionary-popup" role="dialog">
    <button class="br-dictionary-popup__close-x">
    <div class="br-dictionary-popup__inner">
      виявлена мова · вибір мови (<select>) · оригінальне слово
      [loading]  .br-dictionary-popup__loading   — спінер
      [content]  .br-dictionary-popup__scroll    — переклад + 🎙️ + визначення
```

### DictionaryPlugin

Підклас `BookReaderPlugin`, реєструється як `"dictionary"`.

**`init()`** — створює `DictionaryService` і попап, вішає глобальні обробники подій.

**`_configureToolbar($toolbar)`** — додає `<select>` з мовами в тулбар. Відновлює мову з `localStorage`.

**`_showPopup(word, rect)`** — позиціонує попап відносно вікна (якщо знизу немає місця — відображає вище слова), одразу ставить `loading = true`, паралельно запитує переклад і визначення.

**`_retranslate(targetLang)`** — повторний переклад без повторного виявлення мови, викликається при зміні мови.

**`_onDocumentDblClick`** — спрацьовує на `.BRwordElement`, надає перевагу виділеному тексту браузера над текстом елемента.

**`_onDocumentMouseUp`** — обробляє drag-selection у `.BRtextLayer`; пропускає одиночні слова, бо їх вже закриває `dblclick`.

**`_onDocumentPointerDown`** — закриває попап при кліку поза ним, з підтримкою Shadow DOM через `composedPath()`.

**`_onKeyDown`** — Escape закриває попап і скасовує мовлення.

## Підтримувані мови

`uk` Українська (за замовчуванням) · `en` English · `de` Deutsch · `fr` Français · `es` Español · `pl` Polski · `ja` 日本語

## Зовнішні API

**Lingva Translate** — відкритий фронтенд Google Translate, API-ключ не потрібен.

```
GET https://lingva.ml/api/v1/{sourceLang}/{targetLang}/{encodedText}
→ { "translation": "..." }
```

Використовується для перекладу слова, перекладу визначення і перекладу не-англійських слів в англійський для словникового пошуку.

**Free Dictionary API** — покриває лише англійські слова. При помилці повертає `''`, не кидає виключення.

```
GET https://api.dictionaryapi.dev/api/v2/entries/en/{word}
→ [{ "meanings": [{ "partOfSpeech": "noun", "definitions": [{ "definition": "..." }] }] }]
```

## Тести


| Файл | Тип | Що перевіряється |
|------|-----|------------------|
| `DictionaryService.test.js` | Юніт | Усі методи сервісу: евристика мови, переклад, визначення, повна оркестрація, обробка помилок, shortcut при однаковій мові |
| `DictionaryPlugin.test.js` | Юніт | `_showPopup` (loading, успіх, помилка), `_retranslate` (без слова/мови, успіх, помилка), `_onDocumentDblClick`, `_onDocumentPointerDown`, `_onKeyDown` |
| `DictionaryPopup.test.js` | Юніт | `_getBestVoice` (точний/префіксний збіг, не знайдено), `_close`, `_onSpeakTranslation` (старт, стоп, порожній текст), `_onLangChange` |
| `DictionaryPopup.render.test.js` | Компонент | LitElement рендеринг: попап прихований при `visible=false`, переклад і визначення в DOM, спінер при `loading=true` |
| `dictionary.integration.test.js` | Інтеграційний | Plugin + реальний Service з мокованим `fetch`: повний ланцюжок, помилка API, резервне визначення, та-сама-мова, `_retranslate` |
| `tests/e2e/dictionary.test.js` | E2E (TestCafe) | Реальний браузер: попап після дабл-кліку, спінер → контент, закриття трьома способами, список мов, зміна мови, кнопка озвучення |

## Запуск тестів

Усі Jest-набори для словника одразу:

```bash
npx jest tests/jest/plugins/dictionary/ --verbose
```

Окремий файл, наприклад:

```bash
npx jest tests/jest/plugins/dictionary/DictionaryService.test.js --verbose
```

> Не запускати `npm test` — паралельне виконання всіх наборів може вичерпати хіп Node.js.

E2E потребує локального сервера на порту 8000 і доступу до інтернету:

```bash
npm run serve                                          # в окремому терміналі
npx testcafe chrome tests/e2e/dictionary.test.js
```
