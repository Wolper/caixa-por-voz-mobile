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
import { PilotBadge } from '../components/PilotBadge';
import { supabase } from '../lib/supabase';
import {
  controlHasCategoriesForAllDefaultTypes,
  loadCategoriesForControl,
  prepareDefaultCategoriesForControl,
} from '../services/categories';
import type { CategoryRow } from '../services/categories';
import type { Transaction } from '../types/transaction';
import type { TextTransactionDraft } from './TextTransactionScreen';

type TransactionType = 'receita' | 'despesa';
type TransactionStatus = 'pago' | 'pendente';
type Category = CategoryRow;

type NewTransactionScreenProps = {
  selectedControlId: string;
  onBack: () => void;
  onSaved: () => void;
  transactionToEdit?: Transaction;
  initialDraft?: TextTransactionDraft;
  backLabel?: string;
};

type SupabaseErrorLike = {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
};

type ParsedDateParts = {
  year: string;
  month: string;
  day: string;
};

function todayIsoDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
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

function formatAmountForDisplay(amount: number) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function parseDateParts(value: string): ParsedDateParts | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const isoDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);

  if (isoDateMatch) {
    const [, year, month, day] = isoDateMatch;
    return { year, month, day };
  }

  const brazilianDateMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);

  if (brazilianDateMatch) {
    const [, day, month, year] = brazilianDateMatch;
    return { year, month, day };
  }

  return null;
}

function isValidLocalDate({ year, month, day }: ParsedDateParts) {
  const yearNumber = Number(year);
  const monthNumber = Number(month);
  const dayNumber = Number(day);

  if (
    !Number.isInteger(yearNumber) ||
    !Number.isInteger(monthNumber) ||
    !Number.isInteger(dayNumber)
  ) {
    return false;
  }

  const localDate = new Date(yearNumber, monthNumber - 1, dayNumber);

  return (
    localDate.getFullYear() === yearNumber &&
    localDate.getMonth() === monthNumber - 1 &&
    localDate.getDate() === dayNumber
  );
}

function normalizeIsoDate(value: string): string | null {
  const parts = parseDateParts(value);

  if (!parts || !isValidLocalDate(parts)) {
    return null;
  }

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatIsoDateToBR(value: string | null) {
  if (!value) {
    return '';
  }

  const parts = parseDateParts(value);

  if (!parts || !isValidLocalDate(parts)) {
    return '';
  }

  return `${parts.day}/${parts.month}/${parts.year}`;
}

function normalizeTransactionType(value?: string | null): TransactionType {
  return value === 'receita' ? 'receita' : 'despesa';
}

function normalizeTransactionStatus(value?: string | null): TransactionStatus {
  return value === 'pendente' ? 'pendente' : 'pago';
}

function toEditableAmount(value?: number | string | null) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? formatAmountForDisplay(value) : '';
  }

  if (typeof value === 'string') {
    const amount = parseBrazilianAmount(value);
    return amount ? formatAmountForDisplay(amount) : value;
  }

  return '';
}

