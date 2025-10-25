import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { SwEvent, TelnyxRTC } from '@telnyx/webrtc';

import { useAuth } from './AuthContext';
import { getTelnyxClientConfig } from '../lib/telnyxConfig';

const TelnyxContext = createContext(undefined);

const MAX_EVENT_ENTRIES = 100;

const GATEWAY_STATE_MAP = {
  REGED: { state: 'registered', message: 'Registered with Telnyx' },
  TRYING: { state: 'registering', message: 'Registering with Telnyx…' },
  REGISTER: { state: 'registering', message: 'Sending Telnyx registration request…' },
  UNREGED: { state: 'disconnected', message: 'Registration not active' },
  UNREGISTER: { state: 'disconnected', message: 'Unregistered from Telnyx' },
  NOREG: { state: 'disconnected', message: 'Not registered with Telnyx' },
  FAILED: { state: 'error', message: 'Registration failed' },
  FAIL_WAIT: { state: 'error', message: 'Registration failed – retrying' },
  EXPIRED: { state: 'disconnected', message: 'Registration expired' }
};

const INITIAL_CONNECTION_STATUS = { state: 'idle', message: 'Not connected' };

function normalizeCallState(state) {
  const value = coerceString(state);
  if (!value) {
    return null;
  }

  const normalized = value.toLowerCase();

  if (['hangup', 'destroy', 'destroyed', 'ended', 'disconnected'].includes(normalized)) {
    return 'ended';
  }

  if (['active', 'answered', 'up'].includes(normalized)) {
    return 'active';
  }

  if (['held', 'hold', 'on_hold', 'onhold'].includes(normalized)) {
    return 'held';
  }

  if (['ringing', 'progress', 'progress_media'].includes(normalized)) {
    return 'ringing';
  }

  if (['trying', 'initiating', 'connecting'].includes(normalized)) {
    return 'connecting';
  }

  if (['error', 'failed', 'rejected', 'busy'].includes(normalized)) {
    return 'error';
  }

  return value;
}

function coerceString(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return null;
}

function tryGetGatewayState(notification) {
  if (!notification || typeof notification !== 'object') {
    return null;
  }

  const candidates = [
    notification?.payload?.params?.state,
    notification?.payload?.params?.status,
    notification?.payload?.params?.gateway_state,
    notification?.payload?.gateway_state,
    notification?.payload?.state,
    notification?.params?.state,
    notification?.params?.gateway_state,
    notification?.gateway_state,
    notification?.state
  ];

  for (const candidate of candidates) {
    const value = coerceString(candidate);
    if (value) {
      return value;
    }
  }

  return null;
}

function tryGetStatusCode(notification) {
  if (!notification || typeof notification !== 'object') {
    return null;
  }

  const candidates = [
    notification?.payload?.params?.code,
    notification?.payload?.code,
    notification?.code,
    notification?.error?.code
  ];

  for (const candidate of candidates) {
    const value = coerceString(candidate);
    if (value) {
      return value;
    }
  }

  return null;
}

function formatNotification(notification) {
  const type = coerceString(notification?.type) ?? 'unknown';

  if (type === 'callUpdate') {
    const callState = coerceString(notification?.call?.state) ?? 'unknown';
    const callDirection = coerceString(notification?.call?.direction);
    return `Call ${callState}${callDirection ? ` (${callDirection})` : ''}`;
  }

  const gatewayState = tryGetGatewayState(notification);
  if (gatewayState) {
    return `Gateway state: ${gatewayState}`;
  }

  if (type === 'userMediaError') {
    const mediaError = coerceString(notification?.error?.message) ?? 'Media device error';
    return `Media error: ${mediaError}`;
  }

  return `Notification: ${type}`;
}

