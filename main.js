/**
 * Petals Suites & Hotel - Frontend Controller
 * Modern hospitality client interactions and booking integrations.
 */

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initScrollAnimationsFallback();
  initDateFields();
  initBulkBookingForm();
});

/* ==========================================================================
   1. Mobile Menu Functionality
   ========================================================================== */
function initMobileMenu() {
  const menuToggle = document.querySelector('.mobile-menu-toggle');
  const menuClose = document.querySelector('.mobile-menu-close');
  const navOverlay = document.querySelector('.mobile-nav-overlay');
  const mobileLinks = document.querySelectorAll('.mobile-link');

  if (menuToggle && navOverlay) {
    menuToggle.addEventListener('click', () => {
      navOverlay.classList.add('active');
      document.body.style.overflow = 'hidden'; // Prevent scrolling background
    });
  }

  if (menuClose && navOverlay) {
    menuClose.addEventListener('click', () => {
      navOverlay.classList.remove('active');
      document.body.style.overflow = '';
    });
  }

  // Close mobile nav when clicking a link
  mobileLinks.forEach(link => {
    link.addEventListener('click', () => {
      navOverlay.classList.remove('active');
      document.body.style.overflow = '';
    });
  });
}

/* ==========================================================================
   2. Modern CSS Animations Fallbacks (Progressive Enhancement)
   ========================================================================== */
function initScrollAnimationsFallback() {
  const header = document.querySelector('.main-header');

  // Fallback for Shrinking Header on Scroll
  if (header && !CSS.supports('(animation-timeline: scroll()) and (animation-range: 0% 100%)')) {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial run on page load
  }

  // Fallback for Scroll Reveal Entrance Effects
  if (!CSS.supports('(animation-timeline: view()) and (animation-range: entry)')) {
    const revealElements = document.querySelectorAll('.scroll-reveal');
    
    const observerOptions = {
      root: null, // viewport
      threshold: 0.15, // trigger when 15% visible
      rootMargin: '0px 0px -50px 0px' // offset bottom trigger slightly
    };

    const observer = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target); // Trigger only once
        }
      });
    }, observerOptions);

    revealElements.forEach(el => {
      observer.observe(el);
    });
  }
}

/* ==========================================================================
   3. Booking Dates Auto-setup
   ========================================================================== */
function initDateFields() {
  const checkinHero = document.getElementById('hero-checkin');
  const checkoutHero = document.getElementById('hero-checkout');
  const checkinModal = document.getElementById('modal-checkin');
  const checkoutModal = document.getElementById('modal-checkout');

  // Get current date string (YYYY-MM-DD)
  const today = new Date();
  const todayStr = formatDate(today);
  
  // Set tomorrow as default checkout
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatDate(tomorrow);

  // Set min dates & default values
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

  // Keep check-out date dynamic (must be after check-in) & trigger price recalculation
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

        // Trigger price updates if checking/modifying the modal date
        if (index === 1) {
          calculateTotalPrice();
        }
      });
    }
  });

  if (checkoutModal) {
    checkoutModal.addEventListener('change', () => {
      calculateTotalPrice();
    });
  }
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/* ==========================================================================
   4. Redesigned Multi-step Booking System with Hash Routing
   ========================================================================== */
const bookingModal = document.getElementById('booking-modal');

// Room Details database mapping
const roomDb = {
  single: { title: 'Single Room', price: 2499, thumb: 'images/single room.jpeg' },
  superior: { title: 'Superior Room', price: 3499, thumb: 'images/superior room.jpeg' },
  deluxe: { title: 'Deluxe Room', price: 4499, thumb: 'images/deluxe room.jpeg' },
  suite: { title: 'Suite Room', price: 6499, thumb: 'images/suite room.jpeg' }
};

// Opens the modal by updating the hash (pushes history state)
window.openBookingModal = function(roomCategory = 'deluxe') {
  window.location.hash = `booking-${roomCategory}`;
};

