import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: string;
  componentStack: string;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: '', componentStack: '' };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error: error?.message ?? String(error) };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const stack = info?.componentStack ?? '';
    this.setState({ componentStack: stack });
    AsyncStorage.setItem('__last_crash', JSON.stringify({
      message: error?.message,
      stack: error?.stack?.slice(0, 2000),
      componentStack: stack.slice(0, 2000),
      ts: new Date().toISOString(),
    })).catch(() => {});
    console.error('CRASH:', error?.message, stack);
  }

  render() {
    if (this.state.hasError) {
      const lines = this.state.componentStack
        .split('\n')
        .filter(l => l.trim())
        .slice(0, 12)
        .join('\n');

      return (
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.emoji}>⚠️</Text>
          <Text style={styles.title}>Crash Detayı</Text>
          <Text style={styles.msg}>{this.state.error}</Text>
          <View style={styles.stack}>
            <Text style={styles.stackTxt}>{lines || 'Component stack yok'}</Text>
          </View>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => this.setState({ hasError: false, error: '', componentStack: '' })}
          >
            <Text style={styles.btnTxt}>Tekrar Dene</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#0D1B3E',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emoji: { fontSize: 40, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 6 },
  msg: { fontSize: 13, color: '#F87171', textAlign: 'center', marginBottom: 16, fontFamily: 'monospace' },
  stack: {
    backgroundColor: '#1a2a4a',
    borderRadius: 8,
    padding: 12,
    width: '100%',
    marginBottom: 20,
  },
  stackTxt: { fontSize: 10, color: '#93C5FD', fontFamily: 'monospace', lineHeight: 16 },
  btn: {
    backgroundColor: '#1D59C4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
