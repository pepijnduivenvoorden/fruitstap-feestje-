import React from 'react';
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

function ErrorFallback({ error }: { error: Error }) {
  let errorMessage = "Er is een onverwachte fout opgetreden.";
  
  try {
    // Try to parse Firestore error JSON
    if (error?.message) {
      const parsed = JSON.parse(error.message);
      if (parsed.error) {
        errorMessage = `Firestore Fout: ${parsed.error} (${parsed.operationType} op ${parsed.path})`;
      }
    }
  } catch (e) {
    // Not a JSON error, use raw message
    errorMessage = error?.message || errorMessage;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-red-100 p-6 rounded-full text-red-600 mb-6">
        <AlertTriangle size={48} />
      </div>
      <h1 className="text-2xl font-black text-gray-900 mb-2 uppercase italic tracking-tight">Oeps! Er ging iets mis</h1>
      <p className="text-gray-500 mb-8 max-w-xs mx-auto text-sm leading-relaxed">
        {errorMessage}
      </p>
      <button
        onClick={() => window.location.reload()}
        className="flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold shadow-lg hover:bg-blue-700 transition-all"
      >
        <RefreshCcw size={20} />
        Pagina Vernieuwen
      </button>
    </div>
  );
}

export default function ErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ReactErrorBoundary FallbackComponent={ErrorFallback}>
      {children}
    </ReactErrorBoundary>
  );
}
