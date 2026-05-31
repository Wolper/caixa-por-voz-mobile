import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { PilotBadge } from '../components/PilotBadge';
import { formatCurrencyBRL, formatDateBR } from '../utils/formatters';
import { parseTextTransaction, type ParsedTextTransaction } from '../utils/textTransactionParser';

export type TextTransactionMode = 'text' | 'voice';

export type TextTransactionDraft = ParsedTextTransaction & {
  originalText: string;
  sourceMode?: TextTransactionMode;
};

type Props = {
  selectedControlName: string;
  onBack: () => void;
  onReview: (draft: TextTransactionDraft) => void;
  mode?: TextTransactionMode;
  backLabel?: string;
};

const examplePhrases = [
  'Comprei frango por 380 reais no Pix hoje',
  'Recebi 150 do João em dinheiro',
  'Conta de energia 220 vencendo dia 10',
];

const screenCopyByMode: Record<TextTransactionMode, {
  title: string;
  subtitle: string;
  reviewHint: string;
  infoTitle?: string;
  infoText?: string;
  inputLabel: string;
  ctaLabel: string;
  emptyMessage: string;
}> = {
  text: {
    title: 'Registrar por texto',
    subtitle: 'Digite uma frase livre. Neste MVP de teste, a interpretação é local e simples, sem chamada para IA externa.',
    reviewHint: 'Depois da prévia, revise valor, tipo, data e categoria antes de salvar.',
    inputLabel: 'Frase do lançamento',
    ctaLabel: 'Revisar campos interpretados',
    emptyMessage: 'Digite uma frase para eu interpretar o lançamento.',
  },
  voice: {
    title: 'Registrar por voz',
    subtitle: 'Este é um fluxo visual do MVP para validar a jornada por voz. A gravação real será integrada depois.',
    reviewHint: 'A voz real ainda será integrada depois. Por enquanto, digite a transcrição simulada e revise tudo antes de salvar.',
    infoTitle: 'Voz real ainda não está ativa',
    infoText: 'Neste MVP não gravamos áudio, não pedimos microfone e não enviamos áudio para transcrição. Use o campo abaixo para digitar ou colar a frase como se ela já tivesse sido transcrita.',
    inputLabel: 'Texto transcrito da fala',
    ctaLabel: 'Revisar texto transcrito',
    emptyMessage: 'Digite ou cole a transcrição simulada para eu interpretar o lançamento.',
  },
};

