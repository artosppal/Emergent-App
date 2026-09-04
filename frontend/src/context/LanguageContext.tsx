import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { storage } from "@/src/utils/storage";
import { translations, Language } from "@/src/i18n/translations";

const STORAGE_KEY = "language";

interface LanguageState {
  language: Language;
  locale: string;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageState | undefined>(undefined);

function lookup(dict: any, key: string): string | undefined {
  let cur = dict;
  for (const part of key.split(".")) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return typeof cur === "string" ? cur : undefined;
}

function interpolate(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? String(vars[k]) : `{{${k}}}`));
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("id");

  useEffect(() => {
    (async () => {
      const saved = await storage.getItem<string>(STORAGE_KEY, "id");
      if (saved === "id" || saved === "en") setLanguageState(saved);
    })();
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    storage.setItem(STORAGE_KEY, lang);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev) => {
      const next: Language = prev === "id" ? "en" : "id";
      storage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const str = lookup(translations[language], key) ?? lookup(translations.id, key) ?? key;
      return interpolate(str, vars);
    },
    [language],
  );

  const value = useMemo(
    () => ({
      language,
      locale: language === "id" ? "id-ID" : "en-US",
      setLanguage,
      toggleLanguage,
      t,
    }),
    [language, setLanguage, toggleLanguage, t],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
