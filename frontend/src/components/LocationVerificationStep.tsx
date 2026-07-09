import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import * as Icons from 'lucide-react';
import api from '../services/api';

interface Props {
  email: string;
  password: string;
  rememberMe?: boolean;
  onSuccess: (tempToken: string, finalData?: any) => void;
  onPasswordError: () => void;
  onCancel: () => void;
}

type VerifyState =
  | 'requesting_gps'
  | 'gps_denied'
  | 'checking'
  | 'location_denied'
  | 'error';

export default function LocationVerificationStep({
  email,
  password,
  rememberMe,
  onSuccess,
  onPasswordError,
  onCancel
}: Props) {
  const [state, setState] = useState<VerifyState>('requesting_gps');
  const [errorMsg, setErrorMsg] = useState('');
  const [distance, setDistance] = useState<number | null>(null);
  const [allowedRadius, setAllowedRadius] = useState<number>(100);
  const hasFiredRef = useRef(false);

  useEffect(() => {
    if (!hasFiredRef.current) {
      hasFiredRef.current = true;
      requestGps();
    }
  }, []);

  const requestGps = () => {
    setState('requesting_gps');
    setErrorMsg('');
    setDistance(null);

    if (!navigator.geolocation) {
      setState('error');
      setErrorMsg('Geolocation is not supported by this browser. Please use a modern browser with location support.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        verifyWithBackend(latitude, longitude);
      },
      (geoErr) => {
        setState('gps_denied');
        switch (geoErr.code) {
          case geoErr.PERMISSION_DENIED:
            setErrorMsg(
              'Location permission was denied. Please allow location access in your browser settings and try again.'
            );
            break;
          case geoErr.POSITION_UNAVAILABLE:
            setErrorMsg(
              'Your current location could not be determined. Please check your GPS or network connection.'
            );
            break;
          case geoErr.TIMEOUT:
            setErrorMsg('Location request timed out. Please try again.');
            break;
          default:
            setErrorMsg('An unknown location error occurred. Please try again.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const verifyWithBackend = async (latitude: number, longitude: number) => {
    setState('checking');
    try {
      const res = await api.post('/auth/login', {
        email,
        password,
        latitude,
        longitude,
        rememberMe
      });

      if (res.data.mfaRequired && res.data.tempToken) {
        onSuccess(res.data.tempToken);
      } else if (res.data.token) {
        onSuccess('', res.data);
      }
    } catch (err: any) {
      const status = err.response?.status;
      const data = err.response?.data || {};

      if (status === 403 && data.code === 'LOCATION_MISMATCH') {
        setState('location_denied');
        setErrorMsg(data.error || 'You are not at the registered location.');
        setDistance(data.distance ?? null);
        setAllowedRadius(data.allowedRadius ?? 100);
      } else if (status === 401) {
        // Password was wrong — go back to credentials
        onPasswordError();
      } else {
        setState('error');
        setErrorMsg(data.error || 'Authentication failed. Please try again.');
      }
    }
  };

  // ─── Status icon by state ────────────────────────────────────────────────────
  const renderIcon = () => {
    if (state === 'requesting_gps') {
      return (
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 1.8, repeat: Infinity }}
          className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto"
        >
          <Icons.MapPin className="w-9 h-9 text-indigo-600" />
        </motion.div>
      );
    }
    if (state === 'checking') {
      return (
        <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto">
          <Icons.Loader2 className="w-9 h-9 text-indigo-600 animate-spin" />
        </div>
      );
    }
    if (state === 'location_denied') {
      return (
        <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto">
          <Icons.MapPinOff className="w-9 h-9 text-rose-500" />
        </div>
      );
    }
    return (
      <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto">
        <Icons.AlertTriangle className="w-9 h-9 text-amber-500" />
      </div>
    );
  };

  const renderTitle = () => {
    if (state === 'requesting_gps') return 'Requesting Location';
    if (state === 'checking') return 'Verifying Location';
    if (state === 'location_denied') return 'Location Mismatch';
    if (state === 'gps_denied') return 'Location Access Denied';
    return 'Verification Error';
  };

  const renderSubtitle = () => {
    if (state === 'requesting_gps') return 'Allow location access when your browser asks. This is required to verify you are at your registered location.';
    if (state === 'checking') return 'Comparing your current GPS position with your registered location...';
    return errorMsg;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 text-center"
    >
      {/* Step progress indicator */}
      <div className="flex items-center justify-center gap-2 text-xs text-slate-400 mb-2">
        <span className="flex items-center gap-1 text-emerald-600 font-semibold">
          <Icons.CheckCircle className="w-3.5 h-3.5" /> Credentials
        </span>
        <Icons.ChevronRight className="w-3.5 h-3.5 text-slate-300" />
        <span className="flex items-center gap-1 text-indigo-600 font-semibold">
          <Icons.MapPin className="w-3.5 h-3.5" /> Location
        </span>
        <Icons.ChevronRight className="w-3.5 h-3.5 text-slate-300" />
        <span className="text-slate-400">Face Scan</span>
      </div>

      {/* Icon */}
      {renderIcon()}

      {/* Title */}
      <div>
        <h3 className="text-lg font-bold text-slate-800 mt-4">{renderTitle()}</h3>
        <p className="text-sm text-slate-500 mt-1.5 max-w-[280px] mx-auto leading-relaxed">
          {renderSubtitle()}
        </p>
      </div>

      {/* Distance badge for location_denied */}
      {state === 'location_denied' && distance !== null && (
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 text-left mx-auto max-w-xs">
          <div className="flex justify-between text-xs mb-2">
            <span className="text-slate-500 font-medium">Your distance</span>
            <span className="font-bold text-rose-600">{distance}m away</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500 font-medium">Allowed radius</span>
            <span className="font-bold text-slate-700">{allowedRadius}m</span>
          </div>
          <div className="mt-3 w-full h-2 bg-rose-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-rose-500 rounded-full transition-all"
              style={{ width: `${Math.min(100, (allowedRadius / distance) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3">
        {/* Retry for GPS / error states */}
        {(state === 'gps_denied' || state === 'error') && (
          <button
            onClick={requestGps}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
          >
            <Icons.RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        )}

        {/* Location mismatch — can't retry, just inform */}
        {state === 'location_denied' && (
          <div className="text-xs text-slate-400 bg-slate-50 rounded-xl p-3 text-center">
            You must be within {allowedRadius}m of your registered location to log in.
            <br />
            Please move to your registered location and try again.
          </div>
        )}

        {/* Loading state — no actions */}
        {(state === 'requesting_gps' || state === 'checking') && (
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
            <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}

        {/* Cancel link */}
        <button
          onClick={onCancel}
          className="w-full py-2 text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          ← Cancel and return to login
        </button>
      </div>
    </motion.div>
  );
}
