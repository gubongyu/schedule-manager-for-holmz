// src/pages/admin/AdminReport.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import * as shiftApi from "@/lib/api/shifts";
import { listWorkers } from "@/lib/api/users";

type Shift = {
  id?: number;
  date: string;     // 'YYYY-MM-DD'
  start: string;    // 'HH:MM'
  end: string;      // 'HH:MM'
  workerId?: string;
  workerName?: string;
};

type Row = {
  workerId: string;
  name: string;
  department?: string;
  minutes: number;
  shifts: number;
};

const getLocalMonthKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};

const hhmmToMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  // 24:00 같은 엣지 케이스 처리
  if (h === 24 && m === 0) return 24 * 60;
  return h * 60 + m;
};

const diffMinutes = (start: string, end: string) => {
  const s = hhmmToMinutes(start);
  let e = hhmmToMinutes(end);
  if (e <= s) e += 24 * 60; // 자정 넘김(야간) 처리
  return e - s;
};

const minutesToHHhMM = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
};

const generateMonthOptions = () => {
  const opts: { value: string; label: string }[] = [];
  const currentYear = new Date().getFullYear();
  for (let year = currentYear - 1; year <= currentYear + 1; year++) {
    for (let month = 1; month <= 12; month++) {
      const value = `${year}-${String(month).padStart(2, "0")}`;
      const label = `${year}년 ${month}월`;
      opts.push({ value, label });
    }
  }
  return opts;
};

const MonthlyHoursReport: React.FC = () => {
  const [monthKey, setMonthKey] = useState<string>(getLocalMonthKey(new Date()));
  const [monthShifts, setMonthShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 근무자 맵 (id → {name, department})
  const [workers, setWorkers] = useState<Array<{ id: string; name: string; department?: string }>>([]);

  useEffect(() => {
    (async () => {
      try {
        const ws = await listWorkers();
        const normalized = ws.map((w: any) => ({
          id: w.id,
          name: w.name ?? w.username ?? "이름없음",
          department: w.department,
        }));
        setWorkers(normalized);
      } catch (e) {
        // 이름 매핑 실패해도 보고서 집계는 진행됨
        console.error(e);
      }
    })();
  }, []);

  const userMap = useMemo(() => {
    const map = new Map<string, { name: string; department?: string }>();
    workers.forEach((u) => map.set(u.id, { name: u.name, department: u.department }));
    return map;
  }, [workers]);

  // 월별 시프트 로드
  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const rows = await shiftApi.getShiftsByMonth(monthKey);
        setMonthShifts(rows ?? []);
      } catch (e: any) {
        setErr(e?.message ?? "근무표를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, [monthKey]);

  const rows = useMemo<Row[]>(() => {
    const acc = new Map<string, Row>();

    for (const s of monthShifts) {
      const wId = s.workerId ?? ""; // 미배정은 카운트 제외
      if (!wId) continue;

      const addMin = diffMinutes(s.start, s.end);
      const existing = acc.get(wId);
      const meta = userMap.get(wId);
      const name = s.workerName ?? meta?.name ?? "미상";
      const department = meta?.department;

      if (existing) {
        existing.minutes += addMin;
        existing.shifts += 1;
      } else {
        acc.set(wId, { workerId: wId, name, department, minutes: addMin, shifts: 1 });
      }
    }

    return Array.from(acc.values()).sort((a, b) => b.minutes - a.minutes);
  }, [monthShifts, userMap]);

  const totalMinutes = useMemo(() => rows.reduce((sum, r) => sum + r.minutes, 0), [rows]);

  const exportCSV = () => {
    const header = ["workerId", "name", "department", "shifts", "total_minutes", "total_hours"];
    const body = rows.map((r) => [
      r.workerId,
      r.name,
      r.department ?? "",
      String(r.shifts),
      String(r.minutes),
      (r.minutes / 60).toFixed(2),
    ]);
    const data = [header, ...body]
      .map((line) => line.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([data], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `monthly-hours-${monthKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4">
      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-xl">월별 근무시간 보고서</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={monthKey} onValueChange={setMonthKey}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="월 선택" />
              </SelectTrigger>
              <SelectContent>
                {generateMonthOptions().map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportCSV}>
              CSV 내보내기
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">불러오는 중...</div>
          ) : err ? (
            <div className="text-sm text-destructive">{err}</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">해당 월에 집계할 근무가 없습니다.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border border-border rounded-md">
                <thead className="bg-muted">
                  <tr className="text-left">
                    <th className="px-3 py-2 border-b border-border">근무자</th>
                    <th className="px-3 py-2 border-b border-border">부서</th>
                    <th className="px-3 py-2 border-b border-border">근무 횟수</th>
                    <th className="px-3 py-2 border-b border-border">총 근무시간</th>
                    <th className="px-3 py-2 border-b border-border">평균/회</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.workerId} className="hover:bg-muted/50">
                      <td className="px-3 py-2 border-b border-border">{r.name}</td>
                      <td className="px-3 py-2 border-b border-border">{r.department ?? "-"}</td>
                      <td className="px-3 py-2 border-b border-border">{r.shifts}</td>
                      <td className="px-3 py-2 border-b border-border font-medium">{minutesToHHhMM(r.minutes)}</td>
                      <td className="px-3 py-2 border-b border-border">
                        {minutesToHHhMM(Math.round(r.minutes / Math.max(1, r.shifts)))}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-muted/40 font-semibold">
                    <td className="px-3 py-2 border-t border-border" colSpan={3}>
                      합계
                    </td>
                    <td className="px-3 py-2 border-t border-border">{minutesToHHhMM(totalMinutes)}</td>
                    <td className="px-3 py-2 border-t border-border">–</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MonthlyHoursReport;
