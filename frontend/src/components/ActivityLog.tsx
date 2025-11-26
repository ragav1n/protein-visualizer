import { ChevronDown, ChevronRight, Clock } from 'lucide-react';
import { useState } from 'react';

export interface LogEntry {
  id: string;
  timestamp: Date;
  action: string;
  data: unknown;
}

interface ActivityLogProps {
  logs: LogEntry[];
}

export function ActivityLog({ logs }: ActivityLogProps) {
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  const toggleLog = (id: string) => {
    setExpandedLogs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  return (
    <div className="bio-card border-teal-200 overflow-hidden">
      <div className="bg-gradient-to-r from-teal-50 to-emerald-50 px-4 py-3 border-b border-teal-100">
        <h3 className="font-bold text-slate-900">Activity Log</h3>
        <p className="text-xs text-slate-500 mt-1">{logs.length} operation{logs.length !== 1 ? 's' : ''}</p>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {logs.length === 0 ? (
          <div className="px-4 py-8 text-center text-slate-500 text-sm font-medium">
            No activity yet. Perform actions to see logs here.
          </div>
        ) : (
          <div className="divide-y divide-teal-50">
            {logs.map((log) => (
              <div key={log.id} className="p-4">
                <button
                  onClick={() => toggleLog(log.id)}
                  className="w-full flex items-start justify-between text-left hover:bg-teal-50/50 -m-4 p-4 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-slate-900">{log.action}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Clock className="w-3 h-3 text-teal-600" />
                      {log.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                  {expandedLogs.has(log.id) ? (
                    <ChevronDown className="w-4 h-4 text-teal-500 flex-shrink-0 mt-1" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-teal-400 flex-shrink-0 mt-1" />
                  )}
                </button>
                {expandedLogs.has(log.id) && (
                  <div className="mt-2 bg-gradient-to-br from-teal-50 to-emerald-50 rounded-lg p-3 overflow-auto border border-teal-100">
                    <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono">
                      {JSON.stringify(log.data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
