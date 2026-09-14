// Skill-matrix node graph. `links` are indices into this same array —
// kept adjacent-by-index-ish so the constellation reads as clustered
// rather than a random tangle.
export const SKILL_NODES = [
  { label: 'AUTOMATION', desc: 'Scripts and bots that remove repetitive manual work.', related: ['Order Adjustment Bot', 'Back Office Report'], links: [1, 2, 9] },
  { label: 'PYTHON', desc: 'The backbone of most tools — scripting, data, automation.', related: ['Sales Dashboard', 'RTP Report Tool'], links: [0, 2, 7] },
  { label: 'BOTS', desc: 'Small autonomous processes handling recurring tasks unattended.', related: ['Order Adjustment Bot'], links: [0, 1, 9] },
  { label: 'JAVASCRIPT', desc: 'Frontend logic, interaction and motion across every interface.', related: ['This site', 'Kitchen Operations Site'], links: [4, 5, 10] },
  { label: 'WEB', desc: 'Fast, legible interfaces built for people under time pressure.', related: ['Kitchen Operations Site', 'Basic Withdrawal Tool'], links: [3, 6, 5] },
  { label: '3D / WEBGL', desc: 'Three.js scenes and cinematic motion as a working craft proof.', related: ['This site — hero + skill matrix'], links: [3, 10, 4] },
  { label: 'UI / UX', desc: 'Interfaces judged the way the kitchen judges everything — under pressure.', related: ['Kitchen Operations Site'], links: [4, 7, 3] },
  { label: 'API & SYSTEMS', desc: 'Connecting spreadsheets, tools and data sources without manual re-entry.', related: ['Sales Dashboard', 'RTP Report Tool'], links: [1, 6, 9] },
  { label: 'DATA / REPORTING', desc: 'Turning raw operational data into structured, trustworthy reports.', related: ['Back Office Report', 'RTP Report Tool'], links: [9, 1] },
  { label: 'SYSTEMS THINKING', desc: 'Designing the invisible machinery underneath a working interface.', related: ['Mistake Count Tracker'], links: [0, 2, 7, 8] },
  { label: 'CREATIVE TECH', desc: 'Where engineering and craft meet — this portfolio itself.', related: ['This site'], links: [3, 5, 6] },
];
