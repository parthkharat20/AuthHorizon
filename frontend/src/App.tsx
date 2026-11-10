import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MerchantDashboard } from './pages/MerchantDashboard';
import { BuyerConsentPortal } from './pages/BuyerConsentPortal';

export const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<MerchantDashboard />} />
      <Route path="/consent/:orderId" element={<BuyerConsentPortal />} />
      <Route path="/consent" element={<BuyerConsentPortal />} />
      <Route path="/checkout/success" element={<Navigate to="/" replace />} />
      <Route path="/checkout/cancel" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;

