import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PilotBadge } from '../components/PilotBadge';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { Transaction } from '../types/transaction';
import { formatCurrencyBRL, toNumber } from '../utils/formatters';

type DashboardSummary = {
  monthlyIncome: number;
  monthlyExpenses: number;
  pendingPayable: number;
  pendingReceivable: number;
  monthlyTransactionsCount: number;
  pendingAccountsCount: number;
};

type Props = {
  selectedControlId: string;
  selectedControlName: string;
  refreshSignal?: number;
  onBackToControls: () => void;
  onNewTransaction: () => void;
  onTextTransaction: () => void;
  onVoiceTransaction: () => void;
  onOpenTransactions: () => void;
  onOpenAccounts: () => void;
  onOpenMvpChecklist: () => void;
};

type SupabaseErrorLike = {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
};

function logSupabaseError(context: string, error: SupabaseErrorLike | null) {
  if (!error) return;

  console.error(context, {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  });
}

function padDatePart(value: number) {
  return String(value).padStart(2, '0');
}

function localIsoDateFromParts(year: number, month: number, day: number) {
  return `${year}-${padDatePart(month)}-${padDatePart(day)}`;
}

function getCurrentLocalMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const lastDay = new Date(year, month, 0).getDate();

  return {
    start: localIsoDateFromParts(year, month, 1),
    end: localIsoDateFromParts(year, month, lastDay),
    label: now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
  };
}

function getTransactionType(transaction: Transaction) {
  return (transaction.type ?? transaction.tipo ?? '').toString().toLowerCase();
}

function getTransactionAmount(transaction: Transaction) {
  return toNumber(transaction.amount ?? transaction.value);
}

function hasDueDate(transaction: Transaction) {
  const dueDate = transaction.due_date ?? transaction.vencimento ?? null;
  return Boolean(dueDate?.trim());
}

function isPendingAccount(transaction: Transaction) {
  const type = getTransactionType(transaction);
  return transaction.status === 'pendente' && hasDueDate(transaction) && (type === 'despesa' || type === 'receita');
}

const initialSummary: DashboardSummary = {
  monthlyIncome: 0,
  monthlyExpenses: 0,
  pendingPayable: 0,
  pendingReceivable: 0,
  monthlyTransactionsCount: 0,
  pendingAccountsCount: 0,
};

