import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../lib/supabase';
import type { Transaction } from '../types/transaction';
import { formatCurrencyBRL, formatDateBR, toNumber } from '../utils/formatters';

type AccountTransaction = Transaction & {
  categoryName?: string | null;
};

type Category = {
  id: string;
  name: string;
  company_id?: string | null;
};

type DueHighlight = {
  label: string;
  style: 'overdue' | 'today' | 'soon' | 'future';
};

type Props = {
  selectedControlId: string;
  selectedControlName: string;
  onBack: () => void;
  backLabel: string;
};

type SupabaseErrorLike = {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
};

type DateParts = {
  year: string;
  month: string;
  day: string;
};

const NEXT_DUE_DAYS = 7;

function logSupabaseError(context: string, error: SupabaseErrorLike | null) {
  if (!error) return;

  console.error(context, {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  });
}

function getTransactionType(transaction: Transaction) {
  return (transaction.type ?? transaction.tipo ?? '').toString().toLowerCase();
}

function getTransactionAmount(transaction: Transaction) {
  return toNumber(transaction.amount ?? transaction.value);
}

function getTransactionDueDate(transaction: Transaction) {
  return transaction.due_date ?? transaction.vencimento ?? null;
}

function extractIsoDate(value?: string | null): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  const dateOnly = trimmed.slice(0, 10);

  return /^\d{4}-\d{2}-\d{2}$/.test(dateOnly) ? dateOnly : null;
}

function parseIsoDateParts(value?: string | null): DateParts | null {
  const isoDate = extractIsoDate(value);
  if (!isoDate) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;

  const [, year, month, day] = match;
  return { year, month, day };
}

function isoDateToLocalNoon(parts: DateParts) {
  return new Date(Number(parts.year), Number(parts.month) - 1, Number(parts.day), 12, 0, 0, 0);
}

function todayIsoDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function daysBetweenIsoDates(startIso: string, endIso: string) {
  const startParts = parseIsoDateParts(startIso);
  const endParts = parseIsoDateParts(endIso);

  if (!startParts || !endParts) return Number.POSITIVE_INFINITY;

  const startTime = isoDateToLocalNoon(startParts).getTime();
  const endTime = isoDateToLocalNoon(endParts).getTime();

  return Math.round((endTime - startTime) / 86_400_000);
}

function getDueHighlight(dueDate?: string | null): DueHighlight {
  const dueIso = extractIsoDate(dueDate);
  const todayIso = todayIsoDate();

  if (!dueIso) {
    return { label: 'Futuro', style: 'future' };
  }

  const daysUntilDue = daysBetweenIsoDates(todayIso, dueIso);

  if (daysUntilDue < 0) {
    return { label: 'Vencido', style: 'overdue' };
  }

  if (daysUntilDue === 0) {
    return { label: 'Vence hoje', style: 'today' };
  }

  if (daysUntilDue <= NEXT_DUE_DAYS) {
    return { label: 'Próximo vencimento', style: 'soon' };
  }

  return { label: 'Futuro', style: 'future' };
}

function isPendingAccount(transaction: Transaction) {
  const type = getTransactionType(transaction);
  const dueDate = getTransactionDueDate(transaction);

  return transaction.status === 'pendente' && Boolean(extractIsoDate(dueDate)) && (type === 'despesa' || type === 'receita');
}

