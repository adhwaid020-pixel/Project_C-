import http.server
import socketserver
import urllib.parse
import json
import os
import mimetypes
import string
import random
from datetime import datetime
from database import get_db, init_db, seed_data_if_needed

PORT = 8080
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

def generate_pnr():
    letters = ''.join(random.choices(string.ascii_uppercase, k=3))
    digits = ''.join(random.choices(string.digits, k=3))
    return f"{letters}{digits}"

class AirlineRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Enable CORS and disable caching during dev
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # Route API requests
        if path.startswith("/api/"):
            self.handle_api_get(path, query)
            return

        # Serve static assets
        if path == "/" or path == "":
            self.serve_file(os.path.join(STATIC_DIR, "index.html"), "text/html")
            return

        # Sanitize path to prevent directory traversal
        rel_path = path.lstrip("/")
        if rel_path.startswith("static/"):
            rel_path = rel_path[len("static/"):]
        target_path = os.path.join(STATIC_DIR, rel_path)

        if os.path.exists(target_path) and os.path.isfile(target_path):
            content_type, _ = mimetypes.guess_type(target_path)
            self.serve_file(target_path, content_type or "application/octet-stream")
        else:
            # Fallback to SPA index.html
            self.serve_file(os.path.join(STATIC_DIR, "index.html"), "text/html")

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/api/bookings":
            self.handle_create_booking()
            return

        self.send_json({"error": "Endpoint not found"}, status=404)

    def serve_file(self, filepath, content_type):
        try:
            with open(filepath, "rb") as f:
                data = f.read()
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            self.send_json({"error": f"Failed reading file: {str(e)}"}, status=500)

    def send_json(self, data, status=200):
        body = json.dumps(data, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def handle_api_get(self, path, query):
        conn = get_db()
        cursor = conn.cursor()

        try:
            if path == "/api/airports":
                cursor.execute("SELECT code, name, city, country FROM airports ORDER BY city ASC")
                airports = [dict(row) for row in cursor.fetchall()]
                self.send_json({"airports": airports})

            elif path == "/api/flights":
                origin = query.get("origin", [None])[0]
                destination = query.get("destination", [None])[0]
                date = query.get("date", [None])[0]
                cabin_class = query.get("class", ["economy"])[0].lower()

                sql = """
                SELECT f.*,
                       orig.city as origin_city, orig.name as origin_name, orig.country as origin_country,
                       dest.city as destination_city, dest.name as destination_name, dest.country as destination_country
                FROM flights f
                JOIN airports orig ON f.origin_code = orig.code
                JOIN airports dest ON f.destination_code = dest.code
                WHERE 1=1
                """
                params = []
                if origin and origin != "ALL":
                    sql += " AND f.origin_code = ?"
                    params.append(origin.upper())
                if destination and destination != "ALL":
                    sql += " AND f.destination_code = ?"
                    params.append(destination.upper())
                if date:
                    sql += " AND date(f.departure_time) = date(?)"
                    params.append(date)

                sql += " ORDER BY f.departure_time ASC LIMIT 50"
                cursor.execute(sql, params)
                flights = [dict(row) for row in cursor.fetchall()]

                # If no direct match with date filter, fallback to upcoming flights on that route
                if not flights and (origin or destination):
                    fallback_sql = """
                    SELECT f.*,
                           orig.city as origin_city, orig.name as origin_name, orig.country as origin_country,
                           dest.city as destination_city, dest.name as destination_name, dest.country as destination_country
                    FROM flights f
                    JOIN airports orig ON f.origin_code = orig.code
                    JOIN airports dest ON f.destination_code = dest.code
                    WHERE (f.origin_code = ? OR ? IS NULL) AND (f.destination_code = ? OR ? IS NULL)
                    ORDER BY f.departure_time ASC LIMIT 20
                    """
                    cursor.execute(fallback_sql, (origin, origin, destination, destination))
                    flights = [dict(row) for row in cursor.fetchall()]

                self.send_json({"flights": flights, "count": len(flights)})

            elif path.startswith("/api/flights/") and path.endswith("/seats"):
                flight_id_str = path.split("/")[3]
                try:
                    flight_id = int(flight_id_str)
                except ValueError:
                    self.send_json({"error": "Invalid flight ID"}, status=400)
                    return

                cursor.execute("""
                SELECT id, seat_number, cabin_class, row_num, column_letter, price_modifier, is_occupied, is_emergency_exit
                FROM seats
                WHERE flight_id = ?
                ORDER BY row_num ASC, column_letter ASC
                """, (flight_id,))
                seats = [dict(row) for row in cursor.fetchall()]

                # Calculate seat summary
                total = len(seats)
                occupied = sum(1 for s in seats if s["is_occupied"] == 1)
                available = total - occupied

                self.send_json({
                    "flight_id": flight_id,
                    "seats": seats,
                    "summary": {
                        "total": total,
                        "available": available,
                        "occupied": occupied
                    }
                })

            elif path.startswith("/api/flights/"):
                flight_id_str = path.split("/")[3]
                try:
                    flight_id = int(flight_id_str)
                except ValueError:
                    self.send_json({"error": "Invalid flight ID"}, status=400)
                    return

                cursor.execute("""
                SELECT f.*,
                       orig.city as origin_city, orig.name as origin_name,
                       dest.city as destination_city, dest.name as destination_name
                FROM flights f
                JOIN airports orig ON f.origin_code = orig.code
                JOIN airports dest ON f.destination_code = dest.code
                WHERE f.id = ?
                """, (flight_id,))
                row = cursor.fetchone()
                if row:
                    self.send_json({"flight": dict(row)})
                else:
                    self.send_json({"error": "Flight not found"}, status=404)

            elif path.startswith("/api/bookings/"):
                pnr = path.split("/")[3].strip().upper()
                cursor.execute("""
                SELECT b.*,
                       f.flight_number, f.airline, f.airline_code, f.departure_time, f.arrival_time,
                       f.duration, f.aircraft, f.terminal, f.gate, f.status as flight_status,
                       orig.code as origin_code, orig.city as origin_city, orig.name as origin_name,
                       dest.code as destination_code, dest.city as destination_city, dest.name as destination_name
                FROM bookings b
                JOIN flights f ON b.flight_id = f.id
                JOIN airports orig ON f.origin_code = orig.code
                JOIN airports dest ON f.destination_code = dest.code
                WHERE b.pnr = ?
                """, (pnr,))
                booking_row = cursor.fetchone()
                if not booking_row:
                    self.send_json({"error": "Booking reference (PNR) not found"}, status=404)
                    return

                booking = dict(booking_row)
                cursor.execute("""
                SELECT id, first_name, last_name, passport_number, passenger_type,
                       seat_number, cabin_class, meal_preference, extra_baggage
                FROM passengers
                WHERE booking_id = ?
                """, (booking["id"],))
                passengers = [dict(p) for p in cursor.fetchall()]
                booking["passengers"] = passengers

                self.send_json({"booking": booking})

            elif path == "/api/stats":
                cursor.execute("SELECT COUNT(*) FROM flights")
                total_flights = cursor.fetchone()[0]
                cursor.execute("SELECT COUNT(*) FROM airports")
                total_airports = cursor.fetchone()[0]
                cursor.execute("SELECT COUNT(*) FROM bookings")
                total_bookings = cursor.fetchone()[0]
                self.send_json({
                    "total_flights": total_flights,
                    "total_airports": total_airports,
                    "total_bookings": total_bookings
                })
            else:
                self.send_json({"error": "Not Found"}, status=404)

        finally:
            conn.close()

    def handle_create_booking(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            body = json.loads(post_data.decode("utf-8"))

            flight_id = body.get("flight_id")
            contact_name = body.get("contact_name", "").strip()
            contact_email = body.get("contact_email", "").strip()
            contact_phone = body.get("contact_phone", "").strip()
            passengers = body.get("passengers", [])
            total_amount = float(body.get("total_amount", 0.0))
            trip_type = body.get("trip_type", "oneway")
            payment_method = body.get("payment_method", "Credit Card")
            discount_code = body.get("discount_code", "")
            discount_amount = float(body.get("discount_amount", 0.0))
            transaction_id = body.get("transaction_id", f"TXN-{random.randint(10000000, 99999999)}")

            if not flight_id or not passengers or not contact_name or not contact_email:
                self.send_json({"error": "Missing required booking fields"}, status=400)
                return

            conn = get_db()
            cursor = conn.cursor()

            # Verify seat availability
            seat_numbers = [p.get("seat_number") for p in passengers if p.get("seat_number")]
            if seat_numbers:
                placeholders = ','.join(['?'] * len(seat_numbers))
                cursor.execute(f"""
                SELECT seat_number, is_occupied FROM seats
                WHERE flight_id = ? AND seat_number IN ({placeholders})
                """, [flight_id] + seat_numbers)
                found_seats = cursor.fetchall()
                for s in found_seats:
                    if s["is_occupied"] == 1:
                        conn.close()
                        self.send_json({"error": f"Seat {s['seat_number']} is already booked. Please choose another seat."}, status=409)
                        return

            # Generate unique PNR
            pnr = generate_pnr()
            now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            cursor.execute("""
            INSERT INTO bookings (pnr, flight_id, trip_type, contact_name, contact_email, contact_phone, total_amount, payment_status, payment_method, discount_code, discount_amount, transaction_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'PAID', ?, ?, ?, ?, ?)
            """, (pnr, flight_id, trip_type, contact_name, contact_email, contact_phone, total_amount, payment_method, discount_code, discount_amount, transaction_id, now_str))
            booking_id = cursor.lastrowid

            # Insert passengers and mark seats occupied
            for p in passengers:
                seat_num = p.get("seat_number", "")
                cursor.execute("""
                INSERT INTO passengers (
                    booking_id, first_name, last_name, passport_number,
                    passenger_type, seat_number, cabin_class, meal_preference, extra_baggage
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    booking_id, p.get("first_name"), p.get("last_name"),
                    p.get("passport_number", "N/A"), p.get("passenger_type", "adult"),
                    seat_num, p.get("cabin_class", "Economy"),
                    p.get("meal_preference", "Regular"), int(p.get("extra_baggage", 0))
                ))

                if seat_num:
                    cursor.execute("""
                    UPDATE seats SET is_occupied = 1
                    WHERE flight_id = ? AND seat_number = ?
                    """, (flight_id, seat_num))

            conn.commit()
            conn.close()

            self.send_json({
                "success": True,
                "message": "Booking confirmed successfully!",
                "pnr": pnr,
                "booking_id": booking_id
            }, status=201)

        except Exception as e:
            self.send_json({"error": f"Server error: {str(e)}"}, status=500)

def run_server():
    init_db()
    seed_data_if_needed()
    handler = AirlineRequestHandler
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), handler) as httpd:
        print(f"🚀 Airline Reservation System running at http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")

if __name__ == "__main__":
    run_server()
