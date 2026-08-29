from playwright.sync_api import sync_playwright
import os

def main():
    os.makedirs('artifacts', exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 900})
        
        routes = [
            ('1_Landing', '/'),
            ('2_Upload', '/upload'),
            ('3_Data_Cleaning', '/cleaning'),
            ('4_Visualization', '/visualization'),
            ('5_AI_Insights', '/ai-insights'),
            ('6_Training', '/training')
        ]
        
        for name, route in routes:
            print(f"Capturing {name} at {route}...")
            page.goto(f'http://localhost:5173{route}')
            page.wait_for_timeout(3000) # Give UI components time to render/animate
            page.screenshot(path=f'artifacts/{name}.png')
            
        browser.close()
        print("Screenshots captured successfully!")

if __name__ == "__main__":
    main()
