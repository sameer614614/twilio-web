import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  BellRing,
  Mic,
  MicOff,
  Pause,
  PhoneIncoming,
  PhoneOff,
  PhoneOutgoing,
  Play,
  StickyNote,
  X
} from 'lucide-react';

import { Button } from '../components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { useAuth } from '../context/AuthContext';
import { useTwilioClient } from '../context/TwilioClientContext';
import { cn } from '../utils/cn';

const LIVE_CALL_STATES: string[] = ['active', 'connecting', 'ringing', 'held'];

export function DialerPage() {
  const { user } = useAuth();
  const {
    initializeClient,
    makeCall,
    hangUp,
    acceptIncomingCall,
    rejectIncomingCall,
    callState,
    connectionStatus,
    lastError,
    toggleMute,
    toggleHold,
    isMuted,
    isOnHold,
    isClientReady,
    sendDigits,
    incomingNumber,
    activeNumber,
    setCallNote
  } = useTwilioClient();

  const [destination, setDestination] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [callWindowRequested, setCallWindowRequested] = useState(false);
  const [isCallWindowOpen, setIsCallWindowOpen] = useState(false);
  const [dtmfSequence, setDtmfSequence] = useState('');

  const callWindowRef = useRef<Window | null>(null);
  const callWindowContainerRef = useRef<HTMLDivElement | null>(null);
  const callWindowCloseHandlerRef = useRef<() => void>();

  useEffect(() => {
    initializeClient().catch((err) => setError(err instanceof Error ? err.message : 'Unable to initialise Twilio client'));
  }, [initializeClient]);

  useEffect(() => {
    setCallNote(note);
  }, [note, setCallNote]);

  const closeCallWindow = useCallback(() => {
    const popup = callWindowRef.current;
    if (popup) {
      if (callWindowCloseHandlerRef.current) {
        popup.removeEventListener('beforeunload', callWindowCloseHandlerRef.current);
        callWindowCloseHandlerRef.current = undefined;
      }
      if (!popup.closed) {
        popup.close();
      }
    }
    callWindowRef.current = null;
    callWindowContainerRef.current = null;
    setIsCallWindowOpen(false);
  }, []);

  const openCallWindow = useCallback(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    if (callWindowRef.current && !callWindowRef.current.closed) {
      callWindowRef.current.focus();
      setIsCallWindowOpen(true);
      return;
    }

    const popup = window.open(
      '',
      'twilio-call',
      'width=420,height=620,left=120,top=120,resizable=no,scrollbars=no,toolbar=no,menubar=no,status=no'
    );

    if (!popup) {
      setIsCallWindowOpen(false);
      return;
    }

    popup.document.title = 'Twilio Call';
    popup.document.body.className = 'bg-slate-950 text-slate-100';
    popup.document.body.style.margin = '0';
    popup.document.body.style.padding = '0';

    const container = popup.document.createElement('div');
    container.id = 'twilio-call-root';
    popup.document.body.appendChild(container);
    copyStyles(document, popup.document);

    const handleUnload = () => {
      setCallWindowRequested(false);
      setIsCallWindowOpen(false);
    };

    popup.addEventListener('beforeunload', handleUnload);
    callWindowCloseHandlerRef.current = handleUnload;
    callWindowRef.current = popup;
    callWindowContainerRef.current = container;
    setIsCallWindowOpen(true);
    popup.focus();
  }, []);

  const isLiveCall = useMemo(() => LIVE_CALL_STATES.includes(callState), [callState]);

  useEffect(() => {
    if (isLiveCall && callWindowRequested) {
      openCallWindow();
    }
    if (!isLiveCall) {
      setCallWindowRequested(false);
      closeCallWindow();
    }
  }, [callWindowRequested, closeCallWindow, isLiveCall, openCallWindow]);

  useEffect(() => {
    if (!isCallWindowOpen || !callWindowRef.current) {
      return;
    }
    const popup = callWindowRef.current;
    const label = callState ? callState.charAt(0).toUpperCase() + callState.slice(1) : 'Twilio Call';
    popup.document.title = activeNumber ? `${label} • ${formatNumber(activeNumber)}` : label;
  }, [activeNumber, callState, isCallWindowOpen]);

  useEffect(
    () => () => {
      closeCallWindow();
    },
    [closeCallWindow]
  );

  useEffect(() => {
    if (callState === 'idle' || callState === 'completed' || callState === 'failed') {
      setNote('');
      setDtmfSequence('');
    }
  }, [callState]);

  const onCall = useCallback(async () => {
    if (!user) {
      setError('You must be signed in to place calls.');
      return;
    }

    if (!isClientReady) {
      setError('Waiting for Twilio device registration to finish.');
      return;
    }

    const trimmedDestination = destination.trim();
    if (!trimmedDestination) {
      setError('Enter a destination number.');
      return;
    }

    setError(null);
    setDtmfSequence('');
    setCallWindowRequested(true);
    openCallWindow();

    try {
      const success = await makeCall(trimmedDestination);
      if (!success) {
        setError('Unable to start call.');
        setCallWindowRequested(false);
        closeCallWindow();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start call');
      setCallWindowRequested(false);
      closeCallWindow();
    }
  }, [closeCallWindow, destination, isClientReady, makeCall, openCallWindow, user]);

  const onHangUp = useCallback(async () => {
    await hangUp();
    setCallWindowRequested(false);
    closeCallWindow();
  }, [closeCallWindow, hangUp]);

  const handleAcceptIncoming = useCallback(async () => {
    const success = await acceptIncomingCall();
    if (!success) {
      setError('Unable to accept incoming call.');
      return;
    }
    setCallWindowRequested(true);
    openCallWindow();
    setError(null);
  }, [acceptIncomingCall, openCallWindow]);

  const handleRejectIncoming = useCallback(async () => {
    const success = await rejectIncomingCall('Agent rejected call');
    if (!success) {
      setError('Unable to reject incoming call.');
    }
  }, [rejectIncomingCall]);

  const handleDigitPress = useCallback(
    async (value: string) => {
      if (!value) return;
      if (isLiveCall) {
        const sent = await sendDigits(value);
        if (sent) {
          setDtmfSequence((prev) => `${prev}${value}`);
        }
      } else {
        setDestination((prev) => `${prev}${value}`);
      }
    },
    [isLiveCall, sendDigits]
  );

  const handleBackspace = () => {
    if (isLiveCall) return;
    setDestination((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (isLiveCall) return;
    setDestination('');
  };

  const canCall = destination.trim().length > 0 && !isLiveCall && callState !== 'incoming' && isClientReady;
  const canControlCall = callState === 'active' || callState === 'held';
  const showIncomingActions = callState === 'incoming';

  const registrationTone = useMemo(() => {
    if (connectionStatus.state === 'registered') return 'text-emerald-400';
    if (connectionStatus.state === 'error') return 'text-red-400';
    if (connectionStatus.state === 'disconnected') return 'text-amber-400';
    if (connectionStatus.state === 'initialising') return 'text-amber-300';
    return 'text-slate-200';
  }, [connectionStatus.state]);

  const callStateTone = useMemo(() => {
    if (callState === 'active') return 'text-emerald-400';
    if (callState === 'connecting' || callState === 'ringing') return 'text-amber-300';
    if (callState === 'incoming') return 'text-amber-200';
    if (callState === 'held') return 'text-amber-300';
    if (callState === 'failed') return 'text-red-400';
    if (callState === 'completed') return 'text-slate-300';
    return 'text-slate-200';
  }, [callState]);

  const formattedCallState = callState ? callState.charAt(0).toUpperCase() + callState.slice(1) : 'Idle';

  const statusSummary = useMemo(
    () => [
      {
        label: 'Registration',
        tone: registrationTone,
        value: connectionStatus.message
      },
      {
        label: 'Call State',
        tone: callStateTone,
        value: formattedCallState
      },
      {
        label: 'Active Leg',
        value: activeNumber ? formatNumber(activeNumber) : 'None'
      },
      {
        label: 'Incoming Caller',
        value: incomingNumber ? formatNumber(incomingNumber) : 'None'
      },
      {
        label: 'Last Error',
        tone: lastError ? 'text-red-400' : undefined,
        value: lastError || 'None'
      }
    ],
    [activeNumber, callStateTone, connectionStatus.message, formattedCallState, incomingNumber, lastError, registrationTone]
  );

  const errorMessage = error ?? lastError;
  const notePlaceholder = callState === 'active' ? 'Add live call notes...' : 'Notes will attach to your next call';

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <section>
        <div className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-300 sm:grid-cols-2 lg:grid-cols-5">
          {statusSummary.map((item) => (
            <StatusSummaryCell key={item.label} label={item.label} tone={item.tone} value={item.value} />
          ))}
        </div>
      </section>

      {showIncomingActions ? (
        <div className="flex items-center justify-between rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
          <div className="flex items-center gap-3">
            <BellRing className="h-5 w-5" />
            <div>
              <p className="font-semibold">Incoming call</p>
              <p className="text-xs text-amber-200/90">{incomingNumber ? formatNumber(incomingNumber) : 'Unknown caller'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="gap-2" onClick={handleAcceptIncoming}>
              <PhoneIncoming className="h-4 w-4" />
              Accept
            </Button>
            <Button variant="destructive" className="gap-2" onClick={handleRejectIncoming}>
              <PhoneOff className="h-4 w-4" />
              Decline
            </Button>
          </div>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p>{errorMessage}</p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="space-y-5 p-5">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Destination</label>
              <Input
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
                placeholder="+12025550123"
                disabled={isLiveCall || callState === 'incoming'}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
              <CallControl
                label="Start Call"
                icon={<PhoneOutgoing className="h-5 w-5" />}
                disabled={!canCall}
                onClick={onCall}
                tone="start"
              />
              <CallControl
                label="End Call"
                icon={<PhoneOff className="h-5 w-5" />}
                disabled={!isLiveCall}
                onClick={onHangUp}
                tone="end"
                active={isLiveCall}
              />
              <CallControl
                label={isMuted ? 'Unmute' : 'Mute'}
                icon={isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                disabled={!canControlCall}
                onClick={() => toggleMute()}
                active={isMuted}
              />
              <CallControl
                label={isOnHold ? 'Resume' : 'Hold'}
                icon={isOnHold ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
                disabled={!canControlCall}
                onClick={() => toggleHold()}
                active={isOnHold}
              />
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Dial Pad</h3>
              <div className="mt-3">
                <Dialpad onDigitPress={handleDigitPress} disabledKeys={!isLiveCall} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>DTMF sent: {dtmfSequence || 'None'}</span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleBackspace} disabled={isLiveCall}>
                    Backspace
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleClear} disabled={isLiveCall}>
                    Clear
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <StickyNote className="h-4 w-4" />
              Call Notes
            </CardTitle>
            <CardDescription>Notes attach to the active call record and are visible in the admin console.</CardDescription>
          </CardHeader>
          <div className="flex flex-1 flex-col gap-4 px-6 pb-6">
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={notePlaceholder}
              className="min-h-[200px] flex-1 resize-none"
            />
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-400">
              <p className="font-semibold uppercase tracking-wide text-slate-500">Call context</p>
              <dl className="mt-3 space-y-2 text-slate-300">
                <StatusRow label="Active leg" value={activeNumber ? formatNumber(activeNumber) : 'None'} />
                <StatusRow label="Incoming caller" value={incomingNumber ? formatNumber(incomingNumber) : 'None'} />
                <StatusRow label="Registration" value={connectionStatus.message} />
              </dl>
            </div>
          </div>
        </Card>
      </div>

      {isCallWindowOpen && callWindowContainerRef.current
        ? createPortal(
            <CallWindowView
              destination={activeNumber || destination}
              callState={formattedCallState}
              dtmfSequence={dtmfSequence}
              onDigitPress={handleDigitPress}
              onHangUp={onHangUp}
              onToggleMute={() => toggleMute()}
              onToggleHold={() => toggleHold()}
              canControlCall={canControlCall}
              isMuted={isMuted}
              isOnHold={isOnHold}
              onClose={() => {
                setCallWindowRequested(false);
                closeCallWindow();
              }}
            />,
            callWindowContainerRef.current
          )
        : null}
    </div>
  );
}

function StatusSummaryCell({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div>
      <p className="text-[0.6rem] uppercase tracking-[0.3em] text-slate-500">{label}</p>
      <p className={cn('mt-2 text-sm font-medium text-slate-200', tone)}>{value}</p>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200">{value}</span>
    </div>
  );
}

function CallControl({
  label,
  icon,
  disabled,
  onClick,
  tone,
  active
}: {
  label: string;
  icon: ReactNode;
  disabled?: boolean;
  onClick: () => void;
  tone?: 'start' | 'end';
  active?: boolean;
}) {
  const toneClasses =
    tone === 'start'
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:border-emerald-500/70 hover:bg-emerald-500/20'
      : tone === 'end'
      ? 'border-red-500/40 bg-red-500/10 text-red-200 hover:border-red-500/70 hover:bg-red-500/20'
      : active
      ? 'border-brand/40 bg-brand/10 text-brand'
      : 'border-slate-800 bg-slate-900/70 text-slate-200 hover:border-brand/40 hover:bg-slate-900';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex h-12 flex-col items-center justify-center rounded-xl border text-[0.7rem] font-semibold uppercase tracking-wide transition sm:h-14',
        toneClasses,
        disabled ? 'cursor-not-allowed opacity-40 hover:border-transparent hover:bg-transparent hover:text-slate-400' : ''
      )}
    >
      <span className="mb-1 text-lg">{icon}</span>
      {label}
    </button>
  );
}

function Dialpad({ onDigitPress, disabledKeys }: { onDigitPress: (value: string) => Promise<void> | void; disabledKeys?: boolean }) {
  const keys = [
    { value: '1', letters: '' },
    { value: '2', letters: 'ABC' },
    { value: '3', letters: 'DEF' },
    { value: '4', letters: 'GHI' },
    { value: '5', letters: 'JKL' },
    { value: '6', letters: 'MNO' },
    { value: '7', letters: 'PQRS' },
    { value: '8', letters: 'TUV' },
    { value: '9', letters: 'WXYZ' },
    { value: '*', letters: '' },
    { value: '0', letters: '+' },
    { value: '#', letters: '' }
  ];

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {keys.map((key) => (
        <button
          key={key.value}
          type="button"
          className="flex h-11 flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900/70 text-slate-100 transition hover:border-brand/40 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50 sm:h-12"
          onClick={() => {
            void onDigitPress(key.value);
          }}
          disabled={disabledKeys}
        >
          <span className="text-lg font-semibold sm:text-xl">{key.value}</span>
          {key.letters ? <span className="text-[0.6rem] tracking-[0.2em] text-slate-500">{key.letters}</span> : null}
        </button>
      ))}
    </div>
  );
}

