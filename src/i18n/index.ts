/**
 * i18n – Internationalization support for VS Code Agent
 *
 * Usage:
 *   import { t, setLocale } from './i18n';
 *   t('agent.welcome')  // => "Welcome to VS Code Agent!"
 *   setLocale('sv');
 *   t('agent.welcome')  // => "Välkommen till VS Code Agent!"
 */

export type Locale = 'en' | 'sv';

export interface MessageBundle {
  [key: string]: string;
}

const bundles: Record<Locale, MessageBundle> = {
  en: {
    // General
    'agent.welcome': 'Welcome to VS Code Agent!',
    'agent.ready': 'Agent is ready.',
    'agent.error': 'An error occurred: {0}',
    'agent.cancelled': 'Operation cancelled.',
    'agent.noAgent': 'No agent found for command: {0}',
    'agent.processing': 'Processing...',
    'agent.done': 'Done!',
    'agent.confirm': 'Are you sure?',

    // Agents
    'agents.code': 'Analyze and generate code',
    'agents.docs': 'Search and generate documentation',
    'agents.task': 'Manage tasks and planning',
    'agents.status': 'Show agent status and configuration',
    'agents.refactor': 'Refactor and improve code structure',
    'agents.test': 'Generate tests and test strategies',
    'agents.git': 'Git operations and version control',
    'agents.security': 'Security review and vulnerability scanning',
    'agents.perf': 'Performance analysis and optimization',
    'agents.debug': 'Debugging and bug analysis',
    'agents.review': 'Code review and quality analysis',
    'agents.architect': 'Software architecture and system design',

    // Memory
    'memory.saved': 'Memory saved: {0}',
    'memory.cleared': 'Memory cleared for {0}.',
    'memory.stats': 'Memory Stats',
    'memory.total': 'Total memories: {0}',
    'memory.noMemories': 'No memories stored.',

    // Profiles
    'profiles.activated': 'Profile activated: {0}',
    'profiles.deactivated': 'Profile deactivated.',
    'profiles.created': 'Profile created: {0}',
    'profiles.notFound': 'Profile not found: {0}',
    'profiles.current': 'Current profile: {0}',
    'profiles.none': 'No active profile.',

    // Cache
    'cache.hit': 'Cache hit for: {0}',
    'cache.miss': 'Cache miss for: {0}',
    'cache.cleared': 'Cache cleared.',
    'cache.stats': 'Cache: {0} entries, {1}% hit rate',

    // Conversations
    'conversations.saved': 'Conversation saved: {0}',
    'conversations.loaded': 'Conversation loaded: {0}',
    'conversations.new': 'New conversation started.',
    'conversations.count': '{0} conversations stored.',

    // Telemetry
    'telemetry.cleared': 'Telemetry data cleared.',
    'telemetry.calls': 'Total calls: {0}',
    'telemetry.successRate': 'Success rate: {0}%',

    // Snippets
    'snippets.saved': 'Snippet saved: {0}',
    'snippets.deleted': 'Snippet deleted.',
    'snippets.inserted': 'Snippet inserted.',
    'snippets.empty': 'No snippets saved.',

    // Notifications
    'notifications.none': 'No notifications.',
    'notifications.cleared': 'All notifications cleared.',
    'notifications.count': '{0} notifications',

    // Marketplace
    'marketplace.installed': 'Agent installed: {0}',
    'marketplace.uninstalled': 'Agent uninstalled: {0}',
    'marketplace.noResults': 'No agents found.',

    // Walkthrough
    'walkthrough.title': 'Getting Started with Agent',
    'walkthrough.step1': 'Open the chat panel and type @agent to start',
    'walkthrough.step2': 'Use slash commands like /code, /docs, /test',
    'walkthrough.step3': 'Activate a profile to customize agent behavior',
    'walkthrough.step4': 'Check Agent Explorer in the sidebar for an overview',

    // Commands
    'cmd.clearState': 'Agent: Clear shared state',
    'cmd.showState': 'Agent: Show shared state',
    'cmd.showDashboard': 'Agent: Show Dashboard',
    'cmd.showMemory': 'Agent: Show memory stats',
    'cmd.clearMemory': 'Agent: Clear agent memory',
    'cmd.undo': 'Agent: Undo last agent change',
    'cmd.switchProfile': 'Agent: Switch profile',
    'cmd.showConversations': 'Agent: Show conversations',
    'cmd.showAnalytics': 'Agent: Show analytics dashboard',
    'cmd.showMarketplace': 'Agent: Open Marketplace',
  },

  sv: {
    // General
    'agent.welcome': 'Välkommen till VS Code Agent!',
    'agent.ready': 'Agenten är redo.',
    'agent.error': 'Ett fel uppstod: {0}',
    'agent.cancelled': 'Åtgärden avbröts.',
    'agent.noAgent': 'Ingen agent hittades för kommando: {0}',
    'agent.processing': 'Bearbetar...',
    'agent.done': 'Klart!',
    'agent.confirm': 'Är du säker?',

    // Agents
    'agents.code': 'Analysera och generera kod',
    'agents.docs': 'Sök och generera dokumentation',
    'agents.task': 'Hantera uppgifter och planering',
    'agents.status': 'Visa agentens tillstånd och konfiguration',
    'agents.refactor': 'Refaktorera och förbättra kodstruktur',
    'agents.test': 'Generera tester och teststrategier',
    'agents.git': 'Git-operationer och versionshantering',
    'agents.security': 'Säkerhetsgranskning och sårbarhetsskanning',
    'agents.perf': 'Prestandaanalys och optimering',
    'agents.debug': 'Felsökning och bugganalys',
    'agents.review': 'Kodgranskning och kvalitetsanalys',
    'agents.architect': 'Mjukvaruarkitektur och systemdesign',

    // Memory
    'memory.saved': 'Minne sparat: {0}',
    'memory.cleared': 'Minne rensat för {0}.',
    'memory.stats': 'Minnesstatistik',
    'memory.total': 'Totalt antal minnen: {0}',
    'memory.noMemories': 'Inga minnen lagrade.',

    // Profiles
    'profiles.activated': 'Profil aktiverad: {0}',
    'profiles.deactivated': 'Profil avaktiverad.',
    'profiles.created': 'Profil skapad: {0}',
    'profiles.notFound': 'Profil hittades inte: {0}',
    'profiles.current': 'Nuvarande profil: {0}',
    'profiles.none': 'Ingen aktiv profil.',

    // Cache
    'cache.hit': 'Cache-träff för: {0}',
    'cache.miss': 'Cache-miss för: {0}',
    'cache.cleared': 'Cache rensad.',
    'cache.stats': 'Cache: {0} poster, {1}% träfffrekvens',

    // Conversations
    'conversations.saved': 'Konversation sparad: {0}',
    'conversations.loaded': 'Konversation laddad: {0}',
    'conversations.new': 'Ny konversation startad.',
    'conversations.count': '{0} konversationer lagrade.',

    // Telemetry
    'telemetry.cleared': 'Telemetridata rensad.',
    'telemetry.calls': 'Totala anrop: {0}',
    'telemetry.successRate': 'Lyckfrekvens: {0}%',

    // Snippets
    'snippets.saved': 'Snippet sparad: {0}',
    'snippets.deleted': 'Snippet borttagen.',
    'snippets.inserted': 'Snippet infogad.',
    'snippets.empty': 'Inga snippets sparade.',

    // Notifications
    'notifications.none': 'Inga notifieringar.',
    'notifications.cleared': 'Alla notifieringar rensade.',
    'notifications.count': '{0} notifieringar',

    // Marketplace
    'marketplace.installed': 'Agent installerad: {0}',
    'marketplace.uninstalled': 'Agent avinstallerad: {0}',
    'marketplace.noResults': 'Inga agenter hittades.',

    // Walkthrough
    'walkthrough.title': 'Kom igång med Agent',
    'walkthrough.step1': 'Öppna chattpanelen och skriv @agent för att börja',
    'walkthrough.step2': 'Använd slash-kommandon som /code, /docs, /test',
    'walkthrough.step3': 'Aktivera en profil för att anpassa agentens beteende',
    'walkthrough.step4': 'Kolla Agent Explorer i sidopanelen för en överblick',

    // Commands
    'cmd.clearState': 'Agent: Rensa delat tillstånd',
    'cmd.showState': 'Agent: Visa delat tillstånd',
    'cmd.showDashboard': 'Agent: Visa Dashboard',
    'cmd.showMemory': 'Agent: Visa minnesstatistik',
    'cmd.clearMemory': 'Agent: Rensa agentminne',
    'cmd.undo': 'Agent: Ångra senaste agent-ändring',
    'cmd.switchProfile': 'Agent: Byt profil',
    'cmd.showConversations': 'Agent: Visa konversationer',
    'cmd.showAnalytics': 'Agent: Visa analytics dashboard',
    'cmd.showMarketplace': 'Agent: Öppna Marketplace',
  },
};

