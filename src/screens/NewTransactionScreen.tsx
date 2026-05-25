import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';

import { supabase } from '../lib/supabase';
import { Category } from '../types/category';

type TransactionType = 'receita' | 'despesa';

export function NewTransactionScreen() {
  const [transactionType, setTransactionType] = useState<TransactionType>('despesa');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const loadCategories = useCallback(async (type: TransactionType) => {
    setLoadingCategories(true);
    setCategoriesError(null);

    try {
      const { data, error } = await supabase.from('categories').select('id, name, type').eq('type', type).order('name');

      if (error) throw error;

      setCategories((data ?? []) as Category[]);
      return;
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
    }

    try {
      const { data, error } = await supabase.from('categories').select('id, name').order('name');

      if (error) throw error;

      setCategories((data ?? []) as Category[]);
    } catch (fallbackError) {
      const supabaseError = fallbackError as { message?: string; code?: string; details?: string; hint?: string };

      if (__DEV__) {
        console.error('Erro no fallback ao carregar categorias', {
          message: supabaseError?.message,
          code: supabaseError?.code,
          details: supabaseError?.details,
          hint: supabaseError?.hint,
        });
      }

      setCategories([]);
      setCategoriesError('Não foi possível carregar as categorias agora. Tente novamente em instantes.');
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  useEffect(() => {
    setSelectedCategoryId('');
    void loadCategories(transactionType);
  }, [loadCategories, transactionType]);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId],
  );

  const handleSubmit = () => {
    if (!selectedCategoryId) {
      setFormError('Selecione uma categoria para continuar.');
      return;
    }

    setFormError(null);
    // Fluxo de envio mantido fora do escopo deste hotfix.
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Novo lançamento</Text>
      <Text style={styles.label}>Tipo</Text>
      <View style={styles.row}>
        <Pressable style={[styles.typeButton, transactionType === 'receita' && styles.typeButtonActive]} onPress={() => setTransactionType('receita')}>
          <Text>Receita</Text>
        </Pressable>
        <Pressable style={[styles.typeButton, transactionType === 'despesa' && styles.typeButtonActive]} onPress={() => setTransactionType('despesa')}>
          <Text>Despesa</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Categoria (obrigatória)</Text>
      {loadingCategories ? (
        <View style={styles.centeredContent}>
          <ActivityIndicator />
          <Text>Carregando categorias...</Text>
        </View>
      ) : categoriesError ? (
        <Text style={styles.errorText}>{categoriesError}</Text>
      ) : categories.length === 0 ? (
        <Text style={styles.feedbackText}>Nenhuma categoria disponível.</Text>
      ) : (
        <View style={styles.categoryList}>
          {categories.map((category) => (
            <Pressable
              key={category.id}
              style={[styles.categoryButton, selectedCategoryId === category.id && styles.categoryButtonActive]}
              onPress={() => setSelectedCategoryId(category.id)}
            >
              <Text>{category.name}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <Text style={styles.label}>Descrição</Text>
      <TextInput value={description} onChangeText={setDescription} style={styles.input} placeholder="Descreva o lançamento" />

      <Text style={styles.label}>Valor</Text>
      <TextInput value={amount} onChangeText={setAmount} style={styles.input} keyboardType="numeric" placeholder="0,00" />

      {selectedCategory ? <Text style={styles.feedbackText}>Categoria selecionada: {selectedCategory.name}</Text> : null}
      {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

      <Pressable style={styles.submitButton} onPress={handleSubmit}>
        <Text style={styles.submitButtonText}>Salvar lançamento</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff', gap: 8 },
  title: { fontSize: 24, fontWeight: '700' },
  label: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  row: { flexDirection: 'row', gap: 8 },
  typeButton: { borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 8 },
  typeButtonActive: { borderColor: '#111', backgroundColor: '#f1f1f1' },
  centeredContent: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 },
  categoryList: { gap: 6 },
  categoryButton: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 },
  categoryButtonActive: { borderColor: '#111' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 },
  feedbackText: { color: '#444' },
  errorText: { color: '#b00020' },
  submitButton: { marginTop: 10, backgroundColor: '#111', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  submitButtonText: { color: '#fff', fontWeight: '600' },
});