export function TelnyxClientProvider({ children }) {
  const { user } = useAuth();
  const [client, setClient] = useState(null);
  const [callState, setCallState] = useState('idle');
  const [profile, setProfile] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState(INITIAL_CONNECTION_STATUS);
  const [lastError, setLastError] = useState(null);
  const [events, setEvents] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [isClientReady, setIsClientReady] = useState(false);
  const clientRef = useRef(null);
  const callRef = useRef(null);
  const callCleanupRef = useRef(null);
  const callIdRef = useRef(null);
  const initializingRef = useRef(false);
  const readyPromiseRef = useRef(null);
  const readyResolveRef = useRef(null);
  const readyRejectRef = useRef(null);

  const pushEvent = useCallback((entry) => {
    setEvents((prev) => [entry, ...prev.slice(0, MAX_EVENT_ENTRIES - 1)]);
  }, []);

  const cleanupReadyPromise = useCallback(() => {
    readyPromiseRef.current = null;
    readyResolveRef.current = null;
    readyRejectRef.current = null;
  }, []);

  const resolveReadyPromise = useCallback(() => {
    if (readyResolveRef.current) {
      const resolve = readyResolveRef.current;
      resolve();
    }
    cleanupReadyPromise();
  }, [cleanupReadyPromise]);

  const rejectReadyPromise = useCallback(
    (error) => {
      if (readyRejectRef.current) {
        const reject = readyRejectRef.current;
        reject(error instanceof Error ? error : new Error(String(error ?? 'Telnyx client initialisation failed')));
      }
      cleanupReadyPromise();
    },
    [cleanupReadyPromise]
  );

  const ensureReadyPromise = useCallback(() => {
    if (!readyPromiseRef.current) {
      readyPromiseRef.current = new Promise((resolve, reject) => {
        readyResolveRef.current = resolve;
        readyRejectRef.current = reject;
      });
    }

    return readyPromiseRef.current;
  }, []);

  const detachCallListeners = useCallback(() => {
    if (typeof callCleanupRef.current === 'function') {
      try {
        callCleanupRef.current();
      } catch (error) {
        console.error('Failed to detach Telnyx call listeners', error);
      }
    }
    callCleanupRef.current = null;
  }, []);

  const resetClientState = useCallback(() => {
    setClient(null);
    setCallState('idle');
    setProfile(null);
    setConnectionStatus({ ...INITIAL_CONNECTION_STATUS });
    setLastError(null);
    setEvents([]);
    setIsMuted(false);
    setIsOnHold(false);
    setIsClientReady(false);
    detachCallListeners();
    callRef.current = null;
    callIdRef.current = null;
    rejectReadyPromise(new Error('Telnyx client reset'));
  }, [detachCallListeners, rejectReadyPromise]);

  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
      detachCallListeners();
      rejectReadyPromise(new Error('Telnyx client provider unmounted'));
    };
  }, [detachCallListeners, rejectReadyPromise]);

  useEffect(() => {
    if (!user) {
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
      resetClientState();
    }
  }, [resetClientState, user]);

  const updateGatewayStatus = useCallback(
    (rawState) => {
      const normalized = coerceString(rawState);
      if (!normalized) return;

      const upper = normalized.toUpperCase();
      const mapped = GATEWAY_STATE_MAP[upper] ?? {
          state: 'info',
          message: `Gateway status: ${upper}`
        };

      setConnectionStatus(mapped);
      pushEvent(`Gateway → ${mapped.message}`);
    },
    [pushEvent]
  );

  const handleClientError = useCallback(
    (event) => {
      let message = 'Unknown Telnyx client error';

      if (typeof event === 'string') {
        message = event;
      } else if (event && typeof event === 'object') {
        const errorMessage =
          coerceString(event.message) ?? coerceString(event.error && event.error.message);
        if (errorMessage) {
          message = errorMessage;
        }
      }

      console.error('Telnyx client error', event);
      setLastError(message);
      setConnectionStatus({ state: 'error', message });
      setIsClientReady(false);
      pushEvent(`Error: ${message}`);
      rejectReadyPromise(new Error(message));
    },
    [pushEvent, rejectReadyPromise]
  );

  const handleNotification = useCallback(
    (notification) => {
      pushEvent(formatNotification(notification));

      const gatewayState = tryGetGatewayState(notification);
      if (gatewayState) {
        updateGatewayStatus(gatewayState);
      }

      const statusCode = tryGetStatusCode(notification);
      if (statusCode && (statusCode === '401' || statusCode === '403')) {
        const message =
          statusCode === '401'
            ? 'Unauthorized: verify the SIP username and password.'
            : 'Forbidden: confirm the SIP connection permissions.';
        setLastError(message);
        setConnectionStatus({ state: 'error', message });
        setIsClientReady(false);
        pushEvent(`Authorization error (${statusCode})`);
        rejectReadyPromise(new Error(message));
      }

      const messageText = coerceString(notification?.payload?.message) ?? coerceString(notification?.message);
      if (messageText && messageText.toLowerCase().includes('unauthor')) {
        const message = 'Unauthorized: verify the SIP credentials.';
        setLastError(message);
        setConnectionStatus({ state: 'error', message });
        setIsClientReady(false);
        pushEvent(`Authorization error: ${messageText}`);
        rejectReadyPromise(new Error(message));
      }

      if (notification?.type === 'callUpdate') {
        const candidateCall =
          notification?.call ??
          notification?.payload?.call ??
          notification?.payload?.params ??
          notification?.payload;

        const notificationCallId =
          coerceString(candidateCall?.call_id) ??
          coerceString(candidateCall?.callId) ??
          coerceString(candidateCall?.id) ??
          coerceString(notification?.call_id);

        const matchesCurrentCall =
          !callIdRef.current || !notificationCallId || callIdRef.current === notificationCallId;

        if (matchesCurrentCall) {
          const callStateUpdate = candidateCall?.state ?? notification?.call?.state;
          const normalizedState = normalizeCallState(callStateUpdate);

          if (normalizedState) {
            setCallState(normalizedState);

            if (normalizedState === 'held') {
              setIsOnHold(true);
            } else if (normalizedState === 'active') {
              setIsOnHold(false);
            }

            if (normalizedState === 'ended' || normalizedState === 'error') {
              detachCallListeners();
              callRef.current = null;
              callIdRef.current = null;
              setIsMuted(false);
              setIsOnHold(false);
            }
          }
        }
      }

      if (notification?.type === 'userMediaError' && notification?.error) {
        const message =
          notification.error?.message || 'Browser could not access microphone or speaker devices.';
        setLastError(message);
      }
    },
    [detachCallListeners, pushEvent, rejectReadyPromise, updateGatewayStatus]
  );

  const attachCallListeners = useCallback(
    (call) => {
      if (!call || typeof call.on !== 'function') {
        return;
      }

      detachCallListeners();

      const handleStateChanged = (payload = {}) => {
        const nextState = normalizeCallState(payload.state ?? call.state);
        if (!nextState) {
          return;
        }

        setCallState(nextState);

        if (nextState === 'held') {
          setIsOnHold(true);
        } else if (nextState === 'active') {
          setIsOnHold(false);
        }

        if (nextState === 'ended' || nextState === 'error') {
          detachCallListeners();
          callRef.current = null;
          callIdRef.current = null;
          setIsMuted(false);
          setIsOnHold(false);
        }
      };

      const handleHangup = () => {
        handleStateChanged({ state: 'ended' });
      };

      const handleError = (error) => {
        handleClientError(error);
        handleStateChanged({ state: 'error' });
      };

      call.on('stateChanged', handleStateChanged);
      call.on('hangup', handleHangup);
      call.on('destroy', handleHangup);
      call.on('destroyed', handleHangup);
      call.on('error', handleError);

      callCleanupRef.current = () => {
        if (typeof call.off === 'function') {
          call.off('stateChanged', handleStateChanged);
          call.off('hangup', handleHangup);
          call.off('destroy', handleHangup);
          call.off('destroyed', handleHangup);
          call.off('error', handleError);
        }
      };
    },
    [detachCallListeners, handleClientError]
  );

  const initializeClient = useCallback(
    async () => {
      if (!user) {
        throw new Error('User must be authenticated');
      }

      if (clientRef.current) {
        if (isClientReady) {
          return clientRef.current;
        }

        if (readyPromiseRef.current) {
          await readyPromiseRef.current;
        }

        return clientRef.current;
      }

      if (initializingRef.current && readyPromiseRef.current) {
        await readyPromiseRef.current;
        return clientRef.current;
      }

      initializingRef.current = true;
      setIsClientReady(false);
      setConnectionStatus({ state: 'connecting', message: 'Authorizing SIP credentials…' });

      const readyPromise = ensureReadyPromise();

      try {
        const { profile: profileData, profileId, clientConfig } = await getTelnyxClientConfig(user.uid);
        setProfile({ ...profileData, id: profileId });
        setLastError(null);
        pushEvent('Loaded SIP profile from Firestore');

        const telnyxClient = new TelnyxRTC({
          ...clientConfig,
        });

        telnyxClient.remoteElement = 'telnyx-remote-audio';
        telnyxClient.localElement = 'telnyx-local-audio';

        telnyxClient.on(SwEvent.SocketOpen, () => {
          setConnectionStatus({ state: 'connecting', message: 'Socket connected – waiting for register…' });
          pushEvent('Socket connected');
        });

        telnyxClient.on(SwEvent.SocketClose, () => {
          setConnectionStatus({ state: 'disconnected', message: 'Socket closed' });
          setIsClientReady(false);
          rejectReadyPromise(new Error('Telnyx socket closed'));
          ensureReadyPromise();
          pushEvent('Socket closed');
        });

        telnyxClient.on(SwEvent.SocketError, handleClientError);
        telnyxClient.on(SwEvent.Error, handleClientError);
        telnyxClient.on(SwEvent.Notification, handleNotification);
        telnyxClient.on(SwEvent.Ready, () => {
          setCallState('idle');
          setConnectionStatus({ state: 'registered', message: 'Registered with Telnyx' });
          setIsClientReady(true);
          pushEvent('Telnyx client ready');
          resolveReadyPromise();
        });

        clientRef.current = telnyxClient;
        setClient(telnyxClient);

        pushEvent('Attempting Telnyx registration');
        const connectResult = telnyxClient.connect?.();

        if (connectResult instanceof Promise) {
          await connectResult;
        }

        if (typeof telnyxClient.login === 'function') {
          pushEvent('Authenticating Telnyx session');
          const loginResult = telnyxClient.login();
          if (loginResult instanceof Promise) {
            await loginResult;
          }
        }

        await readyPromise;

        return telnyxClient;
      } catch (error) {
        const normalizedError =
          error instanceof Error ? error : new Error('Unable to initialise Telnyx client');
        rejectReadyPromise(normalizedError);
        setLastError(normalizedError.message);
        setConnectionStatus({ state: 'error', message: normalizedError.message });
        pushEvent(`Initialization error: ${normalizedError.message}`);

        if (clientRef.current) {
          clientRef.current.disconnect?.();
          clientRef.current = null;
          setClient(null);
        }

        setIsClientReady(false);
        detachCallListeners();
        callRef.current = null;
        callIdRef.current = null;

        throw normalizedError;
      } finally {
        initializingRef.current = false;
      }
    },
    [
      detachCallListeners,
      ensureReadyPromise,
      handleClientError,
      handleNotification,
      isClientReady,
      pushEvent,
      rejectReadyPromise,
      resolveReadyPromise,
      user,
    ]
  );

  const makeCall = useCallback(
    async (destination) => {
      const telnyxClient = await initializeClient();
      if (!telnyxClient) {
        throw new Error('Telnyx client is not initialized');
      }

      const trimmed = destination.trim();
      if (!trimmed) {
        throw new Error('Destination number is required');
      }

      if (callRef.current) {
        detachCallListeners();
        callRef.current = null;
        callIdRef.current = null;
      }

      setLastError(null);
      setCallState('connecting');
      setIsMuted(false);
      setIsOnHold(false);

      try {
        const call = telnyxClient.newCall({
          destinationNumber: trimmed,
          remoteElement: 'telnyx-remote-audio',
          localElement: 'telnyx-local-audio'
        });

        callRef.current = call;
        callIdRef.current =
          coerceString(call?.callId) ?? coerceString(call?.call_id) ?? coerceString(call?.id) ?? null;

        attachCallListeners(call);

        const initialState = normalizeCallState(call?.state) ?? 'connecting';
        setCallState(initialState);
        pushEvent(`Dialing ${trimmed}`);
      } catch (error) {
        console.error(error);
        setCallState('error');
        handleClientError(error);
        throw (error instanceof Error ? error : new Error('Unable to start call'));
      }
    },
    [attachCallListeners, detachCallListeners, handleClientError, initializeClient, pushEvent]
  );

  const hangUp = useCallback(() => {
    try {
      callRef.current?.hangup?.();
    } catch (error) {
      handleClientError(error);
    }
    detachCallListeners();
    callRef.current = null;
    callIdRef.current = null;
    setCallState('ended');
    setIsMuted(false);
    setIsOnHold(false);
  }, [detachCallListeners, handleClientError]);

  useEffect(() => {
    if (callState === 'idle' || callState === 'ended' || callState === 'error') {
      setIsMuted(false);
      setIsOnHold(false);
    }
  }, [callState]);

  const resetEvents = useCallback(() => setEvents([]), []);

  const toggleMute = useCallback(() => {
    if (!callRef.current) return;
    try {
      if (isMuted) {
        callRef.current.unmuteAudio?.();
        setIsMuted(false);
        pushEvent('Unmuted microphone');
      } else {
        callRef.current.muteAudio?.();
        setIsMuted(true);
        pushEvent('Muted microphone');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to toggle mute';
      setLastError(message);
      pushEvent(`Call control error: ${message}`);
    }
  }, [isMuted, pushEvent]);

  const toggleHold = useCallback(async () => {
    if (!callRef.current) return;
    try {
      if (isOnHold) {
        await callRef.current.unhold?.();
        setIsOnHold(false);
        setCallState('active');
        pushEvent('Resumed call');
      } else {
        await callRef.current.hold?.();
        setIsOnHold(true);
        setCallState('held');
        pushEvent('Placed call on hold');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to change hold state';
      setLastError(message);
      pushEvent(`Call control error: ${message}`);
    }
  }, [isOnHold, pushEvent]);

  const sendDigits = useCallback((digits) => {
    const call = callRef.current;
    if (!call) {
      return false;
    }

    const tone = typeof digits === 'string' ? digits.replace(/[^0-9ABCD#*]/gi, '') : '';
    if (!tone) {
      return false;
    }

    try {
      if (typeof call.dtmf === 'function') {
        call.dtmf({ digits: tone });
        pushEvent(`Sent DTMF ${tone}`);
        return true;
      }

      if (typeof call.sendDigits === 'function') {
        call.sendDigits(tone);
        pushEvent(`Sent DTMF ${tone}`);
        return true;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to send tone';
      setLastError(message);
      pushEvent(`Call control error: ${message}`);
    }

    return false;
  }, [pushEvent]);

  const value = useMemo(
    () => ({
      client,
      callState,
      events,
      profile,
      connectionStatus,
      lastError,
      isMuted,
      isOnHold,
      isClientReady,
      initializeClient,
      makeCall,
      hangUp,
      resetEvents,
      toggleMute,
      toggleHold,
      sendDigits
    }),
    [
      client,
      callState,
      connectionStatus,
      events,
      hangUp,
      isMuted,
      isOnHold,
      isClientReady,
      initializeClient,
      lastError,
      makeCall,
      profile,
      resetEvents,
      sendDigits,
      toggleHold,
      toggleMute
    ]
  );

  return <TelnyxContext.Provider value={value}>{children}</TelnyxContext.Provider>;
}

export function useTelnyxClient() {
  const context = useContext(TelnyxContext);
  if (!context) {
    throw new Error('useTelnyxClient must be used within a TelnyxClientProvider');
  }
  return context;
}
