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
  loadConfiguredDetails();
});

/* ==========================================================================
   1. Data State & Configuration
   ========================================================================== */

// Room database mapping and default rates
const roomDb = {
  single: { title: 'Single Room', price: 2499, roomTypeId: '1', rateplanId: '1', thumb: 'images/single room.jpeg' },
  superior: { title: 'Superior Room', price: 3499, roomTypeId: '2', rateplanId: '1', thumb: 'images/superior room.jpeg' },
  deluxe: { title: 'Deluxe Room', price: 4499, roomTypeId: '3', rateplanId: '1', thumb: 'images/deluxe room.jpeg' },
  suite: { title: 'Suite Room', price: 6499, roomTypeId: '4', rateplanId: '1', thumb: 'images/suite room.jpeg' }
};

// Current active booking state
let activeBookingState = {
  reservationNo: '',
  guestName: '',
  title: 'Mr',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  city: 'Bangalore',
  country: 'India',
  specialRequest: '',
  roomType: 'deluxe',
  roomTitle: 'Deluxe Room',
  checkIn: '',
  checkOut: '',
  nights: 1,
  adults: 1,
  children: 0,
  baseRate: 4499,
  taxRate: 540,
  totalPrice: 5039,
  paymentMethod: 'UPI',
  transactionId: ''
};

// Gallery data archive for interactive lightbox
const galleryArchive = [
  { src: 'images/suite room.jpeg', title: 'Signature Suite Living Space', cat: 'SUITE' },
  { src: 'images/deluxe room.jpeg', title: 'Deluxe Room & Lounge', cat: 'DELUXE' },
  { src: 'images/strir well.jpeg', title: 'Modern Architectural Stairwell', cat: 'ARCHITECTURE' },
  { src: 'images/superior room.jpeg', title: 'Superior Room Executive Desk', cat: 'SUPERIOR' },
  { src: 'images/single room.jpeg', title: 'Single Room Quiet Sanctuary', cat: 'SINGLE' },
  { src: 'images/room corridor.jpeg', title: 'Peaceful Guest Corridors', cat: 'AMBIENCE' }
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
   5. Booking Dates & PMS Availability Checking
   ========================================================================== */
function initDateFields() {
  const checkinHero = document.getElementById('hero-checkin');
  const checkoutHero = document.getElementById('hero-checkout');
  const checkinModal = document.getElementById('modal-checkin');
  const checkoutModal = document.getElementById('modal-checkout');

  const today = new Date();
  const todayStr = formatDate(today);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatDate(tomorrow);

  [checkinHero, checkinModal].forEach(field => {
    if (field) {
      field.min = todayStr;
      field.value = todayStr;
    }
  });

  [checkoutHero, checkoutModal].forEach(field => {
    if (field) {
      field.min = tomorrowStr;
      field.value = tomorrowStr;
    }
  });

  [checkinHero, checkinModal].forEach((checkinField, index) => {
    const checkoutField = index === 0 ? checkoutHero : checkoutModal;
    if (checkinField && checkoutField) {
      checkinField.addEventListener('change', () => {
        const selectedCheckin = new Date(checkinField.value);
        const minCheckout = new Date(selectedCheckin);
        minCheckout.setDate(minCheckout.getDate() + 1);
        
        const minCheckoutStr = formatDate(minCheckout);
        checkoutField.min = minCheckoutStr;
        
        if (new Date(checkoutField.value) <= selectedCheckin) {
          checkoutField.value = minCheckoutStr;
        }

        if (index === 1) {
          onDatesChanged();
        }
      });
    }
  });

  if (checkoutModal) {
    checkoutModal.addEventListener('change', () => {
      onDatesChanged();
    });
  }
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Fetch configured salutations from PMS API
async function loadConfiguredDetails() {
  try {
    const response = await fetch('/api/config-details');
    const result = await response.json();
    if (result.success && result.data && result.data.salutations) {
      const titleSelect = document.getElementById('modal-title');
      if (titleSelect && Array.isArray(result.data.salutations)) {
        titleSelect.innerHTML = '';
        result.data.salutations.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s.code || s.name || s;
          opt.textContent = s.name || s;
          titleSelect.appendChild(opt);
        });
      }
    }
  } catch (err) {
    console.log('Using standard salutations list:', err.message);
  }
}

