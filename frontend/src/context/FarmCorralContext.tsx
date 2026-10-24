import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { FarmResponseDTO, CorralResponseDTO } from '../types/api';
import { farmService } from '../services/farmService';
import { corralService } from '../services/corralService';
import { useAuth } from './AuthContext';

export interface FarmCorralContextType {
  farms: FarmResponseDTO[];
  currais: CorralResponseDTO[];
  selectedFarmId: number | null;
  selectedCorralId: number | null;
  selectedFarm: FarmResponseDTO | null;
  selectedCorral: CorralResponseDTO | null;
  isLoadingFarms: boolean;
  isLoadingCurrais: boolean;
  error: string | null;
  selectFarm: (farmId: number | null) => Promise<void>;
  selectCorral: (corralId: number | null) => void;
  refreshFarms: () => Promise<FarmResponseDTO[]>;
  refreshCurrais: (targetFarmId?: number) => Promise<CorralResponseDTO[]>;
  addFarm: (farm: FarmResponseDTO) => void;
  addCorral: (corral: CorralResponseDTO) => void;
  updateCorralInContext: (corral: CorralResponseDTO) => void;
  updateFarmInContext: (farm: FarmResponseDTO) => void;
  deleteFarmFromContext: (farmId: number) => Promise<void>;
  deleteCorralFromContext: (corralId: number) => Promise<void>;
}

const FarmCorralContext = createContext<FarmCorralContextType | undefined>(undefined);

export const FARM_STORAGE_KEY = 'curral_selected_farm_id';
export const CORRAL_STORAGE_KEY = 'curral_selected_corral_id';

