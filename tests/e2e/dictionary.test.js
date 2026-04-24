import { Selector, ClientFunction } from 'testcafe';

/**
 * E2E tests for the dictionary plugin.
 * Requires internet access — the page loads book data from archive.org.
 * Run with: npx testcafe chrome tests/e2e/dictionary.test.js
 */
fixture`Dictionary plugin`
  .page`http://localhost:8000/BookReaderDemo/demo-internetarchive.html?ocaid=theworksofplato01platiala`
  .skipJsErrors(true);

const popup      = Selector('.br-dictionary-popup');
const backdrop   = Selector('.br-dictionary-popup__backdrop');
const closeBtn   = Selector('.br-dictionary-popup__close-x');
const loadingEl  = Selector('.br-dictionary-popup__loading');
const scrollArea = Selector('.br-dictionary-popup__scroll');
const langSelect = Selector('#br-dict-lang');
const speakBtn   = Selector('.br-dictionary-popup__mic-stub');
const firstWord  = Selector('.BRwordElement').nth(0);

// Dispatches dblclick directly via JS, bypassing TestCafe's element interaction
const dblClickFirstWord = ClientFunction(() => {
  const el = document.querySelector('.BRwordElement');
  if (!el) return false;
  el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
  return true;
});

test('popup appears after double-clicking a word', async t => {
  await t.expect(firstWord.exists).ok({ timeout: 15000 });
  await dblClickFirstWord();
  await t.expect(popup.visible).ok({ timeout: 5000 });
});

test('popup shows loading spinner then switches to content', async t => {
  await t.expect(firstWord.exists).ok({ timeout: 15000 });
  await dblClickFirstWord();

  const isLoading = await loadingEl.visible;
  if (isLoading) {
    await t.expect(scrollArea.visible).ok({ timeout: 10000 });
  } else {
    await t.expect(scrollArea.visible).ok();
  }
});

test('close button hides the popup', async t => {
  await t.expect(firstWord.exists).ok({ timeout: 15000 });
  await dblClickFirstWord();
  await t
    .expect(popup.visible).ok({ timeout: 5000 })
    .click(closeBtn)
    .expect(popup.exists).notOk();
});

test('clicking the backdrop hides the popup', async t => {
  await t.expect(firstWord.exists).ok({ timeout: 15000 });
  await dblClickFirstWord();
  await t
    .expect(popup.visible).ok({ timeout: 5000 })
    .click(backdrop)
    .expect(popup.exists).notOk();
});

test('pressing Escape hides the popup', async t => {
  await t.expect(firstWord.exists).ok({ timeout: 15000 });
  await dblClickFirstWord();
  await t
    .expect(popup.visible).ok({ timeout: 5000 })
    .pressKey('esc')
    .expect(popup.exists).notOk();
});

test('language selector contains all supported languages', async t => {
  await t.expect(firstWord.exists).ok({ timeout: 15000 });
  await dblClickFirstWord();
  await t.expect(popup.visible).ok({ timeout: 5000 });

  const count = await langSelect.find('option').count;
  await t.expect(count).gte(7);
});

test('changing language triggers content reload', async t => {
  await t.expect(firstWord.exists).ok({ timeout: 15000 });
  await dblClickFirstWord();
  await t
    .expect(popup.visible).ok({ timeout: 5000 })
    .expect(scrollArea.visible).ok({ timeout: 10000 })
    .click(langSelect)
    .click(langSelect.find('option').withAttribute('value', 'en'))
    .expect(scrollArea.visible).ok({ timeout: 10000 });
});

test('speak button is present after content loads', async t => {
  await t.expect(firstWord.exists).ok({ timeout: 15000 });
  await dblClickFirstWord();
  await t
    .expect(popup.visible).ok({ timeout: 5000 })
    .expect(scrollArea.visible).ok({ timeout: 10000 })
    .expect(speakBtn.visible).ok();
});

test('popup does not appear when clicking outside the text layer', async t => {
  await t
    .click(Selector('body'), { offsetX: 10, offsetY: 10 })
    .expect(popup.exists).notOk();
});