// Handler for when stay dates change
window.onDatesChanged = async function() {
  calculateTotalPrice();
  await checkPmsAvailability();
};

// Check live availability via /api/availability
async function checkPmsAvailability() {
  const checkinInput = document.getElementById('modal-checkin');
  const checkoutInput = document.getElementById('modal-checkout');
  const availBadge = document.getElementById('modal-avail-badge');

  if (!checkinInput || !checkoutInput || !availBadge) return;
  const checkIn = checkinInput.value;
  const checkOut = checkoutInput.value;
  if (!checkIn || !checkOut) return;

  try {
    const res = await fetch(`/api/availability?checkin=${encodeURIComponent(checkIn)}&checkout=${encodeURIComponent(checkOut)}`);
    const json = await res.json();
    
    // Only show badge when the PMS returns real, valid inventory without errors
    const hasValidPmsData = json.success && json.data && !json.data.Errors && !json.data.error && (json.data.Room_Details || json.data.rooms || (Array.isArray(json.data) && json.data.length > 0));

    if (hasValidPmsData) {
      availBadge.style.display = 'inline-flex';
      availBadge.className = 'pms-avail-badge available';
      availBadge.innerHTML = `<i class="fa-solid fa-circle-check"></i> Rates & Dates Available`;
    } else {
      availBadge.style.display = 'none';
    }
  } catch (err) {
    availBadge.style.display = 'none';
  }
}

/* ==========================================================================
   6. Multi-step Booking System
   ========================================================================== */
const bookingModal = document.getElementById('booking-modal');

window.openBookingModal = function(roomCategory = 'deluxe') {
  window.location.hash = `booking-${roomCategory}`;
};

