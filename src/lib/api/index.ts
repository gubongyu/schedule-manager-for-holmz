
import * as attendance from './attendance';
import * as shifts from './shifts';
import * as substitutions from './substitutions';
import * as users from './users';
import * as workLogs from './workLogs';

export type { AttendanceLog, Shift, Substitution, SubstitutionApplicant, Profile, WorkLog } from '@/domain';

export const api = {
  attendance,
  shifts,
  substitutions,
  users,
  workLogs,
};
