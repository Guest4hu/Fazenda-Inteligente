import React, { useMemo } from 'react';
import { History, Radio, UserCheck } from 'lucide-react';
import type { AnimalEventResponseDTO } from '../../types/api';

export type Kind = 'info' | 'ok' | 'warn' | 'danger';

export interface SystemLog {
  id: number;
  t: string;
  msg: string;
  kind: Kind;
}

export interface EventsTimelineProps {
  isLive?: boolean;
  corralName?: string;
  liveEvents?: AnimalEventResponseDTO[];
  systemLogs?: SystemLog[];
  events?: SystemLog[]; // alias for compatibility with tests and dashboard
  onClearLogs?: () => void;
}

interface UnifiedTimelineItem {
  id: string;
  timeStr: string;
  kind: Kind;
  title: string;
  subtitle?: string;
  eventType?: 'ENTROU' | 'SAIU';
  origin?: 'TAG' | 'MANUAL';
  animalName?: string;
  tagUid?: string;
}

const kindCls: Record<Kind, string> = {
  info: 'bg-muted-foreground',
  ok: 'bg-primary',
  warn: 'bg-accent',
  danger: 'bg-destructive',
};

/**
 * Renders a unified activity feed displaying backend animal presence events
 * ({@code liveEvents}) followed by local operational and simulation logs
 * ({@code systemLogs}).
 */
export const EventsTimeline: React.FC<EventsTimelineProps> = ({
  isLive = false,
  corralName,
  liveEvents = [],
  systemLogs = [],
  events: propEvents,
  onClearLogs,
}) => {
  const effectiveLogs = propEvents || systemLogs;

  // Map backend animal presence events followed by local operational/simulation logs
  const timelineItems: UnifiedTimelineItem[] = useMemo(() => {
    const items: UnifiedTimelineItem[] = [];

    const safeTime = (iso: string) => {
      if (!iso) return '--:--:--';
      try {
        const d = new Date(iso);
        return isNaN(d.getTime()) ? iso : d.toLocaleTimeString('pt-BR');
      } catch {
        return iso;
      }
    };

    // Map backend animal presence events
    liveEvents.forEach((ev) => {
      const isEntry = ev.typeEvent === 'ENTROU';
      items.push({
        id: `live-${ev.id}`,
        timeStr: safeTime(ev.instant),
        kind: isEntry ? 'ok' : 'warn',
        title: `${ev.animalName} ${isEntry ? 'entrou no' : 'saiu do'} curral`,
        subtitle: `Tag RFID: ${ev.tagUid} • Origem: ${ev.eventOrigin}`,
        eventType: ev.typeEvent,
        origin: ev.eventOrigin,
        animalName: ev.animalName,
        tagUid: ev.tagUid,
      });
    });

    // Map local system and simulation logs
    effectiveLogs.forEach((log) => {
      items.push({
        id: `sys-${log.id}`,
        timeStr: log.t,
        kind: log.kind,
        title: log.msg,
      });
    });

    return items;
  }, [liveEvents, effectiveLogs]);

  return (
    <section
      aria-labelledby="h-ev"
      className="rounded-2xl border border-card-border bg-card p-5 shadow-sm md:col-span-6"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 id="h-ev" className="text-lg font-bold flex items-center gap-2">
          <History className="size-5" aria-hidden /> Eventos recentes
        </h2>
        <div className="flex items-center gap-2">
          <span
            data-tone={isLive ? 'online' : 'sim'}
            className="font-mono text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 bg-accent/40 text-foreground border border-accent"
          >
            {isLive ? (corralName || 'Ao Vivo') : 'Simulado'}
          </span>
          {effectiveLogs.length > 0 && onClearLogs && (
            <button
              onClick={onClearLogs}
              className="text-xs text-muted-foreground hover:text-foreground transition underline underline-offset-2"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      <ol
        className="mt-3 max-h-80 overflow-auto divide-y divide-border"
        data-testid="list-events"
      >
        {timelineItems.length === 0 ? (
          <li className="py-4 text-center text-sm text-muted-foreground">
            Nenhum evento registrado ainda.
          </li>
        ) : (
          timelineItems.map((item) => (
            <li key={item.id} className="pop flex items-start gap-3 py-2">
              <span
                className={`mt-1.5 size-2.5 rounded-full shrink-0 ${kindCls[item.kind]}`}
                aria-hidden
              />

              <time className="font-mono text-xs text-muted-foreground pt-0.5 shrink-0">
                {item.timeStr}
              </time>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-sm ${
                      item.kind === 'danger' ? 'font-semibold text-destructive' : 'font-medium'
                    }`}
                  >
                    {item.title}
                  </span>

                  {/* RFID presence event badge */}
                  {item.eventType && (
                    <span
                      className={`font-mono text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        item.eventType === 'ENTROU'
                          ? 'bg-primary/20 text-primary border border-primary/30'
                          : 'bg-accent/40 text-accent-foreground border border-accent'
                      }`}
                    >
                      {item.eventType}
                    </span>
                  )}

                  {item.origin && (
                    <span
                      className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground flex items-center gap-1"
                      title={item.origin === 'TAG' ? 'Identificação RFID Automática' : 'Lançamento Manual'}
                    >
                      {item.origin === 'TAG' ? (
                        <>
                          <Radio className="size-2.5" /> RFID ESP32
                        </>
                      ) : (
                        <>
                          <UserCheck className="size-2.5" /> Manual
                        </>
                      )}
                    </span>
                  )}
                </div>

                {item.subtitle && (
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                    {item.subtitle}
                  </p>
                )}
              </div>
            </li>
          ))
        )}
      </ol>
    </section>
  );
};
