#include <iostream>
#include <vector>
#include <string>
#include <map>
#include <iomanip>
#include <memory>
#include <random>
#include <algorithm>
#include <sstream>
#include <ctime>

// ==========================================
// 1. DATA ENUMS & UTILITY FUNCTIONS
// ==========================================
enum class CabinClass { FIRST, BUSINESS, ECONOMY };

std::string cabinClassToString(CabinClass c) {
    switch (c) {
        case CabinClass::FIRST: return "First";
        case CabinClass::BUSINESS: return "Business";
        case CabinClass::ECONOMY: return "Economy";
    }
    return "Economy";
}

std::string getCurrentDateTime() {
    std::time_t t = std::time(nullptr);
    char buf[64];
    std::strftime(buf, sizeof(buf), "%Y-%m-%d %H:%M", std::localtime(&t));
    return std::string(buf);
}

std::string generatePNR() {
    static const char letters[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    static const char digits[] = "0123456789";
    static std::mt19937 rng(std::random_device{}());
    std::uniform_int_distribution<int> distL(0, 25);
    std::uniform_int_distribution<int> distD(0, 9);

    std::string pnr = "";
    for (int i = 0; i < 3; ++i) pnr += letters[distL(rng)];
    for (int i = 0; i < 3; ++i) pnr += digits[distD(rng)];
    return pnr;
}

std::string generateTxnID() {
    static std::mt19937 rng(std::random_device{}());
    std::uniform_int_distribution<int> dist(10000000, 99999999);
    return "TXN-" + std::to_string(dist(rng));
}

// ==========================================
// 2. AIRPORT & SEAT MODEL
// ==========================================
struct Airport {
    std::string code;
    std::string city;
    std::string country;
};

class Seat {
public:
    std::string seatNumber;
    CabinClass cabinClass;
    int row;
    char col;
    double priceModifier;
    bool isOccupied;
    bool isEmergencyExit;

    Seat(std::string num, CabinClass c, int r, char cl, double mod = 0.0, bool occ = false, bool emer = false)
        : seatNumber(num), cabinClass(c), row(r), col(cl), priceModifier(mod), isOccupied(occ), isEmergencyExit(emer) {}
};

// ==========================================
// 3. PASSENGER MODEL
// ==========================================
class Passenger {
public:
    std::string firstName;
    std::string lastName;
    std::string passportNumber;
    std::string seatNumber;
    CabinClass cabinClass;
    std::string mealPreference;
    int extraBaggageKg;

    Passenger(std::string fName, std::string lName, std::string passNum,
              std::string sNum, CabinClass cClass, std::string meal, int baggage = 0)
        : firstName(fName), lastName(lName), passportNumber(passNum),
          seatNumber(sNum), cabinClass(cClass), mealPreference(meal), extraBaggageKg(baggage) {}

    std::string getFullName() const {
        return firstName + " " + lastName;
    }
};

// ==========================================
// 4. FLIGHT MODEL & SEAT MAP
// ==========================================
class Flight {
public:
    int id;
    std::string flightNumber;
    std::string airline;
    std::string originCode;
    std::string originCity;
    std::string destinationCode;
    std::string destinationCity;
    std::string departureTime;
    std::string arrivalTime;
    std::string duration;
    std::string aircraft;
    std::string gate;
    std::string terminal;
    double basePriceEconomy;
    double basePriceBusiness;
    double basePriceFirst;
    std::vector<Seat> seats;

    Flight(int id, std::string fNum, std::string air, std::string oCode, std::string oCity,
           std::string dCode, std::string dCity, std::string dep, std::string arr,
           std::string dur, std::string ac, std::string g, std::string t,
           double pEcon, double pBiz, double pFirst)
        : id(id), flightNumber(fNum), airline(air), originCode(oCode), originCity(oCity),
          destinationCode(dCode), destinationCity(dCity), departureTime(dep), arrivalTime(arr),
          duration(dur), aircraft(ac), gate(g), terminal(t),
          basePriceEconomy(pEcon), basePriceBusiness(pBiz), basePriceFirst(pFirst) {
        initSeatMap();
    }

    void initSeatMap() {
        seats.clear();
        // First Class: Rows 1-2 (1-2-1 layout: A, C, D, F)
        for (int r = 1; r <= 2; ++r) {
            for (char c : {'A', 'C', 'D', 'F'}) {
                seats.emplace_back(std::to_string(r) + c, CabinClass::FIRST, r, c, 50.0);
            }
        }
        // Business Class: Rows 3-6 (2-2-2 layout: A, B, C, D, E, F)
        for (int r = 3; r <= 6; ++r) {
            for (char c : {'A', 'B', 'C', 'D', 'E', 'F'}) {
                double mod = (c == 'A' || c == 'F') ? 25.0 : 0.0;
                seats.emplace_back(std::to_string(r) + c, CabinClass::BUSINESS, r, c, mod);
            }
        }
        // Economy Class: Rows 7-18 (3-3 layout: A, B, C, D, E, F)
        for (int r = 7; r <= 18; ++r) {
            bool emer = (r == 12);
            for (char c : {'A', 'B', 'C', 'D', 'E', 'F'}) {
                double mod = emer ? 35.0 : ((c == 'A' || c == 'F') ? 15.0 : 0.0);
                seats.emplace_back(std::to_string(r) + c, CabinClass::ECONOMY, r, c, mod, false, emer);
            }
        }
    }

    void displaySeatMap() const {
        std::cout << "\n======================================================\n";
        std::cout << "          AIRCRAFT SEAT MAP: " << aircraft << "\n";
        std::cout << "        [X] = Occupied   [ ] = Available\n";
        std::cout << "======================================================\n";

        std::cout << "\n--- FIRST CLASS (Rows 1-2) ---\n";
        std::cout << " Row |  A       C   [AISLE]   D       F\n";
        std::cout << "-----+--------------------------------\n";
        for (int r = 1; r <= 2; ++r) {
            std::cout << "  " << std::setw(2) << r << " | ";
            for (char c : {'A', 'C'}) {
                std::string sNum = std::to_string(r) + c;
                bool occ = getSeat(sNum)->isOccupied;
                std::cout << "[" << (occ ? "X" : sNum) << "]  ";
            }
            std::cout << "  ||   ";
            for (char c : {'D', 'F'}) {
                std::string sNum = std::to_string(r) + c;
                bool occ = getSeat(sNum)->isOccupied;
                std::cout << "[" << (occ ? "X" : sNum) << "]  ";
            }
            std::cout << "\n";
        }

        std::cout << "\n--- BUSINESS CLASS (Rows 3-6) ---\n";
        std::cout << " Row |  A    B    C   [AISLE]   D    E    F\n";
        std::cout << "-----+-----------------------------------\n";
        for (int r = 3; r <= 6; ++r) {
            std::cout << "  " << std::setw(2) << r << " | ";
            for (char c : {'A', 'B', 'C'}) {
                std::string sNum = std::to_string(r) + c;
                bool occ = getSeat(sNum)->isOccupied;
                std::cout << "[" << (occ ? "X" : (r < 10 ? " " + sNum : sNum)) << "] ";
            }
            std::cout << " ||  ";
            for (char c : {'D', 'E', 'F'}) {
                std::string sNum = std::to_string(r) + c;
                bool occ = getSeat(sNum)->isOccupied;
                std::cout << "[" << (occ ? "X" : (r < 10 ? " " + sNum : sNum)) << "] ";
            }
            std::cout << "\n";
        }

        std::cout << "\n--- ECONOMY CLASS (Rows 7-18) ---\n";
        std::cout << " Row |  A    B    C   [AISLE]   D    E    F   Notes\n";
        std::cout << "-----+-----------------------------------------\n";
        for (int r = 7; r <= 18; ++r) {
            std::cout << "  " << std::setw(2) << r << " | ";
            for (char c : {'A', 'B', 'C'}) {
                std::string sNum = std::to_string(r) + c;
                bool occ = getSeat(sNum)->isOccupied;
                std::cout << "[" << (occ ? "X" : (r < 10 ? " " + sNum : sNum)) << "] ";
            }
            std::cout << " ||  ";
            for (char c : {'D', 'E', 'F'}) {
                std::string sNum = std::to_string(r) + c;
                bool occ = getSeat(sNum)->isOccupied;
                std::cout << "[" << (occ ? "X" : (r < 10 ? " " + sNum : sNum)) << "] ";
            }
            if (r == 12) std::cout << " *Exit Row (Extra Space)";
            std::cout << "\n";
        }
        std::cout << "======================================================\n\n";
    }

    const Seat* getSeat(const std::string& num) const {
        for (const auto& s : seats) {
            if (s.seatNumber == num) return &s;
        }
        return nullptr;
    }

    Seat* getSeat(const std::string& num) {
        for (auto& s : seats) {
            if (s.seatNumber == num) return &s;
        }
        return nullptr;
    }

    bool reserveSeat(const std::string& num) {
        Seat* s = getSeat(num);
        if (s && !s->isOccupied) {
            s->isOccupied = true;
            return true;
        }
        return false;
    }
};

// ==========================================
// 5. BOOKING MODEL & BOARDING PASS
// ==========================================
class Booking {
public:
    std::string pnr;
    Flight flight;
    std::vector<Passenger> passengers;
    std::string contactName;
    std::string contactEmail;
    std::string contactPhone;
    std::string paymentMethod;
    std::string promoCode;
    double discountAmount;
    double subtotal;
    double taxes;
    double grandTotal;
    std::string transactionId;
    std::string bookingDate;

    Booking(std::string pnrCode, const Flight& fl, const std::vector<Passenger>& paxList,
            std::string cName, std::string cEmail, std::string cPhone,
            std::string payMethod, std::string promo, double discount,
            double sub, double tax, double total, std::string txnId)
        : pnr(pnrCode), flight(fl), passengers(paxList),
          contactName(cName), contactEmail(cEmail), contactPhone(cPhone),
          paymentMethod(payMethod), promoCode(promo), discountAmount(discount),
          subtotal(sub), taxes(tax), grandTotal(total),
          transactionId(txnId), bookingDate(getCurrentDateTime()) {}

    void printBoardingPasses() const {
        for (size_t i = 0; i < passengers.size(); ++i) {
            const auto& pax = passengers[i];
            std::cout << "\n+-----------------------------------------------------------------------------------------+\n";
            std::cout << "|  AEROVA AIRWAYS                    BOARDING PASS                                        |\n";
            std::cout << "+----------------------------------------------------+------------------------------------+\n";
            std::cout << "| PASSENGER NAME: " << std::left << std::setw(34) << pax.getFullName()
                      << " | PNR REF: " << std::setw(26) << pnr << "|\n";
            std::cout << "| FLIGHT: " << std::setw(12) << flight.flightNumber
                      << "  CLASS: " << std::setw(23) << cabinClassToString(pax.cabinClass)
                      << " | SEAT: " << std::setw(29) << pax.seatNumber << "|\n";
            std::cout << "| ROUTE: " << flight.originCode << " (" << flight.originCity << ") -> "
                      << flight.destinationCode << " (" << flight.destinationCity << ")"
                      << std::string(std::max(0, 16 - (int)flight.destinationCity.length()), ' ')
                      << " | GATE: " << std::setw(8) << flight.gate << " TERMINAL: " << std::setw(10) << flight.terminal << "|\n";
            std::cout << "| DEPARTURE: " << std::setw(38) << flight.departureTime
                      << " | BOARDING: 45m Prior to Departure |\n";
            std::cout << "| MEAL SELECTION: " << std::setw(33) << pax.mealPreference
                      << " | ELECTRONIC TICKET STATUS: CONFIRMED|\n";
            std::cout << "+----------------------------------------------------+------------------------------------+\n";
            std::cout << "| |||||||||| |||||||| |||||| |||||||||||| ||||||||   | [BARCODE] " << pnr << "-" << pax.seatNumber << "          |\n";
            std::cout << "+-----------------------------------------------------------------------------------------+\n";
        }
    }

    void printTaxInvoice() const {
        std::cout << "\n=========================================================================\n";
        std::cout << "                       OFFICIAL TAX INVOICE & RECEIPT                    \n";
        std::cout << "                          AEROVA INTERNATIONAL AIR                       \n";
        std::cout << "=========================================================================\n";
        std::cout << " Transaction ID: " << transactionId << "          Date: " << bookingDate << "\n";
        std::cout << " Booking Ref (PNR): " << pnr << "                 Status: PAID IN FULL\n";
        std::cout << " Payment Method: " << paymentMethod << "\n";
        std::cout << " Billed To: " << contactName << " (" << contactEmail << " | " << contactPhone << ")\n";
        std::cout << "-------------------------------------------------------------------------\n";
        std::cout << " Flight Details: " << flight.airline << " [" << flight.flightNumber << "]\n";
        std::cout << " Route: " << flight.originCode << " (" << flight.originCity << ") -> "
                  << flight.destinationCode << " (" << flight.destinationCity << ")\n";
        std::cout << " Departure: " << flight.departureTime << " | Gate: " << flight.gate << "\n";
        std::cout << "-------------------------------------------------------------------------\n";
        std::cout << std::left << std::setw(35) << "ITEM DESCRIPTION"
                  << std::setw(8) << "QTY"
                  << std::setw(14) << "RATE"
                  << "AMOUNT\n";
        std::cout << "-------------------------------------------------------------------------\n";

        for (const auto& p : passengers) {
            double rate = (p.cabinClass == CabinClass::FIRST) ? flight.basePriceFirst :
                          (p.cabinClass == CabinClass::BUSINESS ? flight.basePriceBusiness : flight.basePriceEconomy);
            std::cout << std::left << std::setw(35) << ("Flight Fare (" + p.getFullName() + ")")
                      << std::setw(8) << "1"
                      << "$" << std::setw(13) << std::fixed << std::setprecision(2) << rate
                      << "$" << rate << "\n";

            const Seat* st = flight.getSeat(p.seatNumber);
            if (st && st->priceModifier > 0) {
                std::cout << std::left << std::setw(35) << ("Seat Surcharge (Seat " + p.seatNumber + ")")
                          << std::setw(8) << "1"
                          << "$" << std::setw(13) << st->priceModifier
                          << "$" << st->priceModifier << "\n";
            }
        }

        std::cout << "-------------------------------------------------------------------------\n";
        std::cout << std::right << std::setw(57) << "Subtotal: " << "$" << subtotal << "\n";
        if (discountAmount > 0) {
            std::cout << std::right << std::setw(57) << ("Promo Discount (" + promoCode + "): ") << "-$" << discountAmount << "\n";
        }
        std::cout << std::right << std::setw(57) << "Airport Taxes & Security: " << "$" << taxes << "\n";
        std::cout << "-------------------------------------------------------------------------\n";
        std::cout << std::right << std::setw(57) << "TOTAL PAID: " << "$" << grandTotal << "\n";
        std::cout << "=========================================================================\n\n";
    }
};

// ==========================================
// 6. AIRLINE RESERVATION SYSTEM (MAIN CONTROLLER)
// ==========================================
class AirlineSystem {
private:
    std::vector<Airport> airports;
    std::vector<Flight> flights;
    std::map<std::string, Booking> bookings;

    void seedData() {
        airports = {
            {"JFK", "New York", "USA"},
            {"LHR", "London", "UK"},
            {"DXB", "Dubai", "UAE"},
            {"HND", "Tokyo", "Japan"},
            {"SIN", "Singapore", "Singapore"},
            {"CDG", "Paris", "France"},
            {"BOM", "Mumbai", "India"},
            {"SFO", "San Francisco", "USA"}
        };

        flights.emplace_back(1, "AG-204", "AeroGlobal", "JFK", "New York", "LHR", "London", "2026-11-10 08:30", "2026-11-10 20:45", "7h 15m", "Boeing 787-9 Dreamliner", "A4", "T4", 480.0, 1344.0, 2496.0);
        flights.emplace_back(2, "SW-319", "SkyWings Express", "LHR", "London", "DXB", "Dubai", "2026-11-10 10:15", "2026-11-10 21:00", "7h 45m", "Airbus A350-1000", "B12", "T2", 520.0, 1456.0, 2704.0);
        flights.emplace_back(3, "PH-102", "Pacific Horizon", "SIN", "Singapore", "HND", "Tokyo", "2026-11-10 14:00", "2026-11-10 21:45", "6h 45m", "Boeing 777-300ER", "C3", "T3", 420.0, 1176.0, 2184.0);
        flights.emplace_back(4, "EA-580", "Empyrean Airways", "DXB", "Dubai", "BOM", "Mumbai", "2026-11-10 16:30", "2026-11-10 21:15", "3h 15m", "Boeing 787-9 Dreamliner", "D5", "T1", 220.0, 616.0, 1144.0);
        flights.emplace_back(5, "AG-741", "AeroGlobal", "SFO", "San Francisco", "HND", "Tokyo", "2026-11-10 11:20", "2026-11-11 15:30", "10h 10m", "Airbus A350-1000", "A1", "T4", 680.0, 1904.0, 3536.0);
    }

public:
    AirlineSystem() {
        seedData();
    }

    void showAllFlights() const {
        std::cout << "\n========================================================================================================\n";
        std::cout << "                                AVAILABLE SCHEDULED FLIGHTS                             \n";
        std::cout << "========================================================================================================\n";
        std::cout << std::left << std::setw(4) << "ID"
                  << std::setw(10) << "FLIGHT"
                  << std::setw(18) << "AIRLINE"
                  << std::setw(22) << "ROUTE"
                  << std::setw(18) << "DEPARTURE"
                  << std::setw(10) << "DURATION"
                  << "ECONOMY / BIZ / FIRST\n";
        std::cout << "--------------------------------------------------------------------------------------------------------\n";
        for (const auto& f : flights) {
            std::cout << std::left << std::setw(4) << f.id
                      << std::setw(10) << f.flightNumber
                      << std::setw(18) << f.airline
                      << std::setw(22) << (f.originCode + " -> " + f.destinationCode)
                      << std::setw(18) << f.departureTime
                      << std::setw(10) << f.duration
                      << "$" << (int)f.basePriceEconomy << " / $" << (int)f.basePriceBusiness << " / $" << (int)f.basePriceFirst << "\n";
        }
        std::cout << "========================================================================================================\n\n";
    }

    void bookFlightInteractive() {
        showAllFlights();

        int flightId;
        std::cout << "Enter Flight ID to book (or 0 to cancel): ";
        if (!(std::cin >> flightId) || flightId <= 0 || flightId > (int)flights.size()) {
            std::cin.clear();
            std::cin.ignore(10000, '\n');
            std::cout << "Cancelled or invalid Flight ID.\n";
            return;
        }

        Flight& flight = flights[flightId - 1];

        int numPax;
        std::cout << "Enter number of passengers (1-4): ";
        std::cin >> numPax;
        numPax = std::clamp(numPax, 1, 4);

        int cabinChoice;
        std::cout << "\nSelect Travel Cabin Class:\n";
        std::cout << "1. Economy Class ($" << flight.basePriceEconomy << ")\n";
        std::cout << "2. Business Class ($" << flight.basePriceBusiness << ")\n";
        std::cout << "3. First Class ($" << flight.basePriceFirst << ")\n";
        std::cout << "Choice (1-3): ";
        std::cin >> cabinChoice;

        CabinClass selectedClass = CabinClass::ECONOMY;
        double baseRate = flight.basePriceEconomy;
        if (cabinChoice == 2) { selectedClass = CabinClass::BUSINESS; baseRate = flight.basePriceBusiness; }
        else if (cabinChoice == 3) { selectedClass = CabinClass::FIRST; baseRate = flight.basePriceFirst; }

        // Display Seat Map
        flight.displaySeatMap();

        std::vector<Passenger> passengers;
        double totalSeatFees = 0.0;

        for (int i = 0; i < numPax; ++i) {
            std::cout << "\n--- Passenger " << (i + 1) << " Details ---\n";
            std::string fName, lName, passNum, seatNum, meal;
            std::cout << "First Name: "; std::cin >> fName;
            std::cout << "Last Name: "; std::cin >> lName;
            std::cout << "Passport / ID: "; std::cin >> passNum;

            while (true) {
                std::cout << "Choose Seat (e.g., 2A, 5C, 12D): ";
                std::cin >> seatNum;
                // Capitalize
                std::transform(seatNum.begin(), seatNum.end(), seatNum.begin(), ::toupper);

                Seat* s = flight.getSeat(seatNum);
                if (!s) {
                    std::cout << "❌ Invalid seat number. Please refer to seat map.\n";
                } else if (s->isOccupied) {
                    std::cout << "❌ Seat " << seatNum << " is already occupied. Choose another.\n";
                } else {
                    flight.reserveSeat(seatNum);
                    totalSeatFees += s->priceModifier;
                    break;
                }
            }

            std::cout << "Meal Preference (1. Regular, 2. Vegetarian, 3. Halal, 4. Kosher): ";
            int mChoice; std::cin >> mChoice;
            meal = (mChoice == 2 ? "Asian Vegetarian" : (mChoice == 3 ? "Halal" : (mChoice == 4 ? "Kosher" : "Regular")));

            passengers.emplace_back(fName, lName, passNum, seatNum, selectedClass, meal);
        }

        // Contact Information
        std::string cName, cEmail, cPhone;
        std::cout << "\n--- Contact Information ---\n";
        std::cout << "Full Contact Name: ";
        std::cin.ignore();
        std::getline(std::cin, cName);
        std::cout << "Email Address: "; std::cin >> cEmail;
        std::cout << "Phone Number: "; std::cin >> cPhone;

        // Pricing calculations
        double subtotal = (baseRate * numPax) + totalSeatFees;
        double taxes = 45.00;
        double discount = 0.0;
        std::string promoCode = "";

        // Promo Code
        char hasPromo;
        std::cout << "\nDo you have a Promo Code? (y/n): ";
        std::cin >> hasPromo;
        if (hasPromo == 'y' || hasPromo == 'Y') {
            std::cout << "Enter Promo Code (Try FLY20 for 20% off or AERO50 for $50 off): ";
            std::cin >> promoCode;
            std::transform(promoCode.begin(), promoCode.end(), promoCode.begin(), ::toupper);

            if (promoCode == "FLY20") {
                discount = (baseRate * numPax) * 0.20;
                std::cout << "🎉 Promo code FLY20 applied! 20% discount: -$" << discount << "\n";
            } else if (promoCode == "AERO50") {
                discount = 50.0;
                std::cout << "🎉 Promo code AERO50 applied! Flat $50 discount: -$" << discount << "\n";
            } else {
                std::cout << "Invalid code. Proceeding without discount.\n";
                promoCode = "";
            }
        }

        double grandTotal = std::max(0.0, subtotal + taxes - discount);

        std::cout << "\n--- Payment Summary ---\n";
        std::cout << "Base Fare (" << numPax << " Pax): $" << (baseRate * numPax) << "\n";
        std::cout << "Seat Surcharges: $" << totalSeatFees << "\n";
        if (discount > 0) std::cout << "Discount (" << promoCode << "): -$" << discount << "\n";
        std::cout << "Airport Taxes & Fees: $" << taxes << "\n";
        std::cout << "TOTAL PAYABLE: $" << grandTotal << "\n";

        // Payment Method
        std::cout << "\nChoose Payment Method:\n";
        std::cout << "1. Credit / Debit Card (Instant Test Card)\n";
        std::cout << "2. UPI / Instant QR Code\n";
        std::cout << "3. Digital Wallet (PayPal / Apple Pay)\n";
        std::cout << "Choice (1-3): ";
        int payChoice; std::cin >> payChoice;

        std::string payMethodStr = (payChoice == 2 ? "UPI / Instant QR" : (payChoice == 3 ? "Digital Wallet" : "Credit / Debit Card"));

        // 3D Secure / OTP Simulation
        std::cout << "\n[3D-SECURE VERIFICATION] An authorization OTP has been generated: 849201\n";
        std::cout << "Enter OTP to confirm authorization (or press enter for demo auto-verify): ";
        std::string otp;
        std::cin >> otp;

        std::cout << "\nProcessing payment with banking network...";
        std::cout << " Approved!\n";

        // Generate PNR and complete booking
        std::string pnr = generatePNR();
        std::string txnId = generateTxnID();

        Booking newBooking(pnr, flight, passengers, cName, cEmail, cPhone, payMethodStr, promoCode, discount, subtotal, taxes, grandTotal, txnId);
        bookings.emplace(pnr, newBooking);

        std::cout << "\n🎉 SUCCESS! Your flight is booked. PNR: " << pnr << "\n";
        newBooking.printBoardingPasses();
        newBooking.printTaxInvoice();
    }

    void lookupBooking() const {
        std::string pnr;
        std::cout << "\nEnter 6-character Booking Reference (PNR): ";
        std::cin >> pnr;
        std::transform(pnr.begin(), pnr.end(), pnr.begin(), ::toupper);

        auto it = bookings.find(pnr);
        if (it != bookings.end()) {
            std::cout << "\nBooking Found for PNR: " << pnr << "\n";
            it->second.printBoardingPasses();
            it->second.printTaxInvoice();
        } else {
            std::cout << "❌ No booking found with PNR: " << pnr << "\n";
        }
    }
};

// ==========================================
// 7. MAIN INTERFACE
// ==========================================
int main() {
    AirlineSystem system;

    std::cout << "=======================================================\n";
    std::cout << "       ✈️  AEROVA AIRWAYS RESERVATION SYSTEM (C++)    \n";
    std::cout << "=======================================================\n";

    while (true) {
        std::cout << "\nMain Menu:\n";
        std::cout << "1. View All Scheduled Flights\n";
        std::cout << "2. Book a Flight & Pick Seats\n";
        std::cout << "3. Manage Booking (PNR Lookup & Boarding Pass)\n";
        std::cout << "4. Exit\n";
        std::cout << "Please select an option (1-4): ";

        int choice;
        if (!(std::cin >> choice)) {
            std::cin.clear();
            std::cin.ignore(10000, '\n');
            continue;
        }

        switch (choice) {
            case 1:
                system.showAllFlights();
                break;
            case 2:
                system.bookFlightInteractive();
                break;
            case 3:
                system.lookupBooking();
                break;
            case 4:
                std::cout << "\nThank you for flying with AEROVA AIRWAYS. Safe travels!\n";
                return 0;
            default:
                std::cout << "Invalid choice. Please select 1, 2, 3, or 4.\n";
        }
    }

    return 0;
}
