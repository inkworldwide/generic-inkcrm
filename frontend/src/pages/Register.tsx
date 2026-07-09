import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Register() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/login', { replace: true, state: { openRegister: true } });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50/50">
      <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}