let currentLocale: Locale = 'en';

/**
 * Set the active locale
 */
export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

/**
 * Get the current locale
 */
export function getLocale(): Locale {
  return currentLocale;
}

/**
 * Get available locales
 */
export function getAvailableLocales(): Locale[] {
  return Object.keys(bundles) as Locale[];
}

/**
 * Translate a message key, with optional format args ({0}, {1}, ...)
 */
export function t(key: string, ...args: (string | number)[]): string {
  const bundle = bundles[currentLocale] ?? bundles.en;
  let message = bundle[key] ?? bundles.en[key] ?? key;

  for (let i = 0; i < args.length; i++) {
    message = message.replace(`{${i}}`, String(args[i]));
  }

  return message;
}

/**
 * Detect locale from VS Code environment
 */
export function detectLocale(): Locale {
  try {
    // VS Code sets VSCODE_NLS_CONFIG
    const nlsConfig = process.env.VSCODE_NLS_CONFIG;
    if (nlsConfig) {
      const config = JSON.parse(nlsConfig);
      const lang = config.locale?.substring(0, 2);
      if (lang && lang in bundles) {
        return lang as Locale;
      }
    }
  } catch {
    // ignore
  }
  return 'en';
}

/**
 * Initialize i18n with auto-detection
 */
export function initI18n(): void {
  const locale = detectLocale();
  setLocale(locale);
}
