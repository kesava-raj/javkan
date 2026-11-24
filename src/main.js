import Vapi from '@vapi-ai/web';

const $ = id => document.getElementById(id);
const cv = $('cv'), cx = cv.getContext('2d');
const log = $('log'), st = $('st'), tl = $('tl'), talk = $('talk'), mic = $('mic');
const callControls = $('call-controls'), muteBtn = $('mute-btn'), endBtn = $('end-btn');
const navCallBtn = $('nav-call-btn');

/* API Keys from .env */
const VAPI_KEY = import.meta.env.VITE_VAPI_PUBLIC_KEY;
const VAPI_AID = import.meta.env.VITE_VAPI_ASSISTANT_ID;

/* ---------- Analytics Tracking ---------- */
function getOrCreateVisitorId() {
  try {
    let vid = document.cookie.match(/(?:^|;\s*)javkan_vid=([^;]+)/)?.[1];
    if (!vid) {
      vid = 'v_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      document.cookie = `javkan_vid=${vid}; path=/; max-age=31536000; SameSite=Lax`;
    }
    return vid;
  } catch (_) {
    return 'anonymous';
  }
}

function trackEvent(event, target, details = {}) {
  try {
    const payload = {
      event,
      target,
      visitorId: getOrCreateVisitorId(),
      cookies: document.cookie || '',
      path: window.location.pathname || '/',
      referrer: document.referrer || '',
      timestamp: new Date().toISOString(),
      details
    };
    const dataStr = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/track', dataStr);
    } else {
      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: dataStr,
        keepalive: true
      }).catch(() => {});
    }
  } catch (_) {}
}

// Track page view on load
trackEvent('page_view', 'landing_page');

// Track link clicks
document.addEventListener('click', (e) => {
  const link = e.target.closest('a');
  if (link) {
    trackEvent('link_click', link.textContent.trim() || link.getAttribute('href'), {
      href: link.getAttribute('href')
    });
  }
});

/* ---------- Audio Canvas Orb Animation ---------- */
let W = 0, mode = 'idle', amp = 0.12, tgt = 0.12, t = 0, live = false, vol = 0;

function fit() {
  const d = window.devicePixelRatio || 1;
  const r = cv.getBoundingClientRect();
  W = r.width;
  cv.width = W * d;
  cv.height = W * d;
  cx.setTransform(d, 0, 0, d, 0, 0);
}
addEventListener('resize', fit);
fit();

const lv = { idle: 0.12, listen: 0.45, speak: 0.85 };

function draw() {
  t += 0.016;
  tgt = live
    ? (mode === 'speak' ? 0.2 + vol * 1.5 : 0.32 + Math.min(vol * 1.2, 0.4) + 0.06 * Math.sin(t * 3))
    : lv[mode] * (mode === 'idle' ? 1 : 0.65 + 0.35 * Math.abs(Math.sin(t * 5.3) * Math.cos(t * 2.1)));

  amp += (tgt - amp) * (live ? 0.25 : 0.08);
  cx.clearRect(0, 0, W, W);
  const c = W / 2, R = W * 0.3;

  let g = cx.createRadialGradient(c, c, R * 0.7, c, c, R * 1.7);
  g.addColorStop(0, 'rgba(74,63,255,' + (0.35 + amp * 0.3) + ')');
  g.addColorStop(1, 'rgba(74,63,255,0)');
  cx.fillStyle = g;
  cx.fillRect(0, 0, W, W);

  for (let k = 0; k < 7; k++) {
    cx.beginPath();
    for (let i = 0; i <= 140; i++) {
      const a = (i / 140) * Math.PI * 2;
      const w = Math.sin(a * 3 + t * (1 + k * 0.22) + k) * 0.5 + Math.sin(a * 5 - t * (0.8 + k * 0.1) + k * 2) * 0.5;
      const r = R + w * R * 0.14 * (0.3 + amp * 1.6) * (1 - k * 0.06);
      const x = c + Math.cos(a) * r;
      const y = c + Math.sin(a) * r;
      if (i === 0) cx.moveTo(x, y);
      else cx.lineTo(x, y);
    }
    cx.closePath();
    cx.strokeStyle = k < 2 ? 'rgba(255,255,255,.95)' : 'rgba(190,185,255,' + (0.5 - k * 0.05) + ')';
    cx.lineWidth = k < 2 ? 3 : 1.4;
    cx.shadowColor = '#6c63ff';
    cx.shadowBlur = 18 + amp * 22;
    cx.stroke();
  }
  cx.shadowBlur = 0;
  requestAnimationFrame(draw);
}
draw();

/* ---------- Live Voice Call Engine ---------- */
let vapi = null;
let busy = false;
let muted = false;
let curMsg = {};

