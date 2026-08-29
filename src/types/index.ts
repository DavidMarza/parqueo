export type Role = 'admin' | 'staff';

export interface Profile {
  id: string;
  username: string | null;
  full_name: string;
  role: Role;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  code: string;
  description: string;
  category: string;
}

export interface VehicleType {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
}

export interface Owner {
  id: string;
  full_name: string;
  ci: string | null;
  phone: string | null;
  comments: string | null;
}

export interface Vehicle {
  id: string;
  plate: string;
  owner_id: string;
  owner?: Owner;
}

export type ParkingStatus = 'inside' | 'completed';

export interface ParkingRecord {
  id: string;
  vehicle_id: string;
  vehicle_type_id: string;
  entry_at: string;
  exit_at: string | null;
  comments: string | null;
  key_left: boolean;
  photo_path: string | null;
  calculated_amount: number | null;
  charged_amount: number | null;
  status: ParkingStatus;
  created_by: string | null;
  closed_by: string | null;
  created_at: string;
  updated_at: string;
  // relaciones expandidas (joins)
  vehicle?: Vehicle;
  vehicle_type?: VehicleType;
}

export interface TimeRange {
  id: string;
  name: string;
  min_minutes: number;
  max_minutes: number | null;
  active: boolean;
}

export interface Rate {
  id: string;
  vehicle_type_id: string;
  time_range_id: string;
  amount: number;
  active: boolean;
}