export function DashboardScreen({
  selectedControlId,
  selectedControlName,
  refreshSignal,
  onBackToControls,
  onNewTransaction,
  onTextTransaction,
  onVoiceTransaction,
  onOpenTransactions,
  onOpenAccounts,
  onOpenMvpChecklist,
}: Props) {
  const { signOut } = useAuth();
  const monthRange = useMemo(() => getCurrentLocalMonthRange(), []);
  const [summary, setSummary] = useState<DashboardSummary>(initialSummary);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const [monthlyResult, pendingResult] = await Promise.all([
        supabase
          .from('transactions')
          .select('id, type, amount, status, transaction_date')
          .eq('company_id', selectedControlId)
          .gte('transaction_date', monthRange.start)
          .lte('transaction_date', monthRange.end),
        supabase
          .from('transactions')
          .select('id, type, amount, status, due_date')
          .eq('company_id', selectedControlId)
          .eq('status', 'pendente')
          .not('due_date', 'is', null),
      ]);

      if (monthlyResult.error) throw monthlyResult.error;
      if (pendingResult.error) throw pendingResult.error;

      const monthlyTransactions = (monthlyResult.data ?? []) as Transaction[];
      const pendingAccounts = ((pendingResult.data ?? []) as Transaction[]).filter(isPendingAccount);

      const nextSummary = monthlyTransactions.reduce(
        (acc, transaction) => {
          const type = getTransactionType(transaction);
          const amount = getTransactionAmount(transaction);

          if (type === 'receita') {
            acc.monthlyIncome += amount;
          }

          if (type === 'despesa') {
            acc.monthlyExpenses += amount;
          }

          return acc;
        },
        { ...initialSummary, monthlyTransactionsCount: monthlyTransactions.length, pendingAccountsCount: pendingAccounts.length },
      );

      pendingAccounts.forEach((transaction) => {
        const type = getTransactionType(transaction);
        const amount = getTransactionAmount(transaction);

        if (type === 'despesa') {
          nextSummary.pendingPayable += amount;
        }

        if (type === 'receita') {
          nextSummary.pendingReceivable += amount;
        }
      });

      setSummary(nextSummary);
    } catch (error) {
      logSupabaseError('Erro ao carregar dashboard do controle', error as SupabaseErrorLike);
      setSummary(initialSummary);
      setErrorMessage('Não foi possível carregar o resumo deste controle agora. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [monthRange.end, monthRange.start, selectedControlId]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard, refreshSignal]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  const monthlyBalance = summary.monthlyIncome - summary.monthlyExpenses;
  const hasDashboardData = summary.monthlyTransactionsCount > 0 || summary.pendingAccountsCount > 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <PilotBadge />
        <Text style={styles.title}>Início</Text>
        <Text style={styles.mvpHint}>Versão de validação para teste piloto.</Text>
        <Text style={styles.subtitle}>Controle atual: {selectedControlName}</Text>
        <View style={styles.helpCard}>
          <Text style={styles.helpText}>Este é o resumo do controle selecionado, com saldo do mês, receitas, despesas e contas pendentes.</Text>
        </View>
      </View>

      <View style={styles.headerActions}>
        <Pressable style={styles.secondaryButton} onPress={onBackToControls}>
          <Text style={styles.secondaryButtonText}>Voltar para Meus controles</Text>
        </Pressable>
        <Pressable style={styles.logoutButton} onPress={handleSignOut} disabled={signingOut}>
          <Text style={styles.logoutButtonText}>{signingOut ? 'Saindo...' : 'Sair'}</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centeredContent}>
          <ActivityIndicator size="large" />
          <Text style={styles.feedbackText}>Carregando resumo do controle...</Text>
          <Text style={styles.feedbackHint}>Buscando receitas, despesas e contas pendentes.</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.centeredContent}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <Pressable style={styles.secondaryButton} onPress={loadDashboard}>
            <Text style={styles.secondaryButtonText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <Text style={styles.sectionTitle}>Resumo de {monthRange.label}</Text>

          {!hasDashboardData ? (
            <View style={styles.emptyBox}>
              <Text style={styles.feedbackText}>Ainda não há movimentações neste mês nem contas pendentes com vencimento informado.</Text>
              <Text style={styles.feedbackHint}>Use lançamento manual, texto ou voz simulada para registrar a primeira movimentação.</Text>
            </View>
          ) : null}

          <View style={styles.cardsGrid}>
            <View style={[styles.summaryCard, styles.incomeCard]}>
              <Text style={styles.cardLabel}>Receitas do mês</Text>
              <Text style={styles.cardValue}>{formatCurrencyBRL(summary.monthlyIncome)}</Text>
            </View>

            <View style={[styles.summaryCard, styles.expenseCard]}>
              <Text style={styles.cardLabel}>Despesas do mês</Text>
              <Text style={styles.cardValue}>{formatCurrencyBRL(summary.monthlyExpenses)}</Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.cardLabel}>Saldo do mês</Text>
              <Text style={[styles.cardValue, monthlyBalance < 0 ? styles.negativeValue : styles.positiveValue]}>{formatCurrencyBRL(monthlyBalance)}</Text>
            </View>

            <View style={[styles.summaryCard, styles.payableCard]}>
              <Text style={styles.cardLabel}>Contas a pagar pendentes</Text>
              <Text style={styles.cardValue}>{formatCurrencyBRL(summary.pendingPayable)}</Text>
            </View>

            <View style={[styles.summaryCard, styles.receivableCard]}>
              <Text style={styles.cardLabel}>Contas a receber pendentes</Text>
              <Text style={styles.cardValue}>{formatCurrencyBRL(summary.pendingReceivable)}</Text>
            </View>
          </View>

          <View style={styles.shortcutsBox}>
            <Text style={styles.sectionTitle}>Atalhos</Text>
            <Pressable style={styles.primaryButton} onPress={onNewTransaction}>
              <Text style={styles.primaryButtonText}>Adicionar lançamento manual</Text>
            </Pressable>
            <Pressable style={styles.textShortcutButton} onPress={onTextTransaction}>
              <Text style={styles.textShortcutButtonText}>Registrar por texto</Text>
            </Pressable>
            <Pressable
              accessibilityHint="Abre a tela para digitar ou colar uma transcrição simulada de voz."
              accessibilityLabel="Registrar por voz simulado"
              accessibilityRole="button"
              style={styles.voiceShortcutButton}
              onPress={onVoiceTransaction}
            >
              <Text style={styles.voiceShortcutButtonText}>Registrar por voz</Text>
              <Text style={styles.voiceShortcutHint}>Simulado ativo no MVP</Text>
            </Pressable>
            <Pressable style={styles.shortcutButton} onPress={onOpenTransactions}>
              <Text style={styles.shortcutButtonText}>Ver movimentações</Text>
            </Pressable>
            <Pressable style={styles.shortcutButton} onPress={onOpenAccounts}>
              <Text style={styles.shortcutButtonText}>Ver contas</Text>
            </Pressable>
            <Pressable style={styles.checklistShortcutButton} onPress={onOpenMvpChecklist}>
              <Text style={styles.checklistShortcutButtonText}>Checklist do MVP</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  header: { gap: 6, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 15, color: '#3b3b3b' },
  helpCard: { borderRadius: 10, backgroundColor: '#eef6ff', padding: 12, marginTop: 6 },
  helpText: { fontSize: 14, lineHeight: 20, color: '#334155' },
  mvpHint: { fontSize: 13, color: '#555' },
  headerActions: { gap: 8, marginBottom: 14 },
  content: { flex: 1 },
  contentContainer: { gap: 16, paddingBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  cardsGrid: { gap: 12 },
  summaryCard: { borderWidth: 1, borderColor: '#d9d9d9', borderRadius: 14, padding: 14, gap: 8, backgroundColor: '#fff' },
  incomeCard: { borderColor: '#bfe3c8', backgroundColor: '#f5fff7' },
  expenseCard: { borderColor: '#f1c4c4', backgroundColor: '#fff7f7' },
  payableCard: { borderColor: '#f1c4c4' },
  receivableCard: { borderColor: '#bfe3c8' },
  cardLabel: { fontSize: 14, color: '#555', fontWeight: '600' },
  cardValue: { fontSize: 22, color: '#111', fontWeight: '700' },
  positiveValue: { color: '#116329' },
  negativeValue: { color: '#b00020' },
  shortcutsBox: { gap: 10, marginTop: 4 },
  primaryButton: { backgroundColor: '#111', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  shortcutButton: { borderWidth: 1, borderColor: '#1b64d9', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  shortcutButtonText: { color: '#1b64d9', fontWeight: '700' },
  textShortcutButton: { borderWidth: 1, borderColor: '#116329', borderRadius: 10, paddingVertical: 14, alignItems: 'center', backgroundColor: '#f5fff7' },
  textShortcutButtonText: { color: '#116329', fontWeight: '700' },
  voiceShortcutButton: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', backgroundColor: '#6d28d9', gap: 3 },
  voiceShortcutButtonText: { color: '#ffffff', fontWeight: '800' },
  voiceShortcutHint: { color: '#ede9fe', fontSize: 12, fontWeight: '700' },
  checklistShortcutButton: { borderWidth: 1, borderColor: '#b45309', borderRadius: 10, paddingVertical: 14, alignItems: 'center', backgroundColor: '#fffbeb' },
  checklistShortcutButtonText: { color: '#92400e', fontWeight: '700' },
  secondaryButton: { borderRadius: 10, borderWidth: 1, borderColor: '#333', paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center' },
  secondaryButtonText: { color: '#111', fontWeight: '600' },
  logoutButton: { borderRadius: 10, borderWidth: 1, borderColor: '#b00020', paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center' },
  logoutButtonText: { color: '#b00020', fontWeight: '600' },
  centeredContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  feedbackText: { textAlign: 'center', color: '#444', fontSize: 16 },
  feedbackHint: { textAlign: 'center', color: '#666', fontSize: 14 },
  errorText: { textAlign: 'center', color: '#b00020', fontSize: 16 },
  emptyBox: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 12, padding: 14, gap: 6, backgroundColor: '#fafafa' },
});
