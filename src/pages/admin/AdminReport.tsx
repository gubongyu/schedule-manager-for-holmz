import React from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useAdminReport, minutesToHHhMM, generateMonthOptions } from "@/features/reporting/admin/useAdminReport";

const MonthlyHoursReport: React.FC = () => {
  const {
    monthKey,
    setMonthKey,
    loading,
    err,
    rows,
    totalMinutes,
    exportCSV,
  } = useAdminReport();

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
                    <tr key={r.profileId} className="hover:bg-muted/50">
                      <td className="px-3 py-2 border-b border-border">{r.username}</td>
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
