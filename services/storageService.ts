import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  SELECTED_TEAMS: '@selected_teams',
  NOTIFICATIONS_ENABLED: '@notifications_enabled',
  THEME: '@app_theme',
  LANGUAGE: '@app_language',
  COUNTRY: '@app_country',
};

export type AppTheme = 'dark' | 'light';

// ─── Selected Teams ────────────────────────────────────────────────────────────

// Build 16: milli takım ID'leri Türkçe'den İngilizce'ye geçirildi (TheSportsDB uyumu)
const TEAM_ID_MIGRATION: Record<string, string> = {
  turkiye:  'turkey',
  almanya:  'germany',
  ispanya:  'spain',
  fransa:   'france',
  ingiltere:'england',
  brezilya: 'brazil',
  arjantin: 'argentina',
  portekiz: 'portugal',
};
const MIGRATION_KEY = '@teams_migrated_v16';

export async function migrateTeamIds(): Promise<void> {
  try {
    if (await AsyncStorage.getItem(MIGRATION_KEY)) return;
    const raw = await AsyncStorage.getItem(KEYS.SELECTED_TEAMS);
    if (raw) {
      const ids = JSON.parse(raw) as string[];
      const migrated = ids.map(id => TEAM_ID_MIGRATION[id] ?? id);
      if (JSON.stringify(migrated) !== JSON.stringify(ids)) {
        await AsyncStorage.setItem(KEYS.SELECTED_TEAMS, JSON.stringify(migrated));
      }
    }
    await AsyncStorage.setItem(MIGRATION_KEY, '1');
  } catch { /* */ }
}

export async function getSelectedTeams(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SELECTED_TEAMS);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export async function saveSelectedTeams(teamIds: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.SELECTED_TEAMS, JSON.stringify(teamIds));
  } catch (_) {}
}

// ─── Notifications ─────────────────────────────────────────────────────────────

export async function getNotificationsEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.NOTIFICATIONS_ENABLED);
    if (raw === null) return true; // default ON
    return JSON.parse(raw) as boolean;
  } catch {
    return true;
  }
}

export async function saveNotificationsEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.NOTIFICATIONS_ENABLED, JSON.stringify(enabled));
  } catch (_) {}
}

// ─── Theme ──────────────────────────────────────────────────────────────────────

export async function getTheme(): Promise<AppTheme> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.THEME);
    if (!raw) return 'dark';
    return raw as AppTheme;
  } catch {
    return 'dark';
  }
}

export async function saveTheme(theme: AppTheme): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.THEME, theme);
  } catch (_) {}
}

// ─── Language ───────────────────────────────────────────────────────────────────

export async function getLanguage(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.LANGUAGE);
    return raw || 'en';   // varsayılan: İngilizce (cihaz dilinden tespit edilirse üzerine yazılır)
  } catch {
    return 'en';
  }
}

export async function saveLanguage(lang: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.LANGUAGE, lang);
  } catch (_) {}
}

// ─── Country ─────────────────────────────────────────────────────────────────

export async function getCountry(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.COUNTRY);
    return raw || '';   // empty = not set yet (will be guessed from language)
  } catch {
    return '';
  }
}

export async function saveCountry(countryCode: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.COUNTRY, countryCode);
  } catch (_) {}
}
