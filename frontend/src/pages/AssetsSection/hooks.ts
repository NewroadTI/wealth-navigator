import { useState, useEffect } from 'react';
import { catalogsApi, AssetClass } from '@/lib/api';

/**
 * Hook para cargar asset classes desde el API
 */
export const useAssetClasses = () => {
  const [assetClasses, setAssetClasses] = useState<AssetClass[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const loadAssetClasses = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const classes = await catalogsApi.getAssetClasses();
        setAssetClasses(classes);
      } catch (err) {
        console.error('Error loading asset classes:', err);
        setError(err instanceof Error ? err : new Error('Failed to load asset classes'));
      } finally {
        setIsLoading(false);
      }
    };
    loadAssetClasses();
  }, []);

  return { assetClasses, isLoading, error };
};

/**
 * Hook para cargar catálogos (currencies, countries, industries)
 */
export const useCatalogs = () => {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
  const [currencies, setCurrencies] = useState<Array<{ code: string; name: string }>>([]);
  const [countries, setCountries] = useState<Array<{ iso_code: string; name?: string | null }>>([]);
  const [industries, setIndustries] = useState<Array<{ industry_code: string; name: string; sector?: string | null }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const loadCatalogs = async () => {
      try {
        setIsLoading(true);
        const [countriesResponse, industriesResponse, currenciesResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/api/v1/catalogs/countries`, { signal: controller.signal }),
          fetch(`${apiBaseUrl}/api/v1/catalogs/industries`, { signal: controller.signal }),
          fetch(`${apiBaseUrl}/api/v1/catalogs/currencies`, { signal: controller.signal }),
        ]);

        if (!countriesResponse.ok || !industriesResponse.ok || !currenciesResponse.ok) {
          throw new Error('Failed to load catalogs');
        }

        const countriesData = (await countriesResponse.json()) as Array<{ iso_code: string; name?: string | null }>;
        const industriesData = (await industriesResponse.json()) as Array<{
          industry_code: string;
          name: string;
          sector?: string | null;
        }>;
        const currenciesData = (await currenciesResponse.json()) as Array<{ code: string; name: string }>;

        setCountries(Array.isArray(countriesData) ? countriesData : []);
        setIndustries(Array.isArray(industriesData) ? industriesData : []);
        setCurrencies(Array.isArray(currenciesData) ? currenciesData : []);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        console.error('Error loading catalogs:', error);
        setCountries([]);
        setIndustries([]);
        setCurrencies([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadCatalogs();
    return () => controller.abort();
  }, [apiBaseUrl]);

  return { currencies, countries, industries, isLoading };
};
