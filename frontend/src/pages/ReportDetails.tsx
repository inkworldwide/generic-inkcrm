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
    <div className="space-y-6 max-w-6xl mx-auto text-left print:p-0">
      
      {/* Header toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden pb-2">
        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-450 uppercase tracking-widest">
          <Link to="/reports" className="hover:text-indigo-650 transition-colors">Reports</Link>
          <Icons.ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-550">{report.name}</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
          <button
            onClick={handleExportCSV}
            className="btn-secondary-premium h-10 px-4 text-xs font-bold"
          >
            <Icons.Download className="w-4 h-4" /> Export CSV
          </button>
          <button
            onClick={handlePrint}
            className="btn-primary-premium h-10 px-4 text-xs font-bold"
          >
            <Icons.Printer className="w-4 h-4" /> Export PDF / Print
          </button>
        </div>
      </div>

      <div className="text-left">
        <h1 className="text-2xl uppercase font-[800] tracking-tight text-slate-800">{report.name}</h1>
        <p className="text-xs text-slate-400 font-semibold mt-1.5 uppercase tracking-wider leading-relaxed">{report.description || 'No description provided.'}</p>
      </div>

      {/* Render Chart (except if type is table) */}
      {report.chartType !== 'table' && chartData && chartData.length > 0 && (
        <div className="card-premium p-8">
          <h3 className="text-[10px] font-[800] text-slate-400 uppercase tracking-wider mb-6 text-left">Aggregated Summary</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              {['bar'].includes(report.chartType) ? (
                <BarChart data={chartData}>
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                  <Bar dataKey="value" fill="#4F46E5" radius={[4, 4, 0, 0]}>
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
                  <Line type="monotone" dataKey="value" stroke="#4F46E5" strokeWidth={3} dot={{ r: 4 }} />
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
      <div className="card-premium p-0 overflow-hidden text-left shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 text-left bg-slate-50/50">
          <h3 className="text-xs font-[800] text-slate-400 uppercase tracking-wider">Detail Row Report</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-650">
            <thead className="bg-slate-50/50 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-100 h-12">
              <tr>
                {cols.map((colName: string) => (
                  <th key={colName} className="px-6 py-3.5">
                    {colName.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}
                  </th>
                ))}
                <th className="px-6 py-3.5">Created Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {details && details.map((row: any) => (
                <tr key={row._id} className="hover:bg-slate-50/30 transition-colors h-16">
                  {cols.map((colName: string) => (
                    <td key={colName} className="px-6 py-3.5 font-semibold text-slate-700 truncate max-w-[200px]">
                      {formatDate(row.data[colName]) || '-'}
                    </td>
                  ))}
                  <td className="px-6 py-3.5 text-xs text-slate-400 font-semibold">
                    {formatDate(row.createdAt)}
                  </td>
                </tr>
              ))}
              {(!details || details.length === 0) && (
                <tr>
                  <td colSpan={cols.length + 1} className="py-12 text-center text-slate-450 font-semibold italic">
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