function nullableTrim(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeCategoryName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function dedupeCategoriesByName(categories: Category[]) {
  const seen = new Set<string>();
  const result: Category[] = [];

  for (const category of categories) {
    const key = normalizeCategoryName(category.name);

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(category);
  }

  return result;
}

function logSupabaseError(context: string, error: SupabaseErrorLike | null) {
  if (!error) {
    return;
  }

  if (__DEV__) {
    console.warn(context, {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
  }
}

export function NewTransactionScreen({
  selectedControlId,
  onBack,
  onSaved,
  transactionToEdit,
  initialDraft,
  backLabel = 'Voltar para Movimentações',
}: NewTransactionScreenProps) {
  const isEditing = Boolean(transactionToEdit);
  const draftSourceLabel = initialDraft?.sourceMode === 'voice' ? 'voz' : 'texto';
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
  const [categorySelectorOpen, setCategorySelectorOpen] = useState(false);

  const [loadingCategories, setLoadingCategories] = useState(false);
  const [preparingCategories, setPreparingCategories] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!transactionToEdit) {
      return;
    }

    setType(normalizeTransactionType(transactionToEdit.type));
    setDescription(transactionToEdit.description ?? '');
    setAmountText(toEditableAmount(transactionToEdit.amount));
    setTransactionDate(
      formatIsoDateToBR(transactionToEdit.transaction_date ?? null) ||
        transactionToEdit.transaction_date ||
        todayIsoDate(),
    );
    setStatus(normalizeTransactionStatus(transactionToEdit.status));
    setDueDate(formatIsoDateToBR(transactionToEdit.due_date ?? null) || transactionToEdit.due_date || '');
    setSupplierCustomer(transactionToEdit.supplier_customer ?? '');
    setPaymentMethod(transactionToEdit.payment_method ?? '');
    setSelectedCategoryId(transactionToEdit.category_id ?? '');
    setCategorySelectorOpen(false);
    setFormError(null);
    setSaveFeedback(null);
  }, [transactionToEdit]);

  useEffect(() => {
    if (!initialDraft || transactionToEdit) {
      return;
    }

    setType(initialDraft.type ?? 'despesa');
    setDescription(initialDraft.description);
    setAmountText(initialDraft.amount ? formatAmountForDisplay(initialDraft.amount) : '');
    setTransactionDate(formatIsoDateToBR(initialDraft.transactionDate) || initialDraft.transactionDate || todayIsoDate());
    setStatus(initialDraft.status);
    setDueDate(initialDraft.dueDate ? formatIsoDateToBR(initialDraft.dueDate) || initialDraft.dueDate : '');
    setSupplierCustomer('');
    setPaymentMethod(initialDraft.paymentMethod ?? '');
    setSelectedCategoryId('');
    setCategorySelectorOpen(false);
    setFormError(
      initialDraft.confidenceMessages.length > 0
        ? 'Revise os campos destacados antes de salvar. Nada foi salvo automaticamente.'
        : null,
    );
    setSaveFeedback('Campos preenchidos pela interpretação local. Revise todos os campos e toque em Salvar lançamento para confirmar.');
  }, [initialDraft, transactionToEdit]);

  const filteredCategories = useMemo(() => {
    const compatibleCategories = categories.filter((category) => {
      if (!category.type) {
        return true;
      }

      return category.type === type;
    });

    return dedupeCategoriesByName(compatibleCategories);
  }, [categories, type]);

  const selectedCategory = useMemo(() => {
    return filteredCategories.find((category) => category.id === selectedCategoryId);
  }, [filteredCategories, selectedCategoryId]);

  useEffect(() => {
    if (!initialDraft?.suggestedCategoryName || transactionToEdit || selectedCategoryId || filteredCategories.length === 0) {
      return;
    }

    const suggestedCategoryKey = normalizeCategoryName(initialDraft.suggestedCategoryName);
    const matchedCategory = filteredCategories.find((category) => normalizeCategoryName(category.name) === suggestedCategoryKey);

    if (matchedCategory) {
      setSelectedCategoryId(matchedCategory.id);
    }
  }, [filteredCategories, initialDraft?.suggestedCategoryName, selectedCategoryId, transactionToEdit]);

  useEffect(() => {
    if (
      selectedCategoryId &&
      categories.length > 0 &&
      !filteredCategories.some((category) => category.id === selectedCategoryId)
    ) {
      setSelectedCategoryId('');
      setCategorySelectorOpen(false);
    }
  }, [categories.length, filteredCategories, selectedCategoryId]);

  useEffect(() => {
    let isMounted = true;

    async function loadCategories() {
      setLoadingCategories(true);
      setPreparingCategories(false);
      setCategoryError(null);

      try {
        const loadedCategories = await loadCategoriesForControl(selectedControlId);

        if (!isMounted) {
          return;
        }

        if (controlHasCategoriesForAllDefaultTypes(loadedCategories)) {
          setCategories(loadedCategories);
          return;
        }

        setPreparingCategories(true);
        const preparedCategories = await prepareDefaultCategoriesForControl(selectedControlId);

        if (!isMounted) {
          return;
        }

        setCategories(preparedCategories);

        if (!controlHasCategoriesForAllDefaultTypes(preparedCategories)) {
          setCategoryError('Não encontramos categorias para este controle. Tente voltar e abrir novamente ou avise o responsável pelo piloto.');
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        logSupabaseError('Erro ao preparar categorias do controle', error as SupabaseErrorLike);
        setCategories([]);
        setCategoryError('Não encontramos categorias para este controle. Tente voltar e abrir novamente ou avise o responsável pelo piloto.');
      } finally {
        if (isMounted) {
          setLoadingCategories(false);
          setPreparingCategories(false);
        }
      }
    }

    loadCategories();

    return () => {
      isMounted = false;
    };
  }, [selectedControlId]);

  async function handleSave() {
    setFormError(null);
    setSaveFeedback(null);

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
      setFormError('Informe uma data da movimentação válida no formato YYYY-MM-DD ou DD/MM/AAAA.');
      return;
    }

    if (dueDate.trim() && !normalizedDueDate) {
      setFormError('O vencimento é opcional, mas precisa estar em YYYY-MM-DD ou DD/MM/AAAA quando preenchido.');
      return;
    }

    if (loadingCategories || preparingCategories) {
      setFormError('Aguarde enquanto preparamos as categorias do controle.');
      return;
    }

    if (!selectedCategoryId) {
      setFormError('Selecione uma categoria para continuar.');
      return;
    }

    setSaving(true);

    const payload = {
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
    };

    if (transactionToEdit) {
      const { data, error } = await supabase
        .from('transactions')
        .update(payload)
        .eq('id', transactionToEdit.id)
        .eq('company_id', selectedControlId)
        .select('id')
        .maybeSingle();

      if (error) {
        setSaving(false);
        logSupabaseError('Erro ao atualizar lançamento', error);
        setFormError('Não foi possível atualizar o lançamento agora.');
        return;
      }

      if (!data) {
        setSaving(false);
        setFormError('Lançamento não encontrado ou sem permissão para editar.');
        return;
      }
    } else {
      const { error } = await supabase.from('transactions').insert(payload);

      if (error) {
        setSaving(false);
        logSupabaseError('Erro ao salvar lançamento', error);
        setFormError('Não foi possível salvar o lançamento agora.');
        return;
      }
    }

    setSaveFeedback(
      isEditing
        ? 'Lançamento atualizado! Atualizando Movimentações...'
        : 'Lançamento salvo! Atualizando Movimentações...',
    );

    setTimeout(() => {
      setSaving(false);
      onSaved();
    }, 700);
  }

  function handleChangeType(nextType: TransactionType) {
    setType(nextType);
    setCategorySelectorOpen(false);
  }

  function handleSelectCategory(categoryId: string) {
    setSelectedCategoryId(categoryId);
    setCategorySelectorOpen(false);
  }

  function handleAmountBlur() {
    const normalizedAmount = parseBrazilianAmount(amountText);

    if (normalizedAmount) {
      setAmountText(formatAmountForDisplay(normalizedAmount));
    }
  }

  function handleDateBlur(value: string, updateValue: (nextValue: string) => void) {
    const normalizedDate = normalizeIsoDate(value);
    const formattedDate = formatIsoDateToBR(normalizedDate);

    if (formattedDate) {
      updateValue(formattedDate);
    }
  }

  const categoryEmptyMessage =
    'Não encontramos categorias para este controle. Tente voltar e abrir novamente ou avise o responsável pelo piloto.';
  const categoryLoadingMessage = preparingCategories ? 'Preparando categorias do controle...' : 'Carregando categorias...';
  const saveDisabled = saving || loadingCategories || preparingCategories;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <PilotBadge />
        <Text style={styles.eyebrow}>Controle atual</Text>
        <Text style={styles.title}>{isEditing ? 'Editar lançamento' : initialDraft ? `Revisar lançamento por ${draftSourceLabel}` : 'Novo lançamento'}</Text>
        <Text style={styles.subtitle}>
          {isEditing
            ? 'Atualize os dados do lançamento selecionado.'
            : initialDraft
              ? 'Confira valor, tipo, data e categoria antes de confirmar. Nada é salvo automaticamente.'
              : 'Registre uma receita ou despesa manualmente nesta versão de validação.'}
        </Text>
      </View>

      {initialDraft && !isEditing ? (
        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>{initialDraft.sourceMode === 'voice' ? 'Texto transcrito interpretado' : 'Texto interpretado'}</Text>
          <Text style={styles.noticeText}>{initialDraft.originalText}</Text>
          {initialDraft.suggestedCategoryName ? (
            <Text style={styles.noticeHint}>Categoria sugerida: {initialDraft.suggestedCategoryName}</Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.label}>Tipo *</Text>

        <View style={styles.row}>
          <Pressable
            style={[
              styles.optionButton,
              type === 'receita' && styles.optionButtonActive,
            ]}
            onPress={() => handleChangeType('receita')}
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
            onPress={() => handleChangeType('despesa')}
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

        <Text style={styles.label}>Descrição *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex.: Venda no balcão"
          value={description}
          onChangeText={setDescription}
        />

        <Text style={styles.label}>Valor *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex.: 150,00"
          keyboardType="decimal-pad"
          value={amountText}
          onChangeText={setAmountText}
          onBlur={handleAmountBlur}
        />
        <Text style={styles.fieldHint}>Aceita vírgula ou ponto: 150,50 ou 150.50.</Text>

        <Text style={styles.label}>Data da movimentação *</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD ou DD/MM/AAAA"
          value={transactionDate}
          onChangeText={setTransactionDate}
          onBlur={() => handleDateBlur(transactionDate, setTransactionDate)}
        />
        <Text style={styles.fieldHint}>Use YYYY-MM-DD ou DD/MM/AAAA. Ex.: 2026-06-25 ou 25/06/2026.</Text>

        <Text style={styles.label}>Categoria *</Text>

        {loadingCategories ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator />
            <Text style={styles.helperText}>{categoryLoadingMessage}</Text>
          </View>
        ) : null}

        {!loadingCategories && categoryError ? (
          <Text style={styles.errorText}>{categoryError}</Text>
        ) : null}

        {!loadingCategories && !categoryError ? (
          <>
            <Pressable
              style={styles.selectButton}
              onPress={() => setCategorySelectorOpen((current) => !current)}
            >
              <Text
                style={[
                  styles.selectButtonText,
                  !selectedCategory && styles.selectButtonPlaceholder,
                ]}
              >
                {selectedCategory?.name ?? 'Selecionar categoria'}
              </Text>

              <Text style={styles.selectButtonIcon}>
                {categorySelectorOpen ? '▲' : '▼'}
              </Text>
            </Pressable>

            {selectedCategory ? (
              <Text style={styles.selectedCategoryText}>Categoria selecionada: {selectedCategory.name}</Text>
            ) : filteredCategories.length === 0 ? (
              <Text style={styles.emptyText}>{categoryEmptyMessage}</Text>
            ) : (
              <Text style={styles.fieldHint}>Toque para escolher uma categoria.</Text>
            )}

            {categorySelectorOpen ? (
              <View style={styles.categoryPanel}>
                {filteredCategories.length === 0 ? (
                  <Text style={styles.emptyText}>{categoryEmptyMessage}</Text>
                ) : (
                  filteredCategories.map((category) => {
                    const selected = selectedCategoryId === category.id;

                    return (
                      <Pressable
                        key={category.id}
                        style={[
                          styles.categoryRow,
                          selected && styles.categoryRowActive,
                        ]}
                        onPress={() => handleSelectCategory(category.id)}
                      >
                        <Text
                          style={[
                            styles.categoryRowText,
                            selected && styles.categoryRowTextActive,
                          ]}
                        >
                          {category.name}
                        </Text>
                      </Pressable>
                    );
                  })
                )}
              </View>
            ) : null}
          </>
        ) : null}

        <Text style={styles.label}>Status *</Text>

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
          onBlur={() => handleDateBlur(dueDate, setDueDate)}
        />
        <Text style={styles.fieldHint}>Pode ficar em branco. Se preencher, use YYYY-MM-DD ou DD/MM/AAAA.</Text>

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
        {saveFeedback ? <Text style={styles.successText}>{saveFeedback}</Text> : null}

        <Pressable
          style={[styles.primaryButton, saveDisabled && styles.disabledButton]}
          onPress={handleSave}
          disabled={saveDisabled}
        >
          {saving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {isEditing ? 'Salvar edição' : 'Salvar lançamento no MVP'}
            </Text>
          )}
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={onBack} disabled={saving}>
          <Text style={styles.secondaryButtonText}>
            {isEditing ? 'Cancelar edição' : initialDraft ? `Voltar para Registrar por ${draftSourceLabel}` : backLabel}
          </Text>
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
  noticeCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginBottom: 16,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1d4ed8',
    marginBottom: 6,
  },
  noticeText: {
    fontSize: 15,
    lineHeight: 21,
    color: '#1e3a8a',
  },
  noticeHint: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#1d4ed8',
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
    marginBottom: 2,
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
  fieldHint: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    color: '#64748b',
  },
  selectButton: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  selectButtonPlaceholder: {
    fontWeight: '500',
    color: '#64748b',
  },
  selectButtonIcon: {
    marginLeft: 12,
    fontSize: 13,
    fontWeight: '800',
    color: '#64748b',
  },
  categoryPanel: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  categoryRow: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  categoryRowActive: {
    backgroundColor: '#dbeafe',
  },
  categoryRowText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  categoryRowTextActive: {
    color: '#1d4ed8',
  },
  emptyText: {
    padding: 14,
    fontSize: 14,
    lineHeight: 20,
    color: '#64748b',
  },
  selectedCategoryText: {
    marginTop: 8,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    fontWeight: '700',
    color: '#1d4ed8',
    backgroundColor: '#dbeafe',
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 20,
    color: '#dc2626',
  },
  successText: {
    marginTop: 12,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    lineHeight: 20,
    color: '#166534',
    backgroundColor: '#dcfce7',
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
