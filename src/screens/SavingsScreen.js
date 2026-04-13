import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
} from "react-native";
import { PieChart } from "react-native-chart-kit";
import { supabase } from "../services/supabase";

const PIE_COLORS = ["#007AFF", "#34C759", "#FF9500", "#AF52DE", "#FF2D55", "#5AC8FA"];

function getTodayString() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const [yyyy, mm, dd] = dateStr.split("-");
  return `${dd}/${mm}/${yyyy}`;
}

export default function SavingsScreen() {
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [totalSavings, setTotalSavings] = useState(0);
  const [loading, setLoading] = useState(true);

  // Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [txType, setTxType] = useState("depot");
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(getTodayString());

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([fetchAccounts(), fetchTransactions()]);
    setLoading(false);
  };

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("type", "epargne");
      if (error) throw error;
      const list = data || [];
      setAccounts(list);
      setTotalSavings(list.reduce((sum, acc) => sum + Number(acc.balance), 0));
    } catch (error) {
      console.error("Erreur comptes épargne:", error.message);
    }
  };

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from("savings_transactions")
        .select("*, accounts(name)")
        .order("date", { ascending: false })
        .limit(20);
      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error("Erreur savings_transactions:", error.message);
    }
  };

  const openModal = () => {
    setTxType("depot");
    setSelectedAccountId(accounts.length > 0 ? accounts[0].id : null);
    setAmount("");
    setDescription("");
    setDate(getTodayString());
    setModalVisible(true);
  };

  const closeModal = () => setModalVisible(false);

  const handleSave = async () => {
    const parsedAmount = parseFloat(amount.replace(",", "."));
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert("Erreur", "Saisis un montant valide.");
      return;
    }
    if (!selectedAccountId) {
      Alert.alert("Erreur", "Sélectionne un compte.");
      return;
    }
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert("Erreur", "La date doit être au format AAAA-MM-JJ.");
      return;
    }

    const account = accounts.find((a) => a.id === selectedAccountId);
    if (!account) return;

    if (txType === "retrait" && parsedAmount > Number(account.balance)) {
      Alert.alert("Erreur", `Solde insuffisant sur ${account.name}.`);
      return;
    }

    try {
      setSaving(true);

      const { error: insertError } = await supabase
        .from("savings_transactions")
        .insert({
          account_id: selectedAccountId,
          type: txType,
          amount: parsedAmount,
          description: description.trim() || null,
          date: date,
        });
      if (insertError) throw insertError;

      const newBalance =
        txType === "depot"
          ? Number(account.balance) + parsedAmount
          : Number(account.balance) - parsedAmount;

      const { error: updateError } = await supabase
        .from("accounts")
        .update({ balance: newBalance })
        .eq("id", selectedAccountId);
      if (updateError) throw updateError;

      await loadAll();
      closeModal();
    } catch (error) {
      console.error("Erreur sauvegarde:", error.message);
      Alert.alert("Erreur", "Impossible d'enregistrer.");
    } finally {
      setSaving(false);
    }
  };

  const handleLongPress = (tx) => {
    const label = tx.type === "depot" ? "dépôt" : "retrait";
    Alert.alert(
      tx.accounts?.name || "Transaction",
      `${Number(tx.amount).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} € — ${formatDate(tx.date)}`,
      [
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () =>
            Alert.alert(`Supprimer ce ${label} ?`, "Le solde sera remis à jour.", [
              { text: "Annuler", style: "cancel" },
              { text: "Supprimer", style: "destructive", onPress: () => handleDelete(tx) },
            ]),
        },
        { text: "Annuler", style: "cancel" },
      ]
    );
  };

  const handleDelete = async (tx) => {
    const account = accounts.find((a) => a.id === tx.account_id);
    if (!account) return;
    try {
      const { error: deleteError } = await supabase
        .from("savings_transactions")
        .delete()
        .eq("id", tx.id);
      if (deleteError) throw deleteError;

      const newBalance =
        tx.type === "depot"
          ? Number(account.balance) - Number(tx.amount)
          : Number(account.balance) + Number(tx.amount);

      const { error: updateError } = await supabase
        .from("accounts")
        .update({ balance: newBalance })
        .eq("id", account.id);
      if (updateError) throw updateError;

      await loadAll();
    } catch (error) {
      console.error("Erreur suppression:", error.message);
      Alert.alert("Erreur", "Impossible de supprimer.");
    }
  };

  const chartData = accounts
    .filter((acc) => Number(acc.balance) > 0)
    .map((acc, index) => ({
      name: acc.name,
      population: Number(acc.balance),
      color: PIE_COLORS[index % PIE_COLORS.length],
      legendFontColor: "#7F7F7F",
      legendFontSize: 12,
    }));

  const screenWidth = Dimensions.get("window").width;

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header total */}
          <View style={styles.header}>
            <Text style={styles.headerLabel}>Total Épargne</Text>
            <Text style={styles.headerAmount}>
              {totalSavings.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
            </Text>
          </View>

          {/* PieChart */}
          {chartData.length > 0 && (
            <PieChart
              data={chartData}
              width={screenWidth}
              height={200}
              chartConfig={{ color: (opacity = 1) => `rgba(0,0,0,${opacity})` }}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="15"
            />
          )}

          {/* Comptes */}
          <Text style={styles.sectionTitle}>Mes comptes</Text>
          <View style={styles.accountsList}>
            {accounts.map((acc, index) => (
              <View
                key={acc.id}
                style={[styles.accountRow, index === accounts.length - 1 && styles.rowLast]}
              >
                <View style={[styles.dot, { backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }]} />
                <Text style={styles.accountName}>{acc.name}</Text>
                <Text style={styles.accountBalance}>
                  {Number(acc.balance).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                </Text>
              </View>
            ))}
          </View>

          {/* Mouvements récents */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Mouvements récents</Text>
            <Text style={styles.sectionSubtitle}>
              {transactions.length} opération{transactions.length !== 1 ? "s" : ""}
            </Text>
          </View>

          {transactions.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>Aucun mouvement enregistré.</Text>
              <Text style={styles.emptyHint}>Appuie sur + pour ajouter un dépôt ou retrait.</Text>
            </View>
          ) : (
            <View style={styles.txList}>
              {transactions.map((tx, index) => {
                const isDepot = tx.type === "depot";
                return (
                  <TouchableOpacity
                    key={tx.id}
                    style={[styles.txRow, index === transactions.length - 1 && styles.rowLast]}
                    onLongPress={() => handleLongPress(tx)}
                    delayLongPress={400}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.txIcon, isDepot ? styles.txIconDepot : styles.txIconRetrait]}>
                      <Text style={styles.txIconText}>{isDepot ? "⬆️" : "⬇️"}</Text>
                    </View>
                    <View style={styles.txInfo}>
                      <Text style={styles.txAccountName}>{tx.accounts?.name || "Épargne"}</Text>
                      <Text style={styles.txDescription}>
                        {tx.description || formatDate(tx.date)}
                      </Text>
                      {tx.description ? (
                        <Text style={styles.txDate}>{formatDate(tx.date)}</Text>
                      ) : null}
                    </View>
                    <Text style={[styles.txAmount, isDepot ? styles.txAmountDepot : styles.txAmountRetrait]}>
                      {isDepot ? "+" : "-"}
                      {Number(tx.amount).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* FAB "+" */}
      <TouchableOpacity style={styles.fab} onPress={openModal}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Mouvement épargne</Text>
              <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Toggle Dépôt / Retrait */}
              <View style={styles.typeToggle}>
                <TouchableOpacity
                  style={[styles.typeButton, txType === "depot" && styles.typeButtonDepotActive]}
                  onPress={() => setTxType("depot")}
                >
                  <Text style={[styles.typeButtonText, txType === "depot" && styles.typeButtonTextActive]}>
                    ⬆️ Dépôt
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeButton, txType === "retrait" && styles.typeButtonRetraitActive]}
                  onPress={() => setTxType("retrait")}
                >
                  <Text style={[styles.typeButtonText, txType === "retrait" && styles.typeButtonTextActive]}>
                    ⬇️ Retrait
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Sélecteur de compte (si plusieurs) */}
              {accounts.length > 1 && (
                <>
                  <Text style={styles.fieldLabel}>Compte *</Text>
                  <View style={styles.accountPicker}>
                    {accounts.map((acc, index) => (
                      <TouchableOpacity
                        key={acc.id}
                        style={[
                          styles.accountChip,
                          selectedAccountId === acc.id && {
                            backgroundColor: PIE_COLORS[index % PIE_COLORS.length],
                            borderColor: PIE_COLORS[index % PIE_COLORS.length],
                          },
                        ]}
                        onPress={() => setSelectedAccountId(acc.id)}
                      >
                        <Text style={[
                          styles.accountChipText,
                          selectedAccountId === acc.id && styles.accountChipTextSelected,
                        ]}>
                          {acc.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <Text style={styles.fieldLabel}>Montant (€) *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: 300"
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
                autoFocus
              />

              <Text style={styles.fieldLabel}>Description (optionnel)</Text>
              <TextInput
                style={styles.input}
                placeholder={txType === "depot" ? "Ex: Virement mensuel" : "Ex: Achat voiture"}
                value={description}
                onChangeText={setDescription}
                maxLength={100}
              />

              <Text style={styles.fieldLabel}>Date *</Text>
              <TextInput
                style={styles.input}
                placeholder="AAAA-MM-JJ"
                value={date}
                onChangeText={setDate}
                keyboardType="numbers-and-punctuation"
              />

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  txType === "retrait" && styles.saveButtonRetrait,
                  saving && styles.saveButtonDisabled,
                ]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {txType === "depot" ? "Enregistrer le dépôt" : "Enregistrer le retrait"}
                  </Text>
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
  container: { flex: 1, backgroundColor: "#F2F2F7" },
  loader: { flex: 1, justifyContent: "center" },
  scrollContent: { paddingBottom: 100 },
  header: {
    backgroundColor: "#fff",
    padding: 24,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  headerLabel: { fontSize: 14, color: "#8E8E93", marginBottom: 4 },
  headerAmount: { fontSize: 36, fontWeight: "bold", color: "#1C1C1E" },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1C1C1E",
    paddingHorizontal: 15,
    marginTop: 24,
    marginBottom: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingHorizontal: 15,
    marginTop: 24,
    marginBottom: 10,
  },
  sectionSubtitle: { fontSize: 13, color: "#8E8E93" },
  accountsList: {
    backgroundColor: "#fff",
    marginHorizontal: 15,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  rowLast: { borderBottomWidth: 0 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  accountName: { flex: 1, fontSize: 15, fontWeight: "500", color: "#1C1C1E" },
  accountBalance: { fontSize: 15, fontWeight: "700", color: "#007AFF" },
  txList: {
    backgroundColor: "#fff",
    marginHorizontal: 15,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  txIconDepot: { backgroundColor: "#F0FFF4" },
  txIconRetrait: { backgroundColor: "#FFF0F0" },
  txIconText: { fontSize: 18 },
  txInfo: { flex: 1 },
  txAccountName: { fontSize: 15, fontWeight: "600", color: "#1C1C1E" },
  txDescription: { fontSize: 13, color: "#8E8E93", marginTop: 2 },
  txDate: { fontSize: 12, color: "#C7C7CC", marginTop: 1 },
  txAmount: { fontSize: 16, fontWeight: "700" },
  txAmountDepot: { color: "#34C759" },
  txAmountRetrait: { color: "#FF3B30" },
  emptyBox: { alignItems: "center", paddingVertical: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 16, color: "#3A3A3C", fontWeight: "500" },
  emptyHint: { fontSize: 13, color: "#8E8E93", marginTop: 6 },
  fab: {
    position: "absolute",
    bottom: 30,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#34C759",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#34C759",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  fabText: { color: "#fff", fontSize: 32, lineHeight: 36, fontWeight: "300" },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  modalContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#1C1C1E" },
  closeButton: { padding: 4 },
  closeButtonText: { fontSize: 18, color: "#8E8E93" },
  typeToggle: {
    flexDirection: "row",
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    padding: 4,
    marginBottom: 4,
  },
  typeButton: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  typeButtonDepotActive: { backgroundColor: "#34C759" },
  typeButtonRetraitActive: { backgroundColor: "#FF3B30" },
  typeButtonText: { fontSize: 14, fontWeight: "600", color: "#8E8E93" },
  typeButtonTextActive: { color: "#fff" },
  fieldLabel: { fontSize: 14, fontWeight: "600", color: "#3A3A3C", marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: "#F2F2F7", borderRadius: 10, padding: 14, fontSize: 16, color: "#1C1C1E" },
  accountPicker: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  accountChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F2F2F7",
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  accountChipText: { fontSize: 13, color: "#3A3A3C" },
  accountChipTextSelected: { color: "#fff", fontWeight: "600" },
  saveButton: {
    backgroundColor: "#34C759",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 28,
    marginBottom: 10,
  },
  saveButtonRetrait: { backgroundColor: "#FF3B30" },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
