import React, { useState } from 'react';
import { motion } from 'framer-motion';

export interface FunnelStageData {
  name: string;
  val: number;
  count: number;
  pct: number;
  icon?: React.ComponentType<any>;
  description?: string;
}

interface Props {
  stages: FunnelStageData[];
  maxVal?: number;
}

const FUNNEL_COLORS = [
  { main: '#0D9488', light: '#14B8A6', dark: '#0F766E', text: '#0D9488', bg: 'rgba(13, 148, 136, 0.1)' }, // 01 Teal
  { main: '#6D28D9', light: '#7C3AED', dark: '#5B21B6', text: '#6D28D9', bg: 'rgba(109, 40, 217, 0.1)' }, // 02 Deep Violet
  { main: '#DC2626', light: '#EF4444', dark: '#B91C1C', text: '#DC2626', bg: 'rgba(220, 38, 38, 0.1)' }, // 03 Coral Red
  { main: '#EAB308', light: '#FACC15', dark: '#CA8A04', text: '#CA8A04', bg: 'rgba(234, 179, 8, 0.12)' }, // 04 Yellow Gold
  { main: '#16A34A', light: '#22C55E', dark: '#15803D', text: '#16A34A', bg: 'rgba(22, 163, 74, 0.1)' }, // 05 Emerald Green
  { main: '#8B5CF6', light: '#A78BFA', dark: '#7C3AED', text: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.1)' }, // 06 Violet
  { main: '#EC4899', light: '#F472B6', dark: '#DB2777', text: '#EC4899', bg: 'rgba(236, 72, 153, 0.1)' }  // 07 Pink
];

