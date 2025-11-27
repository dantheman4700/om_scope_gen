/**
 * API Client for M&A Platform
 * REST API client for Express backend
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Token management
let authToken: string | null = localStorage.getItem('auth_token');

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
}

export function getAuthToken(): string | null {
  return authToken;
}

// Generic fetch wrapper with auth
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (authToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

// File upload helper
async function uploadFile(
  type: 'pitch-deck' | 'patent-file',
  file: File
): Promise<{ url: string; path: string; filename: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/upload/${type}`, {
    method: 'POST',
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Upload failed');
  }

  return data.file;
}

// ============ Auth API ============

export interface User {
  id: string;
  email: string;
  fullName: string | null;
  roles: string[];
}

export interface AuthResponse {
  user: User;
  token: string;
}

export const auth = {
  async signUp(email: string, password: string, fullName: string): Promise<AuthResponse> {
    const data = await apiFetch<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, fullName }),
    });
    setAuthToken(data.token);
    return data;
  },

  async signIn(email: string, password: string): Promise<AuthResponse> {
    const data = await apiFetch<AuthResponse>('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAuthToken(data.token);
    return data;
  },

  async signOut(): Promise<void> {
    await apiFetch('/auth/signout', { method: 'POST' });
    setAuthToken(null);
  },

  async getMe(): Promise<{ user: User }> {
    return apiFetch('/auth/me');
  },

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return !!authToken;
  },
};

// ============ Listings API ============

export interface Listing {
  id: string;
  tenant_id: string;
  slug: string;
  title: string;
  description: string | null;
  industry: string | null;
  location: string | null;
  company_name: string | null;
  company_website: string | null;
  revenue: number | null;
  ebitda: number | null;
  asking_price: number | null;
  visibility_level: string;
  is_anonymized: boolean;
  status: string;
  patent_count: number | null;
  patent_file_url: string | null;
  patents: string[] | null;
  trademarks: string[] | null;
  copyrights: string[] | null;
  scraped_data: Record<string, unknown>;
  data_breakdown: Record<string, unknown> | null;
  meta: Record<string, unknown>;
  email_automation_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ListingInput {
  title: string;
  description?: string;
  industry?: string;
  location?: string;
  companyName?: string;
  companyWebsite?: string;
  revenue?: number;
  ebitda?: number;
  askingPrice?: number;
  visibilityLevel?: 'public' | 'private';
  isAnonymized?: boolean;
  status?: 'draft' | 'active' | 'closed' | 'archived';
  sourceCodeRepository?: string;
  patentCount?: number;
  patents?: string[];
  trademarks?: string[];
  copyrights?: string[];
  dataBreakdown?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

export const listings = {
  async list(): Promise<{ listings: Listing[] }> {
    return apiFetch('/listings');
  },

  async get(id: string): Promise<{ listing: Listing }> {
    return apiFetch(`/listings/${id}`);
  },

  async create(data: ListingInput): Promise<{ listing: Listing }> {
    return apiFetch('/listings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: Partial<ListingInput>): Promise<{ listing: Listing }> {
    return apiFetch(`/listings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string): Promise<{ success: boolean }> {
    return apiFetch(`/listings/${id}`, { method: 'DELETE' });
  },
};

// ============ Prospects API ============

export interface Prospect {
  id: string;
  listing_id: string;
  company: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  stage: string;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface ProspectInput {
  listingId: string;
  company: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  stage?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export const prospects = {
  async list(listingId: string): Promise<{ prospects: Prospect[] }> {
    return apiFetch(`/prospects?listing_id=${listingId}`);
  },

  async get(id: string): Promise<{ prospect: Prospect }> {
    return apiFetch(`/prospects/${id}`);
  },

  async create(data: ProspectInput): Promise<{ prospect: Prospect; action: string }> {
    return apiFetch('/prospects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: Partial<Omit<ProspectInput, 'listingId'>>): Promise<{ prospect: Prospect }> {
    return apiFetch(`/prospects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string): Promise<{ success: boolean }> {
    return apiFetch(`/prospects/${id}`, { method: 'DELETE' });
  },
};

// ============ Users API ============

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  roles: string[];
  created_at: string;
}

export const users = {
  async list(): Promise<{ users: UserProfile[] }> {
    return apiFetch('/users');
  },

  async getRoles(userId: string): Promise<{ roles: string[] }> {
    return apiFetch(`/users/${userId}/roles`);
  },

  async addRole(userId: string, role: string): Promise<{ success: boolean }> {
    return apiFetch(`/users/${userId}/roles`, {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
  },

  async removeRole(userId: string, role: string): Promise<{ success: boolean }> {
    return apiFetch(`/users/${userId}/roles/${role}`, { method: 'DELETE' });
  },
};

// ============ Tenants API ============

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  settings: Record<string, unknown>;
  created_at: string;
}

export const tenants = {
  async list(): Promise<{ tenants: Tenant[] }> {
    return apiFetch('/tenants');
  },

  async get(slug: string): Promise<{ tenant: Tenant }> {
    return apiFetch(`/tenants/${slug}`);
  },
};

// ============ Upload API ============

export const upload = {
  pitchDeck: (file: File) => uploadFile('pitch-deck', file),
  patentFile: (file: File) => uploadFile('patent-file', file),
};

// ============ Access Requests API (for NDA workflow) ============

export interface AccessRequest {
  id: string;
  listing_id: string;
  email: string;
  full_name: string;
  company: string | null;
  phone: string | null;
  status: string;
  nda_signed_at: string | null;
  created_at: string;
}

export const accessRequests = {
  async listForListing(listingId: string): Promise<{ accessRequests: AccessRequest[] }> {
    return apiFetch(`/listings/${listingId}/access-requests`);
  },

  async checkNdaAccess(listingId: string, email: string): Promise<{ hasAccess: boolean }> {
    return apiFetch(`/listings/${listingId}/nda-access?email=${encodeURIComponent(email)}`);
  },
};

// ============ Audit Events API ============

export const auditEvents = {
  async listForListing(listingId: string): Promise<{ events: unknown[] }> {
    return apiFetch(`/listings/${listingId}/audit-events`);
  },
};

// ============ Documents API ============

export interface ListingDocument {
  id: string;
  listing_id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  extraction_status: 'pending' | 'processing' | 'completed' | 'failed';
  extracted_text: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  chunk_count?: number;
}

export interface GeneratedDocument {
  id: string;
  listing_id: string;
  template_id: string;
  variables_used: Record<string, string> | null;
  pdf_path: string | null;
  docx_path: string | null;
  generation_status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message: string | null;
  created_at: string;
  template_name?: string;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  description: string | null;
  template_content: string;
  output_formats: string[];
  is_active: boolean;
  created_at: string;
  variable_count?: number;
  variables?: TemplateVariable[];
}

export interface TemplateVariable {
  id: string;
  template_id: string;
  variable_name: string;
  display_name: string | null;
  description: string | null;
  rag_question: string | null;
  fallback_value: string | null;
  variable_type: string;
  required: boolean;
  sort_order: number;
}

export const documents = {
  async upload(listingId: string, files: File[]): Promise<{ success: boolean; documents: ListingDocument[]; message: string }> {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    const response = await fetch(`${API_BASE}/listings/${listingId}/documents`, {
      method: 'POST',
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Upload failed');
    }

    return data;
  },

  async list(listingId: string): Promise<{ documents: ListingDocument[] }> {
    return apiFetch(`/listings/${listingId}/documents`);
  },

  async delete(documentId: string): Promise<{ success: boolean }> {
    return apiFetch(`/documents/${documentId}`, { method: 'DELETE' });
  },

  async generate(listingId: string, templateId: string): Promise<{ success: boolean; generatedDocument: GeneratedDocument; message: string }> {
    return apiFetch(`/listings/${listingId}/generate/${templateId}`, {
      method: 'POST',
    });
  },

  async listGenerated(listingId: string): Promise<{ generatedDocuments: GeneratedDocument[] }> {
    return apiFetch(`/listings/${listingId}/generated`);
  },

  getDownloadUrl(generatedDocId: string, format: 'pdf' | 'docx'): string {
    return `${API_BASE}/generated/${generatedDocId}/download/${format}`;
  },
};

// ============ Templates API ============

export const templates = {
  async list(): Promise<{ templates: DocumentTemplate[] }> {
    return apiFetch('/templates');
  },

  async get(id: string): Promise<{ template: DocumentTemplate }> {
    return apiFetch(`/templates/${id}`);
  },

  async create(data: { name: string; description?: string; templateContent: string; outputFormats?: string[] }): Promise<{ template: DocumentTemplate }> {
    return apiFetch('/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: Partial<{ name: string; description: string; templateContent: string; outputFormats: string[]; isActive: boolean }>): Promise<{ template: DocumentTemplate }> {
    return apiFetch(`/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async addVariable(templateId: string, data: {
    variableName: string;
    displayName?: string;
    description?: string;
    ragQuestion?: string;
    fallbackValue?: string;
    variableType?: string;
    required?: boolean;
    sortOrder?: number;
  }): Promise<{ variable: TemplateVariable }> {
    return apiFetch(`/templates/${templateId}/variables`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deleteVariable(templateId: string, variableId: string): Promise<{ success: boolean }> {
    return apiFetch(`/templates/${templateId}/variables/${variableId}`, { method: 'DELETE' });
  },
};

// Default export with all modules
const api = {
  auth,
  listings,
  prospects,
  users,
  tenants,
  upload,
  accessRequests,
  auditEvents,
  documents,
  templates,
  setAuthToken,
  getAuthToken,
};

export default api;

