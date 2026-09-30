/**
 * Petals Suites & Hotel - Frontend Controller (2026 Edition)
 * Editorial Hospitality Experience & Live eZee Absolute PMS Backend API Integration
 */

// Helper to escape HTML characters and prevent DOM XSS vulnerabilities
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', () => {
  initPreloader();
  initHeaderScroll();
  initMobileMenu();
  initScrollAnimations();
  initDateFields();
  initBulkBookingForm();
  initGalleryLightbox();
  initKeyboardNavigation();
  initVersionTracker();
});

/* ==========================================================================
   1. Data State & Configuration
   ========================================================================== */

// Room database mapping
const roomDb = {
  single: { title: 'Single Room', thumb: 'images/new images/49371E1E-93FC-4078-A3D1-E47DD74D4D38.png' },
  superior: { title: 'Superior Room', thumb: 'images/new images/7A1DDD63-3A46-4E2B-977B-D46A7ABF6BF2.png' },
  deluxe: { title: 'Deluxe Room', thumb: 'images/new images/6CD23204-3814-4FF8-AAC1-406CCAB18107.png' },
  suite: { title: 'Suite Room', thumb: 'images/new images/8D8120F5-A1E6-4B69-9FA7-C466C821E74B.png' }
};

// Gallery data archive for interactive lightbox
const galleryArchive = [
  { src: 'images/new images/8D8120F5-A1E6-4B69-9FA7-C466C821E74B.png', title: 'Signature Suite Living Space', cat: 'SUITE' },
  { src: 'images/new images/048DF31C-D323-4B44-B9A6-006C4207BF7E.png', title: 'Property Exterior & Facade', cat: 'EXTERIOR' },
  { src: 'images/new images/95B5EFF4-37B4-4134-8A17-1BF4864F04FB.png', title: 'Modern Architectural Stairwell', cat: 'ARCHITECTURE' },
  { src: 'images/new images/7A1DDD63-3A46-4E2B-977B-D46A7ABF6BF2.png', title: 'Superior Room Executive Desk', cat: 'SUPERIOR' },
  { src: 'images/new images/20A73FFC-76E0-41C6-B736-60C07B05FD06.png', title: 'Modern Bath & Restroom', cat: 'RESTROOM' },
  { src: 'images/new images/64C37745-E467-48AE-A017-8048789C1514.png', title: 'Peaceful Guest Corridors', cat: 'AMBIENCE' }
];

let currentLightboxIndex = 0;

/* ==========================================================================
   2. Preloader & Header Scrolling
   ========================================================================== */
function initPreloader() {
  const preloader = document.getElementById('site-preloader');
  if (!preloader) return;

  const hidePreloader = () => {
    preloader.classList.add('loaded');
  };

  if (document.readyState === 'complete') {
    setTimeout(hidePreloader, 800);
  } else {
    window.addEventListener('load', () => {
      setTimeout(hidePreloader, 900);
    });
  }

  // Fallback safety timeout
  setTimeout(hidePreloader, 2500);
}

function initHeaderScroll() {
  const header = document.getElementById('header') || document.querySelector('.main-header');
  if (!header) return;

  const onScroll = () => {
    if (window.scrollY > 40) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ==========================================================================
   3. Mobile Navigation & Touch Handling
   ========================================================================== */
function initMobileMenu() {
  const menuToggle = document.querySelector('.mobile-menu-toggle');
  const menuClose = document.querySelector('.mobile-menu-close');
  const navOverlay = document.querySelector('.mobile-nav-overlay');
  const mobileLinks = document.querySelectorAll('.mobile-link');

  if (menuToggle && navOverlay) {
    menuToggle.addEventListener('click', () => {
      navOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
  }

  if (menuClose && navOverlay) {
    menuClose.addEventListener('click', () => {
      navOverlay.classList.remove('active');
      document.body.style.overflow = '';
    });
  }

  mobileLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (navOverlay) navOverlay.classList.remove('active');
      document.body.style.overflow = '';
    });
  });
}

/* ==========================================================================
   4. Scroll Animations & Reveal System
   ========================================================================== */
