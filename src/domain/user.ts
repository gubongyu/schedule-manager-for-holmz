export interface Worker {
  id: string;
  name: string;
  department?: string;
  role: 'worker' | 'admin';
}
