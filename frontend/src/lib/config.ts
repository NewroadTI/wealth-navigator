// src/lib/config.ts

// Lógica centralizada para obtener la URL de la API
export const getApiUrl = () => {
  // 1. Usar variable de entorno (lo recomendado)
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  
  if (envUrl) {
    // Asegurarse de que no termine en slash para evitar dobles //
    return envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
  }

  // 2. Fallback para desarrollo local si no hay variable
  return 'http://localhost:8000';
};

// Exportar la URL base para api.ts (sin /api/v1)
export const API_BASE_URL = getApiUrl();

// Exportar la URL con /api/v1 para pages como Positions.tsx
export const API_V1_URL = `${API_BASE_URL}/api/v1`;