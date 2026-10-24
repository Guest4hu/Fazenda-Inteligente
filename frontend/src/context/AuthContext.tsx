import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import type {
  AuthUser,
  LoginRequestDTO,
  RegisterRequestDTO,
  AuthResponseDTO,
} from '../types/api';
import { authService } from '../services/authService';
import {
  setOnUnauthorized,
  isTokenExpired,
  parseJwt,
  TOKEN_STORAGE_KEY,
} from '../services/apiClient';

export interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loading: boolean;
  error: string | null;
  login: (credentials: LoginRequestDTO) => Promise<AuthResponseDTO>;
  register: (data: RegisterRequestDTO) => Promise<AuthResponseDTO>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(() => authService.getToken());
  const [user, setUserState] = useState<AuthUser | null>(() => authService.getUser());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const logout = useCallback(() => {
    authService.logout();
    setTokenState(null);
    setUserState(null);
    setError(null);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('curral_selected_farm_id');
      window.localStorage.removeItem('curral_selected_corral_id');
    }
  }, []);

  const login = useCallback(async (credentials: LoginRequestDTO): Promise<AuthResponseDTO> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authService.login(credentials);
      setTokenState(response.token);
      const authenticatedUser: AuthUser = {
        id: response.userId,
        userId: response.userId,
        name: response.name,
        email: response.email,
      };
      setUserState(authenticatedUser);
      return response;
    } catch (err: any) {
      const msg = err?.detail || err?.message || 'Falha ao realizar login.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (data: RegisterRequestDTO): Promise<AuthResponseDTO> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authService.register(data);
      setTokenState(response.token);
      const authenticatedUser: AuthUser = {
        id: response.userId,
        userId: response.userId,
        name: response.name,
        email: response.email,
      };
      setUserState(authenticatedUser);
      return response;
    } catch (err: any) {
      const msg = err?.detail || err?.message || 'Falha ao cadastrar produtor.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Inicialização, verificação de expiração e registro de interceptor 401
  useEffect(() => {
    const existingToken = authService.getToken();
    if (existingToken) {
      if (isTokenExpired(existingToken)) {
        logout();
      } else {
        setTokenState(existingToken);
        const existingUser = authService.getUser();
        if (existingUser) {
          setUserState(existingUser);
        } else {
          const claims = parseJwt(existingToken);
          if (claims) {
            setUserState({
              id: claims.userId,
              userId: claims.userId,
              name: claims.userName,
              email: claims.sub,
            });
          }
        }
      }
    } else {
      setTokenState(null);
      setUserState(null);
    }
    setIsLoading(false);

    // Registra logout automático em respostas 401
    setOnUnauthorized(() => {
      logout();
    });

    // Sincronização de logout e login entre abas
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === TOKEN_STORAGE_KEY) {
        if (!e.newValue) {
          setTokenState(null);
          setUserState(null);
        } else {
          setTokenState(e.newValue);
          setUserState(authService.getUser());
        }
      }
    };
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      setOnUnauthorized(null);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [logout]);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      token,
      isAuthenticated: !!token && !isTokenExpired(token),
      isLoading,
      loading: isLoading,
      error,
      login,
      register,
      logout,
      clearError,
    }),
    [user, token, isLoading, error, login, register, logout, clearError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um <AuthProvider>');
  }
  return context;
}