function CallWindowView({
  destination,
  callState,
  dtmfSequence,
  onDigitPress,
  onHangUp,
  onToggleMute,
  onToggleHold,
  canControlCall,
  isMuted,
  isOnHold,
  onClose
}: {
  destination: string;
  callState: string;
  dtmfSequence: string;
  onDigitPress: (value: string) => Promise<void> | void;
  onHangUp: () => void | Promise<void>;
  onToggleMute: () => void;
  onToggleHold: () => void;
  canControlCall: boolean;
  isMuted: boolean;
  isOnHold: boolean;
  onClose: () => void;
}) {
  const liveCall = LIVE_CALL_STATES.includes(callState.toLowerCase());

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 p-6 text-slate-100">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Active Call</p>
          <p className="mt-2 text-2xl font-semibold">{destination || 'Unknown number'}</p>
          <p className="mt-1 text-sm capitalize text-slate-400">{callState}</p>
          {dtmfSequence ? <p className="mt-2 text-xs text-slate-500">DTMF sent: {dtmfSequence}</p> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-2 text-slate-500 transition hover:bg-slate-800/80 hover:text-slate-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {!liveCall ? (
        <p className="mt-4 rounded-md border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-200">
          Waiting for the call to connect.
        </p>
      ) : null}
      <div className="mt-6 flex-1 space-y-6">
        <Dialpad onDigitPress={onDigitPress} disabledKeys={!liveCall} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Button variant="outline" className="flex-1 gap-2" disabled={!canControlCall} onClick={onToggleMute}>
            {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {isMuted ? 'Unmute' : 'Mute'}
          </Button>
          <Button variant="outline" className="flex-1 gap-2" disabled={!canControlCall} onClick={onToggleHold}>
            {isOnHold ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {isOnHold ? 'Resume' : 'Hold'}
          </Button>
        </div>
        <Button className="w-full gap-2" variant="destructive" onClick={onHangUp}>
          <PhoneOff className="h-4 w-4" />
          End Call
        </Button>
      </div>
    </div>
  );
}

function copyStyles(sourceDoc: Document, targetDoc: Document) {
  const head = targetDoc.head || targetDoc.getElementsByTagName('head')[0];
  if (!head) return;

  Array.from(sourceDoc.querySelectorAll('link[rel="stylesheet"], style')).forEach((node) => {
    head.appendChild(node.cloneNode(true));
  });
}

function formatNumber(value: string) {
  if (!value) return '';
  if (value.startsWith('+')) return value;
  if (value.startsWith('client:')) return value.replace(/^client:/i, 'client/');
  return value;
}
