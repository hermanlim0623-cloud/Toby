// The skill network.
//
// Two decisions about this data are worth stating, because both are easy to
// get wrong and neither is reversible once the visuals are built on them.
//
// `links` are ids, not array indices. The previous version used indices,
// which meant inserting a skill silently rewired every relationship after it
// — a data format where adding a row corrupts the rows below it is a trap,
// not a shortcut.
//
// `weight` is NOT proficiency. There is no "Python 90%" here and there should
// not be: a percentage invites comparison against an invisible scale that
// nobody defines, and it says nothing a client or an employer can act on.
// This is how much of the actual shipped work the skill carries — how load-
// bearing it is across the case studies in src/content/work. It drives node
// size and connection weight, so the network reads as a map of where the work
// actually concentrates rather than as a self-assessment.
export const SKILL_NODES = [
  {
    id: 'automation',
    label: 'AUTOMATION',
    weight: 1.0,
    desc: 'Scripts and bots that remove repetitive manual work.',
    related: ['Order Adjustment Bot', 'Back Office Report'],
    links: ['python', 'bots', 'systems'],
  },
  {
    id: 'python',
    label: 'PYTHON',
    weight: 0.95,
    desc: 'The backbone of most tools — scripting, data, automation.',
    related: ['Sales Dashboard', 'RTP Report Tool'],
    links: ['automation', 'bots', 'api', 'data'],
  },
  {
    id: 'bots',
    label: 'BOTS',
    weight: 0.6,
    desc: 'Small autonomous processes handling recurring tasks unattended.',
    related: ['Order Adjustment Bot'],
    links: ['automation', 'python', 'systems'],
  },
  {
    id: 'javascript',
    label: 'JAVASCRIPT',
    weight: 0.85,
    desc: 'Frontend logic, interaction and motion across every interface.',
    related: ['This site', 'Kitchen Operations Site'],
    links: ['web', 'webgl', 'creative', 'uiux'],
  },
  {
    id: 'web',
    label: 'WEB',
    weight: 0.8,
    desc: 'Fast, legible interfaces built for people under time pressure.',
    related: ['Kitchen Operations Site', 'Basic Withdrawal Tool'],
    links: ['javascript', 'uiux', 'webgl'],
  },
  {
    id: 'webgl',
    label: '3D / WEBGL',
    weight: 0.55,
    desc: 'Three.js scenes and cinematic motion as a working craft proof.',
    related: ['This site — environment and network'],
    links: ['javascript', 'creative', 'web'],
  },
  {
    id: 'uiux',
    label: 'UI / UX',
    weight: 0.65,
    desc: 'Interfaces judged the way the kitchen judges everything — under pressure.',
    related: ['Kitchen Operations Site'],
    links: ['web', 'api', 'javascript', 'creative'],
  },
  {
    id: 'api',
    label: 'API & SYSTEMS',
    weight: 0.9,
    desc: 'Connecting spreadsheets, tools and data sources without manual re-entry.',
    related: ['Sales Dashboard', 'RTP Report Tool'],
    links: ['python', 'uiux', 'systems', 'data'],
  },
  {
    id: 'data',
    label: 'DATA / REPORTING',
    weight: 0.75,
    desc: 'Turning raw operational data into structured, trustworthy reports.',
    related: ['Back Office Report', 'RTP Report Tool'],
    links: ['systems', 'python', 'api'],
  },
  {
    id: 'systems',
    label: 'SYSTEMS THINKING',
    weight: 0.95,
    desc: 'Designing the invisible machinery underneath a working interface.',
    related: ['Mistake Count Tracker'],
    links: ['automation', 'bots', 'api', 'data'],
  },
  {
    id: 'creative',
    label: 'CREATIVE TECH',
    weight: 0.5,
    desc: 'Where engineering and craft meet — this portfolio itself.',
    related: ['This site'],
    links: ['javascript', 'webgl', 'uiux'],
  },
];
