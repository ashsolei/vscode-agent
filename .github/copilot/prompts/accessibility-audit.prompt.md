```prompt
---
mode: "agent"
description: "Audit extension accessibility — WebView dashboard ARIA, chat response formatting, keyboard navigation, status bar readability"
---

# Accessibility Audit

You are an accessibility specialist auditing the VS Code Agent extension (TypeScript, VS Code ^1.93.0).

## Steps

1. **WebView dashboard (`src/dashboard/agent-dashboard.ts`)**
   - Check HTML emitted to the WebView panel for ARIA landmarks (`role`, `aria-label`, `aria-live`).
   - Verify tables have `<caption>`, `<th scope>`, and proper header associations.
   - Confirm colour contrast meets WCAG 2.1 AA (4.5:1 for text, 3:1 for large text).
   - Ensure interactive elements are focusable and have visible focus indicators.

2. **Chat response formatting**
   - Review `stream.markdown()` output in agents — ensure headings use proper hierarchy (h2 → h3, not random).
   - Check that code blocks specify a language for screen-reader code-identification.
   - Verify lists use markdown list syntax (not manual `- ` concatenation without blank lines).

3. **Status bar items (`src/statusbar/`)**
   - Confirm `StatusBarItem.accessibilityInformation` is set with a clear `label`.
   - Verify tooltip text is descriptive, not just an icon name.

4. **Keyboard navigation**
   - All registered commands (`package.json` → `contributes.commands`) should be triggerable via Command Palette.
   - Tree views (`src/views/`) must support arrow-key navigation and `Enter` to activate.
   - Walkthrough steps (`media/walkthrough/`) must not rely solely on images.

5. **Notification centre (`src/notifications/notification-center.ts`)**
   - Check that notifications use appropriate severity levels (`Information`, `Warning`, `Error`).
   - Verify action buttons have descriptive labels (not just "OK").

6. **Verification**
   ```bash
   npm run compile && npm test
   # Manual: use VS Code's built-in accessibility inspector (Developer: Inspect Accessibility)
   ```

## Quality Checklist
- [ ] All WebView HTML passes axe-core basic audit
- [ ] Chat markdown output uses semantic structure
- [ ] Status bar items have `accessibilityInformation`
- [ ] Commands are keyboard-reachable via Command Palette
- [ ] Notifications use meaningful action labels

## Pitfalls to Avoid
- Relying solely on colour to convey status (use icons + text).
- Using `aria-hidden="true"` on informational content.
- Hardcoding Swedish strings without `aria-lang` attribute in WebViews.
- Omitting alt text on images in walkthrough markdown files.
```
