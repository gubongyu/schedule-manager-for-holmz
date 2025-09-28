
import * as attendance from './attendance';
import * as shifts from './shifts';
import * as substitutions from './substitutions';
import * as users from './users';

export type { Attendance, Shift, SubstitutionRequest } from '@/domain';

export const api = {
  attendance,
  shifts,
  substitutions,
  users,
};
