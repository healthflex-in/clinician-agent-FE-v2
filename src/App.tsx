
import React from 'react';
import './App.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import FormPage from './pages/FormPage';
import AssessmentPage from './pages/AssessmentPage';
import IndexPage from './pages/Index';
import NotFoundPage from './pages/NotFound';
import FirstAssessmentPage from './pages/FirstAssessmentPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<IndexPage />} />
        <Route path="/form/:formKey/:patientId/:appointmentId" element={<FormPage />} />
        <Route path="/assessment/:patientId/:appointmentId" element={<AssessmentPage />} />
        <Route path="/firstAssessment/:patientId/:appointmentId" element={<FirstAssessmentPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Router>
  );
}

export default App;