export function AccountsScreen({ selectedControlId, selectedControlName, onBack, backLabel }: Props) {
  const [accounts, setAccounts] = useState<AccountTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [settlingTransactionId, setSettlingTransactionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, company_id, category_id, type, description, amount, status, transaction_date, due_date, supplier_customer, payment_method, created_at')
        .eq('company_id', selectedControlId)
        .eq('status', 'pendente')
        .not('due_date', 'is', null)
        .order('due_date', { ascending: true, nullsFirst: false });

      if (error) throw error;

      const pendingAccounts = ((data ?? []) as Transaction[]).filter(isPendingAccount);
      const categoryIds = Array.from(
        new Set(pendingAccounts.map((transaction) => transaction.category_id).filter((categoryId): categoryId is string => Boolean(categoryId))),
      );
      const categoriesById = new Map<string, string>();

      if (categoryIds.length > 0) {
        const { data: categoryData, error: categoryError } = await supabase
          .from('categories')
          .select('id, name, company_id')
          .eq('company_id', selectedControlId)
          .in('id', categoryIds);

        if (categoryError) {
          logSupabaseError('Erro ao carregar categorias das contas', categoryError);
        } else {
          ((categoryData ?? []) as Category[]).forEach((category) => {
            categoriesById.set(category.id, category.name);
          });
        }
      }

      setAccounts(
        pendingAccounts.map((transaction) => ({
          ...transaction,
          categoryName: transaction.category_id ? categoriesById.get(transaction.category_id) ?? null : null,
        })),
      );
    } catch (error) {
      logSupabaseError('Erro ao carregar contas pendentes', error as SupabaseErrorLike);
      setAccounts([]);
      setErrorMessage('Não foi possível carregar suas contas agora. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [selectedControlId]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const { accountsPayable, accountsReceivable, summary } = useMemo(() => {
    const payable = accounts.filter((transaction) => getTransactionType(transaction) === 'despesa');
    const receivable = accounts.filter((transaction) => getTransactionType(transaction) === 'receita');
    const totalPayable = payable.reduce((total, transaction) => total + getTransactionAmount(transaction), 0);
    const totalReceivable = receivable.reduce((total, transaction) => total + getTransactionAmount(transaction), 0);

    return {
      accountsPayable: payable,
      accountsReceivable: receivable,
      summary: {
        totalPayable,
        totalReceivable,
        expectedBalance: totalReceivable - totalPayable,
      },
    };
  }, [accounts]);

  const markAsSettled = async (transaction: AccountTransaction) => {
    const type = getTransactionType(transaction);
    const successText = type === 'receita' ? 'Conta marcada como recebida.' : 'Conta marcada como paga.';

    setSettlingTransactionId(transaction.id);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { data, error } = await supabase
        .from('transactions')
        .update({ status: 'pago' })
        .eq('id', transaction.id)
        .eq('company_id', selectedControlId)
        .select('id')
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error('Conta não encontrada ou sem permissão para atualizar.');
      }

      await loadAccounts();
      setSuccessMessage(successText);
    } catch (error) {
      logSupabaseError('Erro ao marcar conta como paga/recebida', error as SupabaseErrorLike);
      setErrorMessage('Não foi possível atualizar esta conta agora. Tente novamente.');
    } finally {
      setSettlingTransactionId(null);
    }
  };

  const renderAccountCard = (transaction: AccountTransaction) => {
    const type = getTransactionType(transaction);
    const dueDate = getTransactionDueDate(transaction);
    const dueHighlight = getDueHighlight(dueDate);
    const isReceivable = type === 'receita';
    const isSettling = settlingTransactionId === transaction.id;

    return (
      <View key={transaction.id} style={[styles.accountCard, styles[`${dueHighlight.style}Card`]]}>
        <View style={styles.cardHeader}>
          <Text style={styles.accountDescription}>{transaction.description ?? 'Sem descrição'}</Text>
          <Text style={[styles.dueBadge, styles[`${dueHighlight.style}Badge`]]}>{dueHighlight.label}</Text>
        </View>

        <Text style={styles.accountValue}>{formatCurrencyBRL(getTransactionAmount(transaction))}</Text>
        <Text style={styles.accountInfo}>Vencimento: {formatDateBR(dueDate)}</Text>
        <Text style={styles.accountInfo}>Tipo: {isReceivable ? 'Receita' : 'Despesa'}</Text>
        {transaction.categoryName ? <Text style={styles.accountInfo}>Categoria: {transaction.categoryName}</Text> : null}
        <Text style={styles.accountInfo}>Status: {transaction.status}</Text>

        <Pressable
          style={[styles.settleButton, isReceivable ? styles.receiveButton : styles.payButton, isSettling ? styles.disabledButton : null]}
          onPress={() => markAsSettled(transaction)}
          disabled={isSettling}
        >
          <Text style={styles.settleButtonText}>{isSettling ? 'Atualizando...' : isReceivable ? 'Marcar como recebida' : 'Marcar como paga'}</Text>
        </Pressable>
      </View>
    );
  };

  const hasPendingAccounts = accounts.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Contas</Text>
        <Text style={styles.subtitle}>Controle atual: {selectedControlName}</Text>
      </View>

      <View style={styles.summaryBox}>
        <Text style={styles.summaryLabel}>Resumo de contas pendentes</Text>
        <Text style={styles.summaryPayable}>Total a pagar: {formatCurrencyBRL(summary.totalPayable)}</Text>
        <Text style={styles.summaryReceivable}>Total a receber: {formatCurrencyBRL(summary.totalReceivable)}</Text>
        <Text style={styles.summaryBalance}>Saldo previsto: {formatCurrencyBRL(summary.expectedBalance)}</Text>
      </View>

      {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}

      {loading ? (
        <View style={styles.centeredContent}>
          <ActivityIndicator size="large" />
          <Text style={styles.feedbackText}>Carregando contas pendentes...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.centeredContent}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <Pressable style={styles.secondaryButton} onPress={loadAccounts}>
            <Text style={styles.secondaryButtonText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : !hasPendingAccounts ? (
        <View style={styles.centeredContent}>
          <Text style={styles.feedbackText}>Tudo certo por aqui! Não há contas pendentes com vencimento informado.</Text>
        </View>
      ) : (
        <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contas a pagar</Text>
            {accountsPayable.length > 0 ? accountsPayable.map(renderAccountCard) : <Text style={styles.emptySectionText}>Nenhuma despesa pendente.</Text>}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contas a receber</Text>
            {accountsReceivable.length > 0 ? accountsReceivable.map(renderAccountCard) : <Text style={styles.emptySectionText}>Nenhuma receita pendente.</Text>}
          </View>
        </ScrollView>
      )}

      <Pressable style={styles.secondaryButton} onPress={onBack}>
        <Text style={styles.secondaryButtonText}>{backLabel}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  header: { gap: 6, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 15, color: '#3b3b3b' },
  summaryBox: { borderWidth: 1, borderColor: '#d9d9d9', borderRadius: 12, padding: 12, gap: 4, marginBottom: 12 },
  summaryLabel: { fontSize: 13, color: '#555', fontWeight: '600' },
  summaryPayable: { fontSize: 15, color: '#b00020', fontWeight: '600' },
  summaryReceivable: { fontSize: 15, color: '#116329', fontWeight: '600' },
  summaryBalance: { fontSize: 16, fontWeight: '700', color: '#111' },
  centeredContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  feedbackText: { textAlign: 'center', color: '#444', fontSize: 16 },
  errorText: { textAlign: 'center', color: '#b00020', fontSize: 16 },
  successText: { textAlign: 'center', color: '#116329', fontSize: 15, marginBottom: 12 },
  listContainer: { flex: 1 },
  listContent: { gap: 14, paddingBottom: 12 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  emptySectionText: { color: '#555', fontSize: 15 },
  accountCard: { borderRadius: 12, borderWidth: 1, borderColor: '#d9d9d9', padding: 14, gap: 4 },
  overdueCard: { borderColor: '#b00020', backgroundColor: '#fff5f5' },
  todayCard: { borderColor: '#b26a00', backgroundColor: '#fff8ec' },
  soonCard: { borderColor: '#1b64d9', backgroundColor: '#f2f7ff' },
  futureCard: { borderColor: '#d9d9d9', backgroundColor: '#fff' },
  cardHeader: { gap: 8 },
  accountDescription: { fontSize: 16, fontWeight: '700', color: '#111' },
  accountValue: { fontSize: 17, fontWeight: '700', color: '#111' },
  accountInfo: { fontSize: 14, color: '#333' },
  dueBadge: { alignSelf: 'flex-start', borderRadius: 999, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 4, fontSize: 12, fontWeight: '700' },
  overdueBadge: { backgroundColor: '#b00020', color: '#fff' },
  todayBadge: { backgroundColor: '#b26a00', color: '#fff' },
  soonBadge: { backgroundColor: '#1b64d9', color: '#fff' },
  futureBadge: { backgroundColor: '#e6e6e6', color: '#111' },
  settleButton: { marginTop: 8, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  payButton: { backgroundColor: '#b00020' },
  receiveButton: { backgroundColor: '#116329' },
  settleButtonText: { color: '#fff', fontWeight: '700' },
  disabledButton: { opacity: 0.6 },
  secondaryButton: { borderRadius: 10, borderWidth: 1, borderColor: '#333', paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', marginTop: 10 },
  secondaryButtonText: { color: '#111', fontWeight: '600' },
});
