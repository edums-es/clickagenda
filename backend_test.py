import requests
import sys
import json
from datetime import datetime, timedelta
import uuid

class ClickAgendaAPITester:
    def __init__(self, base_url="https://agendamento-pro-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.session_token = None
        self.user_data = None
        self.tests_run = 0
        self.tests_passed = 0
        
        # Test data
        self.test_service_id = None
        self.test_client_id = None
        self.test_appointment_id = None
        
    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.session_token:
            test_headers['Authorization'] = f'Bearer {self.session_token}'
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json() if response.text else {}
                    return success, response_data
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json() if response.text else {}
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Raw response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test API root endpoint"""
        success, response = self.run_test(
            "API Root",
            "GET",
            "",
            200
        )
        if success:
            print(f"   API Message: {response.get('message', 'N/A')}")
        return success

    def test_login(self, email="maria@teste.com", password="123456"):
        """Test login with existing test user"""
        success, response = self.run_test(
            "Login with Test User",
            "POST",
            "auth/login",
            200,
            data={"email": email, "password": password}
        )
        if success and 'session_token' in response:
            self.session_token = response['session_token']
            self.user_data = response.get('user', {})
            print(f"   Logged in as: {self.user_data.get('name', 'Unknown')}")
            print(f"   User slug: {self.user_data.get('slug', 'N/A')}")
            return True
        return False

    def test_get_current_user(self):
        """Test getting current user data"""
        success, response = self.run_test(
            "Get Current User (/auth/me)",
            "GET",
            "auth/me",
            200
        )
        if success:
            print(f"   User ID: {response.get('user_id', 'N/A')}")
            print(f"   Email: {response.get('email', 'N/A')}")
        return success

    def test_services_crud(self):
        """Test Services CRUD operations"""
        print("\n📋 Testing Services CRUD...")
        
        # List existing services
        success, services = self.run_test(
            "List Services",
            "GET",
            "services", 
            200
        )
        if not success:
            return False
            
        print(f"   Found {len(services)} existing services")
        
        # Create new service
        test_service = {
            "name": f"Test Service {datetime.now().strftime('%H%M%S')}",
            "description": "Service created by automated test",
            "duration_minutes": 45,
            "price": 75.0,
            "buffer_minutes": 10,
            "category": "Test",
            "active": True
        }
        
        success, created_service = self.run_test(
            "Create Service",
            "POST",
            "services",
            200,
            data=test_service
        )
        if not success:
            return False
            
        self.test_service_id = created_service.get('service_id')
        print(f"   Created service ID: {self.test_service_id}")
        
        # Update service
        update_data = {
            "name": "Updated Test Service",
            "description": "Updated description",
            "duration_minutes": 60,
            "price": 80.0,
            "buffer_minutes": 15,
            "category": "Updated Test",
            "active": True
        }
        
        success, updated_service = self.run_test(
            "Update Service",
            "PUT",
            f"services/{self.test_service_id}",
            200,
            data=update_data
        )
        if not success:
            return False
            
        # Verify update
        if updated_service.get('name') == update_data['name']:
            print(f"   ✅ Service updated successfully")
        else:
            print(f"   ❌ Service update verification failed")
            
        return True

    def test_clients_crud(self):
        """Test Clients CRUD operations"""
        print("\n👥 Testing Clients CRUD...")
        
        # List existing clients  
        success, clients = self.run_test(
            "List Clients",
            "GET",
            "clients",
            200
        )
        if not success:
            return False
            
        print(f"   Found {len(clients)} existing clients")
        
        # Create new client
        test_client = {
            "name": f"Test Client {datetime.now().strftime('%H%M%S')}",
            "phone": "(11) 98765-4321",
            "email": f"test.client.{datetime.now().strftime('%H%M%S')}@example.com",
            "notes": "Created by automated test",
            "tags": ["test", "automated"]
        }
        
        success, created_client = self.run_test(
            "Create Client",
            "POST", 
            "clients",
            200,
            data=test_client
        )
        if not success:
            return False
            
        self.test_client_id = created_client.get('client_id')
        print(f"   Created client ID: {self.test_client_id}")
        
        # Update client
        update_data = {
            "name": "Updated Test Client",
            "phone": "(11) 87654-3210", 
            "email": f"updated.test.{datetime.now().strftime('%H%M%S')}@example.com",
            "notes": "Updated by automated test",
            "tags": ["updated", "test"]
        }
        
        success, updated_client = self.run_test(
            "Update Client",
            "PUT",
            f"clients/{self.test_client_id}",
            200,
            data=update_data
        )
        if not success:
            return False
            
        return True

    def test_appointments_crud(self):
        """Test Appointments CRUD operations"""
        print("\n📅 Testing Appointments CRUD...")
        
        if not self.test_service_id:
            print("   ❌ No test service available for appointment creation")
            return False
            
        # List existing appointments
        today = datetime.now().strftime("%Y-%m-%d")
        success, appointments = self.run_test(
            "List Appointments (Today)",
            "GET",
            f"appointments?date={today}",
            200
        )
        if not success:
            return False
            
        print(f"   Found {len(appointments)} appointments for today")
        
        # Create new appointment
        appointment_time = (datetime.now() + timedelta(days=1)).replace(hour=14, minute=0)
        test_appointment = {
            "service_id": self.test_service_id,
            "client_name": f"Test Client {datetime.now().strftime('%H%M%S')}",
            "client_phone": "(11) 99888-7766",
            "client_email": f"appointment.test.{datetime.now().strftime('%H%M%S')}@example.com",
            "date": appointment_time.strftime("%Y-%m-%d"),
            "start_time": "14:00",
            "notes": "Created by automated test"
        }
        
        success, created_appointment = self.run_test(
            "Create Appointment",
            "POST",
            "appointments", 
            200,
            data=test_appointment
        )
        if not success:
            return False
            
        self.test_appointment_id = created_appointment.get('appointment_id')
        print(f"   Created appointment ID: {self.test_appointment_id}")
        
        # Update appointment status
        success, updated_appointment = self.run_test(
            "Update Appointment Status",
            "PUT",
            f"appointments/{self.test_appointment_id}/status",
            200,
            data={"status": "confirmed"}
        )
        if not success:
            return False
            
        if updated_appointment.get('status') == 'confirmed':
            print(f"   ✅ Appointment status updated to confirmed")
        else:
            print(f"   ❌ Appointment status update failed")
            
        return True

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        success, stats = self.run_test(
            "Dashboard Stats", 
            "GET",
            "dashboard/stats",
            200
        )
        if success:
            print(f"   Today appointments: {stats.get('total_today', 0)}")
            print(f"   Confirmed: {stats.get('confirmed', 0)}")
            print(f"   Total clients: {stats.get('total_clients', 0)}")
            print(f"   Revenue month: R$ {stats.get('revenue_month', 0)}")
        return success

    def test_availability(self):
        """Test availability management"""
        print("\n🕐 Testing Availability...")
        
        # Get current availability
        success, availability = self.run_test(
            "Get Availability",
            "GET", 
            "availability",
            200
        )
        if not success:
            return False
            
        print(f"   Found {len(availability.get('rules', []))} availability rules")
        print(f"   Found {len(availability.get('breaks', []))} break rules")
        
        return True

    def test_public_endpoints(self):
        """Test public endpoints (no auth required)"""
        print("\n🌐 Testing Public Endpoints...")
        
        if not self.user_data or not self.user_data.get('slug'):
            print("   ❌ No user slug available for public endpoint testing")
            return False
            
        user_slug = self.user_data['slug']
        
        # Test public profile
        success, public_data = self.run_test(
            "Public Profile",
            "GET",
            f"public/{user_slug}",
            200
        )
        if not success:
            return False
            
        professional = public_data.get('professional', {})
        services = public_data.get('services', [])
        print(f"   Professional: {professional.get('name', 'Unknown')}")
        print(f"   Available services: {len(services)}")
        
        # Test slots endpoint (if services exist)
        if services and self.test_service_id:
            tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
            success, slots_data = self.run_test(
                "Public Slots",
                "GET",
                f"public/{user_slug}/slots?date={tomorrow}&service_id={self.test_service_id}",
                200
            )
            if success:
                slots = slots_data.get('slots', [])
                print(f"   Available slots for {tomorrow}: {len(slots)}")
                
        return True

    def test_public_booking_flow(self):
        """Test public booking flow"""
        print("\n📝 Testing Public Booking Flow...")
        
        if not self.user_data or not self.user_data.get('slug') or not self.test_service_id:
            print("   ❌ Missing required data for booking test")
            return False
            
        user_slug = self.user_data['slug']
        
        # Create a public booking
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        booking_data = {
            "service_id": self.test_service_id,
            "client_name": f"Public Test Client {datetime.now().strftime('%H%M%S')}",
            "client_phone": "(11) 95555-4444",
            "client_email": f"public.booking.{datetime.now().strftime('%H%M%S')}@example.com",
            "date": tomorrow,
            "start_time": "15:00",
            "notes": "Public booking test"
        }
        
        success, booking_response = self.run_test(
            "Public Booking",
            "POST",
            f"public/{user_slug}/book",
            200,
            data=booking_data
        )
        if success:
            token = booking_response.get('token')
            appointment_id = booking_response.get('appointment_id')
            print(f"   Created booking: {appointment_id}")
            print(f"   Management token: {token[:10]}...")
            
            # Test appointment management by token
            if token:
                success, appointment_data = self.run_test(
                    "Get Appointment by Token",
                    "GET",
                    f"appointment/manage/{token}",
                    200
                )
                if success:
                    apt = appointment_data.get('appointment', {})
                    print(f"   Token appointment: {apt.get('client_name')} - {apt.get('status')}")
                    
        return success

    def cleanup_test_data(self):
        """Clean up created test data"""
        print("\n🧹 Cleaning up test data...")
        
        # Delete test appointment
        if self.test_appointment_id:
            success, _ = self.run_test(
                "Delete Test Appointment",
                "DELETE",
                f"appointments/{self.test_appointment_id}",
                200
            )
            if success:
                print(f"   ✅ Deleted test appointment")
                
        # Delete test client  
        if self.test_client_id:
            success, _ = self.run_test(
                "Delete Test Client",
                "DELETE", 
                f"clients/{self.test_client_id}",
                200
            )
            if success:
                print(f"   ✅ Deleted test client")
                
        # Delete test service
        if self.test_service_id:
            success, _ = self.run_test(
                "Delete Test Service",
                "DELETE",
                f"services/{self.test_service_id}",
                200
            )
            if success:
                print(f"   ✅ Deleted test service")

def main():
    """Main test execution"""
    print("🚀 Starting Click Agenda Backend API Tests")
    print("=" * 50)
    
    tester = ClickAgendaAPITester()
    
    # Test sequence
    tests_to_run = [
        ("API Root", tester.test_root_endpoint),
        ("Login", lambda: tester.test_login()),
        ("Current User", tester.test_get_current_user),
        ("Services CRUD", tester.test_services_crud),
        ("Clients CRUD", tester.test_clients_crud),
        ("Appointments CRUD", tester.test_appointments_crud),
        ("Dashboard Stats", tester.test_dashboard_stats),
        ("Availability", tester.test_availability),
        ("Public Endpoints", tester.test_public_endpoints),
        ("Public Booking Flow", tester.test_public_booking_flow),
    ]
    
    # Run all tests
    for test_name, test_func in tests_to_run:
        try:
            if not test_func():
                print(f"\n❌ {test_name} tests failed - stopping execution")
                break
        except Exception as e:
            print(f"\n💥 {test_name} tests crashed: {str(e)}")
            break
    
    # Cleanup
    tester.cleanup_test_data()
    
    # Final results
    print("\n" + "=" * 50)
    print(f"📊 Tests completed: {tester.tests_passed}/{tester.tests_run}")
    
    success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
    print(f"🎯 Success rate: {success_rate:.1f}%")
    
    if success_rate >= 80:
        print("✅ Backend API tests PASSED")
        return 0
    else:
        print("❌ Backend API tests FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main())