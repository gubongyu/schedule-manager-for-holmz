import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAdminWorkLogReport } from '@/features/reporting/admin/useAdminWorkLogReport';

const AdminWorkLogReport: React.FC = () => {
  const { workLogs, loading, err } = useAdminWorkLogReport();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">업무 기록 보고서</h1>
        <p className="text-muted-foreground mt-2">모든 근무자의 업무 기록을 확인합니다.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>업무 기록 목록</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Loading...</p>
          ) : err ? (
            <p>{err}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border border-border rounded-md">
                <thead className="bg-muted">
                  <tr className="text-left">
                    <th className="px-3 py-2 border-b border-border">근무자</th>
                    <th className="px-3 py-2 border-b border-border">날짜</th>
                    <th className="px-3 py-2 border-b border-border">시간</th>
                    <th className="px-3 py-2 border-b border-border">업무 내용</th>
                    <th className="px-3 py-2 border-b border-border">2층 인원</th>
                    <th className="px-3 py-2 border-b border-border">4층 인원</th>
                    <th className="px-3 py-2 border-b border-border">특이사항</th>
                  </tr>
                </thead>
                <tbody>
                  {workLogs.map(log => (
                    <tr key={log.id} className="hover:bg-muted/50">
                      <td className="px-3 py-2 border-b border-border">{log.profiles.username}</td>
                      <td className="px-3 py-2 border-b border-border">{log.date}</td>
                      <td className="px-3 py-2 border-b border-border">{log.time}</td>
                      <td className="px-3 py-2 border-b border-border">{log.content}</td>
                      <td className="px-3 py-2 border-b border-border">{log.floor_2_people}</td>
                      <td className="px-3 py-2 border-b border-border">{log.floor_4_people}</td>
                      <td className="px-3 py-2 border-b border-border">{log.extra_notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminWorkLogReport;
