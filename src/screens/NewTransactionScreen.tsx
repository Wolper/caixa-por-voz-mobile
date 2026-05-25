import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';

import { supabase } from '../lib/supabase';

type NewTransactionScreenProps = {
  selectedControlId: string;
  onBack: () => void;
  onSaved: () => void;
};

export function NewTransactionScreen({ selectedControlId, onBack, onSaved }: NewTransactionScreenProps) {
  const [type, setType] = useState<'receita' | 'despesa'>('receita');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSave = async () => {
    const numericAmount = Number(amount.replace(',', '.'));

    if (!description.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      setMessage('Preencha descrição e valor válido.');
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase.from('transactions').insert({
        company_id: selectedControlId,
        type,
        description: description.trim(),
        amount: numericAmount,
      });

      if (error) throw error;

      setDescription('');
      setAmount('');
      onSaved();
    } catch {
      setMessage('Não foi possível salvar a movimentação agora.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Nova movimentação</Text>

      <View style={styles.typeRow}>
        <Pressable style={[styles.typeButton, type === 'receita' && styles.typeButtonActive]} onPress={() => setType('receita')}>
          <Text style={styles.typeButtonText}>Receita</Text>
        </Pressable>
        <Pressable style={[styles.typeButton, type === 'despesa' && styles.typeButtonActive]} onPress={() => setType('despesa')}>
          <Text style={styles.typeButtonText}>Despesa</Text>
        </Pressable>
      </View>

      <TextInput style={styles.input} placeholder="Descrição" value={description} onChangeText={setDescription} />
      <TextInput style={styles.input} placeholder="Valor" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <Pressable style={styles.primaryButton} onPress={handleSave} disabled={saving}>
        <Text style={styles.primaryButtonText}>{saving ? 'Salvando...' : 'Salvar movimentação'}</Text>
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={onBack}>
        <Text style={styles.secondaryButtonText}>Voltar para Movimentações</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: '700' },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeButton: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14 },
  typeButtonActive: { borderColor: '#111', backgroundColor: '#f0f0f0' },
  typeButtonText: { fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  message: { color: '#b00020' },
  primaryButton: { backgroundColor: '#111', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
  secondaryButton: { borderWidth: 1, borderColor: '#333', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  secondaryButtonText: { color: '#111', fontWeight: '600' },
});
