import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/hooks/useSession";
import {
  listDeals,
  createDeal,
  listDocuments,
  uploadDocuments,
  listRuns,
  createRun,
  listArtifacts,
  listOms,
  logout,
  Deal,
  DealDocument,
  RunStatus,
  Artifact,
  DealOm,
} from "@/lib/apiClient";

const Admin = () => {
  const { user } = useSession();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selectedDealId, setSelectedDealId] = useState<string>("");
  const [documents, setDocuments] = useState<DealDocument[]>([]);
  const [runs, setRuns] = useState<RunStatus[]>([]);
  const [artifacts, setArtifacts] = useState<Record<string, Artifact[]>>({});
  const [outputs, setOutputs] = useState<DealOm[]>([]);
  const [newDeal, setNewDeal] = useState({ company_name: "", deal_name: "", deal_description: "" });
  const [uploadFiles, setUploadFiles] = useState<FileList | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadDeals();
  }, []);

  useEffect(() => {
    if (!selectedDealId) {
      setDocuments([]);
      setRuns([]);
      setOutputs([]);
      return;
    }
    Promise.all([loadDocuments(selectedDealId), loadRuns(selectedDealId), loadOutputs(selectedDealId)]).catch(() => null);
  }, [selectedDealId]);

  const selectedDeal = useMemo(
    () => deals.find((deal) => deal.id === selectedDealId),
    [deals, selectedDealId],
  );

  const loadDeals = async () => {
    try {
      const data = await listDeals();
      setDeals(data);
      if (!selectedDealId && data.length > 0) {
        setSelectedDealId(data[0].id);
      }
    } catch (error) {
      console.error(error);
      setMessage("Failed to load deals");
    }
  };

  const loadDocuments = async (dealId: string) => {
    try {
      const data = await listDocuments(dealId);
      setDocuments(data);
    } catch (error) {
      console.error(error);
      setMessage("Failed to load documents");
    }
  };

  const loadRuns = async (dealId: string) => {
    try {
      const data = await listRuns(dealId);
      setRuns(data);
    } catch (error) {
      console.error(error);
      setMessage("Failed to load runs");
    }
  };

  const loadOutputs = async (dealId: string) => {
    try {
      const data = await listOms(dealId);
      setOutputs(data);
    } catch (error) {
      console.error(error);
      setMessage("Failed to load outputs");
    }
  };

  const loadRunArtifacts = async (dealId: string, runId: string) => {
    if (artifacts[runId]) return;
    try {
      const data = await listArtifacts(dealId, runId);
      setArtifacts((prev) => ({ ...prev, [runId]: data }));
    } catch (error) {
      console.error(error);
      setMessage("Failed to load artifacts");
    }
  };

  const handleCreateDeal = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newDeal.company_name.trim()) {
      setMessage("Company name is required");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await createDeal({
        company_name: newDeal.company_name.trim(),
        deal_name: newDeal.deal_name.trim() || undefined,
        deal_description: newDeal.deal_description.trim() || undefined,
      });
      await loadDeals();
      if (selectedDealId) {
        await Promise.all([loadDocuments(selectedDealId), loadRuns(selectedDealId), loadOutputs(selectedDealId)]);
      }
      setNewDeal({ company_name: "", deal_name: "", deal_description: "" });
      setMessage("Deal created");
    } catch (error) {
      console.error(error);
      setMessage("Failed to create deal");
    } finally {
      setBusy(false);
    }
  };

  const handleUploadDocuments = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedDealId || !uploadFiles || uploadFiles.length === 0) {
      setMessage("Select a deal and choose at least one file");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await uploadDocuments(selectedDealId, uploadFiles);
      await Promise.all([loadDocuments(selectedDealId), loadOutputs(selectedDealId)]);
      setUploadFiles(null);
      (event.currentTarget as HTMLFormElement).reset();
      setMessage("Documents uploaded");
    } catch (error) {
      console.error(error);
      setMessage("Failed to upload documents");
    } finally {
      setBusy(false);
    }
  };

  const handleGenerateRun = async () => {
    if (!selectedDealId) return;
    setBusy(true);
    setMessage(null);
    try {
      await createRun(selectedDealId);
      await Promise.all([loadRuns(selectedDealId), loadOutputs(selectedDealId)]);
      setMessage("Run started");
    } catch (error) {
      console.error(error);
      setMessage("Failed to start run");
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await logout();
      window.location.href = "/auth";
    } catch (error) {
      console.error(error);
      setMessage("Failed to sign out");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12">
        <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <p className="text-sm uppercase tracking-widest text-slate-400">Admin</p>
          <h1 className="mt-2 text-3xl font-semibold">Deal & Document Ingestion</h1>
          <p className="mt-2 text-sm text-slate-400">
            Create deals, upload documents, and trigger OM generation. All actions call the FastAPI backend directly.
          </p>
          {message && (
            <div className="mt-4 rounded border border-slate-800 bg-slate-900 px-4 py-2 text-sm">{message}</div>
          )}
          <div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-400 md:mt-0">
            <div>
              <p className="font-semibold text-slate-200">{user?.email}</p>
              <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-800"
              disabled={busy}
            >
              Sign out
            </button>
          </div>
        </header>

        <section className="grid gap-6 md:grid-cols-[280px,1fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="text-lg font-semibold">Deals</h2>
            <div className="mt-4 flex flex-col gap-3">
              {deals.length === 0 && <p className="text-sm text-slate-500">No deals yet</p>}
              {deals.map((deal) => (
                <button
                  key={deal.id}
                  onClick={() => setSelectedDealId(deal.id)}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                    deal.id === selectedDealId
                      ? "border-blue-500/60 bg-blue-950/40"
                      : "border-slate-800 hover:border-slate-600"
                  }`}
                >
                  <div className="font-medium">{deal.company_name}</div>
                  <div className="text-xs text-slate-400">{deal.status}</div>
                </button>
              ))}
            </div>

            <form onSubmit={handleCreateDeal} className="mt-6 flex flex-col gap-3 text-sm">
              <h3 className="font-semibold text-slate-200">Create deal</h3>
              <input
                className="rounded border border-slate-800 bg-slate-900 px-3 py-2"
                placeholder="Company name"
                value={newDeal.company_name}
                onChange={(e) => setNewDeal((prev) => ({ ...prev, company_name: e.target.value }))}
              />
              <input
                className="rounded border border-slate-800 bg-slate-900 px-3 py-2"
                placeholder="Deal label"
                value={newDeal.deal_name}
                onChange={(e) => setNewDeal((prev) => ({ ...prev, deal_name: e.target.value }))}
              />
              <textarea
                className="rounded border border-slate-800 bg-slate-900 px-3 py-2"
                placeholder="Notes"
                rows={3}
                value={newDeal.deal_description}
                onChange={(e) => setNewDeal((prev) => ({ ...prev, deal_description: e.target.value }))}
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {busy ? "Working..." : "Add deal"}
              </button>
            </form>
          </div>

          <div className="space-y-8">
            {selectedDeal ? (
              <>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-semibold">{selectedDeal.company_name}</h2>
                      <p className="text-xs text-slate-400">{selectedDeal.deal_description || "No description"}</p>
                    </div>
                    <button
                      onClick={handleGenerateRun}
                      disabled={busy}
                      className="rounded-lg border border-blue-500 px-4 py-2 text-sm font-semibold text-blue-100 hover:bg-blue-500/20 disabled:opacity-50"
                    >
                      Generate DOC
                    </button>
                  </div>

                  <form onSubmit={handleUploadDocuments} className="mt-4 flex flex-col gap-3 text-sm">
                    <label className="font-semibold text-slate-300">Upload documents</label>
                    <input
                      type="file"
                      multiple
                      onChange={(event) => setUploadFiles(event.target.files)}
                      className="rounded border border-slate-800 bg-slate-900 px-3 py-2"
                    />
                    <button
                      type="submit"
                      disabled={busy}
                      className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold hover:bg-slate-700 disabled:opacity-50"
                    >
                      {busy ? "Processing..." : "Upload & ingest"}
                    </button>
                  </form>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-100">Outputs</h3>
                    <button
                      onClick={() => selectedDealId && loadOutputs(selectedDealId)}
                      className="text-xs text-slate-400 hover:text-slate-200"
                    >
                      Refresh
                    </button>
                  </div>
                  {outputs.length === 0 ? (
                    <p className="text-sm text-slate-500">No OM outputs yet.</p>
                  ) : (
                    <ul className="space-y-3 text-sm">
                      {outputs.map((output) => (
                        <li key={output.run_id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold">{output.status}</p>
                              <p className="text-xs text-slate-500">
                                generated {new Date(output.created_at).toLocaleString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <a
                                href={`/deals/${selectedDealId}/oms/${output.run_id}/download/md`}
                                className="rounded border border-slate-700 px-2 py-1 text-slate-200"
                              >
                                Markdown
                              </a>
                              <a
                                href={`/deals/${selectedDealId}/oms/${output.run_id}/download/docx`}
                                className="rounded border border-slate-700 px-2 py-1 text-slate-200"
                              >
                                Docx
                              </a>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-100">Documents</h3>
                    <button
                      onClick={() => selectedDealId && loadDocuments(selectedDealId)}
                      className="text-xs text-slate-400 hover:text-slate-200"
                    >
                      Refresh
                    </button>
                  </div>
                  {documents.length === 0 ? (
                    <p className="text-sm text-slate-500">No documents uploaded yet.</p>
                  ) : (
                    <ul className="divide-y divide-slate-800 text-sm">
                      {documents.map((doc) => (
                        <li key={doc.id} className="py-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{doc.file_name}</p>
                              <p className="text-xs text-slate-500">
                                {doc.mime_type || "unknown"} · {Math.round(doc.file_size / 1024)} KB
                              </p>
                            </div>
                            <span className="text-xs text-slate-400">
                              {doc.processing_status || (doc.is_summarized ? "summarized" : "pending")}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            tokens: {doc.token_count} · chunks tracked in embeddings
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-100">Runs</h3>
                    <button
                      onClick={() => selectedDealId && loadRuns(selectedDealId)}
                      className="text-xs text-slate-400 hover:text-slate-200"
                    >
                      Refresh
                    </button>
                  </div>
                  {runs.length === 0 ? (
                    <p className="text-sm text-slate-500">No runs for this deal yet.</p>
                  ) : (
                    <ul className="space-y-3 text-sm">
                      {runs.map((run) => (
                        <li key={run.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold">{run.status}</p>
                              <p className="text-xs text-slate-500">
                                started {new Date(run.created_at).toLocaleString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <a
                                href={`/runs/${run.id}/download-docx`}
                                className="rounded border border-slate-700 px-2 py-1 text-slate-200"
                              >
                                DOCX
                              </a>
                              <button
                                onClick={() => selectedDealId && loadRunArtifacts(selectedDealId, run.id)}
                                className="rounded border border-slate-700 px-2 py-1 text-slate-200"
                              >
                                Artifacts
                              </button>
                            </div>
                          </div>
                          {run.error && <p className="mt-1 text-xs text-red-400">{run.error}</p>}
                          {artifacts[run.id] && artifacts[run.id].length > 0 && (
                            <div className="mt-2 space-y-1 text-xs text-slate-400">
                              {artifacts[run.id].map((artifact) => (
                                <div key={artifact.id} className="flex items-center justify-between">
                                  <span>{artifact.kind}</span>
                                  <a
                                    href={`/artifacts/${artifact.id}/download`}
                                    className="text-blue-300 hover:underline"
                                  >
                                    download
                                  </a>
                                </div>
                              ))}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-6 text-center text-sm text-slate-500">
                Select or create a deal to get started.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Admin;

