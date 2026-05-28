import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Transaction } from '../types/transaction';
import { formatCurrencyBRL, formatDateBR, toNumber } from '../utils/formatters';

type Props = {
  selectedControlId: string;
  selectedControlName: string;
  onBack: () => void;
  onNewTransaction: () => void;
  refreshSignal?: number;
};

export function TransactionsScreen({ selectedControlId, selectedControlName, onBack, onNewTransaction, refreshSignal }: Props) {
  const { signOut } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(
          'id, company_id, type, description, amount, status, transaction_date, due_date, supplier_customer, settled_at, settled_amount, created_at',
        )
        .eq('company_id', selectedControlId)
        .order('transaction_date', { ascending: false, nullsFirst: false });

      if (error) throw error;

      setTransactions((data ?? []) as Transaction[]);
    } catch (error) {
      const supabaseError = error as { message?: string; code?: string; details?: string; hint?: string };

      if (__DEV__) {
        console.error('Erro ao carregar movimentações', {
          message: supabaseError?.message,
          code: supabaseError?.code,
          details: supabaseError?.details,
          hint: supabaseError?.hint,
        });
      }

      try {
        const { data, error: fallbackError } = await supabase
          .from('transactions')
          .select(
            'id, company_id, type, description, amount, status, transaction_date, due_date, supplier_customer, settled_at, settled_amount, created_at',
          )
          .eq('company_id', selectedControlId)
          .order('created_at', { ascending: false, nullsFirst: false });

        if (fallbackError) throw fallbackError;

        setTransactions((data ?? []) as Transaction[]);
      } catch (fallbackErr) {
        if (__DEV__) {
          const fallback = fallbackErr as { message?: string; code?: string; details?: string; hint?: string };
          console.error('Erro no fallback ao carregar movimentações', {
            message: fallback?.message,
            code: fallback?.code,
            details: fallback?.details,
            hint: fallback?.hint,
          });
        }

        setTransactions([]);
        setErrorMessage('Não foi possível carregar as movimentações deste controle agora. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  }, [selectedControlId]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions, refreshSignal]);

  const summary = useMemo(() => {
    return transactions.reduce(
      (acc, transaction) => {
        const rawType = (transaction.type ?? '').toString().toLowerCase();
        const amount = toNumber(transaction.amount);

        if (rawType === 'receita') {
          acc.receitas += amount;
        }

        if (rawType === 'despesa') {
          acc.despesas += amount;
        }

        return acc;
      },
      { receitas: 0, despesas: 0 },
    );
  }, [transactions]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Movimentações</Text>
        <Text style={styles.subtitle}>Controle atual: {selectedControlName}</Text>
      </View>

      <Pressable style={styles.newTransactionButton} onPress={onNewTransaction}>
        <Text style={styles.newTransactionButtonText}>Novo lançamento</Text>
      </Pressable>

      <View style={styles.summaryBox}>
        <Text style={styles.summaryText}>Receitas: {formatCurrencyBRL(summary.receitas)}</Text>
        <Text style={styles.summaryText}>Despesas: {formatCurrencyBRL(summary.despesas)}</Text>
        <Text style={styles.summaryBalance}>Saldo do período: {formatCurrencyBRL(summary.receitas - summary.despesas)}</Text>
      </View>

      {loading ? (
        <View style={styles.centeredContent}>
          <ActivityIndicator size="large" />
          <Text style={styles.feedbackText}>Carregando movimentações...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.centeredContent}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <Pressable style={styles.secondaryButton} onPress={loadTransactions}>
            <Text style={styles.secondaryButtonText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : transactions.length === 0 ? (
        <View style={styles.centeredContent}>
          <Text style={styles.feedbackText}>Nenhuma movimentação encontrada para este controle.</Text>
        </View>
      ) : (
        <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>
          {transactions.map((transaction) => {
            const value = toNumber(transaction.amount);
            const type = transaction.type ?? '-';
            const date = transaction.transaction_date;
            const dueDate = transaction.due_date;

            return (
              <View key={transaction.id} style={styles.transactionCard}>
                <Text style={styles.transactionDescription}>{transaction.description ?? 'Sem descrição'}</Text>
                <Text style={styles.transactionInfo}>Tipo: {String(type)}</Text>
                <Text style={styles.transactionInfo}>Valor: {formatCurrencyBRL(value)}</Text>
                <Text style={styles.transactionInfo}>Data: {formatDateBR(date)}</Text>
                {transaction.status ? <Text style={styles.transactionInfo}>Status: {transaction.status}</Text> : null}
                {dueDate ? <Text style={styles.transactionInfo}>Vencimento: {formatDateBR(dueDate)}</Text> : null}
              </View>
            );
          })}
        </ScrollView>
      )}

      <View style={styles.footerButtons}>
        <Pressable style={styles.secondaryButton} onPress={onBack}>
          <Text style={styles.secondaryButtonText}>Voltar para Meus controles</Text>
        </Pressable>
        <Pressable style={styles.logoutButton} onPress={handleSignOut} disabled={signingOut}>
          <Text style={styles.logoutButtonText}>{signingOut ? 'Saindo...' : 'Sair'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  header: { gap: 6, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 15, color: '#3b3b3b' },
  newTransactionButton: { backgroundColor: '#111', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginBottom: 12 },
  newTransactionButtonText: { color: '#fff', fontWeight: '600' },
  summaryBox: { borderWidth: 1, borderColor: '#d9d9d9', borderRadius: 12, padding: 12, gap: 4, marginBottom: 12 },
  summaryText: { fontSize: 15, color: '#222' },
  summaryBalance: { fontSize: 16, fontWeight: '700', color: '#111' },
  centeredContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  feedbackText: { textAlign: 'center', color: '#444', fontSize: 16 },
  errorText: { textAlign: 'center', color: '#b00020', fontSize: 16 },
  listContainer: { flex: 1 },
  listContent: { gap: 10, paddingBottom: 12 },
  transactionCard: { borderRadius: 12, borderWidth: 1, borderColor: '#d9d9d9', padding: 14, gap: 3 },
  transactionDescription: { fontSize: 16, fontWeight: '700', color: '#111' },
  transactionInfo: { fontSize: 14, color: '#333' },
  footerButtons: { gap: 10, marginTop: 10 },
  secondaryButton: { borderRadius: 10, borderWidth: 1, borderColor: '#333', paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center' },
  secondaryButtonText: { color: '#111', fontWeight: '600' },
  logoutButton: { backgroundColor: '#111', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  logoutButtonText: { color: '#fff', fontWeight: '600' },
});
