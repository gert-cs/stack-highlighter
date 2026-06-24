(function () {
  /**
   * Content script.
   *
   * Runs inside the job page. It loads keyword state, highlights matching text,
   * captures short page selections, and responds to side-panel commands.
   */
  if (window.__STACK_HIGHLIGHTER_CONTENT_SCRIPT_LOADED__) return;
  window.__STACK_HIGHLIGHTER_CONTENT_SCRIPT_LOADED__ = true;

  /** Shared helpers injected before this content script. */
  const {
    CURRENT_KEYWORD_DATA_VERSION,
    STORAGE_KEYS,
    buildKeywordRegex,
    canUsePluralSuffix,
    categoriesFromStorage,
    ensureDefaultCategoriesLoaded,
    flattenKeywords,
    isHighlightingEnabled,
    migrateCategoriesForVersion,
    needsKeywordDataMigration,
    normalizeKeyword,
    normalizeKeywordList,
    selectionKeyword
  } = window.StackHighlighterShared;

  /** DOM scanning configuration: what we create and what we must never scan. */
  const HIGHLIGHT_CLASS = "stack-highlighter-mark";
  const HIGHLIGHT_STYLE_ID = "stack-highlighter-range-style";
  const HIGHLIGHT_NAME_PREFIX = "stack-highlighter-category-";
  const ACTIVE_HIGHLIGHT_NAME = "stack-highlighter-active";
  const SKIP_SELECTOR = [
    "a",
    "button",
    "h1",
    "h2",
    "h3",
    "script",
    "style",
    "textarea",
    "input",
    "select",
    "option",
    "code",
    "pre",
    "[role='button']",
    "[role='heading']",
    "[contenteditable='true']",
    `.${HIGHLIGHT_CLASS}`
  ].join(",");

  /** Runtime page state owned by this content script instance. */
  let categories = [];
  let refreshTimer = 0;
  let selectionTimer = 0;
  let observer = null;
  let isRefreshing = false;
  let highlightingEnabled = true;
  let lastPageMatches = { url: location.href, updatedAt: 0, keywords: [] };
  let readyPromise = Promise.resolve();
  let lastHighlightRecords = [];
  const appliedHighlightNames = new Set();
  const jumpPositions = new Map();

  /** Startup loads saved settings after installing listeners. */
  function init() {
    installListeners();
    readyPromise = loadCategoriesAndRefresh();
  }

  async function loadCategoriesAndRefresh() {
    await ensureDefaultCategoriesLoaded();

    const stored = await chrome.storage.sync.get([
      STORAGE_KEYS.categories,
      STORAGE_KEYS.keywordDataVersion,
      STORAGE_KEYS.enabled
    ]);
    categories = categoriesFromStorage(stored[STORAGE_KEYS.categories]);
    highlightingEnabled = isHighlightingEnabled(stored[STORAGE_KEYS.enabled]);

    if (needsKeywordDataMigration(stored[STORAGE_KEYS.keywordDataVersion])) {
      categories = migrateCategoriesForVersion(categories, stored[STORAGE_KEYS.keywordDataVersion]);
      await chrome.storage.sync.set({
        [STORAGE_KEYS.categories]: categories,
        [STORAGE_KEYS.keywordDataVersion]: CURRENT_KEYWORD_DATA_VERSION
      });
    }

    refreshHighlights();
  }

  /**
   * Message, storage, selection, and mutation listeners.
   *
   * The side panel asks for refreshes/jumps through runtime messages. Storage
   * changes keep multiple extension contexts consistent. MutationObserver
   * handles dynamic job pages that load description text after navigation.
   */
  function installListeners() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === "STACK_HIGHLIGHTER_PING") {
        sendResponse({ ok: true, url: location.href });
        return false;
      }

      if (message?.type === "STACK_HIGHLIGHTER_REFRESH") {
        respondWhenReady(sendResponse, () => {
          applyMessageState(message);
          const matches = refreshHighlights();
          return { ok: true, matches };
        });
        return true;
      }

      if (message?.type === "STACK_HIGHLIGHTER_GET_MATCHES") {
        respondWhenReady(sendResponse, () => {
          applyMessageState(message);
          const matches = refreshHighlights();
          return { ok: true, matches };
        });
        return true;
      }

      if (message?.type === "STACK_HIGHLIGHTER_JUMP_TO_KEYWORD") {
        respondWhenReady(sendResponse, () => jumpToKeyword(message.keyword));
        return true;
      }

      if (message?.type === "STACK_HIGHLIGHTER_SET_ENABLED") {
        respondWhenReady(sendResponse, () => {
          applyMessageState(message);
          const matches = refreshHighlights();
          return { ok: true, matches, enabled: highlightingEnabled };
        });
        return true;
      }
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "sync") return;

      if (changes[STORAGE_KEYS.categories]) {
        categories = categoriesFromStorage(changes[STORAGE_KEYS.categories].newValue);
        scheduleRefresh(30);
      }

      if (changes[STORAGE_KEYS.enabled]) {
        highlightingEnabled = isHighlightingEnabled(changes[STORAGE_KEYS.enabled].newValue);
        scheduleRefresh(0);
      }
    });

    document.addEventListener("mouseup", scheduleSelectionCapture, true);
    document.addEventListener("keyup", scheduleSelectionCapture, true);

    observer = new MutationObserver((mutations) => {
      if (!highlightingEnabled) return;
      if (isRefreshing) return;
      if (mutations.some(shouldRefreshForMutation)) {
        scheduleRefresh(450);
      }
    });

    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        characterData: true,
        subtree: true
      });
    }
  }

  /** Message helpers keep async startup from racing with panel commands. */
  function applyMessageState(message) {
    if (Array.isArray(message?.categories)) {
      categories = categoriesFromStorage(message.categories);
    }

    if ("enabled" in (message || {})) {
      highlightingEnabled = isHighlightingEnabled(message.enabled);
    }
  }

  function respondWhenReady(sendResponse, callback) {
    readyPromise
      .then(() => sendResponse(callback()))
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        });
      });
  }

  /** Refresh scheduling and mutation filtering. */
  function shouldRefreshForMutation(mutation) {
    const target = mutation.target.nodeType === Node.ELEMENT_NODE ? mutation.target : mutation.target.parentElement;
    if (!target || target.closest(SKIP_SELECTOR)) return false;

    for (const node of mutation.addedNodes || []) {
      if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim()) return true;
      if (node.nodeType === Node.ELEMENT_NODE && !node.closest(SKIP_SELECTOR)) return true;
    }

    return mutation.type === "characterData";
  }

  function scheduleRefresh(delay) {
    clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(refreshHighlights, delay);
  }

  /**
   * Full highlight pass.
   *
   * Existing marks are removed first so repeated refreshes stay idempotent.
   * Disabled mode records an empty match set and leaves the page unmarked.
   */
  function refreshHighlights() {
    if (!document.body) return lastPageMatches;

    isRefreshing = true;
    clearHighlights();
    jumpPositions.clear();
    lastHighlightRecords = [];

    if (!highlightingEnabled) {
      lastPageMatches = {
        url: location.href,
        updatedAt: Date.now(),
        keywords: []
      };
      savePageMatches(lastPageMatches).catch(() => {});

      window.setTimeout(() => {
        isRefreshing = false;
      }, 0);

      return lastPageMatches;
    }

    const { regex } = buildKeywordRegex(categories);
    const metadataByKeyword = new Map(flattenKeywords(categories).map((item) => [item.normalized, item]));
    const foundKeywords = new Set();

    if (regex) {
      lastHighlightRecords = collectHighlightRecords(regex, metadataByKeyword, foundKeywords);
      renderHighlights(lastHighlightRecords);
    }

    lastPageMatches = {
      url: location.href,
      updatedAt: Date.now(),
      keywords: normalizeKeywordList([...foundKeywords])
    };

    savePageMatches(lastPageMatches).catch(() => {});

    window.setTimeout(() => {
      isRefreshing = false;
    }, 0);

    return lastPageMatches;
  }

  /** Highlight DOM mutation helpers. */
  async function savePageMatches(matches) {
    if (document.visibilityState !== "visible") return;

    await chrome.storage.local.set({
      [STORAGE_KEYS.pageMatches]: matches
    });
  }

  function clearHighlights() {
    clearRangeHighlights();
    removeLegacyHighlights();
  }

  function clearRangeHighlights() {
    if (!supportsRangeHighlights()) return;

    for (const name of appliedHighlightNames) {
      CSS.highlights.delete(name);
    }

    CSS.highlights.delete(ACTIVE_HIGHLIGHT_NAME);
    appliedHighlightNames.clear();

    if (typeof CSS.highlights.keys === "function") {
      for (const name of Array.from(CSS.highlights.keys())) {
        if (String(name).startsWith(HIGHLIGHT_NAME_PREFIX) || name === ACTIVE_HIGHLIGHT_NAME) {
          CSS.highlights.delete(name);
        }
      }
    }
  }

  function removeLegacyHighlights() {
    const marks = document.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
    for (const mark of marks) {
      const text = document.createTextNode(mark.textContent || "");
      mark.replaceWith(text);
      text.parentElement?.normalize();
    }
  }

  /** Range-based highlighting keeps host pages' DOM intact. */
  function supportsRangeHighlights() {
    return Boolean(window.Highlight && typeof CSS !== "undefined" && CSS.highlights);
  }

  function collectHighlightRecords(regex, metadataByKeyword, foundKeywords) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent || parent.closest(SKIP_SELECTOR)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const nodes = [];
    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
    }

    const records = [];
    for (let index = 0; index < nodes.length; index++) {
      collectHighlightRecordsForNode(nodes[index], regex, metadataByKeyword, foundKeywords, records);
    }

    return records;
  }

  function collectHighlightRecordsForNode(node, regex, metadataByKeyword, foundKeywords, records) {
    const text = node.nodeValue;
    let lastIndex = 0;

    regex.lastIndex = 0;

    for (const match of text.matchAll(regex)) {
      const prefix = match[1] || "";
      const keywordText = match[2] || "";
      const pluralSuffix = match[3] || "";
      const start = match.index + prefix.length;
      const end = start + keywordText.length;
      const metadata = metadataByKeyword.get(normalizeKeyword(keywordText));

      if (!metadata || start < lastIndex) continue;
      if (!canUsePluralSuffix(keywordText, pluralSuffix)) continue;

      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, end);
      records.push({
        range,
        text: keywordText,
        start,
        end,
        normalizedKeyword: metadata.normalized,
        metadata
      });
      foundKeywords.add(metadata.normalized);
      lastIndex = end;
    }
  }

  function renderHighlights(records) {
    if (supportsRangeHighlights()) {
      renderRangeHighlights(records);
      return;
    }

    renderLegacyHighlights(records);
  }

  function renderRangeHighlights(records) {
    const rangesByName = new Map();

    for (const record of records) {
      const name = categoryHighlightName(record.metadata.categoryId);
      if (!rangesByName.has(name)) rangesByName.set(name, []);
      rangesByName.get(name).push(record.range);
    }

    updateRangeHighlightStyles(records);

    for (const [name, ranges] of rangesByName.entries()) {
      CSS.highlights.set(name, new Highlight(...ranges));
      appliedHighlightNames.add(name);
    }
  }

  function updateRangeHighlightStyles(records) {
    const categoriesById = new Map();
    for (const record of records) {
      categoriesById.set(record.metadata.categoryId, record.metadata);
    }

    const rules = [...categoriesById.values()].map((metadata) => {
      const name = categoryHighlightName(metadata.categoryId);
      const color = safeCssColor(metadata.color);
      return `::highlight(${name}) { background-color: color-mix(in srgb, ${color} 30%, transparent); }`;
    });

    rules.push(
      `::highlight(${ACTIVE_HIGHLIGHT_NAME}) { background-color: rgba(29, 123, 240, 0.24); text-decoration: underline 2px #1d7bf0; }`
    );

    let style = document.getElementById(HIGHLIGHT_STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = HIGHLIGHT_STYLE_ID;
      (document.head || document.documentElement).append(style);
    }
    style.textContent = rules.join("\n");
  }

  function categoryHighlightName(categoryId) {
    const slug = String(categoryId || "category")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return `${HIGHLIGHT_NAME_PREFIX}${slug || "category"}`;
  }

  function safeCssColor(color) {
    const value = String(color || "").trim();
    return /^#[0-9a-f]{6}$/i.test(value) ? value : "#4f8cff";
  }

  /**
   * Legacy fallback for browsers without the CSS Custom Highlight API.
   * Chrome 116+ uses the range path above, which avoids mutating host-page DOM.
   */
  function renderLegacyHighlights(records) {
    const recordsByNode = new Map();
    for (const record of records) {
      const node = record.range.startContainer;
      if (!node?.parentNode || node.nodeType !== Node.TEXT_NODE) continue;
      if (!recordsByNode.has(node)) recordsByNode.set(node, []);
      recordsByNode.get(node).push(record);
    }

    for (const [node, nodeRecords] of recordsByNode.entries()) {
      if (!node.parentNode) continue;
      const text = node.nodeValue;
      const fragment = document.createDocumentFragment();
      let lastIndex = 0;

      for (const record of nodeRecords.sort((left, right) => left.start - right.start)) {
        fragment.append(document.createTextNode(text.slice(lastIndex, record.start)));
        fragment.append(createHighlight(text.slice(record.start, record.end), record.metadata));
        lastIndex = record.end;
      }

      fragment.append(document.createTextNode(text.slice(lastIndex)));
      node.replaceWith(fragment);
    }
  }

  function createHighlight(text, metadata) {
    const mark = document.createElement("mark");
    mark.className = HIGHLIGHT_CLASS;
    mark.dataset.stackCategory = metadata.categoryId;
    mark.dataset.stackKeyword = metadata.keyword;
    mark.style.setProperty("--stack-highlight-color", metadata.color);
    mark.title = `${metadata.categoryLabel}: ${metadata.keyword}`;
    mark.textContent = text;
    return mark;
  }

  /**
   * Jump navigation block.
   *
   * Each keyword keeps its own cursor so repeated chip clicks cycle through
   * matching marks instead of bouncing between tabs or resetting to the top.
   */
  function jumpToKeyword(rawKeyword) {
    if (!highlightingEnabled) {
      return { ok: false, count: 0, index: 0, keyword: rawKeyword, error: "Highlighting disabled" };
    }

    const normalized = normalizeKeyword(rawKeyword);
    let matches = findKeywordMatches(normalized);

    clearActiveHighlight();

    if (matches.length === 0) {
      refreshHighlights();
      matches = findKeywordMatches(normalized);
    }

    if (matches.length === 0) {
      return { ok: false, count: 0, index: 0, keyword: rawKeyword };
    }

    const nextIndex = ((jumpPositions.get(normalized) ?? -1) + 1) % matches.length;
    const match = matches[nextIndex];
    jumpPositions.set(normalized, nextIndex);
    activateKeywordMatch(match);

    return { ok: true, count: matches.length, index: nextIndex + 1, keyword: rawKeyword };
  }

  function clearActiveHighlight() {
    if (supportsRangeHighlights()) {
      CSS.highlights.delete(ACTIVE_HIGHLIGHT_NAME);
    }

    document.querySelectorAll(".stack-highlighter-active").forEach((mark) => {
      mark.classList.remove("stack-highlighter-active");
    });
  }

  function findKeywordMatches(normalizedKeyword) {
    if (supportsRangeHighlights()) {
      return lastHighlightRecords.filter((record) => record.normalizedKeyword === normalizedKeyword);
    }

    return findKeywordMarks(normalizedKeyword);
  }

  function activateKeywordMatch(match) {
    if (match?.range && supportsRangeHighlights()) {
      CSS.highlights.set(ACTIVE_HIGHLIGHT_NAME, new Highlight(match.range));
      scrollRangeIntoView(match.range);
      return;
    }

    match.classList.add("stack-highlighter-active");
    match.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  }

  function scrollRangeIntoView(range) {
    const element = range.startContainer?.parentElement;
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      return;
    }

    const rect = range.getBoundingClientRect();
    if (!rect.width && !rect.height) return;
    const top = Math.max(0, rect.top + window.scrollY - window.innerHeight / 2 + rect.height / 2);
    window.scrollTo({ top, behavior: "smooth" });
  }

  function findKeywordMarks(normalizedKeyword) {
    return [...document.querySelectorAll(`.${HIGHLIGHT_CLASS}`)].filter((mark) => {
      return normalizeKeyword(mark.dataset.stackKeyword || mark.textContent || "") === normalizedKeyword;
    });
  }

  /** Page selection capture for the side panel add-keyword buttons. */
  function scheduleSelectionCapture() {
    clearTimeout(selectionTimer);
    selectionTimer = window.setTimeout(captureSelection, 80);
  }

  async function captureSelection() {
    if (document.visibilityState !== "visible") return;

    const selection = window.getSelection();
    const selected = selectionKeyword(selection?.toString() || "");

    await chrome.storage.local.set({
      [STORAGE_KEYS.selectedText]: {
        text: selected,
        url: location.href,
        updatedAt: Date.now()
      }
    });
  }

  init();
})();
