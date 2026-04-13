import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { supabase } from "../services/supabase";

export default function HomeScreen({ navigation }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setErrorMessage("");
      // on interroge la table "accounts"
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("type", "courant");

      if (error) {
        throw error;
      }

      setAccounts(data || []);
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des comptes:",
        error.message,
      );
      setErrorMessage("Impossible de charger les comptes pour le moment.");
    } finally {
      setLoading(false);
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
      <Text style={styles.balance}>{item.balance} €</Text>
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
  emptyState: {
    textAlign: "center",
    color: "#8E8E93",
    marginTop: 24,
  },
  errorText: {
    color: "#B00020",
    textAlign: "center",
    marginTop: 16,
  },
  buttonContainer: {
    padding: 20,
    paddingBottom: 40,
  },
});
