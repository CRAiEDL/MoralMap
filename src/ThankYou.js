"use client";

import React, { useEffect, useMemo, useState } from "react";
import ProgressBar from "./ProgressBar";
import { withBasePath } from "./utils/basePath";
import { COUNTRIES } from "./utils/countries";

const computeScenarioCount = (config) => {
  if (!config) return 0;

  if (Array.isArray(config.scenarios)) {
    return config.scenarios.length;
  }

  if (config.scenarios && typeof config.scenarios === "object") {
    const total = Object.keys(config.scenarios).length;
    const configuredTotal =
      typeof config?.settings?.number_of_scenarios === "number"
        ? config.settings.number_of_scenarios
        : total;

    return Math.min(configuredTotal, total);
  }

  return 0;
};

const buildInitialResponses = (surveyQuestions = []) => {
  return surveyQuestions.reduce((acc, field) => {
    if (!field?.name) return acc;

    if (field.type === "multiselect") {
      acc[field.name] = [];
    } else {
      acc[field.name] = "";
    }

    return acc;
  }, {});
};

const ThankYou = () => {
  const sessionId =
    typeof window !== "undefined" ? localStorage.getItem("sessionId") : null;

  const [config, setConfig] = useState(null);
  const [responses, setResponses] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadConfig = async () => {
      try {
        const res = await fetch(withBasePath("/api/route-endpoints"), {
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error("Failed to load survey questions.");
        }

        const data = await res.json();
        setConfig(data);
        setResponses(buildInitialResponses(data?.survey));
      } catch (err) {
        if (err.name === "AbortError") return;
        console.error("Failed to load survey config:", err);
        setError(err.message || "Failed to load survey questions.");
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();

    return () => controller.abort();
  }, []);

  const totalSteps = useMemo(() => {
    const scenarios = computeScenarioCount(config);
    return Math.max(1, scenarios + 1);
  }, [config]);

  const currentStep = Math.max(totalSteps - 1, 0);

  const handleChange = (name, value) => {
    setResponses((prev) => ({ ...prev, [name]: value }));
  };

  const toggleMultiSelectValue = (name, option) => {
    setResponses((prev) => {
      const currentValues = Array.isArray(prev[name]) ? prev[name] : [];
      const nextValues = currentValues.includes(option)
        ? currentValues.filter((item) => item !== option)
        : [...currentValues, option];

      return { ...prev, [name]: nextValues };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch(withBasePath("/api/log-survey"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, responses }),
      });

      const raw = await res.text();
      let payload = {};
      try {
        payload = JSON.parse(raw);
      } catch (parseErr) {
        console.warn("Unexpected survey response payload:", parseErr);
      }

      if (!res.ok || payload?.success === false) {
        throw new Error(payload?.error || "Submission failed");
      }

      const pilotEnabled = !!config?.settings?.pilotEnabled;
      const pilotLink = (config?.settings?.pilotSurveyLink || "").trim();
      if (pilotEnabled && pilotLink) {
        if (typeof window !== "undefined") {
          window.location.href = pilotLink;
          return;
        }
      }

      setSubmitted(true);
    } catch (err) {
      console.error("Could not submit survey:", err);
      setError(err.message || "Could not submit survey. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const surveyQuestions = config?.survey ?? [];

  let content = null;

  if (submitted) {
    content = (
      <div className="flex min-h-[240px] items-center justify-center">
        <p className="text-center text-2xl font-semibold text-gray-800">
          Thank you for your feedback!
        </p>
      </div>
    );
  } else if (isLoading && !config) {
    content = (
      <div className="flex min-h-[240px] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  } else {
    content = (
      <form className="flex w-full flex-col" onSubmit={handleSubmit}>
        <div className="flex-1 overflow-y-auto pr-1">
          {surveyQuestions.length === 0 ? (
            <p className="text-sm text-gray-600">
              No additional survey questions were provided.
            </p>
          ) : (
            surveyQuestions.map((field) => {
              const fieldName = field?.name;
              if (!fieldName) return null;

              const options = field.type === "countries"
                ? COUNTRIES
                : Array.isArray(field?.options)
                  ? field.options
                  : [];

              return (
                <div key={fieldName} className="mb-5">
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    {fieldName}
                  </label>

                  {field.type === "select" || field.type === "countries" ? (
                    options.length > 0 ? (
                      <select
                        value={responses[fieldName] || ""}
                        onChange={(e) => handleChange(fieldName, e.target.value)}
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="" disabled>
                          Select an option
                        </option>
                        {options.map((option, index) => (
                          <option key={`${fieldName}-${index}`} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-sm text-gray-500">No options available.</p>
                    )
                  ) : field.type === "multiselect" ? (
                    options.length > 0 ? (
                      <div className="space-y-2">
                        {options.map((option, index) => {
                          const selectedValues = Array.isArray(responses[fieldName])
                            ? responses[fieldName]
                            : [];
                          const checked = selectedValues.includes(option);

                          return (
                            <label
                              key={`${fieldName}-${index}`}
                              className="flex items-center gap-2 text-sm text-gray-700"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleMultiSelectValue(fieldName, option)}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span>{option}</span>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No options available.</p>
                    )
                  ) : field.type === "textarea" ? (
                    <textarea
                      value={responses[fieldName] || ""}
                      onChange={(e) => handleChange(fieldName, e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={4}
                    />
                  ) : (
                    <input
                      type={field.type || "text"}
                      value={responses[fieldName] || ""}
                      onChange={(e) => handleChange(fieldName, e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
              );
            })
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 w-full rounded-md bg-blue-600 px-4 py-2 font-semibold text-white shadow transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Submitting..." : "Submit"}
        </button>

        {error && (
          <p className="mt-4 text-center text-sm text-red-600">{error}</p>
        )}
      </form>
    );
  }

  return (
    <div className="relative min-h-screen w-full bg-gray-50">
      <ProgressBar currentStep={currentStep} totalSteps={totalSteps} />
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="flex w-full max-w-lg flex-col rounded-lg bg-white p-8 shadow-lg">
          {content}

          <div className="mt-6 border-t border-gray-200 pt-4">
            <div className="flex justify-center">
              <img
                src="/branding/craiedl_logo.png"
                alt="Craiedl logo"
                className="h-10 w-auto object-contain"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThankYou;
