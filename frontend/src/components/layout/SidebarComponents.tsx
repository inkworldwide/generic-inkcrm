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
      "relative flex items-center justify-center w-[40px] h-[40px] rounded-xl bg-white/[0.03] border border-white/[0.06] shadow-sm transition-all duration-300",
      active && "bg-white/10 border-white/15 shadow-sm"
    )}>
      <SafeIcon className={cn("w-4.5 h-4.5 transition-transform duration-300", colorClass, active && "scale-105")} strokeWidth={2} />
    </div>
  );
};

export const SidebarGlow = () => (
  <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
    <div className="absolute top-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    <div className="absolute -left-1/2 top-0 bottom-0 w-[50%] animate-sweep bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-[-20deg]" />
  </div>
);

// ---------------------------------------------------------
// ITEMS & ACCORDIONS
// ---------------------------------------------------------

export const SidebarItem = ({ to, label, icon, colorClass, onClick, indent = false, badge }: { to: string, label: string, icon: any, colorClass: string, onClick?: () => void, indent?: boolean, badge?: number }) => {
  const location = useLocation();
  const isActive = location.pathname + location.search === to || (to !== '/' && location.pathname.startsWith(to.split('?')[0]) && location.search === (to.includes('?') ? '?' + to.split('?')[1] : ''));

  return (
    <Link to={to} onClick={onClick} className="block w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 rounded-2xl">
      <motion.div
        whileHover={{ scale: 1.01, y: -1 }}
        whileTap={{ scale: 0.99 }}
        className={cn(
          "relative flex items-center gap-3 px-3 py-2 h-[52px] rounded-2xl transition-all duration-200 group cursor-pointer",
          isActive ? "bg-white/[0.08] shadow-[0_4px_16px_rgba(0,0,0,0.08)] border border-white/10" : "hover:bg-white/[0.04]",
          indent && "pl-5 h-[44px]"
        )}
      >
        {/* Active Indicator */}
        {isActive && (
          <motion.div 
            layoutId="active-indicator"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 rounded-r-full bg-white shadow-none"
          />
        )}
        
        {isActive && <SidebarGlow />}

        <SidebarIcon icon={icon} colorClass={colorClass} active={isActive} />
        
        <span className={cn(
          "text-sm tracking-[0.01em] transition-all duration-200 group-hover:translate-x-0.5 flex-1",
          isActive ? "text-white font-medium" : "text-white/70 group-hover:text-white font-normal"
        )}>
          {label}
        </span>

        {badge !== undefined && badge > 0 && (
          <span className="ml-auto px-2 py-0.5 text-[10px] font-semibold rounded-full bg-white/10 text-white/80 border border-white/10 min-w-[20px] text-center">
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
    <div className="flex flex-col mb-1 focus-within:ring-2 focus-within:ring-white/10 rounded-2xl">
      <motion.button
        whileHover={{ scale: 1.01, y: -1 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative flex items-center justify-between w-full px-3 py-2 h-[52px] rounded-2xl transition-all duration-200 group",
          isOpen ? "bg-white/[0.05] border border-white/[0.04]" : "hover:bg-white/[0.04]"
        )}
      >
        <div className="flex items-center gap-3">
          <SidebarIcon icon={icon} colorClass={colorClass} active={isOpen} />
          <span className={cn(
            "text-sm tracking-[0.01em] transition-all duration-200 group-hover:translate-x-0.5",
            isOpen ? "text-white font-medium" : "text-white/70 group-hover:text-white font-normal"
          )}>
            {label}
          </span>
        </div>
        <ChevronRight className={cn("w-4 h-4 text-white/40 transition-transform duration-200", isOpen && "rotate-90 text-white/80")} />
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
            <div className="pt-1.5 pb-1 space-y-1 pl-4 relative">
              <div className="absolute left-8 top-3 bottom-3 w-px bg-white/10" />
              {React.Children.map(children, (child, idx) => (
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 + 0.08 }}
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
  <div className="mb-5">
    <h3 className="px-5 mb-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 flex items-center gap-3">
      {title}
      <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
    </h3>
    <div className="space-y-1 px-2">
      {children}
    </div>
  </div>
);

export const SidebarSearch = () => {
  return (
    <div className="px-4 mb-5">
      <motion.button 
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all group backdrop-blur-md"
      >
        <div className="flex items-center gap-2.5 text-white/50 group-hover:text-white/80 transition-colors">
          <Search className="w-4 h-4" />
          <span className="text-xs font-normal tracking-[0.01em]">Search Menu</span>
        </div>
        <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-semibold text-white/40 bg-white/5 rounded border border-white/10">CTRL K</kbd>
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
    <div className="p-3.5 pt-3 mt-auto border-t border-white/[0.06]">
      <motion.div 
        className="relative rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden backdrop-blur-md"
        animate={{ height: expanded ? 'auto' : '64px' }}
        transition={{ type: "spring", stiffness: 280, damping: 22 }}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
      >
        <div className="flex items-center gap-3 p-2.5 cursor-pointer">
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-md">
              {initials}
            </div>
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-[#121214] rounded-full" />
          </div>
          <div className="flex-1 overflow-hidden text-left">
            <h4 className="text-xs font-semibold text-white truncate">{name}</h4>
            <p className="text-[10px] text-white/40 tracking-wide font-medium truncate mt-0.5">{email}</p>
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
