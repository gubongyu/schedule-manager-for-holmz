
import * as attendance from './attendance';
import * as shifts from './shifts';
import * as substitutions from './substitutions';
import * as users from './users';

export type { Attendance } from './attendance';
export type { Shift } from './shifts';
export type { SubstitutionRequest } from './substitutions';

export const api = {
  attendance,
  shifts,
  substitutions,
  users,
};
