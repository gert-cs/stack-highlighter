# Stack Highlighter Privacy Policy

Last updated: June 24, 2026

Stack Highlighter is a Chrome extension for highlighting job-search keywords on web pages. It is designed to work locally in the browser. By design, Stack Highlighter has no account system, no developer-operated server, and no telemetry pipeline for receiving user data. The developer does not receive, review, analyze, sell, or profile user data.

## Data The Extension Processes

Stack Highlighter may process the following data locally in the user's browser to provide its core features:

- Keyword categories, keyword lists, category colors, category order, and enabled or disabled settings.
- Short text selected by the user on the current page, used only to help add a new keyword.
- Keyword match summaries for the current page, such as which saved keywords were found.
- Visible text on the current web page, processed locally to find keyword matches and draw highlights.
- The current page URL, used locally to keep the side panel aligned with the active tab.

## How Data Is Used

The extension uses this data to:

- Highlight saved keywords on the current page.
- Show page-hit counts in the side panel.
- Let the user add, remove, reorder, import, and export keyword lists.
- Remember the user's keyword settings and highlighting preferences.
- Jump from a keyword chip in the side panel to a matching occurrence on the page.

## Local Processing And Storage

Keyword matching happens locally on the user's device. Visible page text is scanned in the browser only to find saved keywords and draw highlights on the page. The extension does not need to collect this data, and its code does not include a path to send it to the developer.

Keyword settings and highlighting preferences are stored in Chrome extension storage. Short selected text and current-page match summaries are stored locally by the extension so the side panel can stay in sync with the active page.

Some keyword settings may sync through Chrome if the user's browser sync is enabled, because the extension uses Chrome's built-in extension storage. This sync is handled by Chrome, not by the Stack Highlighter developer.

## Data Sharing

Stack Highlighter does not sell user data.

Stack Highlighter does not send job-page text, selected text, keyword lists, browsing history, or page-hit data to a developer-operated server. Because the extension has no developer-operated backend or analytics pipeline, the developer has no practical way to collect, inspect, analyze, profile, or share users' job-search activity through the extension. The extension does not use analytics, advertising tracking, or external telemetry services.

## Remote Code

Stack Highlighter does not execute remotely hosted code. The extension's scripts, styles, and default keyword data are packaged with the extension.

## User Control And Deletion

Users can edit, import, export, or delete keyword data from the extension side panel. Users can also remove the extension from Chrome to delete extension-managed local data from the browser. If Chrome sync is enabled, synced extension data may also be managed through the user's Chrome or Google account sync settings.

## Permissions

Stack Highlighter requests browser permissions only to provide its highlighting and side-panel features:

- `storage`: saves keyword lists, categories, and highlighting settings.
- `sidePanel`: displays the keyword manager next to the current page.
- `activeTab` and `scripting`: connect the side panel with the current tab and refresh page highlights.
- Host access: lets the extension highlight job descriptions across different job boards, company career pages, and other user-opened job-search pages.

## Contact

For privacy questions about Stack Highlighter, contact the developer through the support contact listed on the Chrome Web Store listing.