export function TextTransactionScreen({ selectedControlName, onBack, onReview, mode = 'text', backLabel = 'Voltar' }: Props) {
  const [phrase, setPhrase] = useState('');
  const [interpreting, setInterpreting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const parsed = useMemo(() => {
    if (!phrase.trim()) {
      return null;
    }

    return parseTextTransaction(phrase);
  }, [phrase]);

  function handleReview() {
    const trimmedPhrase = phrase.trim();

    if (!trimmedPhrase || !parsed) {
      setMessage(copy.emptyMessage);
      return;
    }

    setMessage(null);
    setInterpreting(true);

    setTimeout(() => {
      onReview({ ...parsed, originalText: trimmedPhrase, sourceMode: mode });
    }, 250);
  }

  const copy = screenCopyByMode[mode];
  const isVoiceMode = mode === 'voice';

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <PilotBadge />
        <Text style={styles.eyebrow}>Controle atual: {selectedControlName}</Text>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.subtitle}>{copy.subtitle}</Text>
        <Text style={styles.reviewHint}>{copy.reviewHint}</Text>
        <View style={styles.helpCard}>
          <Text style={styles.helpText}>{isVoiceMode ? 'A voz real ainda é simulada: digite a transcrição, confira a prévia e revise antes de salvar.' : 'Digite exemplos como “Recebi 150 do João” ou “Conta de energia 220 vencendo dia 10” e revise a prévia antes de salvar.'}</Text>
        </View>
      </View>

      {isVoiceMode ? (
        <View style={[styles.card, styles.voiceInfoCard]}>
          <Text style={styles.sectionTitle}>{copy.infoTitle}</Text>
          <Text style={styles.helperText}>{copy.infoText}</Text>
          <View style={styles.simulatedVoiceButton}>
            <Text style={styles.simulatedVoiceButtonText}>Simular fala</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.label}>{copy.inputLabel}</Text>
        <TextInput
          style={[styles.input, styles.multilineInput]}
          placeholder="Ex.: Comprei frango por 380 reais no Pix hoje"
          value={phrase}
          onChangeText={(value) => {
            setPhrase(value);
            setMessage(null);
          }}
          multiline
          textAlignVertical="top"
        />

        <Text style={styles.examplesTitle}>Exemplos rápidos</Text>
        {examplePhrases.map((example) => (
          <Pressable key={example} style={styles.exampleButton} onPress={() => setPhrase(example)}>
            <Text style={styles.exampleButtonText}>{example}</Text>
          </Pressable>
        ))}
      </View>

      {parsed ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Prévia interpretada</Text>
          <Text style={styles.helperText}>Confira a prévia. Nada será salvo sem você revisar, editar se necessário e confirmar no formulário.</Text>

          {parsed.confidenceMessages.length > 0 ? (
            <View style={styles.warningBox}>
              {parsed.confidenceMessages.map((warning) => (
                <Text key={warning} style={styles.warningText}>{warning}</Text>
              ))}
            </View>
          ) : null}

          <View style={styles.previewGrid}>
            <Text style={styles.previewItem}>Tipo: {parsed.type ? (parsed.type === 'receita' ? 'Receita' : 'Despesa') : 'Ajustar manualmente'}</Text>
            <Text style={styles.previewItem}>Descrição: {parsed.description || 'Ajustar manualmente'}</Text>
            <Text style={styles.previewItem}>Valor: {parsed.amount ? formatCurrencyBRL(parsed.amount) : 'Ajustar manualmente'}</Text>
            <Text style={styles.previewItem}>Data: {formatDateBR(parsed.transactionDate)}</Text>
            <Text style={styles.previewItem}>Vencimento: {parsed.dueDate ? formatDateBR(parsed.dueDate) : 'Sem vencimento'}</Text>
            <Text style={styles.previewItem}>Pagamento: {parsed.paymentMethod ?? 'Não identificado'}</Text>
            <Text style={styles.previewItem}>Status: {parsed.status === 'pendente' ? 'Pendente' : 'Pago'}</Text>
            <Text style={styles.previewItem}>Categoria sugerida: {parsed.suggestedCategoryName ?? 'Não identificada'}</Text>
          </View>
        </View>
      ) : null}

      {message ? <Text style={styles.errorText}>{message}</Text> : null}

      <Pressable style={[styles.primaryButton, interpreting ? styles.disabledButton : null]} onPress={handleReview} disabled={interpreting}>
        {interpreting ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#ffffff" />
            <Text style={styles.primaryButtonText}>Interpretando para revisão...</Text>
          </View>
        ) : (
          <Text style={styles.primaryButtonText}>{copy.ctaLabel}</Text>
        )}
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={onBack} disabled={interpreting}>
        <Text style={styles.secondaryButtonText}>{backLabel}</Text>
      </Pressable>
    </ScrollView>
  );
}

export default TextTransactionScreen;

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: '#f8fafc',
    gap: 16,
  },
  header: { gap: 8 },
  eyebrow: { fontSize: 13, fontWeight: '700', color: '#2563eb' },
  title: { fontSize: 28, fontWeight: '800', color: '#0f172a' },
  subtitle: { fontSize: 15, lineHeight: 22, color: '#475569' },
  reviewHint: { fontSize: 14, lineHeight: 20, color: '#334155', fontWeight: '700' },
  helpCard: { borderRadius: 12, backgroundColor: '#e0f2fe', padding: 12 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  voiceInfoCard: { borderColor: '#c4b5fd', backgroundColor: '#f5f3ff' },
  simulatedVoiceButton: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#6d28d9' },
  simulatedVoiceButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  label: { fontSize: 14, fontWeight: '700', color: '#334155' },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  multilineInput: { minHeight: 120 },
  examplesTitle: { marginTop: 6, fontSize: 13, fontWeight: '800', color: '#64748b' },
  exampleButton: { borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#eff6ff' },
  exampleButtonText: { color: '#1d4ed8', fontWeight: '700' },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  helperText: { fontSize: 14, lineHeight: 20, color: '#64748b' },
  warningBox: { borderRadius: 12, padding: 12, backgroundColor: '#fef3c7', gap: 6 },
  warningText: { color: '#92400e', fontSize: 14, lineHeight: 20 },
  previewGrid: { gap: 7 },
  previewItem: { fontSize: 15, lineHeight: 21, color: '#334155' },
  errorText: { textAlign: 'center', color: '#b00020', fontSize: 15 },
  primaryButton: { minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  secondaryButton: { minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#ffffff' },
  secondaryButtonText: { color: '#334155', fontSize: 15, fontWeight: '700' },
  disabledButton: { opacity: 0.7 },
});
