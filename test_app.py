import unittest
import json
import io
from app import AirlineRequestHandler, generate_pnr
from database import init_db, seed_data_if_needed, get_db

class MockWFile(io.BytesIO):
    def flush(self):
        pass

class MockRFile(io.BytesIO):
    pass

class AirlineLogicTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        seed_data_if_needed()

    def test_01_pnr_generation(self):
        pnr = generate_pnr()
        self.assertEqual(len(pnr), 6)
        self.assertTrue(pnr[:3].isalpha() and pnr[:3].isupper())
        self.assertTrue(pnr[3:].isdigit())

    def test_02_database_airports_and_flights(self):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM airports")
        self.assertGreaterEqual(cursor.fetchone()[0], 10)

        cursor.execute("SELECT COUNT(*) FROM flights")
        self.assertGreaterEqual(cursor.fetchone()[0], 20)

        cursor.execute("SELECT COUNT(*) FROM seats")
        self.assertGreaterEqual(cursor.fetchone()[0], 500)
        conn.close()

    def test_03_create_booking_and_seat_lock(self):
        conn = get_db()
        cursor = conn.cursor()

        # Find available seat for flight 1
        cursor.execute("SELECT seat_number FROM seats WHERE flight_id = 1 AND is_occupied = 0 LIMIT 1")
        row = cursor.fetchone()
        self.assertIsNotNone(row)
        test_seat = row["seat_number"]

        # Simulate booking insertion directly
        pnr = generate_pnr()
        cursor.execute("""
        INSERT INTO bookings (pnr, flight_id, trip_type, contact_name, contact_email, contact_phone, total_amount, payment_status, created_at)
        VALUES (?, 1, 'oneway', 'Alice Smith', 'alice@test.com', '1234567890', 499.00, 'PAID', '2026-11-05 12:00:00')
        """, (pnr,))
        booking_id = cursor.lastrowid

        cursor.execute("""
        INSERT INTO passengers (booking_id, first_name, last_name, passport_number, passenger_type, seat_number, cabin_class, meal_preference)
        VALUES (?, 'Alice', 'Smith', 'P98765432', 'adult', ?, 'Economy', 'Halal')
        """, (booking_id, test_seat))

        cursor.execute("UPDATE seats SET is_occupied = 1 WHERE flight_id = 1 AND seat_number = ?", (test_seat,))
        conn.commit()

        # Verify seat occupied
        cursor.execute("SELECT is_occupied FROM seats WHERE flight_id = 1 AND seat_number = ?", (test_seat,))
        self.assertEqual(cursor.fetchone()["is_occupied"], 1)

        # Verify booking lookup
        cursor.execute("SELECT * FROM bookings WHERE pnr = ?", (pnr,))
        booking = cursor.fetchone()
        self.assertIsNotNone(booking)
        self.assertEqual(booking["contact_name"], "Alice Smith")

        conn.close()

if __name__ == "__main__":
    unittest.main()
