# eZee Absolute PMS Integration Specification & Support Meeting Brief
**Property:** Petals Suites & Hotel, Bangalore  
**Target:** eZee Technosys / YCS Connectivity API Integration  
**Document Version:** 1.0 (Production Ready)  
**Date:** September 2026  

---

## 1. Executive Summary & Objective

Petals Suites & Hotel is deploying a custom direct-booking engine on its official website. We have built an **end-to-end backend integration gateway** (Node.js/Express) communicating directly with **eZee Absolute PMS / YCS Connectivity APIs**.

The purpose of this meeting is to:
1. Verify our API payload structures and request workflows.
2. Obtain our production/sandbox **`HotelCode`** and **`APIKey` / `AuthCode`**.
3. Retrieve our PMS property mappings (**`Roomtype_Id`**, **`Rateplan_Id`**, **`Ratetype_Id`**).
4. Register our **Webhook Listener** for real-time PMS reservation sync.
5. Clarify IP whitelisting and rate limit specifications.

---

## 2. Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│               Petals Suites Hotel Website              │
│       (Guest Search, Room Selection, Checkout)         │
└───────────────────────────┬────────────────────────────┘
                            │ HTTPS (Internal API)
┌───────────────────────────▼────────────────────────────┐
│          Petals Backend API Gateway (Node/Express)     │
│       (Secures APIKey, Formats eZee Schemas)           │
└─────────────┬────────────────────────────▲─────────────┘
              │ HTTPS POST                 │ Webhook Push
┌─────────────▼────────────────────────────┴─────────────┐
│                   eZee Absolute PMS                    │
│     (live.ipms247.com Connectivity & Kiosk API)        │
└────────────────────────────────────────────────────────┘
```

---

## 3. APIs Implemented & Request Specifications

All requests are formatted as `POST` requests to eZee official endpoints using `application/x-www-form-urlencoded` or `application/json`.

### A. Live Availability & Dynamic Rates
* **Endpoint:** `POST https://live.ipms247.com/booking/reservation_api/listing.php`
* **Request Type:** `request_type=RoomList`
* **Parameters Sent:**
  * `HotelCode`: `{{EZEE_HOTEL_CODE}}`
  * `APIKey`: `{{EZEE_AUTH_KEY}}`
  * `check_in_date`: `YYYY-MM-DD`
  * `check_out_date`: `YYYY-MM-DD`
* **Expected Output:** Available room types, inventory balance, base rates, extra adult/child rates, meal plans, and tax rules.

---

### B. Room Metadata & Amenities Sync
* **Endpoint:** `POST https://live.ipms247.com/booking/reservation_api/listing.php`
* **Request Types Used:**
  1. `request_type=RoomTypeList` (`publishtoweb=1`, `language=en`)
  2. `request_type=HotelList` (`language=en`)
  3. `request_type=HotelAmenity` (`language=en`)
* **Purpose:** Dynamically pulls room titles, descriptions, max occupancy, and amenities.

---

### C. Salutations & Country Lists
* **Endpoint:** `POST https://live.ipms247.com/booking/reservation_api/listing.php`
* **Request Type:** `request_type=ConfiguredDetails` (`language=en`)
* **Purpose:** Populates guest title dropdowns (`Mr`, `Ms`, `Mrs`, `Dr`) and country codes to ensure 100% schema alignment with PMS guest profiles.

---

### D. Booking Creation (Push Reservation to PMS)
* **Endpoint:** `POST https://live.ipms247.com/booking/reservation_api/listing.php`
* **Request Type:** `request_type=InsertBooking`
* **URL Parameter Structure:**
  `?request_type=InsertBooking&HotelCode={{HotelCode}}&APIKey={{APIKey}}&BookingData={{JSON_ENCODED_PAYLOAD}}`
* **Payload Format (`BookingData`):**
  ```json
  {
    "Room_Details": {
      "Room_1": {
        "Rateplan_Id": "800000000000001",
        "Ratetype_Id": "1",
        "Roomtype_Id": "800000000000003",
        "baserate": "4499",
        "extradultrate": "0",
        "extrachildrate": "0",
        "number_adults": "2",
        "number_children": "0",
        "ExtraChild_Age": "",
        "Title": "Mr",
        "First_Name": "John",
        "Last_Name": "Doe",
        "Gender": "Male",
        "SpecialRequest": "Quiet high-floor room preferred"
      }
    },
    "check_in_date": "2026-09-25",
    "check_out_date": "2026-09-27",
    "Booking_Payment_Mode": "UPI Online Prepaid",
    "Email_Address": "john.doe@example.com",
    "Source_Id": "WEBSITE",
    "MobileNo": "9876543210",
    "Address": "MG Road",
    "City": "Bangalore",
    "State": "Karnataka",
    "Country": "India",
    "Zipcode": "560001",
    "Fax": "",
    "Device": "Desktop/Web",
    "Languagekey": "en",
    "paymenttypeunkid": ""
  }
  ```
