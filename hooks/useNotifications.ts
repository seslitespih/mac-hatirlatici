import { useState, useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  requestNotificationPermissions,
  scheduleAllNotifications,
  cancelAllNotifications,
} from '../services/notificationService';
import {
  getNotificationsEnabled, saveNotificationsEnabled, getCountry,
  getNotifySports, saveNotifySports, NOTIFY_SPORTS_ALL, NotifySport,
} from '../services/storageService';
import { fetchTRMatches } from '../services/hangikanalda';
import { fetchSportsDbMatches } from '../services/sportsDbService';
import { Match } from '../constants/matches';
import { useTranslation } from 'react-i18next';

export function useNotifications(selectedTeamIds: string[]) {
  const { i18n } = useTranslation();
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notifySports, setNotifySports] = useState<NotifySport[]>(NOTIFY_SPORTS_ALL);
  const [isLoading, setIsLoading] = useState(true);
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);
  // Cache fetched matches so re-scheduling (on team/lang change) doesn't re-fetch
  const matchesRef = useRef<Match[]>([]);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const enabled = await getNotificationsEnabled();
      const sports  = await getNotifySports();
      if (mounted) {
        setNotificationsEnabled(enabled);
        setNotifySports(sports);
      }

      const granted = await requestNotificationPermissions();
      if (mounted) {
        setPermissionGranted(granted);
        setIsLoading(false);
      }

      if (granted && enabled) {
        const countryCode = (await getCountry()) ?? 'TR';
        const matches = countryCode === 'TR'
          ? await fetchTRMatches()
          : await fetchSportsDbMatches(countryCode);
        matchesRef.current = matches;
        if (mounted) {
          await scheduleAllNotifications(selectedTeamIds, matches, i18n.language);
        }
      }
    }

    init();

    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('Notification received:', notification.request.content.body);
      },
    );

    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('Notification tapped:', response.notification.request.content.data);
      },
    );

    return () => {
      mounted = false;
      if (notificationListener.current) notificationListener.current.remove();
      if (responseListener.current) responseListener.current.remove();
    };
  }, []);

  // Re-schedule when selected teams or language changes (use cached matches)
  useEffect(() => {
    if (permissionGranted && notificationsEnabled && matchesRef.current.length > 0) {
      scheduleAllNotifications(selectedTeamIds, matchesRef.current, i18n.language);
    }
  }, [selectedTeamIds, i18n.language, permissionGranted, notificationsEnabled]);

  async function toggleNotifications() {
    const newValue = !notificationsEnabled;

    if (newValue && !permissionGranted) {
      // İzin yok — yeniden iste; hâlâ yoksa iOS Ayarları'na yönlendir
      const granted = await requestNotificationPermissions();
      if (granted) {
        setPermissionGranted(true);
      } else {
        await Linking.openSettings();
        return;
      }
    }

    setNotificationsEnabled(newValue);
    await saveNotificationsEnabled(newValue);

    if (newValue) {
      if (matchesRef.current.length === 0) {
        const countryCode = (await getCountry()) ?? 'TR';
        matchesRef.current = countryCode === 'TR'
          ? await fetchTRMatches()
          : await fetchSportsDbMatches(countryCode);
      }
      await scheduleAllNotifications(selectedTeamIds, matchesRef.current, i18n.language);
    } else {
      await cancelAllNotifications();
    }
  }

  /**
   * Bir spor dalının bildirimini açar/kapatır.
   * Son açık dal kapatılamaz — hepsi kapalıyken kullanıcı sessizce bildirimsiz kalır;
   * bunun yerine üstteki bildirim anahtarını kapatması gerekir.
   */
  async function toggleSport(sport: NotifySport) {
    const acik = notifySports.includes(sport);
    if (acik && notifySports.length === 1) return;
    const yeni = acik
      ? notifySports.filter((s) => s !== sport)
      : NOTIFY_SPORTS_ALL.filter((s) => s === sport || notifySports.includes(s));

    setNotifySports(yeni);
    await saveNotifySports(yeni);

    // Yerel bildirimleri yeniden kur ve sunucuya yeni dal listesini bildir.
    if (permissionGranted && notificationsEnabled) {
      if (matchesRef.current.length === 0) {
        const countryCode = (await getCountry()) ?? 'TR';
        matchesRef.current = countryCode === 'TR'
          ? await fetchTRMatches()
          : await fetchSportsDbMatches(countryCode);
      }
      await scheduleAllNotifications(selectedTeamIds, matchesRef.current, i18n.language);
    }
  }

  return {
    permissionGranted,
    notificationsEnabled,
    notifySports,
    toggleSport,
    isLoading,
    toggleNotifications,
  };
}
