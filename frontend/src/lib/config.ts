// src/lib/config.ts

// Lógica centralizada para obtener la URL de la API
// Esta función se ejecuta en RUNTIME, no en build time
export const getApiUrl = (): string => {
  // Detectar si estamos en producción (HTTPS)
  const isProduction = typeof window !== 'undefined' && window.location.protocol === 'https:';
  
  // 1. Si estamos en producción HTTPS, usar HTTPS
  if (isProduction) {
    // Intentar usar la variable de entorno primero
    const envUrl = import.meta.env.VITE_API_BASE_URL;
    if (envUrl) {
      let url = envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
      // Garantizar que sea HTTPS en producción
      url = url.replace(/^http:/, 'https:');
      return url;
    }
    
    // Fallback: asumir que la API está en el mismo dominio
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'api.newroadai.com';
    return `https://api.${hostname === 'newroadai.com' ? 'newroadai.com' : hostname}`;
  }
  
  // 2. En desarrollo, usar la variable de entorno o localhost
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