* **PMS Output Required:** `ReservationNo` / `ResNo` / `SubNo`.

---

### E. Inventory Allocation & Status Confirmation
* **Endpoint:** `POST https://live.ipms247.com/booking/reservation_api/listing.php`
* **Request Type:** `request_type=ProcessBooking`
* **Payload Format (`Process_Data`):**
  ```json
  {
    "Action": "ConfirmBooking",
    "ReservationNo": "102458",
    "Inventory_Mode": "ALLOCATED",
    "Error_Text": ""
  }
  ```
* **Purpose:** Confirms the booking post-payment and ensures inventory is locked across channels.

---

### F. Folio Payment Recording
* **Endpoint:** `POST https://live.ipms247.com/index.php/page/service.kioskconnectivity`
* **Request Type:** `Request_Type=AddPayment`
* **Payload Format:**
  ```json
  {
    "RES_Request": {
      "Request_Type": "AddPayment",
      "Authentication": {
        "HotelCode": "{{HotelCode}}",
        "AuthCode": "{{APIKey}}"
      },
      "ReservationNo": "102458",
      "Amount": "5039",
      "PaymentMethod": "UPI Online",
      "TransactionId": "PET-TXN-1726645000"
    }
  }
  ```
* **Purpose:** Posts the transaction ID and paid status directly into the guest's folio in eZee Absolute.

---

### G. Voucher Generation & Single Booking Retrieval
* **Endpoint:** `POST https://live.ipms247.com/booking/reservation_api/listing.php`
* **Request Type:** `request_type=ReadBooking`
* **Parameters:** `HotelCode`, `APIKey`, `ResNo=102458`, `language=en`
* **Purpose:** Generates confirmed booking vouchers and printable receipts.

---

### H. Guest "Manage My Booking" Portal
* **Endpoint:** `POST https://live.ipms247.com/booking/reservation_api/listing.php`
* **Request Type:** `request_type=BookingList`
* **Parameters:** `HotelCode`, `APIKey`, `EmailId=guest@example.com`
* **Purpose:** Allows guests to look up upcoming/past reservations by email or booking ID.

---

### I. PMS Modification Webhook Listener
* **Our Registered Webhook URL:** `https://[our-domain]/api/webhooks/ezee`
* **Method:** `POST` (JSON)
* **Purpose:** Listens for eZee Absolute PMS modification events (`Autosync Future Bookings and its modifications`) whenever front-desk staff edits, reschedules, or cancels reservations.

---

## 4. Specific Action Items / Deliverables from eZee Team

During our meeting, we need the eZee API Support team to provide / confirm the following:

### 1. Credentials
- [x] **Production `HotelCode`**: `63556` (Petals Suites and Hotel)
- [ ] **Production `APIKey` / `AuthCode`**
- [ ] **Sandbox / Staging `HotelCode` and `APIKey`** (if staging testing is recommended prior to live rollout).

### 2. Room Type & Rate Plan ID Mapping (Discovered from Live PMS Configuration)

| Room Category | Room Type UNKID (`Roomtype_Id`) | Rate Plan UNKID (`Rateplan_Id`) | Rate Plan Name | Max Occupancy |
|---|---|---|---|---|
| **Executive Room** | `6355600000000000001` | `6355600000000000001` | Executive Room - Room Only (EP) | 3 Guests (2 Adults, 2 Children) |
| **Deluxe Room** | `6355600000000000002` | `6355600000000000002` | Deluxe Room - Room Only (EP) | 3 Guests (3 Adults) |
| **Superior Room** | `6355600000000000003` | `6355600000000000003` | Superior Room - Room Only (EP) | 3 Guests (2 Adults, 2 Children) |
| **Suite** | `6355600000000000004` | `6355600000000000004` | Suite - Room Only (EP) | 3 Guests (2 Adults) |

### 3. Source & Channel Code
- [ ] What is the exact string or ID to pass in **`Source_Id`** for direct website bookings? (e.g. `"WEBSITE"`, `"DIRECT"`, or a specific Channel Code?).

### 4. IP Whitelisting & Firewall
- [ ] Does eZee require whitelisting our production server IP address, or are the reservation APIs accessible with the `APIKey`?
- [ ] Are there specific API rate limits (calls per minute)?

### 5. Webhook Registration
- [ ] Please register our webhook listener URL: `https://[our-domain]/api/webhooks/ezee` to receive booking cancellation/modification notifications.

---

## 5. Contact & Property Details

* **Property Name:** Petals Suites & Hotel
* **Location:** 3rd Cross, Chanakya Layout, Nagavara, Opposite Manyata Tech Park, Bangalore – 560045
* **Contact Phone:** +91 94820 90023
* **Contact Email:** info@petalshotels.com
* **Technical Integration Lead:** Harsh Tripathi