function initScrollAnimations() {
  const revealElements = document.querySelectorAll('.scroll-reveal');
  if (!revealElements.length) return;

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    revealElements.forEach(el => observer.observe(el));
  } else {
    revealElements.forEach(el => el.classList.add('visible'));
  }
}

// Fallback compatibility alias
window.initScrollAnimationsFallback = initScrollAnimations;

/* ==========================================================================
   5. Booking Dates & External Booking Engine URL Builder
   ========================================================================== */
const LETSBOOK_BASE_URL = 'https://letsbook.me/booking/petalssuitesandhotel';

let checkinFlatpickr = null;
let checkoutFlatpickr = null;

function initDateFields() {
  const checkinHero = document.getElementById('hero-checkin');
  const checkoutHero = document.getElementById('hero-checkout');
  const guestsHero = document.getElementById('hero-guests');
  const roomTypeHero = document.getElementById('hero-room-type');

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (typeof flatpickr !== 'undefined' && checkinHero && checkoutHero) {
    checkinFlatpickr = flatpickr(checkinHero, {
      altInput: true,
      altFormat: "D, j M Y",
      dateFormat: "Y-m-d",
      minDate: "today",
      defaultDate: today,
      disableMobile: true,
      animate: true,
      onChange: function(selectedDates, dateStr) {
        if (selectedDates.length > 0) {
          const nextDay = new Date(selectedDates[0]);
          nextDay.setDate(nextDay.getDate() + 1);
          
          if (checkoutFlatpickr) {
            checkoutFlatpickr.set('minDate', nextDay);
            if (!checkoutFlatpickr.selectedDates[0] || checkoutFlatpickr.selectedDates[0] <= selectedDates[0]) {
              checkoutFlatpickr.setDate(nextDay, true);
            }
          }
        }
        updateAllBookingLinks();
      }
    });

    checkoutFlatpickr = flatpickr(checkoutHero, {
      altInput: true,
      altFormat: "D, j M Y",
      dateFormat: "Y-m-d",
      minDate: tomorrow,
      defaultDate: tomorrow,
      disableMobile: true,
      animate: true,
      onChange: function() {
        updateAllBookingLinks();
      }
    });
  } else {
    // Native fallback
    const todayStr = formatDate(today);
    const tomorrowStr = formatDate(tomorrow);
    if (checkinHero) {
      checkinHero.min = todayStr;
      if (!checkinHero.value) checkinHero.value = todayStr;
      checkinHero.addEventListener('change', updateAllBookingLinks);
    }
    if (checkoutHero) {
      checkoutHero.min = tomorrowStr;
      if (!checkoutHero.value) checkoutHero.value = tomorrowStr;
      checkoutHero.addEventListener('change', updateAllBookingLinks);
    }
  }

  if (guestsHero) {
    guestsHero.addEventListener('change', updateAllBookingLinks);
  }

  if (roomTypeHero) {
    roomTypeHero.addEventListener('change', updateAllBookingLinks);
  }

  // Initial link sync
  updateAllBookingLinks();
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Build URL for letsbook.me booking engine with chosen parameters
function buildBookingUrl(customParams = {}) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const heroCheckin = document.getElementById('hero-checkin')?.value;
  const heroCheckout = document.getElementById('hero-checkout')?.value;
  const heroGuests = document.getElementById('hero-guests')?.value;

  const checkin = customParams.checkin || heroCheckin || formatDate(today);
  const checkout = customParams.checkout || heroCheckout || formatDate(tomorrow);
  const adults = customParams.adults || (heroGuests ? parseInt(heroGuests, 10) || 2 : 2);
  const children = customParams.children !== undefined ? customParams.children : 0;

  const url = new URL(LETSBOOK_BASE_URL);
  url.searchParams.set('checkin', checkin);
  url.searchParams.set('checkout', checkout);
  url.searchParams.set('adults', adults);
  url.searchParams.set('children', children);

  return url.toString();
}

