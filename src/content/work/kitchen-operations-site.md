---
title: Kitchen Operations Site
tag: Operations
order: 2
summary: An internal site holding menu, pricing and operational references in one place, built to be read on a phone during service.
stack: [HTML/CSS]
capabilities: [Internal tooling, Operational systems]
use: Floor reference during service
before: Menus, prices and process notes scattered across print-outs, chats and memory.
after: One reference the whole team reads, on the device already in their pocket.
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
loud room, which is the only usage condition that actually matters here.

## How it works

Every reference lives in one document, and that document is the one the team
is pointed at. There is no second copy to keep in sync, which is the only
reliable way to stop two versions disagreeing.

## Technical approach

Plain HTML and CSS. No framework, no build step, no login wall to fight
during service.

That is a real constraint rather than a shortcut. A site the kitchen depends
on has to load on the worst connection in the building, and it has to be
editable by whoever is nearest when a price changes. Every layer between the
content and the page is a layer that can be down, out of date, or waiting on
someone who knows how to run the build.

The design rules followed from the same place:

- **Legible under pressure.** Large type, high contrast, no decorative
  interference. Someone is reading this mid-service, not browsing it.
- **One screen per decision.** If a question takes two taps and a scroll to
  answer, the team goes back to asking a colleague, and the site has failed.
- **Changing it has to be trivial.** A reference that's annoying to update
  becomes a reference that's out of date, which is worse than no reference.

## Current state

In use as the team's shared reference. "Check the site" replaced "ask whoever's
been here longest," which is the difference between knowledge living in a
system and knowledge living in a person who might be off that day.
