import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Device } from '@twilio/voice-sdk';
import { useAuth } from './AuthContext';
import { createUserCallLog, finalizeUserCallLog } from '../services/userCallLogs';

type TwilioDeviceInstance = InstanceType<typeof Device>;
type TwilioConnectionInstance = ReturnType<TwilioDeviceInstance['connect']>;

type ConnectionState =
  | 'idle'
  | 'initialising'
  | 'registered'
  | 'error'
  | 'disconnected';

type CallState =
  | 'idle'
  | 'connecting'
  | 'ringing'
  | 'incoming'
  | 'active'
  | 'held'
  | 'completed'
  | 'failed';

type EventEntry = {
  id: string;
  at: number;
  message: string;
};

type TwilioContextValue = {
  connectionStatus: { state: ConnectionState; message: string };
  callState: CallState;
  events: EventEntry[];
  isClientReady: boolean;
  isMuted: boolean;
  isOnHold: boolean;
  lastError: string | null;
  incomingNumber: string | null;
  activeNumber: string | null;
  initializeClient: () => Promise<TwilioDeviceInstance>;
  makeCall: (destination: string) => Promise<boolean>;
  acceptIncomingCall: () => Promise<boolean>;
  rejectIncomingCall: (reason?: string) => Promise<boolean>;
  hangUp: () => Promise<void>;
  toggleMute: () => Promise<boolean>;
  toggleHold: () => Promise<boolean>;
  sendDigits: (digits: string) => Promise<boolean>;
  setCallNote: (note: string) => void;
  resetEvents: () => void;
};

const MAX_EVENT_ENTRIES = 100;
const INITIAL_CONNECTION_STATUS = { state: 'idle' as ConnectionState, message: 'Twilio client not initialised' };
const SERVER_URL = (import.meta.env.VITE_TWILIO_SERVER_URL ?? 'http://localhost:3001').replace(/\/+$/, '');

const TwilioContext = createContext<TwilioContextValue | undefined>(undefined);

function sanitizeIdentity(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.replace(/[^a-zA-Z0-9_\-@.]/g, '_');
}

function normalisePhoneNumber(value: string | null | undefined) {
  if (!value) return null;
  const digits = value.replace(/[^0-9+]/g, '');
  if (!digits) return null;
  if (digits.startsWith('+')) return digits;
  return `+${digits}`;
}

async function fetchAccessToken(identity: string) {
  const response = await fetch(`${SERVER_URL}/api/twilio/token?identity=${encodeURIComponent(identity)}`);
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Twilio token request failed');
    throw new Error(errorText || `Unable to fetch Twilio token (status ${response.status})`);
  }
  return response.json() as Promise<{ token: string; identity: string; expiresIn?: number }>;
}

function attachOnce(connection: TwilioConnectionInstance, event: string, handler: (...args: unknown[]) => void) {
  const wrapped = (...args: unknown[]) => {
    if (typeof connection.off === 'function') {
      connection.off(event as never, wrapped as never);
    } else if (typeof connection.removeListener === 'function') {
      connection.removeListener(event as never, wrapped as never);
    }
    handler(...args);
  };
  connection.on(event as never, wrapped as never);
}