// Dynamically sync href on all booking buttons across the page
function updateAllBookingLinks() {
  const targetUrl = buildBookingUrl();
  const selector = 'a.book-now-btn, a.mob-book-btn, a.hero-primary-btn, a.panel-submit-btn, a.room-reserve-btn, a.mob-dock-btn.book, #amenities-book-btn, .nav-link-manage';
  document.querySelectorAll(selector).forEach(link => {
    link.href = targetUrl;
  });
}

/* ==========================================================================
   6. Booking Triggers & Redirection
   ========================================================================== */
window.openBookingModal = function(roomCategory, event) {
  if (event) event.preventDefault();
  const targetUrl = buildBookingUrl();
  try {
    const win = window.open(targetUrl, '_blank', 'noopener,noreferrer');
    if (!win || win.closed || typeof win.closed === 'undefined') {
      window.location.href = targetUrl;
    }
  } catch (err) {
    window.location.href = targetUrl;
  }
};

window.triggerHeroBooking = function(event) {
  if (event) event.preventDefault();
  const targetUrl = buildBookingUrl();
  try {
    const win = window.open(targetUrl, '_blank', 'noopener,noreferrer');
    if (!win || win.closed || typeof win.closed === 'undefined') {
      window.location.href = targetUrl;
    }
  } catch (err) {
    window.location.href = targetUrl;
  }
};

/* ==========================================================================
   7. Interactive Amenities Modal Controller
   ========================================================================== */
const amenitiesModal = document.getElementById('amenities-modal');
let currentInspectedRoom = 'deluxe';

window.openAmenitiesModal = function(roomCategory = 'deluxe') {
  if (!amenitiesModal) return;
  currentInspectedRoom = roomCategory;
  
  const selectedRoom = roomDb[roomCategory] || roomDb.deluxe;
  const titleEl = document.getElementById('amenities-modal-title');
  const tagEl = document.getElementById('amenities-modal-tag');
  const suiteSection = document.getElementById('suite-exclusive-section');
  const bookBtn = document.getElementById('amenities-book-btn');

  if (titleEl) titleEl.textContent = `${selectedRoom.title} Inclusions`;
  
  if (roomCategory === 'suite') {
    if (tagEl) tagEl.innerHTML = '<i class="fa-solid fa-crown"></i> Signature Suite Features';
    if (suiteSection) suiteSection.style.display = 'block';
    if (bookBtn) {
      bookBtn.innerHTML = `<span>Book Suite Online</span> <i class="fa-solid fa-arrow-right"></i>`;
    }
  } else {
    if (tagEl) tagEl.innerHTML = '<i class="fa-solid fa-sparkles"></i> Room Inclusions';
    if (suiteSection) suiteSection.style.display = 'none';
    if (bookBtn) {
      bookBtn.innerHTML = `<span>Book ${selectedRoom.title} Online</span> <i class="fa-solid fa-arrow-right"></i>`;
    }
  }

  amenitiesModal.classList.add('active');
  document.body.style.overflow = 'hidden';
};

window.closeAmenitiesModal = function() {
  if (!amenitiesModal) return;
  amenitiesModal.classList.remove('active');
  document.body.style.overflow = '';
};

window.bookFromAmenitiesModal = function(event) {
  closeAmenitiesModal();
  return openBookingModal(currentInspectedRoom, event);
};

if (amenitiesModal) {
  amenitiesModal.addEventListener('click', (e) => {
    if (e.target === amenitiesModal) {
      closeAmenitiesModal();
    }
  });
}

/* ==========================================================================
   10. Gallery Lightbox Controller
   ========================================================================== */
function initGalleryLightbox() {
  const lightbox = document.getElementById('gallery-lightbox');
  if (!lightbox) return;

  // Touch swipe support for mobile
  let touchStartX = 0;
  let touchEndX = 0;

  lightbox.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  lightbox.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  }, { passive: true });

  function handleSwipe() {
    if (touchEndX < touchStartX - 50) {
      navigateLightbox(1);
    }
    if (touchEndX > touchStartX + 50) {
      navigateLightbox(-1);
    }
  }
}

window.openGalleryLightbox = function(index = 0) {
  const lightbox = document.getElementById('gallery-lightbox');
  if (!lightbox) return;

  currentLightboxIndex = index;
  updateLightboxContent();

  lightbox.classList.add('active');
  document.body.style.overflow = 'hidden';
};

