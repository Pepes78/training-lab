import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './index.css'

/*
 * HashRouter y no BrowserRouter: GitHub Pages sirve ficheros estaticos y
 * devolveria 404 al recargar en una ruta profunda. Con hash, la navegacion
 * ocurre entera en cliente y la app instalada como PWA nunca se rompe.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
