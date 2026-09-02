"use client";

import { useState } from "react";

import { Label } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const NOTICE: Record<string, { title: string; body: string }> = {
  English: {
    title: "Consent notice",
    body: "LifeSeed ART Bank processes your contact details to respond to your enquiry, schedule counselling where applicable, and (if you opt in) share relevant programme updates. You may withdraw consent anytime.",
  },
  Hindi: {
    title: "सहमति सूचना (placeholder)",
    body: "लाइफसीड एआरटी बैंक आपकी पूछताछ का जवाब देने और परामर्श निर्धारित करने के लिए आपके संपर्क विवरण का उपयोग करता है। आप कभी भी सहमति वापस ले सकते हैं।",
  },
  Bengali: {
    title: "সম্মতি বিজ্ঞপ্তি (placeholder)",
    body: "লাইফসিড এআরটি ব্যাংক আপনার জিজ্ঞাসার উত্তর ও কাউন্সেলিং নির্ধারণের জন্য আপনার যোগাযোগের তথ্য ব্যবহার করে। আপনি যেকোনো সময় সম্মতি প্রত্যাহার করতে পারেন।",
  },
  Telugu: {
    title: "సమ్మతి నోటీసు (placeholder)",
    body: "లైఫ్‌సీడ్ ఏఆర్‌టి బ్యాంక్ మీ విచారణకు స్పందించడానికి మరియు కౌన్సెలింగ్ షెడ్యూల్ చేయడానికి మీ సంప్రదింపు వివరాలను ఉపయోగిస్తుంది. మీరు ఎప్పుడైనా సమ్మతిని ఉపసంహరించవచ్చు.",
  },
};

export type LeadConsentValue = {
  consentMarketing: boolean;
  consentScreening: boolean;
  consentDataProcessing: boolean;
  preferredLanguage: string;
  consentVersion: string;
};

export function LeadConsentNotice({
  value,
  onChange,
  className,
}: {
  value: LeadConsentValue;
  onChange: (next: LeadConsentValue) => void;
  className?: string;
}) {
  const [lang, setLang] = useState(value.preferredLanguage || "English");
  const notice = NOTICE[lang] ?? NOTICE.English;

  function patch(p: Partial<LeadConsentValue>) {
    onChange({ ...value, ...p, preferredLanguage: lang, consentVersion: "lead-v1.0" });
  }

  return (
    <div className={cn("space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-stone-900">{notice.title}</h3>
        <select
          className="h-8 rounded-md border border-stone-300 bg-white px-2 text-xs"
          value={lang}
          onChange={(e) => {
            setLang(e.target.value);
            patch({ preferredLanguage: e.target.value });
          }}
        >
          {Object.keys(NOTICE).map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <p className="text-xs text-stone-600">{notice.body}</p>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.consentDataProcessing}
          onChange={(e) => patch({ consentDataProcessing: e.target.checked })}
        />
        <span>I consent to processing of my data for this enquiry (required)</span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.consentScreening}
          onChange={(e) => patch({ consentScreening: e.target.checked })}
        />
        <span>I consent to pre-screening outreach related to donation / treatment</span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.consentMarketing}
          onChange={(e) => patch({ consentMarketing: e.target.checked })}
        />
        <span>I consent to marketing / programme updates</span>
      </label>

      <div className="rounded-md bg-white p-3 text-xs text-stone-600 ring-1 ring-stone-200">
        <Label className="text-xs">Grievance officer (DPDP)</Label>
        <p className="mt-1">
          Naitik Ganguly · GM Operations ·{" "}
          <a
            className="text-emerald-900 underline"
            href="mailto:naitik@butterflyartbank.com"
          >
            naitik@butterflyartbank.com
          </a>
        </p>
      </div>
    </div>
  );
}
