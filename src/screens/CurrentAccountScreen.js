import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { supabase } from "../services/supabase";

const CATEGORIES = [
  "Alimentation",
  "Transport",
  "Logement",
  "Santé",
  "Loisirs",
  "Vêtements",
  "Abonnements",
  "Autre",
];

export default function CurrentAccountScreen() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // Champs du formulaire
  const [amount, setAmount] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(getTodayString());

  function getTodayString() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setErrorMessage("");
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("type", "courant");

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error("Erreur lors de la récupération des comptes:", error.message);
      setErrorMessage("Impossible de charger les comptes pour le moment.");
    } finally {
      setLoading(false);
    }
  };

  const openModal = () => {
    setAmount("");
    setSelectedCategory("");
    setDescription("");
    setDate(getTodayString());
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
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

      // Insérer la transaction
      const { error: insertError } = await supabase
        .from("transactions")
        .insert({
          account_id: account.id,
          amount: parsedAmount,
          category: selectedCategory,
          description: description.trim() || null,
          date: date,
        });

      if (insertError) throw insertError;

      // Mettre à jour le solde du compte 
      const newBalance = Number(account.balance) - parsedAmount;
      const { error: updateError } = await supabase
        .from("accounts")
        .update({ balance: newBalance })
        .eq("id", account.id);

      if (updateError) throw updateError;

      // Rafraîchir et fermer
      await fetchAccounts();
      closeModal();
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error.message);
      Alert.alert("Erreur", "Impossible d'enregistrer la dépense.");
    } finally {
      setSaving(false);
    }
  };

  const renderAccount = ({ item }) => (
    <View style={styles.card}>
      <View>
        <Text style={styles.accountName}>{item.name}</Text>
        <Text style={styles.accountType}>
          {(item.type || "inconnu").toUpperCase()}
        </Text>
      </View>
      <Text style={[styles.balance, item.balance < 0 && styles.balanceNegative]}>
        {Number(item.balance).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
      ) : (
        <>
          {errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : null}
          <FlatList
            data={accounts}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderAccount}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={
              <Text style={styles.emptyState}>
                Aucun compte courant pour le moment.
              </Text>
            }
          />
        </>
      )}

      {/* Bouton FAB */}
      <TouchableOpacity style={styles.fab} onPress={openModal}>
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
              <Text style={styles.modalTitle}>Nouvelle dépense</Text>
              <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Montant */}
              <Text style={styles.fieldLabel}>Montant (€) *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: 24.90"
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
                autoFocus
              />

              {/* Catégorie */}
              <Text style={styles.fieldLabel}>Catégorie *</Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryChip,
                      selectedCategory === cat && styles.categoryChipSelected,
                    ]}
                    onPress={() => setSelectedCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        selectedCategory === cat && styles.categoryChipTextSelected,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Description */}
              <Text style={styles.fieldLabel}>Description (optionnel)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Courses Monoprix"
                value={description}
                onChangeText={setDescription}
                maxLength={100}
              />

              {/* Date */}
              <Text style={styles.fieldLabel}>Date *</Text>
              <TextInput
                style={styles.input}
                placeholder="AAAA-MM-JJ"
                value={date}
                onChangeText={setDate}
                keyboardType="numbers-and-punctuation"
              />

              {/* Bouton Enregistrer */}
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Enregistrer</Text>
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
  listContainer: {
    padding: 15,
    flexGrow: 1,
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
  emptyState: {
    textAlign: "center",
    color: "#8E8E93",
    marginTop: 24,
  },
  errorText: {
    color: "#FF3B30",
    textAlign: "center",
    marginTop: 16,
    marginHorizontal: 16,
  },
  // FAB
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
  // Modal
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
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F2F2F7",
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  categoryChipSelected: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  categoryChipText: {
    fontSize: 14,
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
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
});
