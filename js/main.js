// SSRR Lab Webpage Interactive Enhancements

document.addEventListener('DOMContentLoaded', () => {
  // 1. Navigation Active State on Scroll (Intersection Observer)
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link');

  const observerOptions = {
    root: null,
    rootMargin: '-20% 0px -70% 0px',
    threshold: 0
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const currentId = entry.target.getAttribute('id');
        navLinks.forEach(link => {
          link.classList.remove('active');
          if (link.getAttribute('href') === `#${currentId}`) {
            link.classList.add('active');
          }
        });
      }
    });
  }, observerOptions);

  sections.forEach(section => observer.observe(section));

  // 2. Mobile Menu Toggle
  const mobileToggle = document.querySelector('.mobile-toggle');
  const navList = document.querySelector('.nav-links');

  if (mobileToggle && navList) {
    mobileToggle.addEventListener('click', () => {
      const isVisible = navList.style.display === 'flex';
      navList.style.display = isVisible ? 'none' : 'flex';
      if (!isVisible) {
        navList.style.flexDirection = 'column';
        navList.style.position = 'absolute';
        navList.style.top = '72px';
        navList.style.left = '0';
        navList.style.width = '100%';
        navList.style.background = '#FAF9F5';
        navList.style.padding = '24px';
        navList.style.borderBottom = '1px solid #E6E4DD';
      }
    });
  }

  // 3. Copy Citation Helper (if present)
  const copyBtn = document.getElementById('copy-citation-btn');
  const citationText = document.getElementById('citation-code');

  if (copyBtn && citationText) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(citationText.innerText).then(() => {
        const originalText = copyBtn.innerText;
        copyBtn.innerText = 'Copied to Clipboard!';
        setTimeout(() => {
          copyBtn.innerText = originalText;
        }, 2000);
      });
    });
  }
});
