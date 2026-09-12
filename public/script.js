// Marks the page as JS-enabled so CSS can apply the animation effects
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

// Staggers the direct children of each grid/list so cards animate in one
// after another instead of all at once.
function stagger(selector) {
  document.querySelectorAll(selector).forEach(function (group) {
    Array.prototype.forEach.call(group.children, function (child, i) {
      child.style.setProperty('--reveal-delay', (i * 90) + 'ms');
      child.classList.add('reveal-item');
    });
  });
}
stagger('.services-grid');
stagger('.process');
stagger('.work-list');

// Fades each section (and its staggered children) in as it enters the viewport.
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

// Plays the hero entrance animation once, right after first paint.
requestAnimationFrame(function () {
  requestAnimationFrame(function () {
    document.documentElement.classList.add('hero-in');
  });
});

// Subtle cursor-following tilt on work screenshots and service cards.
if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  document.querySelectorAll('.shot').forEach(function (card) {
    card.classList.add('tilt');
    card.addEventListener('mousemove', function (e) {
      var rect = card.getBoundingClientRect();
      var px = (e.clientX - rect.left) / rect.width - 0.5;
      var py = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.setProperty('--tilt-x', (py * -6).toFixed(2) + 'deg');
      card.style.setProperty('--tilt-y', (px * 6).toFixed(2) + 'deg');
    });
    card.addEventListener('mouseleave', function () {
      card.style.setProperty('--tilt-x', '0deg');
      card.style.setProperty('--tilt-y', '0deg');
    });
  });
}
