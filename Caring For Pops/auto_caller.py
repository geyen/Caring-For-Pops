import os
import json
import time
from datetime import datetime
from twilio.rest import Client
from twilio.twiml.voice_response import VoiceResponse, Gather

# Initialize Twilio client
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN')
TWILIO_PHONE_NUMBER = os.environ.get('TWILIO_PHONE_NUMBER')

class AutoCaller:
    def __init__(self):
        self.agencies_file = "cold_calling/agencies.json"
        self.results_file = "cold_calling/call_results.json"
        
        # Ensure cold_calling directory exists
        os.makedirs("cold_calling", exist_ok=True)
        
        # Initialize agencies file if it doesn't exist
        if not os.path.exists(self.agencies_file):
            with open(self.agencies_file, "w") as f:
                json.dump({"agencies": []}, f)
        
        # Initialize results file if it doesn't exist
        if not os.path.exists(self.results_file):
            with open(self.results_file, "w") as f:
                json.dump({"calls": []}, f)
        
        # Load data
        self.agencies = self.load_agencies()
        self.results = self.load_results()
        
        # Check if Twilio credentials are configured
        if not all([TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER]):
            print("Warning: Twilio credentials not fully configured")
            self.twilio_configured = False
        else:
            self.twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
            self.twilio_configured = True
    
    def load_agencies(self):
        """Load the list of agencies to call"""
        try:
            with open(self.agencies_file, "r") as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            # If file doesn't exist or is invalid, create a new empty list
            return {"agencies": []}
    
    def save_agencies(self):
        """Save the current agency list to file"""
        with open(self.agencies_file, "w") as f:
            json.dump(self.agencies, f, indent=2)
    
    def load_results(self):
        """Load call results"""
        try:
            with open(self.results_file, "r") as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            # If file doesn't exist or is invalid, create a new empty list
            return {"calls": []}
    
    def save_results(self):
        """Save call results to file"""
        with open(self.results_file, "w") as f:
            json.dump(self.results, f, indent=2)
    
    def add_call_result(self, agency_name, phone, status, response=None):
        """Record the result of a call"""
        call_result = {
            "agency": agency_name,
            "phone": phone,
            "timestamp": datetime.now().isoformat(),
            "status": status,
        }
        
        if response:
            call_result["response"] = response
        
        self.results["calls"].append(call_result)
        self.save_results()
    
    def make_call(self, agency):
        """Make an automated call to an agency"""
        if not self.twilio_configured:
            print(f"Error: Cannot make call to {agency['name']} - Twilio not configured")
            return False
        
        try:
            # Get the base URL for webhooks
            base_url = "https://caringforpops.com"  # Replace with your actual domain
            
            # Make the call using Twilio
            call = self.twilio_client.calls.create(
                to=agency['phone'],
                from_=TWILIO_PHONE_NUMBER,
                url=f"{base_url}/twilio-webhooks/voice",
                method="GET",
                status_callback=f"{base_url}/twilio-webhooks/status",
                status_callback_method="POST",
                status_callback_event=["initiated", "answered", "completed"]
            )
            
            # Mark the agency as called
            for a in self.agencies["agencies"]:
                if a["name"] == agency["name"] and a["phone"] == agency["phone"]:
                    a["called"] = True
                    break
            
            self.save_agencies()
            
            # Record the call attempt
            self.add_call_result(agency["name"], agency["phone"], "initiated")
            
            return True
        except Exception as e:
            print(f"Error making call to {agency['name']}: {str(e)}")
            self.add_call_result(agency["name"], agency["phone"], "error", str(e))
            return False
    
    def call_uncalled_agencies(self, limit=5):
        """Call agencies that haven't been called yet, up to the limit"""
        if not self.twilio_configured:
            return 0
        
        # Find uncalled agencies
        uncalled = [a for a in self.agencies["agencies"] if not a.get("called", False)]
        
        # Limit the number of calls
        to_call = uncalled[:min(limit, len(uncalled))]
        
        # Make calls
        call_count = 0
        for agency in to_call:
            success = self.make_call(agency)
            if success:
                call_count += 1
            
            # Add a small delay between calls to avoid rate limiting
            if call_count < len(to_call):
                time.sleep(2)
        
        return call_count
    
    def reset_called_status(self):
        """Reset the called status of all agencies"""
        for agency in self.agencies["agencies"]:
            agency["called"] = False
        
        self.save_agencies()
    
    def add_agency(self, name, phone):
        """Add a new agency to the list"""
        # Check if agency already exists
        for agency in self.agencies["agencies"]:
            if agency["name"] == name and agency["phone"] == phone:
                return False  # Agency already exists
        
        # Add the new agency
        self.agencies["agencies"].append({
            "name": name,
            "phone": phone,
            "called": False
        })
        
        self.save_agencies()
        return True
    
    def generate_twiml_response(self, action=None):
        """Generate TwiML for voice response"""
        response = VoiceResponse()
        
        # Add a pause
        response.pause(length=1)
        
        if action == "interested":
            response.say("Thank you! We'll send your free exclusive lead shortly. Have a great day!", voice='alice')
            response.pause(length=1)
        elif action == "do_not_call":
            response.say("We've removed your number from our call list. We apologize for the inconvenience.", voice='alice')
        else:
            # Default gather response with the improved script
            gather = Gather(num_digits=1, action="/twilio-webhooks/gather", method="POST", timeout=5)
            gather.say("Hello! This is Lyndsay from Caring for Pops. Right now, you're paying sixty dollars or more per lead — and sharing them with your competitors. I have a better option for you. Our leads are exclusive — meaning you're the only agency that gets each lead. No competition. No bidding wars. Just high-quality clients needing home health care. When you grab a lead, it's yours — no sharing. We offer three great plans: ten leads per month for three hundred dollars, twenty for four eighty, or thirty for five forty. Press 1 now to claim your first free lead. We only have limited slots per area, so don't miss out!", voice='alice', language='en-US')
            response.append(gather)
            
            # If no input, redirect to repeat
            response.redirect("/twilio-webhooks/voice")
        
        return str(response)
    
    def handle_key_press(self, digits, from_number):
        """Handle key press responses"""
        # Find the agency by phone number
        agency = None
        for a in self.agencies["agencies"]:
            if a["phone"] == from_number:
                agency = a
                break
        
        response = VoiceResponse()
        
        if not agency:
            # Unknown agency - still process the response
            if digits == "1":
                response.say("Thank you! We'll send your free exclusive lead shortly. Have a great day!", voice='alice')
                # Add the agency to our database
                self.add_agency("Unknown Agency", from_number)
                self.add_call_result("Unknown Agency", from_number, "interested", "Pressed 1 - Interested for free lead")
            else:
                response.say("Sorry, I didn't get that. Goodbye!", voice='alice')
            return str(response)
        
        if digits == "1":
            # Interested in free lead
            agency["interested"] = True
            self.save_agencies()
            self.add_call_result(agency["name"], agency["phone"], "interested", "Pressed 1 - Interested for free lead")
            
            response.say("Thank you! We'll send your free exclusive lead shortly. Have a great day!", voice='alice')
        else:
            # Any other input
            response.say("Sorry, I didn't get that. Goodbye!", voice='alice')
        
        return str(response)

if __name__ == "__main__":
    # For testing
    caller = AutoCaller()
    print("AutoCaller initialized")