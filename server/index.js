import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { twiml, jwt } from 'twilio';

const app = express();
const port = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const {
  AccessToken
} = jwt;
const {
  VoiceResponse
} = twiml;

function ensureEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

function isE164(value) {
  return typeof value === 'string' && /^\+?[1-9]\d{6,14}$/.test(value);
}

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', service: 'twilio-voice' });
});

app.get('/api/twilio/token', (req, res) => {
  try {
    const accountSid = ensureEnv('TWILIO_ACCOUNT_SID');
    const apiKeySid = ensureEnv('TWILIO_API_KEY_SID');
    const apiKeySecret = ensureEnv('TWILIO_API_KEY_SECRET');
    const twimlAppSid = ensureEnv('TWILIO_TWIML_APP_SID');
    const defaultIdentity = process.env.TWILIO_DEFAULT_CLIENT_IDENTITY ?? 'agent';

    const identityParam = typeof req.query.identity === 'string' ? req.query.identity.trim() : '';
    const identity = identityParam.length > 0 ? identityParam : defaultIdentity;

    const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
      identity,
      ttl: 55 * 60 // 55 minutes
    });

    token.addGrant(
      new AccessToken.VoiceGrant({
        outgoingApplicationSid: twimlAppSid,
        incomingAllow: true
      })
    );

    res.json({
      identity,
      token: token.toJwt(),
      expiresIn: token.ttl ?? 55 * 60
    });
  } catch (error) {
    console.error('Failed to mint Twilio access token', error);
    res.status(500).json({
      error: 'Unable to mint Twilio access token',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post('/api/twilio/voice', (req, res, next) => {
  try {
    const response = new VoiceResponse();
    const to = typeof req.body.To === 'string' ? req.body.To.trim() : '';
    const callerId = ensureEnv('TWILIO_CALLER_ID');
    const defaultIdentity = process.env.TWILIO_DEFAULT_CLIENT_IDENTITY ?? 'agent';
    const statusCallback = process.env.TWILIO_STATUS_CALLBACK_URL;
    const recordingCallback = process.env.TWILIO_RECORDING_STATUS_URL ?? statusCallback;

    const dial = response.dial({
      callerId,
      answerOnBridge: true,
      record: 'record-from-answer-dual',
      statusCallback: statusCallback || undefined,
      statusCallbackEvent: statusCallback ? 'initiated ringing answered completed' : undefined,
      statusCallbackMethod: statusCallback ? 'POST' : undefined,
      recordingStatusCallback: recordingCallback || undefined,
      recordingStatusCallbackEvent: recordingCallback ? 'completed,failed,absent' : undefined
    });

    if (to && !to.startsWith('client:') && isE164(to)) {
      dial.number({}, to.startsWith('+') ? to : `+${to}`);
    } else if (to) {
      const clientIdentity = to.replace(/^client:/i, '');
      dial.client(clientIdentity || defaultIdentity);
    } else {
      dial.client(defaultIdentity);
    }

    res.type('text/xml');
    res.send(response.toString());
  } catch (error) {
    next(error);
  }
});

app.post('/api/twilio/status', (req, res) => {
  console.log('Twilio call status event', {
    callSid: req.body.CallSid,
    parentCallSid: req.body.ParentCallSid,
    callStatus: req.body.CallStatus,
    direction: req.body.Direction,
    to: req.body.To,
    from: req.body.From,
    timestamp: new Date().toISOString()
  });
  res.status(204).end();
});

app.post('/api/twilio/recording', (req, res) => {
  console.log('Twilio recording event', {
    callSid: req.body.CallSid,
    recordingSid: req.body.RecordingSid,
    status: req.body.RecordingStatus,
    duration: req.body.RecordingDuration,
    url: req.body.RecordingUrl,
    timestamp: new Date().toISOString()
  });
  res.status(204).end();
});

app.use((error, _req, res, _next) => {
  console.error('Unhandled server error', error);
  res.status(500).json({ error: 'Server error' });
});

app.listen(port, () => {
  console.log(`Twilio voice server listening on port ${port}`);
});