window.closeGalleryLightbox = function() {
  const lightbox = document.getElementById('gallery-lightbox');
  if (!lightbox) return;

  lightbox.classList.remove('active');
  document.body.style.overflow = '';
};

window.navigateLightbox = function(direction = 1) {
  currentLightboxIndex = (currentLightboxIndex + direction + galleryArchive.length) % galleryArchive.length;
  updateLightboxContent();
};

function updateLightboxContent() {
  const imgEl = document.getElementById('lightbox-img');
  const catEl = document.getElementById('lightbox-category');
  const titleEl = document.getElementById('lightbox-title');
  const counterEl = document.getElementById('lightbox-counter');

  const item = galleryArchive[currentLightboxIndex];
  if (!item) return;

  if (imgEl) {
    imgEl.style.opacity = '0';
    imgEl.src = item.src;
    imgEl.onload = () => {
      imgEl.style.opacity = '1';
    };
  }
  if (catEl) catEl.textContent = item.cat;
  if (titleEl) titleEl.textContent = item.title;
  if (counterEl) {
    const currentNum = String(currentLightboxIndex + 1).padStart(2, '0');
    const totalNum = String(galleryArchive.length).padStart(2, '0');
    counterEl.textContent = `${currentNum} / ${totalNum}`;
  }
}

/* ==========================================================================
   11. Keyboard Navigation (Escape & Arrow Keys)
   ========================================================================== */
function initKeyboardNavigation() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const lightbox = document.getElementById('gallery-lightbox');
      if (lightbox && lightbox.classList.contains('active')) {
        closeGalleryLightbox();
        return;
      }
      if (bookingModal && bookingModal.classList.contains('active')) {
        closeBookingModal();
        return;
      }
      if (amenitiesModal && amenitiesModal.classList.contains('active')) {
        closeAmenitiesModal();
        return;
      }
    }

    if (e.key === 'ArrowRight') {
      const lightbox = document.getElementById('gallery-lightbox');
      if (lightbox && lightbox.classList.contains('active')) {
        navigateLightbox(1);
      }
    }

    if (e.key === 'ArrowLeft') {
      const lightbox = document.getElementById('gallery-lightbox');
      if (lightbox && lightbox.classList.contains('active')) {
        navigateLightbox(-1);
      }
    }
  });
}

/* ==========================================================================
   12. WhatsApp & Contact Shortcuts
   ========================================================================== */
window.submitBookingToWhatsApp = function() {
  const roomCategory = document.getElementById('modal-room')?.value || 'deluxe';
  const selectedRoom = roomDb[roomCategory] || roomDb.deluxe;
  const checkIn = document.getElementById('modal-checkin')?.value || document.getElementById('hero-checkin')?.value || '';
  const checkOut = document.getElementById('modal-checkout')?.value || document.getElementById('hero-checkout')?.value || '';
  const guests = document.getElementById('modal-guests')?.value || document.getElementById('hero-guests')?.value || '2';

  let datesInfo = '';
  if (checkIn && checkOut) {
    datesInfo = `• *Check-in Date:* ${checkIn}\n• *Check-out Date:* ${checkOut}\n`;
  } else if (checkIn) {
    datesInfo = `• *Check-in Date:* ${checkIn}\n`;
  }

  const whatsappMsg = `Hello Petals Suites & Hotel,\n\nI would like to inquire about reserving a room stay:\n\n` +
    `• *Room Category:* ${selectedRoom.title}\n` +
    datesInfo +
    `• *Guests / Occupancy:* ${guests}\n\n` +
    `Please confirm room availability and tariff. Thank you!`;

  window.open(`https://wa.me/918123698844?text=${encodeURIComponent(whatsappMsg)}`, '_blank');
};

/* ==========================================================================
   13. Corporate Bulk Booking Form
   ========================================================================== */
