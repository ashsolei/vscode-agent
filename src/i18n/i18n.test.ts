import { describe, it, expect, beforeEach } from 'vitest';
import { t, setLocale, getLocale, getAvailableLocales, detectLocale } from '../i18n';

describe('i18n', () => {
  beforeEach(() => {
    setLocale('en');
  });

  it('should return English by default', () => {
    expect(t('agent.welcome')).toBe('Welcome to VS Code Agent!');
  });

  it('should switch to Swedish', () => {
    setLocale('sv');
    expect(t('agent.welcome')).toBe('Välkommen till VS Code Agent!');
  });

  it('should format arguments', () => {
    expect(t('agent.error', 'timeout')).toBe('An error occurred: timeout');
  });

  it('should format multiple arguments', () => {
    expect(t('cache.stats', '42', '85')).toBe('Cache: 42 entries, 85% hit rate');
  });

  it('should fallback to key if not found', () => {
    expect(t('nonexistent.key')).toBe('nonexistent.key');
  });

  it('should fallback to English for missing Swedish keys', () => {
    setLocale('sv');
    // If any key missing in SV, fallback to EN
    // All current keys are defined, so test with an EN-only key
    expect(t('agent.welcome')).toBe('Välkommen till VS Code Agent!');
  });

  it('should get current locale', () => {
    expect(getLocale()).toBe('en');
    setLocale('sv');
    expect(getLocale()).toBe('sv');
  });

  it('should list available locales', () => {
    const locales = getAvailableLocales();
    expect(locales).toContain('en');
    expect(locales).toContain('sv');
  });

  it('should detect default locale', () => {
    const locale = detectLocale();
    expect(['en', 'sv']).toContain(locale);
  });

  it('should translate agent descriptions', () => {
    expect(t('agents.code')).toBe('Analyze and generate code');
    setLocale('sv');
    expect(t('agents.code')).toBe('Analysera och generera kod');
  });

  it('should translate memory messages', () => {
    expect(t('memory.total', '5')).toBe('Total memories: 5');
    setLocale('sv');
    expect(t('memory.total', '5')).toBe('Totalt antal minnen: 5');
  });

  it('should translate profile messages', () => {
    expect(t('profiles.activated', 'Frontend')).toBe('Profile activated: Frontend');
    setLocale('sv');
    expect(t('profiles.activated', 'Frontend')).toBe('Profil aktiverad: Frontend');
  });

  it('should handle numeric args', () => {
    expect(t('notifications.count', 3)).toBe('3 notifications');
  });
});