// Helper that performs the actual DOM open and prefill (called by router)
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
    roomRate.innerHTML = `₹${selectedRoom.price.toLocaleString('en-IN')} <span>/ night</span>`;
  }
  
  // Set default guest count
  selectGuests(1);

  // Recalculate price
  calculateTotalPrice();

  // Reset name/phone inputs
  document.getElementById('modal-name').value = '';
  document.getElementById('modal-phone').value = '';

  // Show Modal Container
  bookingModal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

// Closes the modal by clearing the hash
window.closeBookingModal = function() {
  // Replace hash with empty space without adding history entries
  history.replaceState(null, null, ' ');
  // Dispatch hashchange manually to let the router run close routines
  window.dispatchEvent(new Event('hashchange'));
};

function closeBookingModalDirect() {
  if (!bookingModal) return;
  bookingModal.classList.remove('active');
  document.body.style.overflow = '';
}

// Close modal if clicked outside the modal card content area
if (bookingModal) {
  bookingModal.addEventListener('click', (e) => {
    if (e.target === bookingModal) {
      closeBookingModal();
    }
  });
}

// Stepper controller (shows Step 1, 2, or 3)
window.showStep = function(stepNum) {
  document.querySelectorAll('.modal-step').forEach((el, index) => {
    if (index + 1 === stepNum) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });
};

// Guest Selector toggles
window.selectGuests = function(count) {
  const guestInput = document.getElementById('modal-guests');
  if (guestInput) {
    guestInput.value = count;
  }

  // Update pills CSS
  const pills = document.querySelectorAll('.guest-pill');
  pills.forEach((pill, idx) => {
    if (idx + 1 === count) {
      pill.classList.add('active');
    } else {
      pill.classList.remove('active');
    }
  });
};

// Helper to calculate nights between check-in and check-out
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

// Recalculates price dynamics dynamically on input changes
window.calculateTotalPrice = function() {
  const roomVal = document.getElementById('modal-room').value;
  const selectedRoom = roomDb[roomVal] || roomDb.deluxe;
  
  const nights = calculateNights();
  const totalPrice = selectedRoom.price * nights;

  const priceText = document.getElementById('modal-total-price');
  const nightsText = document.getElementById('modal-total-nights');

  if (priceText) {
    priceText.textContent = `₹${totalPrice.toLocaleString('en-IN')}`;
  }
  if (nightsText) {
    nightsText.textContent = `for ${nights} night${nights > 1 ? 's' : ''}`;
  }
};

/* ==========================================================================
   5. Checkout & Payments (Simulated)
   ========================================================================== */
window.proceedToPayment = function() {
  const name = document.getElementById('modal-name').value.trim();
  const phone = document.getElementById('modal-phone').value.trim();

  if (!name || !phone) {
    alert('Please fill in all mandatory fields.');
    return;
  }

  // Navigate to payment screen by pushing hash (history support)
  window.location.hash = 'payment';
};

// Actually configures Step 2 screen variables
function loadPaymentScreen() {
  const roomVal = document.getElementById('modal-room').value;
  const selectedRoom = roomDb[roomVal] || roomDb.deluxe;
  const nights = calculateNights();
  const guests = document.getElementById('modal-guests').value;
  const totalPrice = selectedRoom.price * nights;
  const formattedTotal = `₹${totalPrice.toLocaleString('en-IN')}`;

  document.getElementById('payment-summary-room').textContent = selectedRoom.title;
  document.getElementById('payment-summary-nights').textContent = `${nights} Night${nights > 1 ? 's' : ''}`;
  document.getElementById('payment-summary-guests').textContent = `${guests} Guest${guests > 1 ? 's' : ''}`;

  document.getElementById('modal-payment-total').textContent = formattedTotal;
  document.getElementById('modal-payment-total-upi').textContent = formattedTotal;

  // Reset payment tabs / panels
  switchPaymentMethod('card');
  showStep(2);
}

