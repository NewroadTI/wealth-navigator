
import requests
import json
import sys

API_URL = "http://localhost:8000/api/v1"
EMAIL = "adminluis@newroadgi.com"
PASSWORD = "password123"

def test_login():
    print(f"Testing login to {API_URL} with {EMAIL}")
    
    # 1. Try JSON (Correct way according to code)
    print("\n--- ATTEMPT 1: JSON ---")
    try:
        res = requests.post(f"{API_URL}/auth/login", json={
            "username": EMAIL,
            "password": PASSWORD
        })
        print(f"Status: {res.status_code}")
        print(f"Response: {res.text}")
    except Exception as e:
        print(f"Error: {e}")

    # 2. Try Form Data (Old way / OAuth2 standard)
    print("\n--- ATTEMPT 2: Form Data ---")
    try:
        res = requests.post(f"{API_URL}/auth/login", data={
            "username": EMAIL,
            "password": PASSWORD
        })
        print(f"Status: {res.status_code}")
        print(f"Response: {res.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_login()
