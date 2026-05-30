import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Category } from '../types/category';
import { Transaction } from '../types/transaction';
import { buildCsv } from '../utils/csv';
import { formatCurrencyBRL, formatDateBR, toNumber } from '../utils/formatters';

type TransactionFilterType = 'all' | 'receita' | 'despesa';

type TransactionFilters = {
  description: string;
  type: TransactionFilterType;
  startDate: string;
  endDate: string;
};

type ParsedTransactionFilters = {
  description: string;
  type: TransactionFilterType;
  startDate: string | null;
  endDate: string | null;
};

const initialFilters: TransactionFilters = { description: '', type: 'all', startDate: '', endDate: '' };

const transactionCsvHeader = [
  'Data da movimentação',
  'Tipo',
  'Descrição',
  'Categoria',
  'Valor',
  'Status',
  'Vencimento',
  'Forma de pagamento',
];

async function addCategoryNamesToTransactions(transactions: Transaction[], selectedControlId: string): Promise<Transaction[]> {
  const categoryIds = Array.from(
    new Set(transactions.map((transaction) => transaction.category_id).filter((categoryId): categoryId is string => Boolean(categoryId))),
  );

  if (categoryIds.length === 0) return transactions;

  const { data, error } = await supabase
    .from('categories')
    .select('id, name, company_id')
    .eq('company_id', selectedControlId)
    .in('id', categoryIds);

  if (error) {
    if (__DEV__) {
      console.error('Erro ao carregar categorias das movimentações', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
    }

    return transactions;
  }

  const categoriesById = new Map<string, string>();

  ((data ?? []) as Category[]).forEach((category) => {
    categoriesById.set(category.id, category.name);
  });

  return transactions.map((transaction) => ({
    ...transaction,
    categoryName: transaction.category_id ? categoriesById.get(transaction.category_id) ?? null : null,
  }));
}

function buildTransactionsCsv(transactions: Transaction[]): string {
  const rows = transactions.map((transaction) => [
    formatDateBR(transaction.transaction_date ?? transaction.date),
    transaction.type ?? transaction.tipo ?? '',
    transaction.description ?? '',
    transaction.categoryName ?? '',
    formatCurrencyBRL(toNumber(transaction.amount ?? transaction.value)),
    transaction.status ?? '',
    formatDateBR(transaction.due_date ?? transaction.vencimento),
    transaction.payment_method ?? '',
  ]);

  return buildCsv([transactionCsvHeader, ...rows]);
}

function parseFilterDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month}-${day}`;
  }

  const brMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    return `${year}-${month}-${day}`;
  }

  return null;
}

function isValidDateParts(isoDate: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return false;

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12) return false;

  const daysByMonth = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  return day >= 1 && day <= daysByMonth[month - 1];
}

function normalizeFilters(filters: TransactionFilters): { filters?: ParsedTransactionFilters; error?: string } {
  const startDate = parseFilterDate(filters.startDate);
  const endDate = parseFilterDate(filters.endDate);

  if (filters.startDate.trim() && (!startDate || !isValidDateParts(startDate))) {
    return { error: 'Informe o período inicial em YYYY-MM-DD ou DD/MM/AAAA.' };
  }

  if (filters.endDate.trim() && (!endDate || !isValidDateParts(endDate))) {
    return { error: 'Informe o período final em YYYY-MM-DD ou DD/MM/AAAA.' };
  }

  if (startDate && endDate && startDate > endDate) {
    return { error: 'O período inicial deve ser anterior ou igual ao período final.' };
  }

  return {
    filters: {
      description: filters.description.trim(),
      type: filters.type,
      startDate,
      endDate,
    },
  };
}

type Props = {
  selectedControlId: string;
  selectedControlName: string;
  onBack: () => void;
  onNewTransaction: () => void;
  onTextTransaction: () => void;
  onVoiceTransaction: () => void;
  onOpenAccounts: () => void;
  onEditTransaction: (transaction: Transaction) => void;
  refreshSignal?: number;
};

export function TransactionsScreen({
  selectedControlId,
  selectedControlName,
  onBack,
  onNewTransaction,
  onTextTransaction,
  onVoiceTransaction,
  onOpenAccounts,
  onEditTransaction,
  refreshSignal,
}: Props) {
  const { signOut } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deletingTransactionId, setDeletingTransactionId] = useState<string | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [filters, setFilters] = useState<TransactionFilters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<ParsedTransactionFilters>({
    description: '',
    type: 'all',
    startDate: null,
    endDate: null,
  });
  const [filterErrorMessage, setFilterErrorMessage] = useState<string | null>(null);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      let query = supabase
        .from('transactions')
        .select(
          'id, company_id, category_id, type, description, amount, status, transaction_date, due_date, supplier_customer, payment_method, settled_at, settled_amount, created_at',
        )
        .eq('company_id', selectedControlId);

      if (appliedFilters.description) {
        query = query.ilike('description', `%${appliedFilters.description}%`);
      }

      if (appliedFilters.type !== 'all') {
        query = query.eq('type', appliedFilters.type);
      }

      if (appliedFilters.startDate) {
        query = query.gte('transaction_date', appliedFilters.startDate);
      }

      if (appliedFilters.endDate) {
        query = query.lte('transaction_date', appliedFilters.endDate);
      }

      const { data, error } = await query.order('transaction_date', { ascending: false, nullsFirst: false });

      if (error) throw error;

      setTransactions(await addCategoryNamesToTransactions((data ?? []) as Transaction[], selectedControlId));
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
        let fallbackQuery = supabase
          .from('transactions')
          .select(
            'id, company_id, category_id, type, description, amount, status, transaction_date, due_date, supplier_customer, payment_method, settled_at, settled_amount, created_at',
          )
          .eq('company_id', selectedControlId);

        if (appliedFilters.description) {
          fallbackQuery = fallbackQuery.ilike('description', `%${appliedFilters.description}%`);
        }

        if (appliedFilters.type !== 'all') {
          fallbackQuery = fallbackQuery.eq('type', appliedFilters.type);
        }

        if (appliedFilters.startDate) {
          fallbackQuery = fallbackQuery.gte('transaction_date', appliedFilters.startDate);
        }

        if (appliedFilters.endDate) {
          fallbackQuery = fallbackQuery.lte('transaction_date', appliedFilters.endDate);
        }

        const { data, error: fallbackError } = await fallbackQuery.order('created_at', { ascending: false, nullsFirst: false });

        if (fallbackError) throw fallbackError;

        setTransactions(await addCategoryNamesToTransactions((data ?? []) as Transaction[], selectedControlId));
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
  }, [appliedFilters, selectedControlId]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions, refreshSignal]);

  const hasActiveAppliedFilters = Boolean(
    appliedFilters.description || appliedFilters.type !== 'all' || appliedFilters.startDate || appliedFilters.endDate,
  );

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

  const deleteTransaction = async (transactionId: string) => {
    setDeletingTransactionId(transactionId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { data, error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transactionId)
        .eq('company_id', selectedControlId)
        .select('id')
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error('Lançamento não encontrado ou sem permissão para excluir.');
      }

      await loadTransactions();
      setSuccessMessage('Lançamento excluído com sucesso.');
    } catch (error) {
      const supabaseError = error as { message?: string; code?: string; details?: string; hint?: string };

      console.error('Erro ao excluir lançamento', {
        message: supabaseError?.message,
        code: supabaseError?.code,
        details: supabaseError?.details,
        hint: supabaseError?.hint,
      });

      setErrorMessage('Não foi possível excluir este lançamento agora. Tente novamente.');
    } finally {
      setDeletingTransactionId(null);
    }
  };

  const handleDeleteTransaction = (transaction: Transaction) => {
    Alert.alert(
      'Excluir lançamento',
      'Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            void deleteTransaction(transaction.id);
          },
        },
      ],
    );
  };

  const handleFilterFieldChange = (field: keyof TransactionFilters, value: string) => {
    setFilters((currentFilters) => ({ ...currentFilters, [field]: value }));
  };

  const handleFilterTypeChange = (type: TransactionFilterType) => {
    setFilters((currentFilters) => ({ ...currentFilters, type }));
  };

  const handleApplyFilters = () => {
    const normalized = normalizeFilters(filters);

    if (normalized.error) {
      setFilterErrorMessage(normalized.error);
      return;
    }

    setFilterErrorMessage(null);
    setAppliedFilters(normalized.filters ?? { description: '', type: 'all', startDate: null, endDate: null });
  };

  const handleClearFilters = () => {
    setFilterErrorMessage(null);
    setFilters(initialFilters);
    setAppliedFilters({ description: '', type: 'all', startDate: null, endDate: null });
  };

  const handleExportCsv = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (transactions.length === 0) {
      const message = hasActiveAppliedFilters
        ? 'Não há movimentações para exportar com os filtros aplicados.'
        : 'Não há movimentações para exportar neste controle.';

      setSuccessMessage(message);
      Alert.alert('Exportar CSV', message);
      return;
    }

    setExportingCsv(true);

    try {
      const csvContent = buildTransactionsCsv(transactions);
      const result = await Share.share({
        title: 'Movimentações em CSV',
        message: csvContent,
      });

      if (result.action === Share.dismissedAction) {
        setSuccessMessage('Exportação cancelada. Você pode tentar novamente quando quiser.');
        return;
      }

      setSuccessMessage('CSV gerado com sucesso. Use a opção escolhida para compartilhar ou copiar o conteúdo.');
    } catch (error) {
      console.error('Erro ao exportar movimentações em CSV', error);
      setErrorMessage('Não foi possível exportar o CSV agora. Tente novamente.');
      Alert.alert('Exportar CSV', 'Não foi possível exportar o CSV agora. Tente novamente.');
    } finally {
      setExportingCsv(false);
    }
  };

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

      <View style={styles.topActions}>
        <Pressable style={styles.newTransactionButton} onPress={onNewTransaction}>
          <Text style={styles.newTransactionButtonText}>Novo lançamento manual</Text>
        </Pressable>
        <Pressable style={styles.textTransactionButton} onPress={onTextTransaction}>
          <Text style={styles.textTransactionButtonText}>Registrar por texto</Text>
        </Pressable>
        <Pressable style={styles.voiceTransactionButton} onPress={onVoiceTransaction}>
          <Text style={styles.voiceTransactionButtonText}>Registrar por voz (simulado)</Text>
        </Pressable>
        <Pressable style={styles.accountsButton} onPress={onOpenAccounts}>
          <Text style={styles.accountsButtonText}>Ver contas</Text>
        </Pressable>
        <Pressable
          style={[styles.exportButton, exportingCsv || loading ? styles.disabledButton : null]}
          onPress={handleExportCsv}
          disabled={exportingCsv || loading}
        >
          <Text style={styles.exportButtonText}>{exportingCsv ? 'Exportando...' : 'Exportar CSV'}</Text>
        </Pressable>
      </View>

      <View style={styles.summaryBox}>
        <Text style={styles.summaryLabel}>Resumo dos lançamentos filtrados</Text>
        <Text style={styles.summaryText}>Receitas: {formatCurrencyBRL(summary.receitas)}</Text>
        <Text style={styles.summaryText}>Despesas: {formatCurrencyBRL(summary.despesas)}</Text>
        <Text style={styles.summaryBalance}>Saldo do período: {formatCurrencyBRL(summary.receitas - summary.despesas)}</Text>
      </View>

      <View style={styles.filtersBox}>
        <Text style={styles.filtersTitle}>Filtros</Text>

        <Text style={styles.inputLabel}>Texto/descrição</Text>
        <TextInput
          style={styles.input}
          placeholder="Buscar pela descrição"
          value={filters.description}
          onChangeText={(value) => handleFilterFieldChange('description', value)}
          autoCapitalize="none"
          returnKeyType="search"
        />

        <Text style={styles.inputLabel}>Tipo</Text>
        <View style={styles.typeFilterRow}>
          {([
            ['all', 'Todos'],
            ['receita', 'Receitas'],
            ['despesa', 'Despesas'],
          ] as const).map(([type, label]) => (
            <Pressable
              key={type}
              style={[styles.typeFilterButton, filters.type === type ? styles.typeFilterButtonActive : null]}
              onPress={() => handleFilterTypeChange(type)}
            >
              <Text style={[styles.typeFilterButtonText, filters.type === type ? styles.typeFilterButtonTextActive : null]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.periodRow}>
          <View style={styles.periodField}>
            <Text style={styles.inputLabel}>Período inicial</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD ou DD/MM/AAAA"
              value={filters.startDate}
              onChangeText={(value) => handleFilterFieldChange('startDate', value)}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.periodField}>
            <Text style={styles.inputLabel}>Período final</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD ou DD/MM/AAAA"
              value={filters.endDate}
              onChangeText={(value) => handleFilterFieldChange('endDate', value)}
              autoCapitalize="none"
            />
          </View>
        </View>

        {filterErrorMessage ? <Text style={styles.errorText}>{filterErrorMessage}</Text> : null}

        <View style={styles.filterActions}>
          <Pressable style={styles.applyFilterButton} onPress={handleApplyFilters} disabled={loading}>
            <Text style={styles.applyFilterButtonText}>Aplicar filtros</Text>
          </Pressable>
          <Pressable style={styles.clearFilterButton} onPress={handleClearFilters} disabled={loading}>
            <Text style={styles.clearFilterButtonText}>Limpar filtros</Text>
          </Pressable>
        </View>
      </View>

      {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}

      {loading ? (
        <View style={styles.centeredContent}>
          <ActivityIndicator size="large" />
          <Text style={styles.feedbackText}>Carregando movimentações...</Text>
          <Text style={styles.feedbackHint}>Atualizando lista, resumo e filtros aplicados.</Text>
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
          <Text style={styles.feedbackText}>
            {hasActiveAppliedFilters
              ? 'Nenhuma movimentação encontrada com os filtros informados.'
              : 'Ainda não há movimentações para este controle.'}
          </Text>
          {hasActiveAppliedFilters ? (
            <Text style={styles.feedbackHint}>Limpe ou ajuste os filtros para ver outras movimentações.</Text>
          ) : (
            <Text style={styles.feedbackHint}>Use Novo lançamento manual, texto ou voz simulada para começar.</Text>
          )}
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
                {transaction.payment_method ? (
                  <Text style={styles.transactionInfo}>Forma de pagamento: {transaction.payment_method}</Text>
                ) : null}
                <View style={styles.transactionActions}>
                  <Pressable
                    style={styles.editButton}
                    onPress={() => onEditTransaction(transaction)}
                    disabled={deletingTransactionId === transaction.id}
                  >
                    <Text style={styles.editButtonText}>Editar</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.deleteButton, deletingTransactionId === transaction.id ? styles.disabledButton : null]}
                    onPress={() => handleDeleteTransaction(transaction)}
                    disabled={deletingTransactionId === transaction.id}
                  >
                    <Text style={styles.deleteButtonText}>{deletingTransactionId === transaction.id ? 'Excluindo...' : 'Excluir'}</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <View style={styles.footerButtons}>
        <Pressable style={styles.secondaryButton} onPress={onBack}>
          <Text style={styles.secondaryButtonText}>Voltar para Início</Text>
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
  topActions: { gap: 8, marginBottom: 12 },
  newTransactionButton: { backgroundColor: '#111', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  newTransactionButtonText: { color: '#fff', fontWeight: '700' },
  accountsButton: { borderWidth: 1, borderColor: '#1b64d9', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  accountsButtonText: { color: '#1b64d9', fontWeight: '700' },
  textTransactionButton: { borderWidth: 1, borderColor: '#116329', borderRadius: 10, paddingVertical: 12, alignItems: 'center', backgroundColor: '#f5fff7' },
  textTransactionButtonText: { color: '#116329', fontWeight: '700' },
  voiceTransactionButton: { borderWidth: 1, borderColor: '#6d28d9', borderRadius: 10, paddingVertical: 12, alignItems: 'center', backgroundColor: '#f5f3ff' },
  voiceTransactionButtonText: { color: '#6d28d9', fontWeight: '700' },
  exportButton: { borderWidth: 1, borderColor: '#116329', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  exportButtonText: { color: '#116329', fontWeight: '700' },
  summaryBox: { borderWidth: 1, borderColor: '#d9d9d9', borderRadius: 12, padding: 12, gap: 4, marginBottom: 12 },
  summaryLabel: { fontSize: 13, color: '#555', fontWeight: '600' },
  summaryText: { fontSize: 15, color: '#222' },
  summaryBalance: { fontSize: 16, fontWeight: '700', color: '#111' },
  centeredContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  feedbackText: { textAlign: 'center', color: '#444', fontSize: 16 },
  errorText: { textAlign: 'center', color: '#b00020', fontSize: 16 },
  successText: { textAlign: 'center', color: '#116329', fontSize: 15, marginBottom: 12 },
  feedbackHint: { textAlign: 'center', color: '#666', fontSize: 14 },
  filtersBox: { borderWidth: 1, borderColor: '#e1e1e1', borderRadius: 12, padding: 12, gap: 8, marginBottom: 12 },
  filtersTitle: { fontSize: 16, fontWeight: '700', color: '#111' },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#333' },
  input: { borderWidth: 1, borderColor: '#cfcfcf', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  typeFilterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeFilterButton: { borderWidth: 1, borderColor: '#333', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  typeFilterButtonActive: { backgroundColor: '#111' },
  typeFilterButtonText: { color: '#111', fontWeight: '600' },
  typeFilterButtonTextActive: { color: '#fff' },
  periodRow: { gap: 8 },
  periodField: { gap: 6 },
  filterActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  applyFilterButton: { backgroundColor: '#111', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center' },
  applyFilterButtonText: { color: '#fff', fontWeight: '700' },
  clearFilterButton: { borderRadius: 10, borderWidth: 1, borderColor: '#333', paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center' },
  clearFilterButtonText: { color: '#111', fontWeight: '700' },
  listContainer: { flex: 1 },
  listContent: { gap: 10, paddingBottom: 12 },
  transactionCard: { borderRadius: 12, borderWidth: 1, borderColor: '#d9d9d9', padding: 14, gap: 3 },
  transactionDescription: { fontSize: 16, fontWeight: '700', color: '#111' },
  transactionInfo: { fontSize: 14, color: '#333' },
  transactionActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  editButton: { borderRadius: 8, borderWidth: 1, borderColor: '#1b64d9', paddingHorizontal: 12, paddingVertical: 8 },
  editButtonText: { color: '#1b64d9', fontWeight: '700' },
  deleteButton: { borderRadius: 8, borderWidth: 1, borderColor: '#b00020', backgroundColor: '#fff5f5', paddingHorizontal: 12, paddingVertical: 8 },
  deleteButtonText: { color: '#b00020', fontWeight: '800' },
  disabledButton: { opacity: 0.6 },
  footerButtons: { gap: 10, marginTop: 10 },
  secondaryButton: { borderRadius: 10, borderWidth: 1, borderColor: '#333', paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center' },
  secondaryButtonText: { color: '#111', fontWeight: '600' },
  logoutButton: { backgroundColor: '#111', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  logoutButtonText: { color: '#fff', fontWeight: '600' },
});
