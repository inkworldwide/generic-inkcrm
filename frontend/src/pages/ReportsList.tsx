import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { useModuleStore } from '../store/moduleStore';
import api from '../services/api';

export default function ReportsList() {
  const { modules } = useModuleStore();

  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDesigner, setShowDesigner] = useState(false);

  // Report designer state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie' | 'donut' | 'table'>('bar');
  const [groupByField, setGroupByField] = useState('');
  const [metricField, setMetricField] = useState('');
  const [aggregation, setAggregation] = useState<'count' | 'sum' | 'avg'>('count');
  
  const [filters, setFilters] = useState<any[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      const res = await api.get('/reports');
      setReports(res.data || []);
    } catch (e) {
      // fallback mock templates
      setReports([
        {
          _id: 'rep_demo_1',
          name: 'Lead Source Breakdown Chart',
          description: 'Tracks lead counts grouped by original capture channel',
          chartType: 'donut',
          moduleId: { pluralLabel: 'Leads' }
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFilter = () => {
    setFilters([...filters, { field: '', operator: 'equals', value: '' }]);
  };

  const handleToggleColumn = (colName: string) => {
    if (selectedColumns.includes(colName)) {
      setSelectedColumns(selectedColumns.filter((c) => c !== colName));
    } else {
      setSelectedColumns([...selectedColumns, colName]);
    }
  };

  const handleSaveReport = async () => {
    if (!name || !moduleId) {
      alert('Name and module selection are required.');
      return;
    }
    try {
      const payload = {
        name,
        description,
        moduleId,
        chartType,
        groupByField,
        metricField: metricField || undefined,
        aggregation,
        filters,
        columns: selectedColumns
      };

      const res = await api.post('/reports', payload);
      setReports([...reports, res.data]);
      setShowDesigner(false);
      resetDesigner();
      loadReports(); // refresh populate module values
    } catch (err) {
      alert('Failed to save report configuration.');
    }
  };

  const resetDesigner = () => {
    setName('');
    setDescription('');
    setModuleId('');
    setChartType('bar');
    setGroupByField('');
    setMetricField('');
    setAggregation('count');
    setFilters([]);
    setSelectedColumns([]);
  };

  const selectedModuleFields = modules.find((m) => m._id === moduleId)?.fields || [];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 rounded animate-shimmer"></div>
        <div className="h-32 rounded animate-shimmer"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white">Saved Reports</h1>
          <p className="text-sm text-slate-500 mt-1">Configure visual chart aggregations and data queries</p>
        </div>
        <button
          onClick={() => {
            resetDesigner();
            setShowDesigner(true);
          }}
          style={{ backgroundColor: 'rgb(var(--color-primary))' }}
          className="px-4 py-2 text-white rounded-lg text-sm font-medium transition-all hover:brightness-110 flex items-center gap-1.5 shadow-md"
        >
          <Icons.Plus className="w-4 h-4" /> Create Report
        </button>
      </div>

      {/* Reports Grid list */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {reports.map((rep) => (
          <div
            key={rep._id}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-5 hover-card-trigger relative text-left flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-500/10 rounded-lg text-primary">
                  {rep.chartType === 'table' ? (
                    <Icons.Table className="w-4 h-4" />
                  ) : (
                    <Icons.BarChart2 className="w-4 h-4" />
                  )}
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {rep.moduleId?.pluralLabel || 'Custom'} Module
                </span>
              </div>

              <h3 className="font-bold text-slate-800 dark:text-white text-sm mt-3">{rep.name}</h3>
              <p className="text-xs text-slate-400 mt-1 truncate">{rep.description || 'No description.'}</p>
            </div>

            <Link
              to={`/reports/${rep._id}`}
              className="mt-6 w-full py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 hover:bg-primary hover:text-white rounded-lg text-center text-xs font-semibold tracking-wide text-slate-700 dark:text-slate-350 block transition-all"
            >
              Run Report
            </Link>
          </div>
        ))}

        {reports.length === 0 && (
          <div className="col-span-3 py-12 text-center border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-500">
            No saved reports found. Click "Create Report" to launch designer.
          </div>
        )}
      </div>

      {/* Report Designer Modal */}
      {showDesigner && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Header */}
            <div className="px-6 py-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white">Visual Report Designer</h3>
              <button onClick={() => setShowDesigner(false)} className="text-slate-400 hover:text-slate-600">
                <Icons.X className="w-6 h-6" />
              </button>
            </div>

            {/* Canvas Body */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-8 text-left text-sm">
              {/* Left Settings Panel */}
              <div className="md:col-span-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-5 space-y-4">
                <h4 className="font-bold text-xs text-slate-450 uppercase tracking-wider">Aggregation Config</h4>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Report Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
                    placeholder="E.g., Students by Grade"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Query Module</label>
                  <select
                    value={moduleId}
                    onChange={(e) => {
                      setModuleId(e.target.value);
                      setSelectedColumns([]);
                    }}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
                  >
                    <option value="">Select source module...</option>
                    {modules.map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.pluralLabel}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Chart Type</label>
                    <select
                      value={chartType}
                      onChange={(e) => setChartType(e.target.value as any)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
                    >
                      <option value="bar">Bar Chart</option>
                      <option value="line">Line Chart</option>
                      <option value="pie">Pie Chart</option>
                      <option value="donut">Donut Chart</option>
                      <option value="table">Table only</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Group By (X-Axis)</label>
                    <select
                      value={groupByField}
                      onChange={(e) => setGroupByField(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
                    >
                      <option value="">No grouping...</option>
                      {selectedModuleFields.map((f) => (
                        <option key={f.name} value={f.name}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Formula Metric</label>
                    <select
                      value={aggregation}
                      onChange={(e) => setAggregation(e.target.value as any)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
                    >
                      <option value="count">Count Rows</option>
                      <option value="sum">Sum Metric</option>
                      <option value="avg">Average Metric</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Metric Field (Y-Axis)</label>
                    <select
                      value={metricField}
                      onChange={(e) => setMetricField(e.target.value)}
                      disabled={aggregation === 'count'}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none disabled:opacity-50"
                    >
                      <option value="">Select number field...</option>
                      {selectedModuleFields
                        .filter((f) => ['number', 'currency'].includes(f.type))
                        .map((f) => (
                          <option key={f.name} value={f.name}>
                            {f.label}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Right Columns & Filters selection panel */}
              <div className="md:col-span-7 space-y-6">
                
                {/* Filters */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-5 space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-xs text-slate-450 uppercase tracking-wider">Matching Filters</h4>
                    <button
                      onClick={handleAddFilter}
                      className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                    >
                      <Icons.Plus className="w-3.5 h-3.5" /> Add Filter
                    </button>
                  </div>

                  {filters.map((f, idx) => (
                    <div key={idx} className="flex gap-2 flex-wrap items-center">
                      <select
                        value={f.field}
                        onChange={(e) => {
                          const updated = [...filters];
                          updated[idx].field = e.target.value;
                          setFilters(updated);
                        }}
                        className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded focus:outline-none"
                      >
                        <option value="">Field...</option>
                        {selectedModuleFields.map((field) => (
                          <option key={field.name} value={field.name}>
                            {field.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={f.operator}
                        onChange={(e) => {
                          const updated = [...filters];
                          updated[idx].operator = e.target.value;
                          setFilters(updated);
                        }}
                        className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded focus:outline-none"
                      >
                        <option value="equals">equals</option>
                        <option value="not_equals">not equals</option>
                        <option value="contains">contains</option>
                      </select>
                      <input
                        type="text"
                        value={f.value}
                        onChange={(e) => {
                          const updated = [...filters];
                          updated[idx].value = e.target.value;
                          setFilters(updated);
                        }}
                        placeholder="match value"
                        className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded focus:outline-none"
                      />
                    </div>
                  ))}
                  {filters.length === 0 && <p className="text-xs text-slate-500">Query all records.</p>}
                </div>

                {/* Columns Selection */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-5 space-y-3">
                  <h4 className="font-bold text-xs text-slate-450 uppercase tracking-wider">Report Columns Table (Select to show)</h4>
                  <div className="flex gap-2 flex-wrap">
                    {selectedModuleFields.map((f) => (
                      <button
                        key={f.name}
                        onClick={() => handleToggleColumn(f.name)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          selectedColumns.includes(f.name)
                            ? 'bg-primary/10 text-primary border-primary'
                            : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => setShowDesigner(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-750 bg-white dark:bg-slate-850 hover:bg-slate-50 rounded-lg text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveReport}
                style={{ backgroundColor: 'rgb(var(--color-primary))' }}
                className="px-5 py-2 text-white rounded-lg text-sm font-medium hover:brightness-110 transition-all shadow-md"
              >
                Save Report Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
