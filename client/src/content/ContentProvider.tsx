// ContentProvider — global content state with live editing support
// Pages read from context; /view writes changes that instantly propagate

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { defaultContent, defaultLanding, type ContentConfig } from "./defaults";

const STORAGE_KEY = "valet-content-overrides";

// Deep merge overrides onto defaults
function mergeContent(base: ContentConfig, overrides: Partial<ContentConfig>): ContentConfig {
  return {
    landing: {
      ...base.landing,
      ...overrides.landing,
      header: { ...base.landing.header, ...(overrides.landing?.header || {}) },
      input: { ...base.landing.input, ...(overrides.landing?.input || {}) },
      confirmation: { ...base.landing.confirmation, ...(overrides.landing?.confirmation || {}) },
      schedule: { ...base.landing.schedule, ...(overrides.landing?.schedule || {}) },
      scheduled: { ...base.landing.scheduled, ...(overrides.landing?.scheduled || {}) },
      faq: { ...base.landing.faq, ...(overrides.landing?.faq || {}) },
      ticketInfo: { ...base.landing.ticketInfo, ...(overrides.landing?.ticketInfo || {}) },
      errors: { ...base.landing.errors, ...(overrides.landing?.errors || {}) },
    },
  };
}

function loadOverrides(): Partial<ContentConfig> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

interface ContentContextValue {
  content: ContentConfig;
  isEditing: boolean;
  startEditing: () => void;
  stopEditing: () => void;
  updateField: (section: string, field: string, value: string) => void;
  resetToDefaults: () => void;
}

const ContentContext = createContext<ContentContextValue>({
  content: defaultContent,
  isEditing: false,
  startEditing: () => {},
  stopEditing: () => {},
  updateField: () => {},
  resetToDefaults: () => {},
});

export function useContent() {
  return useContext(ContentContext);
}

export function ContentProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<Partial<ContentConfig>>(loadOverrides);
  const [isEditing, setIsEditing] = useState(false);

  const content = mergeContent(defaultContent, overrides);

  // Persist overrides to localStorage
  useEffect(() => {
    try {
      if (Object.keys(overrides).length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {}
  }, [overrides]);

  const startEditing = useCallback(() => setIsEditing(true), []);
  const stopEditing = useCallback(() => setIsEditing(false), []);

  const updateField = useCallback((section: string, field: string, value: string) => {
    setOverrides((prev) => ({
      ...prev,
      landing: {
        ...prev.landing,
        [section]: {
          ...(prev.landing as any)?.[section],
          [field]: value,
        },
      },
    }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setOverrides({});
  }, []);

  return (
    <ContentContext.Provider value={{
      content,
      isEditing,
      startEditing,
      stopEditing,
      updateField,
      resetToDefaults,
    }}>
      {children}
    </ContentContext.Provider>
  );
}
