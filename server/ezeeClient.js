/**
 * eZee PMS API Client
 * Direct integration with eZee Absolute / YCS Connectivity API
 * Documentation: https://api.ezeetechnosys.com
 */

const dotenv = require('dotenv');
dotenv.config();

class EZeeClient {
  constructor() {
    this.hotelCode = process.env.EZEE_HOTEL_CODE || '';
    this.authKey = process.env.EZEE_AUTH_KEY || '';
    this.reservationApiUrl = process.env.EZEE_RESERVATION_API_URL || 'https://live.ipms247.com/booking/reservation_api/listing.php';
    this.kioskApiUrl = process.env.EZEE_KIOSK_API_URL || 'https://live.ipms247.com/index.php/page/service.kioskconnectivity';
    this.pmsConnectivityUrl = process.env.EZEE_PMS_CONNECTIVITY_URL || 'https://live.ipms247.com/pmsinterface/pms_connectivity.php';
  }

  /**
   * Helper to perform HTTP POST to eZee Reservation API
   */
  async _postReservationApi(params = {}, bodyData = null) {
    const queryParams = new URLSearchParams({
      HotelCode: this.hotelCode,
      APIKey: this.authKey,
      ...params
    });

    const url = `${this.reservationApiUrl}?${queryParams.toString()}`;
    
    try {
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json, text/plain, */*'
        }
      };

      if (bodyData) {
        options.body = typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData);
      }

      const response = await fetch(url, options);
      const text = await response.text();

      try {
        return JSON.parse(text);
      } catch (parseErr) {
        // In case eZee returns text or XML
        return { raw: text, status: response.status };
      }
    } catch (error) {
      console.error(`[eZee API Error] ${params.request_type || 'Unknown Request'}:`, error.message);
      throw error;
    }
  }

  /**
   * 1. Check Live Room Rates & Availability (RoomList)
   * @param {Object} query { checkIn: 'YYYY-MM-DD', checkOut: 'YYYY-MM-DD' }
   */
  async checkAvailability({ checkIn, checkOut }) {
    if (!checkIn || !checkOut) {
      throw new Error('checkIn and checkOut dates are required');
    }

    return await this._postReservationApi({
      request_type: 'RoomList',
      check_in_date: checkIn,
      check_out_date: checkOut
    });
  }

  /**
   * 2. Retrieve Published Room Types
   */
  async getRoomTypes(language = 'en') {
    return await this._postReservationApi({
      request_type: 'RoomTypeList',
      language: language,
      publishtoweb: '1'
    });
  }

  /**
   * 3. Retrieve Hotel Profile & Amenities
   */
  async getHotelInfo(language = 'en') {
    return await this._postReservationApi({
      request_type: 'HotelList',
      language: language
    });
  }

  async getHotelAmenities(language = 'en') {
    return await this._postReservationApi({
      request_type: 'HotelAmenity',
      language: language
    });
  }

  /**
   * 4. Retrieve Configured Details (Salutations, Countries, States)
   */
  async getConfiguredDetails(language = 'en') {
    return await this._postReservationApi({
      request_type: 'ConfiguredDetails',
      language: language
    });
  }

  /**
   * 5. Create Booking in eZee PMS (InsertBooking)
   * @param {Object} bookingData Structured JSON payload matching eZee InsertBooking schema
   */
  async insertBooking(bookingData) {
    if (!bookingData) {
      throw new Error('BookingData is required for InsertBooking');
    }

    const payloadString = typeof bookingData === 'string' ? bookingData : JSON.stringify(bookingData);

    return await this._postReservationApi({
      request_type: 'InsertBooking',
      BookingData: payloadString
    });
  }

  /**
   * 6. Confirm Booking & Allocate Inventory (ProcessBooking)
   * @param {Object} params { reservationNo, action, inventoryMode, errorText }
   */
  async processBooking({ reservationNo, action = 'ConfirmBooking', inventoryMode = 'ALLOCATED', errorText = '' }) {
    if (!reservationNo) {
      throw new Error('reservationNo is required for ProcessBooking');
    }

    const processData = {
      Action: action,
      ReservationNo: String(reservationNo),
      Inventory_Mode: inventoryMode,
      Error_Text: errorText
    };

    return await this._postReservationApi({
      request_type: 'ProcessBooking',
      Process_Data: JSON.stringify(processData)
    });
  }

  /**
   * 7. Record Payment into Guest Folio (Kiosk / AddPayment API)
   * @param {Object} paymentInfo { reservationNo, amount, paymentMethod, transactionId }
   */
  async addPayment({ reservationNo, amount, paymentMethod = 'Online Payment', transactionId = '' }) {
    const payload = {
      RES_Request: {
        Request_Type: 'AddPayment',
        Authentication: {
          HotelCode: this.hotelCode,
          AuthCode: this.authKey
        },
        ReservationNo: String(reservationNo),
        Amount: String(amount),
        PaymentMethod: paymentMethod,
        TransactionId: String(transactionId)
      }
    };

    try {
      const response = await fetch(this.kioskApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch (err) {
        return { raw: text, status: response.status };
      }
    } catch (error) {
      console.error('[eZee AddPayment Error]:', error.message);
      throw error;
    }
  }

  /**
   * 8. Read Single Booking Voucher / Status (ReadBooking)
   * @param {string|number} reservationNo 
   */
  async readBooking(reservationNo, language = 'en') {
    if (!reservationNo) {
      throw new Error('Reservation number is required for ReadBooking');
    }

    return await this._postReservationApi({
      request_type: 'ReadBooking',
      ResNo: String(reservationNo),
      language: language
    });
  }

  /**
   * 9. Manage My Booking / Search by Guest Email (BookingList)
   * @param {string} email 
   */
  async searchBookingsByEmail(email) {
    if (!email) {
      throw new Error('Email is required to search booking history');
    }

    return await this._postReservationApi({
      request_type: 'BookingList',
      EmailId: email
    });
  }
}

module.exports = new EZeeClient();
