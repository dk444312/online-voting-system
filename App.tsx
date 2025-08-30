
import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import AdminPortal from './pages/AdminPortal';
import VoterRegistration from './pages/VoterRegistration';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/register" element={<VoterRegistration />} />
        <Route path="/admin" element={<AdminPortal />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
