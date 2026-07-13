import React, { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { useModuleStore } from '../store/moduleStore';
import api from '../services/api';
import { useToastStore } from '../store/toastStore';

export default function WorkflowsList() {
  const { modules } = useModuleStore();
  const { showToast, showAlertModal } = useToastStore();

  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);

  // Workflow Editor states
  const [name, setName] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [triggerEvent, setTriggerEvent] = useState<'create' | 'update' | 'delete'>('create');
  const [triggerField, setTriggerField] = useState('');
  const [conditions, setConditions] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    try {
      const res = await api.get('/workflows');
      setWorkflows(res.data || []);
    } catch (e) {
      // fallback mock
      setWorkflows([
        {
          _id: 'wf_demo_1',
          name: 'Qualified Lead Follow-up Action',
          trigger: { event: 'update', fieldTrigger: 'status' },
          conditions: [{ field: 'status', operator: 'equals', value: 'Qualified' }],
          actions: [{ type: 'create_task', params: { title: 'Call Lead Immediate' } }],
          isEnabled: true
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id: string, currentState: boolean) => {
    try {
      await api.put(`/workflows/${id}`, { isEnabled: !currentState });
      setWorkflows(workflows.map((w) => (w._id === id ? { ...w, isEnabled: !currentState } : w)));
      showToast('Workflow status updated successfully.', 'success');
    } catch (err) {
      showToast('Failed to toggle workflow status.', 'error');
    }
  };

  const handleAddCondition = () => {
    setConditions([...conditions, { field: '', operator: 'equals', value: '' }]);
  };

  const handleAddAction = (type: string) => {
    setActions([...actions, { type, params: { title: '', message: '', url: '' } }]);
  };

  const handleSaveWorkflow = async () => {
    if (!name || !moduleId) {
      showToast('Name and module selection are required.', 'warning');
      return;
    }
    try {
      const payload = {
        name,
        moduleId,
        trigger: { event: triggerEvent, fieldTrigger: triggerField || undefined },
        conditions,
        actions,
        isEnabled: true
      };

      const res = await api.post('/workflows', payload);
      setWorkflows([...workflows, res.data]);
      setShowEditor(false);
      resetEditor();
      showAlertModal({
        title: 'Saved Successfully',
        message: 'The new workflow automation has been saved successfully.',
        type: 'success'
      });
    } catch (err) {
      showToast('Failed to save workflow.', 'error');
    }
  };

  const resetEditor = () => {
    setName('');
    setModuleId('');
    setTriggerEvent('create');
    setTriggerField('');
    setConditions([]);
    setActions([]);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 rounded animate-shimmer"></div>
        <div className="h-40 rounded animate-shimmer"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl uppercase font-bold tracking-tight text-slate-800 dark:text-white">Workflow Automations</h1>
          <p className="text-sm text-slate-500 mt-1">IF-Trigger-THEN-Action background automation engine</p>
        </div>
        <button
          onClick={() => {
            resetEditor();
            setShowEditor(true);
          }}
          style={{ backgroundColor: 'rgb(var(--color-primary))' }}
          className="px-4 py-2 text-white rounded-lg text-sm font-medium transition-all hover:brightness-110 flex items-center gap-1.5 shadow-md"
        >
          <Icons.Plus className="w-4 h-4" /> Create Workflow
        </button>
      </div>

      {/* Workflows list grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {workflows.map((wf) => (
          <div
            key={wf._id}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-5 hover-card-trigger relative text-left"
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                  On {wf.trigger.event}
                </span>
                <h3 className="font-bold text-slate-800 dark:text-white text-base mt-2">{wf.name}</h3>
              </div>

              {/* Toggle switch slider */}
              <button
                onClick={() => handleToggle(wf._id, wf.isEnabled)}
                className={`w-10 h-6 rounded-full p-0.5 transition-colors focus:outline-none ${
                  wf.isEnabled ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    wf.isEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Conditions summary description */}
            <div className="mt-4 border-t border-slate-100 dark:border-slate-700/50 pt-3 space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <Icons.CheckCircle className="w-4 h-4 text-emerald-500" />
                <span className="text-slate-500">Conditions:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-350">
                  {wf.conditions.length > 0
                    ? wf.conditions.map((c: any) => `${c.field} ${c.operator} '${c.value}'`).join(' AND ')
                    : 'Execute unconditionally'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Icons.PlayCircle className="w-4 h-4 text-primary" />
                <span className="text-slate-500">Actions:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-350">
                  {wf.actions.map((a: any) => a.type.replace('_', ' ')).join(', ')}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Workflow Visual Builder Overlay Canvas Modal */}
      {showEditor && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal header */}
            <div className="px-6 py-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white">Visual Workflow Builder</h3>
              <button onClick={() => setShowEditor(false)} className="text-slate-400 hover:text-slate-600">
                <Icons.X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Canvas body */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-8">
              
              {/* Settings side menu panel */}
              <div className="md:col-span-4 bg-white dark:bg-slate-800 border border-slate-250/50 dark:border-slate-700/50 rounded-xl p-5 space-y-4 text-left">
                <h4 className="font-semibold text-xs text-slate-400 uppercase tracking-wider">Configure Nodes</h4>
                
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Workflow Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-750 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-slate-800 dark:text-slate-200"
                    placeholder="E.g. Lead Assigned alert"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Target Module</label>
                  <select
                    value={moduleId}
                    onChange={(e) => setModuleId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-750 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-slate-850 dark:text-slate-200"
                  >
                    <option value="">Select module...</option>
                    {modules.map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.pluralLabel}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Event</label>
                    <select
                      value={triggerEvent}
                      onChange={(e) => setTriggerEvent(e.target.value as any)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-750 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-slate-850 dark:text-slate-200"
                    >
                      <option value="create">On Create</option>
                      <option value="update">On Update</option>
                      <option value="delete">On Delete</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Trigger Field</label>
                    <input
                      type="text"
                      value={triggerField}
                      onChange={(e) => setTriggerField(e.target.value)}
                      placeholder="Optional"
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-750 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-slate-850 dark:text-slate-200"
                    />
                  </div>
                </div>
              </div>

              {/* Visual Flow chart node panel */}
              <div className="md:col-span-8 space-y-6 flex flex-col justify-start">
                
                {/* Node 1: Trigger */}
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5 relative text-left">
                  <div className="flex items-center gap-2 mb-2">
                    <Icons.Zap className="w-5 h-5 text-amber-500" />
                    <span className="font-bold text-sm text-amber-600 uppercase tracking-wide">1. TRIGGER NODE</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Runs when a record in <span className="font-semibold text-primary">{modules.find((m) => m._id === moduleId)?.singularLabel || 'Selected Module'}</span> is <span className="font-semibold text-primary">{triggerEvent}d</span>.
                  </p>
                </div>

                {/* Flow connector line */}
                <div className="flex justify-center"><div className="w-0.5 h-6 bg-slate-300 dark:bg-slate-700"></div></div>

                {/* Node 2: Conditions */}
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-5 text-left space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Icons.Filter className="w-5 h-5 text-emerald-500" />
                      <span className="font-bold text-sm text-emerald-600 uppercase tracking-wide">2. CONDITIONS (IF MATCH)</span>
                    </div>
                    <button
                      onClick={handleAddCondition}
                      className="text-xs font-semibold text-emerald-600 hover:underline flex items-center gap-1"
                    >
                      <Icons.Plus className="w-3.5 h-3.5" /> Add Rule
                    </button>
                  </div>

                  {conditions.map((cond, idx) => (
                    <div key={idx} className="flex gap-2 flex-wrap items-center">
                      <input
                        type="text"
                        value={cond.field}
                        onChange={(e) => {
                          const updated = [...conditions];
                          updated[idx].field = e.target.value;
                          setConditions(updated);
                        }}
                        placeholder="FieldName (e.g. status)"
                        className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded focus:outline-none"
                      />
                      <select
                        value={cond.operator}
                        onChange={(e) => {
                          const updated = [...conditions];
                          updated[idx].operator = e.target.value;
                          setConditions(updated);
                        }}
                        className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded focus:outline-none"
                      >
                        <option value="equals">equals</option>
                        <option value="not_equals">not equals</option>
                        <option value="contains">contains</option>
                      </select>
                      <input
                        type="text"
                        value={cond.value}
                        onChange={(e) => {
                          const updated = [...conditions];
                          updated[idx].value = e.target.value;
                          setConditions(updated);
                        }}
                        placeholder="value (e.g. Qualified)"
                        className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded focus:outline-none"
                      />
                    </div>
                  ))}

                  {conditions.length === 0 && (
                    <p className="text-xs text-slate-500">Unconditional. Triggers actions immediately.</p>
                  )}
                </div>

                {/* Flow connector line */}
                <div className="flex justify-center"><div className="w-0.5 h-6 bg-slate-300 dark:bg-slate-700"></div></div>

                {/* Node 3: Actions */}
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-5 text-left space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Icons.PlayCircle className="w-5 h-5 text-primary" />
                      <span className="font-bold text-sm text-indigo-600 uppercase tracking-wide">3. ACTIONS (THEN RUN)</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAddAction('create_task')}
                        className="text-[10px] font-bold px-2 py-1 bg-primary text-white rounded hover:brightness-110"
                      >
                        + CRM Task
                      </button>
                      <button
                        onClick={() => handleAddAction('notification')}
                        className="text-[10px] font-bold px-2 py-1 bg-primary text-white rounded hover:brightness-110"
                      >
                        + In-App Alert
                      </button>
                    </div>
                  </div>

                  {actions.map((act, idx) => (
                    <div key={idx} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg space-y-2">
                      <p className="text-xs font-bold text-primary uppercase">{act.type.replace('_', ' ')}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={act.params.title}
                          onChange={(e) => {
                            const updated = [...actions];
                            updated[idx].params.title = e.target.value;
                            setActions(updated);
                          }}
                          placeholder="Action title"
                          className="px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 bg-transparent rounded"
                        />
                        <input
                          type="text"
                          value={act.params.message}
                          onChange={(e) => {
                            const updated = [...actions];
                            updated[idx].params.message = e.target.value;
                            setActions(updated);
                          }}
                          placeholder="Action detail payload text"
                          className="px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 bg-transparent rounded"
                        />
                      </div>
                    </div>
                  ))}

                  {actions.length === 0 && (
                    <p className="text-xs text-slate-500">Configure actions to execute.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => setShowEditor(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-750 bg-white dark:bg-slate-850 hover:bg-slate-50 rounded-lg text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveWorkflow}
                style={{ backgroundColor: 'rgb(var(--color-primary))' }}
                className="px-5 py-2 text-white rounded-lg text-sm font-medium hover:brightness-110 transition-all shadow-md"
              >
                Publish Automation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
