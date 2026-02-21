import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HRDCalculatorPage from './components/HRDCalculatorPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HRDCalculatorPage />} />
        <Route path="/hrd-calculator" element={<HRDCalculatorPage />} />
      </Routes>
    </Router>
  );
}

export default App;
