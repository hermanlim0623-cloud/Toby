// Marks the page as JS-enabled so CSS can apply the reveal-on-scroll effect
// (kept opt-in via .js-ready so the page still reads fine with JS off).
document.documentElement.classList.add('js-ready');

// Smooth scroll for the in-page nav links (#work, #services, #contact).
document.querySelectorAll('a[href^="#"]').forEach(function (link) {
  link.addEventListener('click', function (event) {
    var target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

// Fades each section in as it enters the viewport.
var revealTargets = document.querySelectorAll('section, footer');
revealTargets.forEach(function (el) { el.classList.add('reveal'); });

if ('IntersectionObserver' in window) {
  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  revealTargets.forEach(function (el) { observer.observe(el); });
} else {
  revealTargets.forEach(function (el) { el.classList.add('is-visible'); });
}
