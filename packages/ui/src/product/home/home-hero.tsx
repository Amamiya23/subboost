"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SignalField } from "@subboost/ui/components/effects/signal-field";

const MARQUEE_ITEMS = [
  "CHAINED PROXY",
  "SMART ROUTING",
  "RULE SETS",
  "MULTI-PROTOCOL",
  "AGGREGATION",
  "YAML NATIVE",
  "AUTO UPDATE",
  "MIHOMO",
  "TEMPLATES",
];

/**
 * 首页 Hero：信号实验场（独立落地页版式，占满首屏）。
 * 纯静态、无依赖 props —— animated=false 用作 SSR 骨架，避免水合后动画重播。
 */
export function HomeHero({ animated = true }: { animated?: boolean }) {
  const subClass = animated ? "reveal reveal-d1" : "";
  const boostClass = animated ? "reveal reveal-d2" : "";

  return (
    <section className="relative flex min-h-[calc(100vh-56px)] flex-col overflow-hidden blueprint-grid">
      <SignalField className="pointer-events-none absolute inset-0 h-full w-full" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_0%,var(--background)_88%)]" />

      <div className="relative flex flex-1 flex-col w-full max-w-[clamp(1200px,95vw,2400px)] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 pt-7 lg:pt-9 pb-8 lg:pb-10">
        <div className="mb-6 lg:mb-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <div className="mono-label flex items-center gap-2 text-white/50">
            <span className="live-dot" />
            <span>SIGNAL · LIVE</span>
          </div>
          <div className="mono-label hidden text-white/35 sm:block">SubBoost / SUBSCRIPTION ENGINE</div>
          <div className="mono-label hidden text-white/35 md:block">CLASH · MIHOMO · YAML</div>
        </div>

        <div className="flex flex-1 flex-col justify-center py-6">
          <h1
            className="font-display font-semibold leading-[0.86] tracking-[-0.02em] select-none"
            aria-label="SubBoost"
          >
            <span className={`block text-[clamp(3.8rem,12vw,10rem)] text-bone ${subClass}`}>SUB</span>
            <span className={`block text-[clamp(3.8rem,12vw,10rem)] text-outline ${boostClass}`}>
              BOOST<span className="ml-3 inline-block size-[0.14em] bg-acid align-baseline" aria-hidden="true" />
            </span>
          </h1>

          <div className="mt-8 lg:mt-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-xl">
              <p className="text-[13px] lg:text-sm leading-relaxed text-white/55">
                Clash 订阅转换、生成与管理服务，支持链式代理、智能分流、多协议和多订阅聚合
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href="/builder"
                  className="inline-flex h-11 items-center gap-2 rounded-md bg-acid px-5 text-sm font-semibold text-black transition-all hover:brightness-110 hover:shadow-[0_0_28px_rgba(205,255,77,0.28)]"
                >
                  进入配置生成器
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/templates"
                  className="inline-flex h-11 items-center rounded-md border border-white/12 bg-white/5 px-5 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white"
                >
                  模板库
                </Link>
              </div>
            </div>
            <div className="mono-label hidden flex-col gap-2 text-white/35 sm:flex">
              <span>[ 01 生成 ]</span>
              <span>[ 02 预览 ]</span>
              <span>[ 03 订阅 ]</span>
            </div>
          </div>
        </div>
      </div>

      {/* 恒动滚动字幕 */}
      <div className="relative overflow-hidden border-t border-white/8 py-2.5" aria-hidden="true">
        <div className="marquee-track">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex shrink-0 items-center">
              {MARQUEE_ITEMS.map((item) => (
                <span key={item} className="mono-label flex items-center text-white/40">
                  <span className="px-5">{item}</span>
                  <span className="inline-block size-1 rotate-45 bg-acid/70" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
