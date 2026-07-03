import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronRight, LogOut, Settings, User, FileText } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---------------------------------------------------------
// ICON & GLOW
// ---------------------------------------------------------

export const SidebarIcon = ({ icon: Icon, colorClass, active }: { icon: any, colorClass: string, active?: boolean }) => {
  const FallbackIcon = FileText; // Fallback if icon doesn't exist in older lucide-react versions
  const SafeIcon = Icon || FallbackIcon;

  return (
    <div className={cn(
      "relative flex items-center justify-center w-[42px] h-[42px] rounded-[14px] bg-white/[0.03] backdrop-blur-md border border-white/[0.08] shadow-sm transition-all duration-300",
      active && "bg-white/[0.08] border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
    )}>
      <SafeIcon className={cn("w-5 h-5 transition-transform duration-300", colorClass, active && "scale-110")} strokeWidth={2.2} />
      {active && (
        <div className="absolute inset-0 rounded-[14px] shadow-[inset_0_0_10px_rgba(255,255,255,0.2)] pointer-events-none" />
      )}
    </div>
  );
};

export const SidebarGlow = () => (
  <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
    <div className="absolute top-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    <div className="absolute -left-1/2 top-0 bottom-0 w-[50%] animate-sweep bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-[-20deg]" />
  </div>
);

// ---------------------------------------------------------
// ITEMS & ACCORDIONS
// ---------------------------------------------------------

export const SidebarItem = ({ to, label, icon, colorClass, onClick, indent = false, badge }: { to: string, label: string, icon: any, colorClass: string, onClick?: () => void, indent?: boolean, badge?: number }) => {
  const location = useLocation();
  const isActive = location.pathname + location.search === to || (to !== '/' && location.pathname.startsWith(to.split('?')[0]) && location.search === (to.includes('?') ? '?' + to.split('?')[1] : ''));

  return (
    <Link to={to} onClick={onClick} className="block w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 rounded-2xl">
      <motion.div
        whileHover={{ scale: 1.015, y: -2 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          "relative flex items-center gap-3 px-3 py-2 h-[56px] rounded-2xl transition-all duration-300 group cursor-pointer",
          isActive ? "bg-white/[0.08] shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-white/[0.05]" : "hover:bg-white/[0.04]",
          indent && "pl-5 h-[48px]"
        )}
      >
        {/* Active Indicator */}
        {isActive && (
          <motion.div 
            layoutId="active-indicator"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-gradient-to-b from-[#97ff00] to-[#6cd400] shadow-[0_0_12px_rgba(151,255,0,0.5)]"
          />
        )}
        
        {isActive && <SidebarGlow />}

        <SidebarIcon icon={icon} colorClass={colorClass} active={isActive} />
        
        <span className={cn(
          "font-medium text-[15px] tracking-[0.2px] transition-all duration-300 group-hover:translate-x-1 flex-1",
          isActive ? "text-white font-semibold" : "text-white/70 group-hover:text-white"
        )}>
          {label}
        </span>

        {badge !== undefined && badge > 0 && (
          <span className="ml-auto px-2 py-0.5 text-[10px] font-bold rounded-full bg-white/10 text-white/80 border border-white/10 min-w-[22px] text-center">
            {badge}
          </span>
        )}
      </motion.div>
    </Link>
  );
};

export const SidebarAccordion = ({ label, icon, colorClass, children, defaultOpen = false }: { label: string, icon: any, colorClass: string, children: React.ReactNode, defaultOpen?: boolean }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="flex flex-col mb-1 focus-within:ring-2 focus-within:ring-lime-400/50 rounded-2xl">
      <motion.button
        whileHover={{ scale: 1.015, y: -2 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative flex items-center justify-between w-full px-3 py-2 h-[56px] rounded-2xl transition-all duration-300 group",
          isOpen ? "bg-white/[0.06] border border-white/[0.04]" : "hover:bg-white/[0.04]"
        )}
      >
        <div className="flex items-center gap-3">
          <SidebarIcon icon={icon} colorClass={colorClass} active={isOpen} />
          <span className={cn(
            "font-medium text-[15px] tracking-[0.2px] transition-all duration-300 group-hover:translate-x-1",
            isOpen ? "text-white" : "text-white/70 group-hover:text-white"
          )}>
            {label}
          </span>
        </div>
        <ChevronRight className={cn("w-4 h-4 text-white/40 transition-transform duration-300", isOpen && "rotate-90 text-white/80")} />
      </motion.button>
      
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 22 }}
            className="overflow-hidden"
          >
            <div className="pt-2 pb-1 space-y-1 pl-4 relative">
              <div className="absolute left-8 top-4 bottom-4 w-px bg-white/10" />
              {React.Children.map(children, (child, idx) => (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04 + 0.1 }}
                >
                  {child}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ---------------------------------------------------------
// GROUPS & STRUCTURE
// ---------------------------------------------------------

export const SidebarGroup = ({ title, children }: { title: string, children: React.ReactNode }) => (
  <div className="mb-6">
    <h3 className="px-5 mb-3 text-[11px] font-bold uppercase tracking-[0.25em] text-white/40 flex items-center gap-4">
      {title}
      <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
    </h3>
    <div className="space-y-1 px-3">
      {children}
    </div>
  </div>
);

export const SidebarSearch = () => {
  return (
    <div className="px-4 mb-6">
      <motion.button 
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-all group shadow-sm backdrop-blur-md"
      >
        <div className="flex items-center gap-3 text-white/50 group-hover:text-white/80 transition-colors">
          <Search className="w-4 h-4" />
          <span className="text-sm font-medium">Search Menu</span>
        </div>
        <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-bold text-white/40 bg-white/5 rounded border border-white/10">CTRL K</kbd>
      </motion.button>
    </div>
  );
};

// ---------------------------------------------------------
// PROFILE & FOOTER
// ---------------------------------------------------------

import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export const SidebarProfile = () => {
  const [expanded, setExpanded] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const name = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Admin User' : 'Admin User';
  const initials = user ? `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}`.toUpperCase() || 'AD' : 'AD';
  const email = user?.email || 'ink@crm.com';

  return (
    <div className="p-4 mt-auto">
      <motion.div 
        className="relative rounded-2xl bg-white/[0.03] border border-white/[0.08] overflow-hidden backdrop-blur-md"
        animate={{ height: expanded ? 'auto' : '68px' }}
        transition={{ type: "spring", stiffness: 280, damping: 22 }}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
      >
        <div className="flex items-center gap-3 p-3 cursor-pointer">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg">
              {initials}
            </div>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-[#0f172a] rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          </div>
          <div className="flex-1 overflow-hidden">
            <h4 className="text-sm font-bold text-white truncate">{name}</h4>
            <p className="text-[11px] text-white/50 tracking-wide uppercase font-semibold truncate">{email}</p>
          </div>
        </div>
        
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-2 pb-2"
            >
              <div className="h-px bg-white/10 mx-2 mb-2" />
              <div className="space-y-1">
                <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors">
                  <User className="w-4 h-4" /> Profile
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors">
                  <Settings className="w-4 h-4" /> Settings
                </button>
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-xl transition-colors"
                >
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
