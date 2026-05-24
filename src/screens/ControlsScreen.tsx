import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Control } from '../types/control';

const SELECTED_CONTROL_STORAGE_KEY = 'selected_control_id';

const profileTypeLabel: Record<Control['profile_type'], string> = {
  pessoal: 'Controle pessoal',
  empresa: 'Controle empresarial',
};

export function ControlsScreen() {
  const { signOut } = useAuth();
  const [controls, setControls] = useState<Control[]>([]);
  const [selectedControlId, setSelectedControlId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadControls = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, cnpj, profile_type')
        .order('name', { ascending: true });

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
    } catch {
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

  const currentControlName = useMemo(() => {
    const selectedControl = controls.find((control) => control.id === selectedControlId);
    return selectedControl?.name ?? 'Nenhum controle selecionado';
  }, [controls, selectedControlId]);

  const handleSelectControl = async (controlId: string) => {
    setSelectedControlId(controlId);
    await AsyncStorage.setItem(SELECTED_CONTROL_STORAGE_KEY, controlId);
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
        <Text style={styles.title}>Meus controles</Text>
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
      ) : controls.length === 0 ? (
        <View style={styles.centeredContent}>
          <Text style={styles.feedbackText}>Você ainda não possui controles cadastrados.</Text>
        </View>
      ) : (
        <View style={styles.listContainer}>
          <Text style={styles.sectionTitle}>Selecionar controle</Text>
          {controls.map((control) => {
            const isSelected = control.id === selectedControlId;

            return (
              <Pressable
                key={control.id}
                style={[styles.controlCard, isSelected ? styles.controlCardSelected : undefined]}
                onPress={() => handleSelectControl(control.id)}
              >
                <Text style={styles.controlName}>{control.name}</Text>
                <Text style={styles.controlType}>{profileTypeLabel[control.profile_type]}</Text>
                {control.cnpj ? <Text style={styles.controlCnpj}>CNPJ: {control.cnpj}</Text> : null}
              </Pressable>
            );
          })}
        </View>
      )}

      <Pressable style={styles.logoutButton} onPress={handleSignOut} disabled={signingOut}>
        <Text style={styles.logoutButtonText}>{signingOut ? 'Saindo...' : 'Sair'}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#fff',
    justifyContent: 'space-between',
  },
  header: {
    gap: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  currentControl: {
    fontSize: 15,
    color: '#3b3b3b',
  },
  centeredContent: {
    flex: 1,
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
    flex: 1,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
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
    marginTop: 12,
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
