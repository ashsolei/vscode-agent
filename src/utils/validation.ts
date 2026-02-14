/**
 * Valideringsverktyg för säker indatahantering i produktionsmiljö.
 */

/**
 * Normalisera en relativ sökväg och säkerställ att den inte lämnar arbetsytans rot.
 *
 * Ersätter bakåtsnedstreck med framåtsnedstreck, löser `.` och `..`-segment
 * och kastar ett fel om den resulterande sökvägen försöker lämna arbetsytans rot.
 *
 * @param relativePath - Den relativa sökvägen att sanera
 * @returns Den sanerade relativa sökvägen
 * @throws Error om sökvägen försöker lämna arbetsytans rot eller är absolut
 */
export function sanitizePath(relativePath: string): string {
  // Ersätt bakåtsnedstreck med framåtsnedstreck
  let normalized = relativePath.replace(/\\/g, '/');

  // Kontrollera om sökvägen är absolut
  if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) {
    throw new Error('Absoluta sökvägar är inte tillåtna');
  }

  // Lös `.` och `..`-segment manuellt
  const parts = normalized.split('/');
  const resolved: string[] = [];

  for (const part of parts) {
    if (part === '' || part === '.') {
      continue;
    }
    if (part === '..') {
      if (resolved.length === 0) {
        throw new Error('Sökvägen försöker lämna arbetsytans rot');
      }
      resolved.pop();
    } else {
      resolved.push(part);
    }
  }

  return resolved.join('/');
}

/** Mönster som anses farliga i skalkommandon */
const DANGEROUS_PATTERNS: RegExp[] = [
  /rm\s+-rf\s+\//,
  /mkfs/,
  /:\(\)\{/,
  />\s*\/dev\//,
  /dd\s+if=/,
  /chmod\s+777\s+\//,
];

/**
 * Kontrollera om ett skalkommando innehåller potentiellt farliga mönster.
 *
 * Returnerar `false` om kommandot matchar något känt farligt mönster,
 * annars `true`.
 *
 * @param command - Skalkommandot att kontrollera
 * @returns `true` om kommandot bedöms vara säkert, annars `false`
 */
export function isCommandSafe(command: string): boolean {
  return !DANGEROUS_PATTERNS.some((pattern) => pattern.test(command));
}

/**
 * Säker JSON-parsning som returnerar ett reservvärde vid fel.
 *
 * Omsluter `JSON.parse` i en try-catch och returnerar det angivna
 * reservvärdet om parsningen misslyckas.
 *
 * @param text - JSON-strängen att tolka
 * @param fallback - Värdet som returneras om parsningen misslyckas
 * @returns Det tolkade värdet eller reservvärdet
 */
export function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

/** Mönster för giltiga agent-ID:n: gemena alfanumeriska tecken och bindestreck, 1–50 tecken */
const AGENT_ID_PATTERN = /^[a-z0-9-]{1,50}$/;

/**
 * Validera att ett agent-ID är korrekt formaterat.
 *
 * Ett giltigt ID innehåller enbart gemena alfanumeriska tecken och bindestreck,
 * och är mellan 1 och 50 tecken långt.
 *
 * @param id - Agent-ID:t att validera
 * @returns `true` om ID:t är giltigt, annars `false`
 */
export function validateAgentId(id: string): boolean {
  return AGENT_ID_PATTERN.test(id);
}

/**
 * Trunkera och sanera text för säker loggning.
 *
 * Ersätter kontrolltecken och begränsar längden till det angivna maxvärdet.
 *
 * @param text - Texten att sanera
 * @param maxLength - Maximal längd på den returnerade strängen (standard: 500)
 * @returns Den sanerade texten
 */
export function sanitizeForLog(text: string, maxLength: number = 500): string {
  // Ersätt kontrolltecken (utom vanliga whitespace-tecken som \n, \r, \t)
  const cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  return cleaned.slice(0, maxLength) + '…';
}
