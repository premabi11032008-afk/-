import os
import requests
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GOOGLE_API_KEY")

if not api_key:
    print("GOOGLE_API_KEY not found in environment variables.")
else:
    url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
    response = requests.get(url)
    
    if response.status_code == 200:
        models = response.json().get("models", [])
        print(f"Found {len(models)} models available:")
        print("-" * 50)
        for m in models:
            name = m.get("name")
            supported_methods = m.get("supportedGenerationMethods", [])
            print(f"Model Name: {name}")
            print(f"Supported Methods: {supported_methods}")
            print("-" * 50)
            
        with open("available_models.txt", "w") as f:
            f.write(f"Found {len(models)} models available:\n")
            f.write("-" * 50 + "\n")
            for m in models:
                name = m.get("name")
                supported_methods = m.get("supportedGenerationMethods", [])
                f.write(f"Model Name: {name}\n")
                f.write(f"Supported Methods: {supported_methods}\n")
                f.write("-" * 50 + "\n")
        print("\nModel list has also been saved to 'available_models.txt'")
    else:
        print(f"Error fetching models: {response.status_code} - {response.text}")
