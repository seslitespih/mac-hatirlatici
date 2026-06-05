import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Switch, Modal, SafeAreaView, StatusBar, FlatList,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { changeLanguage, SUPPORTED_LANGUAGES } from '../../i18n';
import { useTeams } from '../../hooks/useTeams';
import { useNotifications } from '../../hooks/useNotifications';
import { useCountry } from '../../hooks/useCountry';
import { SUPPORTED_COUNTRIES } from '../../constants/countryChannels';
import { getTheme, saveTheme, AppTheme } from '../../services/storageService';

// ─── Navy color palette (uygulamayla tutarlı) ─────────────────────────────────

const C = {
  bg0:      '#060C1A',
  bg1:      '#0A1628',
  bg2:      '#0F2040',
  bg3:      '#152B52',
  accent:   '#4F8EF7',
  accentGlow: 'rgba(79,142,247,0.15)',
  text:     '#F0F4FF',
  textSub:  '#7B9CC4',
  textMuted:'#3D5A80',
  border:   '#1A3560',
  live:     '#EF4444',
  success:  '#10B981',
};

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { selectedTeamIds } = useTeams();
  const { notificationsEnabled, toggleNotifications, permissionGranted } =
    useNotifications(selectedTeamIds);
  const { currentCountry, changeCountry } = useCountry();

  const [theme, setTheme] = useState<AppTheme>('dark');
  const [langModal, setLangModal] = useState(false);
  const [countryModal, setCountryModal] = useState(false);

  useEffect(() => { getTheme().then(setTheme); }, []);

  const handleTheme = async (value: AppTheme) => { setTheme(value); await saveTheme(value); };
  const handleLang  = async (code: string)    => { await changeLanguage(code); setLangModal(false); };
  const handleCountry = async (code: string)  => { await changeCountry(code); setCountryModal(false); };

  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language);
  const appVersion  = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg0} />

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
      >
        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>{t('settings.title')}</Text>
          <View style={s.headerIconWrap}>
            <Ionicons name="settings-outline" size={20} color={C.accent} />
          </View>
        </View>

        {/* ── Notifications ── */}
        <Label text={t('settings.notifications')} />
        <Card>
          <Row>
            <IconBox icon="notifications-outline" color="#6B4EF8" />
            <Col
              label={notificationsEnabled ? t('settings.notificationEnabled') : t('settings.notificationDisabled')}
              sub={t('settings.notificationsDesc')}
            />
            <Switch
              value={notificationsEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ false: C.border, true: C.accent }}
              thumbColor="#fff"
            />
          </Row>
          {!permissionGranted && (
            <View style={s.warning}>
              <Ionicons name="warning-outline" size={13} color="#FFC107" />
              <Text style={s.warningTxt}>{t('settings.permissionWarning')}</Text>
            </View>
          )}
        </Card>

        {/* ── Language ── */}
        <Label text={t('settings.language')} />
        <Card>
          <TouchableOpacity style={s.row} onPress={() => setLangModal(true)} activeOpacity={0.75}>
            <IconBox icon="language-outline" color={C.accent} />
            <Col label={t('settings.language')} sub={`${currentLang?.flag ?? ''} ${currentLang?.name ?? ''}`} />
            <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
          </TouchableOpacity>
        </Card>

        {/* ── Country ── */}
        <Label text={t('settings.country')} />
        <Card>
          <TouchableOpacity style={s.row} onPress={() => setCountryModal(true)} activeOpacity={0.75}>
            <IconBox icon="tv-outline" color={C.success} />
            <Col label={t('settings.country')} sub={`${currentCountry.flag} ${currentCountry.name}`} />
            <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
          </TouchableOpacity>
          <View style={s.infoRow}>
            <Ionicons name="information-circle-outline" size={12} color={C.textMuted} />
            <Text style={s.infoTxt}>{t('settings.countryDesc')}</Text>
          </View>
        </Card>

        {/* ── Theme ── */}
        <Label text={t('settings.theme')} />
        <Card>
          <View style={s.themeRow}>
            <ThemeBtn label={t('settings.dark')}  icon="moon"  active={theme === 'dark'}  onPress={() => handleTheme('dark')} />
            <ThemeBtn label={t('settings.light')} icon="sunny" active={theme === 'light'} onPress={() => handleTheme('light')} />
          </View>
        </Card>

        {/* ── About ── */}
        <Label text={t('settings.about')} />
        <Card>
          <View style={s.aboutRow}>
            <View style={s.aboutIcon}>
              <Text style={{ fontSize: 28 }}>⚽</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.appName}>Hangi Kanalda?</Text>
              <Text style={[s.appVer, { color: C.accent }]}>v{appVersion}</Text>
              <Text style={s.appDesc}>Maçları doğru kanal ve saatle takip et.</Text>
            </View>
          </View>
        </Card>
      </ScrollView>

      {/* Language Modal */}
      <BottomModal visible={langModal} onClose={() => setLangModal(false)} title={t('settings.selectLanguage')}>
        <FlatList
          data={SUPPORTED_LANGUAGES}
          keyExtractor={(item) => item.code}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.listItem, i18n.language === item.code && s.listItemActive]}
              onPress={() => handleLang(item.code)}
              activeOpacity={0.75}
            >
              <Text style={s.listFlag}>{item.flag}</Text>
              <Text style={s.listName}>{item.name}</Text>
              {i18n.language === item.code && (
                <Ionicons name="checkmark-circle" size={20} color={C.accent} />
              )}
            </TouchableOpacity>
          )}
        />
      </BottomModal>

      {/* Country Modal */}
      <BottomModal visible={countryModal} onClose={() => setCountryModal(false)} title={t('settings.selectCountry')}>
        <FlatList
          data={SUPPORTED_COUNTRIES}
          keyExtractor={(item) => item.code}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.listItem, currentCountry.code === item.code && s.listItemActive]}
              onPress={() => handleCountry(item.code)}
              activeOpacity={0.75}
            >
              <Text style={s.listFlag}>{item.flag}</Text>
              <Text style={s.listName}>{item.name}</Text>
              {currentCountry.code === item.code && (
                <Ionicons name="checkmark-circle" size={20} color={C.accent} />
              )}
            </TouchableOpacity>
          )}
        />
      </BottomModal>
    </SafeAreaView>
  );
}

