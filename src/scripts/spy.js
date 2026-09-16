// The header's position readout.
//
// Each section declares its own number and name, so adding a section is a
// markup change and this file never needs to know what the document contains.
export function createSpy(ScrollTrigger) {
  const num = document.querySelector('[data-where-num]');
  const name = document.querySelector('[data-where-name]');
  const sections = document.querySelectorAll('[data-section]');
  if (!num || !name || !sections.length) return;

  function set(section) {
    num.textContent = section.dataset.section;
    name.textContent = section.dataset.sectionName;
  }

  sections.forEach((section) => {
    ScrollTrigger.create({
      trigger: section,
      // Half a viewport down: the section a reader is "in" is the one under
      // the middle of the screen, not the one whose top edge just crossed.
      start: 'top 50%',
      end: 'bottom 50%',
      onEnter: () => set(section),
      onEnterBack: () => set(section),
    });
  });
}
