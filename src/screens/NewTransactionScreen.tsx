import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { supabase } from '../lib/supabase';
import { Category } from '../types/category';
import { normalizeIsoDate, parseAmountInput } from '../utils/formatters';

type Props = {
  selectedControlId: string;
  onBack: () => void;
  onSaved: () => void;
};

export function NewTransactionScreen({ selectedControlId, onBack, onSaved }: Props) {
  const [type, setType] = useState<'receita' | 'despesa'>('receita');
  const [description, setDescription] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState<'pago' | 'pendente'>('pago');
  const [dueDate, setDueDate] = useState('');
  const [supplierCustomer, setSupplierCustomer] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadCategories = async () => {
      setLoadingCategories(true);
      setErrorMessage(null);

      try {
        const { data, error } = await supabase.from('categories').select('id, name, description, type').order('name', { ascending: true });
        if (error) throw error;
        setCategories((data ?? []) as Category[]);
      } catch (error) {
        const supabaseError = error as { message?: string; code?: string; details?: string; hint?: string };
        if (__DEV__) {
          console.error('Erro ao carregar categorias', {
            message: supabaseError?.message,
            code: supabaseError?.code,
            details: supabaseError?.details,
            hint: supabaseError?.hint,
          });
        }
        setErrorMessage('Não foi possível carregar as categorias agora. Tente novamente.');
      } finally {
        setLoadingCategories(false);
      }
    };

    loadCategories();
  }, []);

  const filteredCategories = useMemo(() => {
    const hasAnyType = categories.some((category) => (category.type ?? '').trim().length > 0);

    if (!hasAnyType) return categories;

    return categories.filter((category) => {
      const categoryType = (category.type ?? '').trim().toLowerCase();
      if (!categoryType) return true;
      return categoryType === type;
    });
  }, [categories, type]);

  useEffect(() => {
    if (!filteredCategories.some((category) => category.id === categoryId)) {
      setCategoryId(filteredCategories[0]?.id ?? '');
    }
  }, [filteredCategories, categoryId]);

  const handleSave = async () => {
    const amount = parseAmountInput(amountInput);
    const normalizedTransactionDate = normalizeIsoDate(transactionDate);
    const normalizedDueDate = dueDate.trim() ? normalizeIsoDate(dueDate) : null;

    if (!type || !description.trim() || amount <= 0 || !normalizedTransactionDate || !categoryId) {
      setErrorMessage('Preencha os campos obrigatórios: tipo, descrição, valor, data e categoria.');
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.from('transactions').insert({
        company_id: selectedControlId,
        category_id: categoryId,
        type,
        description: description.trim(),
        amount,
        transaction_date: normalizedTransactionDate,
        due_date: normalizedDueDate,
        status,
        supplier_customer: supplierCustomer.trim() || null,
        payment_method: paymentMethod.trim() || null,
      });

      if (error) throw error;

      onSaved();
    } catch (error) {
      const supabaseError = error as { message?: string; code?: string; details?: string; hint?: string };
      if (__DEV__) {
        console.error('Erro ao salvar lançamento', {
          message: supabaseError?.message,
          code: supabaseError?.code,
          details: supabaseError?.details,
          hint: supabaseError?.hint,
        });
      }
      setErrorMessage('Não foi possível salvar o lançamento agora. Revise os dados e tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Novo lançamento</Text>
      </View>

      <ScrollView contentContainerStyle={styles.formContainer}>
        <Text style={styles.label}>Tipo *</Text>
        <View style={styles.row}>
          <Pressable style={[styles.chip, type === 'receita' && styles.chipActive]} onPress={() => setType('receita')}>
            <Text style={[styles.chipText, type === 'receita' && styles.chipTextActive]}>Receita</Text>
          </Pressable>
          <Pressable style={[styles.chip, type === 'despesa' && styles.chipActive]} onPress={() => setType('despesa')}>
            <Text style={[styles.chipText, type === 'despesa' && styles.chipTextActive]}>Despesa</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Descrição *</Text>
        <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="Ex.: Venda de serviço" />

        <Text style={styles.label}>Valor *</Text>
        <TextInput style={styles.input} value={amountInput} onChangeText={setAmountInput} placeholder="Ex.: 10,50" keyboardType="decimal-pad" />

        <Text style={styles.label}>Data da movimentação (YYYY-MM-DD) *</Text>
        <TextInput style={styles.input} value={transactionDate} onChangeText={setTransactionDate} placeholder="YYYY-MM-DD" autoCapitalize="none" />

        <Text style={styles.label}>Categoria *</Text>
        {loadingCategories ? (
          <View style={styles.inlineLoading}>
            <ActivityIndicator size="small" />
            <Text>Carregando categorias...</Text>
          </View>
        ) : filteredCategories.length === 0 ? (
          <Text style={styles.helpText}>Nenhuma categoria disponível.</Text>
        ) : (
          <View style={styles.optionsWrap}>
            {filteredCategories.map((category) => (
              <Pressable
                key={category.id}
                style={[styles.option, categoryId === category.id && styles.optionActive]}
                onPress={() => setCategoryId(category.id)}
              >
                <Text style={[styles.optionText, categoryId === category.id && styles.optionTextActive]}>{category.name ?? 'Categoria sem nome'}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={styles.label}>Status *</Text>
        <View style={styles.row}>
          <Pressable style={[styles.chip, status === 'pago' && styles.chipActive]} onPress={() => setStatus('pago')}>
            <Text style={[styles.chipText, status === 'pago' && styles.chipTextActive]}>Conta paga</Text>
          </Pressable>
          <Pressable style={[styles.chip, status === 'pendente' && styles.chipActive]} onPress={() => setStatus('pendente')}>
            <Text style={[styles.chipText, status === 'pendente' && styles.chipTextActive]}>Conta pendente</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Vencimento (opcional, YYYY-MM-DD)</Text>
        <TextInput style={styles.input} value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" autoCapitalize="none" />

        <Text style={styles.label}>Fornecedor/cliente (opcional)</Text>
        <TextInput style={styles.input} value={supplierCustomer} onChangeText={setSupplierCustomer} />

        <Text style={styles.label}>Forma de pagamento (opcional)</Text>
        <TextInput style={styles.input} value={paymentMethod} onChangeText={setPaymentMethod} />

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </ScrollView>

      <View style={styles.footerButtons}>
        <Pressable style={styles.secondaryButton} onPress={onBack}>
          <Text style={styles.secondaryButtonText}>Voltar para Movimentações</Text>
        </Pressable>
        <Pressable style={styles.primaryButton} onPress={handleSave} disabled={saving || loadingCategories}>
          <Text style={styles.primaryButtonText}>{saving ? 'Salvando...' : 'Salvar lançamento'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  header: { marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '700' },
  formContainer: { gap: 8, paddingBottom: 16 },
  label: { fontWeight: '600', marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#d9d9d9', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderColor: '#a4a4a4', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipActive: { backgroundColor: '#111', borderColor: '#111' },
  chipText: { color: '#111', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  optionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderWidth: 1, borderColor: '#aaa', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  optionActive: { borderColor: '#111', backgroundColor: '#111' },
  optionText: { color: '#111' },
  optionTextActive: { color: '#fff' },
  helpText: { color: '#555' },
  inlineLoading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText: { color: '#b00020', marginTop: 10 },
  footerButtons: { gap: 10, marginTop: 10 },
  secondaryButton: { borderRadius: 10, borderWidth: 1, borderColor: '#333', paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center' },
  secondaryButtonText: { color: '#111', fontWeight: '600' },
  primaryButton: { backgroundColor: '#111', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
});
