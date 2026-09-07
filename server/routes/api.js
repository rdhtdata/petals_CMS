/**
 * API Routes for Petals Suites Booking Engine & eZee PMS
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const ezeeClient = require('../ezeeClient');

// Rate limiter for general public API endpoints (200 requests / 15 min per IP)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests from this IP. Please try again after 15 minutes.'
  }
});

// Stricter rate limiter for booking creation (20 bookings / 15 min per IP)
const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Booking submission limit reached for this IP. Please wait a few minutes or call front desk.'
  }
});

// Apply general limiter to all API routes
router.use(apiLimiter);

// --- Input Validation Helpers ---
const isValidDate = (dateStr) => {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const parsed = new Date(dateStr);
  return !isNaN(parsed.getTime());
};

const isValidEmail = (emailStr) => {
  if (typeof emailStr !== 'string' || emailStr.length > 150) return false;
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(emailStr);
};

const sanitizeText = (str, maxLen = 200) => {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>]/g, '').trim().slice(0, maxLen);
};

/**
 * 1. GET /api/availability
 * Query params: checkin (YYYY-MM-DD), checkout (YYYY-MM-DD)
 */
router.get('/availability', async (req, res) => {
  try {
    const { checkin, checkout } = req.query;
    if (!checkin || !checkout) {
      return res.status(400).json({
        success: false,
        error: 'Missing mandatory query parameters: checkin and checkout'
      });
    }

    if (!isValidDate(checkin) || !isValidDate(checkout)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Dates must be YYYY-MM-DD.'
      });
    }

    if (new Date(checkin) >= new Date(checkout)) {
      return res.status(400).json({
        success: false,
        error: 'Check-out date must be after check-in date.'
      });
    }

    const data = await ezeeClient.checkAvailability({ checkIn: checkin, checkOut: checkout });
    return res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching availability:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to check availability with eZee PMS'
    });
  }
});

/**
 * 2. GET /api/rooms
 * Fetches published room types, hotel profile & amenities
 */
router.get('/rooms', async (req, res) => {
  try {
    const [roomTypes, amenities, hotelInfo] = await Promise.allSettled([
      ezeeClient.getRoomTypes(),
      ezeeClient.getHotelAmenities(),
      ezeeClient.getHotelInfo()
    ]);

    return res.json({
      success: true,
      roomTypes: roomTypes.status === 'fulfilled' ? roomTypes.value : null,
      amenities: amenities.status === 'fulfilled' ? amenities.value : null,
      hotelInfo: hotelInfo.status === 'fulfilled' ? hotelInfo.value : null
    });
  } catch (error) {
    console.error('Error fetching room/hotel data:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch room types'
    });
  }
});

/**
 * 3. GET /api/config-details
 * Fetches salutations and country lists
 */
router.get('/config-details', async (req, res) => {
  try {
    const data = await ezeeClient.getConfiguredDetails();
    return res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching configured details:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch configured details'
    });
  }
});

/**
 * 4. POST /api/bookings/create
 * Creates booking in PMS, Confirms inventory, and Records payment
 */
