
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ThemeProvider } from './styles/theme-provider'
import './index.css'
import './styles/globalStyles.css'

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
