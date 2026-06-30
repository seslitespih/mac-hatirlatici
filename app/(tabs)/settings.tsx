import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Switch, Modal, SafeAreaView, StatusBar, FlatList,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { changeLanguage, SUPPORTED_LANGUAGES } from '../../i18n';
import { guessCountryFromLanguage } from '../../constants/countryChannels';
import { useTeams } from '../../hooks/useTeams';
import { useNotifications } from '../../hooks/useNotifications';
import { useCountry } from '../../contexts/CountryContext';
import { SUPPORTED_COUNTRIES } from '../../constants/countryChannels';
import { useTheme } from '../../contexts/ThemeContext';
import PaywallScreen from '../../components/PaywallScreen';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { selectedTeamIds } = useTeams();
  const { notificationsEnabled, toggleNotifications, permissionGranted } =
    useNotifications(selectedTeamIds);
  const { currentCountry, changeCountry } = useCountry();

  const [langModal,    setLangModal]    = useState(false);
  const [countryModal, setCountryModal] = useState(false);
  const [paywallModal, setPaywallModal] = useState(false);

  const handleLang    = async (code: string) => {
    await changeLanguage(code);
    const guessedCountry = guessCountryFromLanguage(code);
    await changeCountry(guessedCountry);
    setLangModal(false);
  };
  const handleCountry = async (code: string) => { await changeCountry(code); setCountryModal(false); };

  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language);
  const appVersion  = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.bg0 }]}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.bg0} />

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
      >
        {/* Header */}
        <View style={s.header}>
          <Text style={[s.headerTitle, { color: colors.text }]}>{t('settings.title')}</Text>
          <View style={[s.headerIconWrap, { backgroundColor: colors.accentGlow, borderColor: colors.border }]}>
            <Ionicons name="settings-outline" size={20} color={colors.accent} />
          </View>
        </View>

        {/* ── Notifications ── */}
        <Label text={t('settings.notifications')} color={colors.textMuted} />
        <Card bg={colors.bg2} border={colors.border}>
          <Row>
            <IconBox icon="notifications-outline" color={colors.purple} />
            <Col
              label={notificationsEnabled ? t('settings.notificationEnabled') : t('settings.notificationDisabled')}
              sub={t('settings.notificationsDesc')}
              textColor={colors.text}
              subColor={colors.textSub}
            />
            <Switch
              value={notificationsEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor="#fff"
            />
          </Row>
          {!permissionGranted && (
            <View style={s.warning}>
              <Ionicons name="warning-outline" size={13} color="#FFC107" />
              <Text style={s.warningTxt}>{t('settings.permissionWarning')}</Text>
            </View>
          )}
          <View style={[s.disclaimer, { backgroundColor: colors.accentGlow, borderColor: colors.border }]}>
            <Ionicons name="information-circle-outline" size={14} color={colors.accent} />
            <Text style={[s.disclaimerTxt, { color: colors.textSub }]}>
              {t('settings.noGoalDisclaimer')}
            </Text>
          </View>
        </Card>

        {/* ── Language ── */}
        <Label text={t('settings.language')} color={colors.textMuted} />
        <Card bg={colors.bg2} border={colors.border}>
          <TouchableOpacity style={s.row} onPress={() => setLangModal(true)} activeOpacity={0.75}>
            <IconBox icon="language-outline" color={colors.accent} />
            <Col
              label={t('settings.language')}
              sub={`${currentLang?.flag ?? ''} ${currentLang?.name ?? ''}`}
              textColor={colors.text}
              subColor={colors.textSub}
            />
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </Card>

        {/* ── Country ── */}
        <Label text={t('settings.country')} color={colors.textMuted} />
        <Card bg={colors.bg2} border={colors.border}>
          <TouchableOpacity style={s.row} onPress={() => setCountryModal(true)} activeOpacity={0.75}>
            <IconBox icon="tv-outline" color={colors.success} />
            <Col
              label={t('settings.country')}
              sub={`${currentCountry.flag} ${i18n.language === 'tr' ? currentCountry.name : currentCountry.englishName}`}
              textColor={colors.text}
              subColor={colors.textSub}
            />
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
          <View style={s.infoRow}>
            <Ionicons name="information-circle-outline" size={12} color={colors.textMuted} />
            <Text style={[s.infoTxt, { color: colors.textMuted }]}>{t('settings.countryDesc')}</Text>
          </View>
        </Card>

        {/* ── Premium ── */}
        <Label text="PREMIUM" color={colors.textMuted} />
        <TouchableOpacity
          style={[s.premiumBtn, { backgroundColor: colors.accent }]}
          onPress={() => setPaywallModal(true)}
          activeOpacity={0.82}
        >
          <Ionicons name="star" size={18} color="#fff" />
          <Text style={s.premiumTxt}>Get Premium — 10-Day Free Trial</Text>
          <Ionicons name="chevron-forward" size={16} color="#fff" />
        </TouchableOpacity>

        {/* ── About ── */}
        <Label text={t('settings.about')} color={colors.textMuted} />
        <Card bg={colors.bg2} border={colors.border}>
          <View style={s.aboutRow}>
            <View style={[s.aboutIcon, { backgroundColor: colors.bg3, borderColor: colors.border }]}>
              <Text style={{ fontSize: 28 }}>⚽</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.appName, { color: colors.text }]}>{t('settings.appName')}</Text>
              <Text style={[s.appVer, { color: colors.accent }]}>v{appVersion}</Text>
              <Text style={[s.appDesc, { color: colors.textSub }]}>{t('settings.appDesc')}</Text>
            </View>
          </View>
        </Card>
      </ScrollView>

      {/* Paywall Modal */}
      <Modal visible={paywallModal} animationType="slide" onRequestClose={() => setPaywallModal(false)}>
        <PaywallScreen onSubscribed={() => setPaywallModal(false)} />
        <TouchableOpacity
          style={[s.closePaywall, { backgroundColor: colors.bg2, borderColor: colors.border }]}
          onPress={() => setPaywallModal(false)}
        >
          <Ionicons name="close" size={20} color={colors.text} />
        </TouchableOpacity>
      </Modal>

      {/* Language Modal */}
      <BottomModal
        visible={langModal}
        onClose={() => setLangModal(false)}
        title={t('settings.selectLanguage')}
        colors={colors}
      >
        <FlatList
          data={SUPPORTED_LANGUAGES}
          keyExtractor={(item) => item.code}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                s.listItem,
                { borderBottomColor: colors.bg3 },
                i18n.language === item.code && { backgroundColor: colors.accentGlow },
              ]}
              onPress={() => handleLang(item.code)}
              activeOpacity={0.75}
            >
              <Text style={s.listFlag}>{item.flag}</Text>
              <Text style={[s.listName, { color: colors.text }]}>{item.name}</Text>
              {i18n.language === item.code && (
                <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
              )}
            </TouchableOpacity>
          )}
        />
      </BottomModal>

      {/* Country Modal */}
      <BottomModal
        visible={countryModal}
        onClose={() => setCountryModal(false)}
        title={t('settings.selectCountry')}
        colors={colors}
      >
        <FlatList
          data={SUPPORTED_COUNTRIES}
          keyExtractor={(item) => item.code}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                s.listItem,
                { borderBottomColor: colors.bg3 },
                currentCountry.code === item.code && { backgroundColor: colors.accentGlow },
              ]}
              onPress={() => handleCountry(item.code)}
              activeOpacity={0.75}
            >
              <Text style={s.listFlag}>{item.flag}</Text>
              <Text style={[s.listName, { color: colors.text }]}>
                {i18n.language === 'tr' ? item.name : item.englishName}
              </Text>
              {currentCountry.code === item.code && (
                <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
              )}
            </TouchableOpacity>
          )}
        />
      </BottomModal>
    </SafeAreaView>
  );
}

