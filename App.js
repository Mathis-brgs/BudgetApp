import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from './src/screens/HomeScreen';
import ProjectionScreen from './src/screens/ProjectionScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen 
          name="Home" 
          component={HomeScreen} 
          options={{ title: 'Mes Comptes' }} 
        />
        <Stack.Screen 
          name="Projections" 
          component={ProjectionScreen} 
          options={{ title: 'Épargne Prévisionnelle' }} 
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
