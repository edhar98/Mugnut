// Languages: the string tables agree with each other, the picker works, and every screen holds up in Armenian and Russian.
const path = require("path");
const { test, expect, watchErrors, stubSharing, lastCopied, answerCurrent } = require("./helpers");

const PHOTO = path.join(__dirname, "fixtures", "photo.jpg");
const OTHERS = ["hy", "ru"];
// Translated names may run a little longer than the English data allows itself; the layout is checked at 360 px below.
const LIMIT = { name: 28, sub: 40, ex: 140 };
const SAMPLE = {   // a string that only exists in that language, per screen
  hy: { daily: "Օրվա առարկան", journey: "Ճամփորդություն", easy: "Հեշտ", sphere: "Սֆերա", copied: "Հղումը պատճենվեց. տեղադրիր ցանկացած զրույցում։" },
  ru: { daily: "Предмет дня", journey: "Путешествие", easy: "Лёгкий", sphere: "Сфера", copied: "Ссылка скопирована — вставь её в любой чат." },
};
const useLang = (context, lang) => context.addInitScript(l => { try { if (!localStorage.getItem("mugnut:lang")) localStorage.setItem("mugnut:lang", JSON.stringify(l)); } catch (e) {} }, lang);
const loadAll = page => page.evaluate(() => Promise.all([loadLang("hy"), loadLang("ru")]));

