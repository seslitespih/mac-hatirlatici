import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Link, Stack } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';

export default function NotFound() {
  const { colors } = useTheme();
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!', headerShown: true }} />
      <View style={[styles.container, { backgroundColor: colors.bg0 }]}>
        <Text style={styles.emoji}>⚽</Text>
        <Text style={[styles.title, { color: colors.text }]}>Page Not Found</Text>
        <Text style={[styles.subtitle, { color: colors.textSub }]}>This page does not exist.</Text>
        <Link href="/" asChild>
          <TouchableOpacity style={[styles.button, { backgroundColor: colors.accent }]}>
            <Text style={styles.buttonText}>Go to Home</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emoji:     { fontSize: 72, marginBottom: 16 },
  title:     { fontSize: 24, fontWeight: '800', marginBottom: 8 },
  subtitle:  { fontSize: 16, marginBottom: 32, textAlign: 'center' },
  button:    { borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14 },
  buttonText:{ color: '#ffffff', fontSize: 15, fontWeight: '700' },
});