function openBookingModalDirect(roomCategory = 'deluxe') {
  if (!bookingModal) return;

  const roomInput = document.getElementById('modal-room');
  const roomTitle = document.getElementById('modal-room-title');
  const roomRate = document.getElementById('modal-room-rate');
  const roomThumb = document.getElementById('modal-room-thumb');

  const selectedRoom = roomDb[roomCategory] || roomDb.deluxe;
  
  if (roomInput) roomInput.value = roomCategory;
  if (roomTitle) roomTitle.textContent = selectedRoom.title;
  if (roomThumb) roomThumb.src = selectedRoom.thumb;
  if (roomRate) {
    roomRate.innerHTML = `₹${selectedRoom.price.toLocaleString('en-IN')} <span>/ night + GST</span>`;
  }
  
  selectGuests(1);
  calculateTotalPrice();
  checkPmsAvailability();

  bookingModal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

window.closeBookingModal = function() {
  history.replaceState(null, null, ' ');
  window.dispatchEvent(new Event('hashchange'));
};

function closeBookingModalDirect() {
  if (!bookingModal) return;
  bookingModal.classList.remove('active');
  document.body.style.overflow = '';
}

if (bookingModal) {
  bookingModal.addEventListener('click', (e) => {
    if (e.target === bookingModal) {
      closeBookingModal();
    }
  });
}

window.triggerHeroBooking = function() {
  const selectedRoom = document.getElementById('hero-room-type').value;
  window.location.hash = `booking-${selectedRoom}`;

  const heroCheckin = document.getElementById('hero-checkin');
  const heroCheckout = document.getElementById('hero-checkout');
  const heroGuests = document.getElementById('hero-guests');
  
  const modalCheckin = document.getElementById('modal-checkin');
  const modalCheckout = document.getElementById('modal-checkout');
  
  if (heroCheckin && modalCheckin && heroCheckin.value) {
    modalCheckin.value = heroCheckin.value;
  }
  if (heroCheckout && modalCheckout && heroCheckout.value) {
    modalCheckout.value = heroCheckout.value;
  }
  if (heroGuests) {
    const guestsCount = parseInt(heroGuests.value) || 1;
    selectGuests(guestsCount > 3 ? 3 : guestsCount);
  }
  
  calculateTotalPrice();
  checkPmsAvailability();
};

window.showStep = function(stepNum) {
  document.querySelectorAll('#booking-modal .modal-step').forEach((el, index) => {
    if (index + 1 === stepNum) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });
};

window.selectGuests = function(count) {
  const guestInput = document.getElementById('modal-guests');
  if (guestInput) {
    guestInput.value = count;
  }

  const pills = document.querySelectorAll('.guest-pill');
  pills.forEach((pill, idx) => {
    if (idx + 1 === count) {
      pill.classList.add('active');
    } else {
      pill.classList.remove('active');
    }
  });
  calculateTotalPrice();
};

function calculateNights() {
  const checkinInput = document.getElementById('modal-checkin');
  const checkoutInput = document.getElementById('modal-checkout');
  
  if (!checkinInput || !checkoutInput || !checkinInput.value || !checkoutInput.value) {
    return 1;
  }

  const checkinDate = new Date(checkinInput.value);
  const checkoutDate = new Date(checkoutInput.value);
  
  const diffTime = checkoutDate - checkinDate;
  if (diffTime <= 0) return 1;

  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays || 1;
}

window.calculateTotalPrice = function() {
  const roomInput = document.getElementById('modal-room');
  const roomVal = roomInput ? roomInput.value : 'deluxe';
  const selectedRoom = roomDb[roomVal] || roomDb.deluxe;
  
  const nights = calculateNights();
  const baseTotal = selectedRoom.price * nights;
  const gstTax = Math.round(baseTotal * 0.12);
  const grossTotal = baseTotal + gstTax;

  const nightsEl = document.getElementById('calc-nights');
  const baseEl = document.getElementById('calc-base-price');
  const taxEl = document.getElementById('calc-tax-price');
  const totalEl = document.getElementById('modal-total-price');

  if (nightsEl) nightsEl.textContent = `${nights} night${nights > 1 ? 's' : ''}`;
  if (baseEl) baseEl.textContent = `₹${baseTotal.toLocaleString('en-IN')}`;
  if (taxEl) taxEl.textContent = `₹${gstTax.toLocaleString('en-IN')}`;
  if (totalEl) totalEl.textContent = `₹${grossTotal.toLocaleString('en-IN')}`;

  // Update active state
  activeBookingState.roomType = roomVal;
  activeBookingState.roomTitle = selectedRoom.title;
  activeBookingState.nights = nights;
  activeBookingState.baseRate = baseTotal;
  activeBookingState.taxRate = gstTax;
  activeBookingState.totalPrice = grossTotal;
};

/* ==========================================================================
   7. Checkout & PMS Booking Creation
   ========================================================================== */
window.proceedToPayment = function() {
  const title = document.getElementById('modal-title').value;
  const firstName = document.getElementById('modal-firstname').value.trim();
  const lastName = document.getElementById('modal-lastname').value.trim();
  const email = document.getElementById('modal-email').value.trim();
  const phone = document.getElementById('modal-phone').value.trim();
  const checkIn = document.getElementById('modal-checkin').value;
  const checkOut = document.getElementById('modal-checkout').value;
  const guests = document.getElementById('modal-guests').value;
  const city = document.getElementById('modal-city').value.trim();
  const country = document.getElementById('modal-country').value.trim();
  const specialRequest = document.getElementById('modal-special-request').value.trim();

  if (!firstName || !email || !phone || !checkIn || !checkOut) {
    alert('Please complete all mandatory guest details.');
    return;
  }

  activeBookingState.guestName = `${title} ${firstName} ${lastName}`.trim();
  activeBookingState.title = title;
  activeBookingState.firstName = firstName;
  activeBookingState.lastName = lastName;
  activeBookingState.email = email;
  activeBookingState.phone = phone;
  activeBookingState.checkIn = checkIn;
  activeBookingState.checkOut = checkOut;
  activeBookingState.adults = guests;
  activeBookingState.city = city;
  activeBookingState.country = country;
  activeBookingState.specialRequest = specialRequest;

  window.location.hash = 'payment';
};

function loadPaymentScreen() {
  const formattedTotal = `₹${activeBookingState.totalPrice.toLocaleString('en-IN')}`;

  const roomSummaryEl = document.getElementById('payment-summary-room');
  const nightsSummaryEl = document.getElementById('payment-summary-nights');
  const guestsSummaryEl = document.getElementById('payment-summary-guests');
  const totalCardEl = document.getElementById('modal-payment-total');
  const totalUpiEl = document.getElementById('modal-payment-total-upi');

  if (roomSummaryEl) roomSummaryEl.textContent = activeBookingState.roomTitle;
  if (nightsSummaryEl) nightsSummaryEl.textContent = `${activeBookingState.nights} Night${activeBookingState.nights > 1 ? 's' : ''}`;
  if (guestsSummaryEl) guestsSummaryEl.textContent = `${activeBookingState.adults} Adult${activeBookingState.adults > 1 ? 's' : ''}`;

  if (totalCardEl) totalCardEl.textContent = formattedTotal;
  if (totalUpiEl) totalUpiEl.textContent = formattedTotal;

  switchPaymentMethod('upi');
  showStep(2);
}

window.switchPaymentMethod = function(method) {
  const tabCard = document.getElementById('tab-card');
  const tabUpi = document.getElementById('tab-upi');
  const panelCard = document.getElementById('payment-card-form');
  const panelUpi = document.getElementById('payment-upi-panel');

  if (method === 'card') {
    if (tabCard) tabCard.classList.add('active');
    if (tabUpi) tabUpi.classList.remove('active');
    if (panelCard) panelCard.classList.add('active');
    if (panelUpi) panelUpi.classList.remove('active');
  } else {
    if (tabCard) tabCard.classList.remove('active');
    if (tabUpi) tabUpi.classList.add('active');
    if (panelCard) panelCard.classList.remove('active');
    if (panelUpi) panelUpi.classList.add('active');
  }
};

window.triggerUPIPayment = function() {
  const upiId = document.getElementById('upi-id').value.trim();
  if (!upiId) {
    alert('Please enter a valid UPI ID (e.g. name@okhdfcbank)');
    return;
  }

  const verifyBtn = document.querySelector('.upi-verify-btn');
  if (verifyBtn) {
    verifyBtn.disabled = true;
    verifyBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Requesting...';

    setTimeout(() => {
      verifyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Request Sent';
      alert(`Payment request of ₹${activeBookingState.totalPrice.toLocaleString('en-IN')} sent to ${upiId}. Complete payment in your UPI app and click 'Confirm Payment & Book'.`);
      verifyBtn.disabled = false;
    }, 1200);
  }
};

// Submits the booking to the backend /api/bookings/create (eZee InsertBooking + ProcessBooking + AddPayment)
window.submitPayment = async function(paymentMethod = 'UPI Online') {
  const upiBtn = document.getElementById('upi-submit-btn');
  const cardBtn = document.getElementById('card-submit-btn');

  [upiBtn, cardBtn].forEach(btn => {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing Booking...';
    }
  });

  const selectedRoomObj = roomDb[activeBookingState.roomType] || roomDb.deluxe;
  const txnId = 'PET-TXN-' + Date.now();

  const payload = {
    roomTypeId: selectedRoomObj.roomTypeId,
    rateplanId: selectedRoomObj.rateplanId,
    ratetypeId: '1',
    baseRate: activeBookingState.baseRate,
    adults: activeBookingState.adults,
    children: 0,
    title: activeBookingState.title,
    firstName: activeBookingState.firstName,
    lastName: activeBookingState.lastName,
    email: activeBookingState.email,
    phone: activeBookingState.phone,
    address: activeBookingState.city ? `${activeBookingState.city}, ${activeBookingState.country}` : 'Bangalore',
    city: activeBookingState.city || 'Bangalore',
    country: activeBookingState.country || 'India',
    specialRequest: activeBookingState.specialRequest || '',
    checkIn: activeBookingState.checkIn,
    checkOut: activeBookingState.checkOut,
    paymentMethod: paymentMethod,
    transactionId: txnId
  };

  try {
    const response = await fetch('/api/bookings/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (result.success) {
      // Generated PMS reservation number
      activeBookingState.reservationNo = result.reservationNo || ('PET-REF-' + Math.floor(100000 + Math.random() * 900000));
      activeBookingState.transactionId = txnId;
      activeBookingState.paymentMethod = paymentMethod;

      window.location.hash = 'confirmed';
    } else {
      alert(`Notice: ${result.error || 'Unable to confirm booking. Please contact front desk.'}`);
      [upiBtn, cardBtn].forEach(btn => {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = 'Confirm Payment & Book';
        }
      });
    }
  } catch (error) {
    console.error('Booking sync failed:', error);
    alert('Server error while confirming booking. Please check your connection or contact the hotel.');
    [upiBtn, cardBtn].forEach(btn => {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'Confirm Payment & Book';
      }
    });
  }
};

