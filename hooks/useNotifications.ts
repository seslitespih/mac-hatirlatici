import { useState, useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  requestNotificationPermissions,
  scheduleAllNotifications,
  cancelAllNotifications,
} from '../services/notificationService';
import { getNotificationsEnabled, saveNotificationsEnabled, getCountry } from '../services/storageService';
import { fetchTRMatches } from '../services/hangikanalda';
import { fetchSportsDbMatches } from '../services/sportsDbService';
import { Match } from '../constants/matches';
import { useTranslation } from 'react-i18next';

export function useNotifications(selectedTeamIds: string[]) {
  const { i18n } = useTranslation();
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);
  // Cache fetched matches so re-scheduling (on team/lang change) doesn't re-fetch
  const matchesRef = useRef<Match[]>([]);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const enabled = await getNotificationsEnabled();
      if (mounted) setNotificationsEnabled(enabled);

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

  return {
    permissionGranted,
    notificationsEnabled,
    isLoading,
    toggleNotifications,
  };
}
