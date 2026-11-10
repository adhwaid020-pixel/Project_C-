import sqlite3
import random
import os
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "airline.db")

AIRPORTS_DATA = [
    ("JFK", "John F. Kennedy International", "New York", "United States"),
    ("LHR", "Heathrow Airport", "London", "United Kingdom"),
    ("DXB", "Dubai International Airport", "Dubai", "United Arab Emirates"),
    ("HND", "Haneda Airport", "Tokyo", "Japan"),
    ("SIN", "Singapore Changi Airport", "Singapore", "Singapore"),
    ("CDG", "Charles de Gaulle Airport", "Paris", "France"),
    ("SYD", "Sydney Kingsford Smith", "Sydney", "Australia"),
    ("FRA", "Frankfurt Airport", "Frankfurt", "Germany"),
    ("LAX", "Los Angeles International", "Los Angeles", "United States"),
    ("BOM", "Chhatrapati Shivaji Maharaj", "Mumbai", "India"),
    ("SFO", "San Francisco International", "San Francisco", "United States"),
    ("DOH", "Hamad International Airport", "Doha", "Qatar")
]

AIRLINES = [
    {"name": "AeroGlobal", "code": "AG"},
    {"name": "SkyWings Express", "code": "SW"},
    {"name": "Pacific Horizon", "code": "PH"},
    {"name": "Empyrean Airways", "code": "EA"}
]

AIRCRAFT_TYPES = [
    {"model": "Boeing 787-9 Dreamliner", "first_rows": 2, "biz_rows": 4, "econ_rows": 18, "cols": ["A", "B", "C", "D", "E", "F"]},
    {"model": "Airbus A350-1000", "first_rows": 2, "biz_rows": 5, "econ_rows": 20, "cols": ["A", "B", "C", "D", "E", "F"]},
    {"model": "Boeing 777-300ER", "first_rows": 2, "biz_rows": 6, "econ_rows": 22, "cols": ["A", "B", "C", "D", "E", "F"]}
]

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.executescript("""
    CREATE TABLE IF NOT EXISTS airports (
        code TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        city TEXT NOT NULL,
        country TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS flights (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        flight_number TEXT NOT NULL,
        airline TEXT NOT NULL,
        airline_code TEXT NOT NULL,
        origin_code TEXT NOT NULL,
        destination_code TEXT NOT NULL,
        departure_time TEXT NOT NULL,
        arrival_time TEXT NOT NULL,
        duration TEXT NOT NULL,
        aircraft TEXT NOT NULL,
        base_price_economy REAL NOT NULL,
        base_price_business REAL NOT NULL,
        base_price_first REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'On Time',
        terminal TEXT NOT NULL,
        gate TEXT NOT NULL,
        FOREIGN KEY (origin_code) REFERENCES airports (code),
        FOREIGN KEY (destination_code) REFERENCES airports (code)
    );

    CREATE TABLE IF NOT EXISTS seats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        flight_id INTEGER NOT NULL,
        seat_number TEXT NOT NULL,
        cabin_class TEXT NOT NULL,
        row_num INTEGER NOT NULL,
        column_letter TEXT NOT NULL,
        price_modifier REAL NOT NULL DEFAULT 0.0,
        is_occupied INTEGER NOT NULL DEFAULT 0,
        is_emergency_exit INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (flight_id) REFERENCES flights (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pnr TEXT UNIQUE NOT NULL,
        flight_id INTEGER NOT NULL,
        trip_type TEXT NOT NULL,
        contact_name TEXT NOT NULL,
        contact_email TEXT NOT NULL,
        contact_phone TEXT NOT NULL,
        total_amount REAL NOT NULL,
        payment_status TEXT NOT NULL DEFAULT 'PAID',
        payment_method TEXT DEFAULT 'Credit Card',
        discount_code TEXT DEFAULT '',
        discount_amount REAL DEFAULT 0.0,
        transaction_id TEXT DEFAULT '',
        created_at TEXT NOT NULL,
        FOREIGN KEY (flight_id) REFERENCES flights (id)
    );

    CREATE TABLE IF NOT EXISTS passengers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_id INTEGER NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        passport_number TEXT NOT NULL,
        passenger_type TEXT NOT NULL DEFAULT 'adult',
        seat_number TEXT NOT NULL,
        cabin_class TEXT NOT NULL,
        meal_preference TEXT DEFAULT 'Regular',
        extra_baggage INTEGER DEFAULT 0,
        FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE
    );
    """)

    conn.commit()
    conn.close()

