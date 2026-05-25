import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { supabase } from '../lib/supabase';

type TransactionType = 'receita' | 'despesa';
type TransactionStatus = 'pago' | 'pendente';

type Category = {
  id: string;
  name: string;
  type?: TransactionType | string | null;
};

type NewTransactionScreenProps = {
  selectedControlId: string;
  onBack: () => void;
  onSaved: () => void;
};

type SupabaseErrorLike = {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function parseBrazilianAmount(value: string): number | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const withoutCurrency = trimmed
    .replace(/R\$/gi, '')
    .replace(/\s/g, '')
    .trim();

  const normalized = withoutCurrency.includes(',')
    ? withoutCurrency.replace(/\./g, '').replace(',', '.')
    : withoutCurrency;

  const amount = Number(normalized);

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return amount;
}

function normalizeIsoDate(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const brazilianDateMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);

  if (brazilianDateMatch) {
    const [, day, month, year] = brazilianDateMatch;
    return `${year}-${month}-${day}`;
  }

  return null;
}

function nullableTrim(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function logSupabaseError(context: string, error: SupabaseErrorLike | null) {
  if (!error) {
    return;
  }

  console.error(context, {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  });
}

export function NewTransactionScreen({
  selectedControlId,
  onBack,
  onSaved,
}: NewTransactionScreenProps) {
  const [type, setType] = useState<TransactionType>('despesa');
  const [description, setDescription] = useState('');
  const [amountText, setAmountText] = useState('');
  const [transactionDate, setTransactionDate] = useState(todayIsoDate());
  const [status, setStatus] = useState<TransactionStatus>('pago');
  const [dueDate, setDueDate] = useState('');
  const [supplierCustomer, setSupplierCustomer] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');

  const [loadingCategories, setLoadingCategories] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const filteredCategories = useMemo(() => {
    return categories.filter((category) => {
      if (!category.type) {
        return true;
      }

      return category.type === type;
    });
  }, [categories, type]);

  useEffect(() => {
    if (
      selectedCategoryId &&
      !filteredCategories.some((category) => category.id === selectedCategoryId)
    ) {
      setSelectedCategoryId('');
    }
  }, [filteredCategories, selectedCategoryId]);

  useEffect(() => {
    let isMounted = true;

    async function loadCategories() {
      setLoadingCategories(true);
      setCategoryError(null);

      const primaryResult = await supabase
        .from('categories')
        .select('id, name, type')
        .order('name', { ascending: true });

      if (!isMounted) {
        return;
      }

      if (!primaryResult.error) {
        setCategories((primaryResult.data ?? []) as Category[]);
        setLoadingCategories(false);
        return;
      }

      logSupabaseError('Erro ao carregar categorias com type', primaryResult.error);

      const fallbackResult = await supabase
        .from('categories')
        .select('id, name')
        .order('name', { ascending: true });

      if (!isMounted) {
        return;
      }

      if (fallbackResult.error) {
        logSupabaseError('Erro ao carregar categorias sem type', fallbackResult.error);

        setCategories([]);
        setCategoryError('Não foi possível carregar as categorias agora.');
        setLoadingCategories(false);
        return;
      }

      setCategories((fallbackResult.data ?? []) as Category[]);
      setLoadingCategories(false);
    }

    loadCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSave() {
    setFormError(null);

    const normalizedAmount = parseBrazilianAmount(amountText);
    const normalizedTransactionDate = normalizeIsoDate(transactionDate);
    const normalizedDueDate = dueDate.trim() ? normalizeIsoDate(dueDate) : null;

    if (!selectedControlId) {
      setFormError('Selecione um controle antes de criar um lançamento.');
      return;
    }

    if (!description.trim()) {
      setFormError('Informe uma descrição para o lançamento.');
      return;
    }

    if (!normalizedAmount) {
      setFormError('Informe um valor maior que zero.');
      return;
    }

    if (!normalizedTransactionDate) {
      setFormError('Informe uma data válida no formato YYYY-MM-DD ou DD/MM/AAAA.');
      return;
    }

    if (dueDate.trim() && !normalizedDueDate) {
      setFormError('Informe um vencimento válido no formato YYYY-MM-DD ou DD/MM/AAAA.');
      return;
    }

    if (!selectedCategoryId) {
      setFormError('Selecione uma categoria para continuar.');
      return;
    }

    setSaving(true);

    const { error } = await supabase.from('transactions').insert({
      company_id: selectedControlId,
      category_id: selectedCategoryId,
      type,
      description: description.trim(),
      amount: normalizedAmount,
      transaction_date: normalizedTransactionDate,
      due_date: normalizedDueDate,
      status,
      supplier_customer: nullableTrim(supplierCustomer),
      payment_method: nullableTrim(paymentMethod),
    });

    setSaving(false);

    if (error) {
      logSupabaseError('Erro ao salvar lançamento', error);
      setFormError('Não foi possível salvar o lançamento agora.');
      return;
    }

    onSaved();
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Controle atual</Text>
        <Text style={styles.title}>Novo lançamento</Text>
        <Text style={styles.subtitle}>
          Registre uma receita ou despesa manualmente.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Tipo</Text>

        <View style={styles.row}>
          <Pressable
            style={[
              styles.optionButton,
              type === 'receita' && styles.optionButtonActive,
            ]}
            onPress={() => setType('receita')}
          >
            <Text
              style={[
                styles.optionButtonText,
                type === 'receita' && styles.optionButtonTextActive,
              ]}
            >
              Receita
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.optionButton,
              type === 'despesa' && styles.optionButtonActive,
            ]}
            onPress={() => setType('despesa')}
          >
            <Text
              style={[
                styles.optionButtonText,
                type === 'despesa' && styles.optionButtonTextActive,
              ]}
            >
              Despesa
            </Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Descrição</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex.: Venda no balcão"
          value={description}
          onChangeText={setDescription}
        />

        <Text style={styles.label}>Valor</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex.: 150,00"
          keyboardType="decimal-pad"
          value={amountText}
          onChangeText={setAmountText}
        />

        <Text style={styles.label}>Data da movimentação</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD ou DD/MM/AAAA"
          value={transactionDate}
          onChangeText={setTransactionDate}
        />

        <Text style={styles.label}>Categoria</Text>

        {loadingCategories ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator />
            <Text style={styles.helperText}>Carregando categorias...</Text>
          </View>
        ) : null}

        {!loadingCategories && categoryError ? (
          <Text style={styles.errorText}>{categoryError}</Text>
        ) : null}

        {!loadingCategories && !categoryError && filteredCategories.length === 0 ? (
          <Text style={styles.helperText}>Nenhuma categoria disponível.</Text>
        ) : null}

        {!loadingCategories && filteredCategories.length > 0 ? (
          <View style={styles.categoryList}>
            {filteredCategories.map((category) => {
              const selected = selectedCategoryId === category.id;

              return (
                <Pressable
                  key={category.id}
                  style={[
                    styles.categoryButton,
                    selected && styles.categoryButtonActive,
                  ]}
                  onPress={() => setSelectedCategoryId(category.id)}
                >
                  <Text
                    style={[
                      styles.categoryButtonText,
                      selected && styles.categoryButtonTextActive,
                    ]}
                  >
                    {category.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <Text style={styles.label}>Status</Text>

        <View style={styles.row}>
          <Pressable
            style={[
              styles.optionButton,
              status === 'pago' && styles.optionButtonActive,
            ]}
            onPress={() => setStatus('pago')}
          >
            <Text
              style={[
                styles.optionButtonText,
                status === 'pago' && styles.optionButtonTextActive,
              ]}
            >
              Conta paga
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.optionButton,
              status === 'pendente' && styles.optionButtonActive,
            ]}
            onPress={() => setStatus('pendente')}
          >
            <Text
              style={[
                styles.optionButtonText,
                status === 'pendente' && styles.optionButtonTextActive,
              ]}
            >
              Conta pendente
            </Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Vencimento, opcional</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD ou DD/MM/AAAA"
          value={dueDate}
          onChangeText={setDueDate}
        />

        <Text style={styles.label}>Fornecedor/cliente, opcional</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex.: Cliente João ou Fornecedor Silva"
          value={supplierCustomer}
          onChangeText={setSupplierCustomer}
        />

        <Text style={styles.label}>Forma de pagamento, opcional</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex.: Pix, dinheiro, cartão"
          value={paymentMethod}
          onChangeText={setPaymentMethod}
        />

        {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

        <Pressable
          style={[styles.primaryButton, saving && styles.disabledButton]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.primaryButtonText}>Salvar lançamento</Text>
          )}
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={onBack} disabled={saving}>
          <Text style={styles.secondaryButtonText}>Voltar para Movimentações</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

export default NewTransactionScreen;

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: '#f8fafc',
  },
  header: {
    marginBottom: 20,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563eb',
    marginBottom: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#475569',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  row: {
    flexDirection: 'row',
    marginHorizontal: -4,
  },
  optionButton: {
    flex: 1,
    minHeight: 46,
    marginHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    backgroundColor: '#ffffff',
  },
  optionButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  optionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  optionButtonTextActive: {
    color: '#ffffff',
  },
  loadingBox: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
  },
  helperText: {
    fontSize: 14,
    color: '#64748b',
    marginLeft: 8,
  },
  categoryList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    marginTop: 2,
  },
  categoryButton: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 12,
    margin: 4,
    backgroundColor: '#ffffff',
  },
  categoryButtonActive: {
    backgroundColor: '#dbeafe',
    borderColor: '#2563eb',
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  categoryButtonTextActive: {
    color: '#1d4ed8',
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 20,
    color: '#dc2626',
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    backgroundColor: '#2563eb',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  disabledButton: {
    opacity: 0.7,
  },
});