export function TwilioClientProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState(INITIAL_CONNECTION_STATUS);
  const [callState, setCallState] = useState<CallState>('idle');
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [isClientReady, setIsClientReady] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [incomingNumber, setIncomingNumber] = useState<string | null>(null);
  const [activeNumber, setActiveNumber] = useState<string | null>(null);

  const identityRef = useRef('agent');
  const deviceRef = useRef<TwilioDeviceInstance | null>(null);
  const activeConnectionRef = useRef<TwilioConnectionInstance | null>(null);
  const incomingConnectionRef = useRef<TwilioConnectionInstance | null>(null);
  const tokenRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeLogIdRef = useRef<string | null>(null);
  const activeCallStartedAtRef = useRef<number | null>(null);
  const callNoteRef = useRef<string>('');

  const pushEvent = useCallback((message: string) => {
    setEvents((prev) => {
      const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2);
      const next = [{ id, at: Date.now(), message }, ...prev];
      return next.slice(0, MAX_EVENT_ENTRIES);
    });
  }, []);

  const clearDevice = useCallback(() => {
    const device = deviceRef.current;
    if (device) {
      try {
        device.removeAllListeners();
        device.destroy();
      } catch (error) {
        console.error('Failed to destroy Twilio device', error);
      }
    }
    deviceRef.current = null;
    activeConnectionRef.current = null;
    incomingConnectionRef.current = null;
    if (tokenRefreshTimerRef.current) {
      clearTimeout(tokenRefreshTimerRef.current);
      tokenRefreshTimerRef.current = null;
    }
    setIsClientReady(false);
    setConnectionStatus({ state: 'disconnected', message: 'Twilio client disconnected' });
  }, []);

  useEffect(() => {
    return () => {
      clearDevice();
    };
  }, [clearDevice]);

  const scheduleTokenRefresh = useCallback((expiresInSeconds?: number, identity?: string) => {
    if (tokenRefreshTimerRef.current) {
      clearTimeout(tokenRefreshTimerRef.current);
    }
    if (!expiresInSeconds || expiresInSeconds <= 0) {
      return;
    }
    const refreshInMs = Math.max((expiresInSeconds - 120) * 1000, 30_000); // refresh ~2 minutes early
    tokenRefreshTimerRef.current = setTimeout(async () => {
      try {
        const device = deviceRef.current;
        if (!device) return;
        const identityFallback = identity ?? identityRef.current ?? 'agent';
        const tokenResponse = await fetchAccessToken(identityFallback);
        await device.updateToken(tokenResponse.token);
        identityRef.current = tokenResponse.identity ?? identityFallback;
        scheduleTokenRefresh(tokenResponse.expiresIn, tokenResponse.identity);
        pushEvent('Twilio token refreshed');
      } catch (error) {
        console.error('Twilio token refresh failed', error);
        pushEvent('Twilio token refresh failed');
      }
    }, refreshInMs);
  }, [pushEvent]);

  const finalizeActiveLog = useCallback(
    async (status: 'completed' | 'failed' | 'cancelled', extra?: Record<string, unknown>) => {
      if (!user || !activeLogIdRef.current) {
        return;
      }
      const logId = activeLogIdRef.current;
      activeLogIdRef.current = null;
      const startedAt = activeCallStartedAtRef.current;
      activeCallStartedAtRef.current = null;
      const note = callNoteRef.current.trim();
      callNoteRef.current = '';
      const durationSeconds = startedAt ? Math.max(Math.round((Date.now() - startedAt) / 1000), 0) : 0;
      try {
        await finalizeUserCallLog(user.uid, logId, {
          status,
          durationSeconds,
          ...(note ? { note } : {}),
          ...extra
        });
      } catch (error) {
        console.error('Failed to finalise call log', error);
        pushEvent('Unable to update call log with final status');
      }
    },
    [pushEvent, user]
  );

  const initializeClient = useCallback(async (): Promise<TwilioDeviceInstance> => {
    if (!user) {
      throw new Error('Twilio client requires an authenticated user');
    }

    if (deviceRef.current && isClientReady) {
      return deviceRef.current;
    }

    if (deviceRef.current) {
      clearDevice();
    }

    const identity = sanitizeIdentity(user.email ?? user.uid ?? 'agent', 'agent');
    identityRef.current = identity;

    setConnectionStatus({ state: 'initialising', message: 'Initialising Twilio device' });
    pushEvent(`Requesting Twilio token for ${identity}`);

    const tokenResponse = await fetchAccessToken(identity);
    identityRef.current = tokenResponse.identity ?? identity;

    const device = new Device(tokenResponse.token, {
      codecPreferences: ['opus', 'pcmu'],
      logLevel: 'error',
      fakeLocalDTMF: true
    });

    device.on('ready', () => {
      setConnectionStatus({ state: 'registered', message: 'Twilio device ready' });
      setIsClientReady(true);
      pushEvent('Twilio device ready');
    });

    device.on('error', (error) => {
      const message = typeof error?.message === 'string' ? error.message : 'Twilio device error';
      setConnectionStatus({ state: 'error', message });
      setLastError(message);
      pushEvent(`Device error: ${message}`);
    });

    device.on('disconnect', () => {
      setConnectionStatus({ state: 'disconnected', message: 'Twilio device disconnected' });
      setIsClientReady(false);
      pushEvent('Twilio device disconnected');
    });

    device.on('tokenWillExpire', async () => {
      try {
        pushEvent('Twilio token expiring soon, refreshing');
        const identityToRefresh = identityRef.current ?? identity;
        const fresh = await fetchAccessToken(identityToRefresh);
        await device.updateToken(fresh.token);
        identityRef.current = fresh.identity ?? identityToRefresh;
        scheduleTokenRefresh(fresh.expiresIn, fresh.identity);
      } catch (error) {
        console.error('Failed to refresh token on expiry event', error);
        pushEvent('Twilio token refresh failed on expiry event');
      }
    });

    device.on('incoming', (connection) => {
      incomingConnectionRef.current = connection;
      setCallState('incoming');
      const caller = normalisePhoneNumber(connection.parameters?.From) ?? connection.parameters?.From ?? null;
      setIncomingNumber(caller);
      setActiveNumber(null);
      setIsMuted(false);
      setIsOnHold(false);
      setLastError(null);
      callNoteRef.current = '';
      pushEvent(`Incoming call from ${caller ?? 'unknown'}`);
      attachOnce(connection, 'cancel', () => {
        pushEvent('Incoming call cancelled by remote party');
        if (incomingConnectionRef.current === connection) {
          incomingConnectionRef.current = null;
          setCallState('idle');
          setIncomingNumber(null);
        }
      });
      attachOnce(connection, 'reject', () => {
        pushEvent('Incoming call rejected');
        if (incomingConnectionRef.current === connection) {
          incomingConnectionRef.current = null;
          setCallState('idle');
          setIncomingNumber(null);
        }
      });
    });

    device.on('connect', (connection) => {
      activeConnectionRef.current = connection;
      setCallState('active');
      setIsMuted(connection.isMuted?.() ?? false);
      setIsOnHold(connection.isOnHold?.() ?? false);
      setLastError(null);
      setIncomingNumber(null);
      activeCallStartedAtRef.current = Date.now();
      const to = connection.parameters?.To ?? activeNumber;
      setActiveNumber(to ?? null);
      pushEvent(`Call connected with ${to ?? 'unknown destination'}`);
      attachOnce(connection, 'disconnect', () => {
        pushEvent('Call disconnected');
        activeConnectionRef.current = null;
        setCallState('completed');
        setIsMuted(false);
        setIsOnHold(false);
        setActiveNumber(null);
        finalizeActiveLog('completed');
      });
      attachOnce(connection, 'error', (error) => {
        const message = typeof error?.message === 'string' ? error.message : 'Call error';
        pushEvent(`Call error: ${message}`);
        setLastError(message);
        finalizeActiveLog('failed', { statusReason: message });
      });
    });

    deviceRef.current = device;

    scheduleTokenRefresh(tokenResponse.expiresIn, tokenResponse.identity);

    await device.register();

    return device;
  }, [
    clearDevice,
    finalizeActiveLog,
    isClientReady,
    pushEvent,
    scheduleTokenRefresh,
    user
  ]);

  const makeCall = useCallback(
    async (destination: string) => {
      if (!user) {
        throw new Error('You must be signed in to place calls');
      }
      const trimmedDestination = destination.trim();
      if (!trimmedDestination) {
        setLastError('Enter a number to call');
        return false;
      }

      const device = await initializeClient();
      const normalisedDestination = trimmedDestination.startsWith('+') ? trimmedDestination : trimmedDestination.replace(/[^0-9+]/g, '');

      callNoteRef.current = '';

      setCallState('connecting');
      setActiveNumber(normalisedDestination);
      setIsMuted(false);
      setIsOnHold(false);
      setIncomingNumber(null);
      setLastError(null);

      try {
        const logId = await createUserCallLog(user.uid, {
          to: normalisedDestination,
          direction: 'outbound'
        });
        activeLogIdRef.current = logId;
      } catch (error) {
        console.error('Failed to create call log', error);
      }

      pushEvent(`Dialling ${normalisedDestination}`);

      const connection = device.connect({
        params: {
          To: normalisedDestination
        }
      });

      activeConnectionRef.current = connection;

      attachOnce(connection, 'ringing', () => {
        setCallState('ringing');
        pushEvent('Call ringing');
      });

      attachOnce(connection, 'cancel', () => {
        pushEvent('Call cancelled');
        setCallState('failed');
        finalizeActiveLog('cancelled');
      });

      attachOnce(connection, 'reject', () => {
        pushEvent('Call rejected by Twilio');
        setCallState('failed');
        finalizeActiveLog('failed', { statusReason: 'rejected' });
      });

      attachOnce(connection, 'error', (error) => {
        const message = typeof error?.message === 'string' ? error.message : 'Call error';
        setLastError(message);
        setCallState('failed');
        pushEvent(`Call error: ${message}`);
        finalizeActiveLog('failed', { statusReason: message });
      });

      return true;
    },
    [finalizeActiveLog, initializeClient, pushEvent, user]
  );

  const hangUp = useCallback(async () => {
    const device = deviceRef.current;
    const connection = activeConnectionRef.current;
    if (connection) {
      connection.disconnect();
    }
    if (device) {
      device.disconnectAll();
    }
    finalizeActiveLog('completed');
    setCallState('idle');
    setIsMuted(false);
    setIsOnHold(false);
    setActiveNumber(null);
    setIncomingNumber(null);
    callNoteRef.current = '';
    return;
  }, [finalizeActiveLog]);

  const acceptIncomingCall = useCallback(async () => {
    const incomingConnection = incomingConnectionRef.current;
    if (!incomingConnection) {
      return false;
    }
    const device = await initializeClient();
    if (!device) return false;

    try {
      await incomingConnection.accept();
      activeConnectionRef.current = incomingConnection;
      incomingConnectionRef.current = null;
      const fromNumber = normalisePhoneNumber(incomingConnection.parameters?.From) ?? incomingConnection.parameters?.From ?? null;
      setActiveNumber(fromNumber);
      setIncomingNumber(null);
      setCallState('active');
      setIsMuted(incomingConnection.isMuted?.() ?? false);
      setIsOnHold(incomingConnection.isOnHold?.() ?? false);
      pushEvent(`Accepted incoming call from ${fromNumber ?? 'unknown'}`);
      callNoteRef.current = '';
      if (user) {
        try {
          const logId = await createUserCallLog(user.uid, {
            direction: 'inbound',
            from: fromNumber ?? undefined,
            status: 'active'
          });
          activeLogIdRef.current = logId;
        } catch (error) {
          console.error('Failed to create inbound call log', error);
        }
      }
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to answer call';
      setLastError(message);
      pushEvent(`Unable to accept call: ${message}`);
      return false;
    }
  }, [initializeClient, pushEvent, user]);

  const rejectIncomingCall = useCallback(async (reason?: string) => {
    const incomingConnection = incomingConnectionRef.current;
    if (!incomingConnection) {
      return false;
    }
    try {
      incomingConnection.reject();
      incomingConnectionRef.current = null;
      setCallState('idle');
      setIncomingNumber(null);
      pushEvent(`Rejected incoming call${reason ? `: ${reason}` : ''}`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reject call';
      setLastError(message);
      pushEvent(`Unable to reject call: ${message}`);
      return false;
    }
  }, [pushEvent]);

  const toggleMute = useCallback(async () => {
    const connection = activeConnectionRef.current;
    if (!connection) return false;
    const nextMuted = !(connection.isMuted?.() ?? isMuted);
    try {
      connection.mute(nextMuted);
      setIsMuted(nextMuted);
      pushEvent(nextMuted ? 'Call muted' : 'Call unmuted');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to toggle mute';
      setLastError(message);
      pushEvent(`Mute toggle failed: ${message}`);
      return false;
    }
  }, [isMuted, pushEvent]);

  const toggleHold = useCallback(async () => {
    const connection = activeConnectionRef.current;
    if (!connection) return false;
    const nextHold = !(connection.isOnHold?.() ?? isOnHold);
    try {
      if (typeof connection.hold === 'function') {
        connection.hold(nextHold);
      } else {
        throw new Error('Hold is not supported for this call');
      }
      setIsOnHold(nextHold);
      pushEvent(nextHold ? 'Call placed on hold' : 'Call resumed');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to toggle hold';
      setLastError(message);
      pushEvent(`Hold toggle failed: ${message}`);
      return false;
    }
  }, [isOnHold, pushEvent]);

  const sendDigits = useCallback(async (digits: string) => {
    const connection = activeConnectionRef.current;
    if (!connection) return false;
    const cleaned = typeof digits === 'string' ? digits.replace(/[^0-9A-D#*]/gi, '') : '';
    if (!cleaned) return false;
    try {
      connection.sendDigits(cleaned);
      pushEvent(`Sent DTMF ${cleaned}`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send tones';
      setLastError(message);
      pushEvent(`DTMF failed: ${message}`);
      return false;
    }
  }, [pushEvent]);

  const setCallNote = useCallback((note: string) => {
    callNoteRef.current = typeof note === 'string' ? note : '';
  }, []);

  const resetEvents = useCallback(() => {
    setEvents([]);
  }, []);

  const value = useMemo<TwilioContextValue>(
    () => ({
      connectionStatus,
      callState,
      events,
      isClientReady,
      isMuted,
      isOnHold,
      lastError,
      incomingNumber,
      activeNumber,
      initializeClient,
      makeCall,
      acceptIncomingCall,
      rejectIncomingCall,
      hangUp,
      toggleMute,
      toggleHold,
      sendDigits,
      setCallNote,
      resetEvents
    }),
    [
      acceptIncomingCall,
      activeNumber,
      callState,
      connectionStatus,
      events,
      hangUp,
      incomingNumber,
      initializeClient,
      isClientReady,
      isMuted,
      isOnHold,
      lastError,
      makeCall,
      rejectIncomingCall,
      resetEvents,
      setCallNote,
      sendDigits,
      toggleHold,
      toggleMute
    ]
  );

  return <TwilioContext.Provider value={value}>{children}</TwilioContext.Provider>;
}

export function useTwilioClient() {
  const context = useContext(TwilioContext);
  if (!context) {
    throw new Error('useTwilioClient must be used within a TwilioClientProvider');
  }
  return context;
}
