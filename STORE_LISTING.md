# Chrome Web Store Listing Draft

## Basic Info

Name:
Stack Highlighter

Category:
Productivity

Language:
English

## Short Description

Highlight job-search keywords by category on the current page.

## Single Purpose

Stack Highlighter helps job seekers scan job descriptions faster by highlighting saved keywords directly on the current page and showing current-page keyword hits in a side panel.

## Detailed Description

Stack Highlighter is a local-first Chrome extension for reading job descriptions.

It highlights useful job-search terms directly on the current page and organizes them into categories such as Red Flags, Hard Skills, Patterns, Soft Skills, and Other Keywords. The side panel shows which saved keywords appear on the page, lets you jump through matches, and gives you simple controls for editing your keyword list.

Key features:

- Highlight job-description keywords by category.
- Show current-page keyword hits in a compact side panel.
- Jump from a keyword chip to matching text on the page.
- Add keywords from selected page text.
- Add, delete, reorder, enable, or disable keyword categories.
- Import, export, and edit keyword lists as JSON.
- Use local browser storage for keyword settings.

Privacy-first design:

- Keyword matching happens locally in your browser.
- Job-page text is not sent to the developer.
- Keyword lists are not sent to the developer.
- The extension has no account system, no developer-operated server, and no analytics or advertising telemetry.
- The extension does not execute remotely hosted code.

Stack Highlighter is designed for job boards, company career pages, ATS pages, and other job-search reading workflows. It is a reading aid only; highlighted terms are signals for review, not automatic decisions about whether a role is a fit.

## Store Listing Image Assets

- Icon: `assets/icons/icon-128.png` (`128x128`)
- Small promotional image: `assets/store-listing/small-promo-440x280.png` (`440x280`)
- Main screenshot: `assets/store-listing/screenshot-main-1280x800.png` (`1280x800`)

## Privacy Policy URL

Use a public URL that renders `PRIVACY.md`.

Suggested GitHub URL after push:

`https://github.com/gert-cs/stack-highlighter/blob/main/PRIVACY.md`

If you publish GitHub Pages later, use the GitHub Pages URL instead because it is easier for non-technical users to read.

## Privacy Fields

Remote code:

No. Stack Highlighter does not execute remotely hosted code. The extension's scripts, styles, and default keyword data are packaged with the extension.

Data use summary:

Stack Highlighter processes visible page text locally in the user's browser to find saved keyword matches and draw highlights. It stores keyword settings, highlighting preferences, short selected text, and current-page match summaries in Chrome extension storage so the side panel can function. The extension does not send job-page text, selected text, keyword lists, browsing history, or page-hit data to a developer-operated server.

Limited use certification:

The extension uses data only to provide keyword highlighting, keyword management, page-hit display, and jump-to-match behavior. It does not sell data, use data for advertising, use data for unrelated analytics, or transfer data to third parties.

## Permission Justifications

`storage`:
Used to save keyword categories, keyword lists, category colors, category order, and highlighting preferences.

`sidePanel`:
Used to display the Stack Highlighter keyword manager next to the current page.

`activeTab`:
Used so the side panel can communicate with the current active tab and refresh or jump to highlights in response to user actions.

`scripting`:
Used to inject or re-inject the packaged content script and CSS when the side panel needs to connect to the current page after an extension reload or page refresh.

Host access (`<all_urls>`):
Used to highlight job-search keywords across many job boards, company career pages, ATS pages, and other job-description pages that users open. Processing happens locally in the user's browser, and page text is not sent to the developer.

## Review Notes / Test Instructions

1. Install the extension.
2. Open a job description page.
3. Open the Stack Highlighter side panel from the extension icon.
4. Confirm that keywords are highlighted on the page and page-hit chips appear in the side panel.
5. Click a keyword chip to jump to a matching occurrence.
6. Select short text on the page and use a category add button to save it as a keyword.
7. Use Export JSON and Import JSON to verify keyword backup and restore behavior.
