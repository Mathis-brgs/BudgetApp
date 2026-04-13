import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { supabase } from '../services/supabase';

const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
const PROJECTION_MONTHS = 18;

function getMonthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function parseMonthKey(dateStr) {
  const parts = dateStr.split('-');
  return { year: parseInt(parts[0]), month: parseInt(parts[1]) - 1 };
}

function formatMonthLabel(year, month) {
  return `${MONTHS_FR[month]} ${String(year).slice(2)}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [yyyy, mm, dd] = dateStr.split('-');
  return `${dd}/${mm}/${yyyy}`;
}

function getTodayString() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

export default function ProjectionScreen() {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState(null);
  const [upcomingExpenses, setUpcomingExpenses] = useState([]);
  const [finalBalance, setFinalBalance] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  // Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expenseName, setExpenseName] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState('');

  useEffect(() => {
    calculateProjections();
  }, []);

  const calculateProjections = async () => {
    try {
      setLoading(true);
      setErrorMsg('');

      const { data: accounts, error: accError } = await supabase
        .from('accounts')
        .select('balance')
        .eq('type', 'epargne');
      if (accError) throw accError;

      const initialBalance = accounts?.reduce(
        (sum, acc) => sum + Number(acc.balance), 0
      ) || 0;

      const { data: rules, error: rulesError } = await supabase
        .from('savings_rules')
        .select('*');
      if (rulesError) throw rulesError;

      const today = new Date();
      const { data: expenses, error: expError } = await supabase
        .from('planned_expenses')
        .select('*')
        .gte('payment_date', today.toISOString().split('T')[0])
        .order('payment_date', { ascending: true });
      if (expError) throw expError;

      const labels = [];
      const dataPoints = [];
      let runningBalance = initialBalance;

      const startYear = today.getFullYear();
      const startMonth = today.getMonth();

      for (let i = 0; i <= PROJECTION_MONTHS; i++) {
        const totalMonths = startMonth + i;
        const year = startYear + Math.floor(totalMonths / 12);
        const month = totalMonths % 12;
        const monthKey = getMonthKey(year, month);

        if (i === 0) {
          labels.push("Auj.");
          dataPoints.push(Math.round(runningBalance));
          continue;
        }

        if (rules) {
          for (const rule of rules) {
            const start = parseMonthKey(rule.start_date);
            const end = parseMonthKey(rule.end_date);
            const startKey = getMonthKey(start.year, start.month);
            const endKey = getMonthKey(end.year, end.month);
            if (monthKey >= startKey && monthKey <= endKey) {
              runningBalance += Number(rule.monthly_amount);
            }
          }
        }

        if (expenses) {
          for (const expense of expenses) {
            const exp = parseMonthKey(expense.payment_date);
            const expKey = getMonthKey(exp.year, exp.month);
            if (expKey === monthKey) {
              runningBalance -= Number(expense.amount);
            }
          }
        }

        labels.push(i % 3 === 0 ? formatMonthLabel(year, month) : '');
        dataPoints.push(Math.round(runningBalance));
      }

      setUpcomingExpenses(expenses || []);
      setFinalBalance(runningBalance);
      setChartData({ labels, datasets: [{ data: dataPoints }] });
    } catch (error) {
      console.error('Erreur projection:', error.message);
      setErrorMsg('Impossible de calculer les projections.');
    } finally {
      setLoading(false);
    }
  };

  const openModal = () => {
    setExpenseName('');
    setExpenseAmount('');
    setExpenseDate('');
    setModalVisible(true);
  };

  const closeModal = () => setModalVisible(false);

  const handleSave = async () => {
    const parsedAmount = parseFloat(expenseAmount.replace(',', '.'));
    if (!expenseName.trim()) {
      Alert.alert('Erreur', 'Saisis un nom pour cette dépense.');
      return;
    }
    if (!expenseAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Erreur', 'Saisis un montant valide (ex: 850).');
      return;
    }
    if (!expenseDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert('Erreur', 'La date doit être au format AAAA-MM-JJ.');
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase
        .from('planned_expenses')
        .insert({
          name: expenseName.trim(),
          amount: parsedAmount,
          payment_date: expenseDate,
        });
      if (error) throw error;

      closeModal();
      await calculateProjections();
    } catch (error) {
      console.error('Erreur ajout dépense prévue:', error.message);
      Alert.alert('Erreur', "Impossible d'ajouter la dépense prévue.");
    } finally {
      setSaving(false);
    }
  };

  const handleLongPress = (expense) => {
    Alert.alert(
      expense.name,
      `${Number(expense.amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € — ${formatDate(expense.payment_date)}`,
      [
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => confirmDelete(expense),
        },
        { text: 'Annuler', style: 'cancel' },
      ]
    );
  };

  const confirmDelete = (expense) => {
    Alert.alert(
      'Supprimer cette dépense prévue ?',
      'La courbe sera recalculée.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => handleDelete(expense),
        },
      ]
    );
  };

  const handleDelete = async (expense) => {
    try {
      const { error } = await supabase
        .from('planned_expenses')
        .delete()
        .eq('id', expense.id);
      if (error) throw error;
      await calculateProjections();
    } catch (error) {
      console.error('Erreur suppression:', error.message);
      Alert.alert('Erreur', 'Impossible de supprimer.');
    }
  };

  const screenWidth = Dimensions.get('window').width;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Projection patrimoniale</Text>
        <Text style={styles.subtitle}>{PROJECTION_MONTHS} mois à venir</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
        ) : errorMsg ? (
          <Text style={styles.errorText}>{errorMsg}</Text>
        ) : chartData ? (
          <>
            <View style={styles.chartWrapper}>
              <LineChart
                data={chartData}
                width={screenWidth - 30}
                height={230}
                yAxisSuffix=" €"
                chartConfig={{
                  backgroundColor: '#ffffff',
                  backgroundGradientFrom: '#ffffff',
                  backgroundGradientTo: '#f0f6ff',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(100, 100, 100, ${opacity})`,
                  style: { borderRadius: 16 },
                  propsForDots: { r: '3', strokeWidth: '2', stroke: '#007AFF' },
                  propsForBackgroundLines: { stroke: '#E5E5EA', strokeDasharray: '' },
                }}
                bezier
                style={styles.chart}
              />
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>
                Épargne projetée dans {PROJECTION_MONTHS} mois
              </Text>
              <Text
                style={[
                  styles.summaryAmount,
                  finalBalance < 0 && styles.summaryAmountNegative,
                ]}
              >
                {Math.round(finalBalance).toLocaleString('fr-FR')} €
              </Text>
            </View>

            {/* Section dépenses prévues */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Dépenses prévues</Text>
              <Text style={styles.sectionHint}>Appui long pour supprimer</Text>
            </View>

            {upcomingExpenses.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>Aucune dépense prévue.</Text>
                <Text style={styles.emptyHint}>
                  Appuie sur + pour en ajouter une.
                </Text>
              </View>
            ) : (
              <View style={styles.expensesList}>
                {upcomingExpenses.map((exp, index) => (
                  <TouchableOpacity
                    key={exp.id}
                    style={[
                      styles.expenseRow,
                      index === upcomingExpenses.length - 1 &&
                        styles.expenseRowLast,
                    ]}
                    onLongPress={() => handleLongPress(exp)}
                    delayLongPress={400}
                    activeOpacity={0.7}
                  >
                    <View style={styles.expenseIcon}>
                      <Text style={styles.expenseIconText}>📅</Text>
                    </View>
                    <View style={styles.expenseInfo}>
                      <Text style={styles.expenseName}>{exp.name}</Text>
                      <Text style={styles.expenseDate}>
                        {formatDate(exp.payment_date)}
                      </Text>
                    </View>
                    <Text style={styles.expenseAmount}>
                      -{Number(exp.amount).toLocaleString('fr-FR', {
                        minimumFractionDigits: 2,
                      })}{' '}
                      €
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        ) : null}
      </ScrollView>

      {/* FAB "+" */}
      <TouchableOpacity style={styles.fab} onPress={openModal}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Modal ajout dépense prévue */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Dépense prévue</Text>
              <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Nom *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Billets d'avion"
                value={expenseName}
                onChangeText={setExpenseName}
                autoFocus
                maxLength={60}
              />

              <Text style={styles.fieldLabel}>Montant (€) *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: 850"
                keyboardType="decimal-pad"
                value={expenseAmount}
                onChangeText={setExpenseAmount}
              />

              <Text style={styles.fieldLabel}>Date prévue *</Text>
              <TextInput
                style={styles.input}
                placeholder="AAAA-MM-JJ"
                value={expenseDate}
                onChangeText={setExpenseDate}
                keyboardType="numbers-and-punctuation"
              />
              <Text style={styles.fieldHint}>
                Ex : {getTodayString()} — la dépense sera déduite de la courbe le mois correspondant.
              </Text>

              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Ajouter</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollContent: {
    padding: 15,
    paddingBottom: 100,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 20,
  },
  loader: {
    marginTop: 60,
  },
  errorText: {
    color: '#FF3B30',
    textAlign: 'center',
    marginTop: 40,
  },
  chartWrapper: {
    alignItems: 'center',
    marginBottom: 20,
  },
  chart: {
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  summaryCard: {
    backgroundColor: '#007AFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 28,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  summaryLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 6,
  },
  summaryAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  summaryAmountNegative: {
    color: '#FFD60A',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  sectionHint: {
    fontSize: 12,
    color: '#C7C7CC',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyText: {
    fontSize: 15,
    color: '#3A3A3C',
    fontWeight: '500',
  },
  emptyHint: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 4,
  },
  expensesList: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  expenseRowLast: {
    borderBottomWidth: 0,
  },
  expenseIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  expenseIconText: {
    fontSize: 18,
  },
  expenseInfo: {
    flex: 1,
  },
  expenseName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  expenseDate: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF3B30',
  },
  // FAB
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  fabText: {
    color: '#fff',
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '300',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#8E8E93',
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3A3A3C',
    marginBottom: 8,
    marginTop: 16,
  },
  fieldHint: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 6,
  },
  input: {
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#1C1C1E',
  },
  saveButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 10,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
