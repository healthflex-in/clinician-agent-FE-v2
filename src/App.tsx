import './App.css';

import IndexPage from './pages';
import FormPage from './pages/form-page';
import NotFoundPage from './pages/not-found';

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<IndexPage />} />
        <Route
          path="/:formKey/:patientId/:appointmentId"
          element={<FormPage />}
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Router>
  );
}

export default App;