function setIdle(msg) {
  live = false;
  busy = false;
  mode = 'idle';
  vol = 0;
  curMsg = {};
  muted = false;

  talk.disabled = false;
  talk.classList.remove('live');
  tl.textContent = 'Speak With Javkan';
  callControls.style.display = 'none';
  muteBtn.textContent = '🎙️ Mute microphone';
  st.textContent = msg || 'Call ended. Click to speak again.';
}

function appendTranscript(role, text, isFinal) {
  const isAi = role === 'assistant';
  const roleName = isAi ? 'Javkan' : 'You';
  const roleClass = isAi ? 'ai' : 'you';

  if (!curMsg[role]) {
    const m = document.createElement('div');
    m.className = 'msg ' + roleClass;
    m.innerHTML = '<small>' + roleName + '</small><p></p>';
    log.appendChild(m);
    curMsg[role] = m.querySelector('p');
  }

  curMsg[role].textContent = text;
  if (isFinal) {
    delete curMsg[role];
  }
  log.scrollTop = log.scrollHeight;
}

function initVapi() {
  const v = new Vapi(VAPI_KEY);

  v.on('call-start', () => {
    live = true;
    busy = false;
    talk.disabled = false;
    talk.classList.add('live');
    tl.textContent = 'End Call';
    mode = 'listen';
    callControls.style.display = 'flex';
    log.classList.add('on');
    st.textContent = 'Connected. Javkan is ready — speak into your microphone.';
    trackEvent('call_event', 'connected');
  });

  v.on('speech-start', () => {
    mode = 'speak';
    st.textContent = 'Javkan is speaking…';
  });

  v.on('speech-end', () => {
    mode = 'listen';
    vol = 0;
    st.textContent = 'Listening to you…';
  });

  v.on('volume-level', (level) => {
    vol = level || 0;
  });

  v.on('message', (m) => {
    if (!m) return;
    if (m.type === 'transcript' || (typeof m.type === 'string' && m.type.startsWith('transcript'))) {
      if (m.transcript) {
        const isFinal = m.transcriptType === 'final' || (m.type && m.type.includes('final'));
        appendTranscript(m.role || 'assistant', m.transcript, isFinal);
      }
    }
  });

  v.on('call-end', () => {
    setIdle('Call ended.');
    trackEvent('call_event', 'ended');
  });

  v.on('error', (err) => {
    console.error('Vapi Error:', err);
    setIdle('Call error: ' + (err?.error?.message || err?.message || 'Check your keys and mic permissions.'));
  });

  return v;
}

async function startVoiceCall() {
  if (busy) return;

  if (!VAPI_KEY || !VAPI_AID) {
    st.textContent = 'Vapi keys missing. Please verify .env file.';
    return;
  }

  busy = true;
  talk.disabled = true;
  tl.textContent = 'Connecting…';
  st.textContent = 'Requesting microphone permission…';

  // Request browser microphone permission
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
  } catch (err) {
    busy = false;
    talk.disabled = false;
    tl.textContent = 'Speak With Javkan';
    console.error('Microphone access denied:', err);
    st.textContent = 'Microphone permission denied. Please allow microphone access in your browser.';
    alert('Microphone access is required for the voice call. Please allow microphone permissions in your browser.');
    return;
  }

  st.textContent = 'Connecting to Javkan voice assistant…';
  log.innerHTML = '';
  curMsg = {};
  log.classList.add('on');

  try {
    if (!vapi) {
      vapi = initVapi();
    }
    await vapi.start(VAPI_AID);
  } catch (err) {
    console.error('Failed to start Vapi call:', err);
    setIdle('Could not connect: ' + (err?.message || 'Check your Vapi Assistant settings.'));
  }
}

function stopVoiceCall(source = 'button') {
  trackEvent('call_action', 'stop_call', { source });
  if (vapi && live) {
    vapi.stop();
  }
}

function toggleVoiceCall(source = 'button') {
  trackEvent('click', source);
  if (live) {
    stopVoiceCall(source);
  } else {
    startVoiceCall();
  }
}

talk.onclick = () => toggleVoiceCall('speak_with_javkan_button');
mic.onclick = () => toggleVoiceCall('orb_mic_button');
endBtn.onclick = () => stopVoiceCall('end_call_button');
if (navCallBtn) navCallBtn.onclick = () => toggleVoiceCall('nav_start_voice_call_button');

muteBtn.onclick = () => {
  if (!vapi || !live) return;
  muted = !muted;
  vapi.setMuted(muted);
  muteBtn.textContent = muted ? '🔇 Unmute microphone' : '🎙️ Mute microphone';
  trackEvent('click', 'mute_toggle_button', { muted });
};
