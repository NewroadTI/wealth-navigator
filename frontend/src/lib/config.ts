// src/lib/config.ts

// Lógica centralizada para obtener la URL de la API
// Esta función se ejecuta SOLO en RUNTIME del navegador
export const getApiUrl = (): string => {
  // Force this function to ONLY run in browser context
  if (typeof window === 'undefined') {
    // During build/SSR, force return HTTPS - never allow HTTP in production builds
    return 'https://api.newroadai.com';
  }

  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  // Production detection: HTTPS or known production hostnames
  const isProductionHostname = hostname.includes('newroadai.com') || 
                                hostname.includes('pages.dev') ||
                                hostname.includes('cloudflare');
  const isHttps = protocol === 'https:';
  const isProduction = isHttps || isProductionHostname;
  
  // Debug logging for troubleshooting
  console.log('[config] API URL detection:', {
    hostname,
    protocol,
    isProduction,
    isProductionHostname,
    isHttps,
    'window.location.href': window.location.href
  });
  
  // En producción, SIEMPRE usar HTTPS
  if (isProduction) {
    console.log('[config] Production detected, using HTTPS');
    return 'https://api.newroadai.com';
  }
  
  // En desarrollo local
  console.log('[config] Development detected, checking env vars');
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl) {
    // Force HTTPS even for env vars in production builds
    if (envUrl.includes('newroadai.com') && envUrl.startsWith('http://')) {
      console.log('[config] Converting env HTTP to HTTPS');
      return envUrl.replace('http://', 'https://');
    }
    console.log('[config] Using env URL:', envUrl);
    return envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
  }
  
  console.log('[config] Fallback to localhost');
  return 'http://localhost:8000';
};

// Get API_BASE_URL with runtime evaluation - NO caching to ensure fresh evaluation
export const getApiBaseUrl = (): string => {
  return getApiUrl();
};

// Helper function for backwards compatibility - but prefer getApiBaseUrl()
export const getApiV1Url = (): string => {
  return `${getApiUrl()}/api/v1`;
};

// IMPORTANT: Do NOT export static constants like API_BASE_URL or API_V1_URL
// as they get evaluated at module import time, which could be during build.
// Always use the functions getApiBaseUrl() and getApiV1Url() instead.