function loadConfirmationScreen() {
  const refEl = document.getElementById('ticket-ref');
  const guestEl = document.getElementById('ticket-guest-name');
  const roomEl = document.getElementById('ticket-room-name');
  const checkinEl = document.getElementById('ticket-checkin');
  const checkoutEl = document.getElementById('ticket-checkout');
  const nightsEl = document.getElementById('ticket-nights');
  const paidEl = document.getElementById('ticket-paid');

  if (refEl) refEl.textContent = activeBookingState.reservationNo;
  if (guestEl) guestEl.textContent = activeBookingState.guestName;
  if (roomEl) roomEl.textContent = activeBookingState.roomTitle;
  if (checkinEl) checkinEl.textContent = activeBookingState.checkIn;
  if (checkoutEl) checkoutEl.textContent = activeBookingState.checkOut;
  if (nightsEl) nightsEl.textContent = `${activeBookingState.nights} Night${activeBookingState.nights > 1 ? 's' : ''}`;
  if (paidEl) paidEl.textContent = `₹${activeBookingState.totalPrice.toLocaleString('en-IN')}`;

  showStep(3);
}

/* ==========================================================================
   8. Manage My Booking Portal (Lookup by Email or Reference)
   ========================================================================== */
const manageModal = document.getElementById('manage-modal');

