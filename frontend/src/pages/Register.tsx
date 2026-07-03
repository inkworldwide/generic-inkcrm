import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function Register() {
  const navigate = useNavigate();

  const [companyName, setCompanyName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await api.post('/auth/register', {
        companyName,
        subdomain,
        firstName,
        lastName,
        email,
        password
      });

      setSuccess('Tenant Organization successfully created! Redirecting to login...');
      setTimeout(() => {
        // Cache the registration subdomain for branding lookup
        localStorage.setItem('tenantSubdomain', subdomain.toLowerCase());
        navigate('/login');
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed. Check your inputs.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4 py-12 relative overflow-hidden">
      
      {/* Background radial glows */}
      <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[60%] rounded-full bg-indigo-500/10 blur-[150px]"></div>
      <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[60%] rounded-full bg-indigo-500/10 blur-[150px]"></div>

      {/* Main card */}
      <div className="w-full max-w-xl p-8 rounded-2xl glass-panel relative z-10 text-white shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center font-bold text-2xl mx-auto mb-4 text-indigo-400">
            iC
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Register inkCRM Tenant</h2>
          <p className="text-sm text-slate-400 mt-2">Deploy your workspace CRM instantly</p>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium text-center">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 mb-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium text-center">
            {success}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Company Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Company Name</label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-slate-950/40 border border-slate-700/50 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                placeholder="Apex Industries"
              />
            </div>

            {/* Subdomain */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Subdomain</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                  className="w-full pl-4 pr-24 py-3 rounded-lg bg-slate-950/40 border border-slate-700/50 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  placeholder="apex"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500">
                  .inkcrm.com
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-700/50 my-6"></div>

          <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3">Super Admin Credentials</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* First Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">First Name</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-slate-950/40 border border-slate-700/50 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                placeholder="John"
              />
            </div>

            {/* Last Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Last Name</label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-slate-950/40 border border-slate-700/50 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                placeholder="Doe"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-slate-950/40 border border-slate-700/50 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              placeholder="admin@apex.com"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-slate-950/40 border border-slate-700/50 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-lg bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-500 active:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/10 mt-6 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              'Provision Organization'
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-slate-500">
          Already have a tenant? <a href="/login" className="text-indigo-400 hover:underline">Sign In</a>
        </div>
      </div>
    </div>
  );
}
