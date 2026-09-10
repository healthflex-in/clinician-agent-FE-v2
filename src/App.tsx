import './App.css';

import IndexPage from './pages/Index';
import { lazy, Suspense } from 'react';
const FormPage = lazy(() => import('./pages/form-page'));
import NotFoundPage from './pages/not-found';

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <Router>
      <Suspense fallback={<div role="status" className="p-6">Loading form…</div>}>
      <Routes>
        <Route path="/" element={<IndexPage />} />
        <Route
          path="/:formKey/:patientId/:appointmentId"
          element={<FormPage />}
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
