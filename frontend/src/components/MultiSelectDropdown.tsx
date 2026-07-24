import React, { useState, useRef, useEffect } from 'react';
import * as Icons from 'lucide-react';

interface MultiSelectDropdownProps {
  label?: string;
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
  placeholder = '-All-'
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popup when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isAllSelected = options.length > 0 && selectedValues.length === options.length;

  const handleToggleOption = (val: string) => {
    if (selectedValues.includes(val)) {
      onChange(selectedValues.filter(v => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      onChange([]);
    } else {
      onChange([...options]);
    }
  };

  // Determine display label for trigger button
  const getDisplayText = () => {
    if (selectedValues.length === 0 || isAllSelected) {
      return placeholder;
    }
    if (selectedValues.length === 1) {
      return selectedValues[0];
    }
    if (selectedValues.length <= 2) {
      return selectedValues.join(', ');
    }
    return `${selectedValues.length} Selected`;
  };

  return (
    <div className="relative w-full text-left" ref={containerRef}>
      {label && (
        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-2">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="input-premium w-full h-11 px-4 text-xs font-semibold bg-[#FDFBF7] dark:bg-slate-900 border border-[#EAE4DA] dark:border-slate-700 rounded-xl flex items-center justify-between text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      >
        <span className="truncate pr-2 font-medium">{getDisplayText()}</span>
        <Icons.ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Popup Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-1.5 z-50 max-h-64 overflow-y-auto bg-white dark:bg-slate-900 border border-[#EAE4DA] dark:border-slate-700 rounded-xl shadow-xl p-2 space-y-1 text-xs animate-in fade-in zoom-in-95 duration-100">
          {/* Select All Option */}
          <label
            onClick={handleToggleSelectAll}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer font-bold text-[#0F172A] dark:text-white border-b border-slate-100 dark:border-slate-800 mb-1"
          >
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={() => {}}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 cursor-pointer"
            />
            <span>Select All ({options.length})</span>
          </label>

          {/* Individual Options */}
          {options.map((opt) => {
            const isChecked = selectedValues.includes(opt);
            return (
              <label
                key={opt}
                onClick={() => handleToggleOption(opt)}
                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors ${
                  isChecked ? 'bg-indigo-50/60 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-semibold' : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => {}}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                />
                <span className="truncate">{opt}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
