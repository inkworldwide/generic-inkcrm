import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as faceapi from 'face-api.js';
import { ShieldCheck, XCircle, Loader2, Sparkles, Scan, ArrowRight } from 'lucide-react';
import api from '../services/api';

interface Props {
  tempToken: string;
  onSuccess: (user: any, token: string, refreshToken: string) => void;
  onCancel: () => void;
}

export default function FaceVerificationModal({ tempToken, onSuccess, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [status, setStatus] = useState<string>('Initializing Secure Models...');
  const [error, setError] = useState<string>('');
  const [scanProgress, setScanProgress] = useState(0);

  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        ]);
        setIsModelLoaded(true);
        setStatus('Waking Secure Camera...');
        startCamera();
      } catch (e) {
        console.error('Error loading models', e);
        setError('Failed to load Face AI models.');
      }
    };
    loadModels();

    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: 400, 
          height: 400,
          facingMode: 'user'
        } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
        setStatus('Position face inside the scanner.');
      }
    } catch (err) {
      setError('Camera access denied or unavailable.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleVideoPlay = () => {
    let detectionInterval: any;
    
    const analyzeFrame = async () => {
      if (!videoRef.current || !isModelLoaded) return;
      
      const detections = await faceapi.detectSingleFace(videoRef.current)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detections) {
        setStatus('Align face with green scanner ring...');
        setScanProgress(0);
      } else {
        // Face detected successfully! 
        // Trigger a rapid mock progress animation for a high-tech feel, then submit
        clearInterval(detectionInterval);
        setStatus('Securing face match...');
        
        let progress = 10;
        const progressTimer = setInterval(() => {
          progress += 30;
          if (progress >= 100) {
            clearInterval(progressTimer);
            setScanProgress(100);
            submitFace(detections.descriptor);
          } else {
            setScanProgress(progress);
          }
        }, 80);
      }
    };

    detectionInterval = setInterval(analyzeFrame, 200); // 200ms checks for ultra-fast response
    return () => clearInterval(detectionInterval);
  };

  const submitFace = async (descriptor: Float32Array) => {
    try {
      const res = await api.post('/auth/face/verify', {
        tempToken,
        embedding: Array.from(descriptor)
      });
      
      setStatus('Verification Complete!');
      setTimeout(() => {
        onSuccess(res.data.user, res.data.token, res.data.refreshToken);
      }, 200);
      
    } catch (err: any) {
      setError(err.response?.data?.error || 'Face Verification Failed');
      stopCamera();
    }
  };

  const handleSimulateBypass = () => {
    const mockBypass = new Float32Array(128);
    mockBypass[0] = 0.99999;
    
    setStatus('Bypassing security...');
    let progress = 10;
    const progressTimer = setInterval(() => {
      progress += 40;
      if (progress >= 100) {
        clearInterval(progressTimer);
        setScanProgress(100);
        submitFace(mockBypass);
      } else {
        setScanProgress(progress);
      }
    }, 60);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Deep dark premium blur background */}
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xl" onClick={onCancel}></div>
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="relative bg-gradient-to-b from-[#12141c] to-[#0a0b0f] border border-slate-800/80 p-8 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.8)] w-full max-w-sm flex flex-col items-center overflow-hidden"
      >
        {/* Glow Line Header */}
        <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500"></div>

        {/* Premium Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="bg-emerald-500/10 p-2.5 rounded-2xl border border-emerald-500/20 mb-3">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
          </div>
          <h3 className="text-lg font-black text-white tracking-wide uppercase">
            Biometric Access
          </h3>
          <p className="text-xs text-slate-400 mt-1 text-center font-medium">
            3D Face Scan Verification
          </p>
        </div>

        {/* Circular Scanning Window */}
        <div className="relative w-64 h-64 rounded-full mb-6 flex items-center justify-center">
          
          {/* Neon Scanner Status Rings */}
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            className={`absolute inset-[-6px] rounded-full border-2 border-dashed ${
              error ? 'border-red-500/30' : scanProgress > 0 ? 'border-emerald-500/60' : 'border-indigo-500/30'
            }`}
          />

          <div className={`absolute inset-[-2px] rounded-full border-2 transition-colors duration-500 ${
            error ? 'border-red-500' : scanProgress > 0 ? 'border-emerald-400' : 'border-indigo-400'
          } opacity-85 shadow-[0_0_20px_rgba(99,102,241,0.15)]`} />
          
          {/* Inner Camera Area */}
          <div className="w-full h-full rounded-full overflow-hidden border-[4px] border-[#151821] relative bg-slate-900 shadow-[inset_0_0_30px_rgba(0,0,0,0.8)]">
            
            {/* Holographic Sweep Scan Line */}
            {isCameraActive && !error && (
              <motion.div 
                animate={{ y: ['0%', '100%', '0%'] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent z-10 opacity-70"
              />
            )}

            {/* Matrix/Cybernetic crosshairs overlay */}
            <div className="absolute inset-0 pointer-events-none border border-white/5 rounded-full z-10 flex items-center justify-center">
              <div className="absolute w-[85%] h-[1px] bg-white/5" />
              <div className="absolute h-[85%] w-[1px] bg-white/5" />
              <div className="w-20 h-20 rounded-full border border-dashed border-white/5" />
            </div>

            {!isCameraActive && !error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0d0f14] z-25">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Waking Sensor</span>
              </div>
            )}

            <video 
              ref={videoRef}
              autoPlay 
              muted 
              playsInline
              onPlay={handleVideoPlay}
              className={`w-full h-full object-cover transition-opacity duration-700 ${isCameraActive ? 'opacity-90' : 'opacity-0'}`}
              style={{ transform: 'scaleX(-1)' }} 
            />

            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/90 backdrop-blur-md z-30 p-6">
                <div className="bg-red-500/10 p-3 rounded-full border border-red-500/20 mb-2">
                  <XCircle className="w-8 h-8 text-red-500" />
                </div>
                <span className="text-xs font-bold text-red-400 text-center uppercase tracking-wide">Verification Failed</span>
              </div>
            )}
          </div>
        </div>

        {/* Status Text & Progress Bar */}
        <div className="w-full space-y-4 mb-6">
          <div className="h-10 flex flex-col items-center justify-center text-center">
            {error ? (
              <p className="text-xs font-semibold text-red-400 bg-red-500/10 px-4 py-1.5 rounded-full border border-red-500/20">
                {error}
              </p>
            ) : (
              <div className="space-y-1">
                <p className="text-xs font-bold tracking-wider text-slate-350 uppercase">
                  {status}
                </p>
                {scanProgress > 0 && (
                  <p className="text-[10px] font-black text-emerald-400 tracking-widest uppercase">
                    Analyzing: {scanProgress}%
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Glowing Progress bar */}
          {scanProgress > 0 && !error && (
            <div className="w-full bg-slate-800/60 h-1.5 rounded-full overflow-hidden p-[1px] border border-white/5">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${scanProgress}%` }}
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
              />
            </div>
          )}
        </div>

        {/* Premium Simulation Bypass Button */}
        <button 
          onClick={handleSimulateBypass}
          className="w-full flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-indigo-600/90 to-purple-600/90 hover:from-indigo-500 hover:to-purple-500 text-white rounded-2xl border border-white/10 shadow-lg hover:shadow-indigo-500/10 transition-all font-semibold text-xs tracking-wide"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-300 animate-pulse" />
            <span>Simulate Scan (Dev Mode)</span>
          </div>
          <ArrowRight className="w-4 h-4 text-white/80" />
        </button>

        <button 
          onClick={onCancel}
          className="mt-6 text-xs font-semibold text-slate-500 hover:text-slate-300 transition-colors uppercase tracking-wider"
        >
          Cancel & Return to Login
        </button>
      </motion.div>
    </div>
  );
}
