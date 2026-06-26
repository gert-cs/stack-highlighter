const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const sharedPath = path.join(root, "src", "shared.js");
const defaultKeywordsPath = path.join(root, "data", "default-keywords.json");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const sidepanelHtml = fs.readFileSync(path.join(root, "sidepanel.html"), "utf8");
const sidepanelCss = fs.readFileSync(path.join(root, "src", "sidepanel.css"), "utf8");
const sidepanelSource = fs.readFileSync(path.join(root, "src", "sidepanel.js"), "utf8");
const contentCss = fs.readFileSync(path.join(root, "src", "content.css"), "utf8");
const contentSource = fs.readFileSync(path.join(root, "src", "contentScript.js"), "utf8");
const backgroundSource = fs.readFileSync(path.join(root, "src", "background.js"), "utf8");
const welcomeHtmlPath = path.join(root, "welcome.html");
const advancedCustomizationHtmlPath = path.join(root, "advanced-customization.html");
const puzzleIconPath = path.join(root, "assets", "icons", "puzzle.png");
const defaultKeywordsJson = fs.readFileSync(defaultKeywordsPath, "utf8");
const sharedSource = fs.readFileSync(sharedPath, "utf8");
const context = { window: {} };

vm.createContext(context);
vm.runInContext(sharedSource, context);

const shared = context.window.StackHighlighterShared;
const plain = (value) => JSON.parse(JSON.stringify(value));

shared.setDefaultCategoriesFromKeywordTableJson(defaultKeywordsJson);

function keywordsByCategory(categories = shared.categoriesFromStorage(null)) {
  return new Map(categories.map((category) => [category.id, category.keywords]));
}

function assertIncludesAll(values, expected, label) {
  for (const value of expected) {
    assert.ok(values.includes(value), `${value} should be in ${label}`);
  }
}

function assertExcludesAll(values, expected, label) {
  for (const value of expected) {
    assert.equal(values.includes(value), false, `${value} should not be in ${label}`);
  }
}

assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, "0.4.0");
assert.equal(manifest.name, "Stack Highlighter");
assert.ok(manifest.permissions.includes("storage"));
assert.ok(manifest.permissions.includes("sidePanel"));
assert.ok(manifest.permissions.includes("activeTab"));
assert.ok(manifest.permissions.includes("scripting"));
assert.equal(manifest.icons["128"], "assets/icons/icon-128.png");
assert.equal(manifest.action.default_icon["128"], "assets/icons/icon-128.png");
assert.match(backgroundSource, /welcome\.html/, "install flow should open the first-run welcome page");
assert.match(backgroundSource, /function shouldOpenWelcomePage\(details\)/, "welcome flow should use a dedicated update helper");
assert.match(backgroundSource, /details\.reason === "install"/, "welcome page should open on install");
assert.match(backgroundSource, /details\.reason !== "update"/, "welcome page should not open for non-update events");
assert.match(backgroundSource, /current\.major === 0 && current\.patch === 0 && current\.minor !== previous\.minor/, "welcome page should open only for 0.x.0 minor-version updates");
assert.match(backgroundSource, /parseVersion\(chrome\.runtime\.getManifest\(\)\.version\)/, "welcome update helper should read the current manifest version");
assert.equal(shared.DEFAULT_KEYWORD_TABLE_PATH, "data/default-keywords.json");
assert.ok(
  manifest.web_accessible_resources.some((entry) => entry.resources.includes(shared.DEFAULT_KEYWORD_TABLE_PATH)),
  "default keyword JSON should be packaged as an accessible extension resource"
);

for (const id of [
  "categoryList",
  "viewJsonButton",
  "exportJsonButton",
  "importJsonButton",
  "importJsonFileInput",
  "jsonEditorPanel",
  "jsonTextarea",
  "addCategoryButton",
  "cancelCategoryButton",
  "disabledOverlay"
]) {
  assert.match(sidepanelHtml, new RegExp(`id="${id}"`), `${id} should exist in sidepanel.html`);
}

