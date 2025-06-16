
import './index.css'
import './styles/globalStyles.css'

import App from './App'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from './styles/theme-provider'

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
