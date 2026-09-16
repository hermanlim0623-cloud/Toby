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

/** The document's sections, in document order. The header index, the menu
 *  and the scroll spy all read from this, so there is one place where the
 *  page's table of contents is defined. */
export const NAV_LINKS = [
  { href: '/#about', label: 'About' },
  { href: '/#work', label: 'Selected Work' },
  { href: '/#experience', label: 'Experience' },
  { href: '/#skills', label: 'Skills' },
  { href: '/#technology', label: 'Technology' },
  { href: '/#contact', label: 'Contact' },
] as const;
