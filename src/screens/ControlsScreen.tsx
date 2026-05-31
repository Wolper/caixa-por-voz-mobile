import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PostgrestError } from '@supabase/supabase-js';

import { PilotBadge } from '../components/PilotBadge';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Control } from '../types/control';

const SELECTED_CONTROL_STORAGE_KEY = 'selected_control_id';
const CONTROL_SELECT_FIELDS = 'id, name, cnpj, profile_type';
const COMPANY_OWNER_FIELD_CANDIDATES = ['user_id', 'owner_id', 'created_by', 'profile_id'] as const;
const RLS_CREATE_CONTROL_MESSAGE =
  'Não foi possível criar o controle porque seu usuário ainda não tem permissão no ambiente de teste. Avise o responsável pelo piloto.';
const UNAUTHENTICATED_CREATE_CONTROL_MESSAGE = 'Entre novamente para criar um controle.';
const PERSONAL_CONTROL_LIMIT_MESSAGE =
  'Você já possui um controle pessoal. Use o controle existente para registrar suas finanças pessoais.';
const COMPANY_CONTROL_LIMIT_MESSAGE =
  'No MVP piloto, você pode testar uma empresa por vez. Multiempresa estará disponível em plano pago.';

type CompanyOwnerField = (typeof COMPANY_OWNER_FIELD_CANDIDATES)[number];
type CompanyInsertPayload = {
  name: string;
  profile_type: Control['profile_type'];
  cnpj: null;
} & Partial<Record<CompanyOwnerField, string>>;

const profileTypeLabel: Record<Control['profile_type'], string> = {
  pessoal: 'Controle pessoal',
  empresa: 'Controle empresarial',
};

const defaultControlName: Record<Control['profile_type'], string> = {
  pessoal: 'Controle pessoal',
  empresa: 'Controle da empresa',
};

type Props = {
  onOpenDashboard: (params: { controlId: string; controlName: string }) => void;
  onOpenAccounts: (params: { controlId: string; controlName: string }) => void;
};

function warnExpectedControlsError(error: unknown) {
  if (__DEV__) {
    console.warn('Erro esperado em controles no MVP piloto', error);
  }
}

function isSupabaseError(error: unknown): error is PostgrestError {
  return typeof error === 'object' && error !== null && 'code' in error && 'message' in error;
}

function isColumnMissingError(error: unknown) {
  if (!isSupabaseError(error)) return false;

  return error.code === 'PGRST204' || error.message.toLowerCase().includes('could not find');
}

function isRlsViolationError(error: unknown) {
  if (!isSupabaseError(error)) return false;

  return error.code === '42501' || error.message.toLowerCase().includes('row-level security');
}

async function getAuthenticatedUserId() {
  const { data, error } = await supabase.auth.getSession();

  if (error) throw error;

  return data.session?.user.id ?? null;
}

async function findCompanyOwnerField() {
  for (const ownerField of COMPANY_OWNER_FIELD_CANDIDATES) {
    const { error } = await supabase.from('companies').select(ownerField).limit(1);

    if (!error) {
      return ownerField;
    }

    if (isColumnMissingError(error)) {
      continue;
    }

    warnExpectedControlsError(error);
    return null;
  }

  return null;
}

