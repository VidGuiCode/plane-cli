export interface PlaneAccount {
  name: string;
  baseUrl: string;
  token: string;
  apiStyle: "issues" | "work-items";
  defaultWorkspace?: string;
  defaultProject?: string;
}

// Backward-compat alias (JSON on disk uses `profiles[]`)
export type PlaneProfile = PlaneAccount;

export interface PlaneContext {
  activeProfile?: string;
  activeWorkspace?: string;
  activeProject?: string;
  activeProjectIdentifier?: string;
}

export interface PlaneConfig {
  profiles: PlaneAccount[];
  context: PlaneContext;
}

// API response shapes

export interface PlaneWorkspace {
  id: string;
  name: string;
  slug: string;
  logo?: string;
}

export interface PlaneProject {
  id: string;
  name: string;
  identifier: string;
  description?: string;
  network: number;
  is_member: boolean;
  total_members: number;
  total_cycles: number;
  total_modules: number;
}

export interface PlaneState {
  id: string;
  name: string;
  color: string;
  group: "backlog" | "unstarted" | "started" | "completed" | "cancelled";
}

export interface PlaneIssue {
  id: string;
  sequence_id: number;
  name: string;
  description_html?: string;
  description_stripped?: string;
  state?: PlaneState | string;
  state_detail?: PlaneState;
  priority: "urgent" | "high" | "medium" | "low" | "none" | null;
  labels?: Array<{ id: string; name: string; color: string } | string>;
  label_ids?: string[];
  parent?: string | null;
  assignees?: string[];
  due_date?: string | null;
  start_date?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlaneModule {
  id: string;
  name: string;
  status: string;
}

export interface PlaneLabel {
  id: string;
  name: string;
  color: string;
}

export interface PlaneMember {
  id: string;
  // Flat format (older Plane API)
  member__display_name?: string;
  member__email?: string;
  // Nested format (newer Plane API)
  member?: {
    id: string;
    display_name: string;
    email?: string;
    avatar?: string;
  };
  role: number; // 5=Owner 10=Admin 15=Member 20=Viewer
}

export interface PlaneCycle {
  id: string;
  name: string;
  status?: string;
  start_date?: string | null;
  end_date?: string | null;
}

export interface PlanePage {
  id: string;
  name: string;
  description?: string;
  description_html?: string;
  created_by_detail?: { display_name: string };
  created_at: string;
  updated_at: string;
}

export interface PlaneComment {
  id: string;
  comment_html?: string;
  comment_stripped?: string;
  access?: "INTERNAL" | "EXTERNAL" | string;
  created_by?: string | { display_name?: string };
  created_by_detail?: { display_name?: string };
  actor_detail?: { display_name?: string };
  created_at?: string;
  updated_at?: string;
}

export interface PlanePaginatedResponse<T> {
  results: T[];
  total_count?: number;
  next_cursor?: string;
  prev_cursor?: string;
}
