import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, LogOut, FileText } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---------------------------------------------------------
// PURE LIGHT THEME ICON
// ---------------------------------------------------------
export const SidebarIcon = ({ icon: Icon, colorClass, active }: { icon: any; colorClass?: string; active?: boolean }) => {
  const FallbackIcon = FileText;
  const SafeIcon = Icon || FallbackIcon;

  return (
    <SafeIcon
      className={cn(
        "w-4 h-4 flex-shrink-0 transition-colors duration-150",
        active ? "text-[#111827]" : (colorClass || "text-[#6B7280] group-hover:text-[#111827]")
      )}
      strokeWidth={1.8}
    />
  );
};

// ---------------------------------------------------------
// PURE LIGHT THEME SIDEBAR ITEM
// ---------------------------------------------------------
export const SidebarItem = ({
  to,
  label,
  icon,
  colorClass,
  onClick,
  indent = false,
  badge,
  isCollapsed = false
}: {
  to: string;
  label: string;
  icon: any;
  colorClass?: string;
  onClick?: () => void;
  indent?: boolean;
  badge?: number;
  isCollapsed?: boolean;
}) => {
  const location = useLocation();
  const isActive =
    location.pathname + location.search === to ||
    (to !== '/' && location.pathname.startsWith(to.split('?')[0]) && (location.search === (to.includes('?') ? '?' + to.split('?')[1] : '') || !to.includes('?')));

  return (
    <Link
      to={to}
      onClick={onClick}
      title={isCollapsed ? label : undefined}
      className="block w-full focus:outline-none rounded-lg"
    >
      <div
        className={cn(
          "relative flex items-center gap-2.5 px-3 py-2 min-h-[36px] rounded-lg transition-all duration-150 group cursor-pointer text-[13px]",
          isActive
            ? "bg-[#EEF2FF] text-[#111827] font-bold"
            : "text-[#374151] hover:text-[#111827] hover:bg-[#F3F4F6] font-medium",
          indent && "pl-4 text-[12.5px]",
          isCollapsed && "justify-center px-0 py-2"
        )}
      >
        {/* Active Left Accent Bar (3-4px Purple Accent) */}
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 rounded-r-full bg-indigo-600" />
        )}

        <SidebarIcon icon={icon} colorClass={colorClass} active={isActive} />

        {!isCollapsed && (
          <span className="truncate flex-1 text-left tracking-tight uppercase font-semibold">
            {label}
          </span>
        )}

        {!isCollapsed && badge !== undefined && badge > 0 && (
          <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-indigo-100 text-indigo-700 border border-indigo-200">
            {badge}
          </span>
        )}
      </div>
    </Link>
  );
};

// ---------------------------------------------------------
// PURE LIGHT THEME ACCORDION (EXPANDABLE NAV)
// ---------------------------------------------------------
export const SidebarAccordion = ({
  label,
  icon,
  colorClass,
  children,
  defaultOpen = false,
  isCollapsed = false
}: {
  label: string;
  icon: any;
  colorClass?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  isCollapsed?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center py-1">
        <div className="p-2 text-[#6B7280] hover:text-[#111827] cursor-pointer" title={label}>
          <SidebarIcon icon={icon} colorClass={colorClass} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col my-0.5">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between w-full px-3 py-2 min-h-[36px] rounded-lg text-[13px] transition-all duration-150 group cursor-pointer text-left",
          isOpen ? "text-[#111827] font-semibold bg-[#F8FAFC]" : "text-[#374151] hover:text-[#111827] hover:bg-[#F3F4F6] font-medium"
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <SidebarIcon icon={icon} colorClass={colorClass} active={isOpen} />
          <span className="truncate tracking-tight uppercase font-semibold">{label}</span>
        </div>
        <ChevronRight
          className={cn(
            "w-3.5 h-3.5 text-[#9CA3AF] transition-transform duration-200 flex-shrink-0 group-hover:text-[#111827]",
            isOpen && "rotate-90 text-[#111827]"
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="ml-4 pl-2 my-1 space-y-0.5 border-l border-[#E5E7EB]">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ---------------------------------------------------------
// SECTION GROUP & HEADERS
// ---------------------------------------------------------
export const SidebarGroup = ({ title, children, isCollapsed = false }: { title: string; children: React.ReactNode; isCollapsed?: boolean }) => (
  <div className="mb-3">
    {!isCollapsed ? (
      <h3 className="px-3 mb-1 mt-3 text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] text-left">
        {title}
      </h3>
    ) : (
      <div className="h-px bg-[#E5E7EB] my-2 mx-2" />
    )}
    <div className="space-y-0.5">{children}</div>
  </div>
);

// ---------------------------------------------------------
// PURE LIGHT THEME PROFILE SECTION
// ---------------------------------------------------------
export const SidebarProfile = ({ isCollapsed = false }: { isCollapsed?: boolean }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const name = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Admin User' : 'Admin User';
  const initials = user ? `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}`.toUpperCase() || 'AD' : 'AD';
  const email = user?.email || 'ink@crm.com';

  if (isCollapsed) {
    return (
      <div className="p-3 border-t border-[#E5E7EB] flex justify-center">
        <button
          onClick={handleLogout}
          title="Logout"
          className="w-8 h-8 rounded-full bg-[#F3F4F6] hover:bg-rose-100 hover:text-rose-600 text-[#6B7280] flex items-center justify-center transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="p-3 border-t border-[#E5E7EB] bg-[#FFFFFF] mt-auto">
      <div className="flex items-center justify-between gap-3 px-1 py-1">
        {/* User Info */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
              {initials}
            </div>
            <div className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 border border-white rounded-full" />
          </div>
          <div className="flex flex-col min-w-0 text-left">
            <span className="text-xs font-bold text-[#111827] truncate leading-tight">
              {name}
            </span>
            <span className="text-[10.5px] font-medium text-[#6B7280] truncate leading-tight mt-0.5">
              {email}
            </span>
          </div>
        </div>

        {/* Logout Quick Action */}
        <button
          onClick={handleLogout}
          title="Logout"
          className="p-1.5 text-[#9CA3AF] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex-shrink-0"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