window.switchPaymentMethod = function(method) {
  const tabCard = document.getElementById('tab-card');
  const tabUpi = document.getElementById('tab-upi');
  const panelCard = document.getElementById('payment-card-form');
  const panelUpi = document.getElementById('payment-upi-panel');

  if (method === 'card') {
    tabCard.classList.add('active');
    tabUpi.classList.remove('active');
    panelCard.classList.add('active');
    panelUpi.classList.remove('active');
  } else {
    tabCard.classList.remove('active');
    tabUpi.classList.add('active');
    panelCard.classList.remove('active');
    panelUpi.classList.add('active');
  }
};

window.triggerUPIPayment = function() {
  const upiId = document.getElementById('upi-id').value.trim();
  if (!upiId) {
    alert('Please enter a valid UPI ID (e.g. name@upi)');
    return;
  }

  const verifyBtn = document.querySelector('.upi-verify-btn');
  verifyBtn.disabled = true;
  verifyBtn.textContent = 'Sending Request...';

  setTimeout(() => {
    verifyBtn.textContent = 'Request Sent!';
    alert(`A simulated payment request of ${document.getElementById('modal-payment-total-upi').textContent} has been sent to ${upiId}. Please approve on your phone UPI app.`);
    verifyBtn.disabled = false;
    verifyBtn.textContent = 'Send Request';
  }, 1500);
};

window.submitPayment = function() {
  const activePanel = document.querySelector('.payment-content-panel.active');
  const submitBtn = activePanel.querySelector('.modal-proceed-btn');
  
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing Payment...';
  }

  setTimeout(() => {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Pay & Confirm Booking';
    }
    
    // Push confirmed state to hash (history support)
    window.location.hash = 'confirmed';
  }, 1800);
};

// Actually configures Step 3 ticket details
function loadConfirmationScreen() {
  const refNum = 'PET-' + new Date().getFullYear() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
  const guestName = document.getElementById('modal-name').value || 'Valued Guest';
  const roomVal = document.getElementById('modal-room').value;
  const selectedRoom = roomDb[roomVal] || roomDb.deluxe;
  const checkin = document.getElementById('modal-checkin').value;
  const checkout = document.getElementById('modal-checkout').value;
  const nights = calculateNights();
  const totalPrice = selectedRoom.price * nights;

  document.getElementById('ticket-ref').textContent = refNum;
  document.getElementById('ticket-guest-name').textContent = guestName;
  document.getElementById('ticket-room-name').textContent = selectedRoom.title;
  document.getElementById('ticket-checkin').textContent = checkin;
  document.getElementById('ticket-checkout').textContent = checkout;
  document.getElementById('ticket-nights').textContent = `${nights} Night${nights > 1 ? 's' : ''}`;
  document.getElementById('ticket-paid').textContent = `₹${totalPrice.toLocaleString('en-IN')}`;

  showStep(3);
}

/* ==========================================================================
   6. Backup Direct Connections (WhatsApp & Call)
   ========================================================================== */
window.submitBookingToWhatsApp = function() {
  const name = document.getElementById('modal-name').value.trim() || 'Valued Guest';
  const phone = document.getElementById('modal-phone').value.trim() || 'N/A';
  const roomVal = document.getElementById('modal-room').value;
  const selectedRoom = roomDb[roomVal] || roomDb.deluxe;
  const checkin = document.getElementById('modal-checkin').value;
  const checkout = document.getElementById('modal-checkout').value;
  const nights = calculateNights();
  const guests = document.getElementById('modal-guests').value;
  const totalPrice = selectedRoom.price * nights;

  const whatsappMsg = `Hello Petals Hotel & Suites,\n\nI would like to inquire about booking a stay:\n\n` +
    `• *Name:* ${name}\n` +
    `• *Phone:* ${phone}\n` +
    `• *Room Type:* ${selectedRoom.title}\n` +
    `• *Guests:* ${guests} Guest(s)\n` +
    `• *Check-in Date:* ${checkin}\n` +
    `• *Check-out Date:* ${checkout}\n` +
    `• *Duration:* ${nights} Night(s)\n` +
    `• *Estimated Total:* ₹${totalPrice.toLocaleString('en-IN')}\n\n` +
    `Please confirm details. Thank you!`;

  const encodedMsg = encodeURIComponent(whatsappMsg);
  const whatsappUrl = `https://wa.me/919482090023?text=${encodedMsg}`;
  
  window.open(whatsappUrl, '_blank');
};

