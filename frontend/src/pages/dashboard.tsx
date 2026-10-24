import React, { useCallback, useEffect, useRef, useState } from 'react';

// Contextos
import { AuthProvider, useAuth } from '../context/AuthContext';
import { FarmCorralProvider, useFarmCorral } from '../context/FarmCorralContext';

// Serviços da API REST
import { animalService } from '../services/animalService';
import { corralService } from '../services/corralService';
import { odorService } from '../services/odorService';
import { pendencyService } from '../services/pendencyService';
import { cleanService } from '../services/cleanService';
import { checkBackendHealth, getToken } from '../services/apiClient';
import { subscribeToCorralStream } from '../services/sseService';
import { Info } from 'lucide-react';

// Tipos da API
import type {
  CorralMetricsResponseDTO,
  AnimalResponseDTO,
  AnimalEventResponseDTO,
  IdentifyPendencyResponseDTO,
  OdorTelemetryResponseDTO,
  CleanCmdResponseDTO,
} from '../types/api';

// Subcomponentes Modulares do Dashboard
import { Header } from '../components/dashboard/Header';
import { ConnectivityBanner } from '../components/dashboard/ConnectivityBanner';
import { CleaningControl } from '../components/dashboard/CleaningControl';
import { AnimalPresenceList } from '../components/dashboard/AnimalPresenceList';
import { ParametersPanel, type Mode } from '../components/dashboard/ParametersPanel';
import { MetricsKpiCards } from '../components/dashboard/MetricsKpiCards';
import { OdorChart } from '../components/dashboard/OdorChart';
import { EventsTimeline, type SystemLog, type Kind } from '../components/dashboard/EventsTimeline';
import { PendenciesModal, PendenciesAlertBanner } from '../components/dashboard/PendenciesModal';

