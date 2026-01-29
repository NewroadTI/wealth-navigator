// src/lib/config.ts

// Lógica centralizada para obtener la URL de la API
// Esta función se ejecuta SOLO en RUNTIME del navegador
export const getApiUrl = (): string => {
  // For production builds, ALWAYS force HTTPS for newroadai.com domains
  // This prevents any timing issues with window availability
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    // Debug logging for troubleshooting
    console.log('[getApiUrl] Detection:', {
      hostname,
      protocol,
      href: window.location.href
    });
    
    // Force HTTPS for ANY production domain
    if (hostname.includes('newroadai.com') || hostname.includes('pages.dev')) {
      console.log('[getApiUrl] Production domain detected, forcing HTTPS');
      return 'https://api.newroadai.com';
    }
    
    // For HTTPS sites (even if not known domains), use HTTPS
    if (protocol === 'https:') {
      console.log('[getApiUrl] HTTPS site detected, using HTTPS API');
      return 'https://api.newroadai.com';
    }
    
    // Development: check env vars
    const envUrl = import.meta.env.VITE_API_BASE_URL;
    if (envUrl) {
      // Force HTTPS even for env vars in production builds
      if (envUrl.includes('newroadai.com') && envUrl.startsWith('http://')) {
        console.log('[getApiUrl] Converting env HTTP to HTTPS');
        return envUrl.replace('http://', 'https://');
      }
      console.log('[getApiUrl] Using env URL:', envUrl);
      return envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
    }
    
    console.log('[getApiUrl] Fallback to localhost for dev');
    return 'http://localhost:8000';
  }
  
  // During SSR/build (no window), always return HTTPS for production
  console.log('[getApiUrl] No window context, forcing production HTTPS');
  return 'https://api.newroadai.com';
};

// Get API_BASE_URL with runtime evaluation - NO caching to ensure fresh evaluation every time
export const getApiBaseUrl = (): string => {
  const url = getApiUrl();
  console.log('[getApiBaseUrl] URL generated:', url);
  return url;
};

// Helper function for backwards compatibility - but prefer getApiBaseUrl()
export const getApiV1Url = (): string => {
  return `${getApiUrl()}/api/v1`;
};

// IMPORTANT: Do NOT export static constants like API_BASE_URL or API_V1_URL
// as they get evaluated at module import time, which could be during build.
// Always use the functions getApiBaseUrl() and getApiV1Url() instead.