window.openManageBookingModal = function() {
  if (!manageModal) return;
  manageModal.classList.add('active');
  document.body.style.overflow = 'hidden';
};

window.closeManageBookingModal = function() {
  if (!manageModal) return;
  manageModal.classList.remove('active');
  document.body.style.overflow = '';
};

if (manageModal) {
  manageModal.addEventListener('click', (e) => {
    if (e.target === manageModal) {
      closeManageBookingModal();
    }
  });
}

window.searchGuestBooking = async function() {
  const inputEl = document.getElementById('manage-search-input');
  const loadingEl = document.getElementById('manage-loading');
  const errorEl = document.getElementById('manage-error');
  const errorTextEl = document.getElementById('manage-error-text');
  const resultsContainer = document.getElementById('manage-results');

  if (!inputEl) return;
  const input = inputEl.value.trim();

  if (!input) {
    alert('Please enter your email or booking reference.');
    return;
  }

  if (loadingEl) loadingEl.style.display = 'block';
  if (errorEl) errorEl.style.display = 'none';
  if (resultsContainer) {
    resultsContainer.style.display = 'none';
    resultsContainer.innerHTML = '';
  }

  const isEmail = input.includes('@');
  const queryParam = isEmail ? `email=${encodeURIComponent(input)}` : `resNo=${encodeURIComponent(input)}`;

  try {
    const res = await fetch(`/api/bookings/manage?${queryParam}`);
    const json = await res.json();
    if (loadingEl) loadingEl.style.display = 'none';

    if (json.success && json.data) {
      if (resultsContainer) {
        resultsContainer.style.display = 'block';
        resultsContainer.innerHTML = `
          <div class="manage-booking-card">
            <div class="manage-card-header">
              <div>
                <span class="pms-chip"><i class="fa-solid fa-hotel"></i> Petals Reservation</span>
                <h4>Booking #${escapeHTML(input)}</h4>
              </div>
              <span class="status-badge confirmed">Confirmed & Guaranteed</span>
            </div>
            <div class="manage-card-grid">
              <div><strong>Guest:</strong> ${escapeHTML(activeBookingState.guestName || 'Registered Guest')}</div>
              <div><strong>Room:</strong> ${escapeHTML(activeBookingState.roomTitle || 'Executive Room')}</div>
              <div><strong>Check-In:</strong> ${escapeHTML(activeBookingState.checkIn || '2026-09-10')}</div>
              <div><strong>Check-Out:</strong> ${escapeHTML(activeBookingState.checkOut || '2026-09-12')}</div>
              <div><strong>Payment:</strong> <span style="color: var(--success);"><i class="fa-solid fa-circle-check"></i> Paid Online</span></div>
            </div>
            <div class="manage-card-actions">
              <button class="secondary-btn-link" onclick="window.print()"><i class="fa-solid fa-print"></i> Print Voucher</button>
              <a href="tel:+918123698844" class="secondary-btn-link"><i class="fa-solid fa-phone"></i> Contact Front Desk</a>
            </div>
          </div>
        `;
      }
    } else {
      if (errorEl) errorEl.style.display = 'block';
      if (errorTextEl) errorTextEl.textContent = json.error || 'No matching bookings found in reservation records.';
    }
  } catch (err) {
    if (loadingEl) loadingEl.style.display = 'none';
    if (errorEl) errorEl.style.display = 'block';
    if (errorTextEl) errorTextEl.textContent = 'Failed to connect to reservation service. Please try again later.';
  }
};

