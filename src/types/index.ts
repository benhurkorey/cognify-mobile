export interface User {
  id:        string;
  email:     string;
  full_name: string | null;
  role:      string;
  company_id: string | null;
  avatar_url: string | null;
}

export interface Shift {
  id:         string;
  date:       string;
  start_time: string;
  end_time:   string;
  location:   string;
  status:     "confirmed" | "pending" | "cancelled";
}

export interface TrainingModule {
  id:          string;
  title:       string;
  description: string;
  due_date:    string | null;
  completed:   boolean;
  progress:    number;
}

export interface Alert {
  id:        string;
  title:     string;
  body:      string;
  type:      "info" | "warning" | "urgent";
  read:      boolean;
  created_at: string;
}

export type RootStackParamList = {
  Login: undefined;
  Main:  undefined;
};

export type TabParamList = {
  Home:     undefined;
  Training: undefined;
  Shifts:   undefined;
  HR:       undefined;
  Alerts:   undefined;
};
