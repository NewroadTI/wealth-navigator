/**
 * Hook for subscribing to live prices via Server-Sent Events (SSE).
 * 
 * Benefits over polling:
 * - Single persistent connection instead of repeated requests
 * - Server pushes updates when available
 * - Automatic reconnection on disconnect
 * - More efficient for real-time data
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getApiBaseUrl } from '@/lib/config';

const LIVE_PRICES_STORAGE_KEY = 'wealthroad_live_prices_cache';
const LIVE_PRICES_TIMESTAMP_KEY = 'wealthroad_live_prices_timestamp';

export interface LivePriceData {
  asset_id: number;
  symbol: string;
  isin: string | null;
  live_price: number;
  previous_close: number | null;
  day_change_pct: number;
  bid: number | null;
  ask: number | null;
  last: number | null;
  timestamp: string;
  currency: string;
}

interface SSEState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  lastUpdate: Date | null;
  connectionId: string | null;
}

interface UseLivePricesSSEOptions {
  /** Enable or disable the SSE connection */
  enabled: boolean;
  /** Asset IDs to subscribe to */
  assetIds: number[];
  /** Callback when prices are received */
  onPrices?: (prices: LivePriceData[]) => void;
  /** Delay before attempting reconnection (ms) */
  reconnectDelay?: number;
  /** Maximum reconnection attempts before giving up */
  maxReconnectAttempts?: number;
}

interface UseLivePricesSSEReturn {
  /** Current connection state */
  state: SSEState;
  /** Map of asset_id -> latest price data */
  prices: Map<number, LivePriceData>;
  /** Manually disconnect */
  disconnect: () => void;
  /** Manually reconnect */
  reconnect: () => void;
  /** Clear cached prices from localStorage */
  clearCache: () => void;
}

