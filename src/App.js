import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HRDCalculatorPage from './components/HRDCalculatorPage';
import AdminPage from './pages/AdminPage';
import { ACMDataProvider } from './context/ACMDataContext';

function App() {
  return (
    <ACMDataProvider>
      <Router>
        <Routes>
          <Route path="/"               element={<HRDCalculatorPage />} />
          <Route path="/hrd-calculator" element={<HRDCalculatorPage />} />
          <Route path="/admin"          element={<AdminPage />} />
        </Routes>
      </Router>
    </ACMDataProvider>
  );
}

export default App;
