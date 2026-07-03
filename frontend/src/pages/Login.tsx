import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import * as Icons from 'lucide-react';
import api from '../services/api';
import loginLogo from '../assets/login-logo.png';
import FaceVerificationModal from '../components/FaceVerificationModal';
import FaceEnrollment from '../components/FaceEnrollment';

export default function Login() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const { branding, fetchBranding } = useThemeStore();

  const [isSignUpTab, setIsSignUpTab] = useState(false);
  
  // Login Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // Sign Up Form States
  const [companyName, setCompanyName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // 2FA / Face Auth state flow variables
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaMethod, setMfaMethod] = useState<'authenticator' | 'face' | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [tempToken, setTempToken] = useState('');
  // Initial load
  const [showEnrollmentSetup, setShowEnrollmentSetup] = useState(false);

  useEffect(() => {
    // If no subdomain is set in theme store, initialize with localstorage or 'sales'
    const activeSub = branding?.subdomain || localStorage.getItem('tenantSubdomain') || 'sales';
    fetchBranding(activeSub);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { email, password, rememberMe });
      
      if (res.data.mfaRequired) {
        setMfaRequired(true);
        setMfaMethod(res.data.method || 'authenticator');
        setTempToken(res.data.tempToken);
        setLoading(false);
        return;
      }

      // Legacy fallback in case server doesn't enforce mfa (it should now)
      setAuth(res.data.user, res.data.token, res.data.refreshToken);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Authentication credentials rejected.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUpInit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!companyName || !subdomain || !firstName || !lastName || !signUpEmail || !signUpPassword) {
      setError('All fields are required.');
      return;
    }
    
    // Switch to face enrollment UI
    setShowEnrollmentSetup(true);
  };

  const executeRegistration = async (faceEmbedding?: number[]) => {
    setError('');
    setSuccess('');
    setLoading(true);
    setShowEnrollmentSetup(false);

    try {
      await api.post('/auth/register', {
        companyName,
        subdomain: subdomain.toLowerCase(),
        firstName,
        lastName,
        email: signUpEmail.toLowerCase(),
        password: signUpPassword,
        faceEmbedding: faceEmbedding || undefined
      });

      setSuccess(faceEmbedding ? 'Workspace provisioned & face registered successfully! Logging in...' : 'Workspace provisioned successfully! Logging in...');
      localStorage.setItem('tenantSubdomain', subdomain.toLowerCase());
      await fetchBranding(subdomain.toLowerCase());
      
      // Auto-transition to login
      setTimeout(async () => {
        try {
          const res = await api.post('/auth/login', { email: signUpEmail, password: signUpPassword });
          setAuth(res.data.user, res.data.token, res.data.refreshToken);
          localStorage.setItem('user', JSON.stringify(res.data.user));
          navigate('/');
        } catch (e) {
          setIsSignUpTab(false);
          setEmail(signUpEmail);
          setPassword(signUpPassword);
          setSuccess('');
        }
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create workspace.');
      setLoading(false);
    }
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/verify-mfa', { code: mfaCode, tempToken });
      
      setAuth(res.data.user, res.data.token, res.data.refreshToken);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid 2FA passcode code.');
    } finally {
      setLoading(false);
    }
  };

  const activeBgStyle = {
    backgroundColor: 'rgb(var(--color-primary))'
  };

  const activeColorStyle = {
    color: 'rgb(var(--color-primary))'
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50/50 px-4 py-12 relative overflow-hidden font-sans">
      
      {/* Visual Backdrops & Design Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 pointer-events-none"></div>
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[55%] rounded-full bg-indigo-200/40 blur-[130px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[55%] rounded-full bg-emerald-100/40 blur-[130px] pointer-events-none"></div>

      {/* Face Auth Modal Overlay */}
      <AnimatePresence>
        {mfaRequired && mfaMethod === 'face' && (
          <FaceVerificationModal 
            tempToken={tempToken}
            onSuccess={(user, token, refreshToken) => {
              setAuth(user, token, refreshToken);
              localStorage.setItem('user', JSON.stringify(user));
              navigate('/');
            }}
            onCancel={() => {
              setMfaRequired(false);
              setMfaMethod(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Face Enrollment Setup Modal (Used for Sign Up) */}
      <AnimatePresence>
        {showEnrollmentSetup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"></div>
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="relative z-10 w-full max-w-lg"
            >
              <FaceEnrollment 
                mode="signup" 
                onSuccess={(embedding) => executeRegistration(embedding)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Centered Single Authentication Card */}
      <div className="w-full max-w-md bg-white border border-slate-200/80 p-8 rounded-2xl shadow-xl shadow-slate-200/50 relative z-10 text-slate-800 transition-all duration-300">
        
        {/* Header branding */}
        <div className="flex items-center justify-center mb-8">
          <img src={loginLogo} alt="Ink Worldwide" className="h-20 w-auto object-contain" />
        </div>

        {/* Banner message alerts */}
        {error && (
          <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-xs font-semibold text-center flex items-center gap-2 justify-center">
            <Icons.AlertCircle className="w-4 h-4 animate-pulse" />
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 mb-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs font-semibold text-center flex items-center gap-2 justify-center">
            <Icons.CheckCircle className="w-4 h-4 animate-bounce" />
            {success}
          </div>
        )}

        {!mfaRequired || mfaMethod === 'face' ? (
          <>
            {/* Custom Tab selectors */}
            <div className="flex bg-slate-100/80 p-1 rounded-xl mb-6">
              <button
                onClick={() => {
                  setIsSignUpTab(false);
                  setError('');
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  !isSignUpTab
                    ? 'bg-white text-slate-850 shadow-sm font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => {
                  setIsSignUpTab(true);
                  setError('');
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  isSignUpTab
                    ? 'bg-white text-slate-850 shadow-sm font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Register
              </button>
            </div>

            {!isSignUpTab ? (
              // --- LOGIN VIEW ---
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="text-left">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Email Address</label>
                  <div className="relative">
                    <Icons.Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      placeholder="ink@crm.com"
                    />
                  </div>
                </div>

                <div className="text-left">
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Password</label>
                    <a href="#" className="text-xs font-semibold hover:underline" style={activeColorStyle}>
                      Forgot Password?
                    </a>
                  </div>
                  <div className="relative">
                    <Icons.Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div className="flex items-center text-xs mt-3 select-none">
                  <label className="flex items-center gap-2 text-slate-400 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-slate-300 bg-slate-50 text-indigo-650 focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer"
                    />
                    Keep me signed in
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={activeBgStyle}
                  className="w-full py-3 rounded-xl text-white font-semibold text-sm hover:brightness-105 active:brightness-95 transition-all shadow-lg shadow-indigo-600/10 mt-6 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <Icons.ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Simple Credentials Note banner at the bottom */}
                <div className="mt-6 pt-6 border-t border-slate-100 text-xs text-slate-500 text-center space-y-1.5">
                  <p className="font-bold text-slate-700">Demo Sandbox Credentials</p>
                  <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-xl space-y-1 font-mono text-[11px] text-slate-600">
                    <div>Email: <span className="font-semibold text-indigo-600">ink@crm.com</span></div>
                    <div>Password: <span className="font-semibold text-indigo-600">password123</span></div>
                  </div>
                  <p className="text-[10px] text-slate-400">Enter these credentials to access the active Sales workspace.</p>
                </div>
              </form>
            ) : (
              // --- REGISTER VIEW ---
              <form onSubmit={handleSignUpInit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="text-left">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Company Name</label>
                    <div className="relative">
                      <Icons.Building className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        placeholder="Acme Inc"
                      />
                    </div>
                  </div>

                  <div className="text-left">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Subdomain</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={subdomain}
                        onChange={(e) => setSubdomain(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                        className="w-full pl-4 pr-24 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        placeholder="acme"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 bg-slate-100 py-1 px-2 rounded-lg">
                        .inkcrm.com
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="text-left">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">First Name</label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      placeholder="Sarah"
                    />
                  </div>
                  <div className="text-left">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Last Name</label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      placeholder="Connor"
                    />
                  </div>
                </div>

                <div className="text-left">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Admin Email</label>
                  <div className="relative">
                    <Icons.Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={signUpEmail}
                      onChange={(e) => setSignUpEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      placeholder="admin@acme.com"
                    />
                  </div>
                </div>

                <div className="text-left">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
                  <div className="relative">
                    <Icons.Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      required
                      value={signUpPassword}
                      onChange={(e) => setSignUpPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={activeBgStyle}
                  className="w-full py-3 rounded-xl text-white font-semibold text-sm hover:brightness-105 active:brightness-95 transition-all shadow-lg shadow-indigo-600/10 mt-6 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <span>Deploy CRM Workspace</span>
                  )}
                </button>
              </form>
            )}
          </>
        ) : (
          // --- MFA PASSCODE VIEW ---
          <form onSubmit={handleMfaVerify} className="space-y-4">
            <div className="text-left text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4 text-indigo-500">
                <Icons.Key className="w-5 h-5" />
              </div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Enter 6-Digit Verification Code</label>
              <input
                type="text"
                required
                maxLength={6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-800 text-center tracking-widest text-lg font-bold rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                placeholder="000000"
              />
              <p className="text-[10px] text-slate-400 mt-2">
                For verification testing, use passkey: <span className="font-semibold text-primary">123456</span>
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={activeBgStyle}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm hover:brightness-105 active:brightness-95 transition-all mt-6"
            >
              Verify Code & Enter
            </button>

            <button
              type="button"
              onClick={() => setMfaRequired(false)}
              className="w-full py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-semibold text-xs transition-colors"
            >
              Cancel
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
