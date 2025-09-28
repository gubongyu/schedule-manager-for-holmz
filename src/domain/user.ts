export interface Profile {
  auth_id: string;
  username: string;
  department?: string;
  role: 'worker' | 'admin';
}