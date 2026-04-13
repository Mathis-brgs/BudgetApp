import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { supabase } from "../services/supabase";

const DEPENSE_CATEGORIES = [
  "Alimentation",
  "Transport",
  "Logement",
  "Santé",
  "Loisirs",
  "Vêtements",
  "Abonnements",
  "Autre",
];

const REVENU_CATEGORIES = [
  "Salaire",
  "Freelance",
  "Remboursement",
  "Allocation",
  "Virement",
  "Autre",
];

const CATEGORY_ICONS = {
  Alimentation: "🛒",
  Transport: "🚗",
  Logement: "🏠",
  Santé: "💊",
  Loisirs: "🎬",
  Vêtements: "👕",
  Abonnements: "📱",
  Salaire: "💼",
  Freelance: "💻",
  Remboursement: "↩️",
  Allocation: "🏦",
  Virement: "💸",
  Autre: "📦",
};

function getTodayString() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const [yyyy, mm, dd] = dateStr.split("-");
  return `${dd}/${mm}/${yyyy}`;
}

export default function CurrentAccountScreen() {
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);

  const [transactionType, setTransactionType] = useState("depense");
  const [amount, setAmount] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(getTodayString());

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    setErrorMessage("");
    await Promise.all([fetchAccounts(), fetchTransactions()]);
    setLoading(false);
  };

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("type", "courant");
      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error("Erreur comptes:", error.message);
      setErrorMessage("Impossible de charger les comptes.");
    }
  };

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("date", { ascending: false })
        .limit(20);
      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error("Erreur transactions:", error.message);
    }
  };

  const openModal = (transaction = null) => {
    if (transaction) {
      setEditingTransaction(transaction);
      setTransactionType(transaction.type || "depense");
      setAmount(transaction.amount != null ? String(transaction.amount) : "");
      setSelectedCategory(transaction.category);
      setDescription(transaction.description || "");
      setDate(transaction.date);
    } else {
      setEditingTransaction(null);
      setTransactionType("depense");
      setAmount("");
      setSelectedCategory("");
      setDescription("");
      setDate(getTodayString());
    }
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingTransaction(null);
  };

  const handleTypeToggle = (type) => {
    setTransactionType(type);
    setSelectedCategory(""); 
  };

  const handleLongPress = (transaction) => {
    const label = transaction.type === "revenu" ? "revenu" : "dépense";
    Alert.alert(
      transaction.category,
      `${Number(transaction.amount).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} € — ${formatDate(transaction.date)}`,
      [
        { text: "Modifier", onPress: () => openModal(transaction) },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => confirmDelete(transaction, label),
        },
        { text: "Annuler", style: "cancel" },
      ]
    );
  };

  const confirmDelete = (transaction, label) => {
    Alert.alert(
      `Supprimer ce ${label} ?`,
      "Le solde du compte sera remis à jour.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => handleDelete(transaction),
        },
      ]
    );
  };

  const handleDelete = async (transaction) => {
    const account = accounts[0];
    try {
      const { error: deleteError } = await supabase
        .from("transactions")
        .delete()
        .eq("id", transaction.id);
      if (deleteError) throw deleteError;

      // Inverser l'effet sur le solde selon le type
      const isRevenu = transaction.type === "revenu";
      const newBalance = isRevenu
        ? Number(account.balance) - Number(transaction.amount)
        : Number(account.balance) + Number(transaction.amount);

      const { error: updateError } = await supabase
        .from("accounts")
        .update({ balance: newBalance })
        .eq("id", account.id);
      if (updateError) throw updateError;

      await Promise.all([fetchAccounts(), fetchTransactions()]);
    } catch (error) {
      console.error("Erreur suppression:", error.message);
      Alert.alert("Erreur", "Impossible de supprimer.");
    }
  };

  const handleSave = async () => {
    const parsedAmount = parseFloat(amount.replace(",", "."));
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert("Erreur", "Saisis un montant valide (ex: 12.50).");
      return;
    }
    if (!selectedCategory) {
      Alert.alert("Erreur", "Choisis une catégorie.");
      return;
    }
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert("Erreur", "La date doit être au format AAAA-MM-JJ.");
      return;
    }
    if (accounts.length === 0) {
      Alert.alert("Erreur", "Aucun compte courant trouvé.");
      return;
    }

    const account = accounts[0];

    try {
      setSaving(true);

      if (editingTransaction) {
        // MODIFICATION
        const { error: updateTxError } = await supabase
          .from("transactions")
          .update({
            type: transactionType,
            amount: parsedAmount,
            category: selectedCategory,
            description: description.trim() || null,
            date: date,
          })
          .eq("id", editingTransaction.id);
        if (updateTxError) throw updateTxError;

        // Annuler l'effet de l'ancienne transaction, appliquer la nouvelle
        const oldAmount = Number(editingTransaction.amount);
        const oldIsRevenu = editingTransaction.type === "revenu";
        const newIsRevenu = transactionType === "revenu";

        const undoOld = oldIsRevenu ? -oldAmount : +oldAmount;
        const applyNew = newIsRevenu ? +parsedAmount : -parsedAmount;
        const newBalance = Number(account.balance) + undoOld + applyNew;

        const { error: updateBalError } = await supabase
          .from("accounts")
          .update({ balance: newBalance })
          .eq("id", account.id);
        if (updateBalError) throw updateBalError;
      } else {
        // CRÉATION
        const { error: insertError } = await supabase
          .from("transactions")
          .insert({
            account_id: account.id,
            type: transactionType,
            amount: parsedAmount,
            category: selectedCategory,
            description: description.trim() || null,
            date: date,
          });
        if (insertError) throw insertError;

        const isRevenu = transactionType === "revenu";
        const newBalance = isRevenu
          ? Number(account.balance) + parsedAmount
          : Number(account.balance) - parsedAmount;

        const { error: updateError } = await supabase
          .from("accounts")
          .update({ balance: newBalance })
          .eq("id", account.id);
        if (updateError) throw updateError;
      }

      await Promise.all([fetchAccounts(), fetchTransactions()]);
      closeModal();
    } catch (error) {
      console.error("Erreur sauvegarde:", error.message);
      Alert.alert("Erreur", "Impossible d'enregistrer.");
    } finally {
      setSaving(false);
    }
  };

  const currentCategories =
    transactionType === "revenu" ? REVENU_CATEGORIES : DEPENSE_CATEGORIES;

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : null}

          {/* Cartes de compte */}
          {accounts.map((item) => (
            <View key={item.id} style={styles.card}>
              <View>
                <Text style={styles.accountName}>{item.name}</Text>
                <Text style={styles.accountType}>
                  {(item.type || "inconnu").toUpperCase()}
                </Text>
              </View>
              <Text
                style={[
                  styles.balance,
                  item.balance < 0 && styles.balanceNegative,
                ]}
              >
                {Number(item.balance).toLocaleString("fr-FR", {
                  minimumFractionDigits: 2,
                })}{" "}
                €
              </Text>
            </View>
          ))}

          {/* Section mouvements récents */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Mouvements récents</Text>
            <Text style={styles.sectionSubtitle}>
              {transactions.length} opération
              {transactions.length !== 1 ? "s" : ""}
            </Text>
          </View>

          {transactions.length === 0 ? (
            <View style={styles.emptyTransactions}>
              <Text style={styles.emptyIcon}>💸</Text>
              <Text style={styles.emptyState}>Aucun mouvement enregistré.</Text>
              <Text style={styles.emptyHint}>
                Appuie sur + pour ajouter une dépense ou un revenu.
              </Text>
            </View>
          ) : (
            <View style={styles.transactionsList}>
              {transactions.map((item, index) => {
                const isRevenu = item.type === "revenu";
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.transactionRow,
                      index === transactions.length - 1 &&
                        styles.transactionRowLast,
                    ]}
                    onLongPress={() => handleLongPress(item)}
                    delayLongPress={400}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.transactionIcon,
                        isRevenu && styles.transactionIconRevenu,
                      ]}
                    >
                      <Text style={styles.transactionIconText}>
                        {CATEGORY_ICONS[item.category] || "📦"}
                      </Text>
                    </View>
                    <View style={styles.transactionInfo}>
                      <Text style={styles.transactionCategory}>
                        {item.category}
                      </Text>
                      <Text style={styles.transactionDescription}>
                        {item.description || formatDate(item.date)}
                      </Text>
                      {item.description ? (
                        <Text style={styles.transactionDate}>
                          {formatDate(item.date)}
                        </Text>
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.transactionAmount,
                        isRevenu && styles.transactionAmountRevenu,
                      ]}
                    >
                      {isRevenu ? "+" : "-"}
                      {Number(item.amount).toLocaleString("fr-FR", {
                        minimumFractionDigits: 2,
                      })}{" "}
                      €
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* Bouton FAB "+" */}
      <TouchableOpacity style={styles.fab} onPress={() => openModal()}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Modal de saisie */}
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
              <Text style={styles.modalTitle}>
                {editingTransaction ? "Modifier" : "Nouveau mouvement"}
              </Text>
              <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Toggle Dépense / Revenu */}
              <View style={styles.typeToggle}>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    transactionType === "depense" && styles.typeButtonDepenseActive,
                  ]}
                  onPress={() => handleTypeToggle("depense")}
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      transactionType === "depense" && styles.typeButtonTextActive,
                    ]}
                  >
                    💸 Dépense
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    transactionType === "revenu" && styles.typeButtonRevenuActive,
                  ]}
                  onPress={() => handleTypeToggle("revenu")}
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      transactionType === "revenu" && styles.typeButtonTextActive,
                    ]}
                  >
                    💰 Revenu
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Montant (€) *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: 24.90"
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
                autoFocus
              />

              <Text style={styles.fieldLabel}>Catégorie *</Text>
              <View style={styles.categoryGrid}>
                {currentCategories.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryChip,
                      selectedCategory === cat && styles.categoryChipSelected,
                    ]}
                    onPress={() => setSelectedCategory(cat)}
                  >
                    <Text style={styles.categoryChipIcon}>
                      {CATEGORY_ICONS[cat]}
                    </Text>
                    <Text
                      style={[
                        styles.categoryChipText,
                        selectedCategory === cat &&
                          styles.categoryChipTextSelected,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Description (optionnel)</Text>
              <TextInput
                style={styles.input}
                placeholder={
                  transactionType === "revenu"
                    ? "Ex: Salaire mars"
                    : "Ex: Courses Monoprix"
                }
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
                  transactionType === "revenu" && styles.saveButtonRevenu,
                  saving && styles.saveButtonDisabled,
                ]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {editingTransaction ? "Mettre à jour" : "Enregistrer"}
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
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  loader: {
    flex: 1,
    justifyContent: "center",
  },
  scrollContent: {
    padding: 15,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 12,
    marginBottom: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  accountName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1C1C1E",
  },
  accountType: {
    fontSize: 12,
    color: "#8E8E93",
    marginTop: 4,
  },
  balance: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#007AFF",
  },
  balanceNegative: {
    color: "#FF3B30",
  },
  errorText: {
    color: "#FF3B30",
    textAlign: "center",
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 10,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1C1C1E",
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#8E8E93",
  },
  transactionsList: {
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  transactionRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  transactionRowLast: {
    borderBottomWidth: 0,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFF0F0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  transactionIconRevenu: {
    backgroundColor: "#F0FFF4",
  },
  transactionIconText: {
    fontSize: 18,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionCategory: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1C1C1E",
  },
  transactionDescription: {
    fontSize: 13,
    color: "#8E8E93",
    marginTop: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: "#C7C7CC",
    marginTop: 1,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FF3B30",
  },
  transactionAmountRevenu: {
    color: "#34C759",
  },
  emptyTransactions: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyState: {
    fontSize: 16,
    color: "#3A3A3C",
    fontWeight: "500",
  },
  emptyHint: {
    fontSize: 13,
    color: "#8E8E93",
    marginTop: 6,
  },
  fab: {
    position: "absolute",
    bottom: 30,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  fabText: {
    color: "#fff",
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "300",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
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
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1C1C1E",
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 18,
    color: "#8E8E93",
  },
  // Toggle dépense / revenu
  typeToggle: {
    flexDirection: "row",
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    padding: 4,
    marginBottom: 4,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  typeButtonDepenseActive: {
    backgroundColor: "#FF3B30",
  },
  typeButtonRevenuActive: {
    backgroundColor: "#34C759",
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#8E8E93",
  },
  typeButtonTextActive: {
    color: "#fff",
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3A3A3C",
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: "#F2F2F7",
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: "#1C1C1E",
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F2F2F7",
    borderWidth: 1,
    borderColor: "#E5E5EA",
    gap: 4,
  },
  categoryChipSelected: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  categoryChipIcon: {
    fontSize: 14,
  },
  categoryChipText: {
    fontSize: 13,
    color: "#3A3A3C",
  },
  categoryChipTextSelected: {
    color: "#fff",
    fontWeight: "600",
  },
  saveButton: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 28,
    marginBottom: 10,
  },
  saveButtonRevenu: {
    backgroundColor: "#34C759",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
});
