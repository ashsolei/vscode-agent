---
name: ui-component-standards
description: "Standards and workflow for building UI components: VS Code Webview API, accessibility requirements, theming integration, component structure, testing patterns, and design system compliance."
argument-hint: "[component-name] [component-type]"
---

# UI Component Standards

Standards for building UI components within the VS Code extension ecosystem. Covers Webview panels, TreeView providers, QuickPick interfaces, and custom editors using the VS Code API.

## Component Types

| Type | API | Use Case | Complexity |
|---|---|---|---|
| TreeView | `vscode.TreeDataProvider` | Hierarchical data display | Low |
| QuickPick | `vscode.window.createQuickPick()` | Selection from options | Low |
| Webview Panel | `vscode.WebviewPanel` | Rich custom UI | Medium |
| Custom Editor | `vscode.CustomEditorProvider` | File-type-specific editors | High |
| Status Bar | `vscode.StatusBarItem` | Persistent indicators | Low |
| Notifications | `vscode.window.showInformationMessage` | Alerts and actions | Low |

## Component Structure

### Webview Components

```
src/views/
├── <component-name>/
│   ├── <component-name>.ts         # Provider class
│   ├── <component-name>.test.ts    # Unit tests
│   └── media/
│       ├── <component-name>.css    # Styles (VS Code theme tokens)
│       └── <component-name>.js     # Client-side script
```

### TreeView Providers

```typescript
// Pattern: src/views/<name>-tree.ts
export class MyTreeProvider implements vscode.TreeDataProvider<MyItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<MyItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  getTreeItem(element: MyItem): vscode.TreeItem { /* ... */ }
  getChildren(element?: MyItem): Thenable<MyItem[]> { /* ... */ }
  refresh(): void { this._onDidChangeTreeData.fire(undefined); }
}
```

## Theming Integration

All UI components MUST use VS Code CSS custom properties for colors:

```css
/* DO — use VS Code theme variables */
.container {
  background: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
  border: 1px solid var(--vscode-panel-border);
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
}

.button {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  padding: 4px 12px;
  cursor: pointer;
}

.button:hover {
  background: var(--vscode-button-hoverBackground);
}

/* NEVER — hardcode colors */
.bad { color: #333; background: white; }
```

## Accessibility Requirements

Every component MUST meet these accessibility standards:

1. **Keyboard navigation** — all interactive elements reachable via Tab/Shift+Tab
2. **ARIA attributes** — `role`, `aria-label`, `aria-expanded`, `aria-selected` where applicable
3. **Focus indicators** — visible focus ring using `outline: 1px solid var(--vscode-focusBorder)`
4. **Screen reader support** — meaningful text for all interactive elements
5. **Color contrast** — WCAG AA minimum (4.5:1 for text, 3:1 for large text/UI)
6. **Motion** — respect `prefers-reduced-motion` for animations
7. **Text scaling** — UI must remain functional at 200% zoom

```css
/* Focus indicator */
*:focus-visible {
  outline: 1px solid var(--vscode-focusBorder);
  outline-offset: -1px;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}
```

## Webview Security

Webview panels MUST follow security best practices:

```typescript
const panel = vscode.window.createWebviewPanel(
  'myComponent',
  'Title',
  vscode.ViewColumn.One,
  {
    enableScripts: true,
    localResourceRoots: [
      vscode.Uri.joinPath(context.extensionUri, 'media')
    ],
    // Never enable command URIs or external content
    enableCommandUris: false,
  }
);

// Use CSP in all webviews
function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const nonce = getNonce();
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'style.css')
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    style-src ${webview.cspSource};
    script-src 'nonce-${nonce}';
    img-src ${webview.cspSource} https:;
  ">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${styleUri}" rel="stylesheet">
</head>
<body>
  <!-- Component content -->
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
```

## Message Protocol

Communication between webview and extension:

```typescript
// Extension → Webview
panel.webview.postMessage({ type: 'update', data: { /* ... */ } });

// Webview → Extension
panel.webview.onDidReceiveMessage(
  message => {
    switch (message.type) {
      case 'action': handleAction(message.data); break;
      case 'error': handleError(message.error); break;
    }
  },
  undefined,
  context.subscriptions
);

// In webview script:
const vscode = acquireVsCodeApi();
vscode.postMessage({ type: 'action', data: { /* ... */ } });
```

## Testing Patterns

```typescript
// TreeView provider test
describe('MyTreeProvider', () => {
  it('returns root items', async () => {
    const provider = new MyTreeProvider();
    const items = await provider.getChildren();
    expect(items).toHaveLength(/* expected */);
  });

  it('returns child items', async () => {
    const provider = new MyTreeProvider();
    const roots = await provider.getChildren();
    const children = await provider.getChildren(roots[0]);
    expect(children).toBeDefined();
  });
});
```

## Rules

1. **Never use inline styles** — always use CSS with theme variables
2. **Never hardcode colors** — always use VS Code CSS custom properties
3. **Never use external CDN resources** — bundle everything locally
4. **Always set CSP** — Content Security Policy in all webviews
5. **Always dispose** — register all disposables with `context.subscriptions`
6. **Always test** — unit test providers, integration test webview communication
7. **Swedish for user-facing text** — all labels, titles, and messages in Swedish
8. **English for code** — identifiers, types, and JSDoc in English

## Checklist

- [ ] Component follows established directory structure
- [ ] Uses VS Code theme CSS custom properties for all colors
- [ ] Keyboard navigation works for all interactive elements
- [ ] ARIA attributes set for screen readers
- [ ] Focus indicators visible
- [ ] CSP set in webview HTML
- [ ] Local resources only (no external CDN)
- [ ] Disposables registered
- [ ] Unit tests written
- [ ] Works in light and dark themes
- [ ] Works at 200% zoom
- [ ] Swedish text for user-facing strings

## Capability Dependencies

- **File editing** — creating component files
- **Codebase search** — finding existing patterns to follow
- **Tool use** — running build and test commands

## Evolution Triggers

- Update when VS Code adds new UI APIs (e.g., new view container types)
- Update when accessibility standards evolve (WCAG updates)
- Update when the extension's design system changes

## Model Compatibility

| Model | Suitability | Notes |
|---|---|---|
| Copilot | Excellent | Native VS Code API knowledge |
| Claude | Good | Large context for understanding component interactions |
| GPT-4 | Good | Structured output for component templates |
| Gemini | Fair | Less VS Code-specific knowledge |
| Local models | Fair | Can handle simple component scaffolding |