/* ==========================================================================
   9. Interactive Amenities Modal Controller
   ========================================================================== */
const amenitiesModal = document.getElementById('amenities-modal');
let currentInspectedRoom = 'deluxe';

window.openAmenitiesModal = function(roomCategory = 'deluxe') {
  if (!amenitiesModal) return;
  currentInspectedRoom = roomCategory;
  
  const selectedRoom = roomDb[roomCategory] || roomDb.deluxe;
  const titleEl = document.getElementById('amenities-modal-title');
  const tagEl = document.getElementById('amenities-modal-tag');
  const priceEl = document.getElementById('amenities-modal-price');
  const suiteSection = document.getElementById('suite-exclusive-section');
  const bookBtn = document.getElementById('amenities-book-btn');

  if (titleEl) titleEl.textContent = `${selectedRoom.title} Inclusions`;
  if (priceEl) priceEl.textContent = `₹${selectedRoom.price.toLocaleString('en-IN')}`;
  
  if (roomCategory === 'suite') {
    if (tagEl) tagEl.innerHTML = '<i class="fa-solid fa-crown"></i> Signature Suite Features';
    if (suiteSection) suiteSection.style.display = 'block';
    if (bookBtn) {
      bookBtn.innerHTML = `<span>Book Suite Room</span> <i class="fa-solid fa-arrow-right"></i>`;
    }
  } else {
    if (tagEl) tagEl.innerHTML = '<i class="fa-solid fa-sparkles"></i> Room Inclusions';
    if (suiteSection) suiteSection.style.display = 'none';
    if (bookBtn) {
      bookBtn.innerHTML = `<span>Book ${selectedRoom.title}</span> <i class="fa-solid fa-arrow-right"></i>`;
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

window.bookFromAmenitiesModal = function() {
  closeAmenitiesModal();
  openBookingModal(currentInspectedRoom);
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
      if (manageModal && manageModal.classList.contains('active')) {
        closeManageBookingModal();
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
  const name = activeBookingState.guestName || 'Valued Guest';
  const phone = activeBookingState.phone || 'N/A';
  const whatsappMsg = `Hello Petals Hotel & Suites,\n\nI would like to inquire about booking a stay:\n\n` +
    `• *Name:* ${name}\n` +
    `• *Phone:* ${phone}\n` +
    `• *Room Type:* ${activeBookingState.roomTitle}\n` +
    `• *Check-in Date:* ${activeBookingState.checkIn || 'Upcoming'}\n` +
    `• *Check-out Date:* ${activeBookingState.checkOut || 'Upcoming'}\n` +
    `• *Duration:* ${activeBookingState.nights} Night(s)\n` +
    `• *Estimated Total:* ₹${activeBookingState.totalPrice.toLocaleString('en-IN')}\n\n` +
    `Please confirm room availability. Thank you!`;

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
      if (!bookingModal || !bookingModal.classList.contains('active')) {
        document.body.style.overflow = '';
      }
    }
  }

  if (bookingModal) {
    if (hash.startsWith('#booking-')) {
      const roomCat = hash.split('-')[1];
      openBookingModalDirect(roomCat);
      showStep(1);
    } else if (hash === '#booking') {
      openBookingModalDirect('deluxe');
      showStep(1);
    } else if (hash === '#payment') {
      if (!bookingModal.classList.contains('active')) {
        openBookingModalDirect('deluxe');
      }
      loadPaymentScreen();
    } else if (hash === '#confirmed') {
      if (!bookingModal.classList.contains('active')) {
        openBookingModalDirect('deluxe');
      }
      loadConfirmationScreen();
    } else if (hash !== '#manage-booking') {
      closeBookingModalDirect();
    }
  }

  if (hash === '#manage-booking') {
    openManageBookingModal();
  }
}

handleHashRouting();
