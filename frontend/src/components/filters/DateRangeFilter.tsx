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

  function changeStartDate(nextStartDate: string) {
    setStartDate(nextStartDate);
    if (endDate && nextStartDate && nextStartDate > endDate) {
      setEndDate(nextStartDate);
    }
  }

  function changeEndDate(nextEndDate: string) {
    setEndDate(nextEndDate);
    if (startDate && nextEndDate && nextEndDate < startDate) {
      setStartDate(nextEndDate);
    }
  }

  function applyCustomRange() {
    if (!validRange) return;
    onChange(serializeCustomDateRange({ startDate, endDate }));
    setOpen(false);
  }

  return (
    <div className="dateRangeFilter" ref={containerRef}>
      <div className="segment" aria-label="Khoảng thời gian">
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
          Tùy chỉnh
        </button>
      </div>

      {isCustom ? <span className="selectedDateRange">{formatTimeRangeLabel(value)}</span> : null}

      {open ? (
        <div className="dateRangePopover">
          <div className="dateRangeHeader">
            <div>
              <strong>Khoảng ngày tùy chỉnh</strong>
              <span>Chọn ngày hoặc năm bất kỳ</span>
            </div>
            <button className="iconButton" type="button" onClick={() => setOpen(false)} aria-label="Đóng lịch">
              <X size={17} />
            </button>
          </div>

          <div className="quickDateRanges">
            <button type="button" onClick={() => selectLastDays(10)}>10 ngày qua</button>
            <button type="button" onClick={() => selectLastDays(20)}>20 ngày qua</button>
            <button type="button" onClick={() => selectLastDays(30)}>30 ngày qua</button>
          </div>

          <div className="dateInputs">
            <label>
              <span>Ngày bắt đầu</span>
              <input
                type="date"
                value={startDate}
                max={today}
                onChange={(event) => changeStartDate(event.target.value)}
              />
            </label>
            <label>
              <span>Ngày kết thúc</span>
              <input
                type="date"
                value={endDate}
                max={today}
                onChange={(event) => changeEndDate(event.target.value)}
              />
            </label>
          </div>

          <div className="dateRangeFooter">
            <span>
              {validRange
                ? `Đã chọn ${dayCount} ngày`
                : 'Hãy chọn khoảng ngày hợp lệ'}
            </span>
            <button
              className="primaryButton"
              type="button"
              disabled={!validRange}
              onClick={applyCustomRange}
            >
              <Check size={15} />
              Áp dụng
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