// ─── Small components ─────────────────────────────────────────────────────────

function Label({ text, color }: { text: string; color: string }) {
  return <Text style={[s.label, { color }]}>{text.toUpperCase()}</Text>;
}

function Card({ children, bg, border }: { children: React.ReactNode; bg: string; border: string }) {
  return <View style={[s.card, { backgroundColor: bg, borderColor: border }]}>{children}</View>;
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

function Col({ label, sub, textColor, subColor }: {
  label: string; sub: string; textColor: string; subColor: string;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[s.rowLabel, { color: textColor }]}>{label}</Text>
      <Text style={[s.rowSub, { color: subColor }]}>{sub}</Text>
    </View>
  );
}

function BottomModal({
  visible, onClose, title, children, colors,
}: {
  visible: boolean; onClose: () => void; title: string;
  children: React.ReactNode; colors: any;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={[s.modalBox, { backgroundColor: colors.bg2, borderTopColor: colors.border }]}>
          <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[s.modalTitle, { color: colors.text }]}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={20} color={colors.textSub} />
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
  safe:    { flex: 1 },
  scroll:  { flex: 1 },
  content: { paddingBottom: 48 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  headerIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },

  label: {
    fontSize: 10, fontWeight: '700',
    letterSpacing: 1.2, marginHorizontal: 20, marginTop: 22, marginBottom: 8,
  },

  card: {
    marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', borderWidth: 1,
  },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  iconBox: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowSub:   { fontSize: 12, marginTop: 2 },

  warning: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,193,7,0.08)',
    marginHorizontal: 16, marginBottom: 10,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(255,193,7,0.2)',
  },
  warningTxt: { color: '#FFC107', fontSize: 11, flex: 1, lineHeight: 16 },

  disclaimer: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 7,
    marginHorizontal: 16, marginBottom: 14,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1,
  },
  disclaimerTxt: { fontSize: 11, flex: 1, lineHeight: 17 },

  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 16, paddingBottom: 12,
  },
  infoTxt: { fontSize: 11, flex: 1, lineHeight: 15 },

  aboutRow: {
    flexDirection: 'row', alignItems: 'center', padding: 16, gap: 16,
  },
  aboutIcon: {
    width: 56, height: 56, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  appName: { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  appVer:  { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  appDesc: { fontSize: 12 },

  premiumBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, borderRadius: 16,
    paddingHorizontal: 18, paddingVertical: 16,
  },
  premiumTxt: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '700' },

  closePaywall: {
    position: 'absolute', top: 52, right: 16,
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },

  overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBox: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '75%', paddingBottom: 28, borderTopWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 18, borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 16, fontWeight: '700' },

  listItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1,
  },
  listFlag: { fontSize: 24 },
  listName: { fontSize: 15, fontWeight: '500', flex: 1 },
});
