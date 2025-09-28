import { useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { useScheduleCalendar } from '../shared/useScheduleCalendar';

export const useAdminCalendar = () => {
  const shared = useScheduleCalendar();
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [dayModalDate, setDayModalDate] = useState<string | null>(null);

  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<string>('');
  const [selectedStartTime, setSelectedStartTime] = useState<string | null>(null);
  const [selectedEndTime, setSelectedEndTime] = useState<string | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [dragDateString, setDragDateString] = useState<string | null>(null);
  const [dragStartTime, setDragStartTime] = useState<string | null>(null);
  const [dragEndTime, setDragEndTime] = useState<string | null>(null);

  const timeToMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const onOpenDayModal = (date: string) => {
    setDayModalDate(date);
    setIsDayModalOpen(true);
  };

  const onMouseDownCell = (dateString: string, time: string) => {
    setIsDragging(true);
    setDragDateString(dateString);
    setDragStartTime(time);
    setDragEndTime(time);
  };

  const onMouseEnterCell = (dateString: string, time: string) => {
    if (!isDragging || dateString !== dragDateString) return;
    setDragEndTime(time);
  };

  const onMouseUpGrid = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (!dragDateString || !dragStartTime || !dragEndTime) return;

    const a = timeToMinutes(dragStartTime);
    const b = timeToMinutes(dragEndTime);
    setSelectedDate(dragDateString);
    setSelectedStartTime(a <= b ? dragStartTime : dragEndTime);
    setSelectedEndTime(a <= b ? dragEndTime : dragStartTime);
    setIsAssignDialogOpen(true);

    setDragDateString(null);
    setDragStartTime(null);
    setDragEndTime(null);
  };

  const handleAssignWorker = async () => {
    if (!selectedDate || !selectedWorker || !selectedStartTime || !selectedEndTime) return;

    // TODO: Implement api.shifts.assignShift
    toast({ title: '[DEMO] 근무자 배정', description: `(실제 API 연동 필요) ${selectedWorker}님을 ${selectedDate} ${selectedStartTime}-${selectedEndTime}에 배정합니다.` });
    await shared.refreshShiftsForMonth(selectedDate.slice(0, 7));
    setIsAssignDialogOpen(false);
    setSelectedWorker('');
  };

  return {
    ...shared,
    // Day modal
    isDayModalOpen,
    setIsDayModalOpen,
    dayModalDate,
    onOpenDayModal,
    // Assign modal
    isAssignDialogOpen,
    setIsAssignDialogOpen,
    selectedDate,
    selectedWorker,
    setSelectedWorker,
    selectedStartTime,
    selectedEndTime,
    handleAssignWorker,
    // Drag state
    isDragging,
    dragDateString,
    dragStartTime,
    dragEndTime,
    onMouseDownCell,
    onMouseEnterCell,
    onMouseUpGrid,
  };
};