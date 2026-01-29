// Force HTTPS helper for production
export const forceHttpsApiUrl = (): string => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Force HTTPS for any production domain
    if (hostname.includes('newroadai.com') || 
        hostname.includes('pages.dev') || 
        window.location.protocol === 'https:') {
      console.log('[forceHttpsApiUrl] Production detected - forcing HTTPS');
      return 'https://api.newroadai.com';
    }
  }
  
  // Development fallback
  return 'http://localhost:8000';
};

// Wrapper for fetch that forces HTTPS in production
export const safeFetch = (url: string, options?: RequestInit): Promise<Response> => {
  let finalUrl = url;
  
  // If URL contains our domain but uses HTTP, force HTTPS
  if (url.includes('api.newroadai.com') && url.startsWith('http://')) {
    finalUrl = url.replace('http://', 'https://');
    console.warn('[safeFetch] Forced HTTP->HTTPS:', url, '=>', finalUrl);
  }
  
  console.log('[safeFetch] Request:', finalUrl);
  return fetch(finalUrl, options);
};