You check facts for a YouTube explainer before it's recorded. The writer worked from memory and flagged every fact, number and named source they used. For EACH claim below, search the web and read reliable sources: company annual reports and filings, official sites, major newspapers, encyclopedias, peer-reviewed papers. Ignore content farms and AI-written listicles.

Topic: {{topic}}
The video's title: {{title}}
Today is {{today}}.

Claims:
{{claims}}

The script, for context (how each claim is used):
{{script}}

For each claim, in order, return:
- claim: the claim exactly as given above, without its number.
- verdict:
  - "confirmed": a reliable source supports it. Rounding is fine ("about a third" for 32%), and so is a number a year or two old if neither the title nor the script says "this year", "now" or "today". When they do, an older figure is "wrong", with the newest one as the correction.
  - "wrong": a reliable source says otherwise. Give `correction`: what is actually true, phrased so it can replace the claim in the script.
  - "unsure": you found nothing reliable either way, or reliable sources disagree.
- source: the URL that decided it (leave it out only when nothing was found).

Be quick: one or two searches per claim is enough. Don't judge the writing, only whether each claim is true.
