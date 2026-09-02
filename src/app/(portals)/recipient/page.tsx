export default function RecipientHomePage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-stone-900">Recipient Portal</h1>
      <p className="mt-2 text-stone-600">Recipient case scaffold.</p>
      {/* TODO(recipient-portal): when donor profiles are surfaced here, use
          getSeedScoreVisibility() from @/lib/seedscore/visibility — recipient
          sees numeric + tier only when SEEDSCORE_VISIBLE_TO_RECIPIENT=true. */}
    </div>
  );
}