assert.doesNotMatch(sidepanelHtml, /disabled-card/, "OFF state should use a passive scrim instead of a blocking card");
assert.doesNotMatch(sidepanelHtml, /id="disabledEnableButton"/, "ON/OFF toggle should be the only OFF recovery control");
assert.doesNotMatch(sidepanelCss, /\.app-shell\.disabled\s*\{[\s\S]*?overflow:\s*hidden;/, "OFF state should not hide the scrollbar and shift layout");
assert.match(sidepanelCss, /scrollbar-width:\s*none;/, "side panel should hide scrollbars while staying scrollable");
assert.match(sidepanelCss, /::-webkit-scrollbar\s*\{[\s\S]*?display:\s*none;/, "side panel should hide Chromium scrollbars");
assert.match(sidepanelCss, /\.disabled-overlay\s*\{\s*position: absolute;/, "OFF scrim should be positioned inside the side-panel shell");
assert.match(sidepanelCss, /\.disabled-overlay\s*\{[\s\S]*?z-index: 20;/, "OFF scrim should sit above disabled content");
assert.match(sidepanelCss, /\.header-actions\s*\{[\s\S]*?position: fixed;/, "toggle container should stay fixed while the panel scrolls");
assert.match(sidepanelCss, /\.header-actions\s*\{[\s\S]*?top: 20px;/, "toggle container should sit slightly below the top edge");
assert.match(sidepanelCss, /\.header-actions\s*\{[\s\S]*?z-index: 60;/, "toggle container should sit above the OFF scrim");
assert.match(sidepanelCss, /\.toggle-button\s*\{[\s\S]*?z-index: 61;/, "ON/OFF toggle should be the highest clickable control");
assert.match(sidepanelCss, /\.app-header h1\s*\{[\s\S]*?font-size: 21px;/, "title should be compact enough to avoid the fixed toggle");
assert.doesNotMatch(sidepanelCss, /\.search-wrap\s*\{[\s\S]*?position:\s*sticky;/, "search should scroll as a normal panel element");
assert.doesNotMatch(sidepanelHtml, /id="firstRunGuide"/, "side panel should not show the optional-use explainer card");
assert.doesNotMatch(sidepanelHtml, /id="searchInput"/, "search bar should stay hidden while chips are the primary navigation");
assert.doesNotMatch(sidepanelHtml, /id="refreshButton"/, "refresh button should not compete with the primary on/off control");
assert.match(sidepanelHtml, /<summary>Advanced options<\/summary>/, "advanced controls should use the Advanced options label");
assert.match(sidepanelHtml, /class="advanced-guide-link" href="advanced-customization\.html"/, "advanced options should link to the options guide");
assert.match(sidepanelHtml, />Advanced options guide<\/a>/, "side panel guide link should use the Advanced options name");
assert.doesNotMatch(sidepanelHtml, /Advanced keyword table/, "side panel should not use the old advanced keyword table label");
assert.match(sidepanelHtml, /<a class="title-home-link" href="welcome\.html" target="_blank" rel="noopener">Stack Highlighter<\/a> <span id="enabledTitleState">ON<\/span>/, "title should open welcome in a new tab while showing the on/off state");
assert.match(sidepanelCss, /\.title-home-link\s*\{[\s\S]*?color: inherit;[\s\S]*?text-decoration: none;/, "title link should keep the title styling by default");
assert.match(sidepanelCss, /\.title-home-link:hover,[\s\S]*?\.title-home-link:focus-visible\s*\{[\s\S]*?text-decoration: underline;/, "title link should underline on hover or focus");
assert.match(sidepanelHtml, /class="toggle-track"/, "the global highlighting control should render as a switch");
assert.match(sidepanelHtml, />ON</, "the global highlighting toggle should have a visible ON label");
assert.match(sidepanelHtml, />OFF</, "the global highlighting toggle should have a visible OFF label");
assert.match(sidepanelSource, /stored\[STORAGE_KEYS\.enabled\] === false/, "opening the side panel should recover from a previous OFF state");
assert.match(contentSource, /STACK_HIGHLIGHTER_JUMP_TO_KEYWORD/, "chip clicks should still jump through the content-script message path");
assert.match(contentSource, /ACTIVE_RING_CLASS = "stack-highlighter-active-ring"/, "jump feedback should use an independent overlay ring");
assert.match(contentSource, /`\.\$\{ACTIVE_RING_CLASS\}`/, "mutation observer should ignore the extension-owned active ring");
assert.match(contentSource, /document\.body\.append\(ring\)/, "jump feedback should append an overlay instead of wrapping page text");
assert.match(contentSource, /ACTIVE_RING_DURATION_MS = 3000/, "jump feedback should stay visible for three seconds");
assert.match(contentSource, /trackActiveRing\(\(\) => rangeRect\(match\.range\)\)/, "range jump feedback should track the target during smooth scrolling");
assert.match(contentSource, /trackActiveRing\(\(\) => match\.getBoundingClientRect\(\)\)/, "legacy jump feedback should track the target during smooth scrolling");
assert.match(contentSource, /requestAnimationFrame\(updateRingPosition\)/, "jump feedback should update its position while the page scrolls");
assert.match(contentSource, /setTimeout\(\(\) => \{[\s\S]*?ring\.classList\.add\(ACTIVE_RING_FADING_CLASS\);[\s\S]*?\}, ACTIVE_RING_DURATION_MS\)/, "jump ring lifetime should be a simple three-second timer");
assert.match(contentSource, /try\s*\{[\s\S]*?rect = rectProvider\(\);[\s\S]*?\}\s*catch\s*\{[\s\S]*?rect = lastRect;/, "jump feedback should survive transient rect lookup failures");
assert.match(contentSource, /ring\.style\.left = `\$\{rect\.left - padding\}px`;/, "jump ring should use viewport rect coordinates instead of document scroll offsets");
assert.match(contentSource, /clearActiveRing\(\)/, "highlight cleanup should remove active jump rings");
assert.doesNotMatch(contentSource, /jumpPositions\.clear\(\);/, "highlight refresh should not reset repeated chip-click navigation");
assert.match(contentSource, /function isExtensionContextInvalidatedError\(error\)/, "content script should recognize extension-context invalidation");
assert.match(contentSource, /async function safeStorageLocalSet\(values\)/, "content script should wrap local storage writes");
assert.match(contentSource, /await safeStorageLocalSet\(\{\s*\[STORAGE_KEYS\.pageMatches\]: matches\s*\}\);/, "page match writes should use the safe storage helper");
assert.match(contentSource, /await safeStorageLocalSet\(\{\s*\[STORAGE_KEYS\.selectedText\]: \{/, "selection writes should use the safe storage helper");
assert.equal((contentSource.match(/await chrome\.storage\.local\.set/g) || []).length, 1, "only the safe storage helper should write local storage directly");
assert.match(contentCss, /\.stack-highlighter-active-ring\s*\{[\s\S]*?position: fixed;/, "active jump ring should track viewport coordinates");
assert.match(contentCss, /\.stack-highlighter-active-ring\s*\{[\s\S]*?background: transparent;/, "active jump ring should not cover page text");
assert.match(contentCss, /\.stack-highlighter-active-ring\s*\{[\s\S]*?pointer-events: none;/, "active jump ring should not block page clicks");
assert.match(contentCss, /\.stack-highlighter-active-ring-fading\s*\{[\s\S]*?opacity: 0;/, "active jump ring should fade out");
assert.match(contentSource, /background-color: transparent; text-decoration: underline 2px rgba\(246, 190, 0, 0\.95\)/, "range active style should avoid colored text backgrounds");

assert.ok(fs.existsSync(welcomeHtmlPath), "welcome.html should exist for the post-install page");
const welcomeHtml = fs.readFileSync(welcomeHtmlPath, "utf8");
assert.match(welcomeHtml, /Welcome to<br \/>Stack Highlighter/, "welcome page title should split across two lines");
assert.doesNotMatch(welcomeHtml, /Installed and ON by default/, "welcome page should not show the installed badge");
assert.match(welcomeHtml, /Scan job descriptions faster\./, "welcome page should keep the concise product subtitle");
assert.match(welcomeHtml, /First-use guide/, "welcome page should include a first-use guide");
assert.match(welcomeHtml, /pin or open Stack Highlighter/, "welcome page should explain pinning or opening the extension");
assert.match(welcomeHtml, /just to the right of the URL bar/, "welcome page should point users to the Chrome extension icon location");
assert.match(welcomeHtml, /www\.linkedin\.com\/jobs/, "welcome page should make the URL bar mock recognizable");
assert.ok(fs.existsSync(puzzleIconPath), "downloaded Chrome extension icon should be copied into assets");
assert.match(welcomeHtml, /<img class="extension-icon" src="assets\/icons\/puzzle\.png"/, "welcome page should visually demonstrate the Chrome extension icon");
assert.match(welcomeHtml, /Try it on LinkedIn/, "welcome page should send users to try LinkedIn");
assert.match(welcomeHtml, /<strong>Add:<\/strong> select a word/, "welcome page should explain how to add keywords");
assert.match(welcomeHtml, /<strong>Delete:<\/strong> click x/, "welcome page should explain how to delete keywords");
assert.match(welcomeHtml, /<strong>Highlight:<\/strong> click a stack chip/, "welcome page should explain stack chip jump behavior");
assert.match(welcomeHtml, /href="advanced-customization\.html">Advanced options guide<\/a>/, "welcome page should link to the local Advanced options guide");
assert.doesNotMatch(welcomeHtml, /advanced customization/i, "welcome page should not use the old advanced customization name");
assert.match(welcomeHtml, /Enable or disable/i, "welcome page should explain the enable-disable control");
assert.match(welcomeHtml, /Update version log/, "welcome page should include release notes");
assert.match(welcomeHtml, /<h3 class="release-entry">0\.4\.0<\/h3>[\s\S]*?<li>Added the welcome page and Advanced options guide/, "release notes should lead with 0.4.0");
assert.match(welcomeHtml, /<h3 class="release-entry">0\.3\.0<\/h3>[\s\S]*?<li>First public Chrome Web Store version/, "release notes should identify 0.3.0 as the first public version");
assert.match(welcomeHtml, /<h3 class="release-entry">Before 0\.3\.0<\/h3>/, "release notes should summarize pre-public history");
assert.match(welcomeHtml, /range-based engine/, "welcome release notes should reflect range-based highlighting history");
assert.match(welcomeHtml, /Avoided mutating interactive page headers/, "welcome release notes should reflect page-compatibility history");

assert.ok(fs.existsSync(advancedCustomizationHtmlPath), "advanced-customization.html should exist");
const advancedCustomizationHtml = fs.readFileSync(advancedCustomizationHtmlPath, "utf8");
assert.match(advancedCustomizationHtml, /href="welcome\.html"/, "advanced options page should link back to welcome");
assert.match(advancedCustomizationHtml, /<h1>Advanced options<\/h1>/, "advanced options page should have a clear title");
assert.match(advancedCustomizationHtml, /<title>Stack Highlighter Advanced Options<\/title>/, "advanced options page should use the Advanced options document title");
assert.match(advancedCustomizationHtml, /expand <code>Advanced options<\/code>/, "advanced options page should point to the renamed side-panel entry");
assert.doesNotMatch(advancedCustomizationHtml, /Advanced customization/i, "advanced options page should not use the old advanced customization name");
assert.match(advancedCustomizationHtml, /<pre><code>\{[\s\S]*?"categories"[\s\S]*?"Hard Skills"[\s\S]*?<\/code><\/pre>/, "advanced options page should include a JSON code block");
assert.match(advancedCustomizationHtml, /View JSON[\s\S]*opens the editor/, "advanced options page should explain the View JSON button");
assert.match(advancedCustomizationHtml, /Export JSON[\s\S]*downloads a backup file/, "advanced options page should explain the Export JSON button");
assert.match(advancedCustomizationHtml, /Import JSON[\s\S]*reads a backup file/, "advanced options page should explain the Import JSON button");
assert.match(advancedCustomizationHtml, /Save[\s\S]*validates the text/, "advanced options page should explain the Save button");
assert.match(advancedCustomizationHtml, /Close[\s\S]*without saving/, "advanced options page should explain the Close button");
assert.match(advancedCustomizationHtml, /categories[\s\S]*full table/, "advanced options page should explain the categories field");
assert.match(advancedCustomizationHtml, /name[\s\S]*category title/, "advanced options page should explain the name field");
assert.match(advancedCustomizationHtml, /color[\s\S]*highlight color/, "advanced options page should explain the color field");
assert.match(advancedCustomizationHtml, /enabled[\s\S]*participates in highlighting/, "advanced options page should explain the enabled field");
assert.match(advancedCustomizationHtml, /keywords[\s\S]*words or phrases/, "advanced options page should explain the keywords field");
assert.match(advancedCustomizationHtml, /Keep category names unique/, "advanced options page should explain editing rules");

assert.equal(shared.sanitizeKeyword("  React,  "), "React");
assert.match(sidepanelHtml, /class="category-color-button"/, "category color button should exist in category template");
assert.match(sidepanelHtml, /class="category-color-input hidden"/, "category color input should exist in category template");
assert.equal(shared.sanitizeStoredKeyword("  React,  "), "react");
assert.equal(shared.sanitizeKeyword(" “Self Motivated.” "), "Self Motivated");
assert.equal(shared.selectionKeyword("one two three four five six"), "");
assert.equal(shared.wordCount("AI Coding Tool"), 3);
assert.equal(shared.isHighlightingEnabled(undefined), true);
assert.equal(shared.isHighlightingEnabled(false), false);
assert.equal(shared.canUsePluralSuffix("database", "s"), true);
assert.equal(shared.canUsePluralSuffix("go", "es"), false);
assert.deepEqual(plain(shared.normalizeKeywordList([" Python ", "python", "", " JavaScript, "])), ["python", "javascript"]);

const categories = shared.categoriesFromStorage(null);
const defaultKeywords = keywordsByCategory(categories);
assert.deepEqual(plain(categories.map((category) => category.id)), [
  "redFlags",
  "hardSkills",
  "patterns",
  "softSkills",
  "other"
]);

assertIncludesAll(defaultKeywords.get("hardSkills"), [
  ".net",
  "agentic ai",
  "ai agent",
  "computer vision",
  "django",
  "firebase",
  "flask",
  "genai",
  "golang",
  "k8s",
  "llamaindex",
  "llms",
  "ml",
  "prometheus",
  "spring cloud",
  "three.js",
  "vector databases",
  "version control",
  "python",
  "javascript",
  "typescript",
  "java",
  "go",
  "c++",
  "git",
  "linux",
  "graphql",
  "mongodb",
  "aws",
  "azure",
  "gcp",
  "terraform",
  "docker",
  "kubernetes",
  "react",
  "pytorch",
  "snowflake"
], "hard skills");

assertIncludesAll(defaultKeywords.get("patterns"), [
  "agentic systems",
  "ai agents",
  "backend",
  "dataset-based evaluation",
  "frontend",
  "job scoring",
  "monorepo",
  "resume tailor",
  "run status tracking",
  "structured json",
  "agile",
  "ci/cd",
  "system design",
  "unit testing",
  "data pipeline",
  "distributed system",
  "observability",
  "query optimization"
], "patterns");

assertIncludesAll(defaultKeywords.get("softSkills"), [
  "code review",
  "code reviews",
  "debugging",
  "problem-solving",
  "quality gates",
  "communication",
  "teamwork",
  "attention to detail",
  "adaptability"
], "soft skills");

assertIncludesAll(defaultKeywords.get("redFlags"), [
  "export regulation",
  "export regulations",
  "sponsorship",
  "without sponsorship",
  "requires sponsorship",
  "u.s. person",
  "h-1b"
], "red flags");

assertIncludesAll(defaultKeywords.get("other"), [
  "ai engineers",
  "computer science",
  "github",
  "gpa",
  "sde",
  "startup",
  "yc",
  "intern",
  "internship",
  "2026",
  "2027",
  "co-op",
  "undergraduate",
  "full-time"
], "other keywords");

assertExcludesAll(defaultKeywords.get("hardSkills"), [
  "c/c++",
  "gmail api",
  "azure openai",
  "anthropic sdk",
  "claude api"
], "hard skills");

assertExcludesAll(defaultKeywords.get("patterns"), [
  "ats",
  "crm",
  "greenhouse"
], "patterns");

const importedCategories = shared.categoriesFromKeywordTableJson(JSON.stringify({
  categories: [
    { name: "Signals", color: "#14b8a6", enabled: false, keywords: [" GraphQL, "] },
    { id: "other", name: "Other Keywords", color: "#f2b84b", keywords: [" Internship. "] }
  ]
}));
assert.equal(importedCategories[0].label, "Signals");
assert.equal(importedCategories[0].color, "#14b8a6");
assert.equal(importedCategories[0].enabled, false);
assert.ok(importedCategories[0].keywords.includes("graphql"));
assert.ok(importedCategories.find((category) => category.id === "other").keywords.includes("internship"));

assert.throws(() => shared.categoriesFromKeywordTableJson("{bad json"), /Invalid keyword table JSON/);
assert.throws(
  () => shared.categoriesFromKeywordTableJson(JSON.stringify({
    categories: [
      { name: "Signals", color: "#14b8a6", keywords: [] },
      { name: "signals", color: "#4f8cff", keywords: [] }
    ]
  })),
  /Category names must be unique/
);

const exportedTable = shared.keywordTableFromCategories([
  { id: "hardSkills", label: "Hard Skills", color: "#4f8cff", enabled: false, keywords: ["Python"] }
]);
assert.deepEqual(Object.keys(exportedTable), ["categories"]);
assert.deepEqual(Object.keys(exportedTable.categories[0]), ["name", "color", "enabled", "keywords"]);
assert.equal(exportedTable.categories[0].enabled, false);
assert.deepEqual(exportedTable.categories[0].keywords, ["python"]);

const addedCategory = shared.addCategory(categories, "Target Stack", "#22c55e");
assert.equal(addedCategory.added, true);
assert.equal(addedCategory.category.label, "Target Stack");
assert.equal(shared.addCategory(addedCategory.categories, "Target Stack", "#22c55e").added, false);
assert.equal(shared.removeCategory(addedCategory.categories, addedCategory.category.id).some((category) => category.id === addedCategory.category.id), false);

const addedKeyword = shared.addKeyword(categories, "other", "  Summer, ");
assert.equal(addedKeyword.added, false);
assert.equal(addedKeyword.keyword, "summer");

const moved = shared.moveKeyword(categories, "hardSkills", "patterns", "Python");
assert.equal(moved.find((category) => category.id === "hardSkills").keywords.includes("python"), false);
assert.equal(moved.find((category) => category.id === "patterns").keywords.includes("python"), true);

const migrated = shared.migrateCategoriesForVersion(
  shared.categoriesFromStorage([
    { id: "hardSkills", keywords: ["Python"] },
    { id: "patterns", keywords: ["CQRS"] },
    { id: "other", keywords: ["Intern", "2026"] }
  ]),
  0
);
const migratedKeywords = keywordsByCategory(migrated);
assertIncludesAll(migratedKeywords.get("hardSkills"), ["git", "graphql", "terraform", "pytorch", "snowflake", "genai"], "migrated hard skills");
assertIncludesAll(migratedKeywords.get("patterns"), ["agile", "system design", "unit testing", "job scoring"], "migrated patterns");
assertIncludesAll(migratedKeywords.get("softSkills"), ["teamwork", "code review"], "migrated soft skills");
assertIncludesAll(migratedKeywords.get("redFlags"), ["without sponsorship", "export regulation"], "migrated red flags");
assertIncludesAll(migratedKeywords.get("other"), ["2027", "co-op", "startup"], "migrated other keywords");

assert.equal(shared.keywordMatchesQuery("React Native", "React"), true);
assert.equal(shared.keywordMatchesQuery("React", "React Native"), true);
assert.equal(shared.keywordMatchesQuery("Python", "React"), false);
assert.deepEqual(
  plain(shared.sortKeywordsByPageMatch(["Python", "JavaScript", "React"], new Set(["javascript"]))),
  ["JavaScript", "Python", "React"]
);

const flattened = shared.flattenKeywords([
  { id: "hardSkills", label: "Hard Skills", color: "#4f8cff", keywords: ["React", "React Native"] }
]);
assert.deepEqual(plain(flattened.map((item) => item.keyword)), ["react native", "react"]);

function regexMatches(keywords, text) {
  const { regex } = shared.buildKeywordRegex([
    { id: "hardSkills", label: "Hard Skills", color: "#4f8cff", keywords }
  ]);
  return [...text.matchAll(regex)].map((match) => ({
    keyword: match[2],
    suffix: match[3] || ""
  }));
}

assert.deepEqual(plain(regexMatches(["react", "react native", "python"], "React Native, React, and Python.")), [
  { keyword: "React Native", suffix: "" },
  { keyword: "React", suffix: "" },
  { keyword: "Python", suffix: "" }
]);
assert.deepEqual(plain(regexMatches(["c", "c++"], "C/C++ and C++")), [
  { keyword: "C", suffix: "" },
  { keyword: "C++", suffix: "" },
  { keyword: "C++", suffix: "" }
]);
assert.deepEqual(plain(regexMatches(["ml"], "ML/AI coursework")), [{ keyword: "ML", suffix: "" }]);
assert.deepEqual(plain(regexMatches(["java"], "JavaScript")), []);
assert.deepEqual(
  plain(regexMatches(["go"], "ego, go, goes").filter((match) => shared.canUsePluralSuffix(match.keyword, match.suffix))),
  [{ keyword: "go", suffix: "" }]
);
assert.deepEqual(plain(regexMatches(["api", "database", "process"], "APIs, databases, processes")), [
  { keyword: "API", suffix: "s" },
  { keyword: "database", suffix: "s" },
  { keyword: "process", suffix: "es" }
]);

const { regex: disabledCategoryRegex } = shared.buildKeywordRegex([
  { id: "hardSkills", label: "Hard Skills", color: "#4f8cff", enabled: false, keywords: ["python"] },
  { id: "patterns", label: "Patterns", color: "#43b883", enabled: true, keywords: ["sdlc"] }
]);
assert.deepEqual(plain([..."Python and SDLC".matchAll(disabledCategoryRegex)].map((match) => match[2])), ["SDLC"]);

console.log("shared.test.js passed");