export function ControlsScreen({ onOpenDashboard, onOpenAccounts }: Props) {
  const { signOut } = useAuth();
  const [controls, setControls] = useState<Control[]>([]);
  const [selectedControlId, setSelectedControlId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [newControlName, setNewControlName] = useState(defaultControlName.pessoal);
  const [newControlType, setNewControlType] = useState<Control['profile_type']>('pessoal');
  const [creatingControl, setCreatingControl] = useState(false);
  const [createControlMessage, setCreateControlMessage] = useState<string | null>(null);
  const creatingControlRef = useRef(false);

  const loadControls = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase.from('companies').select(CONTROL_SELECT_FIELDS).order('name', { ascending: true });

      if (error) throw error;

      const fetchedControls = (data ?? []) as Control[];
      setControls(fetchedControls);

      const storedControlId = await AsyncStorage.getItem(SELECTED_CONTROL_STORAGE_KEY);
      const selectedExists = storedControlId ? fetchedControls.some((control) => control.id === storedControlId) : false;

      if (selectedExists) {
        setSelectedControlId(storedControlId);
        return;
      }

      if (fetchedControls.length > 0) {
        const fallbackControlId = fetchedControls[0].id;
        setSelectedControlId(fallbackControlId);
        await AsyncStorage.setItem(SELECTED_CONTROL_STORAGE_KEY, fallbackControlId);
      } else {
        setSelectedControlId(null);
        await AsyncStorage.removeItem(SELECTED_CONTROL_STORAGE_KEY);
      }
    } catch (error) {
      warnExpectedControlsError(error);
      setErrorMessage('Não foi possível carregar seus controles agora. Tente novamente em instantes.');
      setControls([]);
      setSelectedControlId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadControls();
  }, [loadControls]);

  const selectedControl = useMemo(() => controls.find((control) => control.id === selectedControlId), [controls, selectedControlId]);
  const hasPersonalControl = useMemo(() => controls.some((control) => control.profile_type === 'pessoal'), [controls]);
  const hasCompanyControl = useMemo(() => controls.some((control) => control.profile_type === 'empresa'), [controls]);
  const selectedTypeLimitReached = newControlType === 'pessoal' ? hasPersonalControl : hasCompanyControl;
  let selectedTypeLimitMessage: string | null = null;

  if (selectedTypeLimitReached) {
    selectedTypeLimitMessage = newControlType === 'pessoal' ? PERSONAL_CONTROL_LIMIT_MESSAGE : COMPANY_CONTROL_LIMIT_MESSAGE;
  }

  const createButtonDisabled = creatingControl || selectedTypeLimitReached;
  let createControlButtonLabel = controls.length === 0 ? 'Criar primeiro controle' : 'Criar controle';

  if (selectedTypeLimitReached) {
    createControlButtonLabel = newControlType === 'pessoal' ? 'Controle pessoal já criado' : 'Empresa piloto já criada';
  }

  if (creatingControl) {
    createControlButtonLabel = 'Criando...';
  }

  const currentControlName = selectedControl?.name ?? 'Nenhum controle selecionado';

  const handleOpenDashboard = () => {
    if (!selectedControl) return;
    onOpenDashboard({ controlId: selectedControl.id, controlName: selectedControl.name });
  };

  const handleSelectAndOpenDashboard = async (control: Control) => {
    setSelectedControlId(control.id);
    await AsyncStorage.setItem(SELECTED_CONTROL_STORAGE_KEY, control.id);
    onOpenDashboard({ controlId: control.id, controlName: control.name });
  };

  const handleControlTypeChange = (profileType: Control['profile_type']) => {
    const typeLimitReached = profileType === 'pessoal' ? hasPersonalControl : hasCompanyControl;

    if (typeLimitReached) {
      setCreateControlMessage(profileType === 'pessoal' ? PERSONAL_CONTROL_LIMIT_MESSAGE : COMPANY_CONTROL_LIMIT_MESSAGE);
      return;
    }

    setCreateControlMessage(null);
    setNewControlType(profileType);
    if (!newControlName.trim() || newControlName === defaultControlName.pessoal || newControlName === defaultControlName.empresa) {
      setNewControlName(defaultControlName[profileType]);
    }
  };

  const handleCreateControl = async () => {
    if (creatingControlRef.current) {
      return;
    }

    const typeLimitReached = newControlType === 'pessoal' ? hasPersonalControl : hasCompanyControl;

    if (typeLimitReached) {
      setCreateControlMessage(newControlType === 'pessoal' ? PERSONAL_CONTROL_LIMIT_MESSAGE : COMPANY_CONTROL_LIMIT_MESSAGE);
      return;
    }

    const trimmedName = newControlName.trim();

    if (!trimmedName) {
      setCreateControlMessage('Informe um nome para o controle.');
      return;
    }

    creatingControlRef.current = true;
    setCreatingControl(true);
    setCreateControlMessage(null);

    try {
      const userId = await getAuthenticatedUserId();

      if (!userId) {
        setCreateControlMessage(UNAUTHENTICATED_CREATE_CONTROL_MESSAGE);
        return;
      }

      const ownerField = await findCompanyOwnerField();
      const insertPayload: CompanyInsertPayload = { name: trimmedName, profile_type: newControlType, cnpj: null };

      if (ownerField) {
        insertPayload[ownerField] = userId;
      }

      const { data, error } = await supabase
        .from('companies')
        .insert(insertPayload)
        .select(CONTROL_SELECT_FIELDS)
        .single();

      if (error) throw error;

      const createdControl = data as Control;
      setControls((currentControls) => [...currentControls, createdControl].sort((first, second) => first.name.localeCompare(second.name)));
      setSelectedControlId(createdControl.id);
      await AsyncStorage.setItem(SELECTED_CONTROL_STORAGE_KEY, createdControl.id);
      onOpenDashboard({ controlId: createdControl.id, controlName: createdControl.name });
    } catch (error) {
      if (isRlsViolationError(error)) {
        warnExpectedControlsError(error);
        setCreateControlMessage(RLS_CREATE_CONTROL_MESSAGE);
      } else {
        console.error('Erro inesperado ao criar controle', error);
        setCreateControlMessage('Não foi possível criar o controle agora. Tente novamente.');
      }
    } finally {
      creatingControlRef.current = false;
      setCreatingControl(false);
    }
  };

  const handleOpenAccounts = () => {
    if (!selectedControl) return;
    onOpenAccounts({ controlId: selectedControl.id, controlName: selectedControl.name });
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
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <PilotBadge />
          <Text style={styles.title}>Meus controles</Text>
          <Text style={styles.subtitle}>
            No MVP piloto, você pode usar um controle pessoal e uma empresa piloto. Multiempresa será parte de um plano pago futuramente.
          </Text>
          <Text style={styles.currentControl}>Controle atual: {currentControlName}</Text>
        </View>

        {loading ? (
          <View style={styles.centeredContent}>
            <ActivityIndicator size="large" />
            <Text style={styles.feedbackText}>Carregando controles...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.centeredContent}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <Pressable style={styles.secondaryButton} onPress={loadControls}>
              <Text style={styles.secondaryButtonText}>Tentar novamente</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {controls.length === 0 ? (
              <View style={styles.emptyStateCard}>
                <Text style={styles.emptyStateTitle}>Você ainda não possui controles. Crie seu primeiro controle para começar.</Text>
              </View>
            ) : (
              <>
                <Text style={styles.sectionTitle}>Selecionar controle</Text>
                {controls.map((control) => {
                  const isSelected = control.id === selectedControlId;

                  return (
                    <Pressable
                      key={control.id}
                      style={[styles.controlCard, isSelected ? styles.controlCardSelected : undefined]}
                      onPress={() => handleSelectAndOpenDashboard(control)}
                    >
                      <Text style={styles.controlName}>{control.name}</Text>
                      <Text style={styles.controlType}>{profileTypeLabel[control.profile_type]}</Text>
                      {control.cnpj ? <Text style={styles.controlCnpj}>CNPJ: {control.cnpj}</Text> : null}
                    </Pressable>
                  );
                })}

                <Pressable
                  style={[styles.openButton, !selectedControl && styles.openButtonDisabled]}
                  disabled={!selectedControl}
                  onPress={handleOpenDashboard}
                >
                  <Text style={styles.openButtonText}>Abrir Início</Text>
                </Pressable>

                <Pressable
                  style={[styles.accountsButton, !selectedControl && styles.openButtonDisabled]}
                  disabled={!selectedControl}
                  onPress={handleOpenAccounts}
                >
                  <Text style={styles.accountsButtonText}>Ver contas</Text>
                </Pressable>
              </>
            )}

            <View style={styles.createControlCard}>
              <Text style={styles.sectionTitle}>{controls.length === 0 ? 'Criar primeiro controle' : 'Criar novo controle'}</Text>
              <Text style={styles.createControlDescription}>
                O piloto permite um controle pessoal e uma empresa piloto por usuário. Quando multiempresa estiver disponível, ela fará
                parte de um plano pago.
              </Text>
              <TextInput
                style={[styles.input, selectedTypeLimitReached ? styles.inputDisabled : undefined]}
                placeholder="Nome do controle"
                value={newControlName}
                onChangeText={setNewControlName}
                editable={!selectedTypeLimitReached && !creatingControl}
              />
              <View style={styles.typeSelector}>
                <Pressable
                  style={[
                    styles.typeOption,
                    newControlType === 'pessoal' ? styles.typeOptionSelected : undefined,
                    hasPersonalControl ? styles.typeOptionDisabled : undefined,
                  ]}
                  disabled={hasPersonalControl || creatingControl}
                  onPress={() => handleControlTypeChange('pessoal')}
                >
                  <Text
                    style={[
                      styles.typeOptionText,
                      newControlType === 'pessoal' ? styles.typeOptionTextSelected : undefined,
                      hasPersonalControl ? styles.typeOptionTextDisabled : undefined,
                    ]}
                  >
                    {hasPersonalControl ? 'Controle pessoal já criado' : 'Pessoal'}
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.typeOption,
                    newControlType === 'empresa' ? styles.typeOptionSelected : undefined,
                    hasCompanyControl ? styles.typeOptionDisabled : undefined,
                  ]}
                  disabled={hasCompanyControl || creatingControl}
                  onPress={() => handleControlTypeChange('empresa')}
                >
                  <Text
                    style={[
                      styles.typeOptionText,
                      newControlType === 'empresa' ? styles.typeOptionTextSelected : undefined,
                      hasCompanyControl ? styles.typeOptionTextDisabled : undefined,
                    ]}
                  >
                    {hasCompanyControl ? 'Empresa piloto já criada' : 'Empresarial'}
                  </Text>
                </Pressable>
              </View>
              {hasPersonalControl ? <Text style={styles.limitHint}>Controle pessoal já criado</Text> : null}
              {hasCompanyControl ? <Text style={styles.limitHint}>Empresa piloto já criada</Text> : null}
              {createControlMessage || selectedTypeLimitMessage ? (
                <Text style={styles.errorText}>{createControlMessage ?? selectedTypeLimitMessage}</Text>
              ) : null}
              <Pressable
                style={[styles.openButton, createButtonDisabled && styles.openButtonDisabled]}
                disabled={createButtonDisabled}
                onPress={handleCreateControl}
              >
                <Text style={styles.openButtonText}>{createControlButtonLabel}</Text>
              </Pressable>
            </View>
          </View>
        )}

        <Pressable style={styles.logoutButton} onPress={handleSignOut} disabled={signingOut}>
          <Text style={styles.logoutButtonText}>{signingOut ? 'Saindo...' : 'Sair'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
  },
  header: {
    gap: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#555',
  },
  currentControl: {
    fontSize: 15,
    color: '#3b3b3b',
  },
  centeredContent: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  feedbackText: {
    textAlign: 'center',
    color: '#444',
    fontSize: 16,
  },
  errorText: {
    textAlign: 'center',
    color: '#b00020',
    fontSize: 16,
  },
  listContainer: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptyStateCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    padding: 16,
    gap: 8,
    backgroundColor: '#f8f8f8',
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    color: '#111',
  },
  createControlCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    padding: 14,
    gap: 10,
  },
  createControlDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#555',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputDisabled: {
    backgroundColor: '#f3f3f3',
    color: '#777',
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  typeOption: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1b64d9',
    paddingHorizontal: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeOptionSelected: {
    backgroundColor: '#1b64d9',
  },
  typeOptionDisabled: {
    borderColor: '#b7c8e8',
    backgroundColor: '#eef3fb',
  },
  typeOptionText: {
    color: '#1b64d9',
    fontWeight: '700',
    textAlign: 'center',
  },
  typeOptionTextSelected: {
    color: '#fff',
  },
  typeOptionTextDisabled: {
    color: '#64748b',
  },
  limitHint: {
    color: '#555',
    fontSize: 13,
    textAlign: 'center',
  },
  controlCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    padding: 14,
    gap: 2,
  },
  controlCardSelected: {
    borderColor: '#111',
    backgroundColor: '#f2f2f2',
  },
  controlName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
  },
  controlType: {
    fontSize: 14,
    color: '#333',
  },
  controlCnpj: {
    fontSize: 13,
    color: '#555',
  },
  openButton: {
    marginTop: 8,
    backgroundColor: '#1b64d9',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  openButtonDisabled: {
    backgroundColor: '#87a9e5',
  },
  openButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  accountsButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1b64d9',
    paddingVertical: 12,
    alignItems: 'center',
  },
  accountsButtonText: {
    color: '#1b64d9',
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: '#111',
    fontWeight: '600',
  },
  logoutButton: {
    marginTop: 20,
    backgroundColor: '#111',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
