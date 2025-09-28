import { useEffect, useMemo, useState } from "react";
import * as shiftApi from "@/lib/api/shifts";
import { listWorkers } from "@/lib/api/users";
import { Shift, Profile } from "@/domain";

type Row = {
  profileId: string;
  username: string;
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
  if (h === 24 && m === 0) return 24 * 60;
  return h * 60 + m;
};

const diffMinutes = (start: string, end: string) => {
  const s = hhmmToMinutes(start);
  let e = hhmmToMinutes(end);
  if (e <= s) e += 24 * 60;
  return e - s;
};

export const minutesToHHhMM = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
};

export const generateMonthOptions = () => {
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

export const useAdminReport = () => {
  const [monthKey, setMonthKey] = useState<string>(getLocalMonthKey(new Date()));
  const [monthShifts, setMonthShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const ps = await listWorkers();
        setProfiles(ps as Profile[]);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const profileMap = useMemo(() => {
    const map = new Map<string, { username: string; department?: string }>();
    profiles.forEach((p) => map.set(p.auth_id, { username: p.username, department: p.department }));
    return map;
  }, [profiles]);

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
      const pId = s.worker_uid ?? "";
      if (!pId) continue;
      const addMin = diffMinutes(s.start, s.end);
      const existing = acc.get(pId);
      const meta = profileMap.get(pId);
      const username = meta?.username ?? "미상";
      const department = meta?.department;
      if (existing) {
        existing.minutes += addMin;
        existing.shifts += 1;
      } else {
        acc.set(pId, { profileId: pId, username, department, minutes: addMin, shifts: 1 });
      }
    }
    return Array.from(acc.values()).sort((a, b) => b.minutes - a.minutes);
  }, [monthShifts, profileMap]);

  const totalMinutes = useMemo(() => rows.reduce((sum, r) => sum + r.minutes, 0), [rows]);

  const exportCSV = () => {
    const header = ["profileId", "username", "department", "shifts", "total_minutes", "total_hours"];
    const body = rows.map((r) => [
      r.profileId,
      r.username,
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

  return {
    monthKey,
    setMonthKey,
    loading,
    err,
    rows,
    totalMinutes,
    exportCSV,
  };
};
