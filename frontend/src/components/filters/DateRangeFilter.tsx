import { CalendarDays, Check, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { TIME_OPTIONS } from '../../config/googleAds';
import {
  countRangeDays,
  formatTimeRangeLabel,
  getLastDaysRange,
  getTodayInputDate,
  parseCustomDateRange,
  serializeCustomDateRange,
} from '../../utils/dateRange';

type DateRangeFilterProps = {
  value: string;
  onChange: (value: string) => void;
};

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialRange = parseCustomDateRange(value) ?? getLastDaysRange(7);
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);
  const today = getTodayInputDate();
  const isCustom = Boolean(parseCustomDateRange(value));
  const validRange = Boolean(startDate && endDate && startDate <= endDate && endDate <= today);
  const dayCount = validRange ? countRangeDays({ startDate, endDate }) : 0;

  useEffect(() => {
    const customRange = parseCustomDateRange(value);
    if (customRange) {
      setStartDate(customRange.startDate);
      setEndDate(customRange.endDate);
    }
  }, [value]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  function selectPreset(preset: string) {
    setOpen(false);
    onChange(preset);
  }

  function selectLastDays(days: number) {
    const range = getLastDaysRange(days);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  }

  function applyCustomRange() {
    if (!validRange) return;
    onChange(serializeCustomDateRange({ startDate, endDate }));
    setOpen(false);
  }

  return (
    <div className="dateRangeFilter" ref={containerRef}>
      <div className="segment" aria-label="Time range">
        {TIME_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={value === option.value ? 'active' : ''}
            onClick={() => selectPreset(option.value)}
          >
            {option.label}
          </button>
        ))}
        <button
          type="button"
          className={isCustom ? 'active customDateButton' : 'customDateButton'}
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
        >
          <CalendarDays size={15} />
          Custom
        </button>
      </div>

      {isCustom ? <span className="selectedDateRange">{formatTimeRangeLabel(value)}</span> : null}

      {open ? (
        <div className="dateRangePopover">
          <div className="dateRangeHeader">
            <div>
              <strong>Custom date range</strong>
              <span>Select any dates or year</span>
            </div>
            <button className="iconButton" type="button" onClick={() => setOpen(false)} aria-label="Close calendar">
              <X size={17} />
            </button>
          </div>

          <div className="quickDateRanges">
            <button type="button" onClick={() => selectLastDays(10)}>Last 10 days</button>
            <button type="button" onClick={() => selectLastDays(20)}>Last 20 days</button>
            <button type="button" onClick={() => selectLastDays(30)}>Last 30 days</button>
          </div>

          <div className="dateInputs">
            <label>
              <span>Start date</span>
              <input
                type="date"
                value={startDate}
                max={endDate || today}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </label>
            <label>
              <span>End date</span>
              <input
                type="date"
                value={endDate}
                min={startDate}
                max={today}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </label>
          </div>

          <div className="dateRangeFooter">
            <span>
              {validRange
                ? `${dayCount} day${dayCount === 1 ? '' : 's'} selected`
                : 'Choose a valid date range'}
            </span>
            <button
              className="primaryButton"
              type="button"
              disabled={!validRange}
              onClick={applyCustomRange}
            >
              <Check size={15} />
              Apply
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
