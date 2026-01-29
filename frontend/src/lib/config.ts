// src/lib/config.ts

// Lógica centralizada para obtener la URL de la API
// Esta función se ejecuta en RUNTIME en cada llamada, no en build time
export const getApiUrl = (): string => {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    // During SSR/build, return a placeholder that will be replaced at runtime
    // This should not happen in a typical SPA but handles edge cases
    console.warn('[config] window is undefined, using env fallback');
    const envUrl = import.meta.env.VITE_API_BASE_URL;
    if (envUrl) {
      // Ensure HTTPS for production URLs
      if (envUrl.includes('newroadai.com') && envUrl.startsWith('http://')) {
        return envUrl.replace('http://', 'https://');
      }
      return envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
    }
    return 'https://api.newroadai.com'; // Safe default for production
  }

  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  // Production detection: HTTPS or known production hostnames
  const isProductionHostname = hostname.includes('newroadai.com') || 
                                hostname.includes('pages.dev') ||
                                hostname.includes('cloudflare');
  const isHttps = protocol === 'https:';
  const isProduction = isHttps || isProductionHostname;
  
  // Debug logging (only in development or when explicitly enabled)
  if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_API) {
    console.log('[config] API URL detection:', {
      hostname,
      protocol,
      isProduction,
      isProductionHostname,
      isHttps
    });
  }
  
  // En producción, SIEMPRE usar HTTPS
  if (isProduction) {
    // Known production domains
    if (hostname.includes('newroadai.com') || hostname.includes('pages.dev')) {
      return 'https://api.newroadai.com';
    }
    
    // Fallback: construct API URL with HTTPS
    return `https://api.${hostname.replace('www.', '')}`;
  }
  
  // En desarrollo (localhost), usar la variable de entorno o localhost
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl) {
    return envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
  }
  
  return 'http://localhost:8000';
};

// IMPORTANT: Use a getter pattern so the URL is evaluated at runtime for each access
// This ensures proper protocol detection after the page fully loads
let _cachedApiUrl: string | null = null;

// Get API_BASE_URL with lazy evaluation (evaluated on first access after DOM is ready)
export const getApiBaseUrl = (): string => {
  // Re-evaluate each time in production to ensure correct protocol detection
  // The URL is consistent per page load but we don't cache during initial load
  if (_cachedApiUrl !== null) {
    return _cachedApiUrl;
  }
  
  const url = getApiUrl();
  
  // Only cache after the first successful evaluation in browser
  if (typeof window !== 'undefined') {
    _cachedApiUrl = url;
  }
  
  return url;
};

// Exportar la URL base para api.ts (sin /api/v1)
// NOTA: Para garantizar que siempre use HTTPS en producción,
// los módulos deben usar getApiBaseUrl() en lugar de API_BASE_URL directamente
// cuando sea posible, o asegurarse de que este módulo se importe después
// de que el DOM esté listo.
export const API_BASE_URL = getApiBaseUrl();

// Exportar la URL con /api/v1 para pages como Positions.tsx
export const API_V1_URL = `${getApiBaseUrl()}/api/v1`;