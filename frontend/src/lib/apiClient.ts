export type Deal = {
  id: string;
  company_name: string;
  deal_name?: string;
  deal_description?: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type DealCreateRequest = {
  company_name: string;
  deal_name?: string;
  deal_description?: string;
};

export type DealDocument = {
  id: string;
  file_name: string;
  file_size: number;
  mime_type?: string;
  checksum?: string;
  file_path: string;
  token_count: number;
  is_summarized: boolean;
  summary_text?: string;
  is_too_large: boolean;
  pdf_page_count?: number;
  use_summary_for_generation: boolean;
  native_token_count: number;
  summary_token_count: number;
  processing_status?: string;
};

export type RunStatus = {
  id: string;
  deal_id: string;
  status: string;
  run_mode: string;
  research_mode: string;
  created_at: string;
  started_at?: string;
  finished_at?: string;
  error?: string;
};

export type Artifact = {
  id: string;
  run_id: string;
  kind: string;
  path: string;
  created_at: string;
};

export type DealOm = {
  run_id: string;
  status: string;
  created_at: string;
  finished_at?: string;
  rendered_artifact_id?: string;
  variables_artifact_id?: string;
};

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || response.statusText);
  }
  return (await response.json()) as T;
}

export async function listDeals(): Promise<Deal[]> {
  return fetchJson<Deal[]>("/deals");
}

export async function createDeal(payload: DealCreateRequest): Promise<Deal> {
  return fetchJson<Deal>("/deals", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listDocuments(dealId: string): Promise<DealDocument[]> {
  return fetchJson<DealDocument[]>(`/deals/${dealId}/documents`);
}

export async function uploadDocuments(dealId: string, files: FileList): Promise<DealDocument[]> {
  const formData = new FormData();
  Array.from(files).forEach((file) => formData.append("files", file));
  const response = await fetch(`/deals/${dealId}/documents`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || response.statusText);
  }
  return (await response.json()) as DealDocument[];
}

export async function listRuns(dealId: string): Promise<RunStatus[]> {
  return fetchJson<RunStatus[]>(`/deals/${dealId}/runs`);
}

export async function createRun(dealId: string): Promise<RunStatus> {
  return fetchJson<RunStatus>(`/deals/${dealId}/runs`, {
    method: "POST",
    body: JSON.stringify({
      run_mode: "full",
      research_mode: "none",
      interactive: false,
    }),
  });
}

export async function listArtifacts(dealId: string, runId: string): Promise<Artifact[]> {
  return fetchJson<Artifact[]>(`/deals/${dealId}/runs/${runId}/artifacts`);
}

export async function listOms(dealId: string): Promise<DealOm[]> {
  return fetchJson<DealOm[]>(`/deals/${dealId}/oms`);
}

export async function logout(): Promise<void> {
  await fetch("/auth/logout", { method: "POST", credentials: "include" });
}

