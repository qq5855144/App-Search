/**
 * TranslationContext
 * 全局翻译设置：是否开启翻译、目标语言
 * 设置持久化到 AsyncStorage
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translateText } from '@/lib/translateApi';

export type TargetLang = 'zh' | 'en';

interface TranslationContextValue {
  /** 翻译是否启用 */
  enabled: boolean;
  /** 目标语言 */
  targetLang: TargetLang;
  /** 更新设置 */
  setEnabled: (v: boolean) => void;
  setTargetLang: (v: TargetLang) => void;
  /** 翻译单段文本（启用时翻译，否则原文返回） */
  translate: (text: string) => Promise<string>;
}

const TranslationContext = createContext<TranslationContextValue | null>(null);

const KEY_ENABLED = 'oas_translate_enabled';
const KEY_LANG = 'oas_translate_lang';

export function TranslationProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [targetLang, setTargetLangState] = useState<TargetLang>('zh');

  // 读取持久化设置
  useEffect(() => {
    (async () => {
      try {
        const [e, l] = await Promise.all([
          AsyncStorage.getItem(KEY_ENABLED),
          AsyncStorage.getItem(KEY_LANG),
        ]);
        if (e !== null) setEnabledState(e === 'true');
        if (l === 'zh' || l === 'en') setTargetLangState(l);
      } catch { /* 忽略 */ }
    })();
  }, []);

  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    AsyncStorage.setItem(KEY_ENABLED, String(v)).catch(() => {});
  }, []);

  const setTargetLang = useCallback((v: TargetLang) => {
    setTargetLangState(v);
    AsyncStorage.setItem(KEY_LANG, v).catch(() => {});
  }, []);

  // 不在此处检查 ready：translateText 内部的 ensureCacheLoaded() 已处理缓存加载时序，
  // 此处加 ready 守卫会引入竞争条件（ready 变化时 translate 引用更新，但调用方
  // useEffect 若不将 translate 列入依赖，翻译 effect 不会重新执行，导致翻译不生效）
  const translate = useCallback(async (text: string): Promise<string> => {
    if (!enabled || !text?.trim()) return text;
    return translateText(text, targetLang);
  }, [enabled, targetLang]);

  return (
    <TranslationContext.Provider value={{ enabled, targetLang, setEnabled, setTargetLang, translate }}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation(): TranslationContextValue {
  const ctx = useContext(TranslationContext);
  if (!ctx) throw new Error('useTranslation must be inside <TranslationProvider>');
  return ctx;
}