const ts = () => new Date().toLocaleTimeString('pt-BR');
const dateKey = (d: Date) =>
  `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const rnd = (a: number, b: number) => +(a + Math.random() * (b - a)).toFixed(1);
const WASH_SECONDS = 20;

function DashboardContent() {
  const { isAuthenticated, user, logout } = useAuth();
  const {
    farms,
    currais,
    selectedFarmId,
    selectedCorralId,
    selectedCorral,
    selectFarm,
    selectCorral,
    updateCorralInContext,
  } = useFarmCorral();

  // --------------------------------------------------------------------------
  // 1. Estados de Dados Vivos (API)
  // --------------------------------------------------------------------------
  const [metrics, setMetrics] = useState<CorralMetricsResponseDTO | null>(null);
  const [odorReadings, setOdorReadings] = useState<OdorTelemetryResponseDTO[]>([]);
  const [animals, setAnimals] = useState<AnimalResponseDTO[]>([]);
  const [liveEvents, setLiveEvents] = useState<AnimalEventResponseDTO[]>([]);
  const [pendencies, setPendencies] = useState<IdentifyPendencyResponseDTO[]>([]);
  const [cleanHistory, setCleanHistory] = useState<CleanCmdResponseDTO[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isBackendOnline, setIsBackendOnline] = useState<boolean | null>(null);
  const [isSseConnected, setIsSseConnected] = useState<boolean>(false);

  // --------------------------------------------------------------------------
  // 2. Estados de Simulação / Fallback (Preserva compatibilidade total)
  // --------------------------------------------------------------------------
  const [mode, setMode] = useState<Mode>('manual');
  const [timeInput, setTimeInput] = useState('06:30');
  const [savedTime, setSavedTime] = useState('06:30');
  const [saved, setSaved] = useState(false);
  const [presenceSimulated, setPresenceSimulated] = useState(false);
  const [washing, setWashing] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [sensors, setSensors] = useState({ temp: 27.4, hum: 63.2, mq: 412 });
  const [events, setEvents] = useState<SystemLog[]>([
    { id: 0, t: ts(), msg: 'Painel iniciado em modo simulado.', kind: 'info' },
  ]);

  // Modais complementares
  const [showPendenciesModal, setShowPendenciesModal] = useState(false);
  const [openCreateOnPendencies, setOpenCreateOnPendencies] = useState(false);

  // Refs de timers e estados síncronos
  const idRef = useRef(1);
  const presenceRef = useRef(false);
  const washingRef = useRef(false);
  const modeRef = useRef<Mode>('manual');
  const savedTimeRef = useRef('06:30');
  const lastRunRef = useRef('');
  const timerRef = useRef<number | null>(null);
  const prevCorralAnimalsRef = useRef<number[]>([]);
  const animalsRef = useRef<AnimalResponseDTO[]>([]);
  const hasInitializedAnimalsRef = useRef(false);

  const isLive = Boolean(isAuthenticated && selectedCorralId);
  const activeCorral = selectedCorral || null;
  const activeCorralRef = useRef(activeCorral);
  activeCorralRef.current = activeCorral;

  // --------------------------------------------------------------------------
  // 3. Funções de Logging e Timers Simulados
  // --------------------------------------------------------------------------
  const log = useCallback((msg: string, kind: Kind = 'info') => {
    setEvents((e) => [{ id: idRef.current++, t: ts(), msg, kind }, ...e].slice(0, 30));
  }, []);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const endWash = useCallback((msg: string, kind: Kind) => {
    clearTimer();
    washingRef.current = false;
    setWashing(false);
    setRemaining(0);
    log(msg, kind);
  }, [log]);

  const startWashSimulated = useCallback((origin: string) => {
    if (presenceRef.current) {
      log(`Lavagem (${origin}) RECUSADA: animal detectado no curral. Bomba simulada continua desligada.`, 'danger');
      return;
    }
    if (washingRef.current) {
      log(`Lavagem (${origin}) ignorada: já está lavando.`, 'warn');
      return;
    }
    washingRef.current = true;
    setWashing(true);
    let left = activeCorral?.pumpDurationSeconds || WASH_SECONDS;
    setRemaining(left);
    log(`Lavagem simulada iniciada (${origin}). Bomba simulada LIGADA.`, 'ok');
    clearTimer();
    timerRef.current = window.setInterval(() => {
      left -= 1;
      setRemaining(left);
      if (left <= 0) {
        endWash('Lavagem simulada concluída. Bomba simulada desligada.', 'ok');
      }
    }, 1000);
  }, [log, endWash, activeCorral]);

  const stopWashSimulated = () => {
    if (!washingRef.current) {
      log('Parar acionado: a bomba simulada já estava desligada.', 'info');
      return;
    }
    endWash('Parar acionado pelo usuário. Bomba simulada DESLIGADA.', 'warn');
  };

  const togglePresenceSimulated = () => {
    const next = !presenceRef.current;
    presenceRef.current = next;
    setPresenceSimulated(next);
    if (next) {
      log('Presença de animal simulada: PIR detectou movimento.', 'warn');
      if (washingRef.current) {
        endWash('PARADA DE SEGURANÇA: animal detectado durante a lavagem. Bomba simulada desligada.', 'danger');
      }
    } else {
      log('Presença removida. A lavagem NÃO reinicia sozinha.', 'info');
    }
  };

  // Agendamento automático simulado (quando em modo automático)
  useEffect(() => {
    const id = window.setInterval(() => {
      if (modeRef.current !== 'automatico') return;
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (hhmm !== savedTimeRef.current) return;
      const key = `${dateKey(now)} ${hhmm}`;
      if (lastRunRef.current === key) return;
      lastRunRef.current = key;
      startWashSimulated('agendamento automático');
    }, 1000);
    return () => {
      window.clearInterval(id);
      clearTimer();
    };
  }, [startWashSimulated]);

  // --------------------------------------------------------------------------
  // 4. Sincronização Sob Demanda e Periódica com API Backend
  // --------------------------------------------------------------------------
  const syncDashboardData = useCallback(async (silent?: unknown) => {
    const isSilent = silent === true;
    setIsRefreshing(true);

    if (isLive && selectedCorralId && selectedFarmId) {
      try {
        const [
          metricsData,
          odorData,
          animalsData,
          eventsData,
          pendenciesData,
          historyData,
        ] = await Promise.all([
          corralService.getMetrics(selectedCorralId).catch(() => null as CorralMetricsResponseDTO | null),
          odorService.getOdorReadings(selectedCorralId).catch(() => [] as OdorTelemetryResponseDTO[]),
          animalService.listAnimals(selectedFarmId).catch(() => [] as AnimalResponseDTO[]),
          animalService.listEvents(selectedCorralId).catch(() => [] as AnimalEventResponseDTO[]),
          pendencyService.listPendencies(selectedCorralId).catch(() => [] as IdentifyPendencyResponseDTO[]),
          cleanService.listCleanHistory(selectedCorralId).catch(() => [] as CleanCmdResponseDTO[]),
        ]);

        if (metricsData) setMetrics(metricsData);
        if (odorData) setOdorReadings(odorData);

        if (animalsData) {
          const currentInCorral = animalsData.filter((a) => a.currentCorralId === selectedCorralId);
          const currentIds = currentInCorral.map((a) => a.id);

          if (hasInitializedAnimalsRef.current || prevCorralAnimalsRef.current.length > 0 || currentIds.length > 0) {
            const newlyEntered = currentInCorral.filter(
              (a) => !prevCorralAnimalsRef.current.includes(a.id)
            );
            const newlyExited = animalsRef.current.filter(
              (a) => a.currentCorralId === selectedCorralId && !currentIds.includes(a.id)
            );

            for (const animal of newlyEntered) {
              log(`Detecção automática RFID: ${animal.name} (Tag: ${animal.tagUid}) entrou no curral.`, 'warn');
            }
            for (const animal of newlyExited) {
              log(`Detecção automática RFID: ${animal.name} (Tag: ${animal.tagUid}) saiu do curral.`, 'info');
            }
          }

          hasInitializedAnimalsRef.current = true;
          prevCorralAnimalsRef.current = currentIds;
          animalsRef.current = animalsData;

          // Parada biológica imediata caso a lavagem esteja em andamento e haja animal presente
          const hasAnimalPresent =
            currentIds.length > 0 || ((metricsData?.totalAnimaisNoCurral ?? 0) > 0);
          if (hasAnimalPresent && washingRef.current) {
            endWash(
              'PARADA DE SEGURANÇA: animal detectado no curral pelo sensor/RFID. Bomba desligada.',
              'danger'
            );
          }

          setAnimals(animalsData);
        }

        if (eventsData) setLiveEvents(eventsData);
        if (pendenciesData) setPendencies(pendenciesData);
        if (historyData) setCleanHistory(historyData);

        if (metricsData || odorData || animalsData || eventsData || pendenciesData || historyData) {
          setIsBackendOnline(true);
        }

        if (!isSilent) {
          log('Dados do curral sincronizados com o servidor.', 'info');
        }
      } catch {
        if (!isSilent) {
          log('Erro na sincronização de dados ao vivo.', 'warn');
        }
      }
    } else {
      // Fallback simulado
      setSensors({
        temp: rnd(22, 36),
        hum: rnd(45, 85),
        mq: Math.round(rnd(300, 700)),
      });
      if (!isSilent) {
        log('Leituras simuladas atualizadas.', 'info');
      }
    }

    setIsRefreshing(false);
  }, [isLive, selectedCorralId, selectedFarmId, log, endWash]);

  // --------------------------------------------------------------------------
  // 4.1 Conexão SSE em Tempo Real (Server-Sent Events)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!isLive || !selectedCorralId) {
      setIsSseConnected(false);
      return;
    }

    const unsubscribe = subscribeToCorralStream({
      corralId: selectedCorralId,
      farmId: selectedFarmId,
      token: () => getToken(),
      onConnected: () => {
        setIsSseConnected(true);
        setIsBackendOnline(true);
        log('Transmissão SSE conectada ao vivo para o curral.', 'ok');
      },
      onOpen: () => {
        setIsSseConnected(true);
        setIsBackendOnline(true);
      },
      onError: () => {
        setIsSseConnected(false);
      },
      onOdor: (data) => {
        setIsBackendOnline(true);
        setOdorReadings((prev) => [data, ...prev.filter((r) => r.id !== data.id)].slice(0, 50));
        setMetrics((prev) =>
          prev
            ? {
                ...prev,
                deviceStatus: 'ONLINE',
                lastSeenAt: data.instant,
              }
            : {
                corralId: data.corralId,
                corralName: activeCorralRef.current?.name || '',
                farmId: selectedFarmId || 0,
                farmName: '',
                totalAnimaisNoCurral: 0,
                totalAnimaisNaFazenda: 0,
                limpezasHojeTotal: 0,
                limpezasHojeManual: 0,
                limpezasHojeOdor: 0,
                limpezasHojeAutomatica: 0,
                deviceStatus: 'ONLINE',
                lastSeenAt: data.instant,
                pendenciasAbertas: 0,
              }
        );
        if (data.value >= (activeCorralRef.current?.limitOdor || 400)) {
          log(
            `Alerta de Odor: Nível crítico de ${data.value} ppm detectado (Limite: ${
              activeCorralRef.current?.limitOdor || 400
            } ppm).`,
            'danger'
          );
        }
      },
      onPresenca: (data) => {
        setIsBackendOnline(true);
        setLiveEvents((prev) => [data, ...prev.filter((e) => e.id !== data.id)].slice(0, 50));

        // Parada de segurança biológica imediata caso a bomba d'água esteja ligada e o animal tenha entrado
        if (data.typeEvent === 'ENTROU' && washingRef.current) {
          endWash(
            'PARADA DE SEGURANÇA: animal detectado no curral pelo sensor/RFID. Bomba desligada.',
            'danger'
          );
        }

        setAnimals((prevAnimals) => {
          let updatedList = [...prevAnimals];
          const targetAnimal = updatedList.find(
            (a) => a.id === data.animalId || (data.tagUid && a.tagUid === data.tagUid)
          );

          if (data.typeEvent === 'ENTROU') {
            if (targetAnimal) {
              updatedList = updatedList.map((a) =>
                a.id === targetAnimal.id
                  ? { ...a, currentCorralId: data.corralId, currentCorralName: data.corralName }
                  : a
              );
            } else if (data.animalId) {
              updatedList = [
                ...updatedList,
                {
                  id: data.animalId,
                  farmId: selectedFarmId || 0,
                  name: data.animalName,
                  identification: null,
                  tagUid: data.tagUid,
                  currentCorralId: data.corralId,
                  currentCorralName: data.corralName,
                },
              ];
            }
          } else {
            if (targetAnimal) {
              updatedList = updatedList.map((a) =>
                a.id === targetAnimal.id
                  ? { ...a, currentCorralId: null, currentCorralName: null }
                  : a
              );
            }
          }

          const currentInCorral = updatedList.filter((a) => a.currentCorralId === selectedCorralId);
          const currentIds = currentInCorral.map((a) => a.id);
          prevCorralAnimalsRef.current = currentIds;
          animalsRef.current = updatedList;

          if (currentIds.length > 0 && washingRef.current) {
            endWash(
              'PARADA DE SEGURANÇA: animal detectado no curral pelo sensor/RFID. Bomba desligada.',
              'danger'
            );
          }

          return updatedList;
        });

        setMetrics((prev) => {
          const delta = data.typeEvent === 'ENTROU' ? 1 : -1;
          if (!prev) {
            return {
              corralId: data.corralId,
              corralName: data.corralName || activeCorralRef.current?.name || '',
              farmId: selectedFarmId || 0,
              farmName: '',
              totalAnimaisNoCurral: Math.max(0, delta),
              totalAnimaisNaFazenda: 0,
              limpezasHojeTotal: 0,
              limpezasHojeManual: 0,
              limpezasHojeOdor: 0,
              limpezasHojeAutomatica: 0,
              deviceStatus: 'ONLINE',
              lastSeenAt: data.instant,
              pendenciasAbertas: 0,
            };
          }
          const nextCount = Math.max(0, prev.totalAnimaisNoCurral + delta);
          return {
            ...prev,
            totalAnimaisNoCurral: nextCount,
            deviceStatus: 'ONLINE',
            lastSeenAt: data.instant,
          };
        });

        if (data.typeEvent === 'ENTROU') {
          log(
            `Detecção automática RFID: ${data.animalName || 'Animal'} (Tag: ${data.tagUid}) entrou no curral.`,
            'warn'
          );
        } else {
          log(
            `Detecção automática RFID: ${data.animalName || 'Animal'} (Tag: ${data.tagUid}) saiu do curral.`,
            'info'
          );
        }
      },
      onPendencia: (data) => {
        setIsBackendOnline(true);
        setPendencies((prev) => {
          const exists = prev.some((p) => p.id === data.id);
          return exists
            ? prev.map((p) => (p.id === data.id ? data : p))
            : [data, ...prev];
        });

        setMetrics((prev) => {
          if (!prev) {
            return {
              corralId: data.corralId,
              corralName: activeCorralRef.current?.name || '',
              farmId: selectedFarmId || 0,
              farmName: '',
              totalAnimaisNoCurral: 0,
              totalAnimaisNaFazenda: 0,
              limpezasHojeTotal: 0,
              limpezasHojeManual: 0,
              limpezasHojeOdor: 0,
              limpezasHojeAutomatica: 0,
              deviceStatus: 'ONLINE',
              lastSeenAt: data.instant,
              pendenciasAbertas: data.resolved ? 0 : 1,
            };
          }
          return {
            ...prev,
            pendenciasAbertas: data.resolved
              ? Math.max(0, prev.pendenciasAbertas - 1)
              : prev.pendenciasAbertas + 1,
            deviceStatus: 'ONLINE',
            lastSeenAt: data.instant,
          };
        });

        if (data.resolved) {
          log(
            `Pendência de identificação (Tag: ${data.tagUid}) resolvida com sucesso.`,
            'ok'
          );
        } else {
          log(
            `Tag RFID desconhecida detectada (${data.tagUid}). Pendência gerada.`,
            'warn'
          );
        }
      },
      onLimpeza: (data) => {
        setIsBackendOnline(true);
        setCleanHistory((prev) => {
          const exists = prev.some((h) => h.id === data.id);
          return exists
            ? prev.map((h) => (h.id === data.id ? data : h))
            : [data, ...prev];
        });

        if (data.state === 'CONCLUIDO') {
          log(`Ciclo de limpeza concluído com sucesso (${data.origin}). Bomba desligada.`, 'ok');
          setMetrics((prev) => {
            if (!prev) return prev;
            const isManual = data.origin === 'MANUAL';
            const isOdor = data.origin === 'EVENTO';
            const isAuto = data.origin === 'AUTOMATICA';
            return {
              ...prev,
              limpezasHojeTotal: prev.limpezasHojeTotal + 1,
              limpezasHojeManual: isManual ? prev.limpezasHojeManual + 1 : prev.limpezasHojeManual,
              limpezasHojeOdor: isOdor ? prev.limpezasHojeOdor + 1 : prev.limpezasHojeOdor,
              limpezasHojeAutomatica: isAuto ? prev.limpezasHojeAutomatica + 1 : prev.limpezasHojeAutomatica,
            };
          });
          corralService.getMetrics(selectedCorralId).then((m) => m && setMetrics(m)).catch(() => {});
        } else if (data.state === 'CANCELADO') {
          log(`Lavagem cancelada (${data.origin}): ${data.mensagem || 'Falha de acionamento'}.`, 'danger');
        } else if (data.state === 'EM_ANDAMENTO') {
          log(`Ciclo de limpeza acionado (${data.origin}). Bomba LIGADA.`, 'ok');
        }
      },
      onStatus: (data) => {
        setIsBackendOnline(true);
        updateCorralInContext(data);
        setMetrics((prev) =>
          prev
            ? {
                ...prev,
                deviceStatus: data.deviceStatus,
                lastSeenAt: data.lastSeenAt,
              }
            : {
                corralId: data.id,
                corralName: data.name,
                farmId: data.farmId,
                farmName: '',
                totalAnimaisNoCurral: 0,
                totalAnimaisNaFazenda: 0,
                limpezasHojeTotal: 0,
                limpezasHojeManual: 0,
                limpezasHojeOdor: 0,
                limpezasHojeAutomatica: 0,
                deviceStatus: data.deviceStatus,
                lastSeenAt: data.lastSeenAt,
                pendenciasAbertas: 0,
              }
        );
        if (data.deviceStatus === 'ONLINE') {
          log(`Dispositivo ESP32 do curral está ONLINE.`, 'ok');
        } else {
          log(`Dispositivo ESP32 do curral está OFFLINE.`, 'warn');
        }
      },
    });

    return () => {
      unsubscribe();
      setIsSseConnected(false);
    };
  }, [isLive, selectedCorralId, selectedFarmId, log, endWash, updateCorralInContext]);

  // --------------------------------------------------------------------------
  // 4.2 Polling Resiliente de Fallback e Sincronização Periódica
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (isLive && selectedCorralId) {
      hasInitializedAnimalsRef.current = false;
      prevCorralAnimalsRef.current = [];
      syncDashboardData(false);
      // Quando SSE está ativo, mantém sincronização periódica de reconciliação a cada 15s;
      // Quando SSE desconecta ou falha, aciona imediatamente fallback para polling rápido de 3s.
      const pollIntervalMs = isSseConnected ? 15000 : 3000;
      const interval = setInterval(() => syncDashboardData(true), pollIntervalMs);
      return () => clearInterval(interval);
    }
  }, [isLive, selectedCorralId, isSseConnected, syncDashboardData]);

  // Verificação periódica de conectividade com o Backend Spring Boot (executada apenas no navegador real)
  useEffect(() => {
    let isMounted = true;
    // Evita timers assíncronos não controlados durante a suíte de testes unitários
    const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
    if (isTestEnv) return;

    const probe = async () => {
      try {
        const ok = await checkBackendHealth();
        if (isMounted) setIsBackendOnline(ok);
      } catch {
        if (isMounted) setIsBackendOnline(false);
      }
    };

    probe();
    const interval = window.setInterval(probe, 12000);
    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, []);

  // Contagem de pendências não resolvidas
  const openPendenciesCount = pendencies.filter((p) => !p.resolved).length;

  return (
    <div className="min-h-[100dvh] pb-12 transition-colors">
      {/* 1. Banner de Conectividade ESP32 (data-testid="banner-esp32") */}
      <ConnectivityBanner
        isLive={isLive}
        isSimulated={!isLive}
        deviceStatus={metrics?.deviceStatus || activeCorral?.deviceStatus || (isLive ? 'OFFLINE' : null)}
        lastSeenAt={metrics?.lastSeenAt || activeCorral?.lastSeenAt || null}
        macAddress={activeCorral?.macAddress || null}
        corralName={activeCorral?.name || null}
        isSseConnected={isSseConnected}
      />

      {/* Dica Contextual Educativa para Modo Simulado */}
      {!isAuthenticated && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-950 px-4 py-2 text-xs flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Info className="size-4 text-amber-600 shrink-0" aria-hidden />
            <span>
              <strong>Modo de Demonstração Interativo:</strong> Você pode testar todas as funcionalidades (bomba, presença e sensores) localmente.
              Para operar o curral com o ESP32 real, acesse sua conta.
            </span>
          </div>
          <span className="text-[11px] font-semibold text-amber-800">
            Dica: Clique em "Entrar / Cadastrar" para conectar ao backend.
          </span>
        </div>
      )}

      {/* 2. Cabeçalho Principal e Navegação Multi-Tenant */}
      <Header
        user={user}
        isAuthenticated={isAuthenticated}
        farms={farms}
        selectedFarmId={selectedFarmId}
        onSelectFarm={selectFarm}
        corrais={currais}
        selectedCorralId={selectedCorralId}
        onSelectCorral={selectCorral}
        onLogout={logout}
        onRefreshAll={syncDashboardData}
        isBackendOnline={isBackendOnline}
        isSseConnected={isSseConnected}
      />

      <main className="max-w-5xl mx-auto px-4 mt-6 space-y-4">
        {/* 3. Banner de Alerta para Pendências RFID Não Identificadas */}
        {isLive && openPendenciesCount > 0 && (
          <PendenciesAlertBanner
            pendenciesCount={openPendenciesCount}
            onOpenModal={() => {
              setOpenCreateOnPendencies(false);
              setShowPendenciesModal(true);
            }}
            onAddAnimal={
              selectedFarmId
                ? () => {
                    setOpenCreateOnPendencies(true);
                    setShowPendenciesModal(true);
                  }
                : undefined
            }
          />
        )}

        {/* 4. Grid Principal do Dashboard */}
        <div className="grid gap-4 md:grid-cols-6">
          {/* 4.1 Controle de Limpeza (data-testid: status-pump, button-lavar, button-parar) */}
          <CleaningControl
            isLive={isLive}
            isSimulated={!isLive}
            corralId={selectedCorralId}
            corralName={activeCorral?.name}
            pumpDurationSeconds={activeCorral?.pumpDurationSeconds || WASH_SECONDS}
            hasAnimalInCorral={
              isLive
                ? (animals.some((a) => a.currentCorralId === selectedCorralId) ||
                   (metrics?.totalAnimaisNoCurral ?? 0) > 0 ||
                   presenceSimulated)
                : presenceSimulated
            }
            deviceStatus={metrics?.deviceStatus || activeCorral?.deviceStatus || 'OFFLINE'}
            washingSimulated={washing}
            remainingSimulated={remaining}
            onStartWashSimulated={() => startWashSimulated('manual')}
            onStopWashSimulated={stopWashSimulated}
            cleanHistory={cleanHistory}
            onLogEvent={log}
            onRefresh={syncDashboardData}
          />

          {/* 4.2 Lista de Presença de Animais (data-testid: status-presence, switch-presence) */}
          <AnimalPresenceList
            corralId={selectedCorralId}
            farmId={selectedFarmId}
            corralName={activeCorral?.name}
            isLive={isLive}
            presenceSimulated={presenceSimulated}
            onTogglePresenceSimulated={togglePresenceSimulated}
            animals={animals}
            onRefresh={syncDashboardData}
            onLogEvent={log}
            washing={washing}
            onStopWash={endWash}
          />

          {/* 4.3 Painel de Parâmetros Operacionais (data-testid: mode-*, input-time, button-salvar-horario) */}
          <ParametersPanel
            isLive={isLive}
            isSimulated={!isLive}
            corralId={selectedCorralId}
            farmId={selectedFarmId}
            corral={activeCorral}
            mode={mode}
            onChangeMode={(m) => {
              modeRef.current = m;
              setMode(m);
            }}
            timeInput={timeInput}
            setTimeInput={setTimeInput}
            savedTime={savedTime}
            saved={saved}
            onSaveTime={() => {
              if (!/^\d{2}:\d{2}$/.test(timeInput)) {
                log('Horário inválido. Use o formato HH:MM.', 'danger');
                return;
              }
              savedTimeRef.current = timeInput;
              setSavedTime(timeInput);
              setSaved(true);
              log(`Horário diário salvo: ${timeInput} (simulado).`, 'ok');
              window.setTimeout(() => setSaved(false), 2500);
            }}
            onLogEvent={log}
            onRefresh={syncDashboardData}
          />

          {/* 4.4 Cards de Sensores e Métricas (data-testid: value-temp, value-hum, value-mq, button-atualizar) */}
          <MetricsKpiCards
            isLive={isLive}
            isSimulated={!isLive}
            metrics={metrics}
            sensors={sensors}
            latestOdorValue={odorReadings.length > 0 ? odorReadings[0].value : null}
            limitOdor={activeCorral?.limitOdor || 400}
            onRefresh={syncDashboardData}
            isRefreshing={isRefreshing}
          />

          {/* 4.5 Gráfico de Telemetria de Odor (MQ-135) */}
          <OdorChart
            isLive={isLive}
            readings={odorReadings}
            limitOdor={activeCorral?.limitOdor || 400}
            simulatedMqValue={sensors.mq}
          />

          {/* 4.6 Linha do Tempo e Eventos (data-testid: list-events) */}
          <EventsTimeline
            isLive={isLive}
            corralName={activeCorral?.name}
            liveEvents={liveEvents}
            systemLogs={events}
            onClearLogs={() => setEvents([])}
          />
        </div>
      </main>

      {/* 5. Modais de Diálogo */}
      {selectedCorralId && (
        <PendenciesModal
          isOpen={showPendenciesModal}
          onClose={() => {
            setShowPendenciesModal(false);
            setOpenCreateOnPendencies(false);
          }}
          corralId={selectedCorralId}
          farmId={selectedFarmId}
          pendencies={pendencies}
          farmAnimals={animals}
          onResolved={syncDashboardData}
          onLogEvent={log}
          openCreateOnFirst={openCreateOnPendencies}
        />
      )}

      <footer className="max-w-5xl mx-auto px-4 mt-8 text-xs text-muted-foreground">
        Projeto didático Curral Inteligente. Demonstração acadêmica com suporte a hardware ESP32 e simulação local.
      </footer>
    </div>
  );
}

/**
 * Componente raiz do Dashboard com auto-envelopamento seguro dos Providers
 */
export default function Dashboard() {
  let hasAuthContext = false;
  try {
    useAuth();
    hasAuthContext = true;
  } catch {
    hasAuthContext = false;
  }

  if (hasAuthContext) {
    return <DashboardContent />;
  }

  return (
    <AuthProvider>
      <FarmCorralProvider>
        <DashboardContent />
      </FarmCorralProvider>
    </AuthProvider>
  );
}
