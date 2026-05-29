import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HRDCalculatorPage from './components/HRDCalculatorPage';
import AdminPage from './pages/AdminPage';
import ActivationGate from './components/ActivationGate';
import { ACMDataProvider } from './context/ACMDataContext';
import { SavedPlansProvider } from './contexts/SavedPlansContext';

// Calculator gated behind activation code; /admin stays ungated.
const GatedCalculator = () => (
  <ActivationGate>
    <HRDCalculatorPage />
  </ActivationGate>
);

function App() {
  return (
    <ACMDataProvider>
      <SavedPlansProvider>
      <Router>
        <Routes>
          <Route path="/"               element={<GatedCalculator />} />
          <Route path="/hrd-calculator" element={<GatedCalculator />} />
          <Route path="/product/calculator/desktop" element={<GatedCalculator />} />
          <Route path="/admin"          element={<AdminPage />} />
          <Route path="*"               element={<GatedCalculator />} />
        </Routes>
      </Router>
      </SavedPlansProvider>
    </ACMDataProvider>
  );
}

export default App;
