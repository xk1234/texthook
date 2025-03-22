import time
import pyperclip
import requests

# Replace with your actual API endpoint
API_ENDPOINT = "https://texthook.onrender.com/message"
HEADERS = {"Content-Type": "text/plain"}

def main():
    last_clipboard = None
    while True:
        try:
            current_clipboard = pyperclip.paste()
            # Check if the clipboard content has changed
            if current_clipboard != last_clipboard and current_clipboard.strip() != "":
                print("Clipboard changed:", current_clipboard)
                # Send the new clipboard content to the API
                response = requests.post(API_ENDPOINT, data=current_clipboard, headers=HEADERS)
                print("Response status:", response.status_code)
                last_clipboard = current_clipboard
        except Exception as e:
            print("Error:", e)
        # Poll every half-second
        time.sleep(0.5)

if __name__ == "__main__":
    main()

# ML6iLZioM6yY3Z2F