test.describe("string tables", () => {
  test("every English key exists in Armenian and Russian, with the same placeholders and the plural forms each language needs", async ({ page }) => {
    await page.goto("./");
    expect(await loadAll(page)).toEqual([true, true]);
    const problems = await page.evaluate(langs => {
      const out = [];
      const holders = v => [...new Set((typeof v === "string" ? v : Object.values(v).join(" ")).match(/\{\w+\}/g) || [])].sort().join(" ");
      const cats = l => new Intl.PluralRules(l).resolvedOptions().pluralCategories;
      for (const [k, v] of Object.entries(STR)) {
        if (!/^[a-z][A-Za-z]*(\.[A-Za-z0-9]+)+$/.test(k)) out.push(`en: odd key ${k}`);
        if (typeof v === "object") for (const c of cats("en")) if (typeof v[c] !== "string") out.push(`en: ${k} lacks plural form "${c}"`);
      }
      for (const l of langs) {
        const ui = I18N[l].ui;
        for (const [k, v] of Object.entries(STR)) {
          if (!Object.prototype.hasOwnProperty.call(ui, k)) { out.push(`${l}: missing ${k}`); continue; }
          const w = ui[k];
          if (typeof w !== typeof v) { out.push(`${l}: ${k} should be ${typeof v === "object" ? "a plural object" : "a string"}`); continue; }
          if (typeof w === "string" && !w.trim()) out.push(`${l}: ${k} is empty`);
          if (typeof w === "object") for (const c of cats(l)) if (typeof w[c] !== "string" || !w[c].trim()) out.push(`${l}: ${k} lacks plural form "${c}"`);
          if (holders(v) !== holders(w)) out.push(`${l}: ${k} placeholders differ: "${holders(v)}" vs "${holders(w)}"`);
          // markup is only allowed where English has it (the keys used with data-t-html)
          if (/[<>]/.test(JSON.stringify(w)) !== /[<>]/.test(JSON.stringify(v))) out.push(`${l}: ${k} markup differs from English`);
          if (typeof w === "string" && w === v && /[A-Za-z]{3,}/.test(v.replace(/Mugnut|\{\w+\}/g, ""))) out.push(`${l}: ${k} is still English`);
        }
        // the only keys a language may add are names and descriptions for packs (packs are named in objects.js)
        for (const k of Object.keys(ui)) if (!Object.prototype.hasOwnProperty.call(STR, k) && !/^pack\.[a-z]+\.[nd]$/.test(k)) out.push(`${l}: extra key ${k}`);
      }
      return out;
    }, OTHERS);
    expect(problems).toEqual([]);
  });

  test("the English text in the markup is the English string table", async ({ page, request }) => {
    const html = await (await request.get("index.html")).text();
    await page.goto("./");
    const problems = await page.evaluate(src => {
      const doc = new DOMParser().parseFromString(src, "text/html"), out = [];
      const eq = (attr, read) => doc.querySelectorAll(`[${attr}]`).forEach(e => { const k = e.getAttribute(attr); if (typeof STR[k] !== "string") out.push(`${attr}="${k}": no such string`); else if (read(e) !== STR[k]) out.push(`${attr}="${k}": markup says "${read(e)}"`); });
      eq("data-t", e => e.textContent); eq("data-t-html", e => e.innerHTML); eq("data-t-ph", e => e.getAttribute("placeholder")); eq("data-t-alt", e => e.getAttribute("alt"));
      if (!doc.querySelector("[data-t]")) out.push("no data-t elements found");
      return out;
    }, html);
    expect(problems).toEqual([]);
    // and filling it in changes nothing in English
    expect(await page.evaluate(() => { const before = document.querySelector(".wrap").innerHTML; applyI18n(); return before === document.querySelector(".wrap").innerHTML; })).toBe(true);
  });

  test("all 100 core objects are translated into Armenian and Russian, within the length limits", async ({ page }) => {
    await page.goto("./");
    await loadAll(page);
    const problems = await page.evaluate(([langs, LIMIT]) => {
      const out = [], core = OBJECTS.slice(0, 100), keys = new Set(core.map(o => `${o.name}|${o.sub || ""}`));
      const script = { hy: /[Ա-֏]/, ru: /[Ѐ-ӿ]/ };
      for (const l of langs) {
        const obj = I18N[l].obj;
        // pack objects are translated later and fall back to English until then: only the core is required here
        for (const o of core) {
          const k = `${o.name}|${o.sub || ""}`, x = obj[k];
          if (!x) { out.push(`${l}: no translation for ${k}`); continue; }
          for (const [f, en, max] of [["n", o.name, LIMIT.name], ["s", o.sub, LIMIT.sub], ["e", o.ex, LIMIT.ex]]) {
            if (!en) { if (x[f]) out.push(`${l}: ${k} has ${f} but English has none`); continue; }
            if (typeof x[f] !== "string" || !x[f].trim()) { out.push(`${l}: ${k} lacks ${f}`); continue; }
            if (x[f] === en) out.push(`${l}: ${k}.${f} is identical to English`);
            if (!script[l].test(x[f])) out.push(`${l}: ${k}.${f} has no ${l} letters`);
            if (x[f].length > max) out.push(`${l}: ${k}.${f} is ${x[f].length} characters (limit ${max})`);
            if (/[<>{}]/.test(x[f])) out.push(`${l}: ${k}.${f} contains markup or a placeholder`);
          }
        }
        for (const k of Object.keys(obj)) if (!keys.has(k) && !OBJECTS.some(o => `${o.name}|${o.sub || ""}` === k)) out.push(`${l}: translation for an unknown object ${k}`);
        // two different objects must not end up with the same name and qualifier
        const seen = new Map();
        for (const o of core) { const x = obj[`${o.name}|${o.sub || ""}`]; if (!x) continue; const t2 = `${x.n}|${x.s || ""}`; if (seen.has(t2)) out.push(`${l}: "${t2}" is used for both ${seen.get(t2)} and ${o.name}`); else seen.set(t2, o.name); }
      }
      return out;
    }, [OTHERS, LIMIT]);
    expect(problems).toEqual([]);
  });

  test("a missing key or object falls back to English, and plurals follow the language", async ({ page }) => {
    await page.goto("./");
    await page.locator("#langSel").selectOption("hy");
    await expect(page.locator("#journeyBtn h3")).toHaveText(SAMPLE.hy.journey);
    const r = await page.evaluate(() => {
      delete I18N.hy.ui["home.journey.h"]; delete I18N.hy.obj["Ball|"];
      applyI18n();
      const ball = OBJECTS[0];
      return { journey: document.querySelector("#journeyBtn h3").textContent, daily: document.querySelector("#dailyBtn h3").textContent,
        unknown: t("no.such.key"), withDefault: t("pack.nothing.n", null, "Fallback"), ball: [oName(ball), oEx(ball) === ball.ex],
        packObject: [oName({ name: "Whisk", sub: "balloon", ex: "Lots of loops." }), oSub({ name: "Whisk", sub: "balloon", ex: "x" }), oEx({ name: "Whisk", ex: "Lots of loops." })] };
    });
    expect(r.journey).toBe("Journey");
    expect(r.daily).toBe(SAMPLE.hy.daily);
    expect(r.unknown).toBe("no.such.key");
    expect(r.withDefault).toBe("Fallback");
    expect(r.ball).toEqual(["Ball", true]);
    expect(r.packObject).toEqual(["Whisk", "balloon", "Lots of loops."]);

    await page.locator("#langSel").selectOption("ru");
    await expect(page.locator("#journeyBtn h3")).toHaveText(SAMPLE.ru.journey);
    const ru = await page.evaluate(() => [1, 2, 5, 21, 22, 25, 111].map(n => t("pack.count", { n })));
    expect(ru).toEqual(["1 предмет", "2 предмета", "5 предметов", "21 предмет", "22 предмета", "25 предметов", "111 предметов"]);
    expect(await page.evaluate(() => { LANG = "en"; return [t("pack.count", { n: 1 }), t("pack.count", { n: 12 }), t("marks.openN", { n: 3, holes: t("marks.nHoles", { n: 2 }) }), t("marks.openN", { n: 2, holes: t("marks.nHoles", { n: 1 }) })]; }))
      .toEqual(["1 object", "12 objects", "3 openings into one space, which make 2 holes", "2 openings into one space, which make 1 hole"]);
  });

  test("text from players is inserted as text, and is never read as a placeholder", async ({ page }) => {
    await page.goto("./");
    await page.locator("#langSel").selectOption("ru");
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    const r = await page.evaluate(() => {
      openFriends();
      fNote(t("f.answered", { by: "<img src=x onerror=window.__pwned=1>", name: "{shape} {by}", shape: shapeLc(1), mark: "✓" }));
      return { text: document.getElementById("fNote").textContent, kids: document.getElementById("fNote").children.length, share: shareText({ from: "<b>Аня</b>", name: "{from}" }) };
    });
    expect(r.kids).toBe(0);
    expect(r.text).toBe("<img src=x onerror=window.__pwned=1> отвечает на «{shape} {by}»: тор ✓");
    expect(r.share).toBe("<b>Аня</b> бросает тебе вызов: что такое «{from}» с точки зрения топологии? 🍩");
    expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  });
});

