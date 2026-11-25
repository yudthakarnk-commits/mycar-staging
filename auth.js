/* MYCAR sign-in with Supabase Auth GoTrue HTTP endpoints.
 * Frontend config contains only public publishable/anon keys. Passwords are NEVER stored here.
 * No authentication, user-creation or password checks are simulated locally.
 */
const AuthManager = (() => {
  const SESSION_KEY = 'mycar_auth_session_v1';
  const PROJECT_CONFIG_KEY = 'mycar_supabase_client_config_v1';
  let config = null;
  let session = null;
  let currentUser = null;
  let activeMode = 'signin';
  let onLogin = () => {};
  let onLogout = () => {};
  let inFlight = false;

  const el = (id) => document.getElementById(id);
  const setVisible = (id, visible) => { el(id).hidden = !visible; };

  function getProjectId() {
    try { return new URL(config?.url).hostname.toLowerCase(); }
    catch { return ''; }
  }

  function isSafePublicKey(key) {
    const value = String(key || '').trim();
    if (/sb_secret_|service_role|secret[_-]?key/i.test(value)) return false;
    // Modern public publishable keys, or legacy JWT anon key (validated for role).
    if (/^sb_publishable_[a-zA-Z0-9_-]{10,}$/.test(value)) return true;
    const parts = value.split('.');
    if (parts.length !== 3) return false;
    try {
      const payload = JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
      return payload.role === 'anon';
    } catch { return false; }
  }

  function parseConfig(url, key) {
    try {
      const parsed = new URL(String(url || '').trim());
      const local = ['localhost','127.0.0.1'].includes(parsed.hostname);
      if (!(parsed.protocol === 'https:' || (local && parsed.protocol === 'http:'))) return null;
      if (parsed.username || parsed.password || parsed.search || parsed.hash) return null;
      // Release candidates are fail-closed until an explicit build-time origin is provided.
      const expected = String(window.MYCAR_AUTH_CONFIG?.expectedOrigin || '').trim();
      if (!expected || parsed.origin !== expected || parsed.pathname !== '/') return null;
      if (!isSafePublicKey(key)) return null;
      return {url: parsed.href.replace(/\/+$/, ''), key:String(key).trim()};
    } catch { return null; }
  }

  function loadConfig() {
    const embedded = window.MYCAR_AUTH_CONFIG || {};
    const fromFile = parseConfig(embedded.supabaseUrl, embedded.supabasePublishableKey);
    if (fromFile) return fromFile;
    try {
      const saved = JSON.parse(localStorage.getItem(PROJECT_CONFIG_KEY) || 'null');
      return parseConfig(saved?.url, saved?.key);
    } catch { return null; }
  }

  function alertText(message, success=false) {
    const alert = el('auth-alert');
    alert.textContent = message;
    alert.classList.toggle('success', Boolean(success));
    alert.hidden = !message;
  }

  function setBusy(busy) {
    inFlight = busy;
    el('auth-submit').disabled = busy;
    const submit = el('auth-setup-form').querySelector('[type="submit"]');
    submit.disabled = busy;
    if (busy) alertText('Please wait…', true);
  }

  function setMode(mode) {
    activeMode = mode;
    alertText('');
    const opts = {
      signin: ['Sign in','Sign in to access your vehicle records.','Sign in'],
      signup: ['Create an account','Register with your email and a password.','Sign up'],
      reset: ['Reset password','We will email you a recovery link.','Send reset link'],
      update: ['Set a new password','Enter a new password to secure your account.','Save new password'],
      setup: ['Connect secure login','Enter the Supabase Auth project URL and PUBLIC publishable key to activate sign-in.','Save configuration']
    };
    const [title, subtitle, label] = opts[mode];
    el('auth-title').textContent = title;
    el('auth-subtitle').textContent = subtitle;
    el('auth-submit').textContent = label;
    setVisible('auth-mode-links', ['signin','signup'].includes(mode));
    setVisible('auth-form', mode !== 'setup');
    setVisible('auth-setup-form', mode === 'setup');
    setVisible('auth-email-group', mode !== 'update');
    setVisible('auth-password-group', !['reset','setup'].includes(mode));
    setVisible('auth-forgot', mode === 'signin');
    setVisible('auth-back', ['reset','update'].includes(mode));
    el('auth-tab-signin').classList.toggle('active',mode === 'signin');
    el('auth-tab-signup').classList.toggle('active',mode === 'signup');
    const password=el('auth-password');
    password.required=!['reset','setup'].includes(mode);
    password.minLength=mode === 'update'||mode === 'signup' ? 8 : 6;
    password.autocomplete=mode==='signin'?'current-password':'new-password';
    el('auth-password-label').textContent = mode === 'update' ? 'New password (8+ characters)' : 'Password';
  }

  function appRedirectURL() {
    return window.location.origin + window.location.pathname;
  }

  async function request(path, {method='POST', body=null, token=null}={}) {
    if (!config) throw new Error('Supabase Auth has not been configured.');
    const headers = {'apikey':config.key};
    if (body !== null) headers['Content-Type']='application/json';
    if (token) headers['Authorization']='Bearer '+token;
    let response;
    try {
      response = await fetch(config.url+path, {method,headers,body:body===null?undefined:JSON.stringify(body),cache:'no-store'});
    } catch(error) {
      throw new Error('Cannot reach the authentication server. Check your internet connection and project URL.');
    }
    const text=await response.text();
    let result;
    try { result=text ? JSON.parse(text) : {}; } catch { result={}; }
    if (!response.ok) {
      const message=result.msg||result.message||result.error_description||result.error||'Authentication request failed';
      const error=new Error(message);
      error.status=response.status;
      throw error;
    }
    return result;
  }

  function persistSession(payload) {
    if (!payload?.access_token || !payload?.refresh_token) throw new Error('No valid session was returned.');
    session={
      access_token:payload.access_token,
      refresh_token:payload.refresh_token,
      expires_at: Number(payload.expires_at)||Math.floor(Date.now()/1000)+(Number(payload.expires_in)||3600),
      project:getProjectId()
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function clearSession() {
    session=null;
    currentUser=null;
    localStorage.removeItem(SESSION_KEY);
  }

  async function ensureAccessToken() {
    if (!session || session.project !== getProjectId()) throw new Error('Session not found. Please sign in.');
    if (session.expires_at > Date.now()/1000+45) return session.access_token;
    const refreshed=await request('/auth/v1/token?grant_type=refresh_token',{body:{refresh_token:session.refresh_token}});
    persistSession(refreshed);
    return session.access_token;
  }

  async function getVerifiedUser() {
    let token=await ensureAccessToken();
    try {
      const user=await request('/auth/v1/user',{method:'GET',token});
      if (!user?.id || !/^[0-9a-f-]{36}$/i.test(user.id)) throw new Error('Invalid identity returned by authentication provider');
      return user;
    } catch(error) {
      if (error.status === 401 || error.status === 403) {
        const refreshed=await request('/auth/v1/token?grant_type=refresh_token',{body:{refresh_token:session.refresh_token}});
        persistSession(refreshed);
        const user=await request('/auth/v1/user',{method:'GET',token:session.access_token});
        if (!user?.id || !/^[0-9a-f-]{36}$/i.test(user.id)) throw new Error('Invalid user identity');
        return user;
      }
      throw error;
    }
  }

  async function enterApp() {
    const user=await getVerifiedUser();
    currentUser=user;
    el('auth-password').value='';
    onLogin(user);
  }

  async function submitAuth(event) {
    event.preventDefault();
    if (inFlight || !config) return;
    const email=el('auth-email').value.trim().toLowerCase();
    const password=el('auth-password').value;
    setBusy(true);
    try {
      if (activeMode === 'signin') {
        const data=await request('/auth/v1/token?grant_type=password',{body:{email,password}});
        persistSession(data);
        await enterApp();
      } else if (activeMode === 'signup') {
        if (password.length < 8) throw new Error('Please use at least 8 characters for your password.');
        const data=await request('/auth/v1/signup?redirect_to='+encodeURIComponent(appRedirectURL()),{body:{email,password}});
        if (data?.access_token && data?.refresh_token) {
          persistSession(data);
          await enterApp();
        } else {
          el('auth-password').value='';
          alertText('Registration request received. If required, check your email for the confirmation link before signing in.',true);
        }
      } else if (activeMode === 'reset') {
        await request('/auth/v1/recover?redirect_to='+encodeURIComponent(appRedirectURL()),{body:{email}});
        alertText('If this email has an account, a password reset link will be sent. Please check your inbox and spam folder.',true);
      } else if (activeMode === 'update') {
        if (password.length < 8) throw new Error('New password must contain at least 8 characters.');
        const token=await ensureAccessToken();
        await request('/auth/v1/user',{method:'PUT',token,body:{password}});
        await enterApp();
      }
    } catch(error) {
      alertText(error.message || 'Authentication failed.');
      if (activeMode === 'signin' && error.status===400) el('auth-password').value='';
    } finally {setBusy(false);}
  }

  async function setupAuth(event) {
    event.preventDefault();
    const candidate=parseConfig(el('auth-project-url').value, el('auth-project-key').value);
    if (!candidate) {
      alertText('Enter a valid HTTPS Project URL and a PUBLIC publishable/anon key. Never use a secret or service_role key.');
      return;
    }
    config=candidate;
    localStorage.setItem(PROJECT_CONFIG_KEY,JSON.stringify(config));
    clearSession();
    setMode('signin');
    alertText('Authentication settings saved. Sign in to continue.',true);
  }

  async function restoreAuth() {
    // Implicit email verification and recovery redirects can contain session tokens in URL hash.
    const hash=new URLSearchParams(window.location.hash.replace(/^#/,''));
    const hasAuthCallback=hash.has('access_token')||hash.has('error_description');
    if (hasAuthCallback) {
      history.replaceState(history.state,document.title,appRedirectURL()+window.location.search);
      if (hash.has('error_description')) {
        setMode('signin');
        alertText(hash.get('error_description'));
        return;
      }
      if (hash.has('access_token') && hash.has('refresh_token')) {
        try {
          persistSession({access_token:hash.get('access_token'),refresh_token:hash.get('refresh_token'),expires_in:hash.get('expires_in')});
          currentUser=await getVerifiedUser();
          if (hash.get('type') === 'recovery') {
            setMode('update');
            alertText('Recovery link accepted. Please choose your new password.',true);
            return;
          }
          onLogin(currentUser);
          return;
        } catch(error) {
          clearSession();
          alertText(error.message);
          return;
        }
      }
    }
    try {
      const stored=JSON.parse(localStorage.getItem(SESSION_KEY)||'null');
      if (!stored || stored.project !== getProjectId() || !stored.refresh_token || !stored.access_token) return;
      session=stored;
      await enterApp();
    } catch(error) {
      // On network errors keep refresh tokens for next online attempt, but never unlock offline.
      if (error.status===400 || error.status===401 || error.status===403) clearSession();
      alertText('Could not restore sign-in: '+error.message);
    }
  }

  async function signOut() {
    const oldSession=session;
    clearSession();
    onLogout();
    if (config && oldSession?.access_token) {
      try { await request('/auth/v1/logout',{token:oldSession.access_token}); }
      catch(error) { console.warn('Remote logout could not be completed; local session cleared.',error); }
    }
    setMode('signin');
    alertText('Signed out on this device.',true);
  }

  function showPasswordUpdate() {
    if (!currentUser || !session) return;
    if (typeof closeSettingsModal === 'function') closeSettingsModal();
    el('mycar-app-shell').hidden=true;
    el('auth-screen').hidden=false;
    setMode('update');
    alertText('Choose a new password. The current session must be valid.',true);
  }

  function init(callbacks) {
    onLogin=callbacks.onLogin;
    onLogout=callbacks.onLogout;
    config=loadConfig();
    // If the owner has provided the new project URL but not yet the PUBLIC key,
    // pre-fill the URL so each device only needs to provide its publishable key.
    el('auth-project-url').value=(config?.url || window.MYCAR_AUTH_CONFIG?.supabaseUrl || '');
    el('auth-project-key').value=(config?.key || window.MYCAR_AUTH_CONFIG?.supabasePublishableKey || '');
    el('auth-form').addEventListener('submit',submitAuth);
    el('auth-setup-form').addEventListener('submit',setupAuth);
    document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.mode)));
    el('auth-forgot').addEventListener('click',()=>setMode('reset'));
    el('auth-back').addEventListener('click',()=>{
      if(currentUser && activeMode==='update') { onLogin(currentUser); return; }
      setMode('signin');
    });
    el('auth-toggle-password').addEventListener('click',()=>{
      const input=el('auth-password');
      const next=input.type==='password'?'text':'password';
      input.type=next;
      el('auth-toggle-password').textContent=next==='password'?'Show':'Hide';
      el('auth-toggle-password').setAttribute('aria-label',next==='password'?'Show password':'Hide password');
    });
    setMode(config ? 'signin' : 'setup');
    if (config) restoreAuth();
  }

  return { init, signOut, showPasswordUpdate, getAccessToken:ensureAccessToken, get config(){return config;}, get projectId(){return getProjectId();}, get currentUser(){return currentUser;} };
})();
