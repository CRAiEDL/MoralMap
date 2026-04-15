import React, { useCallback, useEffect, useMemo, useState } from "react";
import { withBasePath } from "../utils/basePath";

const API_URL = withBasePath("/api/admin/user-data");

function formatDate(value) {
  if (!value || typeof value !== "string") return "--";
  const asDate = new Date(value);
  if (Number.isNaN(asDate.getTime())) return value;
  return asDate.toLocaleString();
}

function downloadJsonFile(payload) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `user-data-${stamp}.json`;
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function DataManager() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedKey, setExpandedKey] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(API_URL, { credentials: "include" });
      if (!res.ok) {
        throw new Error(`Failed to load user data (${res.status})`);
      }
      const payload = await res.json();
      setItems(Array.isArray(payload?.items) ? payload.items : []);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return items.filter((item) => {
      const matchesQuery =
        !q ||
        `${item.sessionId || ""}`.toLowerCase().includes(q) ||
        `${item.key || ""}`.toLowerCase().includes(q);

      const isComplete = !!item.completedAt;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "completed" && isComplete) ||
        (statusFilter === "incomplete" && !isComplete);

      return matchesQuery && matchesStatus;
    });
  }, [items, searchTerm, statusFilter]);

  const onDownload = () => {
    const exported = {
      exportedAt: new Date().toISOString(),
      count: filteredItems.length,
      records: filteredItems.map((item) => ({
        key: item.key,
        sessionId: item.sessionId,
        data: item.data,
      })),
    };
    downloadJsonFile(exported);
  };

  const onDeleteAll = async () => {
    if (deleteConfirmation !== "DELETE") return;
    setIsDeleting(true);
    setError("");
    setNotice("");

    try {
      const res = await fetch(API_URL, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ confirmation: deleteConfirmation }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || `Failed to delete data (${res.status})`);
      }

      setIsDeleteModalOpen(false);
      setDeleteConfirmation("");
      setExpandedKey(null);
      setNotice(`Deleted ${payload?.deleted ?? 0} record(s).`);
      await loadData();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-sm text-gray-600">Loading data...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">User Data</h2>
          <p className="text-sm text-gray-600">
            Browse, filter, export, and clear records stored under Redis keys matching
            <code className="ml-1 rounded bg-gray-100 px-1 py-0.5">user-data:*</code>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={loadData} className="rounded border px-3 py-1 text-sm">
            Refresh
          </button>
          <button
            onClick={onDownload}
            disabled={!filteredItems.length}
            className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          >
            Download JSON
          </button>
          <button
            onClick={() => {
              setDeleteConfirmation("");
              setIsDeleteModalOpen(true);
            }}
            disabled={!items.length}
            className="rounded bg-red-600 px-3 py-1 text-sm text-white disabled:opacity-50"
          >
            Delete All Data
          </button>
        </div>
      </div>

      {notice && (
        <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded border bg-gray-50 p-3">
        <label className="text-sm text-gray-700">
          Search
          <input
            type="text"
            placeholder="session id or key"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="ml-2 rounded border px-2 py-1"
          />
        </label>
        <label className="text-sm text-gray-700">
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="ml-2 rounded border px-2 py-1"
          >
            <option value="all">All</option>
            <option value="completed">Completed</option>
            <option value="incomplete">Incomplete</option>
          </select>
        </label>
        <span className="text-sm text-gray-600">
          Showing {filteredItems.length} of {items.length} records
        </span>
      </div>

      <div className="overflow-x-auto rounded border">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium text-gray-700">Session</th>
              <th className="px-3 py-2 font-medium text-gray-700">Created</th>
              <th className="px-3 py-2 font-medium text-gray-700">Last Updated</th>
              <th className="px-3 py-2 font-medium text-gray-700">Progress</th>
              <th className="px-3 py-2 font-medium text-gray-700">Survey</th>
              <th className="px-3 py-2 font-medium text-gray-700">Completed</th>
              <th className="px-3 py-2 font-medium text-gray-700">JSON</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {!filteredItems.length && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                  No records match the current filters.
                </td>
              </tr>
            )}
            {filteredItems.map((item) => {
              const isExpanded = expandedKey === item.key;
              return (
                <React.Fragment key={item.key}>
                  <tr>
                    <td className="px-3 py-2 font-mono text-xs">{item.sessionId || "--"}</td>
                    <td className="px-3 py-2">{formatDate(item.createdAt)}</td>
                    <td className="px-3 py-2">{formatDate(item.lastUpdatedAt)}</td>
                    <td className="px-3 py-2">
                      {item.answeredScenarios || 0}/{item.totalScenarios || 0}
                    </td>
                    <td className="px-3 py-2">{item.surveyResponseCount || 0} answers</td>
                    <td className="px-3 py-2">{item.completedAt ? "Yes" : "No"}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => setExpandedKey(isExpanded ? null : item.key)}
                        className="rounded border px-2 py-1 text-xs"
                      >
                        {isExpanded ? "Hide" : "View"}
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={7} className="bg-gray-50 px-3 py-2">
                        <pre className="max-h-80 overflow-auto rounded bg-gray-900 p-3 text-xs text-gray-100">
                          {JSON.stringify(item.data, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded bg-white p-5 shadow-lg">
            <h3 className="text-base font-semibold text-red-700">Delete all user data</h3>
            <p className="mt-2 text-sm text-gray-700">
              This will permanently remove all Redis records under
              <code className="mx-1 rounded bg-gray-100 px-1 py-0.5">user-data:*</code>.
              Type <strong>DELETE</strong> to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder='Type "DELETE"'
              className="mt-3 w-full rounded border px-3 py-2"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="rounded border px-3 py-1 text-sm"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={onDeleteAll}
                disabled={deleteConfirmation !== "DELETE" || isDeleting}
                className="rounded bg-red-600 px-3 py-1 text-sm text-white disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete all data"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
