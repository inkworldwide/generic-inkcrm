import React, { useState, useRef, useEffect } from 'react';
import * as Icons from 'lucide-react';

interface MultiSelectDropdownProps {
  label: string;
  options: string[];
  selectedValues: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}

export default function MultiSelectDropdown({
  label,
  options,
  selectedValues,
  onChange,
  placeholder = 'Select Options...'
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt =>
    opt.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isAllSelected = options.length > 0 && selectedValues.length === options.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      onChange([]);
    } else {
      onChange([...options]);
    }
  };

  const toggleOption = (option: string) => {
    if (selectedValues.includes(option)) {
      onChange(selectedValues.filter(item => item !== option));
    } else {
      onChange([...selectedValues, option]);
    }
  };

  // Helper text for trigger display
  const getDisplayText = () => {
    if (selectedValues.length === 0) return placeholder;
    if (selectedValues.length === options.length) return 'All Selected';
    if (selectedValues.length === 1) return selectedValues[0];
    return `${selectedValues[0]}, +${selectedValues.length - 1} more`;
  };

  return (
    <div className="relative w-full text-left" ref={dropdownRef}>
      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-2">
        {label}
      </label>

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="input-premium w-full h-11 px-4 text-xs font-semibold bg-[#FDFBF7] dark:bg-slate-900 border border-[#EAE4DA] dark:border-slate-700 rounded-xl flex items-center justify-between gap-2 text-left cursor-pointer transition-all hover:border-[#17223B]/30"
      >
        <span className={`truncate ${selectedValues.length > 0 ? 'text-[#0F172A] dark:text-white font-bold' : 'text-slate-400'}`}>
          {getDisplayText()}
        </span>

        <div className="flex items-center gap-1.5 shrink-0">
          {selectedValues.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-[#17223B] text-white text-[10px] font-mono font-bold flex items-center justify-center">
              {selectedValues.length}
            </span>
          )}
          <Icons.ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Popover */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-900 border-2 border-[#17223B]/20 dark:border-slate-700 rounded-2xl shadow-xl p-3 animate-in fade-in zoom-in-95 duration-150 max-h-72 flex flex-col">
          {/* Search bar inside dropdown if options > 5 */}
          {options.length > 5 && (
            <div className="mb-2 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full h-8 pl-8 pr-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#17223B]"
              />
              <Icons.Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
          )}

          {/* Select All Toggle */}
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-100 dark:border-slate-800 mb-1">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-xs font-bold text-[#17223B] dark:text-indigo-400 hover:underline cursor-pointer"
            >
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={toggleSelectAll}
                className="w-3.5 h-3.5 rounded border-slate-300 text-[#17223B] focus:ring-0 cursor-pointer"
              />
              <span>{isAllSelected ? 'Deselect All' : 'Select All'}</span>
            </button>
            <span className="text-[10px] font-semibold text-slate-400">
              {selectedValues.length} / {options.length}
            </span>
          </div>

          {/* Options Checkbox List */}
          <div className="overflow-y-auto flex-1 space-y-0.5 max-h-48 pr-1">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">No matching options</div>
            ) : (
              filteredOptions.map((opt) => {
                const checked = selectedValues.includes(opt);
                return (
                  <div
                    key={opt}
                    onClick={() => toggleOption(opt)}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                      checked
                        ? 'bg-slate-100/80 dark:bg-slate-800 text-[#0F172A] dark:text-white font-bold'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {}} // handled by parent div onClick
                      className="w-4 h-4 rounded border-slate-300 text-[#17223B] focus:ring-0 cursor-pointer"
                    />
                    <span className="truncate">{opt}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
