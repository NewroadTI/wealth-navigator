// src/lib/config.ts

// Lógica centralizada para obtener la URL de la API
// Esta función se ejecuta en RUNTIME, no en build time
export const getApiUrl = (): string => {
  // Detectar si estamos en producción (HTTPS)
  const isProduction = typeof window !== 'undefined' && window.location.protocol === 'https:';
  
  // En producción, SIEMPRE usar HTTPS (ignore env vars que pueden tener HTTP)
  if (isProduction) {
    // Construir la URL HTTPS dinámicamente
    // Usar el mismo dominio pero en subdomain 'api' si es newroadai.com
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'api.newroadai.com';
    
    if (hostname.includes('newroadai.com')) {
      return 'https://api.newroadai.com';
    }
    if (hostname.includes('wealth-navigator.pages.dev')) {
      return 'https://api.newroadai.com'; // Cloudflare Pages también usa api.newroadai.com
    }
    
    // Fallback: mismo hostname con 'api' subdomain
    return `https://api.${hostname}`;
  }
  
  // En desarrollo, usar la variable de entorno o localhost
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl) {
    return envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
  }
  
  return 'http://localhost:8000';
};

// Exportar la URL base para api.ts (sin /api/v1)
// Se evalúa en RUNTIME, no en build time
export const API_BASE_URL = getApiUrl();

// Exportar la URL con /api/v1 para pages como Positions.tsx
export const API_V1_URL = `${API_BASE_URL}/api/v1`;