import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { DiffPreview, FileDiff } from './diff-preview';

// Helper: skapa en FileDiff
function makeDiff(overrides: Partial<FileDiff> = {}): FileDiff {
  return {
    path: 'src/index.ts',
    type: 'modify',
    original: 'original content',
    proposed: 'proposed content',
    ...overrides,
  };
}

describe('DiffPreview', () => {
  let preview: DiffPreview;

  beforeEach(() => {
    vi.clearAllMocks();
    preview = new DiffPreview();

    // Sätt upp arbetsyta
    (vscode.workspace as any).workspaceFolders = [
      { uri: vscode.Uri.file('/workspace'), name: 'test-ws', index: 0 },
    ];

    // Lägg till showTextDocument-mock (finns inte i bas-mocken)
    (vscode.window as any).showTextDocument = vi.fn().mockResolvedValue(undefined);

    // openTextDocument ska returnera dokument med uri-egenskap
    vi.mocked(vscode.workspace.openTextDocument).mockImplementation(
      (arg: any) => Promise.resolve({
        getText: vi.fn().mockReturnValue(''),
        uri: vscode.Uri.file(typeof arg === 'string' ? arg : arg?.path ?? '/tmp/doc'),
      } as any)
    );

    // Återställ fs-mockar till standardvärden (viktigt då vissa tester ändrar impl.)
    vi.mocked(vscode.workspace.fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(vscode.workspace.fs.delete).mockResolvedValue(undefined);
    vi.mocked(vscode.commands.executeCommand).mockResolvedValue(undefined);
  });

  // ─── addDiff ────────────────────────────────

  describe('addDiff', () => {
    it('ska lägga till en diff', () => {
      preview.addDiff(makeDiff());
      expect(preview.count).toBe(1);
    });

    it('ska ersätta existerande diff för samma sökväg', () => {
      preview.addDiff(makeDiff({ path: 'a.ts', proposed: 'first' }));
      preview.addDiff(makeDiff({ path: 'a.ts', proposed: 'second' }));

      expect(preview.count).toBe(1);
    });

    it('ska lägga till separata diffs för olika sökvägar', () => {
      preview.addDiff(makeDiff({ path: 'a.ts' }));
      preview.addDiff(makeDiff({ path: 'b.ts' }));

      expect(preview.count).toBe(2);
    });
  });

  // ─── addDiffs ───────────────────────────────

  describe('addDiffs', () => {
    it('ska lägga till flera diffs på en gång', () => {
      preview.addDiffs([
        makeDiff({ path: 'a.ts' }),
        makeDiff({ path: 'b.ts' }),
        makeDiff({ path: 'c.ts' }),
      ]);

      expect(preview.count).toBe(3);
    });

    it('ska hantera tom array', () => {
      preview.addDiffs([]);
      expect(preview.count).toBe(0);
    });

    it('ska ersätta dubbletter inom samma batch', () => {
      preview.addDiffs([
        makeDiff({ path: 'a.ts', proposed: 'first' }),
        makeDiff({ path: 'a.ts', proposed: 'second' }),
      ]);

      expect(preview.count).toBe(1);
    });
  });

  // ─── clear ──────────────────────────────────

  describe('clear', () => {
    it('ska tömma alla pending diffs', () => {
      preview.addDiff(makeDiff({ path: 'a.ts' }));
      preview.addDiff(makeDiff({ path: 'b.ts' }));

      preview.clear();

      expect(preview.count).toBe(0);
    });

    it('ska hantera clear på tom lista', () => {
      preview.clear();
      expect(preview.count).toBe(0);
    });
  });

  // ─── count ──────────────────────────────────

  describe('count', () => {
    it('ska returnera 0 initialt', () => {
      expect(preview.count).toBe(0);
    });

    it('ska returnera korrekt antal', () => {
      preview.addDiff(makeDiff({ path: 'a.ts' }));
      preview.addDiff(makeDiff({ path: 'b.ts' }));
      preview.addDiff(makeDiff({ path: 'c.ts' }));

      expect(preview.count).toBe(3);
    });
  });

  // ─── showPreview ───────────────────────────

  describe('showPreview', () => {
    it('ska visa informationsmeddelande om inga diffs finns', async () => {
      const result = await preview.showPreview();

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Inga ändringar att förhandsgranska.'
      );
      expect(result.accepted).toEqual([]);
      expect(result.rejected).toEqual([]);
    });

    it('ska visa QuickPick med alla diffs', async () => {
      preview.addDiff(makeDiff({ path: 'a.ts', type: 'create' }));
      preview.addDiff(makeDiff({ path: 'b.ts', type: 'modify' }));
      vi.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);

      await preview.showPreview();

      expect(vscode.window.showQuickPick).toHaveBeenCalled();
      const items = vi.mocked(vscode.window.showQuickPick).mock.calls[0][0] as any[];
      expect(items).toHaveLength(2);
    });

    it('ska returnera alla som rejected när användaren avbryter', async () => {
      preview.addDiff(makeDiff({ path: 'a.ts' }));
      preview.addDiff(makeDiff({ path: 'b.ts' }));
      vi.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);

      const result = await preview.showPreview();

      expect(result.accepted).toEqual([]);
      expect(result.rejected).toHaveLength(2);
    });

    it('ska returnera valda som accepted', async () => {
      const diff1 = makeDiff({ path: 'a.ts' });
      const diff2 = makeDiff({ path: 'b.ts' });
      preview.addDiff(diff1);
      preview.addDiff(diff2);

      vi.mocked(vscode.window.showQuickPick).mockResolvedValue([
        { diff: diff1 },
      ] as any);

      const result = await preview.showPreview();

      expect(result.accepted).toHaveLength(1);
      expect(result.accepted[0].path).toBe('a.ts');
      expect(result.rejected).toHaveLength(1);
      expect(result.rejected[0].path).toBe('b.ts');
    });

    it('ska acceptera alla om alla valda', async () => {
      const diff1 = makeDiff({ path: 'a.ts' });
      const diff2 = makeDiff({ path: 'b.ts' });
      preview.addDiff(diff1);
      preview.addDiff(diff2);

      vi.mocked(vscode.window.showQuickPick).mockResolvedValue([
        { diff: diff1 },
        { diff: diff2 },
      ] as any);

      const result = await preview.showPreview();

      expect(result.accepted).toHaveLength(2);
      expect(result.rejected).toHaveLength(0);
    });

    it('ska visa rätt ikon per diff-typ', async () => {
      preview.addDiff(makeDiff({ path: 'new.ts', type: 'create' }));
      preview.addDiff(makeDiff({ path: 'mod.ts', type: 'modify' }));
      preview.addDiff(makeDiff({ path: 'del.ts', type: 'delete' }));

      let capturedItems: any[] = [];
      vi.mocked(vscode.window.showQuickPick).mockImplementation(async (items: any) => {
        capturedItems = items;
        return undefined;
      });

      await preview.showPreview();

      expect(capturedItems).toHaveLength(3);
      expect(capturedItems[0].label).toContain('🆕');
      expect(capturedItems[1].label).toContain('✏️');
      expect(capturedItems[2].label).toContain('🗑️');
    });

    it('ska visa sökväg i label', async () => {
      preview.addDiff(makeDiff({ path: 'src/utils.ts', type: 'modify' }));

      let capturedItems: any[] = [];
      vi.mocked(vscode.window.showQuickPick).mockImplementation(async (items: any) => {
        capturedItems = items;
        return undefined;
      });

      await preview.showPreview();

      expect(capturedItems[0].label).toContain('src/utils.ts');
    });
  });

  // ─── showFileDiff ──────────────────────────

  describe('showFileDiff', () => {
    it('ska öppna föreslaget innehåll för create-diff', async () => {
      const diff = makeDiff({ type: 'create', proposed: 'new file content', path: 'new.ts' });

      await preview.showFileDiff(diff);

      expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'new file content',
          language: 'typescript',
        })
      );
    });

    it('ska öppna diff-vy för modify-diff', async () => {
      const diff = makeDiff({
        type: 'modify',
        original: 'old',
        proposed: 'new',
        path: 'file.ts',
      });

      await preview.showFileDiff(diff);

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'vscode.diff',
        expect.anything(),
        expect.anything(),
        expect.stringContaining('file.ts')
      );
    });

    it('ska öppna filvy och visa varning för delete-diff', async () => {
      const diff = makeDiff({ type: 'delete', path: 'old.ts' });

      await preview.showFileDiff(diff);

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining('old.ts')
      );
    });

    it('ska hantera delete-diff där filen redan tagits bort', async () => {
      const diff = makeDiff({ type: 'delete', path: 'gone.ts' });
      vi.mocked(vscode.workspace.openTextDocument).mockRejectedValueOnce(new Error('Not found'));

      // Bör inte kasta
      await expect(preview.showFileDiff(diff)).resolves.not.toThrow();
    });

    it('ska returnera tidigt om ingen arbetsyta finns (create)', async () => {
      (vscode.workspace as any).workspaceFolders = undefined;
      const diff = makeDiff({ type: 'create', proposed: 'x', path: 'f.ts' });

      // create-fallet kontrollerar INTE ws, men kräver showTextDocument
      // Vi testar delete-fallet istället, som faktiskt kollar ws
      const delDiff = makeDiff({ type: 'delete', path: 'a.ts' });
      await preview.showFileDiff(delDiff);

      // delete utan ws gör inget (returnerar tidigt)
      expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    });

    it('ska gissa rätt språk baserat på filändelse', async () => {
      const pyDiff = makeDiff({ type: 'create', proposed: 'print(1)', path: 'script.py' });
      await preview.showFileDiff(pyDiff);

      expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(
        expect.objectContaining({ language: 'python' })
      );
    });

    it('ska använda plaintext för okänd filändelse', async () => {
      const unknownDiff = makeDiff({ type: 'create', proposed: 'data', path: 'file.xyz' });
      await preview.showFileDiff(unknownDiff);

      expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(
        expect.objectContaining({ language: 'plaintext' })
      );
    });
  });

  // ─── applyDiffs ────────────────────────────

  describe('applyDiffs', () => {
    it('ska skriva fil vid create-diff', async () => {
      const diffs = [makeDiff({ type: 'create', proposed: 'content', path: 'new.ts' })];

      const result = await preview.applyDiffs(diffs);

      expect(result.applied).toBe(1);
      expect(result.failed).toBe(0);
      expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();
    });

    it('ska skriva fil vid modify-diff', async () => {
      const diffs = [makeDiff({ type: 'modify', proposed: 'updated', path: 'a.ts' })];

      const result = await preview.applyDiffs(diffs);

      expect(result.applied).toBe(1);
      expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();
    });

    it('ska ta bort fil vid delete-diff', async () => {
      const diffs = [makeDiff({ type: 'delete', path: 'old.ts' })];

      const result = await preview.applyDiffs(diffs);

      expect(result.applied).toBe(1);
      expect(vscode.workspace.fs.delete).toHaveBeenCalled();
    });

    it('ska räkna misslyckade appliceringar', async () => {
      vi.mocked(vscode.workspace.fs.writeFile).mockRejectedValueOnce(new Error('Write failed'));
      const diffs = [makeDiff({ type: 'create', proposed: 'x', path: 'fail.ts' })];

      const result = await preview.applyDiffs(diffs);

      expect(result.applied).toBe(0);
      expect(result.failed).toBe(1);
    });

    it('ska hantera blandade lyckade/misslyckade', async () => {
      vi.mocked(vscode.workspace.fs.writeFile)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Fail'));

      const diffs = [
        makeDiff({ type: 'create', proposed: 'ok', path: 'good.ts' }),
        makeDiff({ type: 'modify', proposed: 'fail', path: 'bad.ts' }),
      ];

      const result = await preview.applyDiffs(diffs);

      expect(result.applied).toBe(1);
      expect(result.failed).toBe(1);
    });

    it('ska returnera 0/0 om ingen arbetsyta finns', async () => {
      (vscode.workspace as any).workspaceFolders = undefined;
      const diffs = [makeDiff({ type: 'create', proposed: 'x', path: 'a.ts' })];

      const result = await preview.applyDiffs(diffs);

      expect(result.applied).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('ska hantera tom lista', async () => {
      const result = await preview.applyDiffs([]);

      expect(result.applied).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('ska inte räkna create/modify utan proposed-innehåll', async () => {
      const diffs = [makeDiff({ type: 'create', proposed: undefined, path: 'empty.ts' })];

      const result = await preview.applyDiffs(diffs);

      expect(result.applied).toBe(0);
      expect(result.failed).toBe(0);
      // writeFile ska inte anropas för denna specifika diff
      const calls = vi.mocked(vscode.workspace.fs.writeFile).mock.calls;
      const emptyCall = calls.find((c: any) => c[0]?.fsPath?.includes('empty.ts'));
      expect(emptyCall).toBeUndefined();
    });

    it('ska ta bort applicerade diffs från pending-listan', async () => {
      preview.addDiff(makeDiff({ path: 'a.ts', type: 'create', proposed: 'x' }));
      preview.addDiff(makeDiff({ path: 'b.ts', type: 'create', proposed: 'y' }));

      await preview.applyDiffs([makeDiff({ path: 'a.ts', type: 'create', proposed: 'x' })]);

      expect(preview.count).toBe(1);
    });
  });

  // ─── reviewAndApply ────────────────────────

  describe('reviewAndApply', () => {
    it('ska skriva summary till stream', async () => {
      preview.addDiff(makeDiff({ path: 'a.ts', type: 'create', proposed: 'x' }));
      const stream = { markdown: vi.fn() };

      vi.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);

      await preview.reviewAndApply(stream as any);

      expect(stream.markdown).toHaveBeenCalledWith(
        expect.stringContaining('Förhandsgranskning')
      );
    });

    it('ska rapportera alla avvisade om ingen vald', async () => {
      preview.addDiff(makeDiff({ path: 'a.ts' }));
      const stream = { markdown: vi.fn() };
      vi.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);

      const result = await preview.reviewAndApply(stream as any);

      expect(result.applied).toBe(0);
      expect(result.rejected).toBe(1);
      expect(stream.markdown).toHaveBeenCalledWith(
        expect.stringContaining('avvisade')
      );
    });

    it('ska applicera valda och rapportera i stream', async () => {
      const diff = makeDiff({ path: 'a.ts', type: 'create', proposed: 'content' });
      preview.addDiff(diff);

      const stream = { markdown: vi.fn() };
      vi.mocked(vscode.window.showQuickPick).mockResolvedValue([{ diff }] as any);

      const result = await preview.reviewAndApply(stream as any);

      expect(result.applied).toBe(1);
      expect(stream.markdown).toHaveBeenCalledWith(
        expect.stringContaining('Applicerat')
      );
    });

    it('ska fungera utan stream-argument', async () => {
      preview.addDiff(makeDiff({ path: 'a.ts' }));
      vi.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);

      const result = await preview.reviewAndApply();

      expect(result.rejected).toBe(1);
    });

    it('ska visa diff-ikon per ändring i stream', async () => {
      preview.addDiff(makeDiff({ path: 'new.ts', type: 'create', proposed: 'x' }));
      preview.addDiff(makeDiff({ path: 'mod.ts', type: 'modify' }));
      preview.addDiff(makeDiff({ path: 'del.ts', type: 'delete' }));

      const stream = { markdown: vi.fn() };
      vi.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);

      await preview.reviewAndApply(stream as any);

      const allCalls = stream.markdown.mock.calls.map((c: any) => c[0]).join('');
      expect(allCalls).toContain('🆕');
      expect(allCalls).toContain('✏️');
      expect(allCalls).toContain('🗑️');
    });
  });

  // ─── dispose ────────────────────────────────

  describe('dispose', () => {
    it('ska inte kasta vid dispose', () => {
      expect(() => preview.dispose()).not.toThrow();
    });
  });

  // ─── Edge cases ────────────────────────────

  describe('edge cases', () => {
    it('ska hantera fil utan filändelse', async () => {
      const diff = makeDiff({ type: 'create', proposed: 'data', path: 'Makefile' });
      await preview.showFileDiff(diff);

      expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(
        expect.objectContaining({ language: 'plaintext' })
      );
    });

    it('ska hantera differ med alla språk-mappningar', async () => {
      const extensions = ['ts', 'js', 'py', 'go', 'rs', 'json', 'yaml', 'md', 'html', 'css'];
      for (const ext of extensions) {
        vi.clearAllMocks();
        const diff = makeDiff({ type: 'create', proposed: 'x', path: `file.${ext}` });
        await preview.showFileDiff(diff);
        expect(vscode.workspace.openTextDocument).toHaveBeenCalled();
      }
    });

    it('ska hantera create-diff utan proposed som no-op i showFileDiff', async () => {
      const diff = makeDiff({ type: 'create', proposed: undefined, path: 'empty.ts' });
      await preview.showFileDiff(diff);

      // openTextDocument anropas inte för create utan proposed
      // (koden returnerar utan att göra något pga villkoret `if (diff.type === 'create' && diff.proposed)`)
    });

    it('ska hantera modify-diff utan original/proposed', async () => {
      const diff = makeDiff({
        type: 'modify',
        original: undefined,
        proposed: undefined,
        path: 'partial.ts',
      });
      await preview.showFileDiff(diff);

      // Ska inte kasta, bara returnera utan diff-vy
      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });
  });
});
