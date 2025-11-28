import React from "react";

export default function ScenarioTransition({ current, total }) {
  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-gradient-to-br from-white/10 via-white/30 to-white/5 backdrop-blur-sm">
      <div className="scenario-transition-card relative overflow-hidden rounded-3xl bg-white/80 px-8 py-6 shadow-2xl ring-1 ring-white/70">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-indigo-500/10 to-purple-500/5" />
        <div className="relative space-y-4 text-center">
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-gray-500">
            <span className="shimmer-line h-px flex-1 rounded-full bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
            <span className="rounded-full bg-blue-600/10 px-4 py-2 text-blue-700 shadow-sm ring-1 ring-blue-600/10">
              Next Scenario
            </span>
            <span className="shimmer-line h-px flex-1 rounded-full bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
          </div>

          <div className="flex items-baseline justify-center gap-2">
            <span className="text-4xl font-semibold text-gray-900">{current}</span>
            <span className="text-sm font-medium uppercase tracking-[0.3em] text-gray-500">of {total}</span>
          </div>

        </div>
      </div>
    </div>
  );
}
