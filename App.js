import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import CurrentAccountScreen from "./src/screens/CurrentAccountScreen";
import SavingsScreen from "./src/screens/SavingsScreen";
import ProjectionScreen from "./src/screens/ProjectionScreen";

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator screenOptions={{ tabBarActiveTintColor: "#007AFF" }}>
        <Tab.Screen
          name="Courant"
          component={CurrentAccountScreen}
          options={{ title: "Compte Courant" }}
        />
        <Tab.Screen
          name="Épargne"
          component={SavingsScreen}
          options={{ title: "Épargne" }}
        />
        <Tab.Screen
          name="Projections"
          component={ProjectionScreen}
          options={{ title: "Simulateur" }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
