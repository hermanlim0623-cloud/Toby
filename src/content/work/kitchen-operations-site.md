---
title: Kitchen Operations Site
tag: Operations
order: 2
summary: Internal site consolidating menu, pricing, and operational references used across the business.
impact: Single source of truth for the team
stack: [HTML/CSS, Internal tooling]
role: Design and build
timeframe: Ongoing
status: In use
metrics:
  - label: Reference sources
    value: Many → one
  - label: Audience
    value: Whole floor team
  - label: Device
    value: Phone-first
machine:
  input: Menus, prices and notes, scattered
  process: Consolidate into one internal site
  decision: Which copy is the current one
  output: One reference the whole team reads
---

## The problem

The information a kitchen runs on was scattered across whatever surface it
landed on first: a printed menu taped inside a cupboard, a pricing list in
someone's chat history, a note about a changed recipe that only three people
saw. Every one of those copies drifts. The pricing sheet from two months ago
looks exactly as authoritative as the current one.

When a new person joins, that scattering becomes a training cost. When a price
changes, it becomes a billing error.

## What I built

An internal site that holds the menu, the pricing and the operational
references in one place, built to be opened on a phone with wet hands in a
loud room — which is the only usage condition that actually matters here.

No framework, no build step, no login wall to fight during service. Plain HTML
and CSS, fast on the worst connection in the building.

## Design constraints

- **Legible under pressure.** Large type, high contrast, no decorative
  interference. Someone is reading this mid-service, not browsing it.
- **One screen per decision.** If a question takes two taps and a scroll to
  answer, the team goes back to asking a colleague — and the site has failed.
- **Changing it has to be trivial.** A reference that's annoying to update
  becomes a reference that's out of date, which is worse than no reference.

## Result

One place to point at. "Check the site" replaced "ask whoever's been here
longest," which is the difference between knowledge living in a system and
knowledge living in a person who might be off that day.
