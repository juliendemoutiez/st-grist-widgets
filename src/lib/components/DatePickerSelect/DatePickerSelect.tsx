import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import './date-picker-select.scss';

interface DatePickerSelectProps {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  placeholder?: string;
  required?: boolean;
}

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const WEEKDAYS_FR = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function gristTsToDate(value: number | null | undefined): Date | null {
  if (value == null || value === 0) return null;
  return new Date(value > 1e10 ? value : value * 1000);
}

function formatDate(value: number | null | undefined): string {
  const d = gristTsToDate(value);
  if (!d) return '';
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function fromDateUTC(year: number, month: number, day: number): number {
  return Math.floor(Date.UTC(year, month, day) / 1000);
}

function getCalendarDays(year: number, month: number): (Date | null)[] {
  const startDow = ((new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7);
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const days: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(new Date(Date.UTC(year, month, d)));
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

export function DatePickerSelect({ value, onChange, placeholder = 'Choisir une date...', required }: DatePickerSelectProps) {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({ position: 'fixed', visibility: 'hidden' });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const todayYear = now.getUTCFullYear();
  const todayMonth = now.getUTCMonth();
  const todayDay = now.getUTCDate();

  const selectedDate = gristTsToDate(value);

  const [viewYear, setViewYear] = useState(() => selectedDate?.getUTCFullYear() ?? todayYear);
  const [viewMonth, setViewMonth] = useState(() => selectedDate?.getUTCMonth() ?? todayMonth);

  const openDropdown = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const dropW = 228;
      const left = Math.min(rect.left, window.innerWidth - dropW - 4);
      setDropdownStyle({ position: 'fixed', top: rect.bottom + 2, left: Math.max(0, left), width: dropW });
    }
    const d = gristTsToDate(value);
    setViewYear(d?.getUTCFullYear() ?? todayYear);
    setViewMonth(d?.getUTCMonth() ?? todayMonth);
    setOpen(true);
  }, [value, todayYear, todayMonth]);

  const closeDropdown = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (containerRef.current?.contains(t) || dropdownRef.current?.contains(t)) return;
      closeDropdown();
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open, closeDropdown]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') closeDropdown(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, closeDropdown]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };

  const handleDayClick = (day: Date) => {
    onChange(fromDateUTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
    closeDropdown();
  };

  const days = getCalendarDays(viewYear, viewMonth);
  const displayText = formatDate(value);
  const hasValue = value != null && value !== 0;

  return (
    <div className="date-picker-select" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`date-picker-select__trigger${!displayText ? ' date-picker-select__trigger--empty' : ''}`}
        onClick={() => (open ? closeDropdown() : openDropdown())}
      >
        {displayText || placeholder}
      </button>

      {!required && (
        <button
          type="button"
          className="meta-row__hl-edit"
          title="Effacer"
          style={hasValue ? undefined : { visibility: 'hidden' }}
          onClick={() => onChange(null)}
        >
          <span className="material-icons">close</span>
        </button>
      )}

      {open && createPortal(
        <div className="date-picker-select__dropdown" ref={dropdownRef} style={dropdownStyle}>
          <div className="date-picker-select__nav-row">
            <button type="button" className="date-picker-select__nav" onClick={prevMonth}>
              <span className="material-icons">chevron_left</span>
            </button>
            <span className="date-picker-select__month-label">
              {MONTHS_FR[viewMonth]} {viewYear}
            </span>
            <button type="button" className="date-picker-select__nav" onClick={nextMonth}>
              <span className="material-icons">chevron_right</span>
            </button>
          </div>

          <div className="date-picker-select__grid">
            {WEEKDAYS_FR.map((w, i) => (
              <span key={i} className="date-picker-select__weekday">{w}</span>
            ))}
            {days.map((day, i) => {
              if (!day) return <span key={i} />;
              const isToday = day.getUTCFullYear() === todayYear && day.getUTCMonth() === todayMonth && day.getUTCDate() === todayDay;
              const isSelected = selectedDate
                ? day.getUTCFullYear() === selectedDate.getUTCFullYear() &&
                  day.getUTCMonth() === selectedDate.getUTCMonth() &&
                  day.getUTCDate() === selectedDate.getUTCDate()
                : false;
              return (
                <button
                  key={i}
                  type="button"
                  className={[
                    'date-picker-select__day',
                    isToday ? 'date-picker-select__day--today' : '',
                    isSelected ? 'date-picker-select__day--selected' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => handleDayClick(day)}
                >
                  {day.getUTCDate()}
                </button>
              );
            })}
          </div>

          {hasValue && !required && (
            <button
              type="button"
              className="date-picker-select__clear"
              onClick={() => { onChange(null); closeDropdown(); }}
            >
              <span className="material-icons">close</span>
              Effacer
            </button>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
