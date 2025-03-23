import tkinter as tk
from tkinter import ttk
from PIL import ImageGrab
import threading
import time
import pyperclip
import requests
import io

# Replace with your actual API endpoint
# API_ENDPOINT = "http://localhost:3000/message"
API_ENDPOINT = "https://texthook.onrender.com/message"

# Global variable to hold the selected region (x1, y1, x2, y2)
selected_region = None

# Event to signal the clipboard monitor thread to stop
stop_event = threading.Event()

class RegionSelector(tk.Toplevel):
    def __init__(self, master):
        super().__init__(master)
        self.start_x = None
        self.start_y = None
        self.rect = None
        self.canvas = tk.Canvas(self, cursor="cross", bg="gray", highlightthickness=0)
        self.canvas.pack(fill=tk.BOTH, expand=True)
        # Make the overlay semi-transparent
        self.attributes("-alpha", 0.3)
        self.overrideredirect(True)
        self.geometry(f"{self.winfo_screenwidth()}x{self.winfo_screenheight()}+0+0")
        self.bind("<ButtonPress-1>", self.on_button_press)
        self.bind("<B1-Motion>", self.on_move_press)
        self.bind("<ButtonRelease-1>", self.on_button_release)
    
    def on_button_press(self, event):
        self.start_x = self.canvas.canvasx(event.x)
        self.start_y = self.canvas.canvasy(event.y)
        self.rect = self.canvas.create_rectangle(self.start_x, self.start_y, self.start_x, self.start_y, outline='red', width=2)
    
    def on_move_press(self, event):
        curX, curY = (self.canvas.canvasx(event.x), self.canvas.canvasy(event.y))
        self.canvas.coords(self.rect, self.start_x, self.start_y, curX, curY)
    
    def on_button_release(self, event):
        end_x = self.canvas.canvasx(event.x)
        end_y = self.canvas.canvasy(event.y)
        # Normalize coordinates
        x1 = int(min(self.start_x, end_x))
        y1 = int(min(self.start_y, end_y))
        x2 = int(max(self.start_x, end_x))
        y2 = int(max(self.start_y, end_y))
        global selected_region
        selected_region = (x1, y1, x2, y2)
        self.destroy()

def start_region_selection(root):
    # Hide main window during region selection
    root.withdraw()
    selector = RegionSelector(root)
    root.wait_window(selector)
    root.deiconify()
    print("Selected region:", selected_region)

def clipboard_monitor():
    last_clipboard = None
    while not stop_event.is_set():
        try:
            current_clipboard = pyperclip.paste()
            # Check for clipboard change and non-empty text
            if current_clipboard != last_clipboard and current_clipboard.strip() != "":
                print("Clipboard changed:", current_clipboard)
                if len(current_clipboard) < 500 and len(current_clipboard) > 10:
                    if selected_region:
                        # Capture screenshot of the selected area
                        screenshot = ImageGrab.grab(bbox=selected_region)
                        # Convert image to PNG byte stream
                        img_byte_arr = io.BytesIO()
                        screenshot.save(img_byte_arr, format='PNG')
                        img_byte_arr.seek(0)
                        files = {"screenshot": ("screenshot.png", img_byte_arr, "image/png")}
                        data = {"clipboard": current_clipboard}
                        response = requests.post(API_ENDPOINT, data=data, files=files)
                        print("Response status:", response.status_code)
                    else:
                        print("No region selected yet.")
                else:
                    print("Clipboard text exceeds 500 characters or < 10 chars. Not sending.")
                last_clipboard = current_clipboard
        except Exception as e:
            print("Error in clipboard monitor:", e)
        time.sleep(0.5)
    print("Clipboard monitor stopped.")

class ClipboardWatcherApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Clipboard Watcher")
        self.root.geometry("300x150")
        self.is_watching = False
        self.monitor_thread = None

        self.label = ttk.Label(root, text="Clipboard Watcher", font=("Arial", 16))
        self.label.pack(pady=20)
        self.button = ttk.Button(root, text="Start", command=self.toggle_watching)
        self.button.pack(pady=20)

    def toggle_watching(self):
        if not self.is_watching:
            # Start watching: perform region selection and start clipboard monitoring
            start_region_selection(self.root)
            # Reset the stop event before starting
            stop_event.clear()
            self.monitor_thread = threading.Thread(target=clipboard_monitor, daemon=True)
            self.monitor_thread.start()
            self.is_watching = True
            self.label.config(text="Watching")
            self.button.config(text="Stop Watching")
        else:
            # Stop watching: signal the thread to stop
            stop_event.set()
            self.is_watching = False
            self.label.config(text="Stopped Watching")
            self.button.config(text="Start")

def main():
    root = tk.Tk()
    app = ClipboardWatcherApp(root)
    root.mainloop()

if __name__ == "__main__":
    main()
