import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, TextInput } from 'react-native';

import { AuthProvider, useAuth } from './src/context/AuthContext';

function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setMessage('Preencha e-mail e senha para continuar.');
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      if (mode === 'login') {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password);
        setMessage('Conta criada! Verifique seu e-mail para confirmar o cadastro, se necessário.');
      }
    } catch {
      setMessage(mode === 'login' ? 'Não foi possível entrar. Verifique e-mail e senha.' : 'Não foi possível criar sua conta agora. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>{mode === 'login' ? 'Entrar' : 'Criar conta'}</Text>

      <TextInput
        style={styles.input}
        placeholder="E-mail"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Senha"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <Pressable style={styles.button} onPress={handleSubmit} disabled={submitting}>
        <Text style={styles.buttonText}>{submitting ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}</Text>
      </Pressable>

      <Pressable onPress={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage(null); }}>
        <Text style={styles.link}>{mode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}</Text>
      </Pressable>

      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

function Dashboard() {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(false);

  const onSignOut = async () => {
    setLoading(true);
    try {
      await signOut();
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Você está logado</Text>
      <Text style={styles.subtitle}>{user?.email}</Text>
      <Pressable style={styles.button} onPress={onSignOut} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Saindo...' : 'Sair'}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function Root() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" />
        <Text style={styles.subtitle}>Verificando sessão...</Text>
      </SafeAreaView>
    );
  }

  return user ? <Dashboard /> : <AuthScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#fff',
    gap: 14,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#444',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  message: {
    color: '#444',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#111',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  link: {
    textAlign: 'center',
    color: '#1b64d9',
    marginTop: 8,
  },
});
