/**
 * VS Code API mock för enhetstester.
 * Mockarna tillhandahåller tillräckligt av VS Code API:et
 * för att kunna testa agenter och infrastruktur utan runtime.
 */
import { vi } from 'vitest';

export const Uri = {
  file: (path: string) => ({ scheme: 'file', fsPath: path, path, toString: () => path }),
  parse: (str: string) => ({ scheme: 'file', fsPath: str, path: str, toString: () => str }),
  joinPath: (base: any, ...segments: string[]) => {
    const joined = [base.path ?? base.fsPath ?? '', ...segments].join('/');
    return { scheme: 'file', fsPath: joined, path: joined, toString: () => joined };
  },
};

export class ThemeIcon {
  constructor(public readonly id: string) {}
}

export class MarkdownString {
  constructor(public value: string = '') {}
  appendMarkdown(text: string) { this.value += text; return this; }
  appendText(text: string) { this.value += text; return this; }
}

export enum QuickPickItemKind {
  Separator = -1,
  Default = 0,
}

export enum StatusBarAlignment {
  Left = 1,
  Right = 2,
}

export class EventEmitter<T> {
  private listeners: ((e: T) => void)[] = [];
  event = (listener: (e: T) => void) => {
    this.listeners.push(listener);
    return { dispose: () => { this.listeners = this.listeners.filter(l => l !== listener); } };
  };
  fire(data: T) { this.listeners.forEach(l => l(data)); }
  dispose() { this.listeners = []; }
}

export const window = {
  showInformationMessage: vi.fn().mockResolvedValue(undefined),
  showWarningMessage: vi.fn().mockResolvedValue(undefined),
  showErrorMessage: vi.fn().mockResolvedValue(undefined),
  showInputBox: vi.fn().mockResolvedValue(undefined),
  showQuickPick: vi.fn().mockResolvedValue(undefined),
  showOpenDialog: vi.fn().mockResolvedValue(undefined),
  createOutputChannel: vi.fn().mockReturnValue({
    appendLine: vi.fn(),
    append: vi.fn(),
    show: vi.fn(),
    dispose: vi.fn(),
  }),
  createStatusBarItem: vi.fn().mockReturnValue({
    text: '',
    tooltip: '',
    command: '',
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
  }),
  createWebviewPanel: vi.fn().mockReturnValue({
    webview: { html: '', onDidReceiveMessage: vi.fn() },
    reveal: vi.fn(),
    onDidDispose: vi.fn(),
    dispose: vi.fn(),
  }),
  createTerminal: vi.fn().mockReturnValue({
    sendText: vi.fn(),
    show: vi.fn(),
    dispose: vi.fn(),
  }),
  createTreeView: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  activeTextEditor: undefined,
  withProgress: vi.fn().mockImplementation((_opts: any, task: any) => task({ report: vi.fn() })),
};

export const workspace = {
  workspaceFolders: undefined as any,
  getConfiguration: vi.fn().mockReturnValue({
    get: vi.fn().mockReturnValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
  }),
  openTextDocument: vi.fn().mockResolvedValue({ getText: vi.fn().mockReturnValue('') }),
  createFileSystemWatcher: vi.fn().mockReturnValue({
    onDidChange: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    onDidCreate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    onDidDelete: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    dispose: vi.fn(),
  }),
  onDidSaveTextDocument: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  onDidOpenTextDocument: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  onDidCloseTextDocument: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  onDidChangeTextDocument: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  findFiles: vi.fn().mockResolvedValue([]),
  asRelativePath: vi.fn((uri: any) => typeof uri === 'string' ? uri : uri?.fsPath ?? ''),
  fs: {
    readFile: vi.fn().mockResolvedValue(Buffer.from('')),
    writeFile: vi.fn().mockResolvedValue(undefined),
    createDirectory: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockResolvedValue({ type: 1 }),
    readDirectory: vi.fn().mockResolvedValue([]),
  },
};

export const commands = {
  registerCommand: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  executeCommand: vi.fn().mockResolvedValue(undefined),
};

export const languages = {
  registerCodeLensProvider: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  getDiagnostics: vi.fn().mockReturnValue([]),
  onDidChangeDiagnostics: vi.fn().mockReturnValue({ dispose: vi.fn() }),
};

export const extensions = {
  getExtension: vi.fn().mockReturnValue(undefined),
};

export const env = {
  openExternal: vi.fn().mockResolvedValue(true),
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(''),
  },
};

export const chat = {
  createChatParticipant: vi.fn().mockReturnValue({
    iconPath: undefined,
    followupProvider: undefined,
    dispose: vi.fn(),
  }),
};

export class CancellationTokenSource {
  token = { isCancellationRequested: false, onCancellationRequested: vi.fn() };
  cancel() { (this.token as any).isCancellationRequested = true; }
  dispose() {}
}

export const LanguageModelChatMessage = {
  User: (content: string) => ({ role: 'user', content }),
  Assistant: (content: string) => ({ role: 'assistant', content }),
};

export class LanguageModelError extends Error {
  constructor(message: string) { super(message); this.name = 'LanguageModelError'; }
}

export const ChatResponseTurn = class {
  response: any[] = [];
  constructor(public readonly participant: string, public readonly command?: string) {}
};

export enum ViewColumn {
  One = 1,
  Two = 2,
  Three = 3,
}

export enum ProgressLocation {
  Notification = 15,
  SourceControl = 1,
  Window = 10,
}

export enum DiagnosticSeverity {
  Error = 0,
  Warning = 1,
  Information = 2,
  Hint = 3,
}

export enum FileType {
  Unknown = 0,
  File = 1,
  Directory = 2,
  SymbolicLink = 64,
}

export class Range {
  constructor(
    public readonly start: Position,
    public readonly end: Position,
  ) {}
}

export class Position {
  constructor(
    public readonly line: number,
    public readonly character: number,
  ) {}
}

export class Selection extends Range {
  constructor(
    public readonly anchor: Position,
    public readonly active: Position,
  ) {
    super(anchor, active);
  }
  get isEmpty(): boolean {
    return this.start.line === this.end.line && this.start.character === this.end.character;
  }
}

export class RelativePattern {
  constructor(
    public readonly base: any,
    public readonly pattern: string,
  ) {}
}

export class ThemeColor {
  constructor(public readonly id: string) {}
}

export class CodeLens {
  constructor(public range: Range, public command?: any) {}
}

export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2,
}

export class TreeItem {
  label?: string;
  id?: string;
  description?: string;
  tooltip?: any;
  iconPath?: any;
  command?: any;
  contextValue?: string;
  collapsibleState?: TreeItemCollapsibleState;

  constructor(label: string, collapsibleState?: TreeItemCollapsibleState) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}

export const ChatRequestTurn = class {
  constructor(
    public readonly prompt: string,
    public readonly command?: string,
    public readonly participant?: string
  ) {}
};

export const lm = {
  selectChatModels: vi.fn().mockResolvedValue([]),
};
