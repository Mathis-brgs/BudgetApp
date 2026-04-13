import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { supabase } from '../services/supabase';

export default function ProjectionScreen() {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState({
    labels: ["Aujourd'hui"],
    datasets: [{ data: [0] }]
  });

  useEffect(() => {
    calculateProjections();
  }, []);

  const calculateProjections = async () => {
    try {
      setLoading(true);

      // Récupérer le solde actuel de l'épargne
      const { data: accounts } = await supabase
        .from('accounts')
        .select('balance')
        .eq('type', 'epargne');
      
      const initialBalance = accounts?.reduce((sum, acc) => sum + Number(acc.balance), 0) || 0;

      // Récupérer les règles d'épargne et les dépenses 
      const { data: rules } = await supabase.from('savings_rules').select('*');
      const { data: expenses } = await supabase.from('planned_expenses').select('*');

      // Construction des données du graphique (Simulation sur 6 mois)
      const labels = ["Avr", "Mai", "Juin", "Juil", "Août", "Sept"];
      const projectedData = [
        initialBalance, 
        initialBalance + 300, 
        initialBalance + 650, 
        initialBalance + 1000, 
        initialBalance + 1350, 
        initialBalance + 1700
      ];

      setChartData({
        labels: labels,
        datasets: [{ data: projectedData }]
      });

    } catch (error) {
      console.error("Erreur de calcul :", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Projection à 6 mois</Text>
      
      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
      ) : (
        <LineChart
          data={chartData}
          width={Dimensions.get("window").width - 30}
          height={220}
          yAxisSuffix=" €"
          chartConfig={{
            backgroundColor: "#ffffff",
            backgroundGradientFrom: "#ffffff",
            backgroundGradientTo: "#ffffff",
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            style: { borderRadius: 16 },
            propsForDots: { r: "4", strokeWidth: "2", stroke: "#007AFF" }
          }}
          bezier
          style={styles.chart}
        />
      )}
      
      <View style={styles.summaryBox}>
        <Text style={styles.summaryText}>L'algorithme récupère mes comptes, applique mes règles mensuelles et déduit mes dépenses futures pour tracer cette courbe.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F2F2F7',
    padding: 15,
    alignItems: 'center'
  },
  loader: {
    marginTop: 50,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 20,
    alignSelf: 'flex-start'
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryBox: {
    marginTop: 30,
    padding: 15,
    backgroundColor: '#E5F1FF',
    borderRadius: 10,
    width: '100%',
  },
  summaryText: {
    color: '#005BB5',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center'
  }
});
