import React, { useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import * as Icons from 'lucide-react';
import api from '../services/api';
import { formatDate } from '../utils/dateFormatter';

const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

export default function ReportDetails() {
  const { id } = useParams<{ id: string }>();

  // Fetch report runner data
  const { data, isLoading } = useQuery({
    queryKey: ['report-run', id],
    queryFn: async () => {
      const res = await api.get(`/reports/${id}/run`);
      return res.data;
    },
    enabled: !!id
  });

  const handleExportCSV = () => {
    if (!data?.details || !data?.report) return;

    const cols = data.report.columns.length > 0 
      ? data.report.columns 
      : Object.keys(data.details[0]?.data || {});

    const headers = cols.join(',');
    const rows = data.details.map((row: any) =>
      cols.map((c: string) => `"${String(row.data[c] || '').replace(/"/g, '""')}"`).join(',')
    );

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${data.report.name.replace(/\s+/g, '_')}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 rounded animate-shimmer"></div>
        <div className="h-64 rounded animate-shimmer animate-shimmer"></div>
      </div>
    );
  }

  const { report, chartData, details } = data;
  const cols = report.columns.length > 0 ? report.columns : ['name', 'status', 'email']; // fallbacks

  return (
    <div className="space-y-6 print:p-0">
      
      {/* Header toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase">
          <Link to="/reports" className="hover:text-primary transition-colors">Reports</Link>
          <Icons.ChevronRight className="w-3.5 h-3.5" />
          <span className="text-slate-600 dark:text-slate-350">{report.name}</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button
            onClick={handleExportCSV}
            className="w-full sm:w-auto justify-center px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-sm font-medium transition-all text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
          >
            <Icons.Download className="w-4 h-4" /> Export CSV
          </button>
          <button
            onClick={handlePrint}
            style={{ backgroundColor: 'rgb(var(--color-primary))' }}
            className="w-full sm:w-auto justify-center px-4 py-2 text-white rounded-lg text-sm font-medium hover:brightness-110 flex items-center gap-1.5 transition-all shadow-md"
          >
            <Icons.Printer className="w-4 h-4" /> Export PDF / Print
          </button>
        </div>
      </div>

      <div className="text-left">
        <h1 className="text-2xl uppercase font-bold tracking-tight text-slate-800 dark:text-white">{report.name}</h1>
        <p className="text-sm text-slate-400 mt-1">{report.description || 'No description provided.'}</p>
      </div>

      {/* Render Chart (except if type is table) */}
      {report.chartType !== 'table' && chartData && chartData.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-6 shadow-sm">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 text-left">Aggregated Summary</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              {['bar'].includes(report.chartType) ? (
                <BarChart data={chartData}>
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                  <Bar dataKey="value" fill="rgb(var(--color-primary))" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              ) : ['line'].includes(report.chartType) ? (
                <LineChart data={chartData}>
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="rgb(var(--color-primary))" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              ) : (
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    innerRadius={report.chartType === 'donut' ? 60 : 0}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {chartData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Row detail dataset */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 text-left bg-slate-50/50 dark:bg-slate-900/10">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Detail Row Report</h3>
        </div>
        <div className="overflow-x-auto pb-2 -mx-2 px-2 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[800px] text-left text-sm text-slate-600 dark:text-slate-350">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs font-semibold text-slate-500 uppercase border-b border-slate-200 dark:border-slate-750">
              <tr>
                {cols.map((colName: string) => (
                  <th key={colName} className="px-6 py-3.5">
                    {colName.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}
                  </th>
                ))}
                <th className="px-6 py-3.5">Created Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {details && details.map((row: any) => (
                <tr key={row._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/10 transition-colors">
                  {cols.map((colName: string) => (
                    <td key={colName} className="px-6 py-3.5 font-medium text-slate-850 dark:text-slate-200 truncate max-w-[200px]">
                      {formatDate(row.data[colName]) || '-'}
                    </td>
                  ))}
                  <td className="px-6 py-3.5 text-xs text-slate-400">
                    {formatDate(row.createdAt)}
                  </td>
                </tr>
              ))}
              {(!details || details.length === 0) && (
                <tr>
                  <td colSpan={cols.length + 1} className="py-12 text-center text-slate-400">
                    No matching detail row records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
