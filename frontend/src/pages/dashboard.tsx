import { useCallback, useEffect, useRef, useState } from 'react';
import { Droplets, OctagonX, PawPrint, RefreshCw, Thermometer, Wind, Clock, ShieldAlert, Check } from 'lucide-react';

type Kind = 'info' | 'ok' | 'warn' | 'danger';
type Ev = { id: number; t: string; msg: string; kind: Kind };
type Mode = 'manual' | 'automatico';

const ts = () => new Date().toLocaleTimeString('pt-BR');
const dateKey = (d: Date) =>
  `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const rnd = (a: number, b: number) => +(a + Math.random() * (b - a)).toFixed(1);
const WASH_SECONDS = 20;

function Tag({ children, tone = 'sim' }: { children: string; tone?: 'sim' }) {
  return (
    <span data-tone={tone} className="font-mono text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 bg-accent/40 text-foreground border border-accent">
      {children}
    </span>
  );
}

export default function Dashboard() {
  const [mode, setMode] = useState<Mode>('manual');
  const [timeInput, setTimeInput] = useState('06:30');
  const [savedTime, setSavedTime] = useState('06:30');
  const [saved, setSaved] = useState(false);
  const [presence, setPresence] = useState(false);
  const [washing, setWashing] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [sensors, setSensors] = useState({ temp: 27.4, hum: 63.2, mq: 412 });
  const [events, setEvents] = useState<Ev[]>([
    { id: 0, t: ts(), msg: 'Painel iniciado em modo simulado.', kind: 'info' },
  ]);
  const idRef = useRef(1);
  const presenceRef = useRef(false);
  const washingRef = useRef(false);
  const modeRef = useRef<Mode>('manual');
  const savedTimeRef = useRef('06:30');
  const lastRunRef = useRef('');
  const timerRef = useRef<number | null>(null);

  const log = useCallback((msg: string, kind: Kind = 'info') => {
    setEvents((e) => [{ id: idRef.current++, t: ts(), msg, kind }, ...e].slice(0, 30));
  }, []);

  const clearTimer = () => {
    if (timerRef.current !== null) { window.clearInterval(timerRef.current); timerRef.current = null; }
  };

  const endWash = useCallback((msg: string, kind: Kind) => {
    clearTimer();
    washingRef.current = false;
    setWashing(false);
    setRemaining(0);
    log(msg, kind);
  }, [log]);

  const startWash = useCallback((origin: string) => {
    if (presenceRef.current) {
      log(`Lavagem (${origin}) RECUSADA: animal detectado no curral. Bomba simulada continua desligada.`, 'danger');
      return;
    }
    if (washingRef.current) { log(`Lavagem (${origin}) ignorada: já está lavando.`, 'warn'); return; }
    washingRef.current = true;
    setWashing(true);
    let left = WASH_SECONDS;
    setRemaining(left);
    log(`Lavagem simulada iniciada (${origin}). Bomba simulada LIGADA.`, 'ok');
    clearTimer();
    timerRef.current = window.setInterval(() => {
      left -= 1;
      setRemaining(left);
      if (left <= 0) endWash('Lavagem simulada concluída. Bomba simulada desligada.', 'ok');
    }, 1000);
  }, [log, endWash]);

  const stopWash = () => {
    if (!washingRef.current) { log('Parar acionado: a bomba simulada já estava desligada.', 'info'); return; }
    endWash('Parar acionado pelo usuário. Bomba simulada DESLIGADA.', 'warn');
  };

  const togglePresence = () => {
    const next = !presenceRef.current;
    presenceRef.current = next;
    setPresence(next);
    if (next) {
      log('Presença de animal simulada: PIR detectou movimento.', 'warn');
      if (washingRef.current) endWash('PARADA DE SEGURANÇA: animal detectado durante a lavagem. Bomba simulada desligada.', 'danger');
    } else {
      log('Presença removida. A lavagem NÃO reinicia sozinha.', 'info');
    }
  };

  const changeMode = (m: Mode) => {
    modeRef.current = m; setMode(m);
    log(m === 'automatico' ? 'Modo automático simulado ativado.' : 'Modo manual ativado.', 'info');
  };

  const saveTime = () => {
    if (!/^\d{2}:\d{2}$/.test(timeInput)) { log('Horário inválido. Use o formato HH:MM.', 'danger'); return; }
    savedTimeRef.current = timeInput; setSavedTime(timeInput); setSaved(true);
    log(`Horário diário salvo: ${timeInput} (simulado).`, 'ok');
    window.setTimeout(() => setSaved(false), 2500);
  };

  const refresh = () => {
    setSensors({ temp: rnd(22, 36), hum: rnd(45, 85), mq: Math.round(rnd(300, 700)) });
    log('Leituras simuladas atualizadas.', 'info');
  };

  useEffect(() => {
    const id = window.setInterval(() => {
      if (modeRef.current !== 'automatico') return;
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (hhmm !== savedTimeRef.current) return;
      const key = `${dateKey(now)} ${hhmm}`;
      if (lastRunRef.current === key) return;
      lastRunRef.current = key;
      startWash('agendamento automático');
    }, 1000);
    return () => { window.clearInterval(id); clearTimer(); };
  }, [startWash]);

  const kindCls: Record<Kind, string> = {
    info: 'bg-muted-foreground', ok: 'bg-primary', warn: 'bg-accent', danger: 'bg-destructive',
  };
  const card = 'rounded-2xl border border-card-border bg-card p-5 shadow-sm';

  return (
    <div className="min-h-[100dvh] pb-12">
      <div role="alert" className="bg-destructive text-destructive-foreground text-center text-sm font-semibold px-4 py-2" data-testid="banner-esp32">
        Não conectado ao ESP32. Tudo aqui é simulado: nenhuma bomba real é controlada.
      </div>
      <header className="max-w-5xl mx-auto px-4 pt-8 pb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Demonstração acadêmica</p>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-primary mt-1">Limpeza Inteligente do Curral</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">Veja como um sistema de lavagem pode priorizar a segurança dos animais. Todas as leituras e estados abaixo são simulados.</p>
      </header>

      <main className="max-w-5xl mx-auto px-4 grid gap-4 md:grid-cols-6">
        <section aria-labelledby="h-bomba" className={`${card} md:col-span-4 relative overflow-hidden`}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 id="h-bomba" className="text-lg font-bold flex items-center gap-2"><Droplets className="size-5" aria-hidden /> Bomba de água</h2>
            <Tag>Simulado</Tag>
          </div>
          <div className="mt-4 flex items-center gap-4">
            <div className="relative size-20 shrink-0 rounded-full grid place-items-center bg-muted overflow-hidden" aria-hidden>
              {washing && <span className="ring absolute inset-2 rounded-full bg-primary/30" />}
              <Droplets className={`size-9 relative ${washing ? 'text-primary' : 'text-muted-foreground'}`} />
              {washing && [0, 1, 2].map((i) => (
                <span key={i} className="drip absolute top-2 size-1.5 rounded-full bg-primary" style={{ left: 26 + i * 14, animationDelay: `${i * 0.3}s` }} />
              ))}
            </div>
            <div aria-live="polite">
              <p className="text-3xl font-extrabold" data-testid="status-pump">{washing ? 'Ligada (simulada)' : 'Desligada (simulada)'}</p>
              <p className="text-sm text-muted-foreground font-mono">{washing ? `Restam ${remaining}s de lavagem simulada` : 'Aguardando comando'}</p>
            </div>
          </div>
          {washing && <div className="mt-4 h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary origin-left transition-transform duration-1000 ease-linear" style={{ transform: `scaleX(${remaining / WASH_SECONDS})` }} /></div>}
          <div className="mt-5 flex flex-wrap gap-3">
            <button data-testid="button-lavar" onClick={() => startWash('manual')} disabled={washing}
              className="flex-1 min-w-36 rounded-xl bg-primary text-primary-foreground font-bold py-3.5 px-5 transition active:scale-95 hover:brightness-110 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              Lavar agora
            </button>
            <button data-testid="button-parar" onClick={stopWash}
              className="flex-1 min-w-36 rounded-xl bg-destructive text-destructive-foreground font-bold py-3.5 px-5 transition active:scale-95 hover:brightness-110 flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destructive">
              <OctagonX className="size-5" aria-hidden /> Parar
            </button>
          </div>
        </section>

        <section aria-labelledby="h-animal" className={`${card} md:col-span-2 ${presence ? 'ring-2 ring-destructive' : ''}`}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 id="h-animal" className="text-lg font-bold flex items-center gap-2"><PawPrint className="size-5" aria-hidden /> Presença (PIR)</h2>
            <Tag>Simulado</Tag>
          </div>
          <p className={`mt-3 text-2xl font-extrabold pop ${presence ? 'text-destructive' : 'text-primary'}`} key={String(presence)} data-testid="status-presence" aria-live="polite">
            {presence ? 'Animal detectado' : 'Curral livre'}
          </p>
          <button role="switch" aria-checked={presence} onClick={togglePresence} data-testid="switch-presence"
            className="mt-4 w-full flex items-center justify-between gap-3 rounded-xl border-2 border-input px-4 py-3 text-left font-semibold transition active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            <span>Simular animal / movimento</span>
            <span className={`relative h-6 w-11 rounded-full transition-colors ${presence ? 'bg-destructive' : 'bg-muted-foreground/40'}`}>
              <span className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-card transition-transform ${presence ? 'translate-x-5' : ''}`} />
            </span>
          </button>
          <p className="mt-3 text-xs text-muted-foreground flex gap-1.5"><ShieldAlert className="size-4 shrink-0" aria-hidden /> Com animal presente, toda lavagem é recusada e a bomba para na hora.</p>
        </section>

        <section aria-labelledby="h-modo" className={`${card} md:col-span-3`}>
          <div className="flex items-center justify-between gap-2">
            <h2 id="h-modo" className="text-lg font-bold flex items-center gap-2"><Clock className="size-5" aria-hidden /> Modo e horário</h2>
            <Tag>Simulado</Tag>
          </div>
          <div role="radiogroup" aria-label="Modo de operação" className="mt-4 grid grid-cols-2 gap-1 p-1 rounded-xl bg-muted">
            {(['manual', 'automatico'] as Mode[]).map((m) => (
              <button key={m} role="radio" aria-checked={mode === m} onClick={() => changeMode(m)} data-testid={`mode-${m}`}
                className={`rounded-lg py-2 font-semibold transition focus-visible:outline-2 focus-visible:outline-ring ${mode === m ? 'bg-primary text-primary-foreground shadow' : 'hover:bg-card'}`}>
                {m === 'manual' ? 'Manual' : 'Automático'}
              </button>
            ))}
          </div>
          <label htmlFor="hora" className="block mt-4 text-sm font-semibold">Horário diário de limpeza</label>
          <div className="mt-1 flex gap-2">
            <input id="hora" type="time" value={timeInput} onChange={(e) => setTimeInput(e.target.value)} data-testid="input-time"
              className="flex-1 rounded-xl border-2 border-input bg-background px-3 py-2.5 font-mono focus-visible:outline-2 focus-visible:outline-ring" />
            <button onClick={saveTime} data-testid="button-salvar-horario"
              className="rounded-xl bg-accent text-accent-foreground font-bold px-5 transition active:scale-95 hover:brightness-95 focus-visible:outline-2 focus-visible:outline-ring">Salvar</button>
          </div>
          <p role="status" className="h-5 mt-2 text-sm font-semibold text-primary flex items-center gap-1">
            {saved && <span className="pop flex items-center gap-1"><Check className="size-4" aria-hidden /> Horário salvo: {savedTime}</span>}
          </p>
          <p className="text-xs text-muted-foreground">O agendamento é simulado e só funciona no modo automático, com esta página aberta. Roda uma vez por dia e horário e nunca ignora a segurança de presença.</p>
        </section>

        <section aria-labelledby="h-sens" className={`${card} md:col-span-3`}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 id="h-sens" className="text-lg font-bold">Sensores</h2>
            <Tag>Valores simulados</Tag>
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-muted p-3"><dt className="text-xs flex justify-center gap-1 items-center"><Thermometer className="size-3.5" aria-hidden />DHT22 temp.</dt><dd className="font-mono text-xl font-semibold mt-1" data-testid="value-temp">{sensors.temp}°C</dd></div>
            <div className="rounded-xl bg-muted p-3"><dt className="text-xs flex justify-center gap-1 items-center"><Droplets className="size-3.5" aria-hidden />DHT22 umid.</dt><dd className="font-mono text-xl font-semibold mt-1" data-testid="value-hum">{sensors.hum}%</dd></div>
            <div className="rounded-xl bg-muted p-3"><dt className="text-xs flex justify-center gap-1 items-center"><Wind className="size-3.5" aria-hidden />MQ-135 bruto</dt><dd className="font-mono text-xl font-semibold mt-1" data-testid="value-mq">{sensors.mq}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">MQ-135: leitura analógica bruta, sem calibração. Não é ppm nem indicação de saúde.</p>
          <button onClick={refresh} data-testid="button-atualizar" className="mt-3 inline-flex items-center gap-2 rounded-xl border-2 border-input px-4 py-2 font-semibold transition active:scale-95 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
            <RefreshCw className="size-4" aria-hidden /> Atualizar leituras simuladas
          </button>
        </section>

        <section aria-labelledby="h-ev" className={`${card} md:col-span-6`}>
          <div className="flex items-center justify-between gap-2">
            <h2 id="h-ev" className="text-lg font-bold">Eventos recentes</h2>
            <Tag>Simulado</Tag>
          </div>
          <ol className="mt-3 max-h-80 overflow-auto divide-y divide-border" data-testid="list-events">
            {events.map((e) => (
              <li key={e.id} className="pop flex items-start gap-3 py-2">
                <span className={`mt-1.5 size-2.5 rounded-full shrink-0 ${kindCls[e.kind]}`} aria-hidden />
                <time className="font-mono text-xs text-muted-foreground pt-0.5 shrink-0">{e.t}</time>
                <span className={`text-sm ${e.kind === 'danger' ? 'font-semibold text-destructive' : ''}`}>{e.msg}</span>
              </li>
            ))}
          </ol>
        </section>
      </main>
      <footer className="max-w-5xl mx-auto px-4 mt-8 text-xs text-muted-foreground">
        Projeto didático. Sem backend, sem hardware e sem controle real de bomba.
      </footer>
    </div>
  );
}