test.describe("choosing a language", () => {
  test("the picker changes the text, sets <html lang>, and the choice survives a reload", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("./");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("#langSel")).toHaveValue("en");
    await expect(page.locator("#langSel option")).toHaveText(["English", "Հայերեն", "Русский"]);
    await expect(page.getByLabel("Language")).toHaveId("langSel");
    await expect(page.locator("#dailyBtn h3")).toHaveText("Today's object");

    for (const lang of OTHERS) {
      await page.locator("#langSel").selectOption(lang);
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      await expect(page.locator("#dailyBtn h3")).toHaveText(SAMPLE[lang].daily);
      await expect(page.locator('#levelBtns .lvbtn[data-lv="1"] b')).toHaveText(SAMPLE[lang].easy);
      await expect(page.locator("#home")).not.toContainText("Today's object");
      expect(await page.evaluate(() => localStorage.getItem("mugnut:lang"))).toBe(JSON.stringify(lang));
      expect(await page.title()).toBe("Mugnut — is it a donut?");
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      await expect(page.locator("#langSel")).toHaveValue(lang);
      await expect(page.locator("#dailyBtn h3")).toHaveText(SAMPLE[lang].daily);
      // the language file is fetched once, however often it is chosen
      expect(await page.evaluate(l => document.querySelectorAll(`script[src="lang/${l}.js"]`).length, lang)).toBe(1);
    }
    await page.locator("#langSel").selectOption("en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("#dailyBtn h3")).toHaveText("Today's object");
    await page.reload();
    await expect(page.locator("#dailyBtn h3")).toHaveText("Today's object");
    expect(errors).toEqual([]);
  });

  for (const [locale, lang] of [["hy-AM", "hy"], ["ru-RU", "ru"], ["ru", "ru"], ["de-DE", "en"], ["en-GB", "en"]]) {
    test.describe(`a ${locale} browser`, () => {
      test.use({ locale });
      test(`starts in ${lang} on the first visit`, async ({ page }) => {
        await page.goto("./");
        await expect(page.locator("html")).toHaveAttribute("lang", lang);
        await expect(page.locator("#langSel")).toHaveValue(lang);
        await expect(page.locator("#dailyBtn h3")).toHaveText(lang === "en" ? "Today's object" : SAMPLE[lang].daily);
        expect(await page.evaluate(() => localStorage.getItem("mugnut:lang"))).toBeNull();   // nothing is stored until the player chooses
      });
    });
  }

  test.describe("a stored choice", () => {
    test.use({ locale: "ru-RU" });
    test("wins over the browser language", async ({ page, context }) => {
      await useLang(context, "en");
      await page.goto("./");
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await expect(page.locator("#dailyBtn h3")).toHaveText("Today's object");
    });
  });

  for (const bad of ['"xx"', '"constructor"', '"__proto__"', '"HY"', "{not json", '["hy"]', "7", '"../x"']) {
    test(`an invalid stored language (${bad}) falls back to English`, async ({ page, context }) => {
      const errors = watchErrors(page);
      const requests = [];
      page.on("request", r => { if (/\/lang\//.test(r.url())) requests.push(r.url()); });
      await context.addInitScript(v => { try { localStorage.setItem("mugnut:lang", v); } catch (e) {} }, bad);
      await page.goto("./");
      await expect(page.locator("#home")).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await expect(page.locator("#langSel")).toHaveValue("en");
      await expect(page.locator("#dailyBtn h3")).toHaveText("Today's object");
      expect(requests).toEqual([]);
      expect(errors).toEqual([]);
    });
  }

  test("a language file that cannot be loaded leaves the game in English", async ({ page, context }) => {
    await context.route(/\/lang\/ru\.js/, r => r.abort());
    await page.goto("./");
    await page.locator("#langSel").selectOption("ru");
    await expect(page.locator("#langSel")).toHaveValue("en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("#dailyBtn h3")).toHaveText("Today's object");
    // also at startup, with the choice already stored
    await page.reload();
    await expect(page.locator("#home")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await page.locator('#levelBtns .lvbtn[data-lv="1"]').click();
    await expect(page.locator("#lvChip")).toHaveText("Easy");
    // once it can be loaded again the stored choice applies
    await context.unroute(/\/lang\/ru\.js/);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  });

  test("a slow language file: the game starts in English and switches when the file arrives", async ({ page, context }) => {
    let release; const gate = new Promise(r => { release = r; });
    await context.route(/\/lang\/hy\.js/, async r => { await gate; await r.continue(); });
    await useLang(context, "hy");
    await page.clock.install();
    await page.goto("./", { waitUntil: "commit" });   // the pending script holds back the load event
    await expect(page.locator("#langSel")).toBeAttached();
    await expect(page.locator("#home")).toBeHidden();
    await page.clock.runFor(3100);
    await expect(page.locator("#home")).toBeVisible();
    await expect(page.locator("#dailyBtn h3")).toHaveText("Today's object");
    release();
    await expect(page.locator("#dailyBtn h3")).toHaveText(SAMPLE.hy.daily);
    await expect(page.locator('#levelBtns .lvbtn[data-lv="1"] b')).toHaveText(SAMPLE.hy.easy);
  });

  test("works from the file system in Armenian: the language file loads through a script tag", async ({ page }) => {
    const errors = [];
    page.on("pageerror", e => errors.push(String(e)));
    await page.goto("file://" + path.resolve(__dirname, "..", "index.html"));
    await expect(page.locator("#home")).toBeVisible();
    await page.locator("#langSel").selectOption("hy");
    await expect(page.locator("html")).toHaveAttribute("lang", "hy");
    await expect(page.locator("#dailyBtn h3")).toHaveText(SAMPLE.hy.daily);
    await page.locator('#levelBtns .lvbtn[data-lv="1"]').click();
    await expect(page.locator("#lvChip")).toHaveText(SAMPLE.hy.easy);
    await expect(page.locator('#opts .opt[data-g="0"]')).toContainText(SAMPLE.hy.sphere);
    await expect(page.locator("#name")).toHaveText(/[Ա-֏]/);
    await answerCurrent(page, true);
    await expect(page.locator("#fbTitle")).toHaveText(/^Ճի՛շտ է/);
    expect(errors).toEqual([]);
  });
});

// ---- every screen, in each language, on a small phone ----
// Reports: sideways scrolling, text that does not fit its box, a raw key or an unfilled {placeholder}, and English left on screen.
const audit = (page, where) => page.evaluate(where => {
  const out = [], de = document.documentElement, keys = new Set(Object.keys(STR));
  if (de.scrollWidth > de.clientWidth) out.push(`${where}: the page scrolls sideways (${de.scrollWidth} > ${de.clientWidth})`);
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden"; };
  const raw = s => keys.has(s) || /\{\w*\}/.test(s);
  const w = document.createTreeWalker(document.querySelector(".wrap"), NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    const p = n.parentElement, s = n.textContent.trim();
    if (!s || !vis(p)) continue;
    if (raw(s)) out.push(`${where}: raw key or placeholder "${s}"`);
    // objects from packs are translated later and may still be English: the object's own text is not checked here
    if (LANG !== "en" && !p.closest("#name, #sub, #fbText, #review") && /[A-Za-z]{3,}/.test(s.replace(/Mugnut/g, ""))) out.push(`${where}: English left on screen: "${s}"`);
  }
  for (const e of document.querySelectorAll("[placeholder], [alt], [aria-label]")) for (const a of ["placeholder", "alt", "aria-label"]) { const v = e.getAttribute(a); if (v && vis(e) && raw(v)) out.push(`${where}: raw ${a} "${v}"`); }
  for (const e of document.querySelectorAll(".btn, .opt, .lvbtn, .mode, .tag, .chip, .link, .filebtn, .card, .note, .result, .fb, .arrow, .langrow, .top, h1, h2, h3, .name, .sub, .q, p, li, label, summary, select")) {
    if (!vis(e)) continue;
    const r = e.getBoundingClientRect(), what = `${e.id ? "#" + e.id : e.className || e.tagName} "${e.textContent.trim().slice(0, 30)}"`;
    if (r.left < -0.5 || r.right > de.clientWidth + 0.5) out.push(`${where}: ${what} sticks out of the screen (${Math.round(r.left)}..${Math.round(r.right)})`);
    if (getComputedStyle(e).display !== "inline" && !e.matches(".filebtn") && e.scrollWidth > e.clientWidth + 1) out.push(`${where}: ${what} is clipped (${e.scrollWidth} > ${e.clientWidth})`);
  }
  // the two sides of a header row must not run into each other
  for (const row of document.querySelectorAll(".mode .row, .top, .under, .ch .meta, .review li, .guesses li, .arrow")) {
    if (!vis(row) || row.children.length < 2) continue;
    const a = row.children[0].getBoundingClientRect(), b = row.children[row.children.length - 1].getBoundingClientRect();
    if (a.width && b.width && a.right > b.left + 0.5 && a.bottom > b.top + 0.5 && b.bottom > a.top + 0.5) out.push(`${where}: "${row.textContent.trim().slice(0, 40)}" overlaps`);
  }
  return out;
}, where);

for (const lang of OTHERS) {
  test.describe(`${lang} at 360×740`, () => {
    test.use({ viewport: { width: 360, height: 740 } });
    test.beforeEach(async ({ context, page }) => {
      await stubSharing(context);
      await useLang(context, lang);
      await page.clock.setFixedTime(new Date(Date.UTC(2026, 10, 20, 8)));   // day 11: ten days in the archive
    });
    const start = async page => {
      await page.goto("./");
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      await expect(page.locator("#home")).toBeVisible();
    };

    test("home, a full Easy round and the Journey interlude", async ({ page }) => {
      const errors = watchErrors(page), found = [];
      await start(page);
      found.push(...await audit(page, "home"));
      await page.locator("#home details summary").click();
      found.push(...await audit(page, "home, rules open"));

      await page.locator('#levelBtns .lvbtn[data-lv="1"]').click();
      await expect(page.locator("#lvChip")).toHaveText(SAMPLE[lang].easy);
      for (let i = 0; i < 10; i++) {
        await expect(page.locator("#num")).toHaveText(String(i + 1));
        if (i === 0) found.push(...await audit(page, "question"));
        await answerCurrent(page, i % 3 !== 0);   // some right, some wrong: both kinds of feedback, and a review list
        await expect(page.locator("#fbText")).not.toBeEmpty();
        found.push(...await audit(page, `feedback ${i + 1}`));
        await page.locator("#nextBtn").click();
      }
      await expect(page.locator("#end")).toBeVisible();
      await expect(page.locator("#final")).toHaveText("6/10");
      await expect(page.locator("#review li")).toHaveCount(4);
      found.push(...await audit(page, "level result"));
      await page.locator("#homeBtn").click();
      found.push(...await audit(page, "home with a best score"));

      await page.locator("#journeyBtn").click();
      await expect(page.locator("#interlude")).toBeVisible();
      found.push(...await audit(page, "interlude"));
      await page.locator("#ilGo").click();
      await answerCurrent(page, false); await page.locator("#nextBtn").click();
      await answerCurrent(page, false); await page.locator("#nextBtn").click();
      await answerCurrent(page, false);
      found.push(...await audit(page, "journey, out of lives"));
      await page.locator("#nextBtn").click();
      await expect(page.locator("#end")).toBeVisible();
      found.push(...await audit(page, "journey result"));
      expect(found).toEqual([]);
      expect(errors).toEqual([]);
    });

    test("every core object shows its name and explanation in this language, and fits", async ({ page }) => {
      const errors = watchErrors(page), found = [];
      await start(page);
      const script = lang === "hy" ? /[Ա-֏]/ : /[Ѐ-ӿ]/;
      for (let i = 0; i < 100; i++) {
        await page.evaluate(i => { G = { mode: "level", lv: OBJECTS[i].lv, deck: [OBJECTS[i]], idx: 0, score: 0, lives: null, missed: [], lastLv: OBJECTS[i].lv }; show("game"); renderQ(); answer((OBJECTS[i].g + 1) % 6); }, i);
        const shown = await page.evaluate(() => ({ name: document.getElementById("name").textContent, ex: document.getElementById("fbText").textContent, label: document.querySelector("#pic svg").getAttribute("aria-label") }));
        expect(shown.name, `object ${i}`).toMatch(script);
        expect(shown.ex, `object ${i}`).toMatch(script);
        expect(shown.label).toBe(shown.name);
        found.push(...await audit(page, `object ${i} (${shown.name})`));
      }
      expect(found).toEqual([]);
      expect(errors).toEqual([]);
    });

    test("today's object, the countdown and the archive", async ({ page }) => {
      const errors = watchErrors(page), found = [];
      await start(page);
      await page.locator("#dailyBtn").click();
      await answerCurrent(page, true);
      found.push(...await audit(page, "daily feedback"));
      await page.locator("#nextBtn").click();
      await expect(page.locator("#end")).toBeVisible();
      await expect(page.locator("#verdict")).toHaveText(lang === "hy" ? /^Օրերի շարք՝ 1։ Հաջորդ առարկան՝ \d+ ժ \d\d ր հետո։$/ : /^Серия дней: 1\. Следующий предмет через \d+ ч \d\d мин\.$/);
      found.push(...await audit(page, "daily result"));
      // sharing the result: the text is in the sender's language
      await page.locator("#againBtn").click();
      await expect(page.locator("#verdict")).toHaveText(lang === "hy" ? "Արդյունքը պատճենվեց. տեղադրիր ցանկացած զրույցում։" : "Результат скопирован — вставь его в любой чат.");
      expect(await lastCopied(page)).toMatch(lang === "hy" ? /^Mugnut #11 🍩 ✅ Գուշակեցի\nԱյսօրվա առարկան դոնա՞թ է։\nhttp/ : /^Mugnut №11 🍩 ✅ Угадано\nСегодняшний предмет — бублик\?\nhttp/);
      found.push(...await audit(page, "daily result, shared"));
      await page.locator("#homeBtn").click();
      await expect(page.locator("#dNext")).toHaveText(lang === "hy" ? /^Հաջորդ առարկան՝ \d+ ժ \d\d ր հետո։$/ : /^Следующий предмет через \d+ ч \d\d мин\.$/);
      found.push(...await audit(page, "home after the daily"));

      await page.locator("#archiveBtn").click();
      await expect(page.locator("#arList .arrow")).toHaveCount(10);
      found.push(...await audit(page, "archive"));
      await page.locator('#arList .arrow[data-num="10"]').click();
      await answerCurrent(page, false);
      found.push(...await audit(page, "archive feedback"));
      await page.locator("#nextBtn").click();
      await expect(page.locator("#endTitle")).toContainText(lang === "hy" ? "Առարկա #10 · " : "Предмет №10 · ");
      found.push(...await audit(page, "archive result"));
      await page.locator("#againBtn").click();
      await expect(page.locator("#archive")).toBeVisible();
      await expect(page.locator('#arList .arrow[data-num="10"] .st')).toHaveText("✗");
      await expect(page.locator("#arSummary")).toContainText(lang === "hy" ? "1/10" : "Сыграно 1 из 10");
      found.push(...await audit(page, "archive after playing"));
      expect(found).toEqual([]);
      expect(errors).toEqual([]);
    });

    test("friends hub, creating, sharing, playing and replying", async ({ page }) => {
      const errors = watchErrors(page), found = [];
      const me = lang === "hy" ? "Անի" : "Аня", thing = lang === "hy" ? "Իմ բանալիների օղակը" : "Мой брелок для ключей";
      await start(page);
      await page.locator("#friendsBtn").click();
      await expect(page.locator("#friends")).toBeVisible();
      found.push(...await audit(page, "friends, empty"));
      await page.locator("#friends details summary").click();
      await page.locator("#pasteIn").fill("nonsense"); await page.locator("#pasteBtn").click();
      await expect(page.locator("#fNote")).toBeVisible();
      found.push(...await audit(page, "friends, not a link"));
      await page.locator("#pasteIn").fill("#c=broken"); await page.locator("#pasteBtn").click();
      found.push(...await audit(page, "friends, broken link"));

      await page.locator("#newChBtn").click();
      await expect(page.locator("#create")).toBeVisible();
      found.push(...await audit(page, "create"));
      for (const step of [
        () => page.locator("#galIn").setInputFiles(PHOTO).then(() => expect(page.locator("#previewCard")).toBeVisible()),
        () => page.locator("#chName").fill(thing),
        () => page.locator('#chOpts .opt[data-g="1"]').click(),
        () => page.locator("#myName").fill(me),
      ]) {
        await page.locator("#postBtn").click();
        await expect(page.locator("#chErr")).not.toBeEmpty();   // each missing thing has its own message
        found.push(...await audit(page, "create, error"));
        await step();
      }
      await page.locator("#chNote").fill(lang === "hy" ? "Օղակը մեկ անցք է։" : "Кольцо — одна дырка.");
      found.push(...await audit(page, "create, filled in"));
      await page.locator("#postBtn").click();
      await expect(page.locator("#share")).toBeVisible();
      found.push(...await audit(page, "share"));
      await page.locator("#shCopy").click();
      await expect(page.locator("#shErr")).toHaveText(SAMPLE[lang].copied);
      const message = await lastCopied(page);
      expect(message.length).toBeLessThanOrEqual(1000);
      expect(message.split("\n")[0]).toBe(lang === "hy" ? `Քեզ մարտահրավեր է նետում ${me}. ի՞նչ է «${thing}» տոպոլոգիապես։ 🍩` : `${me} бросает тебе вызов: что такое «${thing}» с точки зрения топологии? 🍩`);
      found.push(...await audit(page, "share, copied"));
      await page.locator("#shShort").click();
      found.push(...await audit(page, "share, long link"));
      await page.locator("#shareBack").click();

      // challenges from friends: one waiting, one answered wrongly, and an answer to mine
      await page.evaluate(([friend, a, b]) => {
        const d = DB.load(), mine = Object.values(d.mine)[0];
        mine.guesses = [{ by: friend, guess: 1, at: 5 }, { by: friend + " 2", guess: 3, at: 6 }];
        d.received.w1 = { id: "w1", name: a, note: "", from: friend, g: 2, thumb: "", mime: "image/jpeg", createdAt: Date.now() - 864e5, openedAt: 2, guess: null };
        d.received.w2 = { id: "w2", name: b, note: "", from: friend, g: 5, thumb: "", mime: "image/jpeg", createdAt: Date.now() - 5 * 864e5, openedAt: 1, guess: 0 };
        DB.save(d); openFriends();
      }, lang === "hy" ? ["Արամ", "Մկրատ", "Հին ցանց"] : ["Арам", "Ножницы", "Старая сетка"]);
      await expect(page.locator("#feed .card")).toHaveCount(3);
      await expect(page.locator("#streakN")).toHaveText("1");
      found.push(...await audit(page, "friends, with challenges"));
      await page.locator("[data-del]").click();
      found.push(...await audit(page, "friends, delete armed"));

      await page.evaluate(() => openPlay("w1"));
      await expect(page.locator("#play")).toBeVisible();
      found.push(...await audit(page, "play"));
      await page.locator('#plOpts .opt[data-g="0"]').click();
      await expect(page.locator("#plFb")).toHaveClass(/bad/);
      found.push(...await audit(page, "play, wrong"));
      await page.locator("#plMyName").fill("");
      await page.locator("#plReply").click();
      found.push(...await audit(page, "play, name missing"));
      await page.locator("#plMyName").fill(me);
      await page.locator("#plReply").click();
      await expect(page.locator("#share")).toBeVisible();
      found.push(...await audit(page, "reply"));
      await page.locator("#shCopy").click();
      expect((await lastCopied(page)).split("\n")[0]).toBe(lang === "hy" ? "Իմ պատասխանը («Մկրատ»)՝ սֆերա ✗։ Բացիր, որ գրանցվի." : "Мой ответ на «Ножницы»: сфера ✗. Открой, чтобы его засчитать:");

      // an answer link arriving for my challenge
      await page.evaluate(friend => { const mine = Object.values(DB.load().mine)[0]; handleHash("#r=" + b64u.enc(JSON.stringify({ v: 1, id: mine.id, g: 2, by: friend, at: 99 }))); }, lang === "hy" ? "Նարե" : "Нарэ");
      await expect(page.locator("#fNote")).toContainText(lang === "hy" ? "կրկնակի տոր ✗" : "двойной тор ✗");
      found.push(...await audit(page, "friends, answer arrived"));
      expect(found).toEqual([]);
      expect(errors).toEqual([]);
    });
  });
}

test.describe("offline", () => {
  test.use({ serviceWorkers: "allow" });
  test.skip(({ browserName }) => browserName !== "chromium", "offline emulation with service workers is Chromium-only");

  test("a language never chosen before still loads with no network: the service worker caches the language files", async ({ page, context }) => {
    await page.goto("./");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await context.setOffline(true);
    await page.locator("#langSel").selectOption("hy");
    await expect(page.locator("#dailyBtn h3")).toHaveText(SAMPLE.hy.daily);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "hy");
    await expect(page.locator("#dailyBtn h3")).toHaveText(SAMPLE.hy.daily);
    await context.setOffline(false);
  });
});