export const FarmCorralProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [farms, setFarms] = useState<FarmResponseDTO[]>([]);
  const [currais, setCurrais] = useState<CorralResponseDTO[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<number | null>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(FARM_STORAGE_KEY);
      return saved ? Number(saved) : null;
    }
    return null;
  });
  const [selectedCorralId, setSelectedCorralId] = useState<number | null>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(CORRAL_STORAGE_KEY);
      return saved ? Number(saved) : null;
    }
    return null;
  });
  const [isLoadingFarms, setIsLoadingFarms] = useState<boolean>(false);
  const [isLoadingCurrais, setIsLoadingCurrais] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Carrega currais de uma fazenda
  const refreshCurrais = useCallback(async (targetFarmId?: number): Promise<CorralResponseDTO[]> => {
    const fid = targetFarmId ?? selectedFarmId;
    if (!fid) {
      setCurrais([]);
      setSelectedCorralId(null);
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(CORRAL_STORAGE_KEY);
      }
      return [];
    }

    setIsLoadingCurrais(true);
    try {
      const data = await corralService.listCorrais(fid);
      setCurrais(data);

      setSelectedCorralId((prev) => {
        if (prev && data.some((c) => c.id === prev)) {
          return prev;
        }
        const next = data.length > 0 ? data[0].id : null;
        if (typeof window !== 'undefined' && window.localStorage) {
          if (next) window.localStorage.setItem(CORRAL_STORAGE_KEY, String(next));
          else window.localStorage.removeItem(CORRAL_STORAGE_KEY);
        }
        return next;
      });

      return data;
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Erro ao carregar currais.');
      return [];
    } finally {
      setIsLoadingCurrais(false);
    }
  }, [selectedFarmId]);

  // Carrega lista de fazendas
  const refreshFarms = useCallback(async (): Promise<FarmResponseDTO[]> => {
    if (!isAuthenticated) {
      setFarms([]);
      setCurrais([]);
      setSelectedFarmId(null);
      setSelectedCorralId(null);
      return [];
    }

    setIsLoadingFarms(true);
    try {
      const data = await farmService.listFarms();
      setFarms(data);

      let nextFarmId = selectedFarmId;
      if (!nextFarmId || !data.some((f) => f.id === nextFarmId)) {
        nextFarmId = data.length > 0 ? data[0].id : null;
      }

      setSelectedFarmId(nextFarmId);
      if (typeof window !== 'undefined' && window.localStorage) {
        if (nextFarmId) window.localStorage.setItem(FARM_STORAGE_KEY, String(nextFarmId));
        else window.localStorage.removeItem(FARM_STORAGE_KEY);
      }

      if (nextFarmId) {
        await refreshCurrais(nextFarmId);
      } else {
        setCurrais([]);
        setSelectedCorralId(null);
      }

      return data;
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Erro ao carregar fazendas.');
      return [];
    } finally {
      setIsLoadingFarms(false);
    }
  }, [isAuthenticated, selectedFarmId, refreshCurrais]);

  // Seleção de Fazenda
  const selectFarm = useCallback(async (farmId: number | null) => {
    setSelectedFarmId(farmId);
    if (typeof window !== 'undefined' && window.localStorage) {
      if (farmId) window.localStorage.setItem(FARM_STORAGE_KEY, String(farmId));
      else window.localStorage.removeItem(FARM_STORAGE_KEY);
    }
    if (farmId) {
      await refreshCurrais(farmId);
    } else {
      setCurrais([]);
      setSelectedCorralId(null);
    }
  }, [refreshCurrais]);

  // Seleção de Curral
  const selectCorral = useCallback((corralId: number | null) => {
    setSelectedCorralId(corralId);
    if (typeof window !== 'undefined' && window.localStorage) {
      if (corralId) window.localStorage.setItem(CORRAL_STORAGE_KEY, String(corralId));
      else window.localStorage.removeItem(CORRAL_STORAGE_KEY);
    }
  }, []);

  const addFarm = useCallback((newFarm: FarmResponseDTO) => {
    setFarms((prev) => [...prev, newFarm]);
    selectFarm(newFarm.id);
  }, [selectFarm]);

  const addCorral = useCallback((newCorral: CorralResponseDTO) => {
    setCurrais((prev) => [...prev, newCorral]);
    selectCorral(newCorral.id);
  }, [selectCorral]);

  const updateCorralInContext = useCallback((updatedCorral: CorralResponseDTO) => {
    setCurrais((prev) => prev.map((c) => (c.id === updatedCorral.id ? updatedCorral : c)));
  }, []);

  const updateFarmInContext = useCallback((updatedFarm: FarmResponseDTO) => {
    setFarms((prev) => prev.map((f) => (f.id === updatedFarm.id ? updatedFarm : f)));
  }, []);

  const deleteFarmFromContext = useCallback(async (farmId: number) => {
    await farmService.deleteFarm(farmId);
    setFarms((prev) => {
      const remaining = prev.filter((f) => f.id !== farmId);
      if (selectedFarmId === farmId) {
        const nextFarm = remaining.length > 0 ? remaining[0] : null;
        const nextId = nextFarm ? nextFarm.id : null;
        setSelectedFarmId(nextId);
        if (typeof window !== 'undefined' && window.localStorage) {
          if (nextId) window.localStorage.setItem(FARM_STORAGE_KEY, String(nextId));
          else window.localStorage.removeItem(FARM_STORAGE_KEY);
        }
        if (nextId) {
          refreshCurrais(nextId);
        } else {
          setCurrais([]);
          setSelectedCorralId(null);
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.removeItem(CORRAL_STORAGE_KEY);
          }
        }
      }
      return remaining;
    });
  }, [selectedFarmId, refreshCurrais]);

  const deleteCorralFromContext = useCallback(async (corralId: number) => {
    await corralService.deleteCorral(corralId);
    setCurrais((prev) => {
      const remaining = prev.filter((c) => c.id !== corralId);
      if (selectedCorralId === corralId) {
        const nextCorral = remaining.length > 0 ? remaining[0] : null;
        const nextId = nextCorral ? nextCorral.id : null;
        setSelectedCorralId(nextId);
        if (typeof window !== 'undefined' && window.localStorage) {
          if (nextId) window.localStorage.setItem(CORRAL_STORAGE_KEY, String(nextId));
          else window.localStorage.removeItem(CORRAL_STORAGE_KEY);
        }
      }
      return remaining;
    });
  }, [selectedCorralId]);

  useEffect(() => {
    if (isAuthenticated) {
      refreshFarms();
    } else {
      setFarms([]);
      setCurrais([]);
      setSelectedFarmId(null);
      setSelectedCorralId(null);
    }
  }, [isAuthenticated]);

  const selectedFarm = useMemo(
    () => farms.find((f) => f.id === selectedFarmId) || null,
    [farms, selectedFarmId]
  );

  const selectedCorral = useMemo(
    () => currais.find((c) => c.id === selectedCorralId) || null,
    [currais, selectedCorralId]
  );

  const value = useMemo<FarmCorralContextType>(
    () => ({
      farms,
      currais,
      selectedFarmId,
      selectedCorralId,
      selectedFarm,
      selectedCorral,
      isLoadingFarms,
      isLoadingCurrais,
      error,
      selectFarm,
      selectCorral,
      refreshFarms,
      refreshCurrais,
      addFarm,
      addCorral,
      updateCorralInContext,
      updateFarmInContext,
      deleteFarmFromContext,
      deleteCorralFromContext,
    }),
    [
      farms,
      currais,
      selectedFarmId,
      selectedCorralId,
      selectedFarm,
      selectedCorral,
      isLoadingFarms,
      isLoadingCurrais,
      error,
      selectFarm,
      selectCorral,
      refreshFarms,
      refreshCurrais,
      addFarm,
      addCorral,
      updateCorralInContext,
      updateFarmInContext,
      deleteFarmFromContext,
      deleteCorralFromContext,
    ]
  );

  return <FarmCorralContext.Provider value={value}>{children}</FarmCorralContext.Provider>;
};

export function useFarmCorral(): FarmCorralContextType {
  const context = useContext(FarmCorralContext);
  if (!context) {
    throw new Error('useFarmCorral deve ser utilizado dentro de um <FarmCorralProvider>');
  }
  return context;
}
