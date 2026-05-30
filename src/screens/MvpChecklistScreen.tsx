import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PilotBadge } from '../components/PilotBadge';

const checklistItems = [
  'Criar lançamento manual',
  'Registrar por texto',
  'Registrar por voz simulada',
  'Editar lançamento',
  'Excluir lançamento',
  'Filtrar movimentações',
  'Exportar CSV',
  'Criar conta pendente',
  'Marcar conta como paga/recebida',
  'Conferir Dashboard',
];

const easeOptions = ['Sim', 'Mais ou menos', 'Não'] as const;

type EaseAnswer = (typeof easeOptions)[number] | null;

type Props = {
  selectedControlName: string;
  onBackToDashboard: () => void;
};

export function MvpChecklistScreen({
  selectedControlName,
  onBackToDashboard,
}: Props) {
  const [checkedItems, setCheckedItems] = useState<boolean[]>(() =>
    checklistItems.map(() => false),
  );
  const [easeAnswer, setEaseAnswer] = useState<EaseAnswer>(null);
  const [confusingFeedback, setConfusingFeedback] = useState('');
  const [likedFeedback, setLikedFeedback] = useState('');
  const [sharing, setSharing] = useState(false);

  const completedCount = checkedItems.filter(Boolean).length;

  const feedbackText = useMemo(() => {
    const checklistLines = checklistItems.map(
      (item, index) => `${checkedItems[index] ? '☑' : '☐'} ${item}`,
    );

    return [
      'Feedback do Teste do MVP - Caixa por Voz',
      `Controle testado: ${selectedControlName}`,
      '',
      'Roteiro validado:',
      ...checklistLines,
      '',
      `Você conseguiu controlar seu caixa com facilidade? ${easeAnswer ?? 'Não respondido'}`,
      '',
      `O que ficou confuso?\n${confusingFeedback.trim() || 'Não informado'}`,
      '',
      `O que você mais gostou?\n${likedFeedback.trim() || 'Não informado'}`,
    ].join('\n');
  }, [
    checkedItems,
    confusingFeedback,
    easeAnswer,
    likedFeedback,
    selectedControlName,
  ]);

  const toggleItem = (itemIndex: number) => {
    setCheckedItems((currentItems) =>
      currentItems.map((isChecked, index) =>
        index === itemIndex ? !isChecked : isChecked,
      ),
    );
  };

  const handleShareFeedback = async () => {
    setSharing(true);

    try {
      await Share.share({
        message: feedbackText,
        title: 'Feedback do Teste do MVP',
      });
    } catch {
      Alert.alert(
        'Não foi possível compartilhar',
        'Tente novamente em instantes.',
      );
    } finally {
      setSharing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps='handled'
      >
        <View style={styles.header}>
          <PilotBadge />
          <Text style={styles.title}>Checklist do MVP</Text>
          <Text style={styles.subtitle}>
            Use este roteiro com o usuário piloto para validar o fluxo principal
            do Caixa por Voz.
          </Text>
          <Text style={styles.controlName}>
            Controle: {selectedControlName}
          </Text>
        </View>

        <View style={styles.progressBox}>
          <Text style={styles.progressText}>
            {completedCount} de {checklistItems.length} etapas marcadas
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Roteiro de teste</Text>
          {checklistItems.map((item, index) => (
            <Pressable
              key={item}
              style={styles.checkRow}
              onPress={() => toggleItem(index)}
              accessibilityRole='checkbox'
              accessibilityState={{ checked: checkedItems[index] }}
            >
              <View
                style={[
                  styles.checkbox,
                  checkedItems[index] ? styles.checkboxChecked : null,
                ]}
              >
                <Text style={styles.checkboxMark}>
                  {checkedItems[index] ? '✓' : ''}
                </Text>
              </View>
              <Text style={styles.checkText}>{item}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pergunta final</Text>
          <Text style={styles.questionText}>
            Você conseguiu controlar seu caixa com facilidade?
          </Text>
          <View style={styles.optionsRow}>
            {easeOptions.map((option) => {
              const selected = easeAnswer === option;

              return (
                <Pressable
                  key={option}
                  style={[
                    styles.optionButton,
                    selected ? styles.optionButtonSelected : null,
                  ]}
                  onPress={() => setEaseAnswer(option)}
                >
                  <Text
                    style={[
                      styles.optionButtonText,
                      selected ? styles.optionButtonTextSelected : null,
                    ]}
                  >
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>O que ficou confuso?</Text>
          <TextInput
            style={styles.textArea}
            multiline
            placeholder='Ex.: não entendi onde editar um lançamento...'
            textAlignVertical='top'
            value={confusingFeedback}
            onChangeText={setConfusingFeedback}
          />

          <Text style={styles.label}>O que você mais gostou?</Text>
          <TextInput
            style={styles.textArea}
            multiline
            placeholder='Ex.: registrar por texto foi rápido...'
            textAlignVertical='top'
            value={likedFeedback}
            onChangeText={setLikedFeedback}
          />
        </View>

        <View style={styles.actions}>
          <Pressable
            style={styles.primaryButton}
            onPress={handleShareFeedback}
            disabled={sharing}
          >
            <Text style={styles.primaryButtonText}>
              {sharing ? 'Preparando feedback...' : 'Compartilhar feedback'}
            </Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={onBackToDashboard}>
            <Text style={styles.secondaryButtonText}>Voltar para Início</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  content: { flex: 1 },
  contentContainer: { gap: 18, paddingBottom: 24 },
  header: { gap: 8 },
  title: { fontSize: 28, fontWeight: '700', color: '#111' },
  subtitle: { fontSize: 15, color: '#444', lineHeight: 21 },
  controlName: { fontSize: 14, color: '#1b64d9', fontWeight: '700' },
  progressBox: {
    borderWidth: 1,
    borderColor: '#d8e5ff',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#f7fbff',
  },
  progressText: { color: '#1b64d9', fontWeight: '700', textAlign: 'center' },
  section: { gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fff',
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#1b64d9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: '#1b64d9' },
  checkboxMark: { color: '#fff', fontWeight: '700', fontSize: 16 },
  checkText: { flex: 1, color: '#222', fontSize: 15, fontWeight: '600' },
  questionText: { color: '#333', fontSize: 16, lineHeight: 22 },
  optionsRow: { gap: 8 },
  optionButton: {
    borderWidth: 1,
    borderColor: '#1b64d9',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  optionButtonSelected: { backgroundColor: '#1b64d9' },
  optionButtonText: { color: '#1b64d9', fontWeight: '700' },
  optionButtonTextSelected: { color: '#fff' },
  label: { color: '#222', fontSize: 15, fontWeight: '700' },
  textArea: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111',
  },
  actions: { gap: 10 },
  primaryButton: {
    backgroundColor: '#111',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#111', fontWeight: '700' },
});