window.submitBookingToCall = function() {
  window.location.href = 'tel:+919482090023';
};

/* ==========================================================================
   7. Corporate / Bulk Booking Form Mock Submission
   ========================================================================== */
function initBulkBookingForm() {
  const form = document.getElementById('bulk-booking-form');
  const successBanner = document.getElementById('bulk-success-message');

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const submitBtn = form.querySelector('.submit-form-btn');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Processing Query...';

      setTimeout(() => {
        form.style.display = 'none';
        if (successBanner) {
          successBanner.style.display = 'block';
          successBanner.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 1500);
    });
  }
}

/* ==========================================================================
   8. Global Hash router (Handles Browser Back/Forward navigation)
   ========================================================================= */
window.addEventListener('hashchange', handleHashRouting);

function handleHashRouting() {
  const hash = window.location.hash;

  // Handle Mobile Navigation Menu Toggle
  const navOverlay = document.querySelector('.mobile-nav-overlay');
  if (navOverlay) {
    if (hash === '#menu') {
      navOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    } else {
      navOverlay.classList.remove('active');
      // Only restore overflow if the booking modal is also closed
      if (!bookingModal || !bookingModal.classList.contains('active')) {
        document.body.style.overflow = '';
      }
    }
  }

  // Handle Booking steps checkout routing
  if (bookingModal) {
    if (hash.startsWith('#booking-')) {
      const roomCat = hash.split('-')[1];
      openBookingModalDirect(roomCat);
      showStep(1);
    } else if (hash === '#booking') {
      openBookingModalDirect('deluxe');
      showStep(1);
    } else if (hash === '#payment') {
      // Ensure modal details are initialized if landing directly or going forward/back
      if (!bookingModal.classList.contains('active')) {
        openBookingModalDirect('deluxe');
      }
      loadPaymentScreen();
    } else if (hash === '#confirmed') {
      if (!bookingModal.classList.contains('active')) {
        openBookingModalDirect('deluxe');
      }
      loadConfirmationScreen();
    } else {
      // Close overlay DOM completely if hash is empty or standard anchors
      closeBookingModalDirect();
    }
  }

  // Scroll active links highlighting updates
  updateActiveNavLink(hash);
}

// Triggers active nav links highlights
function updateActiveNavLink(hash) {
  const links = document.querySelectorAll('.nav-link, .mobile-link');
  links.forEach(link => {
    const href = link.getAttribute('href');
    if (href === hash) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

// Override mobile toggles to use hash instead of direct DOM manipulation
const menuToggle = document.querySelector('.mobile-menu-toggle');
if (menuToggle) {
  const newToggle = menuToggle.cloneNode(true);
  menuToggle.parentNode.replaceChild(newToggle, menuToggle);
  newToggle.addEventListener('click', () => {
    window.location.hash = 'menu';
  });
}

const menuClose = document.querySelector('.mobile-menu-close');
if (menuClose) {
  const newClose = menuClose.cloneNode(true);
  menuClose.parentNode.replaceChild(newClose, menuClose);
  newClose.addEventListener('click', () => {
    history.back(); // Naturally handles close via router
  });
}

// Initial router run to handle initial hash load states on page refresh
handleHashRouting();
