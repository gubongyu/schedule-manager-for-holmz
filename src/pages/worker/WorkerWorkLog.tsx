import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useWorkerWorkLog } from '@/features/work-log/worker/useWorkerWorkLog';
import { WorkLog } from '@/domain';

const WorkerWorkLog: React.FC = () => {
  const { workLogs, loading, err, creating, createWorkLog } = useWorkerWorkLog();

  const [time, setTime] = useState(new Date().toTimeString().slice(0, 5));
  const [content, setContent] = useState('');
  const [floor2, setFloor2] = useState(0);
  const [floor4, setFloor4] = useState(0);
  const [extraNotes, setExtraNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createWorkLog({
      date: new Date().toISOString().slice(0, 10),
      time,
      content,
      floor_2_people: floor2,
      floor_4_people: floor4,
      extra_notes: extraNotes,
    });
    setTime(new Date().toTimeString().slice(0, 5));
    setContent('');
    setFloor2(0);
    setFloor4(0);
    setExtraNotes('');
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">업무 기록</h1>
        <p className="text-muted-foreground mt-2">시간별 업무 내용을 기록하고 확인합니다.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>새 업무 기록</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>시간</Label>
                <Input type="time" value={time} onChange={e => setTime(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>업무 내용</Label>
                <Input value={content} onChange={e => setContent(e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>2층 인원</Label>
                    <div className="flex items-center gap-2">
                        <Button type="button" onClick={() => setFloor2(f => Math.max(0, f - 1))}>-</Button>
                        <Input type="number" value={floor2} onChange={e => setFloor2(Number(e.target.value))} className="text-center" />
                        <Button type="button" onClick={() => setFloor2(f => f + 1)}>+</Button>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label>4층 인원</Label>
                    <div className="flex items-center gap-2">
                        <Button type="button" onClick={() => setFloor4(f => Math.max(0, f - 1))}>-</Button>
                        <Input type="number" value={floor4} onChange={e => setFloor4(Number(e.target.value))} className="text-center" />
                        <Button type="button" onClick={() => setFloor4(f => f + 1)}>+</Button>
                    </div>
                </div>
            </div>
            <div className="space-y-2">
              <Label>기타 특이사항</Label>
              <Textarea value={extraNotes} onChange={e => setExtraNotes(e.target.value)} />
            </div>
            <Button type="submit" disabled={creating}>{creating ? '기록 중...' : '기록 입력'}</Button>
          </form>
        </CardContent>
      </Card>

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
            <div className="space-y-4">
              {workLogs.map(log => (
                <div key={log.id} className="p-4 border rounded-md">
                  <div className="flex justify-between items-center">
                    <p className="font-semibold">{log.date} {log.time}</p>
                  </div>
                  <p><span className="font-semibold">업무 내용:</span> {log.content}</p>
                  <p><span className="font-semibold">2층 인원:</span> {log.floor_2_people}</p>
                  <p><span className="font-semibold">4층 인원:</span> {log.floor_4_people}</p>
                  {log.extra_notes && <p><span className="font-semibold">특이사항:</span> {log.extra_notes}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkerWorkLog;
