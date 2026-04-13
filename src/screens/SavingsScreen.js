import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  Button,
} from "react-native";
import { PieChart } from "react-native-chart-kit";
import { supabase } from "../services/supabase";

export default function SavingsScreen({ navigation }) {
  const [savingsAccounts, setSavingsAccounts] = useState([]);
  const [totalSavings, setTotalSavings] = useState(0);

  useEffect(() => {
    const fetchSavings = async () => {
      const { data } = await supabase
        .from("accounts")
        .select("*")
        .eq("type", "epargne");

      setSavingsAccounts(data || []);
      const total =
        data?.reduce((sum, acc) => sum + Number(acc.balance), 0) || 0;
      setTotalSavings(total);
    };
    fetchSavings();
  }, []);

  const chartData = savingsAccounts.map((acc, index) => ({
    name: acc.name,
    population: Number(acc.balance),
    color: ["#007AFF", "#34C759", "#FF9500", "#AF52DE"][index % 4],
    legendFontColor: "#7F7F7F",
    legendFontSize: 12,
  }));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>Total Épargne</Text>
        <Text style={styles.totalAmount}>
          {totalSavings.toLocaleString()} €
        </Text>
      </View>

      {chartData.length > 0 ? (
        <PieChart
          data={chartData}
          width={Dimensions.get("window").width}
          height={220}
          chartConfig={{ color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})` }}
          accessor={"population"}
          backgroundColor={"transparent"}
          paddingLeft={"15"}
        />
      ) : (
        <Text style={styles.emptyState}>
          Aucun compte d'épargne à afficher.
        </Text>
      )}

      <FlatList
        data={savingsAccounts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.accountRow}>
            <Text style={styles.accountName}>{item.name}</Text>
            <Text style={styles.accountBalance}>{item.balance} €</Text>
          </View>
        )}
      />

      <View style={styles.buttonContainer}>
        <Button
          title="Voir mes prévisions"
          onPress={() => navigation.navigate("Projections")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { padding: 20, alignItems: "center", backgroundColor: "#F8F8F8" },
  label: { fontSize: 14, color: "#8E8E93" },
  totalAmount: { fontSize: 32, fontWeight: "bold", color: "#1C1C1E" },
  accountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  accountName: { fontSize: 16, fontWeight: "500" },
  accountBalance: { fontSize: 16, color: "#007AFF", fontWeight: "bold" },
  emptyState: {
    textAlign: "center",
    color: "#8E8E93",
    marginVertical: 24,
  },
  buttonContainer: {
    padding: 20,
    paddingBottom: 40,
  },
});
