import { StyleSheet, Text } from 'react-native';

export function PilotBadge() {
  return <Text style={styles.badge}>MVP teste piloto</Text>;
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d7d7d7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    color: '#555',
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: '#fafafa',
    overflow: 'hidden',
  },
});