export default function SalesFunnel3D({ stages, maxVal }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const numStages = Math.min(Math.max(stages.length, 1), 7);
  const displayStages = stages.slice(0, 7);

  // SVG Funnel geometry calculations
  const svgWidth = 420;
  const svgHeight = 440;
  const topRx = 140;
  const topRy = 28;
  const topCenterX = svgWidth / 2;
  const topCenterY = 40;
  
  const bottomPointX = topCenterX;
  const bottomPointY = svgHeight - 15;

  // Calculate slice heights and coordinates
  const funnelHeight = bottomPointY - topCenterY;
  const sliceHeight = funnelHeight / numStages;

  // Staggered indentations for the left side callout leader lines (like reference image)
  const leftIndents = [10, 45, 80, 45, 10, 50, 90];

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-[#EAE4DA] dark:border-slate-800 rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-sm text-left">
      
      {/* Title Header matching the reference typography */}
      <div className="mb-6 pb-4 border-b border-black/[0.06] dark:border-slate-800 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black italic tracking-wider text-[#1C1917] dark:text-white uppercase font-sans">
            SALES FUNNEL
          </h2>
          <p className="text-xs font-semibold text-[#78716C] dark:text-slate-400 mt-0.5">
            Stage-by-stage conversion breakdown & pipeline advancement
          </p>
        </div>
        <span className="text-[11px] font-bold uppercase tracking-widest text-[#4F46E5] bg-indigo-50 dark:bg-indigo-950/50 px-3 py-1 rounded-full border border-indigo-100 dark:border-indigo-900">
          Live Telemetry
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        
        {/* Left Side: Step Callouts with Connecting Lines */}
        <div className="lg:col-span-6 flex flex-col justify-between h-full py-2 space-y-4 sm:space-y-5">
          {displayStages.map((stage, idx) => {
            const colorTheme = FUNNEL_COLORS[idx % FUNNEL_COLORS.length];
            const isHovered = hoveredIdx === idx;
            const indentPx = leftIndents[idx % leftIndents.length];

            return (
              <motion.div
                key={idx}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                animate={{
                  scale: isHovered ? 1.02 : 1,
                  x: isHovered ? 6 : 0
                }}
                transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                style={{ marginLeft: `${indentPx}px` }}
                className={`relative group cursor-pointer transition-all duration-200 pr-2`}
              >
                {/* Step header & details */}
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span 
                      className="text-sm sm:text-base font-extrabold italic tracking-tight uppercase"
                      style={{ color: colorTheme.text }}
                    >
                      Step {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-[#1C1917] dark:text-white">
                      — {stage.name}
                    </span>
                  </div>

                  {/* Metrics & Brief description */}
                  <div className="flex flex-wrap items-center gap-2.5 mt-1">
                    <span className="text-xs sm:text-sm font-black text-[#1C1917] dark:text-white tracking-tight">
                      ₹{Number(stage.val).toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-[#F5F5F4] dark:bg-slate-800 text-[#57534E] dark:text-slate-300 border border-black/[0.06]">
                      {stage.count} Leads
                    </span>
                    <span 
                      className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md"
                      style={{ backgroundColor: colorTheme.bg, color: colorTheme.text }}
                    >
                      {stage.pct}% Conversion
                    </span>
                  </div>
                </div>

                {/* Horizontal Leader Line with Dots extending to the right */}
                <div className="hidden lg:flex items-center mt-2 w-full relative">
                  <div 
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: colorTheme.main }}
                  />
                  <div 
                    className="flex-1 h-[1.5px] transition-all duration-300"
                    style={{ 
                      backgroundColor: isHovered ? colorTheme.main : '#D6D3D1',
                      height: isHovered ? '2px' : '1px'
                    }}
                  />
                  <div 
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: isHovered ? colorTheme.main : '#A8A29E' }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Right Side: 3D Conical Layered Funnel Chart Graphic */}
        <div className="lg:col-span-6 flex items-center justify-center p-2">
          <div className="w-full max-w-[380px] sm:max-w-[420px] aspect-[420/440] relative">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-full filter drop-shadow-xl overflow-visible"
            >
              <defs>
                {/* 3D Cylindrical Gradients for each slice */}
                {FUNNEL_COLORS.map((c, i) => (
                  <linearGradient key={`grad-${i}`} id={`funnel-grad-${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={c.dark} />
                    <stop offset="25%" stopColor={c.light} />
                    <stop offset="60%" stopColor={c.main} />
                    <stop offset="100%" stopColor={c.dark} />
                  </linearGradient>
                ))}

                {/* Top Rim Radial Depth Gradient */}
                <radialGradient id="top-rim-grad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#2DD4BF" />
                  <stop offset="70%" stopColor="#0D9488" />
                  <stop offset="100%" stopColor="#0F766E" />
                </radialGradient>

                {/* Drop shadow filter for 3D slice depth */}
                <filter id="slice-shadow" x="-10%" y="-10%" width="120%" height="130%">
                  <feDropShadow dx="0" dy="4" stdDeviation="3" floodOpacity="0.25" />
                </filter>
              </defs>

              {/* 1. Top Opening Ellipse Disc (3D perspective rim) */}
              <g>
                <ellipse
                  cx={topCenterX}
                  cy={topCenterY}
                  rx={topRx}
                  ry={topRy}
                  fill="url(#top-rim-grad)"
                  stroke="#0F766E"
                  strokeWidth="1.5"
                  className="transition-all duration-300"
                />
                <ellipse
                  cx={topCenterX}
                  cy={topCenterY - 2}
                  rx={topRx * 0.9}
                  ry={topRy * 0.75}
                  fill="#14B8A6"
                  opacity="0.6"
                />
              </g>

              {/* 2. Stacked 3D Funnel Slices */}
              {displayStages.map((_, idx) => {
                const isHovered = hoveredIdx === idx;
                const isLast = idx === numStages - 1;

                // Slice Y bounds
                const yTop = topCenterY + idx * sliceHeight;
                const yBottom = topCenterY + (idx + 1) * sliceHeight;

                // Interpolate slice width (tapering downwards)
                const topWidthFraction = 1 - (idx / numStages);
                const bottomWidthFraction = 1 - ((idx + 1) / numStages);

                const sliceTopWidth = topRx * topWidthFraction;
                const sliceBottomWidth = topRx * bottomWidthFraction;

                const leftTop = topCenterX - sliceTopWidth;
                const rightTop = topCenterX + sliceTopWidth;
                const leftBottom = topCenterX - sliceBottomWidth;
                const rightBottom = topCenterX + sliceBottomWidth;

                // Curve radii for the 3D bottom edge of each slice
                const rySlice = Math.max(8, topRy * (1 - (idx / numStages) * 0.6));

                // Path for this slice with curved 3D bottom
                let pathData = '';
                if (isLast) {
                  // Inverted triangle tip for the bottom slice
                  pathData = `
                    M ${leftTop} ${yTop}
                    L ${rightTop} ${yTop}
                    L ${bottomPointX} ${bottomPointY}
                    Z
                  `;
                } else {
                  // Trapezoid segment with 3D bottom curvature
                  pathData = `
                    M ${leftTop} ${yTop}
                    L ${rightTop} ${yTop}
                    L ${rightBottom} ${yBottom}
                    Q ${topCenterX} ${yBottom + rySlice} ${leftBottom} ${yBottom}
                    Z
                  `;
                }

                const numberY = yTop + sliceHeight * (isLast ? 0.45 : 0.55);

                return (
                  <g 
                    key={idx}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    className="cursor-pointer transition-all duration-300"
                    style={{
                      transform: isHovered ? 'scale(1.03)' : 'scale(1)',
                      transformOrigin: `${topCenterX}px ${numberY}px`
                    }}
                  >
                    {/* The 3D colored slice polygon */}
                    <path
                      d={pathData}
                      fill={`url(#funnel-grad-${idx % FUNNEL_COLORS.length})`}
                      stroke="white"
                      strokeWidth="2.5"
                      filter="url(#slice-shadow)"
                      className="transition-all duration-200"
                    />

                    {/* Centered Large Bold Italic Stage Number (01, 02, 03...) */}
                    <text
                      x={topCenterX}
                      y={numberY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="white"
                      fontFamily="sans-serif"
                      fontWeight="900"
                      fontStyle="italic"
                      fontSize={isLast ? '22' : '26'}
                      letterSpacing="0.05em"
                      className="select-none pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]"
                    >
                      {String(idx + 1).padStart(2, '0')}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

      </div>

    </div>
  );
}
