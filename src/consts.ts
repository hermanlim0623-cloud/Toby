/** Single source of truth for anything that appears in metadata twice. */
export const SITE = {
  name: 'TOBY',
  title: 'TOBY — Creative Technologist',
  tagline: 'I build digital systems & experiences.',
  description:
    'Creative technologist building dashboards, automation and backend tools inside a food & beverage business’s day-to-day operations.',
  url: 'https://toby.dev',
  email: 'hermanlim.0623@gmail.com',
  location: 'Indonesia',
  ogImage: '/og.jpg',
} as const;

export const NAV_LINKS = [
  { href: '/#intro', label: 'Identity' },
  { href: '/#expertise', label: 'Skills' },
  { href: '/#work', label: 'Work' },
  { href: '/#tech', label: 'Tech' },
  { href: '/#experience', label: 'Experience' },
] as const;
