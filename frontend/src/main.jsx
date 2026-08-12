import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// Corrección de bug de iconos de Leaflet en producción con Vite
import L from 'leaflet'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({ 
  iconUrl: markerIcon, 
  iconRetinaUrl: markerIcon2x, 
  shadowUrl: markerShadow 
})

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
