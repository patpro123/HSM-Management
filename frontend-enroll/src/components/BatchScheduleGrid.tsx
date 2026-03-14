import React, { useState } from 'react';
import { Batch, Instrument } from '../types';

interface BatchScheduleGridProps {
  batches: Batch[];
  instruments: Instrument[];
  selectedBatchIds: Set<string>;
  onToggle: (batchId: string | number, instrumentId: string) => void;
}

// Days shown in the grid (Monday excluded — school closed)
const DAYS = ['TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
const DAY_LABELS: Record<string, string> = {
  TUE: 'Tue', WED: 'Wed', THU: 'Thu', FRI: 'Fri', SAT: 'Sat', SUN: 'Sun',
};

// Weekend-only morning slots (school is open Sat/Sun 10:00–13:00)
const WEEKEND_DAYS = new Set(['SAT', 'SUN']);

const INSTRUMENT_STYLES: Record<string, { card: string; selected: string; badge: string }> = {
  'Keyboard':           { card: 'bg-purple-50 border-purple-200',  selected: 'bg-purple-100 border-purple-500 ring-2 ring-purple-400',  badge: 'bg-purple-200 text-purple-800' },
  'Piano':              { card: 'bg-blue-50 border-blue-200',      selected: 'bg-blue-100 border-blue-500 ring-2 ring-blue-400',        badge: 'bg-blue-200 text-blue-800' },
  'Guitar':             { card: 'bg-green-50 border-green-200',    selected: 'bg-green-100 border-green-500 ring-2 ring-green-400',     badge: 'bg-green-200 text-green-800' },
  'Drums':              { card: 'bg-red-50 border-red-200',        selected: 'bg-red-100 border-red-500 ring-2 ring-red-400',           badge: 'bg-red-200 text-red-800' },
  'Tabla':              { card: 'bg-yellow-50 border-yellow-200',  selected: 'bg-yellow-100 border-yellow-500 ring-2 ring-yellow-400',  badge: 'bg-yellow-200 text-yellow-800' },
  'Violin':             { card: 'bg-pink-50 border-pink-200',      selected: 'bg-pink-100 border-pink-500 ring-2 ring-pink-400',        badge: 'bg-pink-200 text-pink-800' },
  'Hindustani Vocals':  { card: 'bg-orange-50 border-orange-200',  selected: 'bg-orange-100 border-orange-500 ring-2 ring-orange-400',  badge: 'bg-orange-200 text-orange-800' },
  'Carnatic Vocals':    { card: 'bg-amber-50 border-amber-200',    selected: 'bg-amber-100 border-amber-500 ring-2 ring-amber-400',     badge: 'bg-amber-200 text-amber-800' },
};
const DEFAULT_STYLE = { card: 'bg-slate-50 border-slate-200', selected: 'bg-slate-100 border-slate-500 ring-2 ring-slate-400', badge: 'bg-slate-200 text-slate-700' };

function getStyle(instrumentName?: string) {
  return (instrumentName && INSTRUMENT_STYLES[instrumentName]) || DEFAULT_STYLE;
}

interface ParsedSegment {
  day: string;
  start: string;
  end: string;
}

function parseRecurrence(recurrence: string): ParsedSegment[] {
  if (!recurrence) return [];
  return recurrence.split(',').flatMap(seg => {
    const parts = seg.trim().split(/\s+/);
    if (parts.length < 2) return [];
    const day = parts[0].toUpperCase();
    const timeParts = parts[1].split('-');
    if (timeParts.length < 2) return [];
    return [{ day, start: timeParts[0], end: timeParts[1] }];
  });
}

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return m === 0 ? `${hour} ${period}` : `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

function CapacityDots({ count, capacity }: { count: number; capacity: number }) {
  const filled = Math.min(count, capacity);
  const empty = Math.max(0, capacity - filled);
  const isFull = filled >= capacity;
  return (
    <div className="flex items-center gap-0.5 mt-1">
      {Array.from({ length: Math.min(filled, 8) }).map((_, i) => (
        <span key={`f${i}`} className={`text-[8px] leading-none ${isFull ? 'text-red-500' : 'text-indigo-500'}`}>●</span>
      ))}
      {Array.from({ length: Math.min(empty, 8 - Math.min(filled, 8)) }).map((_, i) => (
        <span key={`e${i}`} className="text-[8px] leading-none text-slate-300">●</span>
      ))}
      <span className={`text-[9px] ml-1 font-semibold ${isFull ? 'text-red-500' : 'text-slate-500'}`}>
        {count}/{capacity}
      </span>
    </div>
  );
}

const BatchScheduleGrid: React.FC<BatchScheduleGridProps> = ({
  batches,
  selectedBatchIds,
  onToggle,
}) => {
  const [teacherFilter, setTeacherFilter] = useState<string>('all');

  // Unique teachers derived from batches
  const teachers = Array.from(
    new Map(
      batches
        .filter(b => b.teacher_id && b.teacher_name)
        .map(b => [String(b.teacher_id), b.teacher_name as string])
    ).entries()
  ).sort((a, b) => a[1].localeCompare(b[1]));

  // Apply teacher filter
  const visibleBatches = teacherFilter === 'all'
    ? batches
    : batches.filter(b => String(b.teacher_id) === teacherFilter);

  // Parse each batch into day segments
  const batchSegments = visibleBatches.map(batch => ({
    batch,
    segments: parseRecurrence(batch.recurrence),
  }));

  // Collect unique time slots (start times) sorted ascending
  const allStarts = Array.from(
    new Set(batchSegments.flatMap(({ segments }) => segments.map(s => s.start)))
  ).sort();

  // Build grid: grid[start][day] = batch[]
  const grid: Record<string, Record<string, Batch[]>> = {};
  for (const start of allStarts) {
    grid[start] = {};
    for (const day of DAYS) grid[start][day] = [];
  }
  for (const { batch, segments } of batchSegments) {
    for (const seg of segments) {
      if (grid[seg.start] && grid[seg.start][seg.day] !== undefined) {
        grid[seg.start][seg.day].push(batch);
      }
    }
  }

  // Only show time slots that have at least one batch
  const activeSlots = allStarts.filter(start =>
    DAYS.some(day => grid[start][day].length > 0)
  );

  if (batches.length === 0) {
    return (
      <p className="text-sm text-slate-500 italic py-4">No active batches available.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        {/* Teacher filter */}
        {teachers.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-xs font-semibold text-slate-500">Teacher:</span>
            <button
              type="button"
              onClick={() => setTeacherFilter('all')}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${
                teacherFilter === 'all'
                  ? 'bg-slate-700 text-white border-slate-700'
                  : 'bg-white text-slate-600 border-slate-300 hover:border-slate-500'
              }`}
            >
              All Teachers
            </button>
            {teachers.map(([id, name]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTeacherFilter(id)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${
                  teacherFilter === id
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        {/* Instrument legend */}
        <div className="flex flex-wrap gap-2 mb-3">
          {Object.entries(INSTRUMENT_STYLES).map(([name, style]) => (
            <span key={name} className={`px-2 py-0.5 rounded-full text-xs font-semibold ${style.badge}`}>{name}</span>
          ))}
        </div>

        {activeSlots.length === 0 && (
          <p className="text-sm text-slate-400 italic py-4 text-center">No batches for this teacher.</p>
        )}

        {/* Grid header */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          <div className="text-xs font-semibold text-slate-400 text-right pr-2 pt-1">Time</div>
          {DAYS.map(day => (
            <div key={day} className="text-center text-xs font-bold text-slate-600 py-1 bg-slate-100 rounded">
              {DAY_LABELS[day]}
            </div>
          ))}
        </div>

        {/* Grid rows */}
        {activeSlots.map(start => (
          <div key={start} className="grid grid-cols-7 gap-1 mb-1">
            {/* Time label */}
            <div className="text-xs text-slate-500 text-right pr-2 pt-2 font-medium whitespace-nowrap">
              {formatTime(start)}
            </div>

            {/* Day cells */}
            {DAYS.map(day => {
              const cellBatches = grid[start][day];
              const isMorningSlot = parseInt(start.split(':')[0]) < 14;
              const isWeekdayMorning = isMorningSlot && !WEEKEND_DAYS.has(day);

              if (isWeekdayMorning) {
                return (
                  <div key={day} className="rounded bg-slate-50 border border-slate-100 h-16" />
                );
              }

              if (cellBatches.length === 0) {
                return (
                  <div key={day} className="rounded bg-slate-50 border border-dashed border-slate-200 h-16" />
                );
              }

              return (
                <div key={day} className="space-y-1">
                  {cellBatches.map(batch => {
                    const isSelected = selectedBatchIds.has(String(batch.id));
                    const style = getStyle(batch.instrument_name);
                    const count = Number(batch.student_count ?? 0);
                    const capacity = batch.capacity ?? 8;
                    const isFull = count >= capacity;

                    return (
                      <button
                        key={batch.id}
                        type="button"
                        onClick={() => onToggle(batch.id, String(batch.instrument_id))}
                        disabled={isFull && !isSelected}
                        className={`w-full text-left rounded border p-1.5 transition cursor-pointer relative ${
                          isSelected ? style.selected : style.card
                        } ${isFull && !isSelected ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}`}
                      >
                        {isSelected && (
                          <span className="absolute top-1 right-1 text-green-600 text-xs font-bold">✓</span>
                        )}
                        <p className={`text-[10px] font-bold leading-tight ${style.badge.split(' ')[1]} truncate`}>
                          {batch.instrument_name}
                        </p>
                        <p className="text-[9px] text-slate-600 truncate leading-tight mt-0.5">
                          {batch.teacher_name || 'No teacher'}
                        </p>
                        <CapacityDots count={count} capacity={capacity} />
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}

        <p className="text-xs text-slate-400 mt-3">
          Click a cell to select that batch. Greyed-out cells are at full capacity.
        </p>
      </div>
    </div>
  );
};

export default BatchScheduleGrid;
