import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { isNewNotificationTap, maybeAskForReview, recordAppOpen } from '../services/reviewService';

/** Bildirim ile uygulamaya giriş bu kadar yeniyse "hatırlatmadan geldi" sayılır. */
const TAP_WINDOW_MS = 6 * 60 * 60 * 1000;

/**
 * Mağaza yıldız penceresini mutlu anda açar. Sekme düzeninde BİR KEZ bağlanır.
 * - Maç hatırlatmasına dokunarak girince (≥2 gün kullanım) → 2,5 sn sonra
 * - Normal açılışta (≥5 gün kullanım) → 4 sn sonra
 * Ayrıntılı kurallar: services/reviewService.ts
 */
export function useReviewPrompt() {
  const response = Notifications.useLastNotificationResponse();
  const handledLaunch = useRef(false);

  // Bildirime dokunarak giriş (soğuk başlangıç dahil)
  useEffect(() => {
    if (!response) return;
    const n = response.notification;
    if (Date.now() - n.date > TAP_WINDOW_MS) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    isNewNotificationTap(n.request.identifier).then((yeni) => {
      if (yeni) timer = setTimeout(() => maybeAskForReview(true), 2500);
    });
    return () => timer && clearTimeout(timer);
  }, [response]);

  // Normal açılış + ön plana dönüş: gün sayımı ve uzun süreli kullanıcıya sorma
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => maybeAskForReview(false), 4000);
    };
    if (!handledLaunch.current) {
      handledLaunch.current = true;
      recordAppOpen().then(schedule);
    }
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') recordAppOpen().then(schedule);
    });
    return () => {
      sub.remove();
      if (timer) clearTimeout(timer);
    };
  }, []);
}
