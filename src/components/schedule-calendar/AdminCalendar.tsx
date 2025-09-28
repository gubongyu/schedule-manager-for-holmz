import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users } from 'lucide-react';
import { useAdminCalendar } from '@/features/schedule-calendar/admin/useAdminCalendar';
import { CalendarView } from './Calendar.view';

export const AdminCalendar: React.FC = () => {
  const hook = useAdminCalendar();

  return (
    <>
      <CalendarView
        userRole="admin"
        {...hook}
        onDayClick={hook.onOpenDayModal}
        onMouseDownCell={hook.onMouseDownCell}
        onMouseEnterCell={hook.onMouseEnterCell}
        onMouseUpGrid={hook.onMouseUpGrid}
      />

      {/* Modals */}
      <Dialog open={hook.isDayModalOpen} onOpenChange={hook.setIsDayModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>당일 근무 스케줄 - {hook.dayModalDate}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {hook.dayModalDate && hook.getShiftsForDate(hook.dayModalDate).length > 0 ? (
              <div className="divide-y border rounded-md">
                {hook.getShiftsForDate(hook.dayModalDate).map((s, idx) => (
                  <div key={`${s.date}-${s.start}-${idx}`} className="p-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{s.start} - {s.end}</div>
                      <div className="text-xs text-muted-foreground">{hook.profiles.find(p => p.auth_id === s.worker_uid)?.username ?? s.worker_uid ?? '미배정'}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <div className="text-sm text-muted-foreground">배정된 근무가 없습니다.</div>}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={hook.isAssignDialogOpen} onOpenChange={hook.setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Users />프로필 배정</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label>날짜</label><div className="mt-1 p-2 bg-muted rounded">{hook.selectedDate}</div></div>
              <div><label>시간</label><div className="mt-1 p-2 bg-muted rounded">{hook.selectedStartTime} - {hook.selectedEndTime}</div></div>
            </div>
            <div>
              <label>프로필 선택</label>
              <Select value={hook.selectedProfileId} onValueChange={hook.setSelectedProfileId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="프로필을 선택하세요" /></SelectTrigger>
                <SelectContent>
                  {hook.profiles.filter(p => p.role === 'worker').map(p => <SelectItem key={p.auth_id} value={p.auth_id}>{p.username}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => hook.setIsAssignDialogOpen(false)}>취소</Button>
              <Button onClick={hook.handleAssignProfile}>저장</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};