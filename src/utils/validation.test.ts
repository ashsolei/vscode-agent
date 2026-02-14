import { describe, it, expect } from 'vitest';
import {
  sanitizePath,
  isCommandSafe,
  safeJsonParse,
  validateAgentId,
  sanitizeForLog,
} from './validation';

// --- Tests ---

describe('sanitizePath', () => {
  it('returnerar en enkel sökväg oförändrad', () => {
    expect(sanitizePath('src/index.ts')).toBe('src/index.ts');
  });

  it('hanterar nästade sökvägar', () => {
    expect(sanitizePath('src/utils/helpers/file.ts')).toBe('src/utils/helpers/file.ts');
  });

  it('löser upp .. som stannar inom roten', () => {
    expect(sanitizePath('src/utils/../index.ts')).toBe('src/index.ts');
  });

  it('löser upp . segment', () => {
    expect(sanitizePath('src/./utils/./file.ts')).toBe('src/utils/file.ts');
  });

  it('kastar fel vid försök att lämna arbetsytan med ..', () => {
    expect(() => sanitizePath('../outside')).toThrow('Sökvägen försöker lämna arbetsytans rot');
  });

  it('kastar fel vid djup ..-traversering', () => {
    expect(() => sanitizePath('src/../../outside')).toThrow('Sökvägen försöker lämna arbetsytans rot');
  });

  it('kastar fel vid absolut sökväg (Unix)', () => {
    expect(() => sanitizePath('/etc/passwd')).toThrow('Absoluta sökvägar är inte tillåtna');
  });

  it('kastar fel vid absolut sökväg (Windows)', () => {
    expect(() => sanitizePath('C:\\Windows\\System32')).toThrow('Absoluta sökvägar är inte tillåtna');
  });

  it('ersätter bakåtsnedstreck med framåtsnedstreck', () => {
    expect(sanitizePath('src\\utils\\file.ts')).toBe('src/utils/file.ts');
  });

  it('hanterar upprepade snedstreck', () => {
    expect(sanitizePath('src//utils///file.ts')).toBe('src/utils/file.ts');
  });
});

describe('isCommandSafe', () => {
  it('godkänner vanliga kommandon', () => {
    expect(isCommandSafe('ls -la')).toBe(true);
    expect(isCommandSafe('npm install')).toBe(true);
    expect(isCommandSafe('git status')).toBe(true);
    expect(isCommandSafe('cat file.txt')).toBe(true);
  });

  it('avvisar rm -rf /', () => {
    expect(isCommandSafe('rm -rf /')).toBe(false);
  });

  it('avvisar mkfs', () => {
    expect(isCommandSafe('mkfs.ext4 /dev/sda1')).toBe(false);
  });

  it('avvisar fork bomb', () => {
    expect(isCommandSafe(':(){ :|:& };:')).toBe(false);
  });

  it('avvisar skrivning till /dev/', () => {
    expect(isCommandSafe('echo data > /dev/sda')).toBe(false);
  });

  it('avvisar dd if=', () => {
    expect(isCommandSafe('dd if=/dev/zero of=/dev/sda')).toBe(false);
  });

  it('avvisar chmod 777 /', () => {
    expect(isCommandSafe('chmod 777 /')).toBe(false);
  });
});

describe('safeJsonParse', () => {
  it('tolkar giltig JSON', () => {
    expect(safeJsonParse('{"a":1}', {})).toEqual({ a: 1 });
  });

  it('tolkar JSON-arrayer', () => {
    expect(safeJsonParse('[1,2,3]', [])).toEqual([1, 2, 3]);
  });

  it('returnerar reservvärde vid ogiltig JSON', () => {
    expect(safeJsonParse('inte json', { default: true })).toEqual({ default: true });
  });

  it('returnerar reservvärde vid tom sträng', () => {
    expect(safeJsonParse('', null)).toBeNull();
  });

  it('tolkar primitiva JSON-värden', () => {
    expect(safeJsonParse('42', 0)).toBe(42);
    expect(safeJsonParse('"text"', '')).toBe('text');
    expect(safeJsonParse('true', false)).toBe(true);
  });
});

describe('validateAgentId', () => {
  it('godkänner giltiga ID:n', () => {
    expect(validateAgentId('my-agent')).toBe(true);
    expect(validateAgentId('agent123')).toBe(true);
    expect(validateAgentId('a')).toBe(true);
    expect(validateAgentId('test-agent-v2')).toBe(true);
  });

  it('avvisar versaler', () => {
    expect(validateAgentId('MyAgent')).toBe(false);
  });

  it('avvisar mellanslag', () => {
    expect(validateAgentId('my agent')).toBe(false);
  });

  it('avvisar specialtecken', () => {
    expect(validateAgentId('agent_1')).toBe(false);
    expect(validateAgentId('agent@1')).toBe(false);
    expect(validateAgentId('agent.v2')).toBe(false);
  });

  it('avvisar tomt ID', () => {
    expect(validateAgentId('')).toBe(false);
  });

  it('avvisar ID längre än 50 tecken', () => {
    const longId = 'a'.repeat(51);
    expect(validateAgentId(longId)).toBe(false);
  });

  it('godkänner ID med exakt 50 tecken', () => {
    const maxId = 'a'.repeat(50);
    expect(validateAgentId(maxId)).toBe(true);
  });
});

describe('sanitizeForLog', () => {
  it('returnerar kort text oförändrad', () => {
    expect(sanitizeForLog('hello world')).toBe('hello world');
  });

  it('trunkerar text som överstiger maxlängden', () => {
    const longText = 'a'.repeat(600);
    const result = sanitizeForLog(longText);
    expect(result.length).toBe(501); // 500 + trunkeringstecken
    expect(result.endsWith('…')).toBe(true);
  });

  it('respekterar anpassad maxlängd', () => {
    const text = 'a'.repeat(20);
    const result = sanitizeForLog(text, 10);
    expect(result).toBe('a'.repeat(10) + '…');
  });

  it('tar bort kontrolltecken', () => {
    const text = 'hello\x00world\x01test\x7F';
    expect(sanitizeForLog(text)).toBe('helloworldtest');
  });

  it('behåller vanliga whitespace-tecken', () => {
    const text = 'rad1\nrad2\trad3\rrad4';
    expect(sanitizeForLog(text)).toBe('rad1\nrad2\trad3\rrad4');
  });

  it('returnerar tom sträng oförändrad', () => {
    expect(sanitizeForLog('')).toBe('');
  });
});