function initBulkBookingForm() {
  const form = document.getElementById('bulk-booking-form');
  const successBanner = document.getElementById('bulk-success-message');

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('.submit-form-btn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing Inquiry...';
      }

      const name = document.getElementById('bulk-name') ? document.getElementById('bulk-name').value.trim() : '';
      const company = document.getElementById('bulk-company') ? document.getElementById('bulk-company').value.trim() : '';
      const email = document.getElementById('bulk-email') ? document.getElementById('bulk-email').value.trim() : '';
      const phone = document.getElementById('bulk-phone') ? document.getElementById('bulk-phone').value.trim() : '';
      const rooms = document.getElementById('bulk-rooms') ? document.getElementById('bulk-rooms').value.trim() : '';
      const duration = document.getElementById('bulk-stay-duration') ? document.getElementById('bulk-stay-duration').value.trim() : '';
      const message = document.getElementById('bulk-message') ? document.getElementById('bulk-message').value.trim() : '';

      const corpMsg = `Hello Petals Hotel & Suites,\n\nI would like to submit a Corporate / Bulk Booking Inquiry:\n\n` +
        `• *Contact Person:* ${name || 'N/A'}\n` +
        `• *Company:* ${company || 'N/A'}\n` +
        `• *Email:* ${email || 'N/A'}\n` +
        `• *Phone:* ${phone || 'N/A'}\n` +
        `• *Rooms Required:* ${rooms || '5+'}\n` +
        `• *Stay Duration:* ${duration || '1'} Night(s)\n` +
        `• *Requirement Details:* ${message || 'Standard corporate inquiry'}\n\n` +
        `Please share availability and customized corporate tariff. Thank you!`;

      const whatsappUrl = `https://wa.me/918123698844?text=${encodeURIComponent(corpMsg)}`;

      setTimeout(() => {
        form.style.display = 'none';
        if (successBanner) {
          successBanner.innerHTML = `
            <i class="fa-solid fa-circle-check"></i>
            <h3>Thank You for Your Query!</h3>
            <p>Our corporate relations desk has received your booking inquiry. We will contact you at <strong>${escapeHTML(email || phone)}</strong> shortly.</p>
            <div style="margin-top: 18px;">
              <a href="${whatsappUrl}" target="_blank" class="primary-btn" style="background: #25D366; color: #FFFFFF; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 14px rgba(37, 211, 102, 0.35);">
                <i class="fa-brands fa-whatsapp"></i> Chat with Corporate Desk on WhatsApp
              </a>
            </div>
          `;
          successBanner.style.display = 'block';
          successBanner.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // Open WhatsApp directly with inquiry details
        window.open(whatsappUrl, '_blank');
      }, 1000);
    });
  }
}

/* ==========================================================================
   14. Global Hash Router
   ========================================================================== */
window.addEventListener('hashchange', handleHashRouting);

function handleHashRouting() {
  const hash = window.location.hash;

  const navOverlay = document.querySelector('.mobile-nav-overlay');
  if (navOverlay) {
    if (hash === '#menu') {
      navOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    } else {
      navOverlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  if (hash.startsWith('#booking') || hash === '#manage-booking') {
    history.replaceState(null, null, ' ');
    openBookingModal();
  }
}

handleHashRouting();

/* ==========================================================================
   15. Automatic Version Tracker & Cache-Busting Sync
   ========================================================================== */
function initVersionTracker() {
  const currentVersion = document.querySelector('meta[name="app-version"]')?.getAttribute('content');
  if (!currentVersion) return;

  const checkForNewVersion = async () => {
    try {
      const res = await fetch(`/api/version?_t=${Date.now()}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.appVersion && data.appVersion !== currentVersion) {
        console.log(`🌸 Petals Website Update Detected: ${data.appVersion} (Current: ${currentVersion}). Refreshing fresh assets...`);
        // If booking modal is not currently open/being filled, reload seamlessly to apply new assets
        const modalActive = document.getElementById('booking-modal')?.classList.contains('active');
        if (!modalActive) {
          window.location.reload();
        }
      }
    } catch (err) {
      // Ignore background network errors
    }
  };

  // Check when user switches back to this browser tab
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForNewVersion();
    }
  });

  // Check periodically every 5 minutes
  setInterval(checkForNewVersion, 5 * 60 * 1000);
}
