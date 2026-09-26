import { Plus, RotateCcw } from "lucide-react";

type HeaderProps = {
  onResetSampleData: () => void;
  onAddLead: () => void;
};

export function Header({ onResetSampleData, onAddLead }: HeaderProps) {
  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-violet-600 flex items-center justify-center text-white font-bold text-base shadow-sm">
                M
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                MyCRM
              </h1>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase rounded bg-violet-50 text-violet-700 border border-violet-200">
                Live
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Instagram Outreach Command Center
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={onResetSampleData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              title="Reset sample leads to original state"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Sample
            </button>

            <button
              type="button"
              onClick={onAddLead}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-violet-600 hover:bg-violet-700 shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Lead
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