router.post('/bookings/create', bookingLimiter, async (req, res) => {
  try {
    const {
      roomTypeId,
      rateplanId,
      ratetypeId,
      baseRate,
      extraAdultRate = '0',
      extraChildRate = '0',
      adults = 1,
      children = 0,
      extraChildAge = '',
      title = 'Mr',
      firstName,
      lastName,
      gender = 'Male',
      email,
      phone,
      address = '',
      city = '',
      state = '',
      country = 'India',
      zipcode = '',
      specialRequest = '',
      checkIn,
      checkOut,
      paymentMethod = 'Online Prepaid',
      transactionId = ''
    } = req.body;

    // Required fields check
    if (!firstName || !email || !phone || !checkIn || !checkOut) {
      return res.status(400).json({
        success: false,
        error: 'Missing required booking fields (firstName, email, phone, checkIn, checkOut)'
      });
    }

    // Date validation
    if (!isValidDate(checkIn) || !isValidDate(checkOut)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid check-in or check-out date format.'
      });
    }

    if (new Date(checkIn) >= new Date(checkOut)) {
      return res.status(400).json({
        success: false,
        error: 'Check-out date must be after check-in date.'
      });
    }

    // Email validation
    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid email address.'
      });
    }

    // Phone validation
    const cleanPhone = String(phone).replace(/[^\d+]/g, '');
    if (cleanPhone.length < 7 || cleanPhone.length > 18) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid contact phone number.'
      });
    }

    // Sanitized values
    const safeFirstName = sanitizeText(firstName, 60);
    const safeLastName = sanitizeText(lastName || '', 60);
    const safeTitle = sanitizeText(title, 10) || 'Mr';
    const safeGender = sanitizeText(gender, 15) || 'Male';
    const safeAddress = sanitizeText(address, 200);
    const safeCity = sanitizeText(city, 80);
    const safeState = sanitizeText(state, 80);
    const safeCountry = sanitizeText(country, 80) || 'India';
    const safeZipcode = sanitizeText(zipcode, 20);
    const safeSpecialReq = sanitizeText(specialRequest, 500);
    const safeTxnId = sanitizeText(transactionId, 80) || `TXN-${Date.now()}`;
    const safePaymentMode = sanitizeText(paymentMethod, 50) || 'Online Prepaid';

    const safeAdults = Math.max(1, Math.min(10, parseInt(adults, 10) || 1));
    const safeChildren = Math.max(0, Math.min(10, parseInt(children, 10) || 0));

    // Construct the exact BookingData object matching eZee schema
    const bookingData = {
      Room_Details: {
        Room_1: {
          Rateplan_Id: String(rateplanId || '1'),
          Ratetype_Id: String(ratetypeId || '1'),
          Roomtype_Id: String(roomTypeId || '1'),
          baserate: String(parseFloat(baseRate) || '0'),
          extradultrate: String(parseFloat(extraAdultRate) || '0'),
          extrachildrate: String(parseFloat(extraChildRate) || '0'),
          number_adults: String(safeAdults),
          number_children: String(safeChildren),
          ExtraChild_Age: sanitizeText(extraChildAge, 20),
          Title: safeTitle,
          First_Name: safeFirstName,
          Last_Name: safeLastName,
          Gender: safeGender,
          SpecialRequest: safeSpecialReq
        }
      },
      check_in_date: checkIn,
      check_out_date: checkOut,
      Booking_Payment_Mode: safePaymentMode,
      Email_Address: email.trim().toLowerCase(),
      Source_Id: 'WEBSITE',
      MobileNo: cleanPhone,
      Address: safeAddress,
      State: safeState,
      Country: safeCountry,
      City: safeCity,
      Zipcode: safeZipcode,
      Fax: '',
      Device: 'Desktop/Web',
      Languagekey: 'en',
      paymenttypeunkid: ''
    };

    // Step A: Insert Booking into eZee PMS
    const insertResult = await ezeeClient.insertBooking(bookingData);

    // Extract Reservation Number from response
    let reservationNo = null;
    if (insertResult) {
      reservationNo = insertResult.ReservationNo || insertResult.ResNo || insertResult.Reservation_No || (insertResult.response && insertResult.response.ReservationNo);
    }

    // Step B: If booking number received, Confirm & Allocate Inventory in PMS
    let processResult = null;
    let paymentResult = null;

    if (reservationNo) {
      try {
        processResult = await ezeeClient.processBooking({
          reservationNo: String(reservationNo),
          action: 'ConfirmBooking',
          inventoryMode: 'ALLOCATED'
        });
      } catch (err) {
        console.warn(`[ProcessBooking Warning] Failed to confirm reservation #${reservationNo}:`, err.message);
      }

      // Step C: Record payment in PMS Folio
      try {
        paymentResult = await ezeeClient.addPayment({
          reservationNo: String(reservationNo),
          amount: baseRate,
          paymentMethod: safePaymentMode,
          transactionId: safeTxnId
        });
      } catch (err) {
        console.warn(`[AddPayment Warning] Failed to sync payment for #${reservationNo}:`, err.message);
      }
    }

    return res.json({
      success: true,
      reservationNo: reservationNo,
      insertResponse: insertResult,
      processResponse: processResult,
      paymentResponse: paymentResult,
      bookingSummary: {
        guestName: `${safeTitle} ${safeFirstName} ${safeLastName}`.trim(),
        email: email.trim().toLowerCase(),
        phone: cleanPhone,
        checkIn,
        checkOut,
        paymentMethod: safePaymentMode,
        transactionId: safeTxnId
      }
    });

  } catch (error) {
    console.error('Error creating booking:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Error communicating with eZee PMS for booking creation'
    });
  }
});

/**
 * 5. GET /api/bookings/read/:resNo
 * Fetches full booking details for confirmation voucher
 */
router.get('/bookings/read/:resNo', async (req, res) => {
  try {
    const { resNo } = req.params;
    if (!resNo || !/^[a-zA-Z0-9_\-]{1,50}$/.test(resNo)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid reservation number format'
      });
    }

    const data = await ezeeClient.readBooking(resNo);
    return res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error(`Error reading booking #${req.params.resNo}:`, error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to read booking details from eZee PMS'
    });
  }
});

/**
 * 6. GET /api/bookings/manage
 * Manage My Booking: Query by email or reservation number
 */
router.get('/bookings/manage', async (req, res) => {
  try {
    const { email, resNo } = req.query;

    if (resNo) {
      const cleanResNo = String(resNo).trim();
      if (!/^[a-zA-Z0-9_\-]{1,50}$/.test(cleanResNo)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid reservation number format'
        });
      }
      const singleBooking = await ezeeClient.readBooking(cleanResNo);
      return res.json({
        success: true,
        type: 'single',
        data: singleBooking
      });
    }

    if (email) {
      const cleanEmail = String(email).trim().toLowerCase();
      if (!isValidEmail(cleanEmail)) {
        return res.status(400).json({
          success: false,
          error: 'Please enter a valid email address'
        });
      }
      const bookingList = await ezeeClient.searchBookingsByEmail(cleanEmail);
      return res.json({
        success: true,
        type: 'list',
        data: bookingList
      });
    }

    return res.status(400).json({
      success: false,
      error: 'Please provide either an email or reservation number'
    });
  } catch (error) {
    console.error('Error in manage booking search:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve booking history from eZee PMS'
    });
  }
});

/**
 * 7. POST /api/webhooks/ezee
 * Listens for PMS webhook notifications (Autosync Future Bookings and modifications)
 */
router.post('/webhooks/ezee', (req, res) => {
  console.log('⚡ [eZee PMS Webhook Received]');
  return res.status(200).json({
    received: true,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
