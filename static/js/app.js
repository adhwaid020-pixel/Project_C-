// Airline Reservation System Application Logic
const app = {
  state: {
    currentStep: 1,
    tripType: 'oneway',
    airports: [],
    flights: [],
    selectedFlight: null,
    passengerCount: 1,
    selectedCabinClass: 'economy',
    selectedSeats: [], // array of seat objects [{seat_number, cabin_class, price_modifier}]
    passengerDetails: [],
    contactInfo: { name: '', email: '', phone: '' },
    confirmedBooking: null,
    paymentMethod: 'Credit Card',
    promoCode: '',
    discountAmount: 0.0,
    generatedTxnId: ''
  },

  init: async function() {
    this.setupDateInput();
    await this.loadAirports();
    await this.searchFlights();
  },

  setupDateInput: function() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const minDate = `${yyyy}-${mm}-${dd}`;
    const dateInput = document.getElementById('departure-date');
    dateInput.min = minDate;
    dateInput.value = minDate;
  },

  loadAirports: async function() {
    try {
      const res = await fetch('/api/airports');
      const data = await res.json();
      this.state.airports = data.airports || [];

      const originSelect = document.getElementById('origin-select');
      const destSelect = document.getElementById('destination-select');

      originSelect.innerHTML = '<option value="ALL">All Origins</option>';
      destSelect.innerHTML = '<option value="ALL">All Destinations</option>';

      this.state.airports.forEach(apt => {
        const opt1 = document.createElement('option');
        opt1.value = apt.code;
        opt1.textContent = `${apt.city} (${apt.code}) - ${apt.name}`;
        originSelect.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = apt.code;
        opt2.textContent = `${apt.city} (${apt.code}) - ${apt.name}`;
        destSelect.appendChild(opt2);
      });

      // Default pair: JFK -> LHR
      originSelect.value = "JFK";
      destSelect.value = "LHR";
    } catch (err) {
      console.error("Failed loading airports", err);
    }
  },

  swapAirports: function() {
    const originSelect = document.getElementById('origin-select');
    const destSelect = document.getElementById('destination-select');
    const temp = originSelect.value;
    originSelect.value = destSelect.value;
    destSelect.value = temp;
    this.searchFlights();
  },

  setTripType: function(type) {
    this.state.tripType = type;
    document.getElementById('tab-oneway').classList.toggle('active', type === 'oneway');
    document.getElementById('tab-roundtrip').classList.toggle('active', type === 'roundtrip');
  },

  handleSearch: function(e) {
    if (e) e.preventDefault();
    this.state.passengerCount = parseInt(document.getElementById('passenger-count-select').value, 10);
    this.state.selectedCabinClass = document.getElementById('cabin-class-select').value;
    this.searchFlights();
  },

  searchFlights: async function() {
    const origin = document.getElementById('origin-select').value;
    const dest = document.getElementById('destination-select').value;
    const date = document.getElementById('departure-date').value;
    const cabin = document.getElementById('cabin-class-select').value;

    const listContainer = document.getElementById('flight-list');
    listContainer.innerHTML = '<div style="text-align: center; padding: 3rem; color: #94a3b8;">Searching available flights...</div>';

    try {
      const url = `/api/flights?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}&date=${encodeURIComponent(date)}&class=${encodeURIComponent(cabin)}`;
      const res = await fetch(url);
      const data = await res.json();
      this.state.flights = data.flights || [];
      this.renderFlights();
    } catch (err) {
      listContainer.innerHTML = `<div style="text-align: center; color: #ef4444; padding: 2rem;">Error fetching flights: ${err.message}</div>`;
    }
  },

  renderFlights: function() {
    const listContainer = document.getElementById('flight-list');
    const countText = document.getElementById('results-count-text');

    if (!this.state.flights || this.state.flights.length === 0) {
      countText.textContent = "No Flights Found";
      listContainer.innerHTML = `
        <div style="text-align: center; padding: 3rem; background: var(--bg-card); border-radius: 16px; border: 1px dashed var(--border);">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">✈️</div>
          <h3>No Direct Flights on This Specific Date</h3>
          <p style="color: var(--text-muted); margin-top: 0.5rem;">Try choosing "All Origins" / "All Destinations" or select a different departure date.</p>
        </div>
      `;
      return;
    }

    countText.textContent = `Showing ${this.state.flights.length} Available Flights`;
    listContainer.innerHTML = this.state.flights.map(f => {
      const depDate = new Date(f.departure_time);
      const arrDate = new Date(f.arrival_time);
      const depTimeStr = depDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const arrTimeStr = arrDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const depDateStr = depDate.toLocaleDateString([], { month: 'short', day: 'numeric' });

      return `
        <div class="flight-card">
          <!-- Airline details -->
          <div class="airline-badge">
            <div class="airline-icon">${f.airline_code}</div>
            <div class="airline-info">
              <h3>${f.airline}</h3>
              <span>Flight ${f.flight_number} • ${f.aircraft}</span>
            </div>
          </div>

          <!-- Schedule & Duration -->
          <div class="flight-schedule">
            <div class="time-box">
              <div class="time">${depTimeStr}</div>
              <div class="code">${f.origin_code}</div>
              <div class="city">${f.origin_city}</div>
            </div>

            <div class="duration-line">
              <div class="duration">${f.duration}</div>
              <div class="line"></div>
              <div class="stops">Direct Non-Stop</div>
            </div>

            <div class="time-box">
              <div class="time">${arrTimeStr}</div>
              <div class="code">${f.destination_code}</div>
              <div class="city">${f.destination_city}</div>
            </div>
          </div>

          <!-- Class Pricing & Selection -->
          <div class="pricing-actions">
            <div class="fare-classes">
              <div class="fare-pill ${this.state.selectedCabinClass === 'economy' ? 'selected' : ''}" onclick="app.selectClassAndFlight(${f.id}, 'economy')">
                <div class="label">Economy</div>
                <div class="price">$${f.base_price_economy}</div>
              </div>
              <div class="fare-pill ${this.state.selectedCabinClass === 'business' ? 'selected' : ''}" onclick="app.selectClassAndFlight(${f.id}, 'business')">
                <div class="label">Business</div>
                <div class="price">$${f.base_price_business}</div>
              </div>
              <div class="fare-pill ${this.state.selectedCabinClass === 'first' ? 'selected' : ''}" onclick="app.selectClassAndFlight(${f.id}, 'first')">
                <div class="label">First</div>
                <div class="price">$${f.base_price_first}</div>
              </div>
            </div>

            <button class="btn-primary" style="width: 100%; margin-top: 0.5rem;" onclick="app.chooseFlight(${f.id})">
              Select Flight →
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  selectClassAndFlight: function(flightId, cabinClass) {
    this.state.selectedCabinClass = cabinClass;
    document.getElementById('cabin-class-select').value = cabinClass;
    this.chooseFlight(flightId);
  },

  chooseFlight: async function(flightId) {
    const flight = this.state.flights.find(f => f.id === flightId);
    if (!flight) return;
    this.state.selectedFlight = flight;
    this.state.selectedSeats = []; // Reset selected seats

    // Update Mini summaries
    this.updateFlightMiniCard('selected-flight-mini-card');
    this.updateFlightMiniCard('review-flight-mini-card');

    await this.loadSeatMap(flightId);
    this.goToStep(2);
  },

  updateFlightMiniCard: function(elementId) {
    const f = this.state.selectedFlight;
    if (!f) return;
    const el = document.getElementById(elementId);
    el.innerHTML = `
      <div style="font-weight: 700; color: #38bdf8; font-size: 1.05rem; margin-bottom: 0.35rem;">
        ${f.airline} (${f.flight_number})
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 0.9rem; margin-bottom: 0.25rem;">
        <span><strong>${f.origin_code}</strong> (${f.origin_city})</span>
        <span>✈</span>
        <span><strong>${f.destination_code}</strong> (${f.destination_city})</span>
      </div>
      <div style="font-size: 0.8rem; color: var(--text-muted);">
        ${f.departure_time} • ${f.duration}
      </div>
      <div style="font-size: 0.8rem; color: #10b981; margin-top: 0.25rem;">
        Class: ${this.state.selectedCabinClass.toUpperCase()}
      </div>
    `;
  },

  loadSeatMap: async function(flightId) {
    const container = document.getElementById('fuselage-seats-container');
    container.innerHTML = '<div style="color: #94a3b8; padding: 2rem;">Loading aircraft cabin configuration...</div>';

    try {
      const res = await fetch(`/api/flights/${flightId}/seats`);
      const data = await res.json();
      this.renderSeatMap(data.seats || []);
    } catch (err) {
      container.innerHTML = `<div style="color: #ef4444;">Error loading seat map: ${err.message}</div>`;
    }
  },

  renderSeatMap: function(seats) {
    const container = document.getElementById('fuselage-seats-container');
    container.innerHTML = '';

    // Group seats by Cabin Class then Row
    const sections = ['First', 'Business', 'Economy'];
    sections.forEach(cabin => {
      const cabinSeats = seats.filter(s => s.cabin_class === cabin);
      if (cabinSeats.length === 0) return;

      const cabinDiv = document.createElement('div');
      cabinDiv.className = 'cabin-section';

      const title = document.createElement('div');
      title.className = 'cabin-title';
      title.textContent = `${cabin} Class Cabin`;
      cabinDiv.appendChild(title);

      // Group by row_num
      const rows = {};
      cabinSeats.forEach(s => {
        if (!rows[s.row_num]) rows[s.row_num] = [];
        rows[s.row_num].push(s);
      });

      Object.keys(rows).sort((a,b) => parseInt(a)-parseInt(b)).forEach(rowNum => {
        const rowSeats = rows[rowNum].sort((a,b) => a.column_letter.localeCompare(b.column_letter));
        const rowDiv = document.createElement('div');
        rowDiv.className = 'seat-row';

        const rowNumSpan = document.createElement('span');
        rowNumSpan.className = 'row-number';
        rowNumSpan.textContent = rowNum;
        rowDiv.appendChild(rowNumSpan);

        // Group into left and right groups with aisle in center
        const half = Math.ceil(rowSeats.length / 2);
        const leftGroup = rowSeats.slice(0, half);
        const rightGroup = rowSeats.slice(half);

        const leftDiv = document.createElement('div');
        leftDiv.className = 'seat-grid-group';
        leftGroup.forEach(s => leftDiv.appendChild(this.createSeatElement(s)));
        rowDiv.appendChild(leftDiv);

        const aisle = document.createElement('div');
        aisle.className = 'aisle-gap';
        rowDiv.appendChild(aisle);

        const rightDiv = document.createElement('div');
        rightDiv.className = 'seat-grid-group';
        rightGroup.forEach(s => rightDiv.appendChild(this.createSeatElement(s)));
        rowDiv.appendChild(rightDiv);

        cabinDiv.appendChild(rowDiv);
      });

      container.appendChild(cabinDiv);
    });

    this.updateSeatSelectionPrompt();
    this.updatePriceCalculations();
  },

  createSeatElement: function(seat) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `seat ${seat.cabin_class.toLowerCase()}`;
    btn.dataset.seatNumber = seat.seat_number;
    btn.textContent = seat.seat_number;

    if (seat.is_emergency_exit) btn.classList.add('emergency-row');
    if (seat.is_occupied) {
      btn.classList.add('occupied');
      btn.title = `Seat ${seat.seat_number} (Occupied)`;
      btn.disabled = true;
    } else {
      const extra = seat.price_modifier > 0 ? ` (+$${seat.price_modifier})` : '';
      btn.title = `${seat.cabin_class} Class Seat ${seat.seat_number}${extra}`;
      btn.onclick = () => this.toggleSeat(seat, btn);
    }
    return btn;
  },

  toggleSeat: function(seat, element) {
    const existingIndex = this.state.selectedSeats.findIndex(s => s.seat_number === seat.seat_number);

    if (existingIndex > -1) {
      // Deselect
      this.state.selectedSeats.splice(existingIndex, 1);
      element.classList.remove('selected');
    } else {
      // Check passenger capacity
      if (this.state.selectedSeats.length >= this.state.passengerCount) {
        // Remove first selected seat
        const removed = this.state.selectedSeats.shift();
        const prevEl = document.querySelector(`[data-seat-number="${removed.seat_number}"]`);
        if (prevEl) prevEl.classList.remove('selected');
      }
      this.state.selectedSeats.push(seat);
      element.classList.add('selected');
    }

    this.updateSeatSelectionPrompt();
    this.updatePriceCalculations();
  },

  updateSeatSelectionPrompt: function() {
    const count = this.state.passengerCount;
    const selected = this.state.selectedSeats.length;
    const prompt = document.getElementById('seat-passenger-prompt');
    const needed = count - selected;

    if (needed > 0) {
      prompt.innerHTML = `Please select <strong>${needed} more seat${needed > 1 ? 's' : ''}</strong> (${selected} of ${count} selected)`;
      document.getElementById('confirm-seats-btn').disabled = true;
      document.getElementById('confirm-seats-btn').style.opacity = '0.5';
    } else {
      prompt.innerHTML = `<span style="color: #10b981;">✓ All ${count} passenger seats selected! Seats: ${this.state.selectedSeats.map(s => s.seat_number).join(', ')}</span>`;
      document.getElementById('confirm-seats-btn').disabled = false;
      document.getElementById('confirm-seats-btn').style.opacity = '1';
    }
  },

  updatePriceCalculations: function() {
    const f = this.state.selectedFlight;
    if (!f) return;

    let baseRate = f.base_price_economy;
    if (this.state.selectedCabinClass === 'business') baseRate = f.base_price_business;
    if (this.state.selectedCabinClass === 'first') baseRate = f.base_price_first;

    const baseTotal = baseRate * this.state.passengerCount;
    const seatFees = this.state.selectedSeats.reduce((acc, s) => acc + (s.price_modifier || 0), 0);
    const taxes = 45.00;
    const discount = this.state.discountAmount || 0.0;
    const grandTotal = Math.max(0, baseTotal + seatFees + taxes - discount);

    // Update Seat Map Sidebar
    document.getElementById('fare-label-summary').textContent = `Base Fare (${this.state.passengerCount} Pax)`;
    document.getElementById('base-fare-price').textContent = `$${baseTotal.toFixed(2)}`;
    document.getElementById('seat-fee-price').textContent = `$${seatFees.toFixed(2)}`;
    document.getElementById('total-price-summary').textContent = `$${grandTotal.toFixed(2)}`;

    // Update Passenger Step Review
    document.getElementById('review-base-fare').textContent = `$${baseTotal.toFixed(2)}`;
    document.getElementById('review-seat-fee').textContent = `$${seatFees.toFixed(2)}`;
    document.getElementById('review-grand-total').textContent = `$${grandTotal.toFixed(2)}`;

    // Update Payment Step
    document.getElementById('payment-display-total').textContent = `$${grandTotal.toFixed(2)}`;

    this.state.calculatedTotal = grandTotal;
    this.state.baseTotal = baseTotal;
    this.state.seatFees = seatFees;
  },

  proceedToPassengerInfo: function() {
    if (this.state.selectedSeats.length < this.state.passengerCount) {
      alert(`Please select ${this.state.passengerCount - this.state.selectedSeats.length} more seat(s) before continuing.`);
      return;
    }

    const container = document.getElementById('passenger-cards-container');
    container.innerHTML = '';

    for (let i = 0; i < this.state.passengerCount; i++) {
      const assignedSeat = this.state.selectedSeats[i];
      const card = document.createElement('div');
      card.className = 'passenger-card';
      card.innerHTML = `
        <div class="passenger-card-header">
          <h4>Passenger ${i + 1}</h4>
          <span style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; padding: 0.25rem 0.65rem; border-radius: 6px; font-weight: 600; font-size: 0.85rem;">
            Seat ${assignedSeat ? assignedSeat.seat_number : 'TBD'} • ${assignedSeat ? assignedSeat.cabin_class : ''} Class
          </span>
        </div>
        <div class="search-grid" style="grid-template-columns: 1fr 1fr; margin-bottom: 1rem;">
          <div class="form-group">
            <label>First Name</label>
            <input type="text" class="form-input pax-firstname" placeholder="Given name" required>
          </div>
          <div class="form-group">
            <label>Last Name</label>
            <input type="text" class="form-input pax-lastname" placeholder="Family name" required>
          </div>
          <div class="form-group">
            <label>Passport / National ID</label>
            <input type="text" class="form-input pax-passport" placeholder="e.g. A93817293" required>
          </div>
          <div class="form-group">
            <label>Meal Preference</label>
            <select class="form-select pax-meal">
              <option value="Regular">Regular Meal</option>
              <option value="Vegetarian">Asian Vegetarian</option>
              <option value="Halal">Halal Meal</option>
              <option value="Kosher">Kosher Meal</option>
              <option value="Gluten-Free">Gluten-Free</option>
            </select>
          </div>
        </div>
      `;
      container.appendChild(card);
    }

    this.goToStep(3);
  },

  handlePassengerSubmit: function(e) {
    e.preventDefault();
    const firstNames = document.querySelectorAll('.pax-firstname');
    const lastNames = document.querySelectorAll('.pax-lastname');
    const passports = document.querySelectorAll('.pax-passport');
    const meals = document.querySelectorAll('.pax-meal');

    this.state.passengerDetails = [];
    for (let i = 0; i < this.state.passengerCount; i++) {
      const seat = this.state.selectedSeats[i];
      this.state.passengerDetails.push({
        first_name: firstNames[i].value.trim(),
        last_name: lastNames[i].value.trim(),
        passport_number: passports[i].value.trim(),
        passenger_type: 'adult',
        seat_number: seat ? seat.seat_number : '12A',
        cabin_class: seat ? seat.cabin_class : this.state.selectedCabinClass,
        meal_preference: meals[i].value,
        extra_baggage: 0
      });
    }

    this.state.contactInfo = {
      name: document.getElementById('contact-name').value.trim(),
      email: document.getElementById('contact-email').value.trim(),
      phone: document.getElementById('contact-phone').value.trim()
    };

    // Auto-fill cardholder name on payment form
    document.getElementById('card-name').value = this.state.contactInfo.name;

    this.goToStep(4);
  },

  autoFillDemoCard: function() {
    document.getElementById('card-name').value = this.state.contactInfo.name || "Alex Mercer";
    document.getElementById('card-number').value = "4532 8920 1823 8892";
    document.getElementById('card-exp').value = "09/29";
    document.getElementById('card-cvv').value = "772";
  },

  selectPaymentMethod: function(method) {
    this.state.paymentMethod = method === 'card' ? 'Credit / Debit Card' : (method === 'upi' ? 'UPI / QR Code' : 'PayPal / Digital Wallet');
    
    document.getElementById('tab-pay-card').classList.toggle('active', method === 'card');
    document.getElementById('tab-pay-upi').classList.toggle('active', method === 'upi');
    document.getElementById('tab-pay-wallet').classList.toggle('active', method === 'wallet');

    document.getElementById('pay-panel-card').classList.toggle('hidden', method !== 'card');
    document.getElementById('pay-panel-upi').classList.toggle('hidden', method !== 'upi');
    document.getElementById('pay-panel-wallet').classList.toggle('hidden', method !== 'wallet');
  },

  applyPromoCode: function() {
    const input = document.getElementById('promo-code-input').value.trim().toUpperCase();
    if (!input) return;

    if (input === 'FLY20') {
      const discount = (this.state.baseTotal || 100) * 0.20;
      this.state.discountAmount = discount;
      this.state.promoCode = 'FLY20';
      document.getElementById('discount-applied-tag').classList.remove('hidden');
      document.getElementById('discount-amount-display').textContent = `$${discount.toFixed(2)} (20% OFF)`;
      this.updatePriceCalculations();
      alert('🎉 Promo code FLY20 applied! 20% discount granted on flight fare.');
    } else if (input === 'AERO50') {
      const discount = 50.00;
      this.state.discountAmount = discount;
      this.state.promoCode = 'AERO50';
      document.getElementById('discount-applied-tag').classList.remove('hidden');
      document.getElementById('discount-amount-display').textContent = `$50.00 FLAT OFF`;
      this.updatePriceCalculations();
      alert('🎉 Promo code AERO50 applied! $50 flat discount granted.');
    } else {
      alert('Invalid promo code. Please try FLY20 or AERO50.');
    }
  },

  trigger3DSecure: function(e) {
    if (e) e.preventDefault();
    this.state.generatedTxnId = `TXN-${Math.floor(10000000 + Math.random() * 90000000)}`;
    document.getElementById('otp-modal').classList.remove('hidden');
    document.getElementById('bank-otp-code').value = '';
    document.getElementById('bank-otp-code').focus();
  },

  autoFillOTP: function() {
    document.getElementById('bank-otp-code').value = '849201';
  },

  closeOTPModal: function() {
    document.getElementById('otp-modal').classList.add('hidden');
  },

  submitOTP: function() {
    const otp = document.getElementById('bank-otp-code').value.trim();
    if (otp.length < 4) {
      alert('Please enter the verification code or click Auto-fill Demo Code.');
      return;
    }

    const btn = document.getElementById('confirm-otp-btn');
    btn.disabled = true;
    btn.textContent = 'Verifying with Bank...';

    setTimeout(() => {
      this.closeOTPModal();
      btn.disabled = false;
      btn.textContent = 'Authorize & Complete Payment';
      this.executeBookingPayment();
    }, 800);
  },

  executeBookingPayment: async function() {
    const payBtn = document.getElementById('pay-submit-btn');
    if (payBtn) {
      payBtn.disabled = true;
      payBtn.textContent = "Issuing Tickets & Reserving Seats...";
    }

    const payload = {
      flight_id: this.state.selectedFlight.id,
      trip_type: this.state.tripType,
      contact_name: this.state.contactInfo.name,
      contact_email: this.state.contactInfo.email,
      contact_phone: this.state.contactInfo.phone,
      total_amount: this.state.calculatedTotal,
      payment_method: this.state.paymentMethod,
      discount_code: this.state.promoCode,
      discount_amount: this.state.discountAmount,
      transaction_id: this.state.generatedTxnId,
      passengers: this.state.passengerDetails
    };

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        // Fetch full booking with boarding pass details
        await this.loadBookingConfirmation(data.pnr);
        this.goToStep(5);
      } else {
        alert(`Booking error: ${data.error || 'Payment failed'}`);
      }
    } catch (err) {
      alert(`Network error: ${err.message}`);
    } finally {
      if (payBtn) {
        payBtn.disabled = false;
        payBtn.textContent = "Proceed to 3D Secure Authorization →";
      }
    }
  },

  openInvoiceModal: function() {
    const b = this.state.confirmedBooking;
    if (!b) return;

    document.getElementById('invoice-txn-id').textContent = `Transaction: ${b.transaction_id || this.state.generatedTxnId || 'TXN-92817492'}`;
    document.getElementById('invoice-client-name').textContent = b.contact_name;
    document.getElementById('invoice-client-email').textContent = `${b.contact_email} • ${b.contact_phone}`;
    document.getElementById('invoice-pnr-display').textContent = b.pnr;
    document.getElementById('invoice-date').textContent = `Date: ${b.created_at || new Date().toLocaleString()}`;

    const itemsBody = document.getElementById('invoice-items-body');
    itemsBody.innerHTML = '';

    // Flight item
    const baseRow = document.createElement('tr');
    baseRow.innerHTML = `
      <td><strong>Flight Fare (${b.flight_number}: ${b.origin_code} → ${b.destination_code})</strong><br><span style="font-size: 0.8rem; color: #64748b;">${b.airline} • ${b.trip_type.toUpperCase()}</span></td>
      <td>${b.passengers.length}</td>
      <td>$${(this.state.baseTotal / b.passengers.length).toFixed(2)}</td>
      <td style="text-align: right;">$${(this.state.baseTotal || b.total_amount - 45).toFixed(2)}</td>
    `;
    itemsBody.appendChild(baseRow);

    // Seat reservation items
    if (this.state.seatFees > 0) {
      const seatRow = document.createElement('tr');
      seatRow.innerHTML = `
        <td><strong>Seat Selection Surcharges</strong><br><span style="font-size: 0.8rem; color: #64748b;">Seats: ${b.passengers.map(p => p.seat_number).join(', ')}</span></td>
        <td>${b.passengers.length}</td>
        <td>-</td>
        <td style="text-align: right;">$${this.state.seatFees.toFixed(2)}</td>
      `;
      itemsBody.appendChild(seatRow);
    }

    const subtotal = (this.state.baseTotal || b.total_amount - 45) + (this.state.seatFees || 0);
    document.getElementById('invoice-subtotal').textContent = `$${subtotal.toFixed(2)}`;

    if (b.discount_amount > 0 || this.state.discountAmount > 0) {
      const disc = b.discount_amount || this.state.discountAmount;
      document.getElementById('invoice-discount-row').classList.remove('hidden');
      document.getElementById('invoice-discount').textContent = `-$${disc.toFixed(2)}`;
    } else {
      document.getElementById('invoice-discount-row').classList.add('hidden');
    }

    document.getElementById('invoice-grand-total').textContent = `$${b.total_amount.toFixed(2)} (${b.payment_method || 'Paid'})`;

    document.getElementById('invoice-modal').classList.remove('hidden');
  },

  closeInvoiceModal: function() {
    document.getElementById('invoice-modal').classList.add('hidden');
  },

  processPayment: async function(e) {
    this.trigger3DSecure(e);
  },

  loadBookingConfirmation: async function(pnr) {
    try {
      const res = await fetch(`/api/bookings/${pnr}`);
      const data = await res.json();
      if (data.booking) {
        this.state.confirmedBooking = data.booking;
        this.renderBoardingPasses(data.booking);
        document.getElementById('confirmed-pnr-display').textContent = pnr;
      }
    } catch (err) {
      console.error("Error loading booking details", err);
    }
  },

  renderBoardingPasses: function(booking) {
    const container = document.getElementById('boarding-passes-container');
    container.innerHTML = '';

    const depDate = new Date(booking.departure_time);
    const dateFormatted = depDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const timeFormatted = depDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Calculate boarding time (45 mins prior to departure)
    const boardingDate = new Date(depDate.getTime() - 45 * 60000);
    const boardingTime = boardingDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    booking.passengers.forEach(pax => {
      const passDiv = document.createElement('div');
      passDiv.className = 'boarding-pass';
      passDiv.innerHTML = `
        <div class="pass-main">
          <div class="pass-header">
            <div class="airline-name">✈ ${booking.airline}</div>
            <div class="pnr-badge">PNR: ${booking.pnr}</div>
          </div>

          <div class="route-display">
            <div class="route-city">
              <h2>${booking.origin_code}</h2>
              <span>${booking.origin_city}</span>
            </div>
            <div style="text-align: center; color: #0284c7; font-weight: 700; font-size: 1.25rem;">
              ✈ ${booking.flight_number}
              <div style="font-size: 0.75rem; color: #64748b; font-weight: 400;">${booking.duration} (Non-Stop)</div>
            </div>
            <div class="route-city" style="text-align: right;">
              <h2>${booking.destination_code}</h2>
              <span>${booking.destination_city}</span>
            </div>
          </div>

          <div class="flight-data-grid">
            <div class="data-item">
              <label>Passenger Name</label>
              <value>${pax.first_name} ${pax.last_name}</value>
            </div>
            <div class="data-item">
              <label>Seat Number</label>
              <value style="color: #0284c7; font-size: 1.3rem;">${pax.seat_number}</value>
            </div>
            <div class="data-item">
              <label>Cabin Class</label>
              <value>${pax.cabin_class}</value>
            </div>
            <div class="data-item">
              <label>Boarding Time</label>
              <value style="color: #ef4444;">${boardingTime}</value>
            </div>
            <div class="data-item">
              <label>Departure Date</label>
              <value>${dateFormatted}</value>
            </div>
            <div class="data-item">
              <label>Gate</label>
              <value>${booking.gate}</value>
            </div>
            <div class="data-item">
              <label>Terminal</label>
              <value>${booking.terminal}</value>
            </div>
            <div class="data-item">
              <label>Meal Selected</label>
              <value>${pax.meal_preference || 'Standard'}</value>
            </div>
          </div>

          <div class="barcode"></div>
        </div>

        <div class="pass-stub">
          <div>
            <div style="font-weight: 800; color: #0284c7; font-size: 1.1rem; margin-bottom: 0.5rem;">BOARDING PASS</div>
            <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 0.5rem;">${booking.origin_code} → ${booking.destination_code}</div>
            <div style="font-size: 0.85rem; font-weight: 700;">${pax.first_name} ${pax.last_name}</div>
            <div style="font-size: 0.75rem; color: #64748b;">${booking.flight_number} • ${dateFormatted}</div>
          </div>

          <div style="background: #e2e8f0; padding: 0.75rem; border-radius: 8px; width: 100%;">
            <div style="font-size: 0.7rem; color: #475569; text-transform: uppercase;">Seat</div>
            <div style="font-size: 1.4rem; font-weight: 900; color: #0f172a;">${pax.seat_number}</div>
            <div style="font-size: 0.7rem; color: #64748b;">Gate ${booking.gate}</div>
          </div>

          <div style="font-size: 0.75rem; color: #94a3b8; font-weight: 600;">
            PNR: ${booking.pnr}
          </div>
        </div>
      `;
      container.appendChild(passDiv);
    });
  },

  goToStep: function(stepNumber) {
    this.state.currentStep = stepNumber;

    // Toggle step sections
    for (let i = 1; i <= 5; i++) {
      const section = document.getElementById(`step-1`.replace('1', i));
      if (section) section.classList.toggle('hidden', i !== stepNumber);
    }

    // Update stepper header
    const stepItems = document.querySelectorAll('.step-item');
    stepItems.forEach(item => {
      const s = parseInt(item.dataset.step, 10);
      item.classList.toggle('active', s === stepNumber);
      item.classList.toggle('completed', s < stepNumber);
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  resetFlow: function() {
    this.state.selectedFlight = null;
    this.state.selectedSeats = [];
    this.state.passengerDetails = [];
    this.goToStep(1);
    this.searchFlights();
  },

  openLookupModal: function() {
    document.getElementById('lookup-modal').classList.remove('hidden');
    document.getElementById('lookup-pnr-input').focus();
  },

  closeLookupModal: function() {
    document.getElementById('lookup-modal').classList.add('hidden');
  },

  handleLookupSubmit: async function(e) {
    e.preventDefault();
    const pnr = document.getElementById('lookup-pnr-input').value.trim().toUpperCase();
    if (!pnr) return;

    try {
      const res = await fetch(`/api/bookings/${pnr}`);
      const data = await res.json();
      if (res.ok && data.booking) {
        this.closeLookupModal();
        this.state.confirmedBooking = data.booking;
        this.renderBoardingPasses(data.booking);
        document.getElementById('confirmed-pnr-display').textContent = pnr;
        this.goToStep(5);
      } else {
        alert(data.error || "No booking found with this PNR.");
      }
    } catch (err) {
      alert(`Search failed: ${err.message}`);
    }
  }
};

// Auto-format card input with spaces
document.addEventListener('DOMContentLoaded', () => {
  app.init();

  const cardInput = document.getElementById('card-number');
  if (cardInput) {
    cardInput.addEventListener('input', (e) => {
      let val = e.target.value.replace(/\D/g, '').substring(0, 16);
      val = val.match(/.{1,4}/g)?.join(' ') || val;
      e.target.value = val;
    });
  }

  const expInput = document.getElementById('card-exp');
  if (expInput) {
    expInput.addEventListener('input', (e) => {
      let val = e.target.value.replace(/\D/g, '').substring(0, 4);
      if (val.length >= 2) val = val.substring(0, 2) + '/' + val.substring(2);
      e.target.value = val;
    });
  }
});
