/**
 * API Routes for Petals Suites Booking Engine & eZee PMS
 */

const express = require('express');
const router = express.Router();
const ezeeClient = require('../ezeeClient');

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

    const data = await ezeeClient.checkAvailability({ checkIn: checkin, checkOut: checkout });
    return res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching availability:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to check availability with eZee PMS'
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
router.post('/bookings/create', async (req, res) => {
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

    if (!firstName || !email || !phone || !checkIn || !checkOut) {
      return res.status(400).json({
        success: false,
        error: 'Missing required booking fields (firstName, email, phone, checkIn, checkOut)'
      });
    }

    // Construct the exact BookingData object matching eZee schema
    const bookingData = {
      Room_Details: {
        Room_1: {
          Rateplan_Id: String(rateplanId || '1'),
          Ratetype_Id: String(ratetypeId || '1'),
          Roomtype_Id: String(roomTypeId || '1'),
          baserate: String(baseRate || '0'),
          extradultrate: String(extraAdultRate || '0'),
          extrachildrate: String(extraChildRate || '0'),
          number_adults: String(adults || '1'),
          number_children: String(children || '0'),
          ExtraChild_Age: String(extraChildAge || ''),
          Title: title,
          First_Name: firstName,
          Last_Name: lastName || '',
          Gender: gender,
          SpecialRequest: specialRequest
        }
      },
      check_in_date: checkIn,
      check_out_date: checkOut,
      Booking_Payment_Mode: paymentMethod,
      Email_Address: email,
      Source_Id: 'WEBSITE',
      MobileNo: phone,
      Address: address,
      State: state,
      Country: country,
      City: city,
      Zipcode: zipcode,
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
          reservationNo: reservationNo,
          action: 'ConfirmBooking',
          inventoryMode: 'ALLOCATED'
        });
      } catch (err) {
        console.warn(`[ProcessBooking Warning] Failed to confirm reservation #${reservationNo}:`, err.message);
      }

      // Step C: Record payment in PMS Folio
      try {
        paymentResult = await ezeeClient.addPayment({
          reservationNo: reservationNo,
          amount: baseRate,
          paymentMethod: paymentMethod,
          transactionId: transactionId || `TXN-${Date.now()}`
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
        guestName: `${title} ${firstName} ${lastName || ''}`.trim(),
        email,
        phone,
        checkIn,
        checkOut,
        paymentMethod,
        transactionId: transactionId || `TXN-${Date.now()}`
      }
    });

  } catch (error) {
    console.error('Error creating booking:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error communicating with eZee PMS for booking creation'
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
    const data = await ezeeClient.readBooking(resNo);
    return res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error(`Error reading booking #${req.params.resNo}:`, error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to read booking details from eZee PMS'
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
      const singleBooking = await ezeeClient.readBooking(resNo);
      return res.json({
        success: true,
        type: 'single',
        data: singleBooking
      });
    }

    if (email) {
      const bookingList = await ezeeClient.searchBookingsByEmail(email);
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
    console.error('Error in manage booking search:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve booking history from eZee PMS'
    });
  }
});

/**
 * 7. POST /api/webhooks/ezee
 * Listens for PMS webhook notifications (Autosync Future Bookings and modifications)
 */
router.post('/webhooks/ezee', (req, res) => {
  console.log('⚡ [eZee PMS Webhook Received]:', JSON.stringify(req.body, null, 2));
  // In production, sync updated dates/status into your database or notify admin
  return res.status(200).json({
    received: true,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
