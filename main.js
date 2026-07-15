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
   4. Redesigned Multi-step Booking System
   ========================================================================== */
const bookingModal = document.getElementById('booking-modal');

// Room Details database mapping
const roomDb = {
  single: { title: 'Single Room', price: 2499, thumb: 'images/single room.jpeg' },
  superior: { title: 'Superior Room', price: 3499, thumb: 'images/superior room.jpeg' },
  deluxe: { title: 'Deluxe Room', price: 4499, thumb: 'images/deluxe room.jpeg' },
  suite: { title: 'Suite Room', price: 6499, thumb: 'images/suite room.jpeg' }
};

window.openBookingModal = function(roomCategory = 'deluxe') {
  if (!bookingModal) return;
  
  // Set to Step 1 initially
  showStep(1);

  // Pre-fill selected category hidden values and card context
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
  
  // If dates are entered in the Hero, transfer them to the modal
  const heroCheckin = document.getElementById('hero-checkin');
  const heroCheckout = document.getElementById('hero-checkout');
  const modalCheckin = document.getElementById('modal-checkin');
  const modalCheckout = document.getElementById('modal-checkout');
  
  if (heroCheckin && modalCheckin && heroCheckin.value) {
    modalCheckin.value = heroCheckin.value;
  }
  if (heroCheckout && modalCheckout && heroCheckout.value) {
    modalCheckout.value = heroCheckout.value;
  }
  
  // Default values
  selectGuests(1);

  // Calculate nights and total price
  calculateTotalPrice();

  // Reset form inputs (name/phone)
  document.getElementById('modal-name').value = '';
  document.getElementById('modal-phone').value = '';

  bookingModal.classList.add('active');
  document.body.style.overflow = 'hidden';
};

window.closeBookingModal = function() {
  if (!bookingModal) return;
  bookingModal.classList.remove('active');
  document.body.style.overflow = '';
};

// Close modal if clicked outside the modal card content area
if (bookingModal) {
  bookingModal.addEventListener('click', (e) => {
    if (e.target === bookingModal) {
      closeBookingModal();
    }
  });
}

// Check Rates search bar button from Hero Section
window.triggerHeroBooking = function() {
  const selectedRoom = document.getElementById('hero-room-type').value;
  openBookingModal(selectedRoom);
};

// Stepper controller (1, 2, or 3)
window.showStep = function(stepNum) {
  document.querySelectorAll('.modal-step').forEach((el, index) => {
    if (index + 1 === stepNum) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });
};

// Guest Selector active toggles
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
   5. Checkout Checkout / Payments (Simulated)
   ========================================================================== */
window.proceedToPayment = function() {
  const name = document.getElementById('modal-name').value.trim();
  const phone = document.getElementById('modal-phone').value.trim();

  if (!name || !phone) {
    alert('Please fill in all mandatory fields.');
    return;
  }

  // Set checkout panel texts
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

  // Go to step 2
  showStep(2);
};

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
  // Show fake loading overlay state on the CTA button
  const activePanel = document.querySelector('.payment-content-panel.active');
  const submitBtn = activePanel.querySelector('.modal-proceed-btn');
  
  if (submitBtn) {
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing Payment...';
  }

  setTimeout(() => {
    // Generate Booking reference details
    const refNum = 'PET-' + new Date().getFullYear() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const guestName = document.getElementById('modal-name').value;
    const roomVal = document.getElementById('modal-room').value;
    const selectedRoom = roomDb[roomVal] || roomDb.deluxe;
    const checkin = document.getElementById('modal-checkin').value;
    const checkout = document.getElementById('modal-checkout').value;
    const nights = calculateNights();
    const totalPrice = selectedRoom.price * nights;

    // Fill ticket elements
    document.getElementById('ticket-ref').textContent = refNum;
    document.getElementById('ticket-guest-name').textContent = guestName;
    document.getElementById('ticket-room-name').textContent = selectedRoom.title;
    document.getElementById('ticket-checkin').textContent = checkin;
    document.getElementById('ticket-checkout').textContent = checkout;
    document.getElementById('ticket-nights').textContent = `${nights} Night${nights > 1 ? 's' : ''}`;
    document.getElementById('ticket-paid').textContent = `₹${totalPrice.toLocaleString('en-IN')}`;

    // Reset button states
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Pay & Confirm Booking';
    }

    // Go to step 3
    showStep(3);
  }, 1800);
};

/* ==========================================================================
   6. Backup Direct Connections (WhatsApp & Call)
   ========================================================================== */
window.submitBookingToWhatsApp = function() {
  // Grab current entries
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

      // Show loader animation simulation
      const submitBtn = form.querySelector('.submit-form-btn');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Processing Query...';

      setTimeout(() => {
        // Hide form, show success message
        form.style.display = 'none';
        if (successBanner) {
          successBanner.style.display = 'block';
          successBanner.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 1500); // 1.5s visual confirmation
    });
  }
}

