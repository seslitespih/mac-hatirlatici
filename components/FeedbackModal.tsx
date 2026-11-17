import React, { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { sendFeedback } from '../services/reviewService';

/** Ayarlar → "Öneri / sorun bildir": mesaj geliştiriciye e-postayla gider. */
export default function FeedbackModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  const close = () => {
    onClose();
    if (state === 'sent') {
      setMessage('');
      setEmail('');
    }
    setState('idle');
  };

  const send = async () => {
    if (message.trim().length < 2 || state === 'sending') return;
    setState('sending');
    const ok = await sendFeedback(message, email, i18n.language);
    setState(ok ? 'sent' : 'failed');
  };

  const canSend = message.trim().length >= 2 && state !== 'sending';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView
        style={s.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[s.box, { backgroundColor: colors.bg2, borderTopColor: colors.border }]}>
          <View style={[s.header, { borderBottomColor: colors.border }]}>
            <Text style={[s.title, { color: colors.text }]}>{t('feedback.title')}</Text>
            <TouchableOpacity onPress={close} hitSlop={10}>
              <Ionicons name="close" size={20} color={colors.textSub} />
            </TouchableOpacity>
          </View>

          {state === 'sent' ? (
            <View style={s.done}>
              <Ionicons name="checkmark-circle" size={48} color={colors.success} />
              <Text style={[s.doneTxt, { color: colors.text }]}>{t('feedback.sent')}</Text>
              <TouchableOpacity style={[s.btn, { backgroundColor: colors.accent }]} onPress={close}>
                <Text style={s.btnTxt}>{t('feedback.close')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
              <Text style={[s.desc, { color: colors.textSub }]}>{t('feedback.desc')}</Text>
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder={t('feedback.messagePlaceholder')}
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={2000}
                autoFocus
                textAlignVertical="top"
                style={[s.input, s.msg, { color: colors.text, backgroundColor: colors.bg1, borderColor: colors.border }]}
              />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder={t('feedback.emailPlaceholder')}
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={[s.input, { color: colors.text, backgroundColor: colors.bg1, borderColor: colors.border }]}
              />
              {state === 'failed' && <Text style={s.err}>{t('feedback.failed')}</Text>}
              <TouchableOpacity
                style={[s.btn, { backgroundColor: colors.accent, opacity: canSend ? 1 : 0.45 }]}
                onPress={send}
                disabled={!canSend}
                activeOpacity={0.85}
              >
                {state === 'sending'
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.btnTxt}>{t('feedback.send')}</Text>}
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  box: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', paddingBottom: 28, borderTopWidth: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 18, borderBottomWidth: 1,
  },
  title: { fontSize: 16, fontWeight: '700' },
  body: { padding: 20, gap: 12 },
  desc: { fontSize: 13, lineHeight: 19 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  msg: { minHeight: 120, maxHeight: 220 },
  err: { color: '#E53935', fontSize: 13 },
  btn: { borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  btnTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
  done: { alignItems: 'center', padding: 28, gap: 14 },
  doneTxt: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
});
