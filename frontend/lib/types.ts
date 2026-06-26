export type JobStatus = "pending" | "running" | "done" | "failed";
export type LeadStatus = "new" | "contacted" | "qualified" | "rejected";
export type BusinessSize = "small" | "medium" | "large";

export interface Group {
  id: string;
  name: string;
  color: string;
  lead_count: number;
}

export interface Filters {
  min_rating?: number;
  max_rating?: number;
  has_website?: boolean;
  has_phone?: boolean;
  min_reviews?: number;
  max_reviews?: number;
  business_size_tiers?: BusinessSize[];
  keywords_in_name?: string;
}

export interface SearchJob {
  id: string;
  status: JobStatus;
  keyword: string;
  location: string;
  filters: Filters;
  concurrency: number;
  total_found: number;
  total_scraped: number;
  created_at: string;
  completed_at?: string;
  error_message?: string;
}

export interface Lead {
  id: string;
  search_job_id: string;
  business_name: string;
  category?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  phone?: string;
  website?: string;
  email?: string;
  rating?: number;
  review_count?: number;
  business_size_tier?: BusinessSize;
  latitude?: number;
  longitude?: number;
  google_maps_url?: string;
  status: LeadStatus;
  notes?: string;
  created_at: string;
  groups?: Group[];
}