def seed_data_if_needed():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM airports")
    if cursor.fetchone()[0] == 0:
        print("[DB] Seeding airports...")
        cursor.executemany("INSERT INTO airports (code, name, city, country) VALUES (?, ?, ?, ?)", AIRPORTS_DATA)
        conn.commit()

    cursor.execute("SELECT COUNT(*) FROM flights")
    if cursor.fetchone()[0] == 0:
        print("[DB] Seeding flights and seat layouts...")
        now = datetime.now()
        gates = ["A1", "A4", "B12", "B17", "C3", "C9", "D5", "D11"]
        terminals = ["1", "2", "3", "T4", "T5"]

        popular_routes = [
            ("JFK", "LHR", 7.25, 480),
            ("LHR", "JFK", 8.0, 510),
            ("JFK", "LAX", 5.5, 290),
            ("LAX", "JFK", 5.25, 290),
            ("DXB", "LHR", 7.5, 540),
            ("LHR", "DXB", 7.0, 520),
            ("SIN", "HND", 6.8, 420),
            ("HND", "SIN", 7.1, 430),
            ("CDG", "JFK", 8.2, 530),
            ("JFK", "CDG", 7.5, 520),
            ("SFO", "HND", 10.5, 680),
            ("HND", "SFO", 9.5, 660),
            ("DXB", "BOM", 3.2, 220),
            ("BOM", "DXB", 3.5, 230),
            ("SYD", "SIN", 8.0, 500),
            ("SIN", "SYD", 7.8, 490),
            ("FRA", "JFK", 8.7, 560),
            ("JFK", "SFO", 6.0, 310),
            ("DOH", "LHR", 7.3, 530),
            ("LHR", "SIN", 13.0, 750)
        ]

        flight_id_counter = 1
        # Seed flights for next 14 days
        for day_offset in range(14):
            flight_date = (now + timedelta(days=day_offset)).date()
            for origin, dest, duration_hrs, base_price in popular_routes:
                # Add 1 or 2 flights per day for each route
                num_flights = 2 if (hash(f"{origin}{dest}{day_offset}") % 2 == 0) else 1
                for f_idx in range(num_flights):
                    dep_hour = 6 + (f_idx * 7) + (hash(origin) % 5)
                    dep_minute = (f_idx * 25 + 15) % 60
                    dep_dt = datetime(flight_date.year, flight_date.month, flight_date.day, dep_hour, dep_minute)
                    arr_dt = dep_dt + timedelta(hours=duration_hrs)

                    dur_hours = int(duration_hrs)
                    dur_mins = int((duration_hrs - dur_hours) * 60)
                    duration_str = f"{dur_hours}h {dur_mins}m"

                    airline_obj = random.choice(AIRLINES)
                    aircraft_obj = random.choice(AIRCRAFT_TYPES)
                    flight_num = f"{airline_obj['code']}-{random.randint(100, 999)}"

                    price_econ = base_price + random.randint(-30, 40)
                    price_biz = round(price_econ * 2.8, 2)
                    price_first = round(price_econ * 5.2, 2)

                    cursor.execute("""
                    INSERT INTO flights (
                        flight_number, airline, airline_code, origin_code, destination_code,
                        departure_time, arrival_time, duration, aircraft,
                        base_price_economy, base_price_business, base_price_first,
                        status, terminal, gate
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        flight_num, airline_obj["name"], airline_obj["code"],
                        origin, dest, dep_dt.strftime("%Y-%m-%d %H:%M"),
                        arr_dt.strftime("%Y-%m-%d %H:%M"), duration_str,
                        aircraft_obj["model"], price_econ, price_biz, price_first,
                        "On Time", random.choice(terminals), random.choice(gates)
                    ))
                    current_flight_id = cursor.lastrowid

                    # Seed Seats for this flight
                    seats_batch = []
                    # First Class
                    for r in range(1, aircraft_obj["first_rows"] + 1):
                        for col in ["A", "C", "D", "F"]:
                            is_occ = 1 if random.random() < 0.25 else 0
                            seats_batch.append((current_flight_id, f"{r}{col}", "First", r, col, 50.0, is_occ, 0))
                    
                    # Business Class
                    biz_start = aircraft_obj["first_rows"] + 1
                    biz_end = biz_start + aircraft_obj["biz_rows"]
                    for r in range(biz_start, biz_end):
                        for col in aircraft_obj["cols"]:
                            is_occ = 1 if random.random() < 0.35 else 0
                            mod = 25.0 if col in ["A", "F"] else 0.0 # Window seat premium
                            seats_batch.append((current_flight_id, f"{r}{col}", "Business", r, col, mod, is_occ, 0))

                    # Economy Class
                    econ_start = biz_end
                    econ_end = econ_start + aircraft_obj["econ_rows"]
                    emergency_row = econ_start + 4
                    for r in range(econ_start, econ_end):
                        is_emer = 1 if r == emergency_row else 0
                        for col in aircraft_obj["cols"]:
                            is_occ = 1 if random.random() < 0.45 else 0
                            mod = 35.0 if is_emer else (15.0 if col in ["A", "F"] else 0.0)
                            seats_batch.append((current_flight_id, f"{r}{col}", "Economy", r, col, mod, is_occ, is_emer))

                    cursor.executemany("""
                    INSERT INTO seats (
                        flight_id, seat_number, cabin_class, row_num, column_letter,
                        price_modifier, is_occupied, is_emergency_exit
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """, seats_batch)

        conn.commit()
        print("[DB] Initialized database with flights and seats successfully!")

    conn.close()

if __name__ == "__main__":
    init_db()
    seed_data_if_needed()
