---
name: "VS Code API Guide"
description: "Expert guide to VS Code Extension APIs used in this project — Chat Participant, Language Model, workspace, commands, and more"
argument-hint: "Which API area? e.g. 'Chat Participant API' or 'language model' or 'file system'"
---

# VS Code API Guide Skill

Expert reference for VS Code APIs used in the Agent extension.

## Chat Participant API (Core)

The extension registers a Chat Participant via `package.json`:
```json
"chatParticipants": [{
    "id": "agent.agent",
    "name": "agent",
    "fullName": "VS Code Agent",
    "description": "...",
    "commands": [{ "name": "code", "description": "..." }, ...]
}]
```

### Registration
```typescript
const participant = vscode.chat.createChatParticipant(
    'agent.agent',
    handler
);
participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media/icon.png');
```

### Handler Signature
```typescript
async function handler(
    request: vscode.ChatRequest,
    context: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
): Promise<vscode.ChatResult>
```

### ChatRequest
```typescript
interface ChatRequest {
    prompt: string;                          // user's message text
    command?: string;                        // slash command (e.g., 'code')
    references: readonly ChatPromptReference[]; // @-mentions, #file refs
}
```

### ChatResponseStream
```typescript
interface ChatResponseStream {
    markdown(value: string | MarkdownString): void;   // stream markdown text
    anchor(value: Uri | Location, title?: string): void; // clickable file link
    button(command: Command): void;                    // action button
    progress(value: string): void;                     // progress message
    reference(value: Uri | Location): void;            // file reference
    push(part: ChatResponsePart): void;                // raw part
}
```

### ChatResult
```typescript
interface ChatResult {
    metadata?: Record<string, unknown>;
    followUps?: ChatFollowup[];  // suggested next questions
}
```

## Language Model API

```typescript
// Select a model
const [model] = await vscode.lm.selectChatModels({
    vendor: 'copilot',
    family: 'gpt-4o'
});

// Create messages
const messages = [
    vscode.LanguageModelChatMessage.User('Hello'),
    vscode.LanguageModelChatMessage.Assistant('How can I help?'),
];

// Send request (streaming)
const response = await model.sendRequest(messages, {}, token);
for await (const fragment of response.text) {
    stream.markdown(fragment);
}
```

### Model Properties
```typescript
interface LanguageModelChat {
    readonly id: string;
    readonly name: string;
    readonly vendor: string;
    readonly family: string;
    readonly version: string;
    readonly maxInputTokens: number;
    sendRequest(messages, options, token): Thenable<LanguageModelChatResponse>;
    countTokens(text): Thenable<number>;
}
```

## Workspace API

```typescript
// Workspace folders
const folders = vscode.workspace.workspaceFolders;
const root = folders?.[0]?.uri.fsPath;

// Find files (glob pattern)
const files = await vscode.workspace.findFiles('**/*.ts', '**/node_modules/**');

// Read file
const doc = await vscode.workspace.openTextDocument(uri);
const content = doc.getText();

// File system
const data = await vscode.workspace.fs.readFile(uri);
await vscode.workspace.fs.writeFile(uri, Buffer.from(content));
await vscode.workspace.fs.delete(uri);

// Configuration
const config = vscode.workspace.getConfiguration('vscodeAgent');
const value = config.get<string>('locale', 'auto');

// File watcher
const watcher = vscode.workspace.createFileSystemWatcher('**/.agentrc.json');
watcher.onDidChange(uri => { /* reload config */ });
```

## Commands API

```typescript
// Register command
const disposable = vscode.commands.registerCommand(
    'vscodeAgent.healthCheck',
    async () => { /* command body */ }
);
context.subscriptions.push(disposable);

// Execute command
await vscode.commands.executeCommand('workbench.action.openSettings', 'vscodeAgent');
```

## Window API

```typescript
// Information messages
await vscode.window.showInformationMessage('Agent registered');
await vscode.window.showErrorMessage('Agent failed');

// Quick pick
const choice = await vscode.window.showQuickPick(['option1', 'option2'], {
    placeHolder: 'Choose an option'
});

// Progress
await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Processing...' },
    async (progress) => {
        progress.report({ increment: 50, message: 'Halfway...' });
    }
);

// Status bar
const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
item.text = '$(robot) Agent';
item.show();
```

## Diagnostics API

```typescript
// Get all diagnostics
const allDiags = vscode.languages.getDiagnostics();

// Get diagnostics for a specific file
const fileDiags = vscode.languages.getDiagnostics(uri);

// Create diagnostic collection (for agents that produce diagnostics)
const collection = vscode.languages.createDiagnosticCollection('agent');
collection.set(uri, [
    new vscode.Diagnostic(range, 'message', vscode.DiagnosticSeverity.Warning)
]);
```

## WebView API

Used by `AgentDashboard` in `src/dashboard/agent-dashboard.ts`:
```typescript
const panel = vscode.window.createWebviewPanel(
    'agentDashboard',
    'Agent Dashboard',
    vscode.ViewColumn.One,
    { enableScripts: true }  // enable JS in WebView
);
panel.webview.html = getHtmlContent();
```

## Key Constraints

- **No `require()` for user files** — only the VS Code API and built-in Node.js
- **Extension host process** — runs in Node.js, NOT in the browser
- **Activation events** — extension activates on chat participant invocation
- **Disposables** — all registrations must be pushed to `context.subscriptions`
- **CancellationToken** — always check `token.isCancellationRequested` in loops
