import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import * as Icons from 'lucide-react';
import { useModuleStore, FieldDefinition } from '../store/moduleStore';
import api from '../services/api';
import { useToastStore } from '../store/toastStore';
import { useAuthStore } from '../store/authStore';

export default function RecordForm() {
  const { apiPath, id } = useParams<{ apiPath: string; id?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeModule, setActiveModuleByPath } = useModuleStore();
  const { showConfirm, showToast, showAlertModal } = useToastStore();
  const { user } = useAuthStore();
  const isLeads = true; // Use light layout for all creation/edit forms

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formSchema, setFormSchema] = useState<any>(z.object({}));

  // Timeline / Comment / Attachments states for existing records
  const [timeline, setTimeline] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [documents, setDocuments] = useState<any[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [dynamicStatuses, setDynamicStatuses] = useState<string[]>([]);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editingDocName, setEditingDocName] = useState<string>('');
  const [bankPartnerMappings, setBankPartnerMappings] = useState<any[]>([]);
  const [psmAutoFilled, setPsmAutoFilled] = useState(false);
  const [psmWarningMessage, setPsmWarningMessage] = useState<string>('');
  const [conflictModal, setConflictModal] = useState<{
    isOpen: boolean;
    psmName: string;
    bankName: string;
    loanType: string;
  } | null>(null);
  const [bpDropdownOpen, setBpDropdownOpen] = useState(false);
  const [allBanks, setAllBanks] = useState<string[]>([]);
  const [allLoanTypes, setAllLoanTypes] = useState<string[]>([]);
  const [allTeams, setAllTeams] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<string[]>([]);
  const [rawUsersList, setRawUsersList] = useState<any[]>([]);

  const isInitialLoadRef = React.useRef(true);

  useEffect(() => {
    const fetchDynamicStatuses = async () => {
      try {
        const res = await api.get('/statuses');
        setDynamicStatuses(res.data.map((s: any) => s.name));
      } catch (err) {
        console.error('Failed to fetch dynamic statuses', err);
      }
    };
    fetchDynamicStatuses();

    // Fetch dependencies for Leads module
    if (apiPath === 'leads') {
      const fetchLeadsDependencies = async () => {
        try {
          const [resBP, resBM, resProducts, resDepts, resUsers] = await Promise.all([
            api.get('/records/bankingpartners'),
            api.get('/records/bankmasters'),
            api.get('/records/products'),
            api.get('/records/departments'),
            api.get('/auth/users')
          ]);
          
          setBankPartnerMappings(resBP.data?.records || resBP.data || []);
          
          // 1. Process bank options list (Bank Master Settings)
          const customBanks = (resBM.data?.records || []).map((r: any) => r.data?.bankName).filter(Boolean);
          const mergedBanks = customBanks.map((b: string) => b.toUpperCase());
          // Keep both 'SBI' and 'STATE BANK OF INDIA' for backwards-compatibility matching
          if (mergedBanks.includes('STATE BANK OF INDIA') && !mergedBanks.includes('SBI')) {
            mergedBanks.unshift('SBI');
          }
          setAllBanks(mergedBanks);

          // 2. Process loan types (Products Settings)
          const dbLoanTypes = (resProducts.data?.records || [])
            .map((r: any) => r.data?.name)
            .filter(Boolean)
            .map((b: string) => b.toUpperCase());
          if (dbLoanTypes.length > 0) {
            setAllLoanTypes(dbLoanTypes);
          } else {
            setAllLoanTypes(['SALARIED PERSONAL LOAN', 'BUSINESS LOAN', 'HOME LOAN', 'LAP']);
          }

          // 3. Process teams (Departments Settings)
          const dbTeams = (resDepts.data?.records || [])
            .map((r: any) => r.data?.name)
            .filter(Boolean);
          if (dbTeams.length > 0) {
            setAllTeams(dbTeams);
          } else {
            setAllTeams(['Team A', 'Team B']);
          }

          // 4. Process agents (Users settings)
          const dbUsers = (resUsers.data || [])
            .map((u: any) => [u.firstName, u.lastName].filter(Boolean).join(' '))
            .filter(Boolean);
          setAllUsers(dbUsers);
          setRawUsersList(resUsers.data || []);

        } catch (err) {
          console.error('Failed to load leads dependency data', err);
          // Fallbacks
          setAllBanks([]);
          setAllLoanTypes(['SALARIED PERSONAL LOAN', 'BUSINESS LOAN', 'HOME LOAN', 'LAP']);
          setAllTeams(['Team A', 'Team B']);
          setAllUsers([]);
          setRawUsersList([]);
        }
      };
      fetchLeadsDependencies();
    }
  }, [apiPath]);

  // Set isInitialLoadRef to false when loading goes from true to false
  useEffect(() => {
    let timer: any;
    if (!loading) {
      timer = setTimeout(() => {
        isInitialLoadRef.current = false;
      }, 300); // 300ms delay to make sure form values are fully loaded/reset
    } else {
      isInitialLoadRef.current = true;
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [loading]);

  // Set active module
  useEffect(() => {
    if (apiPath) {
      setActiveModuleByPath(apiPath);
    }
  }, [apiPath]);

  // Build schema and load existing record data
  useEffect(() => {
    if (!activeModule) return;

    // 1. Build dynamic Zod validation schema
    const schemaFields: Record<string, any> = {};

    activeModule.fields.forEach((field) => {
      // Don't validate formula fields in input schemas (they are backend calculated)
      if (field.type === 'formula') {
        schemaFields[field.name] = z.any().optional();
        return;
      }

      let zField: any;

      if (field.type === 'number' || field.type === 'currency') {
        zField = z.preprocess(
          (val) => (val === '' || val === undefined || val === null ? undefined : Number(val)),
          field.required 
            ? z.number({ required_error: `${field.label} is required.` }) 
            : z.number().optional()
        );
      } else if (field.required) {
        if (field.type === 'email') {
          zField = z.string().email('Invalid email address.');
        } else {
          zField = z.string().min(1, `${field.label} is required.`);
        }
      } else {
        zField = z.string().optional().or(z.literal(''));
      }

      schemaFields[field.name] = zField;
    });

    setFormSchema(z.object(schemaFields));

    // 2. Load record if in edit mode
    if (id) {
      loadRecordData();
    } else {
      // Initialize default values
      const defaults: Record<string, any> = {};
      activeModule.fields.forEach((f) => {
        if (f.defaultValue) defaults[f.name] = f.defaultValue;
      });
      if (apiPath === 'leads') {
        const loggedInName = user ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email.split('@')[0] : '';
        if (loggedInName) {
          defaults['source'] = loggedInName;
        }
      }
      reset(defaults);
      setLoading(false);
    }
  }, [activeModule, id, apiPath, user]);

  const loadRecordData = async () => {
    try {
      const [recordRes, docRes, activityRes] = await Promise.all([
        api.get(`/records/${apiPath}/${id}`),
        api.get('/documents', { params: { recordId: id } }),
        api.get('/dashboard/metrics') // loads activities
      ]);

      const recordValues = recordRes.data.data instanceof Map 
        ? Object.fromEntries(recordRes.data.data) 
        : recordRes.data.data;
      
      reset(recordValues);
      setDocuments(docRes.data || []);
      
      // Filter activities for this record
      const fullTimeline = activityRes.data.recentActivities || [];
      setTimeline(fullTimeline.filter((t: any) => t.recordId === id));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(formSchema)
  });

  // Watch fields for conditional visibility evaluation
  const watchedValues = watch();

  const filteredUsers = React.useMemo(() => {
    let list = rawUsersList.filter((u: any) => u.isActive !== false);
    const selectedTeam = watchedValues.assignToTeam;
    if (selectedTeam) {
      list = list.filter((u: any) => String(u.department || '').trim().toLowerCase() === selectedTeam.trim().toLowerCase());
    }
    return list.map((u: any) => [u.firstName, u.lastName].filter(Boolean).join(' ')).filter(Boolean);
  }, [rawUsersList, watchedValues.assignToTeam]);

  const recordName = apiPath === 'leads'
    ? `${watchedValues.firstName || ''} ${watchedValues.lastName || ''}`.trim()
    : watchedValues.fullName || watchedValues.companyName || watchedValues.dealName || watchedValues.title;

  // Auto-fill PSM when loanType + businessPartner are both selected
  useEffect(() => {
    if (loading || apiPath !== 'leads' || bankPartnerMappings.length === 0) return;
    const selectedLoanType = watchedValues.loanType;
    const selectedBank = watchedValues.businessPartner;
    
    if (!selectedLoanType || !selectedBank) {
      if (psmAutoFilled) {
        setValue('psm', '');
        setPsmAutoFilled(false);
      }
      setPsmWarningMessage('');
      return;
    }
    
    // Normalization helper for bank names
    const normalizeBank = (bankName: string): string => {
      const name = bankName.trim().toLowerCase();
      if (name === 'sbi') return 'state bank of india';
      if (name === 'state bank of india') return 'state bank of india';
      return name;
    };

    // Normalization helper for loan types
    const normalizeLoan = (loanType: string): string => {
      const type = loanType.trim().toLowerCase();
      if (type === 'lap' || type === 'loan against property loan' || type === 'loan against property') {
        return 'loan against property';
      }
      if (type === 'salaried personal loan' || type === 'personal loan') {
        return 'personal loan';
      }
      return type;
    };

    const targetLoan = normalizeLoan(selectedLoanType);

    // Split selected banks (supports comma-separated string)
    const selectedBanksList = selectedBank.split(',').map((s: string) => s.trim()).filter(Boolean);

    let matchedPsm: string | null = null;
    let matchedBank: string | null = null;

    console.log('[Bank Partner Debug] Selected Banks List:', selectedBanksList, 'Loan Type:', targetLoan);

    // Find if any selected bank has a mapping
    for (const bank of selectedBanksList) {
      const targetBank = normalizeBank(bank);
      const match = bankPartnerMappings.find((bp: any) => {
        const bpLoanType = bp.data?.loanType || bp.loanType;
        const bpBanks = (bp.data?.bank || bp.bank || '')
          .split(',')
          .map((s: string) => normalizeBank(s));
        
        const bpNormLoan = normalizeLoan(bpLoanType || '');
        
        return bpNormLoan === targetLoan && bpBanks.includes(targetBank);
      });

      if (match) {
        matchedPsm = match.data?.psm || match.psm;
        matchedBank = bank;
        break; // Display first matching mapping in conflict popups
      }
    }

    if (matchedPsm) {
      setValue('psm', matchedPsm);
      setPsmAutoFilled(true);
      setPsmWarningMessage('');
    } else {
      setValue('psm', '');
      setPsmAutoFilled(false);
      setPsmWarningMessage('No PSM has been assigned for this Bank and Loan Type. Please configure it in Settings → Bank Partner.');
    }
  }, [watchedValues.loanType, watchedValues.businessPartner, bankPartnerMappings, loading]);

  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      console.log('RecordForm Validation Errors:', errors);
    }
  }, [errors]);

  const onSubmitForm = async (data: any) => {
    setSaving(true);
    try {
      if (id) {
        await api.put(`/records/${apiPath}/${id}`, data);
      } else {
        await api.post(`/records/${apiPath}`, data);
      }
      queryClient.invalidateQueries({ queryKey: ['records', apiPath] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      showAlertModal({
        title: id ? 'Saved Successfully' : 'Created Successfully',
        message: id ? 'The record has been updated successfully.' : 'The record has been created successfully.',
        type: 'success',
        onClose: () => {
          navigate(`/modules/${apiPath}`);
        }
      });
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to submit form.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Upload Document
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    const formData = new FormData();
    formData.append('file', file);
    if (id) formData.append('recordId', id);

    setUploadingDoc(true);
    try {
      const res = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setDocuments([res.data, ...documents]);
    } catch (err) {
      showToast('Failed to upload document.', 'error');
    } finally {
      setUploadingDoc(false);
    }
  };

  // Delete Document
  const handleDeleteDoc = (docId: string) => {
    showConfirm({
      title: 'Delete File',
      message: 'Are you sure you want to delete this file attachment?',
      onConfirm: async () => {
        try {
          await api.delete(`/documents/${docId}`);
          setDocuments(documents.filter((d) => d._id !== docId));
          showAlertModal({
            title: 'Deleted Successfully',
            message: 'The attached file has been permanently deleted.',
            type: 'success'
          });
        } catch (err) {
          showToast('Failed to delete file.', 'error');
        }
      }
    });
  };

  // Rename Document Submit
  const handleRenameDocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDocId || !editingDocName.trim()) return;
    try {
      const res = await api.put(`/documents/${editingDocId}`, { name: editingDocName });
      setDocuments(documents.map((d) => (d._id === editingDocId ? res.data : d)));
      showToast('Document renamed successfully.', 'success');
      setEditingDocId(null);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to rename document.', 'error');
    }
  };

  const renderField = (field: FieldDefinition) => {
    // Evaluate Conditional Visibility
    if (field.conditionalVisibility) {
      const depValue = watchedValues[field.conditionalVisibility.dependsOnField];
      if (String(depValue || '').toLowerCase() !== field.conditionalVisibility.conditionValue.toLowerCase()) {
        return null;
      }
    }

    const inputBase = isLeads
      ? 'w-full px-4 py-3 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-slate-900 placeholder-slate-400 font-medium'
      : 'w-full px-4 py-3 text-sm md:text-[15px] bg-slate-950/60 border border-slate-700 hover:border-slate-550 rounded-xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/80 transition-all text-white font-medium placeholder-slate-400';

    const labelClass = isLeads
      ? 'block text-xs md:text-[13px] font-bold text-slate-700 uppercase tracking-wider mb-2'
      : 'block text-xs md:text-[13px] font-bold text-slate-200 uppercase tracking-wider mb-2';

    if (field.name === 'source' && apiPath === 'leads') {
      return (
        <div key={field.name} className="space-y-1.5 text-left">
          <label className={labelClass}>
            {field.label}{field.required && <span className="text-rose-500 ml-0.5">*</span>}
          </label>
          <input
            type="text"
            readOnly
            placeholder={field.label}
            {...register(field.name)}
            className={`${inputBase} bg-slate-50 text-slate-550 font-semibold cursor-not-allowed`}
          />
        </div>
      );
    }

    if (field.name === 'psm' && apiPath === 'leads') {
      return (
        <div key={field.name} className="space-y-1.5 text-left">
          <label className={labelClass}>
            {field.label}{field.required && <span className="text-rose-500 ml-0.5">*</span>}
          </label>
          <input
            type="text"
            readOnly
            placeholder={field.label}
            {...register(field.name)}
            className={isLeads
              ? "w-full px-4 py-3 text-sm bg-slate-100 border border-slate-200 rounded-xl text-slate-650 focus:outline-none cursor-not-allowed font-medium"
              : "w-full px-4 py-3 text-sm md:text-[15px] bg-slate-950/40 border border-slate-800 rounded-xl text-slate-450 focus:outline-none cursor-not-allowed font-medium"}
          />
          {psmWarningMessage && (
            <p className="text-[11px] text-amber-600 font-bold mt-1 leading-normal">{psmWarningMessage}</p>
          )}
          {errors[field.name] && (
            <p className="text-[11px] text-rose-550 font-bold mt-1">{(errors[field.name]?.message as string)}</p>
          )}
        </div>
      );
    }

    if (field.name === 'businessPartner' && apiPath === 'leads') {
      const selectedVal = watchedValues[field.name] || '';
      const selectedList = selectedVal ? selectedVal.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
      let opts = allBanks.length > 0 ? allBanks : field.options || [];

      const toggleBank = (bank: string) => {
        let newList: string[];
        if (selectedList.includes(bank)) {
          newList = selectedList.filter((x: string) => x !== bank);
        } else {
          newList = [...selectedList, bank];
        }
        setValue(field.name, newList.join(', '), { shouldValidate: true });
      };

      return (
        <div key={field.name} className="space-y-1.5 text-left relative">
          <label className={labelClass}>
            {field.label}{field.required && <span className="text-rose-500 ml-0.5">*</span>}
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setBpDropdownOpen(!bpDropdownOpen)}
              className={`${inputBase} flex items-center justify-between text-left`}
            >
              <span className={selectedList.length === 0 ? "text-slate-400 font-medium" : "text-slate-900 font-medium truncate pr-4"}>
                {selectedList.length === 0 ? '-Select Business Partners-' : selectedList.join(', ')}
              </span>
              <Icons.ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />
            </button>

            {/* Hidden input for react-hook-form integration */}
            <input type="hidden" {...register(field.name)} value={selectedVal} />

            {bpDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setBpDropdownOpen(false)} />
                <div className="absolute top-full left-0 w-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-50 max-h-60 overflow-y-auto space-y-1">
                  {opts.map((opt) => {
                    const isChecked = selectedList.includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => toggleBank(opt)}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-xl text-left transition-all ${
                          isChecked
                            ? 'bg-emerald-500/10 text-emerald-800'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                          isChecked
                            ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                            : 'border-slate-300 bg-white'
                        }`}>
                          {isChecked && <Icons.Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span>{opt}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          {errors[field.name] && (
            <p className="text-[11px] text-rose-550 font-bold mt-1">{(errors[field.name]?.message as string)}</p>
          )}
        </div>
      );
    }

    if (field.name === 'assignedTo' && apiPath === 'leads') {
      return (
        <div key={field.name} className="space-y-1.5 text-left">
          <label className={labelClass}>
            {field.label}{field.required && <span className="text-rose-500 ml-0.5">*</span>}
          </label>
          <select {...register(field.name)} className={inputBase}>
            <option value="" className={isLeads ? "bg-white text-slate-500" : "bg-slate-950 text-slate-300"}>-Select Agent-</option>
            {filteredUsers.map((userOpt) => (
              <option key={userOpt} value={userOpt} className={isLeads ? "bg-white text-slate-800" : "bg-slate-950 text-slate-200"}>
                {userOpt}
              </option>
            ))}
          </select>
          {errors[field.name] && (
            <p className="text-[11px] text-rose-550 font-bold mt-1">{(errors[field.name]?.message as string)}</p>
          )}
        </div>
      );
    }

    switch (field.type) {
      case 'dropdown': {
        let opts = field.options || [];
        
        if (field.name === 'status' && dynamicStatuses.length > 0) {
          opts = dynamicStatuses;
        } else if (field.name === 'loanType' && apiPath === 'leads' && allLoanTypes.length > 0) {
          opts = allLoanTypes;
        } else if (field.name === 'assignToTeam' && apiPath === 'leads' && allTeams.length > 0) {
          opts = allTeams;
        }

        if (field.name === 'source') {
          const loggedInName = user ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email.split('@')[0] : '';
          if (loggedInName && !opts.includes(loggedInName)) {
            opts = [loggedInName, ...opts];
          }
        }
        return (
          <div key={field.name} className="space-y-1.5 text-left">
            <label className={labelClass}>
              {field.label}{field.required && <span className="text-rose-500 ml-0.5">*</span>}
            </label>
            <select {...register(field.name)} className={inputBase}>
              <option value="" className={isLeads ? "bg-white text-slate-500" : "bg-slate-950 text-slate-300"}>-Select One-</option>
              {opts?.map((opt) => (
                <option key={opt} value={opt} className={isLeads ? "bg-white text-slate-800" : "bg-slate-950 text-slate-200"}>
                  {opt}
                </option>
              ))}
            </select>
            {errors[field.name] && (
              <p className="text-[11px] text-rose-550 font-bold mt-1">{(errors[field.name]?.message as string)}</p>
            )}
          </div>
        );
      }

      case 'checkbox':
        return (
          <div key={field.name} className="flex items-center gap-2.5 text-left pt-6">
            <input
              type="checkbox"
              {...register(field.name)}
              className={isLeads 
                ? "rounded border-slate-300 bg-white text-emerald-600 focus:ring-0 focus:ring-offset-0 w-5 h-5 cursor-pointer"
                : "rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-0 focus:ring-offset-0 w-5 h-5 cursor-pointer"}
            />
            <label className={isLeads 
              ? "text-xs md:text-[13px] font-bold text-slate-700 select-none cursor-pointer"
              : "text-xs md:text-[13px] font-bold text-slate-200 select-none cursor-pointer"}>
              {field.label}
            </label>
          </div>
        );

      case 'rich-text':
        return (
          <div key={field.name} className="space-y-1.5 text-left col-span-1 md:col-span-2 lg:col-span-4">
            <label className={labelClass}>{field.label}</label>
            <textarea
              rows={3}
              {...register(field.name)}
              placeholder={field.label}
              className={inputBase}
            />
          </div>
        );

      case 'formula':
        return (
          <div key={field.name} className="space-y-1.5 text-left">
            <label className={isLeads 
              ? "block text-xs md:text-[13px] font-bold text-slate-500 uppercase tracking-wider mb-2"
              : "block text-xs md:text-[13px] font-bold text-slate-400 uppercase tracking-wider mb-2"}>{field.label} (Auto)</label>
            <input
              type="text"
              readOnly
              value={watchedValues[field.name] || 'Auto-Calculated'}
              className={isLeads
                ? "w-full px-4 py-3 text-sm bg-slate-100 border border-slate-200 rounded-xl text-slate-600 focus:outline-none cursor-not-allowed"
                : "w-full px-4 py-3 text-sm md:text-[15px] bg-slate-950/40 border border-slate-800 rounded-xl text-slate-450 focus:outline-none cursor-not-allowed"}
            />
          </div>
        );

      case 'date': {
        const storedVal = watchedValues[field.name] || '';
        const displayVal = (() => {
          if (!storedVal) return '';
          if (/^\d{4}-\d{2}-\d{2}$/.test(storedVal)) {
            const [y, m, d] = storedVal.split('-');
            return `${d}/${m}/${y}`;
          }
          return storedVal;
        })();

        const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          const raw = e.target.value;
          // Only allow digits and slashes
          let v = raw.replace(/[^\d/]/g, '');

          // Auto-insert slashes after dd and mm
          const digits = v.replace(/\//g, '');
          if (digits.length >= 4) {
            v = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4, 8);
          } else if (digits.length >= 2) {
            v = digits.slice(0, 2) + '/' + digits.slice(2);
          }
          if (v.length > 10) v = v.slice(0, 10);

          // Store as yyyy-mm-dd when fully typed
          if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
            const [dd, mm, yyyy] = v.split('/');
            setValue(field.name, `${yyyy}-${mm}-${dd}`);
          } else {
            // Store the raw typed text temporarily so it stays visible
            setValue(field.name, v ? `__raw__${v}` : '');
          }
        };

        // For display: convert stored value or show raw typing
        const inputDisplay = (() => {
          if (storedVal.startsWith('__raw__')) return storedVal.replace('__raw__', '');
          return displayVal;
        })();
        const datePickerId = `date-picker-${field.name}`;

        return (
          <div key={field.name} className="space-y-1.5 text-left">
            <label className={labelClass}>
              {field.label}{field.required && <span className="text-rose-500 ml-0.5">*</span>}
            </label>
            <div className="relative">
              <input
                type="text"
                value={inputDisplay}
                onChange={handleDateChange}
                placeholder="dd/mm/yyyy"
                maxLength={10}
                className={`${inputBase} pr-10`}
              />
              {/* Hidden native date picker */}
              <input
                id={datePickerId}
                type="date"
                className="sr-only"
                value={/^\d{4}-\d{2}-\d{2}$/.test(storedVal) ? storedVal : ''}
                onChange={(e) => {
                  if (e.target.value) setValue(field.name, e.target.value);
                }}
                tabIndex={-1}
              />
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById(datePickerId) as HTMLInputElement | null;
                  if (el) { try { el.showPicker(); } catch { el.click(); } }
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-100 transition-colors"
              >
                <Icons.Calendar className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            {errors[field.name] && (
              <p className="text-[11px] text-rose-550 font-bold mt-1">{(errors[field.name]?.message as string)}</p>
            )}
          </div>
        );
      }

      default:
        return (
          <div key={field.name} className="space-y-1.5 text-left">
            <label className={labelClass}>
              {field.label}{field.required && <span className="text-rose-500 ml-0.5">*</span>}
            </label>
            <input
              type={field.type === 'number' || field.type === 'currency' ? 'number' : 'text'}
              {...register(field.name)}
              placeholder={field.label}
              className={inputBase}
            />
            {errors[field.name] && (
              <p className="text-[11px] text-rose-550 font-bold mt-1">{(errors[field.name]?.message as string)}</p>
            )}
          </div>
        );
    }
  };

  // Group fields into Loan Details / Personal Details sections
  const groupFields = (fields: FieldDefinition[]) => {
    const loanDetailNames = [
      'source', 'loanType', 'budget', 'dataCode', 'businessPartner', 'psm', 'status', 'caseDetails', 'assignToTeam', 'assignedTo', 'followUpDate', 'notes'
    ];
    const personalNames = [
      'firstName', 'lastName', 'company', 'salary', 'phone', 'email', 'presentAddress', 'city', 'pinCode', 'state', 'country'
    ];

    const sections: { title: string; fields: FieldDefinition[] }[] = [];

    if (apiPath === 'leads') {
      const loanFields = fields.filter(f => loanDetailNames.includes(f.name));
      const persFields = fields.filter(f => personalNames.includes(f.name));
      const remaining = fields.filter(f => !loanDetailNames.includes(f.name) && !personalNames.includes(f.name) && f.name !== 'leadScore');

      // Map labels specifically for Leads module
      loanFields.forEach(f => {
        if (f.name === 'status') f.label = 'Current Status';
        if (f.name === 'budget') f.label = 'Loan Amount';
        if (f.name === 'assignedTo') f.label = 'Assign To Agent';
        if (f.name === 'leadScore') f.label = 'Data Code';
        if (f.name === 'notes') f.label = 'Remarks';
      });

      persFields.forEach(f => {
        if (f.name === 'company') f.label = 'Company Name';
        if (f.name === 'phone') f.label = 'Mobile';
        if (f.name === 'email') f.label = 'E-Mail';
      });

      // Maintain order to match the request layout:
      // Loan Details
      const orderedLoan = [
        loanFields.find(f => f.name === 'source'),
        loanFields.find(f => f.name === 'budget'),
        loanFields.find(f => f.name === 'loanType'),
        loanFields.find(f => f.name === 'businessPartner'),
        loanFields.find(f => f.name === 'psm'),
        loanFields.find(f => f.name === 'status'),
        loanFields.find(f => f.name === 'assignToTeam'),
        loanFields.find(f => f.name === 'assignedTo'),
        loanFields.find(f => f.name === 'followUpDate'),
        loanFields.find(f => f.name === 'dataCode'),
        loanFields.find(f => f.name === 'caseDetails'),
        loanFields.find(f => f.name === 'notes')
      ].filter(Boolean) as FieldDefinition[];

      // Personal Details
      const orderedPers = [
        persFields.find(f => f.name === 'firstName'),
        persFields.find(f => f.name === 'lastName'),
        persFields.find(f => f.name === 'company'),
        persFields.find(f => f.name === 'salary'),
        persFields.find(f => f.name === 'phone'),
        persFields.find(f => f.name === 'email'),
        persFields.find(f => f.name === 'presentAddress'),
        persFields.find(f => f.name === 'city'),
        persFields.find(f => f.name === 'pinCode'),
        persFields.find(f => f.name === 'state'),
        persFields.find(f => f.name === 'country')
      ].filter(Boolean) as FieldDefinition[];

      sections.push({ title: 'Loan Details', fields: orderedLoan });
      sections.push({ title: 'Personal Details', fields: orderedPers });

      if (remaining.length > 0) {
        sections.push({ title: 'Additional Details', fields: remaining });
      }
    } else {
      sections.push({ title: `${activeModule?.singularLabel || 'Record'} Details`, fields: fields });
    }

    return sections;
  };

  if (!activeModule || loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 rounded animate-shimmer"></div>
        <div className="h-64 rounded-lg animate-shimmer"></div>
      </div>
    );
  }

  const sections = groupFields(activeModule.fields);

  return (
    <div className="space-y-6 max-w-6xl mx-auto text-left">
      
      {/* breadcrumbs */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-450 uppercase tracking-widest">
        <Link to={`/modules/${activeModule.apiPath}`} className="hover:text-emerald-500 transition-colors">
          {activeModule.pluralLabel}
        </Link>
        <Icons.ChevronRight className="w-3.5 h-3.5 text-slate-600" />
        <span className="text-slate-500 dark:text-slate-400">
          {id ? `Edit: ${recordName}` : `New ${activeModule.singularLabel}`}
        </span>
      </div>

      {/* Main card box with emerald top border */}
      <div className={isLeads 
        ? "bg-slate-50 border border-slate-200 rounded-2xl shadow-xl overflow-hidden relative"
        : "bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden relative"}>
        {/* Glow accent line at top */}
        <div className="bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500 h-1 w-full absolute top-0 left-0" />
        
        {/* Header */}
        <div className={isLeads
          ? "px-8 py-5 border-b border-slate-200 bg-slate-100 flex justify-between items-center mt-1"
          : "px-8 py-5 border-b border-slate-800/80 bg-slate-950/20 flex justify-between items-center mt-1"}>
          <h2 className={isLeads 
            ? "text-lg font-black text-slate-800 tracking-wide uppercase"
            : "text-lg font-black text-white tracking-wide uppercase"}>
            {id ? `Edit ${activeModule.singularLabel}: ${recordName}` : `Create ${activeModule.singularLabel}`}
          </h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmitForm)}>
          
          {sections.map((section) => (
            <div key={section.title} className={isLeads
              ? "p-8 border-b border-slate-200 last:border-b-0 space-y-5"
              : "p-8 border-b border-slate-800/80 last:border-b-0 space-y-5"}>
              <div className="flex items-center gap-3 pb-2 mb-4">
                <div className="w-1.5 h-4.5 bg-gradient-to-b from-[#97ff00] to-[#10b981] rounded-full shadow-[0_0_8px_rgba(151,255,0,0.5)]"></div>
                <h3 className={`text-sm font-bold uppercase tracking-widest ${isLeads ? 'text-slate-800' : 'text-slate-200'}`}>
                  {section.title}
                </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">
                {section.fields.map((field) => renderField(field))}
              </div>
            </div>
          ))}

          {/* Centered actions footer */}
          <div className={isLeads
            ? "p-8 bg-slate-100 border-t border-slate-200 flex items-center justify-center gap-4"
            : "p-8 bg-slate-950/30 border-t border-slate-800/80 flex items-center justify-center gap-4"}>
            <Link
              to={`/modules/${activeModule.apiPath}`}
              className={isLeads
                ? "px-7 py-3 bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase rounded-xl tracking-widest transition-all duration-200 shadow-md"
                : "px-7 py-3 bg-red-950/40 hover:bg-red-900/50 border border-red-500/30 hover:border-red-500/50 text-red-400 text-xs font-bold uppercase rounded-xl tracking-widest transition-all duration-200 shadow-md"}
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className={isLeads
                ? "px-7 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase rounded-xl tracking-widest transition-all duration-200 flex items-center gap-1.5 shadow-md"
                : "px-7 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-450 hover:to-teal-450 hover:shadow-[0_0_25px_rgba(16,185,129,0.35)] text-white text-xs font-bold uppercase rounded-xl tracking-widest transition-all duration-200 flex items-center gap-1.5 shadow-md"}
            >
              {saving && <Icons.Loader className="w-3.5 h-3.5 animate-spin" />}
              Save
            </button>
          </div>

        </form>

      </div>

      {/* Attachments & Audit below card (only in Edit mode) */}
      {id && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Attachments panel */}
          <div className={isLeads ? "bg-slate-50 border border-slate-200 rounded-lg p-5 shadow-md" : "bg-slate-900 border border-slate-800 rounded-lg p-5 shadow-lg"}>
            <div className="flex justify-between items-center mb-4">
              <h4 className={isLeads ? "text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5" : "text-xs font-bold text-slate-405 uppercase tracking-wider flex items-center gap-1.5"}>
                <Icons.Paperclip className="w-4 h-4 text-emerald-500" /> Attachments
              </h4>
              <label className={isLeads ? "text-[10px] font-bold text-emerald-600 hover:text-emerald-500 hover:underline cursor-pointer flex items-center gap-1" : "text-[10px] font-bold text-emerald-555 hover:underline cursor-pointer flex items-center gap-1"}>
                {uploadingDoc ? (
                  <Icons.Loader className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Icons.Plus className="w-3 h-3" /> Upload File
                  </>
                )}
                <input type="file" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>

            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc._id} className={isLeads ? "p-3 bg-white rounded border border-slate-200 flex items-center justify-between group" : "p-3 bg-slate-950/40 rounded border border-slate-800/60 flex items-center justify-between group"}>
                  <div className="flex items-center gap-2 truncate">
                    <Icons.File className="w-4 h-4 text-slate-500" />
                    <div className="truncate text-left">
                      <a
                        href={`http://localhost:5000${doc.filePath}`}
                        target="_blank"
                        rel="noreferrer"
                        className={isLeads ? "text-xs font-semibold text-slate-800 hover:text-emerald-600 hover:underline truncate block" : "text-xs font-semibold text-slate-300 hover:text-emerald-500 hover:underline truncate block"}
                      >
                        {doc.name}
                      </a>
                      <span className={isLeads ? "text-[9px] text-slate-500 block" : "text-[9px] text-slate-555 block"}>
                        {Math.round(doc.size / 1024)} KB • Version {doc.version}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setEditingDocId(doc._id);
                        setEditingDocName(doc.name);
                      }}
                      className="p-1 text-slate-500 hover:bg-slate-100 rounded transition-colors"
                      title="Rename file"
                    >
                      <Icons.Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteDoc(doc._id)}
                      className="p-1 text-red-500 hover:bg-red-500/10 rounded transition-colors"
                      title="Delete file"
                    >
                      <Icons.Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {documents.length === 0 && (
                <div className={isLeads ? "py-6 text-center text-xs text-slate-500 border border-dashed rounded border-slate-200" : "py-6 text-center text-xs text-slate-650 border border-dashed rounded border-slate-800"}>
                  No files attached.
                </div>
              )}
            </div>
          </div>

          {/* Activity History panel */}
          <div className={isLeads ? "bg-slate-50 border border-slate-200 rounded-lg p-5 shadow-md" : "bg-slate-900 border border-slate-800 rounded-lg p-5 shadow-lg"}>
            <h4 className={isLeads ? "text-xs font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-1.5 border-b border-slate-200 pb-2" : "text-xs font-bold text-slate-405 uppercase tracking-wider mb-4 flex items-center gap-1.5 border-b border-slate-800 pb-2"}>
              <Icons.History className="w-4 h-4 text-emerald-500" /> Activity History
            </h4>

            <div className={isLeads ? "relative pl-4 border-l border-slate-200 space-y-4 max-h-[300px] overflow-y-auto" : "relative pl-4 border-l border-slate-800 space-y-4 max-h-[300px] overflow-y-auto"}>
              {timeline.map((item) => (
                <div key={item._id} className="relative text-left text-xs">
                  <div className="absolute -left-[23px] top-1 w-2.5 h-2.5 rounded-full border border-slate-900 bg-emerald-500"></div>
                  <p className={isLeads ? "font-semibold text-slate-800" : "font-semibold text-slate-350"}>
                    {item.userId?.firstName} {item.userId?.lastName}
                  </p>
                  <p className={isLeads ? "text-[10px] text-slate-500 mt-0.5" : "text-[10px] text-slate-550 mt-0.5"}>{item.type} change</p>
                  {item.details?.fieldName && (
                    <p className={isLeads ? "text-slate-600 mt-1" : "text-slate-400 mt-1"}>
                      Changed <span className={isLeads ? "font-medium text-slate-750" : "font-medium text-slate-300"}>{item.details.fieldName}</span> from{' '}
                      <span className="font-semibold text-rose-500">{String(item.details.oldValue || 'None')}</span> to{' '}
                      <span className="font-semibold text-emerald-500">{String(item.details.newValue)}</span>.
                    </p>
                  )}
                </div>
              ))}
              {timeline.length === 0 && (
                <div className={isLeads ? "text-center py-6 text-xs text-slate-500" : "text-center py-6 text-xs text-slate-600"}>No edits recorded.</div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Premium Rename Document Modal */}
      {editingDocId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="relative w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Rename File Attachment</h3>
            <form onSubmit={handleRenameDocSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">New File Name</label>
                <input
                  type="text"
                  required
                  value={editingDocName}
                  onChange={(e) => setEditingDocName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
              <div className="flex gap-2.5 justify-end">
                <button
                  type="button"
                  onClick={() => setEditingDocId(null)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-650 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-colors shadow-sm"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