// ─── Small components ─────────────────────────────────────────────────────────

function Label({ text }: { text: string }) {
  return (
    <Text style={s.label}>{text.toUpperCase()}</Text>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={s.card}>{children}</View>;
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={s.row}>{children}</View>;
}

function IconBox({ icon, color }: { icon: React.ComponentProps<typeof Ionicons>['name']; color: string }) {
  return (
    <View style={[s.iconBox, { backgroundColor: color + '22' }]}>
      <Ionicons name={icon} size={18} color={color} />
    </View>
  );
}

function Col({ label, sub }: { label: string; sub: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowSub}>{sub}</Text>
    </View>
  );
}

function ThemeBtn({
  label, icon, active, onPress,
}: {
  label: string;
  icon: 'moon' | 'sunny';
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[s.themeBtn, active && { backgroundColor: C.accentGlow, borderColor: C.accent }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Ionicons name={icon} size={18} color={active ? C.accent : C.textMuted} />
      <Text style={[s.themeBtnLabel, active && { color: C.accent }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function BottomModal({
  visible, onClose, title, children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.modalBox}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={20} color={C.textSub} />
            </TouchableOpacity>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg0 },
  scroll:  { flex: 1 },
  content: { paddingBottom: 48 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6,
  },
  headerTitle: { color: C.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  headerIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.accentGlow, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border,
  },

  label: {
    color: C.textMuted, fontSize: 10, fontWeight: '700',
    letterSpacing: 1.2, marginHorizontal: 20, marginTop: 22, marginBottom: 8,
  },

  card: {
    backgroundColor: C.bg2, marginHorizontal: 16, borderRadius: 16,
    overflow: 'hidden', borderWidth: 1, borderColor: C.border,
  },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  iconBox: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  rowLabel: { color: C.text, fontSize: 15, fontWeight: '600' },
  rowSub:   { color: C.textSub, fontSize: 12, marginTop: 2 },

  warning: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,193,7,0.08)',
    marginHorizontal: 16, marginBottom: 12,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(255,193,7,0.2)',
  },
  warningTxt: { color: '#FFC107', fontSize: 11, flex: 1, lineHeight: 16 },

  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 16, paddingBottom: 12,
  },
  infoTxt: { color: C.textMuted, fontSize: 11, flex: 1, lineHeight: 15 },

  themeRow: { flexDirection: 'row', padding: 12, gap: 10 },
  themeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.bg3, borderRadius: 10, paddingVertical: 12, gap: 7,
    borderWidth: 1, borderColor: C.border,
  },
  themeBtnLabel: { color: C.textMuted, fontSize: 13, fontWeight: '600' },

  aboutRow: {
    flexDirection: 'row', alignItems: 'center', padding: 16, gap: 16,
  },
  aboutIcon: {
    width: 56, height: 56, borderRadius: 14, backgroundColor: C.bg3,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  appName: { color: C.text,    fontSize: 16, fontWeight: '800', marginBottom: 2 },
  appVer:  { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  appDesc: { color: C.textSub, fontSize: 12 },

  // Modal
  overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: C.bg2, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '75%', paddingBottom: 28,
    borderTopWidth: 1, borderColor: C.border,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 18,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  modalTitle: { color: C.text, fontSize: 16, fontWeight: '700' },

  listItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.bg3,
  },
  listItemActive: { backgroundColor: C.accentGlow },
  listFlag:       { fontSize: 24 },
  listName:       { color: C.text, fontSize: 15, fontWeight: '500', flex: 1 },
});
