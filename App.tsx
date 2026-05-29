import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ControlsScreen } from './src/screens/ControlsScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { AccountsScreen } from './src/screens/AccountsScreen';
import { NewTransactionScreen } from './src/screens/NewTransactionScreen';
import { TransactionsScreen } from './src/screens/TransactionsScreen';
import type { Transaction } from './src/types/transaction';

type SelectedControl = {
  selectedControlId: string;
  selectedControlName: string;
};

type AppRoute =
  | { name: 'controls' }
  | ({ name: 'dashboard' } & SelectedControl)
  | ({ name: 'transactions' } & SelectedControl)
  | ({ name: 'accounts'; from: 'controls' | 'dashboard' | 'transactions' } & SelectedControl)
  | ({ name: 'new-transaction'; from: 'dashboard' | 'transactions' } & SelectedControl)
  | ({ name: 'edit-transaction'; transaction: Transaction } & SelectedControl);

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

      <TextInput style={styles.input} placeholder="Senha" secureTextEntry value={password} onChangeText={setPassword} />

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <Pressable style={styles.button} onPress={handleSubmit} disabled={submitting}>
        <Text style={styles.buttonText}>{submitting ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}</Text>
      </Pressable>

      <Pressable
        onPress={() => {
          setMode(mode === 'login' ? 'signup' : 'login');
          setMessage(null);
        }}
      >
        <Text style={styles.link}>{mode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}</Text>
      </Pressable>

      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

function Root() {
  const { user, loading } = useAuth();
  const [route, setRoute] = useState<AppRoute>({ name: 'controls' });
  const [transactionsRefreshSignal, setTransactionsRefreshSignal] = useState(0);
  const [dashboardRefreshSignal, setDashboardRefreshSignal] = useState(0);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" />
        <Text style={styles.subtitle}>Verificando sessão...</Text>
      </SafeAreaView>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }


  if (route.name === 'accounts') {
    return (
      <AccountsScreen
        selectedControlId={route.selectedControlId}
        selectedControlName={route.selectedControlName}
        backLabel={
          route.from === 'transactions'
            ? 'Voltar para Movimentações'
            : route.from === 'dashboard'
              ? 'Voltar para Início'
              : 'Voltar para Meus controles'
        }
        onBack={() =>
          setRoute(
            route.from === 'transactions'
              ? {
                  name: 'transactions',
                  selectedControlId: route.selectedControlId,
                  selectedControlName: route.selectedControlName,
                }
              : route.from === 'dashboard'
                ? {
                    name: 'dashboard',
                    selectedControlId: route.selectedControlId,
                    selectedControlName: route.selectedControlName,
                  }
                : { name: 'controls' },
          )
        }
      />
    );
  }

  if (route.name === 'new-transaction' || route.name === 'edit-transaction') {
    const returnRouteName = route.name === 'new-transaction' ? route.from : 'transactions';

    return (
      <NewTransactionScreen
        selectedControlId={route.selectedControlId}
        transactionToEdit={
          route.name === 'edit-transaction' ? route.transaction : undefined
        }
        onBack={() =>
          setRoute({
            name: returnRouteName,
            selectedControlId: route.selectedControlId,
            selectedControlName: route.selectedControlName,
          })
        }
        onSaved={() => {
          setTransactionsRefreshSignal((value) => value + 1);
          setDashboardRefreshSignal((value) => value + 1);
          setRoute({
            name: returnRouteName,
            selectedControlId: route.selectedControlId,
            selectedControlName: route.selectedControlName,
          });
        }}
      />
    );
  }

  if (route.name === 'dashboard') {
    return (
      <DashboardScreen
        selectedControlId={route.selectedControlId}
        selectedControlName={route.selectedControlName}
        refreshSignal={dashboardRefreshSignal}
        onBackToControls={() => setRoute({ name: 'controls' })}
        onNewTransaction={() =>
          setRoute({
            name: 'new-transaction',
            from: 'dashboard',
            selectedControlId: route.selectedControlId,
            selectedControlName: route.selectedControlName,
          })
        }
        onOpenTransactions={() =>
          setRoute({
            name: 'transactions',
            selectedControlId: route.selectedControlId,
            selectedControlName: route.selectedControlName,
          })
        }
        onOpenAccounts={() =>
          setRoute({
            name: 'accounts',
            from: 'dashboard',
            selectedControlId: route.selectedControlId,
            selectedControlName: route.selectedControlName,
          })
        }
      />
    );
  }

  if (route.name === 'transactions') {
    return (
      <TransactionsScreen
        selectedControlId={route.selectedControlId}
        selectedControlName={route.selectedControlName}
        onBack={() =>
          setRoute({
            name: 'dashboard',
            selectedControlId: route.selectedControlId,
            selectedControlName: route.selectedControlName,
          })
        }
        onNewTransaction={() =>
          setRoute({
            name: 'new-transaction',
            from: 'transactions',
            selectedControlId: route.selectedControlId,
            selectedControlName: route.selectedControlName,
          })
        }
        onOpenAccounts={() =>
          setRoute({
            name: 'accounts',
            from: 'transactions',
            selectedControlId: route.selectedControlId,
            selectedControlName: route.selectedControlName,
          })
        }
        onEditTransaction={(transaction) =>
          setRoute({
            name: 'edit-transaction',
            selectedControlId: route.selectedControlId,
            selectedControlName: route.selectedControlName,
            transaction,
          })
        }
        refreshSignal={transactionsRefreshSignal}
      />
    );
  }

  return (
    <ControlsScreen
      onOpenDashboard={({ controlId, controlName }) =>
        setRoute({
          name: 'dashboard',
          selectedControlId: controlId,
          selectedControlName: controlName,
        })
      }
      onOpenAccounts={({ controlId, controlName }) =>
        setRoute({
          name: 'accounts',
          from: 'controls',
          selectedControlId: controlId,
          selectedControlName: controlName,
        })
      }
    />
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </SafeAreaProvider>
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
