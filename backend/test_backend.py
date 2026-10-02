import requests
import json

BASE_URL = "http://localhost:8000"

def test_root():
    """Test the root endpoint"""
    response = requests.get(f"{BASE_URL}/")
    print(f"Root endpoint: {response.status_code}")
    print(f"Response: {response.json()}")

def test_docs():
    """Test the API documentation endpoint"""
    response = requests.get(f"{BASE_URL}/docs")
    print(f"Docs endpoint: {response.status_code}")
    if response.status_code == 200:
        print("API documentation is accessible")
    else:
        print("Failed to access API documentation")

if __name__ == "__main__":
    print("Testing backend...")
    try:
        test_root()
        test_docs()
        print("\nBackend is running correctly!")
    except Exception as e:
        print(f"Error testing backend: {e}")