export function useLivePricesSSE({
  enabled,
  assetIds,
  onPrices,
  reconnectDelay = 3000,
  maxReconnectAttempts = 5,
}: UseLivePricesSSEOptions): UseLivePricesSSEReturn {
  // Load cached prices and timestamp from localStorage
  const loadCachedPrices = (): Map<number, LivePriceData> => {
    try {
      const cached = localStorage.getItem(LIVE_PRICES_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as Array<[number, LivePriceData]>;
        return new Map(parsed);
      }
    } catch (e) {
      console.error('[SSE] Error loading cached prices:', e);
    }
    return new Map();
  };

  const loadCachedTimestamp = (): Date | null => {
    try {
      const cached = localStorage.getItem(LIVE_PRICES_TIMESTAMP_KEY);
      if (cached) {
        return new Date(cached);
      }
    } catch (e) {
      console.error('[SSE] Error loading cached timestamp:', e);
    }
    return null;
  };

  const [state, setState] = useState<SSEState>({
    connected: false,
    connecting: false,
    error: null,
    lastUpdate: loadCachedTimestamp(),
    connectionId: null,
  });
  
  const [prices, setPrices] = useState<Map<number, LivePriceData>>(loadCachedPrices());
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const assetIdsRef = useRef<number[]>(assetIds);
  
  // Keep assetIds ref updated
  useEffect(() => {
    assetIdsRef.current = assetIds;
  }, [assetIds]);
  
  // Save prices to localStorage
  const savePricesToCache = useCallback((pricesMap: Map<number, LivePriceData>, timestamp: Date) => {
    try {
      const pricesArray = Array.from(pricesMap.entries());
      localStorage.setItem(LIVE_PRICES_STORAGE_KEY, JSON.stringify(pricesArray));
      localStorage.setItem(LIVE_PRICES_TIMESTAMP_KEY, timestamp.toISOString());
    } catch (e) {
      console.error('[SSE] Error saving prices to cache:', e);
    }
  }, []);

  // Clear cached prices from localStorage
  const clearCache = useCallback(() => {
    try {
      localStorage.removeItem(LIVE_PRICES_STORAGE_KEY);
      localStorage.removeItem(LIVE_PRICES_TIMESTAMP_KEY);
      setPrices(new Map());
      setState(prev => ({ ...prev, lastUpdate: null }));
      console.log('[SSE] Cache cleared');
    } catch (e) {
      console.error('[SSE] Error clearing cache:', e);
    }
  }, []);

  const disconnect = useCallback(() => {
    console.log('[SSE] Disconnecting...');
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    setState(prev => ({
      ...prev,
      connected: false,
      connecting: false,
      connectionId: null,
    }));
    
    reconnectAttemptsRef.current = 0;
    // Note: We don't clear cached prices on disconnect so they persist
  }, []);
  
  const connect = useCallback(() => {
    // Don't connect if disabled
    if (!enabled) {
      console.log('[SSE] Not connecting: disabled');
      return;
    }
    
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    
    console.log('[SSE] Connecting to stream...');
    setState(prev => ({ ...prev, connecting: true, error: null }));
    
    // Connect WITHOUT asset_ids in URL (avoid URL length limits)
    // We'll subscribe after connection using POST /subscribe
    const baseUrl = getApiBaseUrl();
    const url = `${baseUrl}/api/v1/analytics/live-prices/stream`;
    
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;
    
    // Handle connection opened
    eventSource.onopen = () => {
      console.log('[SSE] Connection opened, waiting for confirmation...');
    };
    
    // Handle "connected" event (initial connection)
    eventSource.addEventListener('connected', async (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[SSE] Connected with ID:', data.connection_id);
        
        setState(prev => ({
          ...prev,
          connected: true,
          connecting: false,
          connectionId: data.connection_id,
          error: null,
        }));
        
        // Now subscribe to assets via POST (avoids URL length limits)
        if (assetIdsRef.current.length > 0) {
          console.log('[SSE] Subscribing to', assetIdsRef.current.length, 'assets...');
          try {
            const response = await fetch(
              `${baseUrl}/api/v1/analytics/live-prices/subscribe?connection_id=${data.connection_id}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ asset_ids: assetIdsRef.current }),
              }
            );
            
            if (response.ok) {
              console.log('[SSE] Successfully subscribed to assets');
            } else {
              console.error('[SSE] Failed to subscribe:', response.status);
            }
          } catch (err) {
            console.error('[SSE] Error subscribing:', err);
          }
        }
        
        // Process any cached prices (from reconnection)
        if (data.cached_prices && data.cached_prices.length > 0) {
          const pricesMap = new Map<number, LivePriceData>();
          data.cached_prices.forEach((p: LivePriceData) => {
            pricesMap.set(p.asset_id, p);
          });
          
          const now = new Date();
          
          setPrices(prev => {
            const merged = new Map(prev);
            pricesMap.forEach((v, k) => merged.set(k, v));
            
            // Save to localStorage
            savePricesToCache(merged, now);
            return merged;
          });
          
          setState(prev => ({ ...prev, lastUpdate: now }));
          
          if (onPrices) {
            onPrices(data.cached_prices);
          }
        }
        
        reconnectAttemptsRef.current = 0;
      } catch (e) {
        console.error('[SSE] Error parsing connected event:', e);
      }
    });
    
    // Handle "prices" event (price updates)
    eventSource.addEventListener('prices', (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.prices && data.prices.length > 0) {
          console.log('[SSE] Received', data.prices.length, 'price updates');
          
          const now = new Date();
          
          setPrices(prev => {
            const merged = new Map(prev);
            data.prices.forEach((p: LivePriceData) => {
              merged.set(p.asset_id, p);
            });
            
            // Save to localStorage
            savePricesToCache(merged, now);
            return merged;
          });
          
          setState(prev => ({
            ...prev,
            connected: data.connected ?? true,
            lastUpdate: now,
          }));
          
          if (onPrices) {
            onPrices(data.prices);
          }
        }
      } catch (e) {
        console.error('[SSE] Error parsing prices event:', e);
      }
    });
    
    // Handle "heartbeat" event (keep-alive)
    eventSource.addEventListener('heartbeat', () => {
      console.log('[SSE] Heartbeat received');
    });
    
    // Handle "error" event from server
    eventSource.addEventListener('error', (event: Event) => {
      if (event instanceof MessageEvent) {
        try {
          const data = JSON.parse(event.data);
          console.error('[SSE] Server error:', data.message);
          setState(prev => ({ ...prev, error: data.message }));
        } catch {
          // Not a JSON error event
        }
      }
    });
    
    // Handle connection error
    eventSource.onerror = (error) => {
      console.error('[SSE] Connection error:', error);
      
      setState(prev => ({
        ...prev,
        connected: false,
        connecting: false,
        error: 'Connection lost',
      }));
      
      // Close the errored connection
      eventSource.close();
      eventSourceRef.current = null;
      
      // Attempt reconnection if enabled and under max attempts
      if (enabled && reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++;
        console.log(`[SSE] Reconnecting in ${reconnectDelay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, reconnectDelay);
      } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        setState(prev => ({
          ...prev,
          error: 'Max reconnection attempts reached. Click to retry.',
        }));
      }
    };
  }, [enabled, onPrices, reconnectDelay, maxReconnectAttempts]);
  
  const reconnect = useCallback(() => {
    console.log('[SSE] Manual reconnect requested');
    reconnectAttemptsRef.current = 0;
    disconnect();
    // Small delay to ensure cleanup
    setTimeout(() => {
      connect();
    }, 100);
  }, [connect, disconnect]);
  
  // Connect/disconnect based on enabled state
  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
      setPrices(new Map());
    }
    
    return () => {
      disconnect();
    };
  }, [enabled]); // Only depend on enabled, not connect/disconnect
  
  // Update subscription when asset IDs change (without reconnecting)
  useEffect(() => {
    if (state.connected && state.connectionId && assetIds.length > 0) {
      // Update subscription via POST
      const updateSubscription = async () => {
        try {
          const response = await fetch(
            `${getApiBaseUrl()}/api/v1/analytics/live-prices/subscribe?connection_id=${state.connectionId}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ asset_ids: assetIds }),
            }
          );
          
          if (response.ok) {
            console.log('[SSE] Subscription updated with', assetIds.length, 'assets');
          }
        } catch (error) {
          console.error('[SSE] Failed to update subscription:', error);
        }
      };
      
      updateSubscription();
    }
  }, [assetIds, state.connected, state.connectionId]);
  
  return {
    state,
    prices,
    disconnect,
    reconnect,
    clearCache,
  };
}
