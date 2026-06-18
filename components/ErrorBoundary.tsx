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
  jsStack: string;
  prevCrashStack: string;
  moduleDiag: string;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: '', componentStack: '', jsStack: '', prevCrashStack: '', moduleDiag: '' };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error: error?.message ?? String(error) };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const stack = info?.componentStack ?? '';
    const jsStack = error?.stack ?? '';
    this.setState({ componentStack: stack, jsStack });

    // Read previous crash data and module diagnostic, then overwrite with current crash
    Promise.all([
      AsyncStorage.getItem('__last_crash'),
      AsyncStorage.getItem('__module_diag'),
    ]).then(([prevRaw, diagRaw]) => {
      let prevStack = '';
      if (prevRaw) {
        try { prevStack = JSON.parse(prevRaw).stack ?? ''; } catch {}
      }
      this.setState({ prevCrashStack: prevStack, moduleDiag: diagRaw ?? '' });
      return AsyncStorage.setItem('__last_crash', JSON.stringify({
        message: error?.message,
        stack: jsStack.slice(0, 3000),
        componentStack: stack.slice(0, 2000),
        ts: new Date().toISOString(),
      }));
    }).catch(() => {});

    console.error('CRASH:', error?.message, '\nJSSTACK:', jsStack, '\nCOMPSTACK:', stack);
  }

  render() {
    if (this.state.hasError) {
      const compLines = this.state.componentStack
        .split('\n').filter(l => l.trim()).slice(0, 10).join('\n');
      const jsLines = this.state.jsStack
        .split('\n').slice(0, 15).join('\n');
      const prevLines = this.state.prevCrashStack
        .split('\n').slice(0, 10).join('\n');

      return (
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.emoji}>⚠️</Text>
          <Text style={styles.title}>Crash Detayı</Text>
          <Text style={styles.msg}>{this.state.error}</Text>

          <Text style={styles.sectionLabel}>JS Stack (bu crash):</Text>
          <View style={styles.stack}>
            <Text style={styles.stackTxt}>{jsLines || '(yok)'}</Text>
          </View>

          <Text style={styles.sectionLabel}>Component Stack:</Text>
          <View style={styles.stack}>
            <Text style={styles.stackTxt}>{compLines || '(yok)'}</Text>
          </View>

          {this.state.prevCrashStack ? (
            <>
              <Text style={styles.sectionLabel}>Önceki Crash JS Stack:</Text>
              <View style={styles.stack}>
                <Text style={styles.stackTxt}>{prevLines}</Text>
              </View>
            </>
          ) : null}

          {this.state.moduleDiag ? (
            <>
              <Text style={styles.sectionLabel}>Modül Tanı:</Text>
              <View style={styles.stack}>
                <Text style={styles.stackTxt}>{this.state.moduleDiag}</Text>
              </View>
            </>
          ) : null}

          <TouchableOpacity
            style={styles.btn}
            onPress={() => this.setState({ hasError: false, error: '', componentStack: '', jsStack: '', prevCrashStack: '', moduleDiag: '' })}
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
  msg: { fontSize: 13, color: '#F87171', textAlign: 'center', marginBottom: 12, fontFamily: 'monospace' },
  sectionLabel: { fontSize: 11, color: '#60A5FA', fontWeight: '700', alignSelf: 'flex-start', marginBottom: 4, marginTop: 8 },
  stack: {
    backgroundColor: '#1a2a4a',
    borderRadius: 8,
    padding: 12,
    width: '100%',
    marginBottom: 8,
  },
  stackTxt: { fontSize: 9, color: '#93C5FD', fontFamily: 'monospace', lineHeight: 15 },
  btn: {
    backgroundColor: '#1D59C4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 16,
  },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
